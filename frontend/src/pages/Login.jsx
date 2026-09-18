import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, Eye, EyeOff, User, Lock, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import '../login.css';

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
      if (savedUser.role === 'Security') navigate('/attendance');
      else if (savedUser.role === 'Staff') navigate('/me');
      else navigate('/');
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
      if (user.role === 'Security') navigate('/attendance');
      else if (user.role === 'Staff') navigate('/me');
      else navigate('/');
    } catch (err) {
      const serverError = err.response?.data?.error;
      if (serverError && !/Unable to connect|failed to fetch|network|ECONNREFUSED|timed out/i.test(serverError)) {
        setError('Invalid email/employee ID or password.');
      } else {
        setError(serverError || 'Unable to connect. Check the server is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        {/* Brand */}
        <div className="login-brand-mark">
          <HeartPulse size={26} color="#fff" />
        </div>
        <h1 className="login-brand-wordmark">Medi<span className="login-brand-accent">Shift</span></h1>
        <p className="login-brand-eyebrow">Employee Portal</p>

        {error && (
          <div className="login-error" role="alert" aria-live="polite">
            <AlertCircle size={16} className="login-error-icon" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Username field */}
          <div className="login-field">
            <label className="login-field-label" htmlFor="login-username">
              Email or Employee ID
            </label>
            <div className="login-input-wrap">
              <span className="login-input-icon">
                <User size={18} />
              </span>
              <input
                id="login-username"
                name="username"
                type="text"
                placeholder="Enter your email or employee ID"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="login-input"
              />
            </div>
          </div>

          {/* Password field */}
          <div className="login-field">
            <label className="login-field-label" htmlFor="login-password">
              Password
            </label>
            <div className="login-input-wrap">
              <span className="login-input-icon">
                <Lock size={18} />
              </span>
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="login-input"
                style={{ paddingRight: '44px' }}
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

          {/* Submit */}
          <button
            type="submit"
            className="login-submit"
            disabled={loading}
            aria-busy={loading || undefined}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm" />
                Signing in...
              </>
            ) : (
              'Log In'
            )}
          </button>
        </form>

        <div className="login-support">
          Forgot your password? Contact your <a href="#">system administrator</a> to reset it.
        </div>
      </div>
    </div>
  );
};

export default Login;
