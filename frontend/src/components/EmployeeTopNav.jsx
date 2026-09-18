import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { HeartPulse, LogOut, ScanLine, CalendarCheck, Clock, UserRound } from 'lucide-react';

const EmployeeTopNav = () => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;
  const fullName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Employee';
  const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=2DB54A&color=fff&bold=true&size=96`;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const go = (to) => {
    setMenuOpen(false);
    navigate(to);
  };

  // Close the menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <header className="employee-header">
      <div className="employee-header-inner">
        {/* Brand */}
        <div className="employee-brand">
          <span className="employee-brand-logo">
            <HeartPulse size={20} color="white" aria-hidden="true" />
          </span>
          <span style={{ minWidth: 0 }}>
            <span className="employee-brand-name">Medi<span className="employee-brand-accent">Shift</span></span>
            <span className="employee-brand-sub" style={{ display: 'block' }}>EMPLOYEE PORTAL</span>
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="employee-nav" aria-label="Employee navigation">
          <NavLink to="/me" end className="employee-nav-link">
            <ScanLine size={16} aria-hidden="true" /> Clock In / Out
          </NavLink>
          <NavLink to="/me/attendance" className="employee-nav-link">
            <CalendarCheck size={16} aria-hidden="true" /> My Attendance
          </NavLink>
          <NavLink to="/me/hours" className="employee-nav-link">
            <Clock size={16} aria-hidden="true" /> Hours Worked
          </NavLink>
          <NavLink to="/me/profile" className="employee-nav-link">
            <UserRound size={16} aria-hidden="true" /> My Profile
          </NavLink>
        </nav>

        {/* User area */}
        <div className="employee-user">
          <div className="employee-user-text">
            <div className="employee-user-name">{fullName}</div>
            <div className="employee-user-role">Employee</div>
          </div>

          <button className="employee-signout" onClick={handleLogout} type="button">
            <LogOut size={15} aria-hidden="true" /> Sign Out
          </button>

          {/* Mobile avatar menu */}
          <div className="employee-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="employee-avatar-btn"
              aria-label="Open profile menu"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <img src={avatar} alt="" />
            </button>

            {menuOpen && (
              <div className="employee-menu" role="menu">
                <div className="employee-menu-user">
                  <div className="employee-menu-name">{fullName}</div>
                  <div className="employee-menu-role">Employee</div>
                </div>
                <button type="button" role="menuitem" className="employee-menu-item" onClick={() => go('/me/profile')}>
                  <UserRound size={16} aria-hidden="true" /> My Profile
                </button>
                <button type="button" role="menuitem" className="employee-menu-item danger" onClick={handleLogout}>
                  <LogOut size={16} aria-hidden="true" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default EmployeeTopNav;