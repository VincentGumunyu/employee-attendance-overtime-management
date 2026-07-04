import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('token')) {
      const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
      navigate(savedUser.role === 'Security' ? '/attendance' : '/');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/login', {
        username: username.trim(),
        password: password.trim(),
      });
      const { access_token, user } = response.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      // Security users go straight to the attendance scanner
      navigate(user.role === 'Security' ? '/attendance' : '/');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to connect. Check the server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* Blurred bokeh circles in background */}
      <div style={{ ...styles.blob, width: 320, height: 320, top: '5%', left: '8%', background: 'rgba(45,181,74,0.22)' }} />
      <div style={{ ...styles.blob, width: 260, height: 260, bottom: '8%', right: '6%', background: 'rgba(26,122,50,0.18)' }} />
      <div style={{ ...styles.blob, width: 180, height: 180, top: '40%', right: '20%', background: 'rgba(82,215,107,0.12)' }} />
      <div style={{ ...styles.blob, width: 140, height: 140, bottom: '20%', left: '18%', background: 'rgba(45,181,74,0.1)' }} />

      {/* Card */}
      <div style={styles.card}>
        {/* Icon badge */}
        <div style={styles.iconBadge}>
          <HeartPulse size={26} color="#2DB54A" />
        </div>

        {/* Titles */}
        <h1 style={styles.title}>Tait Medical Centre</h1>
        <p style={styles.subtitle}>ATTENDANCE PORTAL</p>

        {/* Error */}
        {error && (
          <div style={styles.errorBox}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          {/* Username */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>USERNAME OR EMAIL</label>
            <div style={styles.inputWrapper}>
              <span style={styles.inputIcon}>
                {/* Person icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                style={styles.input}
                className="tmc-login-input"
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ ...styles.fieldGroup, marginBottom: '28px' }}>
            <label style={styles.label}>PASSWORD</label>
            <div style={styles.inputWrapper}>
              <span style={styles.inputIcon}>
                {/* Lock icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ ...styles.input, paddingRight: '44px' }}
                className="tmc-login-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                tabIndex={-1}
              >
                {showPassword
                  ? <EyeOff size={17} color="rgba(255,255,255,0.45)" />
                  : <Eye size={17} color="rgba(255,255,255,0.45)" />
                }
              </button>
            </div>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading}
            style={styles.submitBtn}
            className="tmc-login-btn"
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span className="spinner-border spinner-border-sm" style={{ width: '15px', height: '15px' }} />
                Signing In...
              </span>
            ) : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: '100vh',
    width: '100vw',
    background: 'radial-gradient(ellipse at 30% 40%, #1A4D2E 0%, #0C2218 45%, #071510 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(60px)',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    zIndex: 10,
    width: '100%',
    maxWidth: '380px',
    background: 'rgba(255, 255, 255, 0.07)',
    backdropFilter: 'blur(24px) saturate(160%)',
    WebkitBackdropFilter: 'blur(24px) saturate(160%)',
    border: '1px solid rgba(255, 255, 255, 0.13)',
    borderRadius: '20px',
    padding: '36px 32px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxShadow: '0 24px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
  },
  iconBadge: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    background: 'rgba(45, 181, 74, 0.18)',
    border: '1.5px solid rgba(45, 181, 74, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '18px',
    boxShadow: '0 4px 20px rgba(45,181,74,0.2)',
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#FFFFFF',
    margin: '0 0 5px 0',
    letterSpacing: '-0.3px',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '10px',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    margin: '0 0 28px 0',
    textAlign: 'center',
  },
  errorBox: {
    width: '100%',
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '10px',
    padding: '10px 14px',
    marginBottom: '16px',
    color: '#FCA5A5',
    fontSize: '12.5px',
    textAlign: 'center',
  },
  fieldGroup: {
    width: '100%',
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '10px',
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginBottom: '7px',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '13px',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '11px 14px 11px 38px',
    background: 'rgba(255, 255, 255, 0.07)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: '10px',
    color: '#FFFFFF',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit',
  },
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1,
  },
  submitBtn: {
    width: '100%',
    padding: '13px',
    background: 'linear-gradient(135deg, #2DB54A 0%, #1E8C38 100%)',
    border: 'none',
    borderRadius: '10px',
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    letterSpacing: '0.01em',
    transition: 'opacity 0.2s, transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 20px rgba(45,181,74,0.3)',
  },
};

export default Login;
