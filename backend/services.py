from datetime import datetime, time, timedelta
import os
import re

from flask import current_app

try:
    from barcode import Code128
    from barcode.writer import ImageWriter
except Exception:  # pragma: no cover
    Code128 = None
    ImageWriter = None

try:
    from reportlab.lib.pagesizes import landscape
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
    from reportlab.lib.utils import ImageReader
except Exception:  # pragma: no cover
    canvas = None
    landscape = None
    mm = None
    ImageReader = None

from models import Employee, ScanLog, db


class GreetingService:
    """Provides rotating daily greeting messages for check-in and check-out."""

    CHECK_IN_MESSAGES = [
        ("🌞", "Welcome back, {name}! Ready for another great day?"),
        ("💙", "Great to see you, {name}! Have an amazing shift."),
        ("👋", "You're all set, {name}. Wishing you a productive day."),
        ("✨", "Check-in complete! Let's make today count, {name}."),
        ("🌟", "Good to have you here, {name}! Let's do great things."),
        ("💪", "Ready to shine, {name}? Your day starts now!"),
        ("🎯", "Welcome in, {name}! Today is full of possibilities."),
    ]

    CHECK_OUT_MESSAGES = [
        ("👏", "Thanks for your hard work today, {name}. Safe travels!"),
        ("🌙", "Shift complete! Enjoy the rest of your day, {name}."),
        ("💙", "Another great day in the books. Take care, {name}!"),
        ("😊", "Check-out complete. See you on your next shift, {name}!"),
        ("🌅", "Well done today, {name}! Time to recharge."),
        ("🎉", "You did amazing today, {name}. Enjoy your evening!"),
        ("⭐", "Great work as always, {name}. Rest up and see you soon!"),
    ]

    @staticmethod
    def get_greeting(action: str, employee_name: str) -> dict:
        """
        Returns a greeting dict with 'emoji' and 'text' keys.
        The message rotates daily based on the day of the year.
        """
        from datetime import date as _date
        day_index = _date.today().timetuple().tm_yday

        if action == "check_in":
            messages = GreetingService.CHECK_IN_MESSAGES
        else:
            messages = GreetingService.CHECK_OUT_MESSAGES

        emoji, template = messages[day_index % len(messages)]
        text = template.format(name=employee_name)
        return {"emoji": emoji, "text": text}


