import React, { useEffect, useState } from 'react';
import { Clock, Award, CalendarCheck, AlertCircle, TrendingUp } from 'lucide-react';
import { api } from '../../lib/api';

const fmtHM = (m) => {
  const v = Math.max(0, Number(m || 0));
  return `${Math.floor(v / 60)}h ${v % 60}m`;
};

const monthLabel = () =>
  new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

const EmployeeHours = () => {
  const [stats, setStats] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [st, rec] = await Promise.all([api.get('/attendance/mine/stats'), api.get('/attendance/mine')]);
        setStats(st.data);
        setRecords(rec.data || []);
        setError(null);
      } catch (e) {
        setError(e.response?.data?.error || 'Unable to load hours worked.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const today = stats?.today || {};
  const todayKind = today.checked_in ? (today.checked_out ? 'out' : 'in') : 'idle';

  const cards = [
    {
      label: 'Today',
      value: today.status || '—',
      sub: todayKind === 'out' ? `Worked ${fmtHM(today.worked_minutes)}` : todayKind === 'in' ? 'Still clocked in' : 'Not clocked in',
      icon: <CalendarCheck size={19} color="#1A8A35" aria-hidden="true" />,
    },
    {
      label: `This Week (${stats?.required_weekly_hours || 40}h target)`,
      value: fmtHM(stats?.week_worked_minutes || 0),
      sub: `${fmtHM(stats?.week_overtime_minutes || 0)} overtime`,
      icon: <Clock size={19} color="#B45309" aria-hidden="true" />,
    },
    {
      label: `This Month · ${monthLabel()}`,
      value: fmtHM(stats?.month_worked_minutes || 0),
      sub: `${fmtHM(stats?.month_overtime_minutes || 0)} overtime`,
      icon: <TrendingUp size={19} color="#3730A3" aria-hidden="true" />,
    },
  ];

  const monthWorked = stats?.month_worked_minutes || 0;
  const requiredMonthly = (stats?.required_weekly_hours || 40) * 4.33;
  const pct = requiredMonthly > 0 ? Math.min(100, (monthWorked / (requiredMonthly * 60)) * 100) : 0;

  return (
    <div className="pt-page">
      <div className="pt-head">
        <div>
          <h1 className="pt-title">Hours Worked</h1>
          <p className="pt-sub">Your clocked hours and overtime across the current week and month.</p>
        </div>
      </div>

      {error && (
        <div className="eh-error danger" role="alert" style={{ marginBottom: 16 }}>
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {loading && !error ? (
        <div className="loading-block">
          <div className="spinner-border" style={{ color: '#2DB54A' }} role="status" aria-label="Loading" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="ts-grid">
            {cards.map((c, i) => (
              <div className="panel ts-card" key={i}>
                <div className="d-flex align-items-center justify-content-between" style={{ marginBottom: 8 }}>
                  <span className="ts-card-label" style={{ marginBottom: 0 }}>{c.label}</span>
                  {c.icon}
                </div>
                <div className="ts-card-value">{c.value}</div>
                <div className="ts-card-sub">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Monthly progress */}
          <div className="panel panel-pad" style={{ marginBottom: 16 }}>
            <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 8, marginBottom: 10 }}>
              <span className="panel-title">
                <Award size={17} color="#2DB54A" aria-hidden="true" /> Monthly target progress
              </span>
              <span className="panel-sub">{Math.round(pct)}% of ~{Math.round(requiredMonthly)}h estimate</span>
            </div>
            <div className="progress" style={{ height: 12, borderRadius: 20 }}>
              <div
                className="progress-bar"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #2DB54A, #52D76B)', borderRadius: 20 }}
              />
            </div>
          </div>

          {/* Daily breakdown */}
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title"><Clock size={16} color="#2DB54A" aria-hidden="true" /> Daily Breakdown</span>
              <span className="panel-sub">Last {records.length} day(s)</span>
            </div>
            <div className="table-scroll">
              <table className="table mb-0 attrs">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Hours</th>
                    <th>Overtime</th>
                    <th>Late</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700, color: '#1E3027' }}>
                        {new Date(`${r.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </td>
                      <td>{r.check_out ? fmtHM(r.worked_minutes) : '—'}</td>
                      <td style={{ color: r.daily_overtime_minutes > 0 ? '#1A8A35' : '#6B8070', fontWeight: r.daily_overtime_minutes > 0 ? 700 : 400 }}>
                        {r.daily_overtime_minutes > 0 ? fmtHM(r.daily_overtime_minutes) : '—'}
                      </td>
                      <td style={{ color: r.late_minutes > 0 ? '#B45309' : '#6B8070', fontWeight: r.late_minutes > 0 ? 700 : 400 }}>
                        {r.late_minutes > 0 ? `${r.late_minutes}m` : '—'}
                      </td>
                      <td><span className="chip gray">{r.status}</span></td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '36px 16px', color: '#6B8070' }}>
                        No attendance recorded yet this month.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EmployeeHours;