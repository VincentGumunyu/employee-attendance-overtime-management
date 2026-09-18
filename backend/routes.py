from flask import Blueprint, request, jsonify
from datetime import datetime, date, timedelta
from flask import send_file
from io import BytesIO
import secrets
import string as _string
from werkzeug.security import check_password_hash, generate_password_hash
from flask_jwt_extended import jwt_required, create_access_token, get_jwt_identity

from models import Employee, Department, Attendance, ScanLog, User, Role, db
from services import (
    AttendanceCalculationService,
    AttendanceService,
    BarcodeIdentificationProvider,
    BarcodeService,
    CredentialService,
    IdCardService,
)
from presence import (
    get_client_ip,
    load_presence_config,
    save_presence_config,
    verify_presence,
    presence_block_message,
)

api = Blueprint('api', __name__)

def _current_user():
    """
    Returns the User for the current JWT identity (or None).
    """
    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        return None
    return User.query.get(user_id)

def _parse_optional_float(value):
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None

def _is_admin(user):
    return bool(user and user.role and user.role.name == 'Admin')

def _ensure_employee_profile(user):
    """
    Returns the Employee profile linked to *user*, lazily creating one for
    Admin accounts on first use so admins can clock in/out like any staff
    member. Returns None when the account has no profile and isn't an Admin.
    """
    if user.employee_id and user.employee:
        return user.employee
    if not _is_admin(user):
        return None

    dept = Department.query.filter_by(name='Administration').first()
    if not dept:
        dept = Department(name='Administration')
        db.session.add(dept)
        db.session.flush()

    employee = Employee(
        employee_number=CredentialService.generate_next_employee_number(),
        first_name=user.first_name or 'Admin',
        last_name=user.last_name or '',
        email=user.email,
        department_id=dept.id,
        position='Administration',
        employment_status='Active',
        weekly_working_hours=40,
    )
    BarcodeService.assign_barcode(employee, force=False)
    db.session.add(employee)
    db.session.flush()
    user.employee_id = employee.id
    db.session.commit()
    return employee

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

    # Every security terminal needs a gate barcode for employees to scan.
    if user.role and user.role.name == 'Security' and not user.gate_barcode:
        user.gate_barcode = f"GATE-{user.username.upper()}"
        db.session.commit()

    # Admins are employees too: give them a linked employee profile so they
    # appear in the employee list and can clock in/out at the security gate.
    if user.role and user.role.name == 'Admin' and not (user.employee_id and user.employee):
        _ensure_employee_profile(user)

    access_token = create_access_token(identity=str(user.id))
    return jsonify({
        'access_token': access_token,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role.name if user.role else 'Staff',
            'employee_id': user.employee_id,
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

def _unique_username_from_email(email):
    """
    Derive a unique username from an email address (local-part), appended with
    a numeric suffix if it collides with an existing username.
    """
    base = (email or '').strip().split('@')[0].lower().replace('.', '.').strip()
    base = base or 'employee'
    candidate = base
    suffix = 1
    while User.query.filter_by(username=candidate).first():
        suffix += 1
        candidate = f"{base}{suffix}"
    return candidate

@api.route('/employees', methods=['GET', 'POST'])
@jwt_required()
def handle_employees():
    if request.method == 'POST':
        data = request.json or {}
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''

        if not email:
            return jsonify({'error': 'Employee email is required for login'}), 400
        if not password or len(password) < 6:
            return jsonify({'error': 'A password of at least 6 characters is required'}), 400
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'An account with this email already exists'}), 409

        employee_number = data.get('employee_number')
        new_emp = Employee(
            employee_number=employee_number or CredentialService.generate_next_employee_number(),
            first_name=data['first_name'],
            last_name=data['last_name'],
            email=email,
            department_id=data['department_id'],
            position=data.get('position'),
            employment_status=data.get('employment_status') or 'Active',
            weekly_working_hours=data.get('weekly_working_hours') or 40,
            emergency_contact=data.get('emergency_contact'),
        )
        BarcodeService.assign_barcode(new_emp, force=False)
        db.session.add(new_emp)
        db.session.flush()

        staff_role = Role.query.filter_by(name='Staff').first()
        if not staff_role:
            db.session.rollback()
            return jsonify({'error': 'Staff role is not configured'}), 500

        username = _unique_username_from_email(email)
        login = User(
            username=username,
            email=email,
            first_name=data['first_name'],
            last_name=data['last_name'],
            password_hash=generate_password_hash(password),
            role_id=staff_role.id,
            employee_id=new_emp.id,
        )
        db.session.add(login)
        db.session.commit()
        return jsonify({
            'message': 'Employee and login account created',
            'employee_number': new_emp.employee_number,
            'username': username,
            'email': email,
            'barcode_value': new_emp.barcode_value
        }), 201
        
    employees = Employee.query.all()
    return jsonify([{
        'id': e.id, 
        'first_name': e.first_name, 
        'last_name': e.last_name, 
        'email': e.email,
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
            'email': employee.email,
            'department_id': employee.department_id,
            'department': employee.department.name if employee.department else None,
            'position': employee.position,
            'employment_status': employee.employment_status,
            'weekly_working_hours': employee.weekly_working_hours,
            'barcode_value': employee.barcode_value,
            'barcode_enabled': employee.barcode_enabled,
            'emergency_contact': employee.emergency_contact,
        })

    if request.method == 'DELETE':
        # Delete any linked login account so the employee can no longer sign in.
        linked = User.query.filter_by(employee_id=employee.id).first()
        if linked:
            db.session.delete(linked)
        db.session.delete(employee)
        db.session.commit()
        return jsonify({'message': 'Employee deleted'}), 200

    data = request.json or {}
    for k in ['first_name', 'last_name', 'position', 'employment_status', 'emergency_contact']:
        if k in data:
            setattr(employee, k, data.get(k))
    if 'email' in data and data.get('email'):
        email = data.get('email').strip().lower()
        conflict = User.query.filter(User.email == email, User.employee_id != employee.id).first()
        if conflict:
            return jsonify({'error': 'An account with this email already exists'}), 409
        employee.email = email
        linked = User.query.filter_by(employee_id=employee.id).first()
        if linked:
            linked.email = email
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
    data = request.json or {}
    identifier_type = (data.get('identifier_type') or '').strip().lower()
    identifier_value = data.get('identifier_value')
    device = data.get('device')

    if not identifier_type:
        # Backward-compat: old clients send barcode directly
        if data.get('barcode'):
            identifier_type = 'barcode'
            identifier_value = data.get('barcode')

    if identifier_type != 'barcode':
        return jsonify({'error': 'Only barcode scanning is supported'}), 400

    # Gate terminals are physically at the company. Verify presence using the
    # client IP (and optional GPS if the terminal reports it) before clocking.
    presence = verify_presence(
        latitude=_parse_optional_float(data.get('latitude')),
        longitude=_parse_optional_float(data.get('longitude')),
        client_ip=get_client_ip(),
    )
    if presence.get('verified') is False:
        AttendanceService._log_scan(
            employee=None,
            identifier_type=identifier_type,
            identifier_value=(identifier_value or '').strip().upper(),
            device=device,
            scan_result='rejected',
            message='Presence check failed: ' + presence_block_message(presence),
            presence=presence,
        )
        db.session.commit()
        return jsonify({'error': presence_block_message(presence), 'blocked': True, 'presence': presence}), 403

    provider = BarcodeIdentificationProvider()

    status_code, payload = AttendanceService.process_scan(
        provider=provider,
        identifier_value=identifier_value,
        device=device,
        presence=presence,
    )
    return jsonify(payload), status_code


@api.route('/attendance/self-scan', methods=['POST'])
@jwt_required()
def self_scan():
    """
    Employee self-service scan. The logged-in employee scans the gate barcode
    displayed on the Security terminal with their phone camera. The barcode
    authenticates the gate; the employee identity comes from the JWT.
    """
    data = request.json or {}
    barcode = (data.get('barcode') or '').strip().upper()
    device = data.get('device') or 'MOBILE-CAMERA'
    latitude = _parse_optional_float(data.get('latitude'))
    longitude = _parse_optional_float(data.get('longitude'))

    user = _current_user()
    if not user:
        return jsonify({'error': 'Not authorized'}), 401
    employee = user.employee if user.employee_id else None
    if not employee:
        employee = _ensure_employee_profile(user)
    if not employee:
        return jsonify({'error': 'No employee profile linked to this account'}), 400

    # Presence check: the employee must be physically at the company. Accepts
    # GPS geofence (coords from their phone) OR an office-network IP; blocks
    # the scan when neither matches.
    presence = verify_presence(
        latitude=latitude,
        longitude=longitude,
        client_ip=get_client_ip(),
    )
    if presence.get('verified') is False:
        AttendanceService._log_scan(
            employee=employee,
            identifier_type='self_scan',
            identifier_value=barcode,
            device=device,
            scan_result='rejected',
            message='Presence check failed: ' + presence_block_message(presence),
            presence=presence,
        )
        db.session.commit()
        return jsonify({'error': presence_block_message(presence), 'blocked': True, 'presence': presence}), 403

    gate = User.query.filter(User.gate_barcode == barcode).filter(
        User.role.has(name='Security')
    ).first()
    if not gate:
        AttendanceService._log_scan(
            employee=employee,
            identifier_type='self_scan',
            identifier_value=barcode,
            device=device,
            scan_result='rejected',
            message='Invalid gate barcode',
            presence=presence,
        )
        db.session.commit()
        return jsonify({'error': 'Invalid gate barcode. Scan the barcode shown on the security terminal.'}), 404

    if AttendanceService.reject_if_duplicate_employee_scan(employee.id, window_seconds=30):
        AttendanceService._log_scan(
            employee=employee,
            identifier_type='self_scan',
            identifier_value=barcode,
            device=device,
            scan_result='rejected',
            message='Duplicate scan ignored',
            presence=presence,
        )
        db.session.commit()
        return jsonify({'error': 'Duplicate scan ignored'}), 400

    status_code, payload = AttendanceService._apply_clock(
        employee=employee,
        identifier_type='self_scan',
        identifier_value=barcode,
        device=device,
        presence=presence,
    )
    return jsonify(payload), status_code


@api.route('/settings/presence', methods=['GET'])
@jwt_required()
def get_presence_settings():
    user = _current_user()
    if not _is_admin(user):
        return jsonify({'error': 'Forbidden'}), 403
    cfg = load_presence_config()
    return jsonify({
        'enabled': cfg['enabled'],
        'company_latitude': cfg['latitude'],
        'company_longitude': cfg['longitude'],
        'allowed_radius_m': cfg['radius_m'],
        'office_ip_allowlist': '\n'.join(cfg['ip_allowlist']),
        'gps_configured': cfg['latitude'] is not None and cfg['longitude'] is not None,
        'ip_configured': len(cfg['ip_allowlist']) > 0,
        'current_client_ip': get_client_ip(),
    })


@api.route('/settings/presence', methods=['POST'])
@jwt_required()
def update_presence_settings():
    user = _current_user()
    if not _is_admin(user):
        return jsonify({'error': 'Forbidden'}), 403

    data = request.json or {}
    enabled = bool(data.get('enabled', True))
    latitude = _parse_optional_float(data.get('company_latitude'))
    longitude = _parse_optional_float(data.get('company_longitude'))

    if latitude is not None and not (-90 <= latitude <= 90):
        return jsonify({'error': 'Latitude must be between -90 and 90.'}), 400
    if longitude is not None and not (-180 <= longitude <= 180):
        return jsonify({'error': 'Longitude must be between -180 and 180.'}), 400
    if (latitude is None) != (longitude is None):
        return jsonify({'error': 'Provide both latitude and longitude for the company location.'}), 400

    try:
        radius = max(1, min(int(data.get('allowed_radius_m') or 150), 10000))
    except (TypeError, ValueError):
        radius = 150

    raw_allowlist = data.get('office_ip_allowlist') or ''
    entries = [e.strip() for e in raw_allowlist.replace(',', '\n').split() if e.strip()]
    invalid = []
    import ipaddress
    for entry in entries:
        try:
            ipaddress.ip_network(entry, strict=False)
        except ValueError:
            invalid.append(entry)
    if invalid:
        return jsonify({'error': 'Invalid office IP or network range: ' + ', '.join(invalid)}), 400

    cfg = save_presence_config(
        enabled=enabled,
        latitude=latitude,
        longitude=longitude,
        radius_m=radius,
        ip_allowlist='\n'.join(entries),
    )
    return jsonify({
        'enabled': cfg['enabled'],
        'company_latitude': cfg['latitude'],
        'company_longitude': cfg['longitude'],
        'allowed_radius_m': cfg['radius_m'],
        'office_ip_allowlist': '\n'.join(cfg['ip_allowlist']),
        'gps_configured': cfg['latitude'] is not None and cfg['longitude'] is not None,
        'ip_configured': len(cfg['ip_allowlist']) > 0,
    })


@api.route('/security/barcode', methods=['GET'])
@jwt_required()
def get_security_barcode():
    user = _current_user()
    if not user:
        return jsonify({'error': 'Not authorized'}), 401
    if not (user.role and user.role.name == 'Security'):
        return jsonify({'error': 'Forbidden'}), 403
    if not user.gate_barcode:
        user.gate_barcode = f"GATE-{user.username.upper()}"
        db.session.commit()
    return jsonify({'barcode': user.gate_barcode})


@api.route('/attendance/mine', methods=['GET'])
@jwt_required()
def my_attendance():
    """
    Attendance history for the logged-in employee.
    Query params: from=YYYY-MM-DD, to=YYYY-MM-DD (optional).
    """
    user = _current_user()
    if not user:
        return jsonify({'error': 'Not authorized'}), 401
    employee = user.employee if user.employee_id else None
    if not employee:
        employee = _ensure_employee_profile(user)
    if not employee:
        return jsonify({'error': 'No employee profile linked to this account'}), 400

    from_str = request.args.get('from')
    to_str = request.args.get('to')
    try:
        if from_str:
            from_d = datetime.strptime(from_str, '%Y-%m-%d').date()
        else:
            from_d = date.today() - timedelta(days=30)
        if to_str:
            to_d = datetime.strptime(to_str, '%Y-%m-%d').date()
        else:
            to_d = date.today()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    records = Attendance.query.filter(
        Attendance.employee_id == employee.id,
        Attendance.date >= from_d,
        Attendance.date <= to_d
    ).order_by(Attendance.date.desc()).all()

    results = []
    for r in records:
        results.append({
            'date': r.date.isoformat(),
            'check_in': r.check_in.isoformat() if r.check_in else None,
            'check_out': r.check_out.isoformat() if r.check_out else None,
            'worked_minutes': r.worked_minutes,
            'daily_overtime_minutes': r.daily_overtime_minutes,
            'late_minutes': r.late_minutes,
            'early_departure_minutes': r.early_departure_minutes,
            'status': r.attendance_status,
        })
    return jsonify(results)


@api.route('/attendance/mine/stats', methods=['GET'])
@jwt_required()
def my_attendance_stats():
    user = _current_user()
    if not user:
        return jsonify({'error': 'Not authorized'}), 401
    employee = user.employee if user.employee_id else None
    if not employee:
        employee = _ensure_employee_profile(user)
    if not employee:
        return jsonify({'error': 'No employee profile linked to this account'}), 400

    today = date.today()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)
    month_start = today.replace(day=1)

    weekly = Attendance.query.filter(
        Attendance.employee_id == employee.id,
        Attendance.date >= monday,
        Attendance.date <= sunday
    ).all()
    monthly = Attendance.query.filter(
        Attendance.employee_id == employee.id,
        Attendance.date >= month_start,
        Attendance.date <= today
    ).all()

    week_worked = sum(a.worked_minutes for a in weekly)
    week_ot = sum(a.daily_overtime_minutes for a in weekly)
    month_worked = sum(a.worked_minutes for a in monthly)
    month_ot = sum(a.daily_overtime_minutes for a in monthly)

    t = Attendance.query.filter_by(employee_id=employee.id, date=today).first()
    today_attendance = {
        'status': t.attendance_status if t else 'Absent',
        'checked_in': t.check_in.isoformat() if t and t.check_in else None,
        'checked_out': t.check_out.isoformat() if t and t.check_out else None,
        'worked_minutes': t.worked_minutes if t and t.check_out else 0,
    }

    return jsonify({
        'today': today_attendance,
        'week_worked_minutes': week_worked,
        'week_overtime_minutes': week_ot,
        'month_worked_minutes': month_worked,
        'month_overtime_minutes': month_ot,
        'required_weekly_hours': employee.weekly_working_hours or 40,
    })


