import ipaddress
import math

from flask import request
from models import SystemSetting, db


def _load_setting(key, default=None):
    row = SystemSetting.query.get(key)
    if row is None or row.value is None or row.value == '':
        return default
    if default is not None and isinstance(default, bool):
        return str(row.value).lower() in ('1', 'true', 'yes', 'on')
    return row.value


def _save_setting(key, value):
    row = SystemSetting.query.get(key)
    if row is None:
        row = SystemSetting(key=key)
        db.session.add(row)
    row.value = str(value) if value is not None else None
    return row


def seed_default_presence_settings(app_config):
    """
    Ensure runtime presence settings exist, seeded from config/env defaults.
    Called once at app startup so a fresh deploy is ready to configure.
    """
    defaults = {
        'presence_check_enabled': str(app_config.get('PRESENCE_CHECK_ENABLED', True)).lower(),
        'company_latitude': app_config.get('COMPANY_LATITUDE') or '',
        'company_longitude': app_config.get('COMPANY_LONGITUDE') or '',
        'allowed_radius_m': str(app_config.get('ALLOWED_RADIUS_METERS', 150)),
        'office_ip_allowlist': app_config.get('OFFICE_NETWORK_IP_ALLOWLIST') or '',
    }
    for key, value in defaults.items():
        _save_setting(key, value)
    db.session.commit()


def _parse_float(value):
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def haversine_distance_m(lat1, lng1, lat2, lng2):
    """Great-circle distance in meters between two lat/lng points."""
    earth_radius_m = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlng / 2) ** 2
    return earth_radius_m * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _ip_in_network(ip, network_entry):
    try:
        return ipaddress.ip_address(ip) in ipaddress.ip_network(network_entry, strict=False)
    except ValueError:
        return False


def get_client_ip():
    """
    Best-effort client IP, honouring reverse-proxy forwarding (used behind
    Nginx/Render). On a plain LAN connection this is simply the peer address.
    """
    try:
        forwarded = getattr(request, 'access_route', None)
        if forwarded:
            return forwarded[0]
    except Exception:
        pass
    return request.remote_addr


def load_presence_config():
    return {
        'enabled': _load_setting('presence_check_enabled', True),
        'latitude': _parse_float(_load_setting('company_latitude', '')),
        'longitude': _parse_float(_load_setting('company_longitude', '')),
        'radius_m': int(_load_setting('allowed_radius_m', 150) or 150),
        'ip_allowlist': [
            e.strip() for e in
            (_load_setting('office_ip_allowlist', '') or '').replace(',', '\n').split()
            if e.strip()
        ],
    }


def save_presence_config(*, enabled, latitude, longitude, radius_m, ip_allowlist):
    _save_setting('presence_check_enabled', 'true' if enabled else 'false')
    _save_setting('company_latitude', latitude)
    _save_setting('company_longitude', longitude)
    _save_setting('allowed_radius_m', radius_m)
    _save_setting('office_ip_allowlist', ip_allowlist)
    db.session.commit()
    return load_presence_config()


def verify_presence(latitude=None, longitude=None, client_ip=None):
    """
    Runs both presence checks and returns a detail dict:

      {
        'verified': True/False/None,   # None => not enforced (disabled / unconfigured)
        'method': 'gps' | 'ip' | None,
        'enabled': bool,
        'gps_configured': bool,
        'ip_configured': bool,
        'gps_distance_m': int|None,
        'gps_within_radius': True/False/None,
        'ip_on_network': True/False/None,
        'radius_m': int,
        'client_ip': str|None,
        'reason': None|'disabled'|'not_configured'|'off_site'|'outside_radius'
      }
    """
    cfg = load_presence_config()
    info = {
        'verified': None,
        'method': None,
        'enabled': cfg['enabled'],
        'gps_configured': cfg['latitude'] is not None and cfg['longitude'] is not None,
        'ip_configured': len(cfg['ip_allowlist']) > 0,
        'gps_distance_m': None,
        'gps_within_radius': None,
        'ip_on_network': None,
        'radius_m': cfg['radius_m'],
        'client_ip': client_ip,
        'reason': None,
    }

    if not cfg['enabled']:
        info['reason'] = 'disabled'
        return info

    if info['gps_configured'] and latitude is not None and longitude is not None:
        distance = haversine_distance_m(
            float(latitude), float(longitude), cfg['latitude'], cfg['longitude']
        )
        info['gps_distance_m'] = int(distance)
        info['gps_within_radius'] = distance <= cfg['radius_m']

    if info['ip_configured'] and client_ip:
        info['ip_on_network'] = any(
            _ip_in_network(client_ip, entry) for entry in cfg['ip_allowlist']
        )

    if not (info['gps_configured'] or info['ip_configured']):
        info['reason'] = 'not_configured'
        return info

    if info['gps_within_radius']:
        info['verified'] = True
        info['method'] = 'gps'
    elif info['ip_on_network']:
        info['verified'] = True
        info['method'] = 'ip'
    else:
        info['verified'] = False
        if info['gps_distance_m'] is not None:
            info['reason'] = 'outside_radius'
        else:
            info['reason'] = 'off_site'

    return info


def presence_block_message(info):
    """
    User-friendly explanation of why a scan was blocked. Lets staff know what
    to fix (turn on GPS, join office Wi-Fi) instead of a generic error.
    """
    if info.get('gps_distance_m') is not None and info.get('radius_m'):
        return (
            f"Not verified on-site: your location is {info['gps_distance_m']} m away "
            f"from the company (only {info['radius_m']} m allowed). "
            "Please clock in/out while at the company premises."
        )
    if info.get('ip_on_network') is False and info.get('gps_within_radius') is False:
        return (
            "Presence could not be verified. Turn on location (GPS) on your phone and/or "
            "connect to the office Wi-Fi, then try again."
        )
    return (
        "Presence could not be verified. Please allow location access and connect "
        "to the office Wi-Fi while at the company gate, then try again."
    )