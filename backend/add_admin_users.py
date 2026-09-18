"""
One-off script to add admin login accounts to an EXISTING database.
Credentials are taken from environment variables so they are never committed.

Run (one line, bash console):
    ADMIN_EMAILS="a@x.com,b@y.com" ADMIN_PASSWORD="taIt123456" python add_admin_users.py
"""
import os

from app import create_app
from extensions import db
from models import Role, User
from werkzeug.security import generate_password_hash

emails = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]
password = os.environ.get("ADMIN_PASSWORD", "")

if not emails or not password:
    raise SystemExit("Set ADMIN_EMAILS (comma-separated) and ADMIN_PASSWORD before running.")

app = create_app()

with app.app_context():
    admin_role = Role.query.filter_by(name="Admin").first()
    if not admin_role:
        raise SystemExit("No Admin role found. Start the app once so it can seed default roles.")

    for email in emails:
        username = email.split("@")[0]
        exists = User.query.filter((User.email == email) | (User.username == username)).first()
        if exists:
            print(f"  Account already exists for {email} — skipping.")
            continue
        user = User(
            username=username,
            first_name=username,
            last_name="",
            email=email,
            password_hash=generate_password_hash(password),
            role_id=admin_role.id,
        )
        db.session.add(user)
        db.session.commit()
        print(f"  Created admin: {email}  (username: {username}, password: {password})")

    print("\nDone.")