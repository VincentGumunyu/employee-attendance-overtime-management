from app import create_app
from extensions import db
from models import Department, Employee, Role, User
from werkzeug.security import generate_password_hash

app = create_app()

with app.app_context():
    print("Dropping all existing database tables...")
    db.drop_all()
    print("Creating all database tables...")
    db.create_all()

    print("Seeding roles...")
    admin_role = Role(name="Admin")
    staff_role = Role(name="Staff")
    security_role = Role(name="Security")
    db.session.add_all([admin_role, staff_role, security_role])
    db.session.commit()

    print("Seeding departments...")
    dept_emergency = Department(name="Emergency")
    dept_icu = Department(name="ICU")
    dept_lab = Department(name="Laboratory")
    dept_cardio = Department(name="Cardiology")
    dept_peds = Department(name="Pediatrics")
    db.session.add_all([dept_emergency, dept_icu, dept_lab, dept_cardio, dept_peds])
    db.session.commit()

    print("Seeding employees...")
    emp1 = Employee(
        employee_number="EMP-001",
        first_name="John",
        last_name="Doe",
        department_id=dept_emergency.id,
        rfid_uid="123456789"
    )
    emp2 = Employee(
        employee_number="EMP-002",
        first_name="Jane",
        last_name="Smith",
        department_id=dept_icu.id,
        rfid_uid="234567890"
    )
    emp3 = Employee(
        employee_number="EMP-003",
        first_name="Michael",
        last_name="Johnson",
        department_id=dept_lab.id,
        rfid_uid="345678901"
    )
    emp4 = Employee(
        employee_number="EMP-004",
        first_name="Sarah",
        last_name="Moyo",
        department_id=dept_cardio.id,
        rfid_uid="456789012"
    )
    emp5 = Employee(
        employee_number="EMP-005",
        first_name="David",
        last_name="Ncube",
        department_id=dept_peds.id,
        rfid_uid="567890123"
    )
    db.session.add_all([emp1, emp2, emp3, emp4, emp5])
    db.session.commit()

    print("Seeding administrators...")
    peter_user = User(
        username="peter",
        first_name="Peter",
        last_name="Gumunyu",
        email="gumunyuvincent@gmail.com",
        password_hash=generate_password_hash("Loice@1969"),
        role_id=admin_role.id
    )
    db.session.add(peter_user)

    print("Seeding security gate user...")
    security_user = User(
        username="security",
        first_name="Gate",
        last_name="Terminal",
        email="security@taitmedical.co.zw",
        password_hash=generate_password_hash("Gate@2024"),
        role_id=security_role.id
    )
    db.session.add(security_user)
    db.session.commit()

    print("Database seeding completed successfully!")
