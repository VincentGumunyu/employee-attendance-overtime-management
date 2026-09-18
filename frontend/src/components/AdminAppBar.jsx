import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, Menu } from 'lucide-react';

const AdminAppBar = ({ onMenu }) => {
  const navigate = useNavigate();
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;
  const fullName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Administrator';

  return (
    <div className="admin-appbar" role="region" aria-label="Admin navigation bar">
      <button className="admin-appbar-menu" onClick={onMenu} aria-label="Open navigation menu">
        <Menu size={22} />
      </button>
      <div className="admin-appbar-brand">
        <div className="admin-appbar-logo" aria-hidden="true">
          <HeartPulse size={18} />
        </div>
        <div className="admin-appbar-text">
          <div className="admin-appbar-title">Medi<span className="admin-appbar-accent">Shift</span> &middot; HR Portal</div>
          <div className="admin-appbar-sub">Administration</div>
        </div>
      </div>
      <button
        className="admin-appbar-avatar"
        onClick={() => navigate('/profile')}
        title="My Profile"
        aria-label="Open my profile"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <img
          className="admin-appbar-avatar"
          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=2DB54A&color=fff&bold=true`}
          alt={fullName}
        />
      </button>
    </div>
  );
};

export default AdminAppBar;