import React, { useState, useEffect } from 'react';
import { Users, UserCheck, Clock, UserX, Award, ShieldAlert, RefreshCw, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';

const Dashboard = () => {
  const [stats, setStats] = useState({
    total_employees: 0,
    present_today: 0,
    late_today: 0,
    absent_today: 0,
    weekly_overtime: '0 hrs'
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [overtimeToday, setOvertimeToday] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [statsRes, recentRes, otRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/recent'),
        api.get('/dashboard/overtime_today')
      ]);
      setStats(statsRes.data);
      setRecentActivity(recentRes.data);
      setOvertimeToday(otRes.data);
      setError(null);
    } catch (err) {
      setError('Unable to reach the backend server. Make sure the Flask service is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status) => {
    const map = {
      'On Time':        ['bg-success', 'On Time'],
      'Late':           ['bg-warning text-dark', 'Late'],
      'Early Departure':['bg-danger', 'Early Departure'],
      'Checked Out':    ['', 'Checked Out'],
      'Absent':         ['bg-dark', 'Absent'],
      'On Leave':       ['bg-info text-dark', 'On Leave'],
    };
    const [cls, label] = map[status] || ['bg-secondary', status];
    // Special styling for Checked Out to match TMC palette
    if (status === 'Checked Out') {
      return (
        <span style={{ background: '#E6F5EB', color: '#1A7A32', border: '1px solid #C8EDD1' }} className="badge">
          ✓ {label}
        </span>
      );
    }
    return <span className={`badge ${cls}`}>{label}</span>;
  };

  const attendanceRate = stats.total_employees > 0
    ? Math.round((stats.present_today / stats.total_employees) * 100)
    : 0;

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
      {/* Top Bar */}
      <div className="dashboard-topbar">
        <div className="topbar-title">
          <h2>Executive Dashboard</h2>
          <p>{today}</p>
        </div>
        <button
          className="btn-outline-tmc d-flex align-items-center gap-2"
          onClick={() => fetchData(true)}
          disabled={refreshing}
        >
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {error && (
          <div className="alert alert-danger d-flex align-items-center gap-2 mb-0 border-0" role="alert"
            style={{ borderRadius: '10px', fontSize: '13px' }}>
            <ShieldAlert size={18} />
            {error}
          </div>
        )}

        {/* ── Stat Cards ── */}
        <div className="row g-3">
          {/* Total Employees */}
          <div className="col-6 col-lg-3">
            <div className="card" style={{ padding: '20px 22px' }}>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <div className="stat-label">Total Employees</div>
                  <div className="stat-value" style={{ color: '#1E3027' }}>{stats.total_employees}</div>
                </div>
                <div className="stat-card-icon" style={{ background: 'rgba(45,181,74,0.1)' }}>
                  <Users size={24} color="#2DB54A" />
                </div>
              </div>
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F0F4F1', fontSize: '12px', color: '#6B8070' }}>
                Active workforce
              </div>
            </div>
          </div>

          {/* Present Today */}
          <div className="col-6 col-lg-3">
            <div className="card" style={{ padding: '20px 22px' }}>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <div className="stat-label">Present Today</div>
                  <div className="stat-value" style={{ color: '#1A8A35' }}>{stats.present_today}</div>
                </div>
                <div className="stat-card-icon" style={{ background: 'rgba(45,181,74,0.1)' }}>
                  <UserCheck size={24} color="#2DB54A" />
                </div>
              </div>
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F0F4F1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ flex: 1, height: '4px', borderRadius: '4px', background: '#E5EDE7', overflow: 'hidden' }}>
                  <div style={{ width: `${attendanceRate}%`, height: '100%', background: '#2DB54A', borderRadius: '4px', transition: 'width 0.6s ease' }} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#2DB54A' }}>{attendanceRate}%</span>
              </div>
            </div>
          </div>

          {/* Late Today */}
          <div className="col-6 col-lg-3">
            <div className="card" style={{ padding: '20px 22px' }}>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <div className="stat-label">Late Arrivals</div>
                  <div className="stat-value" style={{ color: '#B45309' }}>{stats.late_today}</div>
                </div>
                <div className="stat-card-icon" style={{ background: 'rgba(245,158,11,0.1)' }}>
                  <Clock size={24} color="#F59E0B" />
                </div>
              </div>
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F0F4F1', fontSize: '12px', color: '#6B8070' }}>
                Checked in after 08:00
              </div>
            </div>
          </div>

          {/* Absent Today */}
          <div className="col-6 col-lg-3">
            <div className="card" style={{ padding: '20px 22px' }}>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <div className="stat-label">Absent Today</div>
                  <div className="stat-value" style={{ color: '#B91C1C' }}>{stats.absent_today}</div>
                </div>
                <div className="stat-card-icon" style={{ background: 'rgba(239,68,68,0.1)' }}>
                  <UserX size={24} color="#EF4444" />
                </div>
              </div>
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F0F4F1', fontSize: '12px', color: '#6B8070' }}>
                No check-in recorded
              </div>
            </div>
          </div>
        </div>

        {/* ── Activity Table + OT Widgets ── */}
        <div className="row g-3" style={{ flex: 1 }}>

          {/* Recent Attendance Table */}
          <div className="col-12 col-xl-8">
            <div className="card" style={{ height: '100%' }}>
              <div className="card-header d-flex justify-content-between align-items-center">
                <span>Recent Attendance Activity</span>
                <span style={{ fontSize: '12px', color: '#6B8070', fontWeight: '400' }}>
                  Today · Auto-refreshes every 10s
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table mb-0">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: '24px !important' }}>Employee</th>
                      <th>Department</th>
                      <th>Date</th>
                      <th>Check-In</th>
                      <th>Check-Out</th>
                      <th>Status</th>
                      <th>Worked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActivity.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '48px 0 !important', color: '#6B8070' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <Users size={32} style={{ opacity: 0.3 }} />
                            <span style={{ fontSize: '13px' }}>No attendance events recorded today.</span>
                          </div>
                        </td>
                      </tr>
                    ) : recentActivity.map((a, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: '600', color: '#1E3027' }}>{a.employee_name}</td>
                        <td style={{ color: '#6B8070' }}>{a.department}</td>
                        <td style={{ color: '#6B8070', fontSize: '12px' }}>{a.date}</td>
                        <td>
                          {a.check_in !== '-'
                            ? <span style={{ color: '#1A8A35', fontWeight: '600' }}>{a.check_in}</span>
                            : <span style={{ color: '#CBD8CE' }}>—</span>}
                        </td>
                        <td>
                          {a.check_out !== '-'
                            ? <span style={{ color: '#2563EB', fontWeight: '600' }}>{a.check_out}</span>
                            : <span style={{ color: '#CBD8CE' }}>—</span>}
                        </td>
                        <td>{getStatusBadge(a.attendance_status)}</td>
                        <td style={{ fontWeight: '700', color: '#1E3027' }}>{a.worked_today}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="col-12 col-xl-4 d-flex flex-column gap-3">

            {/* Today's Overtime */}
            <div className="card" style={{ flex: 1 }}>
              <div className="card-header d-flex align-items-center gap-2">
                <Award size={16} color="#2DB54A" />
                Today's Overtime
              </div>
              <div style={{ padding: '16px 20px' }}>
                {overtimeToday.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#6B8070' }}>
                    <Award size={28} style={{ opacity: 0.25, marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
                    <span style={{ fontSize: '12px' }}>No overtime logged today yet.</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {overtimeToday.map((item, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 14px', background: '#F0F7F2', borderRadius: '8px',
                        borderLeft: '3px solid #2DB54A'
                      }}>
                        <span style={{ fontWeight: '600', fontSize: '13px', color: '#1E3027' }}>{item.employee_name}</span>
                        <span style={{ fontWeight: '700', fontSize: '12px', color: '#2DB54A', background: '#E6F5EB', padding: '3px 10px', borderRadius: '20px' }}>
                          +{item.overtime}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Weekly Overtime Summary */}
            <div className="card weekly-ot-card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px',
                background: 'rgba(45,181,74,0.12)', borderRadius: '50%'
              }} />
              <div style={{
                position: 'absolute', bottom: '-30px', right: '20px', width: '60px', height: '60px',
                background: 'rgba(45,181,74,0.08)', borderRadius: '50%'
              }} />
              <div style={{ padding: '24px 20px', position: 'relative', zIndex: 1 }}>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <TrendingUp size={16} color="#2DB54A" />
                  <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255, 255, 255, 0.7)' }}>
                    Weekly Overtime
                  </span>
                </div>
                <div style={{ fontSize: '42px', fontWeight: '800', color: '#FFFFFF', letterSpacing: '-2px', lineHeight: 1 }}>
                  {stats.weekly_overtime}
                </div>
                <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '8px' }}>
                  Across all departments · Mon–Sun (above 40 hrs)
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
