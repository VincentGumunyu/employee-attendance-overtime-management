import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, ScanLine, FileBarChart, HeartPulse, LogOut } from 'lucide-react';

const Sidebar = () => {
  const navigate = useNavigate();

  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;
  const fullName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Administrator';
  const role = user ? user.role : 'System Admin';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="sidebar">
      {/* Brand */}
      <NavLink to="/" className="sidebar-brand">
        <div className="brand-logo">
          <HeartPulse size={22} />
        </div>
        <div className="brand-text">
          <span className="brand-title">Tait Medical Centre</span>
          <span className="brand-subtitle">HR &amp; Attendance</span>
        </div>
      </NavLink>

      {/* Navigation */}
      <p className="section-header">Main Menu</p>
      <ul className="sidebar-nav">
        <li>
          <NavLink to="/" end className="nav-link">
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>
        </li>
        <li>
          <NavLink to="/attendance" className="nav-link">
            <ScanLine size={18} />
            Attendance Scanner
          </NavLink>
        </li>
        <li>
          <NavLink to="/employees" className="nav-link">
            <Users size={18} />
            Employees
          </NavLink>
        </li>
        <li>
          <NavLink to="/departments" className="nav-link">
            <Building2 size={18} />
            Departments
          </NavLink>
        </li>
        <li>
          <NavLink to="/reports" className="nav-link">
            <FileBarChart size={18} />
            Reports
          </NavLink>
        </li>
      </ul>

      {/* User Footer */}
      <div className="sidebar-footer d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-2">
          <img
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=2DB54A&color=fff&bold=true`}
            alt={fullName}
          />
          <div className="sidebar-user-info">
            <div className="sidebar-user-name" style={{ maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fullName}
            </div>
            <div className="sidebar-user-role">{role}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          title="Sign Out"
          style={{
            background: 'none',
            border: 'none',
            color: '#A8BFB0',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#EF4444'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#A8BFB0'}
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