@api.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    user = _current_user()
    if not user:
        return jsonify({'error': 'Not authorized'}), 401

    employee = user.employee if user.employee_id else None
    if not employee:
        employee = _ensure_employee_profile(user)
    payload = {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'role': user.role.name if user.role else 'Staff',
    }
    if employee:
        payload['employee'] = {
            'id': employee.id,
            'employee_number': employee.employee_number,
            'department': employee.department.name if employee.department else None,
            'department_id': employee.department_id,
            'position': employee.position,
            'employment_status': employee.employment_status,
            'weekly_working_hours': employee.weekly_working_hours,
            'email': employee.email,
            'emergency_contact': employee.emergency_contact,
            'barcode_value': employee.barcode_value,
        }
    return jsonify(payload)


@api.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user = _current_user()
    if not user:
        return jsonify({'error': 'Not authorized'}), 401

    data = request.json or {}
    first_name = (data.get('first_name') or '').strip()[:60]
    last_name = (data.get('last_name') or '').strip()[:60]
    email = (data.get('email') or '').strip().lower()

    if not first_name and not last_name and not email:
        return jsonify({'error': 'Nothing to update'}), 400

    if email:
        conflict = User.query.filter(User.email == email, User.id != user.id).first()
        if conflict:
            return jsonify({'error': 'An account with this email already exists'}), 409

    if first_name:
        user.first_name = first_name
    if last_name:
        user.last_name = last_name
    if email:
        user.email = email
        if user.employee_id and user.employee:
            user.employee.email = email
    if user.employee_id and user.employee:
        user.employee.first_name = user.first_name
        user.employee.last_name = user.last_name

    db.session.commit()
    return jsonify({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'role': user.role.name if user.role else 'Staff',
    }), 200