class AttendanceCalculationService:
    @staticmethod
    def calculate_worked_minutes(check_in, check_out, lunch_minutes=60):
        """
        Calculates worked minutes as elapsed minutes minus lunch duration.
        """
        if not check_in or not check_out:
            return 0
        elapsed_seconds = (check_out - check_in).total_seconds()
        elapsed_minutes = int(elapsed_seconds // 60)
        # Only deduct lunch if the session is long enough to include a lunch break (>5 hours)
        if elapsed_minutes > 300 and lunch_minutes > 0:
            return max(0, elapsed_minutes - lunch_minutes)
        return max(0, elapsed_minutes)

    @staticmethod
    def calculate_late_minutes(check_in, shift_start_str="08:00:00"):
        """
        Calculates late minutes relative to a shift start time.
        """
        if not check_in:
            return 0
        try:
            shift_start_time = datetime.strptime(shift_start_str, "%H:%M:%S").time()
        except ValueError:
            shift_start_time = time(8, 0, 0)
            
        check_in_time = check_in.time()
        if check_in_time > shift_start_time:
            # Create a datetime representing the shift start on the same day
            shift_start_dt = datetime.combine(check_in.date(), shift_start_time)
            diff_seconds = (check_in - shift_start_dt).total_seconds()
            return max(0, int(diff_seconds // 60))
        return 0

    @staticmethod
    def calculate_early_departure_minutes(check_out, shift_end_str="17:00:00"):
        """
        Calculates early departure minutes relative to a shift end time.
        """
        if not check_out:
            return 0
        try:
            shift_end_time = datetime.strptime(shift_end_str, "%H:%M:%S").time()
        except ValueError:
            shift_end_time = time(17, 0, 0)
            
        check_out_time = check_out.time()
        if check_out_time < shift_end_time:
            # Create a datetime representing the shift end on the same day
            shift_end_dt = datetime.combine(check_out.date(), shift_end_time)
            diff_seconds = (shift_end_dt - check_out).total_seconds()
            return max(0, int(diff_seconds // 60))
        return 0

    @staticmethod
    def calculate_daily_overtime_minutes(worked_minutes, daily_required_minutes=480):
        """
        Calculates daily overtime minutes beyond the required daily limit.
        """
        return max(0, worked_minutes - daily_required_minutes)

    @staticmethod
    def calculate_weekly_overtime_minutes(total_worked_minutes_this_week, weekly_required_minutes=2400):
        """
        Calculates weekly overtime minutes beyond the weekly requirement (40 hours = 2400 mins).
        """
        return max(0, total_worked_minutes_this_week - weekly_required_minutes)

    @staticmethod
    def get_attendance_status(check_in, check_out, late_minutes, early_departure_minutes):
        """
        Determines the correct attendance status based on scans and calculations.
        Valid statuses: On Time, Late, Checked Out, Early Departure, Absent, On Leave
        """
        if not check_in:
            return "Absent"
            
        if not check_out:
            if late_minutes > 0:
                return "Late"
            return "On Time"
        else:
            if early_departure_minutes > 0:
                return "Early Departure"
            return "Checked Out"

    @staticmethod
    def format_to_hours_mins(minutes):
        if minutes <= 0:
            return "0h 0 mins"
        hours = minutes // 60
        mins = minutes % 60
        return f"{hours}h {mins} mins"


class CredentialService:
    EMPLOYEE_NUMBER_RE = re.compile(r"^EMP(\d{6,})$")

    @staticmethod
    def generate_next_employee_number():
        """
        Generate next employee number like EMP000125 by scanning existing max.
        Works without DB sequences/migrations.
        """
        max_n = 0
        for (emp_no,) in db.session.query(Employee.employee_number).all():
            if not emp_no:
                continue
            m = CredentialService.EMPLOYEE_NUMBER_RE.match(emp_no.strip())
            if not m:
                continue
            try:
                n = int(m.group(1))
            except ValueError:
                continue
            max_n = max(max_n, n)
        return f"EMP{max_n + 1:06d}"

    @staticmethod
    def ensure_employee_number(employee: Employee):
        if employee.employee_number:
            return employee.employee_number
        employee.employee_number = CredentialService.generate_next_employee_number()
        return employee.employee_number


class BarcodeService:
    BARCODE_RE = re.compile(r"^EMP\d{6,}$")

    @staticmethod
    def validate_barcode_value(value: str) -> bool:
        if not value:
            return False
        value = value.strip().upper()
        return bool(BarcodeService.BARCODE_RE.match(value))

    @staticmethod
    def assign_barcode(employee: Employee, *, force: bool = False):
        """
        Assign barcode_value = employee_number unless already set.
        Ensures uniqueness across the system.
        """
        emp_no = CredentialService.ensure_employee_number(employee).strip().upper()
        if not force and employee.barcode_value:
            return employee.barcode_value

        barcode_value = emp_no
        if not BarcodeService.validate_barcode_value(barcode_value):
            raise ValueError("Invalid barcode value format")

        conflict = Employee.query.filter(
            Employee.barcode_value == barcode_value,
            Employee.id != employee.id
        ).first()
        if conflict:
            raise ValueError("Duplicate barcode value detected")

        employee.barcode_value = barcode_value
        employee.barcode_enabled = True
        employee.barcode_updated_at = datetime.utcnow()
        return barcode_value

    @staticmethod
    def barcode_image_path(barcode_value: str):
        base_dir = current_app.instance_path
        out_dir = os.path.join(base_dir, "barcodes")
        os.makedirs(out_dir, exist_ok=True)
        safe = re.sub(r"[^A-Z0-9_-]", "_", barcode_value.upper())
        return os.path.join(out_dir, f"{safe}.png")

    @staticmethod
    def generate_barcode_png(barcode_value: str, *, overwrite: bool = False) -> str:
        if Code128 is None or ImageWriter is None:
            raise RuntimeError("Barcode dependencies not installed. Install python-barcode and pillow.")
        if not BarcodeService.validate_barcode_value(barcode_value):
            raise ValueError("Invalid barcode value")

        out_path = BarcodeService.barcode_image_path(barcode_value)
        if (not overwrite) and os.path.exists(out_path):
            return out_path

        code = Code128(barcode_value.upper(), writer=ImageWriter())
        # python-barcode writes without extension; we want .png
        no_ext = os.path.splitext(out_path)[0]
        filename = code.save(
            no_ext,
            options={
                "module_height": 12.0,
                "quiet_zone": 2.0,
                "font_size": 10,
                "text_distance": 2.0,
            },
        )
        # normalize returned filename to .png
        if filename != out_path and os.path.exists(filename) and not os.path.exists(out_path):
            try:
                os.replace(filename, out_path)
            except Exception:
                out_path = filename
        return out_path


class IdentificationProvider:
    """
    Hardware/source-specific lookup. Attendance logic uses only identifier_type/value.
    """
    identifier_type = "unknown"

    def normalize(self, value: str) -> str:
        return (value or "").strip()

    def find_employee(self, value: str):
        raise NotImplementedError()


class BarcodeIdentificationProvider(IdentificationProvider):
    identifier_type = "barcode"

    def normalize(self, value: str) -> str:
        return (value or "").strip().upper()

    def find_employee(self, value: str):
        v = self.normalize(value)
        if not BarcodeService.validate_barcode_value(v):
            return None
        return Employee.query.filter_by(barcode_value=v, barcode_enabled=True).first()


class RFIDIdentificationProvider(IdentificationProvider):
    identifier_type = "rfid"

    def normalize(self, value: str) -> str:
        return (value or "").strip()

    def find_employee(self, value: str):
        v = self.normalize(value)
        if not v:
            return None
        return Employee.query.filter_by(rfid_uid=v).first()


class AttendanceService:
    @staticmethod
    def _log_scan(*, employee, identifier_type, identifier_value, device, scan_result, attendance_action=None, message=None):
        log = ScanLog(
            employee_id=employee.id if employee else None,
            identifier_type=identifier_type,
            identifier_value=identifier_value,
            device=device,
            scan_result=scan_result,
            attendance_action=attendance_action,
            message=message,
        )
        db.session.add(log)
        return log

    @staticmethod
    def reject_if_duplicate_scan(identifier_type: str, identifier_value: str, *, window_seconds: int = 30) -> bool:
        since = datetime.utcnow() - timedelta(seconds=window_seconds)
        recent = (
            ScanLog.query.filter(
                ScanLog.identifier_type == identifier_type,
                ScanLog.identifier_value == identifier_value,
                ScanLog.scanned_at >= since,
                ScanLog.scan_result == "success",
            )
            .order_by(ScanLog.scanned_at.desc())
            .first()
        )
        return recent is not None

    @staticmethod
    def process_scan(*, provider: IdentificationProvider, identifier_value: str, device: str = None):
        """
        Returns (status_code, payload_dict) for scan result.
        """
        identifier_value_norm = provider.normalize(identifier_value)
        identifier_type = provider.identifier_type

        if not identifier_value_norm:
            AttendanceService._log_scan(
                employee=None,
                identifier_type=identifier_type,
                identifier_value="",
                device=device,
                scan_result="rejected",
                message="Empty identifier",
            )
            db.session.commit()
            return 400, {"error": "Identifier required"}

        if AttendanceService.reject_if_duplicate_scan(identifier_type, identifier_value_norm, window_seconds=30):
            AttendanceService._log_scan(
                employee=None,
                identifier_type=identifier_type,
                identifier_value=identifier_value_norm,
                device=device,
                scan_result="rejected",
                message="Duplicate scan ignored",
            )
            db.session.commit()
            return 400, {"error": "Duplicate scan ignored"}

        employee = provider.find_employee(identifier_value_norm)
        if not employee:
            AttendanceService._log_scan(
                employee=None,
                identifier_type=identifier_type,
                identifier_value=identifier_value_norm,
                device=device,
                scan_result="not_registered",
                message="Not registered",
            )
            db.session.commit()
            return 404, {"error": "Barcode Not Registered" if identifier_type == "barcode" else "Card Not Registered"}

        from datetime import date as _date
        today = _date.today()
        now = datetime.now()

        shift_start = current_app.config.get("SHIFT_START_TIME", "08:00:00")
        shift_end = current_app.config.get("SHIFT_END_TIME", "17:00:00")
        lunch_minutes = current_app.config.get("LUNCH_DURATION_MINUTES", 60)
        daily_req = current_app.config.get("DAILY_REQUIRED_HOURS", 8) * 60

        from models import Attendance
        attendance = Attendance.query.filter_by(employee_id=employee.id, date=today).first()

        if not attendance:
            late_mins = AttendanceCalculationService.calculate_late_minutes(now, shift_start)
            status = AttendanceCalculationService.get_attendance_status(now, None, late_mins, 0)

            new_attendance = Attendance(
                employee_id=employee.id,
                date=today,
                check_in=now,
                lunch_minutes=lunch_minutes,
                daily_required_minutes=daily_req,
                late_minutes=late_mins,
                attendance_status=status,
            )
            db.session.add(new_attendance)
            AttendanceService._log_scan(
                employee=employee,
                identifier_type=identifier_type,
                identifier_value=identifier_value_norm,
                device=device,
                scan_result="success",
                attendance_action="check_in",
                message="Check-in successful",
            )
            db.session.commit()
            emp_name = f"{employee.first_name} {employee.last_name}"
            greeting = GreetingService.get_greeting("check_in", employee.first_name)
            return 200, {
                "message": "Checked in",
                "employee": emp_name,
                "department": employee.department.name if employee.department else "N/A",
                "action": "check_in",
                "time": now.strftime("%I:%M %p"),
                "status": status,
                "greeting": greeting,
            }

        if not attendance.check_out:
            # Reject check-out scans within 15-minute grace period as duplicate scans
            if attendance.check_in and (now - attendance.check_in).total_seconds() < 900:
                AttendanceService._log_scan(
                    employee=employee,
                    identifier_type=identifier_type,
                    identifier_value=identifier_value_norm,
                    device=device,
                    scan_result="rejected",
                    attendance_action="check_out",
                    message="Duplicate check-in scan within 15-minute grace period",
                )
                db.session.commit()
                return 400, {"error": "Duplicate scan ignored"}

            attendance.check_out = now

            worked_mins = AttendanceCalculationService.calculate_worked_minutes(
                attendance.check_in, now, attendance.lunch_minutes
            )
            early_departure_mins = AttendanceCalculationService.calculate_early_departure_minutes(now, shift_end)
            daily_ot_mins = AttendanceCalculationService.calculate_daily_overtime_minutes(
                worked_mins, attendance.daily_required_minutes
            )
            status = AttendanceCalculationService.get_attendance_status(
                attendance.check_in, now, attendance.late_minutes, early_departure_mins
            )

            attendance.worked_minutes = worked_mins
            attendance.early_departure_minutes = early_departure_mins
            attendance.daily_overtime_minutes = daily_ot_mins
            attendance.attendance_status = status

            AttendanceService._log_scan(
                employee=employee,
                identifier_type=identifier_type,
                identifier_value=identifier_value_norm,
                device=device,
                scan_result="success",
                attendance_action="check_out",
                message="Check-out successful",
            )
            db.session.commit()
            emp_name = f"{employee.first_name} {employee.last_name}"
            greeting = GreetingService.get_greeting("check_out", employee.first_name)
            return 200, {
                "message": "Checked out",
                "employee": emp_name,
                "department": employee.department.name if employee.department else "N/A",
                "action": "check_out",
                "time": now.strftime("%I:%M %p"),
                "status": status,
                "worked_minutes": worked_mins,
                "daily_overtime_minutes": daily_ot_mins,
                "daily_overtime_formatted": AttendanceCalculationService.format_to_hours_mins(daily_ot_mins),
                "greeting": greeting,
            }

        AttendanceService._log_scan(
            employee=employee,
            identifier_type=identifier_type,
            identifier_value=identifier_value_norm,
            device=device,
            scan_result="rejected",
            message="Already checked out today",
        )
        db.session.commit()
        return 400, {"error": "Already checked out today"}


class IdCardService:
    @staticmethod
    def generate_employee_id_card_pdf(employee: Employee, barcode_png_path: str) -> bytes:
        if canvas is None or landscape is None or mm is None or ImageReader is None:
            raise RuntimeError("PDF dependencies not installed. Install reportlab.")

        # Standard CR80 card: 85.60 × 53.98 mm
        width, height = (85.60 * mm, 53.98 * mm)

        from io import BytesIO
        buff = BytesIO()
        c = canvas.Canvas(buff, pagesize=(width, height))

        hospital_name = current_app.config.get("HOSPITAL_NAME", "TAIT HOSPITAL")

        # Header
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(width / 2, height - 8 * mm, hospital_name)
        c.setFont("Helvetica", 7)
        c.drawCentredString(width / 2, height - 12 * mm, "EMPLOYEE IDENTIFICATION CARD")

        # Employee info
        y = height - 18 * mm
        c.setFont("Helvetica-Bold", 7)
        c.drawString(6 * mm, y, "Name:")
        c.setFont("Helvetica", 7)
        c.drawString(22 * mm, y, f"{employee.first_name} {employee.last_name}")

        y -= 4 * mm
        c.setFont("Helvetica-Bold", 7)
        c.drawString(6 * mm, y, "Employee No:")
        c.setFont("Helvetica", 7)
        c.drawString(30 * mm, y, employee.employee_number or "-")

        y -= 4 * mm
        c.setFont("Helvetica-Bold", 7)
        c.drawString(6 * mm, y, "Department:")
        c.setFont("Helvetica", 7)
        dept = employee.department.name if employee.department else "-"
        c.drawString(30 * mm, y, dept)

        y -= 4 * mm
        c.setFont("Helvetica-Bold", 7)
        c.drawString(6 * mm, y, "Position:")
        c.setFont("Helvetica", 7)
        c.drawString(22 * mm, y, employee.position or "-")

        y -= 4 * mm
        c.setFont("Helvetica-Bold", 7)
        c.drawString(6 * mm, y, "Status:")
        c.setFont("Helvetica", 7)
        c.drawString(22 * mm, y, employee.employment_status or "-")

        # Barcode
        img = ImageReader(barcode_png_path)
        c.drawImage(img, 10 * mm, 6 * mm, width - 20 * mm, 16 * mm, preserveAspectRatio=True, anchor="c")
        c.setFont("Helvetica", 6)
        c.drawCentredString(width / 2, 4 * mm, employee.barcode_value or "")

        c.showPage()
        c.save()
        buff.seek(0)
        return buff.read()
