import React, { useEffect, useState } from 'react';
import {
  UserRound, KeyRound, Save, AlertCircle, CheckCircle2, ShieldCheck, AtSign, RefreshCw
} from 'lucide-react';
import { api } from '../lib/api';

const AdminProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [form, setForm] = useState({ first_name: '', last_name: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState(null);
  const [formErr, setFormErr] = useState(null);

  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [pwErr, setPwErr] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/profile');
      setProfile(res.data);
      setForm({
        first_name: res.data.first_name || '',
        last_name: res.data.last_name || '',
        email: res.data.email || '',
      });
      setLoadError(null);
    } catch (e) {
      setLoadError(e.response?.data?.error || 'Unable to load your profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormMsg(null);
    setFormErr(null);
    try {
      const res = await api.put('/profile', {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
      });
      setProfile(res.data);
      const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
      savedUser.first_name = res.data.first_name;
      savedUser.last_name = res.data.last_name;
      savedUser.email = res.data.email;
      localStorage.setItem('user', JSON.stringify(savedUser));
      setFormMsg('Profile updated successfully.');
      setLoadError(null);
    } catch (e2) {
      if (e2.response?.status === 409) {
        setFormErr(e2.response?.data?.error || 'An account with this email already exists.');
      } else {
        setFormErr(e2.response?.data?.error || 'Failed to save your profile.');
      }
    } finally {
      setSaving(false);
    }
  };

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
      <div className="main-content-pad" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner-border" style={{ color: '#2DB54A' }} role="status" aria-label="Loading profile" />
      </div>
    );
  }

  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || profile?.username || 'Administrator';
  const role = profile?.role || 'Admin';

  const inputHelp = (msg) =>
    formErr ? (
      <div className="alert alert-danger mb-0 border-0 d-flex align-items-center gap-2" role="alert" style={{ borderRadius: '14px', fontSize: '13px', padding: '10px 14px' }}>
        <AlertCircle size={15} /> {msg}
      </div>
    ) : null;
  const inputDone = (msg) =>
    msg ? (
      <div className="alert alert-success mb-0 border-0 d-flex align-items-center gap-2" role="status" style={{ borderRadius: '14px', fontSize: '13px', padding: '10px 14px' }}>
        <CheckCircle2 size={15} /> {msg}
      </div>
    ) : null;

  return (
    <>
      <div className="dashboard-topbar d-flex align-items-center justify-content-between gap-3">
        <div className="topbar-title">
          <h2>My Profile</h2>
          <p>Update your name/email and manage your admin password</p>
        </div>
        <button className="btn-outline-tmc d-flex align-items-center gap-2" onClick={load}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="mc-page mc-page-stack">
        {loadError && (
          <div className="alert alert-danger mb-0 border-0" role="alert" style={{ borderRadius: '14px', fontSize: '13px' }}>
            {loadError}
          </div>
        )}

        <div className="row g-3">
          {/* Identity + editable details */}
          <div className="col-12 col-lg-6">
            <div className="card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="d-flex align-items-center gap-3">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=2DB54A&color=fff&bold=true&size=96`}
                  alt={`${fullName} avatar`}
                  style={{ width: 62, height: 62, borderRadius: 18, border: '2px solid rgba(45,181,74,0.3)', boxShadow: '0 6px 16px -6px rgba(16,42,28,0.35)' }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#1E3027', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UserRound size={17} color="#2DB54A" />
                    {fullName}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#6B8070', marginTop: 2 }}>{profile?.email || '—'}</div>
                  <span
                    className="badge mt-1"
                    style={{ background: 'rgba(45,181,74,0.12)', color: '#1A8A35', fontWeight: 700, fontSize: 11.5, borderRadius: 999, padding: '5px 11px' }}
                  >
                    <ShieldCheck size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                    {role}
                  </span>
                </div>
              </div>

              <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="ap-first">First name</label>
                    <input id="ap-first" className="form-control" value={form.first_name}
                      onChange={(e) => setForm((s) => ({ ...s, first_name: e.target.value }))}
                      placeholder="First name" autoComplete="given-name" />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="ap-last">Last name</label>
                    <input id="ap-last" className="form-control" value={form.last_name}
                      onChange={(e) => setForm((s) => ({ ...s, last_name: e.target.value }))}
                      placeholder="Last name" autoComplete="family-name" />
                  </div>
                </div>

                <div>
                  <label className="form-label" htmlFor="ap-email">Email (login)</label>
                  <div className="position-relative">
                    <AtSign size={15} color="#9AADA2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }} />
                    <input id="ap-email" type="email" className="form-control" style={{ paddingLeft: 36 }} value={form.email}
                      onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                      placeholder="you@example.com" autoComplete="email" required />
                  </div>
                </div>

                <div className="d-flex flex-column" style={{ gap: 10 }}>
                  {inputDone(formMsg)}
                  {inputHelp(formErr)}
                  <button type="submit" className="btn btn-success d-inline-flex align-items-center justify-content-center gap-2" disabled={saving}>
                    <Save size={15} /> {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
                <div style={{ fontSize: 12.5, color: '#6B8070' }}>
                  Signed in as <strong style={{ color: '#1E3027' }}>{profile?.username}</strong> (username cannot be changed).
                </div>
              </form>
            </div>
          </div>

          {/* Change password */}
          <div className="col-12 col-lg-6">
            <div className="card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <span className="d-flex align-items-center gap-2" style={{ fontSize: 15, fontWeight: 800, color: '#1E3027' }}>
                <KeyRound size={18} color="#2DB54A" /> Change Password
              </span>

              {pwMsg && (
                <div className="alert alert-success mb-0 border-0 d-flex align-items-center gap-2" role="status" style={{ borderRadius: '14px', fontSize: '13px', padding: '10px 14px' }}>
                  <CheckCircle2 size={15} /> {pwMsg}
                </div>
              )}
              {pwErr && (
                <div className="alert alert-danger mb-0 border-0 d-flex align-items-center gap-2" role="alert" style={{ borderRadius: '14px', fontSize: '13px', padding: '10px 14px' }}>
                  <AlertCircle size={15} /> {pwErr}
                </div>
              )}

              <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label" htmlFor="ap-pw-current">Current password</label>
                  <input id="ap-pw-current" type="password" className="form-control" value={pw.current_password}
                    onChange={(e) => setPw((s) => ({ ...s, current_password: e.target.value }))} required autoComplete="current-password" />
                </div>
                <div>
                  <label className="form-label" htmlFor="ap-pw-new">New password</label>
                  <input id="ap-pw-new" type="password" className="form-control" value={pw.new_password}
                    onChange={(e) => setPw((s) => ({ ...s, new_password: e.target.value }))} required autoComplete="new-password" minLength={6} />
                </div>
                <div>
                  <label className="form-label" htmlFor="ap-pw-confirm">Confirm new password</label>
                  <input id="ap-pw-confirm" type="password" className="form-control" value={pw.confirm}
                    onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))} required autoComplete="new-password" minLength={6} />
                </div>
                <button type="submit" className="btn btn-success d-inline-flex align-items-center justify-content-center gap-2" disabled={pwLoading}>
                  <KeyRound size={15} /> {pwLoading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminProfile;