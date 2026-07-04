import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import AttendanceScanner from './pages/AttendanceScanner';
import Employees from './pages/Employees';
import Departments from './pages/Departments';
import Reports from './pages/Reports';
import Login from './pages/Login';

// Helper to read the current user's role from localStorage
const getUserRole = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role || null;
  } catch {
    return null;
  }
};

// Layout wrapper for authenticated admin/staff pages (with sidebar)
const AppLayout = () => {
  const token = localStorage.getItem('token');
  const role = getUserRole();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Security users must NOT access admin pages — redirect to scanner
  if (role === 'Security') {
    return <Navigate to="/attendance" replace />;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
};

// Layout for the attendance scanner — requires login but no sidebar for Security
const ScannerLayout = () => {
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <AttendanceScanner />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />

        {/* Authenticated Attendance Scanner (Security users land here) */}
        <Route path="/attendance" element={<ScannerLayout />} />

        {/* Protected Administrative Routes (Admin & Staff only) */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/reports" element={<Reports />} />
        </Route>

        {/* Redirect any other route to home/dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
