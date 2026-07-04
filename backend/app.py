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

    db.session.commit()

def _ensure_default_seed():
    """
    Seed default roles and users if tables are empty.
    """
    from models import Role, User
    from werkzeug.security import generate_password_hash
    
    try:
        if Role.query.first() is None:
            admin_role = Role(name="Admin")
            staff_role = Role(name="Staff")
            security_role = Role(name="Security")
            db.session.add_all([admin_role, staff_role, security_role])
            db.session.commit()
            
        if User.query.first() is None:
            admin_role = Role.query.filter_by(name="Admin").first()
            security_role = Role.query.filter_by(name="Security").first()
            
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
                role_id=security_role.id
            )
            db.session.add(security_user)
            db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Error seeding default database: {e}")

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
        _ensure_default_seed()

    from routes import api as api_bp
    app.register_blueprint(api_bp, url_prefix='/api')

    @app.route('/health', methods=['GET'])
    def health_check():
        return {'status': 'healthy'}, 200

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
