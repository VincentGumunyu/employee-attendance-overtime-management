from flask import Blueprint, request, jsonify
from datetime import datetime, date, timedelta
from flask import send_file
from io import BytesIO
from werkzeug.security import check_password_hash
from flask_jwt_extended import jwt_required, create_access_token, get_jwt_identity

from models import Employee, Department, Attendance, ScanLog, User, db
from services import (
    AttendanceCalculationService,
    AttendanceService,
    BarcodeIdentificationProvider,
    RFIDIdentificationProvider,
    BarcodeService,
    CredentialService,
    IdCardService,
)

api = Blueprint('api', __name__)

@api.route('/login', methods=['POST'])
def login():
    data = request.json or {}
    username_or_email = data.get('username')
    password = data.get('password')
    
    if not username_or_email or not password:
        return jsonify({'error': 'Username/email and password are required'}), 400
        
    user = User.query.filter(
        (User.username == username_or_email) | (User.email == username_or_email)
    ).first()
    
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid username/email or password'}), 401
        
    access_token = create_access_token(identity=str(user.id))
    return jsonify({
        'access_token': access_token,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role.name if user.role else 'Staff'
        }
    }), 200

def format_minutes(minutes):
    if minutes <= 0:
        return "0h 0 mins"
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours}h {mins} mins"

def get_weekly_overtime_stats():
    # Sum up weekly overtime for all employees for the current week (Monday-Sunday)
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)
    
    from flask import current_app
    default_weekly_req_mins = current_app.config.get('WEEKLY_REQUIRED_HOURS', 40) * 60
    
    total_weekly_ot_minutes = 0
    
    employees = Employee.query.all()
    for emp in employees:
        weekly_req_mins = (emp.weekly_working_hours or 0) * 60
        if weekly_req_mins <= 0:
            weekly_req_mins = default_weekly_req_mins
        attendances = Attendance.query.filter(
            Attendance.employee_id == emp.id,
            Attendance.date >= monday,
            Attendance.date <= sunday
        ).all()
        worked_this_week = sum(att.worked_minutes for att in attendances)
        ot_this_week = AttendanceCalculationService.calculate_weekly_overtime_minutes(
            worked_this_week, weekly_req_mins
        )
        total_weekly_ot_minutes += ot_this_week
        
    return round(total_weekly_ot_minutes / 60.0, 1)

@api.route('/departments', methods=['GET', 'POST'])
@jwt_required()
def handle_departments():
    if request.method == 'POST':
        data = request.json
        new_dept = Department(name=data['name'])
        db.session.add(new_dept)
        db.session.commit()
        return jsonify({'message': 'Department created', 'id': new_dept.id}), 201
    
    departments = Department.query.all()
    return jsonify([{'id': d.id, 'name': d.name} for d in departments])


@api.route('/departments/<int:department_id>', methods=['PUT', 'DELETE'])
@jwt_required()
def handle_department(department_id):
    dept = Department.query.get_or_404(department_id)
    if request.method == 'DELETE':
        db.session.delete(dept)
        db.session.commit()
        return jsonify({'message': 'Department deleted'}), 200

    data = request.json or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name required'}), 400
    dept.name = name
    db.session.commit()
    return jsonify({'message': 'Department updated'}), 200

@api.route('/employees', methods=['GET', 'POST'])
@jwt_required()
def handle_employees():
    if request.method == 'POST':
        data = request.json
        employee_number = data.get('employee_number')
        new_emp = Employee(
            employee_number=employee_number or CredentialService.generate_next_employee_number(),
            first_name=data['first_name'],
            last_name=data['last_name'],
            department_id=data['department_id'],
            rfid_uid=data.get('rfid_uid'),
            position=data.get('position'),
            employment_status=data.get('employment_status') or 'Active',
            weekly_working_hours=data.get('weekly_working_hours') or 40,
            emergency_contact=data.get('emergency_contact'),
        )
        # Auto-generate barcode credential
        BarcodeService.assign_barcode(new_emp, force=False)
        db.session.add(new_emp)
        db.session.commit()
        return jsonify({
            'message': 'Employee created',
            'employee_number': new_emp.employee_number,
            'barcode_value': new_emp.barcode_value
        }), 201
        
    employees = Employee.query.all()
    return jsonify([{
        'id': e.id, 
        'first_name': e.first_name, 
        'last_name': e.last_name, 
        'employee_number': e.employee_number,
        'department': e.department.name if e.department else 'N/A',
        'department_id': e.department_id,
        'position': e.position,
        'employment_status': e.employment_status,
        'weekly_working_hours': e.weekly_working_hours,
        'barcode_value': e.barcode_value,
        'barcode_enabled': e.barcode_enabled,
        'emergency_contact': e.emergency_contact
    } for e in employees])


