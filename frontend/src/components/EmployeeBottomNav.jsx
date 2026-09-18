import React from 'react';
import { NavLink } from 'react-router-dom';
import { ScanLine, CalendarCheck, Clock, UserRound } from 'lucide-react';

const items = [
  { to: '/me', end: true, label: 'Clock In', icon: ScanLine },
  { to: '/me/attendance', end: false, label: 'Attendance', icon: CalendarCheck },
  { to: '/me/hours', end: false, label: 'Hours', icon: Clock },
  { to: '/me/profile', end: false, label: 'Profile', icon: UserRound },
];

const EmployeeBottomNav = () => (
  <nav className="employee-bottom-nav" aria-label="Employee quick navigation">
    {items.map(({ to, end, label, icon: Icon }) => (
      <NavLink
        key={to}
        to={to}
        end={end}
        className={({ isActive }) => `employee-bottom-nav-item${isActive ? ' active' : ''}`}
        aria-label={label}
      >
        <Icon size={21} aria-hidden="true" />
        <span>{label}</span>
      </NavLink>
    ))}
  </nav>
);

export default EmployeeBottomNav;