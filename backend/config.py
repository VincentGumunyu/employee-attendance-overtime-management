import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'super-secret-key'
    db_url = os.environ.get('DATABASE_URL') or 'sqlite:///hospital.db'
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI = db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'jwt-super-secret-key'
    SHIFT_START_TIME = os.environ.get('SHIFT_START_TIME') or '08:00:00'
    SHIFT_END_TIME = os.environ.get('SHIFT_END_TIME') or '17:00:00'
    LUNCH_DURATION_MINUTES = int(os.environ.get('LUNCH_DURATION_MINUTES') or 60)
    DAILY_REQUIRED_HOURS = int(os.environ.get('DAILY_REQUIRED_HOURS') or 8)
    WEEKLY_REQUIRED_HOURS = int(os.environ.get('WEEKLY_REQUIRED_HOURS') or 40)

    # Presence verification: confirms the person is physically at the company
    # before a check-in/check-out is accepted. Both GPS geofence and office
    # network IP checks run together; a scan is accepted if EITHER passes and
    # blocked if neither does. Values are overridable at runtime (admin page)
    # once the server is running via the system_settings table.
    PRESENCE_CHECK_ENABLED = (os.environ.get('PRESENCE_CHECK_ENABLED') or 'true').lower() in ('1', 'true', 'yes', 'on')
    COMPANY_LATITUDE = os.environ.get('COMPANY_LATITUDE') or None
    COMPANY_LONGITUDE = os.environ.get('COMPANY_LONGITUDE') or None
    ALLOWED_RADIUS_METERS = int(os.environ.get('ALLOWED_RADIUS_METERS') or 150)
    # Comma/newline separated list of office IPs or CIDR ranges (e.g. 197.155.2.10, 192.168.1.0/24)
    OFFICE_NETWORK_IP_ALLOWLIST = os.environ.get('OFFICE_NETWORK_IP_ALLOWLIST') or ''