@api.route('/employees/<int:employee_id>', methods=['GET', 'PUT', 'DELETE'])
@jwt_required()
def handle_employee(employee_id):
    employee = Employee.query.get_or_404(employee_id)
    if request.method == 'GET':
        return jsonify({
            'id': employee.id,
            'employee_number': employee.employee_number,
            'first_name': employee.first_name,
            'last_name': employee.last_name,
            'department_id': employee.department_id,
            'department': employee.department.name if employee.department else None,
            'position': employee.position,
            'employment_status': employee.employment_status,
            'weekly_working_hours': employee.weekly_working_hours,
            'rfid_uid': employee.rfid_uid,
            'barcode_value': employee.barcode_value,
            'barcode_enabled': employee.barcode_enabled,
            'emergency_contact': employee.emergency_contact,
        })

    if request.method == 'DELETE':
        db.session.delete(employee)
        db.session.commit()
        return jsonify({'message': 'Employee deleted'}), 200

    data = request.json or {}
    for k in ['first_name', 'last_name', 'position', 'employment_status', 'rfid_uid', 'emergency_contact']:
        if k in data:
            setattr(employee, k, data.get(k))
    if 'department_id' in data:
        employee.department_id = data.get('department_id')
    if 'weekly_working_hours' in data:
        employee.weekly_working_hours = data.get('weekly_working_hours') or employee.weekly_working_hours
    db.session.commit()
    return jsonify({'message': 'Employee updated'}), 200


@api.route('/reports/attendance', methods=['GET'])
@jwt_required()
def report_attendance():
    """
    Query params: from=YYYY-MM-DD, to=YYYY-MM-DD
    """
    from_str = request.args.get('from')
    to_str = request.args.get('to')
    try:
        from_d = datetime.strptime(from_str, '%Y-%m-%d').date() if from_str else date.today()
        to_d = datetime.strptime(to_str, '%Y-%m-%d').date() if to_str else date.today()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    records = Attendance.query.filter(
        Attendance.date >= from_d,
        Attendance.date <= to_d
    ).order_by(Attendance.date.desc(), Attendance.created_at.desc()).all()

    results = []
    for r in records:
        emp = r.employee
        results.append({
            'date': r.date.isoformat(),
            'employee_number': emp.employee_number,
            'employee_name': f"{emp.first_name} {emp.last_name}",
            'department': emp.department.name if emp.department else None,
            'check_in': r.check_in.isoformat() if r.check_in else None,
            'check_out': r.check_out.isoformat() if r.check_out else None,
            'worked_minutes': r.worked_minutes,
            'daily_overtime_minutes': r.daily_overtime_minutes,
            'late_minutes': r.late_minutes,
            'early_departure_minutes': r.early_departure_minutes,
            'status': r.attendance_status,
        })
    return jsonify(results)


@api.route('/reports/overtime', methods=['GET'])
@jwt_required()
def report_overtime():
    from_str = request.args.get('from')
    to_str = request.args.get('to')
    try:
        from_d = datetime.strptime(from_str, '%Y-%m-%d').date() if from_str else date.today()
        to_d = datetime.strptime(to_str, '%Y-%m-%d').date() if to_str else date.today()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    records = Attendance.query.filter(
        Attendance.date >= from_d,
        Attendance.date <= to_d,
        Attendance.daily_overtime_minutes > 0
    ).order_by(Attendance.date.desc(), Attendance.daily_overtime_minutes.desc()).all()

    results = []
    for r in records:
        emp = r.employee
        results.append({
            'date': r.date.isoformat(),
            'employee_number': emp.employee_number,
            'employee_name': f"{emp.first_name} {emp.last_name}",
            'department': emp.department.name if emp.department else None,
            'daily_overtime_minutes': r.daily_overtime_minutes,
            'worked_minutes': r.worked_minutes,
        })
    return jsonify(results)

@api.route('/attendance/scan', methods=['POST'])
def scan_rfid():
    data = request.json
    identifier_type = (data.get('identifier_type') or '').strip().lower()
    identifier_value = data.get('identifier_value')
    device = data.get('device')

    if not identifier_type:
        # Backward-compat: old clients send rfid_uid
        if data.get('rfid_uid'):
            identifier_type = 'rfid'
            identifier_value = data.get('rfid_uid')
        elif data.get('barcode'):
            identifier_type = 'barcode'
            identifier_value = data.get('barcode')

    if identifier_type == 'barcode':
        provider = BarcodeIdentificationProvider()
    elif identifier_type == 'rfid':
        provider = RFIDIdentificationProvider()
    else:
        return jsonify({'error': 'identifier_type must be barcode or rfid'}), 400

    status_code, payload = AttendanceService.process_scan(
        provider=provider,
        identifier_value=identifier_value,
        device=device
    )
    return jsonify(payload), status_code


@api.route('/employees/<int:employee_id>/barcode/regenerate', methods=['POST'])
@jwt_required()
def regenerate_employee_barcode(employee_id):
    employee = Employee.query.get_or_404(employee_id)
    BarcodeService.assign_barcode(employee, force=True)
    db.session.commit()
    return jsonify({'message': 'Barcode regenerated', 'barcode_value': employee.barcode_value}), 200


@api.route('/employees/<int:employee_id>/barcode/disable', methods=['POST'])
@jwt_required()
def disable_employee_barcode(employee_id):
    employee = Employee.query.get_or_404(employee_id)
    employee.barcode_enabled = False
    db.session.commit()
    return jsonify({'message': 'Barcode disabled'}), 200


@api.route('/employees/<int:employee_id>/barcode/enable', methods=['POST'])
@jwt_required()
def enable_employee_barcode(employee_id):
    employee = Employee.query.get_or_404(employee_id)
    if not employee.barcode_value:
        BarcodeService.assign_barcode(employee, force=True)
    employee.barcode_enabled = True
    db.session.commit()
    return jsonify({'message': 'Barcode enabled', 'barcode_value': employee.barcode_value}), 200


@api.route('/employees/<int:employee_id>/barcode/replace', methods=['POST'])
@jwt_required()
def replace_employee_barcode(employee_id):
    employee = Employee.query.get_or_404(employee_id)
    data = request.json or {}
    barcode_value = (data.get('barcode_value') or '').strip().upper()
    if not BarcodeService.validate_barcode_value(barcode_value):
        return jsonify({'error': 'Invalid barcode value'}), 400
    conflict = Employee.query.filter(
        Employee.barcode_value == barcode_value,
        Employee.id != employee.id
    ).first()
    if conflict:
        return jsonify({'error': 'Duplicate barcode value'}), 409
    employee.barcode_value = barcode_value
    employee.barcode_enabled = True
    employee.barcode_updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'message': 'Barcode replaced', 'barcode_value': employee.barcode_value}), 200


@api.route('/employees/<int:employee_id>/barcode.png', methods=['GET'])
@jwt_required()
def get_employee_barcode_png(employee_id):
    employee = Employee.query.get_or_404(employee_id)
    if not employee.barcode_value or not employee.barcode_enabled:
        return jsonify({'error': 'Barcode not available'}), 404
    try:
        path = BarcodeService.generate_barcode_png(employee.barcode_value, overwrite=False)
        return send_file(path, mimetype='image/png')
    except Exception as e:
        # If server-side deps aren't installed, frontend can render barcode instead.
        return jsonify({
            'error': 'Barcode image generation not available on server',
            'barcode_value': employee.barcode_value,
            'details': str(e)
        }), 501


@api.route('/employees/<int:employee_id>/id-card.pdf', methods=['GET'])
@jwt_required()
def get_employee_id_card_pdf(employee_id):
    employee = Employee.query.get_or_404(employee_id)
    if not employee.barcode_value or not employee.barcode_enabled:
        return jsonify({'error': 'Barcode not available'}), 404
    try:
        barcode_path = BarcodeService.generate_barcode_png(employee.barcode_value, overwrite=False)
        pdf_bytes = IdCardService.generate_employee_id_card_pdf(employee, barcode_path)
        return send_file(
            BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"{employee.employee_number or 'employee'}-id-card.pdf"
        )
    except Exception as e:
        return jsonify({
            'error': 'ID card PDF generation not available on server',
            'employee_number': employee.employee_number,
            'barcode_value': employee.barcode_value,
            'details': str(e)
        }), 501


