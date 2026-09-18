import React from 'react';
import { HeartPulse, Menu } from 'lucide-react';

const AdminAppBar = ({ onMenu }) => {
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
      <img
        className="admin-appbar-avatar"
        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=2DB54A&color=fff&bold=true`}
        alt={fullName}
      />
    </div>
  );
};

export default AdminAppBar;