@api.route('/profile/password', methods=['POST'])
@jwt_required()
def change_password():
    user = _current_user()
    if not user:
        return jsonify({'error': 'Not authorized'}), 401

    data = request.json or {}
    current_password = data.get('current_password') or ''
    new_password = data.get('new_password') or ''

    if not check_password_hash(user.password_hash, current_password):
        return jsonify({'error': 'Current password is incorrect'}), 400
    if len(new_password) < 6:
        return jsonify({'error': 'New password must be at least 6 characters'}), 400

    user.password_hash = generate_password_hash(new_password)
    db.session.commit()
    return jsonify({'message': 'Password updated successfully'}), 200


def _generate_temporary_password():
    alphabet = _string.ascii_letters + _string.digits
    code = ''.join(secrets.choice(alphabet) for _ in range(10))
    return f"Tmc@{code}"


@api.route('/users', methods=['GET'])
@jwt_required()
def list_users():
    """Admin-only list of login accounts (for password resets)."""
    user = _current_user()
    if not _is_admin(user):
        return jsonify({'error': 'Forbidden'}), 403

    users = User.query.order_by(User.id).all()
    payload = []
    for u in users:
        emp_no = u.employee.employee_number if u.employee else None
        payload.append({
            'id': u.id,
            'username': u.username,
            'email': u.email,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'role': u.role.name if u.role else 'Staff',
            'employee_number': emp_no,
            'gate_barcode': u.gate_barcode,
        })
    return jsonify(payload), 200


@api.route('/users/<int:user_id>/password', methods=['POST'])
@jwt_required()
def admin_reset_password(user_id):
    """
    Admin-only password reset (for when a person forgets their password).
    Accepts either an explicit `password` or `generate: true` to issue a
    random temporary password that is returned once for the admin to share.
    """
    admin = _current_user()
    if not _is_admin(admin):
        return jsonify({'error': 'Forbidden'}), 403

    target = User.query.get_or_404(user_id)
    data = request.json or {}
    new_password = (data.get('password') or '')
    generate = bool(data.get('generate'))

    if not generate and not new_password:
        return jsonify({'error': 'Enter a new password or choose to generate one'}), 400
    if not generate and len(new_password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    temporary = None
    if generate:
        temporary = _generate_temporary_password()
        new_password = temporary

    target.password_hash = generate_password_hash(new_password)
    db.session.commit()

    payload = {'message': f"Password updated for '{target.username}'"}
    if temporary:
        payload['temporary_password'] = temporary
    return jsonify(payload), 200


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
            'message': l.message,
            'verified': l.verified,
            'verification_method': l.verification_method,
            'scan_ip': l.scan_ip,
            'distance_m': l.distance_m,
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