@api.route('/employees/<int:employee_id>/credential', methods=['GET'])
@jwt_required()
def get_employee_credential(employee_id):
    employee = Employee.query.get_or_404(employee_id)
    return jsonify({
        'employee_id': employee.id,
        'employee_number': employee.employee_number,
        'barcode_value': employee.barcode_value,
        'barcode_enabled': employee.barcode_enabled,
        'barcode_updated_at': employee.barcode_updated_at.isoformat() if employee.barcode_updated_at else None,
        'first_name': employee.first_name,
        'last_name': employee.last_name,
        'department': employee.department.name if employee.department else None,
        'position': employee.position,
        'employment_status': employee.employment_status,
        'emergency_contact': employee.emergency_contact,
    })


@api.route('/scan-logs/recent', methods=['GET'])
@jwt_required()
def get_recent_scan_logs():
    limit = int(request.args.get('limit') or 25)
    logs = ScanLog.query.order_by(ScanLog.scanned_at.desc()).limit(min(limit, 200)).all()
    results = []
    for l in logs:
        emp_name = f"{l.employee.first_name} {l.employee.last_name}" if l.employee else None
        results.append({
            'id': l.id,
            'employee': emp_name,
            'identifier_type': l.identifier_type,
            'identifier_value': l.identifier_value,
            'time': l.scanned_at.strftime('%I:%M %p'),
            'date': l.scanned_at.strftime('%d %b %Y'),
            'device': l.device,
            'result': l.scan_result,
            'action': l.attendance_action,
            'message': l.message
        })
    return jsonify(results)

@api.route('/dashboard/stats', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    today = date.today()
    total_employees = Employee.query.filter_by(employment_status='Active').count()
    present_today = Attendance.query.filter_by(date=today).count()
    checked_in = Attendance.query.filter(
        Attendance.date == today,
        Attendance.check_in.isnot(None)
    ).count()
    checked_out = Attendance.query.filter(
        Attendance.date == today,
        Attendance.check_out.isnot(None)
    ).count()
    inside_now = Attendance.query.filter(
        Attendance.date == today,
        Attendance.check_in.isnot(None),
        Attendance.check_out.is_(None)
    ).count()
    late_today = Attendance.query.filter(
        Attendance.date == today,
        Attendance.late_minutes > 0
    ).count()
    absent_today = max(0, total_employees - present_today)
    weekly_ot = get_weekly_overtime_stats()
    
    return jsonify({
        'total_employees': total_employees,
        'present_today': present_today,
        'checked_in': checked_in,
        'checked_out': checked_out,
        'inside_now': inside_now,
        'late_today': late_today,
        'absent_today': absent_today,
        'weekly_overtime': f"{weekly_ot} hrs"
    })

@api.route('/dashboard/recent', methods=['GET'])
@jwt_required()
def get_recent_activity():
    today = date.today()
    records = Attendance.query.filter_by(date=today).order_by(Attendance.created_at.desc()).all()
    
    results = []
    for r in records:
        emp = r.employee
        dept_name = emp.department.name if emp.department else "N/A"
        
        check_in_time = r.check_in.strftime('%I:%M %p') if r.check_in else '-'
        check_out_time = r.check_out.strftime('%I:%M %p') if r.check_out else '-'
        record_date = r.date.strftime('%d %b %Y')
        
        worked_today = format_minutes(r.worked_minutes) if r.check_out else '-'
            
        results.append({
            'employee_name': f"{emp.first_name} {emp.last_name}",
            'department': dept_name,
            'date': record_date,
            'check_in': check_in_time,
            'check_out': check_out_time,
            'attendance_status': r.attendance_status,
            'worked_today': worked_today
        })
        
    return jsonify(results)

@api.route('/dashboard/overtime_today', methods=['GET'])
@jwt_required()
def get_overtime_today():
    today = date.today()
    records = Attendance.query.filter(
        Attendance.date == today,
        Attendance.daily_overtime_minutes > 0
    ).all()
    
    results = []
    for r in records:
        emp = r.employee
        results.append({
            'employee_name': f"{emp.first_name} {emp.last_name}",
            'overtime': format_minutes(r.daily_overtime_minutes)
        })
        
    return jsonify(results)
