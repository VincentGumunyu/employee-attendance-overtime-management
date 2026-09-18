import React, { useEffect, useState } from 'react';
import {
  RefreshCw, KeyRound, ShieldAlert, UserRound,
  X, Eye, EyeOff, Copy, Check, Dices, Zap
} from 'lucide-react';
import { api } from '../lib/api';

const roleBadgeClass = (role) => {
  if (role === 'Admin') return 'mc-status-active';
  if (role === 'Security') return 'mc-status-leave';
  return 'mc-status-inactive';
};

const roleLabel = (role) => {
  if (role === 'Admin') return 'Administrator';
  if (role === 'Security') return 'Security';
  return 'Staff';
};

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [target, setTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [tempPassword, setTempPassword] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const res = await api.get('/users');
      setUsers(res.data || []);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Unable to load login accounts. Make sure the backend is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openReset = (u) => {
    setTarget(u);
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setResetError(null);
    setTempPassword(null);
    setCopied(false);
  };

  const closeReset = () => {
    if (resetting) return;
    setTarget(null);
  };

  const setPassword = async (e) => {
    if (e) e.preventDefault();
    if (!target) return;
    setResetError(null);
    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    setResetting(true);
    try {
      const res = await api.post(`/users/${target.id}/password`, { password: newPassword });
      closeReset();
      await load();
      alert(res.data.message || 'Password updated successfully.');
    } catch (err) {
      setResetError(err.response?.data?.error || 'Failed to update password.');
    } finally {
      setResetting(false);
    }
  };

  const generatePassword = async () => {
    if (!target) return;
    setResetError(null);
    setResetting(true);
    try {
      const res = await api.post(`/users/${target.id}/password`, { generate: true });
      setTempPassword(res.data.temporary_password);
      setNewPassword('');
      setConfirmPassword('');
      await load();
    } catch (err) {
      setResetError(err.response?.data?.error || 'Failed to generate a temporary password.');
    } finally {
      setResetting(false);
    }
  };

  const copyTemp = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
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

  return (
    <div style={{ height: '100%' }}>
      <div className="dashboard-topbar">
        <div className="topbar-title">
          <h2>Login Accounts</h2>
          <p>Reset passwords for staff who have forgotten theirs — no one can reset their own from the login page</p>
        </div>
        <button className="btn-outline-tmc d-flex align-items-center gap-2" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="mc-page mc-page-stack">
        {error && (
          <div className="alert alert-danger mb-0 border-0" role="alert" style={{ borderRadius: '14px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>All Login Accounts</span>
            <span style={{ fontSize: '12px', color: '#6B8070', fontWeight: '400' }}>
              {users.length} total
            </span>
          </div>
          <div className="mc-table-scroll">
            <table className="table mb-0">
              <thead>
                <tr>
                  <th className="mc-th-first">Name</th>
                  <th>Login ID / Email</th>
                  <th>Role</th>
                  <th>Employee No.</th>
                  <th style={{ width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px 0', color: '#6B8070' }}>
                      No login accounts yet.
                    </td>
                  </tr>
                ) : users.map((u) => (
                  <tr key={u.id}>
                    <td className="mc-th-first">
                      <div className="d-flex align-items-center gap-2">
                        <span className="stat-card-icon" style={{ background: 'rgba(45,181,74,0.1)', width: 34, height: 34 }}>
                          <UserRound size={16} color="#2DB54A" />
                        </span>
                        <span style={{ fontWeight: 700, color: '#1E3027' }}>
                          {`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#1E3027' }}>{u.username}</div>
                      {u.email && <div style={{ fontSize: 12, color: '#6B8070' }}>{u.email}</div>}
                    </td>
                    <td>
                      <span className={`mc-status ${roleBadgeClass(u.role)}`}>{roleLabel(u.role)}</span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13, color: '#6B8070' }}>
                      {u.employee_number || '—'}
                    </td>
                    <td>
                      <button
                        className="btn btn-light btn-sm d-flex align-items-center gap-1"
                        onClick={() => openReset(u)}
                      >
                        <KeyRound size={14} /> Reset Password
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {target && (
        <div
          className="login-modal-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeReset(); }}
        >
          <div className="login-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title" style={{ maxWidth: 440 }}>
            <div className="login-modal-head">
              <span className="login-modal-icon"><KeyRound size={18} /></span>
              <h2 id="reset-title" className="login-modal-title">Reset password</h2>
              <button type="button" className="login-modal-close" onClick={closeReset} aria-label="Close" disabled={resetting}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={setPassword} className="login-reset-form">
              <p className="login-reset-lead" style={{ fontSize: 13 }}>
                <strong>{`${target.first_name || ''} ${target.last_name || ''}`.trim() || target.username}</strong>
                {' '}signed in as <strong>{target.username}</strong>{target.employee_number ? ` · Employee ${target.employee_number}` : ''}
              </p>

              {resetError && (
                <div className="login-error" role="alert" aria-live="polite">
                  <ShieldAlert size={16} className="login-error-icon" />
                  <span>{resetError}</span>
                </div>
              )}

              {tempPassword ? (
                <div className="login-reset-done">
                  <p className="login-reset-lead">Temporary password for <strong>{target.username}</strong>:</p>
                  <div className="login-reset-code-row">
                    <code className="login-reset-code">{tempPassword}</code>
                    <button type="button" className="login-reset-copy" onClick={copyTemp}>
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="login-reset-note">
                    Share it securely with the person. They can change it from their profile after signing in.
                  </p>
                  <div className="login-reset-actions">
                    <button type="button" className="login-reset-secondary" onClick={closeReset}>
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="login-field">
                    <label className="login-field-label" htmlFor="reset-new">
                      New password
                    </label>
                    <div className="login-input-wrap">
                      <span className="login-input-icon"><KeyRound size={18} /></span>
                      <input
                        id="reset-new"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="At least 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="login-input"
                        style={{ paddingRight: '44px' }}
                        autoComplete="new-password"
                        autoFocus
                      />
                      <button
                        type="button"
                        className="login-eye-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className="login-field">
                    <label className="login-field-label" htmlFor="reset-confirm">
                      Confirm password
                    </label>
                    <div className="login-input-wrap">
                      <span className="login-input-icon"><KeyRound size={18} /></span>
                      <input
                        id="reset-confirm"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Repeat the new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="login-input"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <div className="help-tip" style={{ marginBottom: 16, fontSize: 12 }}>
                    <Zap size={14} color="#456255" aria-hidden="true" style={{ minWidth: 14, marginTop: 1 }} />
                    <span>Prefer a random, hard-to-guess password? Use the "Generate temporary" button instead.</span>
                  </div>
                  <div className="login-reset-actions">
                    <button type="button" className="login-reset-secondary" onClick={closeReset} disabled={resetting}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="login-reset-secondary"
                      onClick={generatePassword}
                      disabled={resetting}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Dices size={15} /> Generate temporary
                    </button>
                    <button type="submit" className="login-reset-primary" disabled={resetting}>
                      {resetting ? 'Working…' : 'Set Password'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;