import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import './employee.css';
import './admin.css';

import Sidebar from './components/Sidebar';
import AdminAppBar from './components/AdminAppBar';
import EmployeeTopNav from './components/EmployeeTopNav';
import EmployeeBottomNav from './components/EmployeeBottomNav';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Departments from './pages/Departments';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Users from './pages/Users';
import SecurityGate from './pages/SecurityGate';
import EmployeeHome from './pages/employee/EmployeeHome';
import EmployeeAttendance from './pages/employee/EmployeeAttendance';
import EmployeeHours from './pages/employee/EmployeeHours';
import EmployeeProfile from './pages/employee/EmployeeProfile';
import Login from './pages/Login';

import React, { useState } from 'react';

// Helper to read the current user's role from localStorage
const getUserRole = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role || null;
  } catch {
    return null;
  }
};

const hasToken = () => !!localStorage.getItem('token');

// Layout for Admin pages (with sidebar)
const AppLayout = () => {
  const role = getUserRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!hasToken()) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'Admin') {
    return <Navigate to={role === 'Security' ? '/attendance' : '/me'} replace />;
  }

  return (
    <div className="app-container">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div
        className={`admin-scrim ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
      <div className="admin-main">
        <AdminAppBar onMenu={() => setSidebarOpen(true)} />
        <div className="main-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

// Layout for the Employee self-service area (no sidebar, top nav only)
const EmployeeLayout = () => {
  const role = getUserRole();

  if (!hasToken()) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'Staff') {
    return <Navigate to={role === 'Security' ? '/attendance' : '/'} replace />;
  }

  return (
    <div className="employee-app">
      <EmployeeTopNav />
      <main className="employee-content">
        <Outlet />
      </main>
      <EmployeeBottomNav />
    </div>
  );
};

// Layout for the Security gate terminal — barcode display only
const SecurityLayout = () => {
  const role = getUserRole();

  if (!hasToken()) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'Security') {
    return <Navigate to={role === 'Staff' ? '/me' : '/'} replace />;
  }

  return <SecurityGate />;
};

function HomeRedirect() {
  const role = getUserRole();
  if (!hasToken()) return <Navigate to="/login" replace />;
  if (role === 'Security') return <Navigate to="/attendance" replace />;
  if (role === 'Staff') return <Navigate to="/me" replace />;
  return <Navigate to="/" replace />;
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />

        {/* Employee self-service area */}
        <Route element={<EmployeeLayout />}>
          <Route path="/me" element={<EmployeeHome />} />
          <Route path="/me/attendance" element={<EmployeeAttendance />} />
          <Route path="/me/hours" element={<EmployeeHours />} />
          <Route path="/me/profile" element={<EmployeeProfile />} />
        </Route>

        {/* Security gate terminal (barcode display only) */}
        <Route path="/attendance" element={<SecurityLayout />} />

        {/* Protected Administrative Routes (Admin only) */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/users" element={<Users />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Redirect anything else based on the signed-in role */}
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Router>
  );
}

export default App;