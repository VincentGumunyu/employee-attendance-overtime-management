from flask import Flask
from config import Config
from extensions import db, jwt, cors

def _ensure_sqlite_schema_updates():
    """
    Minimal SQLite-only schema patching (no Alembic).
    Adds new columns safely when running against an existing hospital.db.
    """
    try:
        uri = str(db.engine.url)
    except Exception:
        return
    if not uri.startswith("sqlite:"):
        return

    def has_column(table, column):
        rows = db.session.execute(db.text(f"PRAGMA table_info({table})")).fetchall()
        return any(r[1] == column for r in rows)

    # employees new columns
    if not has_column("employees", "barcode_value"):
        db.session.execute(db.text("ALTER TABLE employees ADD COLUMN barcode_value VARCHAR(50)"))
    if not has_column("employees", "barcode_enabled"):
        db.session.execute(db.text("ALTER TABLE employees ADD COLUMN barcode_enabled BOOLEAN NOT NULL DEFAULT 1"))
    if not has_column("employees", "barcode_updated_at"):
        db.session.execute(db.text("ALTER TABLE employees ADD COLUMN barcode_updated_at DATETIME"))

    # users new columns
    if not has_column("users", "email"):
        db.session.execute(db.text("ALTER TABLE users ADD COLUMN email VARCHAR(120)"))
    if not has_column("users", "first_name"):
        db.session.execute(db.text("ALTER TABLE users ADD COLUMN first_name VARCHAR(100)"))
    if not has_column("users", "last_name"):
        db.session.execute(db.text("ALTER TABLE users ADD COLUMN last_name VARCHAR(100)"))
    if not has_column("users", "employee_id"):
        db.session.execute(db.text("ALTER TABLE users ADD COLUMN employee_id INTEGER"))
    if not has_column("users", "gate_barcode"):
        db.session.execute(db.text("ALTER TABLE users ADD COLUMN gate_barcode VARCHAR(100)"))

    # scan_logs presence columns
    if not has_column("scan_logs", "verified"):
        db.session.execute(db.text("ALTER TABLE scan_logs ADD COLUMN verified BOOLEAN"))
    if not has_column("scan_logs", "verification_method"):
        db.session.execute(db.text("ALTER TABLE scan_logs ADD COLUMN verification_method VARCHAR(20)"))
    if not has_column("scan_logs", "scan_ip"):
        db.session.execute(db.text("ALTER TABLE scan_logs ADD COLUMN scan_ip VARCHAR(64)"))
    if not has_column("scan_logs", "distance_m"):
        db.session.execute(db.text("ALTER TABLE scan_logs ADD COLUMN distance_m INTEGER"))

    db.session.commit()

DEFAULT_DEPARTMENTS = [
    "Administration",
    "Human Resources",
    "Finance",
    "Information Technology",
    "Security",
    "Nursing",
    "Clinical Services",
    "Pharmacy",
    "Laboratory",
    "Health Records",
    "Housekeeping",
    "Catering",
    "Maintenance",
    "Transport",
]

def _ensure_default_seed():
    """
    Seed default roles, departments, and users if tables are empty.
    """
    from models import Role, Department, User, Employee
    from werkzeug.security import generate_password_hash
    from services import BarcodeService, CredentialService
    
    try:
        if Role.query.first() is None:
            admin_role = Role(name="Admin")
            staff_role = Role(name="Staff")
            security_role = Role(name="Security")
            db.session.add_all([admin_role, staff_role, security_role])
            db.session.commit()

        if Department.query.first() is None:
            db.session.add_all([Department(name=d) for d in DEFAULT_DEPARTMENTS])
            db.session.commit()
            
        if User.query.first() is None:
            admin_role = Role.query.filter_by(name="Admin").first()
            security_role = Role.query.filter_by(name="Security").first()
            staff_role = Role.query.filter_by(name="Staff").first()
            
            peter_user = User(
                username="peter",
                first_name="Peter",
                last_name="Gumunyu",
                email="gumunyuvincent@gmail.com",
                password_hash=generate_password_hash("Loice@1969"),
                role_id=admin_role.id
            )
            db.session.add(peter_user)
            
            security_user = User(
                username="security",
                first_name="Gate",
                last_name="Terminal",
                email="security@taitmedical.co.zw",
                password_hash=generate_password_hash("Gate@2024"),
                role_id=security_role.id,
                gate_barcode="GATE-SECURITY"
            )
            db.session.add(security_user)

            # Demo staff account + linked employee so the employee self-service
            # flow can be tested out of the box.
            if staff_role and Department.query.filter_by(name="Nursing").first():
                demo_emp = Employee(
                    employee_number=CredentialService.generate_next_employee_number(),
                    first_name="Tapiwa",
                    last_name="Ncube",
                    email="tapiwa.ncube@taitmedical.co.zw",
                    department_id=Department.query.filter_by(name="Nursing").first().id,
                    position="Staff Nurse",
                    employment_status="Active",
                    weekly_working_hours=40,
                )
                BarcodeService.assign_barcode(demo_emp, force=False)
                db.session.add(demo_emp)
                db.session.flush()
                demo_user = User(
                    username="tapiwa.ncube",
                    first_name="Tapiwa",
                    last_name="Ncube",
                    email="tapiwa.ncube@taitmedical.co.zw",
                    password_hash=generate_password_hash("Tapiwa@2024"),
                    role_id=staff_role.id,
                    employee_id=demo_emp.id,
                )
                db.session.add(demo_user)
            db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Error seeding default database: {e}")

def _ensure_admin_employee_profiles():
    """
    Every Admin account is also a hospital employee, so admins are visible in the
    Employees list (including themselves) and can clock in/out at the security
    gate. Creates a linked Employee profile for any admin that lacks one.
    """
    from models import Role, Department, Employee, User
    from services import BarcodeService, CredentialService
    try:
        admin_role = Role.query.filter_by(name='Admin').first()
        if not admin_role:
            return
        for user in User.query.filter_by(role_id=admin_role.id).all():
            if user.employee_id and user.employee:
                continue
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
    except Exception as e:
        db.session.rollback()
        print(f"Error ensuring admin employee profiles: {e}")

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})

    with app.app_context():
        import models
        db.create_all()
        _ensure_sqlite_schema_updates()

        from presence import seed_default_presence_settings
        seed_default_presence_settings(app.config)

        _ensure_default_seed()
        _ensure_admin_employee_profiles()

    from routes import api as api_bp
    app.register_blueprint(api_bp, url_prefix='/api')

    @app.route('/health', methods=['GET'])
    def health_check():
        return {'status': 'healthy'}, 200

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
