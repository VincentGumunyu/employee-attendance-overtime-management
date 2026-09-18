import React, { useEffect, useState } from 'react';
import { UserRound, KeyRound, Building2, BadgeCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';

const EmployeeProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [pwErr, setPwErr] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/profile');
        setProfile(res.data);
        setError(null);
      } catch (e) {
        setError(e.response?.data?.error || 'Unable to load profile.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const changePassword = async (e) => {
    e.preventDefault();
    setPwErr(null);
    setPwMsg(null);
    if (pw.new_password.length < 6) {
      setPwErr('New password must be at least 6 characters.');
      return;
    }
    if (pw.new_password !== pw.confirm) {
      setPwErr('New passwords do not match.');
      return;
    }
    setPwLoading(true);
    try {
      await api.post('/profile/password', {
        current_password: pw.current_password,
        new_password: pw.new_password,
      });
      setPwMsg('Password updated successfully.');
      setPw({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setPwErr(err.response?.data?.error || 'Failed to update password.');
    } finally {
      setPwLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-block" style={{ minHeight: '60vh' }}>
        <div className="spinner-border" style={{ color: '#2DB54A' }} role="status" aria-label="Loading profile" />
      </div>
    );
  }

  const emp = profile?.employee;
  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();

  const row = (label, value) => (
    <div className="kv-row">
      <span className="kv-label">{label}</span>
      <span className="kv-value">{value || '—'}</span>
    </div>
  );

  return (
    <div className="pt-page">
      <div className="pt-head">
        <div>
          <h1 className="pt-title">My Profile</h1>
          <p className="pt-sub">Your account and employment details, plus password management.</p>
        </div>
      </div>

      {error && (
        <div className="eh-error danger" role="alert" style={{ marginBottom: 16 }}>
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="ep-grid">
        {/* Identity + account */}
        <div className="panel" style={{ overflow: 'hidden' }}>
          <div className="profile-hero">
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=2DB54A&color=fff&bold=true&size=128`}
              alt={`${fullName} avatar`}
            />
            <div style={{ minWidth: 0 }}>
              <div className="profile-hero-name">{fullName}</div>
              <div className="profile-hero-meta">
                {emp?.position || 'Employee'}{emp?.department ? ` · ${emp.department}` : ''}
              </div>
              <span className="profile-hero-empno">
                <BadgeCheck size={13} aria-hidden="true" /> Employee No. {emp?.employee_number || '—'}
              </span>
            </div>
          </div>

          <div style={{ padding: '8px 20px 20px' }}>
            <div className="kv-group-title">Login Account</div>
            {row('Username', profile?.username)}
            {row('Email', profile?.email)}

            <div className="kv-group-title">Employment</div>
            {row('Department', emp?.department)}
            {row('Position', emp?.position)}
            {row('Employment Status', emp?.employment_status)}
            {row('Weekly Contracted Hours', `${emp?.weekly_working_hours || 40} hrs`)}
            {row('Emergency Contact', emp?.emergency_contact)}
          </div>
        </div>

        {/* Change password */}
        <div className="panel panel-pad">
          <span className="panel-title" style={{ marginBottom: 16, display: 'flex' }}>
            <KeyRound size={17} color="#2DB54A" aria-hidden="true" style={{ marginRight: 8 }} /> Change Password
          </span>

          {pwMsg && (
            <div className="eh-error" role="status" style={{ background: '#ECFDF3', borderColor: '#A7E8C0', color: '#10703A', marginBottom: 12, fontWeight: 600 }}>
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>{pwMsg}</span>
            </div>
          )}
          {pwErr && (
            <div className="eh-error danger" role="alert" style={{ marginBottom: 12 }}>
              <AlertCircle size={16} aria-hidden="true" />
              <span>{pwErr}</span>
            </div>
          )}

          <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
            <div className="filter-field">
              <label className="filter-label" htmlFor="pw-current">Current password</label>
              <input id="pw-current" type="password" className="filter-input" style={{ width: '100%' }} value={pw.current_password}
                onChange={(e) => setPw((s) => ({ ...s, current_password: e.target.value }))} required autoComplete="current-password" />
            </div>
            <div className="filter-field">
              <label className="filter-label" htmlFor="pw-new">New password</label>
              <input id="pw-new" type="password" className="filter-input" style={{ width: '100%' }} value={pw.new_password}
                onChange={(e) => setPw((s) => ({ ...s, new_password: e.target.value }))} required autoComplete="new-password" minLength={6} />
            </div>
            <div className="filter-field">
              <label className="filter-label" htmlFor="pw-confirm">Confirm new password</label>
              <input id="pw-confirm" type="password" className="filter-input" style={{ width: '100%' }} value={pw.confirm}
                onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))} required autoComplete="new-password" minLength={6} />
            </div>
            <button type="submit" className="manual-btn" disabled={pwLoading} style={{ marginTop: 2 }}>
              {pwLoading ? 'Updating…' : 'Update Password'}
            </button>
          </form>

          <div className="help-tip">
            <Building2 size={15} color="#456255" aria-hidden="true" style={{ minWidth: 15, marginTop: 1 }} />
            <span>Need a profile detail changed (department, position, or email)? Ask your system administrator.</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, fontSize: 12.5, color: '#6B8070' }}>
        <UserRound size={14} aria-hidden="true" />
        Signed in as <strong style={{ color: '#1E3027' }}>{profile?.email || profile?.username}</strong>
      </div>
    </div>
  );
};

export default EmployeeProfile;