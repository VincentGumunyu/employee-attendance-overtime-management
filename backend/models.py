from datetime import datetime
from extensions import db

class Role(db.Model):
    __tablename__ = 'roles'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True)
    first_name = db.Column(db.String(100), nullable=True)
    last_name = db.Column(db.String(100), nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id'), nullable=False)
    role = db.relationship('Role', backref=db.backref('users', lazy=True))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Department(db.Model):
    __tablename__ = 'departments'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)

class Employee(db.Model):
    __tablename__ = 'employees'
    id = db.Column(db.Integer, primary_key=True)
    employee_number = db.Column(db.String(50), unique=True, nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    gender = db.Column(db.String(10), nullable=True)
    national_id = db.Column(db.String(100), nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    email = db.Column(db.String(120), nullable=True)
    department_id = db.Column(db.Integer, db.ForeignKey('departments.id'), nullable=False)
    department = db.relationship('Department', backref=db.backref('employees', lazy=True))
    position = db.Column(db.String(100), nullable=True)
    employment_date = db.Column(db.Date, nullable=True)
    employment_status = db.Column(db.String(50), default='Active')
    weekly_working_hours = db.Column(db.Integer, default=40)
    rfid_uid = db.Column(db.String(100), unique=True, nullable=True)
    emergency_contact = db.Column(db.String(100), nullable=True)
    barcode_value = db.Column(db.String(50), unique=True, nullable=True)
    barcode_enabled = db.Column(db.Boolean, default=True, nullable=False)
    barcode_updated_at = db.Column(db.DateTime, nullable=True)

class Attendance(db.Model):
    __tablename__ = 'attendance'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    employee = db.relationship('Employee', backref=db.backref('attendances', lazy=True))
    date = db.Column(db.Date, nullable=False)
    check_in = db.Column(db.DateTime, nullable=True)
    check_out = db.Column(db.DateTime, nullable=True)
    lunch_minutes = db.Column(db.Integer, default=60)
    worked_minutes = db.Column(db.Integer, default=0)
    daily_required_minutes = db.Column(db.Integer, default=480)
    daily_overtime_minutes = db.Column(db.Integer, default=0)
    late_minutes = db.Column(db.Integer, default=0)
    early_departure_minutes = db.Column(db.Integer, default=0)
    attendance_status = db.Column(db.String(50), default='Checked In')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(255), nullable=False)
    date = db.Column(db.Date, default=datetime.utcnow)
    time = db.Column(db.Time, default=datetime.utcnow)
    ip_address = db.Column(db.String(50), nullable=True)

class ScanLog(db.Model):
    __tablename__ = 'scan_logs'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=True)
    employee = db.relationship('Employee', backref=db.backref('scan_logs', lazy=True))
    identifier_type = db.Column(db.String(50), nullable=False)  # barcode, rfid, etc
    identifier_value = db.Column(db.String(100), nullable=False)
    scanned_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    device = db.Column(db.String(100), nullable=True)
    scan_result = db.Column(db.String(50), nullable=False)  # success, not_registered, rejected
    attendance_action = db.Column(db.String(50), nullable=True)  # check_in, check_out
    message = db.Column(db.String(255), nullable=True)
