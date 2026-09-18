import React, { useEffect, useState } from 'react';
import {
  Crosshair, Save, ShieldCheck, RefreshCw, Wifi, MapPin, AlertTriangle
} from 'lucide-react';
import { api } from '../lib/api';

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState(150);
  const [allowlist, setAllowlist] = useState('');
  const [currentIp, setCurrentIp] = useState(null);
  const [gpsConfigured, setGpsConfigured] = useState(false);
  const [ipConfigured, setIpConfigured] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/settings/presence');
      const d = res.data;
      setEnabled(!!d.enabled);
      setLatitude(d.company_latitude ?? '');
      setLongitude(d.company_longitude ?? '');
      setRadius(d.allowed_radius_m);
      setAllowlist(d.office_ip_allowlist || '');
      setCurrentIp(d.current_client_ip);
      setGpsConfigured(!!d.gps_configured);
      setIpConfigured(!!d.ip_configured);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Unable to load presence settings. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const useMyLocation = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError('Location is not available in this browser. Type the company coordinates manually.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
      },
      () => setError('Could not read your location. Allow location access, or set it manually from Google Maps.'),
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await api.post('/settings/presence', {
        enabled,
        company_latitude: latitude.trim() || null,
        company_longitude: longitude.trim() || null,
        allowed_radius_m: radius,
        office_ip_allowlist: allowlist,
      });
      setGpsConfigured(!!res.data.gps_configured);
      setIpConfigured(!!res.data.ip_configured);
      setSaved(true);
      setError(null);
    } catch (e2) {
      setError(e2.response?.data?.error || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner-border" style={{ color: '#2DB54A' }} role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    );
  }

  const enforcementOn = enabled && (gpsConfigured || ipConfigured);

  return (
    <div style={{ height: '100%' }}>
      <div className="dashboard-topbar">
        <div className="topbar-title">
          <h2>Attendance Security</h2>
          <p>Verify staff are physically at the company before they clock in/out — global, applies to everyone</p>
        </div>
        <button
          className="btn-outline-tmc d-flex align-items-center gap-2"
          onClick={load}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="mc-page mc-page-stack">
        {error && (
          <div className="alert alert-danger mb-0 border-0" role="alert" style={{ borderRadius: '14px', fontSize: '13px' }}>
            {error}
          </div>
        )}
        {saved && (
          <div className="alert alert-success mb-0 border-0" role="alert" style={{ borderRadius: '14px', fontSize: '13px' }}>
            Settings saved successfully.
          </div>
        )}

        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <div className="card mc-stat">
              <div className="mc-stat-head">
                <div>
                  <div className="mc-stat-label">Status</div>
                  <div className="mc-stat-value" style={{ color: enforcementOn ? '#1A8A35' : '#B45309' }}>
                    {enforcementOn ? 'Active' : (enabled ? 'Not configured' : 'Disabled')}
                  </div>
                </div>
                <div className="mc-stat-icon" style={{ background: enforcementOn ? 'rgba(45,181,74,0.12)' : 'rgba(180,83,9,0.12)', color: enforcementOn ? '#2DB54A' : '#B45309' }}>
                  <ShieldCheck size={22} />
                </div>
              </div>
              <div className="mc-stat-foot">
                {enforcementOn
                  ? 'Scans outside the premises are blocked'
                  : (enabled ? 'Add a location or office IPs below' : 'Presence verification is switched off')}
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-4">
            <div className="card mc-stat">
              <div className="mc-stat-head">
                <div>
                  <div className="mc-stat-label">MapPin geofence</div>
                  <div className="mc-stat-value" style={{ color: gpsConfigured ? '#1A8A35' : '#64748B' }}>
                    {gpsConfigured ? 'On' : 'Off'}
                  </div>
                </div>
                <div className="mc-stat-icon" style={{ background: gpsConfigured ? 'rgba(45,181,74,0.12)' : 'rgba(100,116,139,0.12)', color: gpsConfigured ? '#2DB54A' : '#64748B' }}>
                  <MapPin size={22} />
                </div>
              </div>
              <div className="mc-stat-foot">Company location + allowed radius</div>
            </div>
          </div>
          <div className="col-12 col-lg-4">
            <div className="card mc-stat">
              <div className="mc-stat-head">
                <div>
                  <div className="mc-stat-label">Office IP check</div>
                  <div className="mc-stat-value" style={{ color: ipConfigured ? '#1A8A35' : '#64748B', fontSize: 18 }}>
                    {ipConfigured ? 'On' : 'Off'}
                  </div>
                </div>
                <div className="mc-stat-icon" style={{ background: ipConfigured ? 'rgba(45,181,74,0.12)' : 'rgba(100,116,139,0.12)', color: ipConfigured ? '#2DB54A' : '#64748B' }}>
                  <Wifi size={22} />
                </div>
              </div>
              <div className="mc-stat-foot">Current device IP: {currentIp || 'unknown'}</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '20px 22px' }}>
          <h5 style={{ fontWeight: 800, color: '#1E3027', marginBottom: 4 }}>How it works</h5>
          <p style={{ fontSize: '13px', color: '#6B8070', lineHeight: 1.6, marginBottom: 10 }}>
            When an employee clocks in, the system checks their phone MapPin against the company location AND their
            network connection against the office IP list. The scan is <strong>accepted if either matches</strong> and
            <strong> blocked if neither does</strong> — so a barcode typed from home can never be used.
          </p>
          <p style={{ fontSize: '13px', color: '#1A8A35', lineHeight: 1.6, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <ShieldCheck size={15} style={{ marginTop: 2, minWidth: 15 }} />
            <span>
              These settings are <strong>system-wide</strong> — when any admin saves changes here, they are applied
              immediately to every employee scan across the organisation.
            </span>
          </p>

          <form onSubmit={save}>
            <div className="form-check form-switch" style={{ marginBottom: 18 }}>
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="presence-enable"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="presence-enable" style={{ fontSize: 14, fontWeight: 600, color: '#1E3027' }}>
                Enforce on-premises verification for clock-in/out
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 12, marginBottom: 8 }}>
              <div>
                <label className="form-label" style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3027' }} htmlFor="s-lat">
                  Company latitude
                </label>
                <input
                  id="s-lat"
                  className="form-control"
                  type="number"
                  step="any"
                  placeholder="e.g. -17.8252"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3027' }} htmlFor="s-lng">
                  Company longitude
                </label>
                <input
                  id="s-lng"
                  className="form-control"
                  type="number"
                  step="any"
                  placeholder="e.g. 31.0335"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3027' }} htmlFor="s-radius">
                  Radius (m)
                </label>
                <input
                  id="s-radius"
                  className="form-control"
                  type="number"
                  min="1"
                  max="10000"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                />
              </div>
            </div>

            <button type="button" className="btn btn-outline-secondary d-flex align-items-center gap-2" style={{ marginBottom: 18 }} onClick={useMyLocation}>
              <Crosshair size={14} /> Use my current location
            </button>

            <div style={{ marginBottom: 8 }}>
              <label className="form-label" style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3027' }} htmlFor="s-ips">
                Office network IPs (one per line, e.g. 197.155.2.10 or 192.168.1.0/24)
              </label>
              <textarea
                id="s-ips"
                className="form-control"
                rows="3"
                placeholder={'Add the public and/or Wi-Fi gateway IPs used at the company.\nExample:\n197.155.2.10\n192.168.1.0/24'}
                value={allowlist}
                onChange={(e) => setAllowlist(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: 12.5 }}
              />
              <div className="form-text" style={{ fontSize: 12 }}>
                Scanning works on office Wi-Fi for free. To allow employees on mobile data, keep the MapPin geofence set — mobile data users are verified by location instead.
              </div>
            </div>

            <div className="d-flex align-items-center gap-2" style={{ marginTop: 18 }}>
              <button className="btn btn-success d-flex align-items-center gap-2" disabled={saving} style={{ minWidth: 140 }}>
                <Save size={16} /> {saving ? 'Saving…' : 'Save settings'}
              </button>
              <span style={{ fontSize: 12.5, color: '#6B8070' }}>
                Radius 150 m is typical; lower it if staff clock in from nearby homes.
              </span>
            </div>
          </form>
        </div>

        {!gpsConfigured && !ipConfigured && (
          <div className="alert alert-warning mb-0 border-0" role="alert" style={{ borderRadius: '14px', fontSize: '13px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={16} style={{ marginTop: 1, minWidth: 16 }} />
            <span>
              Presence verification is <strong>not yet active</strong>. Until you set a company location or office IPs above,
              barcodes can still be entered from anywhere. Open Google Maps, right-click the main gate, and copy the
              coordinates, or type the office's public Wi-Fi IP here.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
