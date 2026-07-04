"""
Quick script to add a Security role and gate user to the EXISTING database.
Run:  python add_security_user.py
"""
from app import create_app
from extensions import db
from models import Role, User
from werkzeug.security import generate_password_hash

app = create_app()

with app.app_context():
    # 1. Ensure "Security" role exists
    security_role = Role.query.filter_by(name="Security").first()
    if not security_role:
        security_role = Role(name="Security")
        db.session.add(security_role)
        db.session.commit()
        print("Created 'Security' role.")
    else:
        print(" 'Security' role already exists.")

    # 2. Create the security gate user (skip if username already taken)
    existing = User.query.filter_by(username="security").first()
    if existing:
        print(" User 'security' already exists — skipping.")
    else:
        security_user = User(
            username="security",
            first_name="Gate",
            last_name="Terminal",
            email="security@taitmedical.co.zw",
            password_hash=generate_password_hash("Gate@2024"),
            role_id=security_role.id,
        )
        db.session.add(security_user)
        db.session.commit()
        print(" Created security gate user.")

    print()
    print("========================================")
    print("   SECURITY GATE LOGIN CREDENTIALS    ")
    print("========================================")
    print("   Username:  security                ")
    print("   Password:  Gate@2024               ")
    print("========================================")
