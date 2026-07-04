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
