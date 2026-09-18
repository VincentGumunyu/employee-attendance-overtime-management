import React, { useEffect, useState } from 'react';
import { CalendarCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';

const fmtTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const fmtHM = (m) => {
  const v = Math.max(0, Number(m || 0));
  return `${Math.floor(v / 60)}h ${v % 60}m`;
};

const toISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const statusChip = (s) => {
  if (s === 'On Time' || s === 'Checked Out') return 'green';
  if (s === 'Late') return 'amber';
  if (s === 'Early Departure') return 'red';
  if (s === 'Absent') return 'gray';
  return 'gray';
};

const EmployeeAttendance = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toISODate(d);
  });
  const [to, setTo] = useState(() => toISODate(new Date()));

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/attendance/mine?from=${from}&to=${to}`);
      setRecords(res.data || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Unable to load attendance history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalWorked = records.reduce((a, r) => a + (r.worked_minutes || 0), 0);
  const totalOT = records.reduce((a, r) => a + (r.daily_overtime_minutes || 0), 0);
  const totalLate = records.reduce((a, r) => a + (r.late_minutes || 0), 0);

  return (
    <div className="pt-page">
      <div className="pt-head" style={{ gap: 16 }}>
        <div>
          <h1 className="pt-title">My Attendance</h1>
          <p className="pt-sub">Every clock-in and clock-out recorded under your employee profile.</p>
        </div>
      </div>

      {/* Summary */}
      <div className="ts-grid">
        <div className="panel ts-card">
          <div className="ts-card-label">Worked in range</div>
          <div className="ts-card-value">{fmtHM(totalWorked)}</div>
        </div>
        <div className="panel ts-card">
          <div className="ts-card-label">Overtime</div>
          <div className="ts-card-value" style={{ color: '#1A8A35' }}>{fmtHM(totalOT)}</div>
        </div>
        <div className="panel ts-card">
          <div className="ts-card-label">Late (total)</div>
          <div className="ts-card-value" style={{ color: '#B45309' }}>{fmtHM(totalLate)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="panel panel-pad" style={{ marginBottom: 16 }}>
        <form
          className="filter-bar"
          onSubmit={(e) => { e.preventDefault(); load(); }}
        >
          <div className="filter-field">
            <label className="filter-label" htmlFor="att-from">From</label>
            <input id="att-from" type="date" className="filter-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="filter-field">
            <label className="filter-label" htmlFor="att-to">To</label>
            <input id="att-to" type="date" className="filter-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button type="submit" className="filter-btn" disabled={loading}>
            {loading ? <RefreshCw size={15} className="spin" style={{ marginRight: 5 }} /> : null}
            Apply
          </button>
        </form>
      </div>

      {error && (
        <div className="eh-error danger" role="alert" style={{ marginBottom: 16 }}>
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title"><CalendarCheck size={16} color="#2DB54A" aria-hidden="true" /> Attendance Records</span>
          <span className="panel-sub">{records.length} day(s)</span>
        </div>
        <div className="table-scroll">
          {loading ? (
            <div className="loading-block">
              <div className="spinner-border spinner-border-sm" style={{ color: '#2DB54A' }} role="status" aria-label="Loading" />
            </div>
          ) : (
            <table className="table mb-0">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Worked</th>
                  <th>Overtime</th>
                  <th>Late</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px 16px', color: '#6B8070' }}>
                      <CalendarCheck size={20} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.5 }} />
                      No attendance records in this range.
                    </td>
                  </tr>
                ) : (
                  records.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700, color: '#1E3027' }}>
                        {new Date(`${r.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td>{fmtTime(r.check_in)}</td>
                      <td>{fmtTime(r.check_out)}</td>
                      <td>{r.check_out ? fmtHM(r.worked_minutes) : '—'}</td>
                      <td style={{ color: r.daily_overtime_minutes > 0 ? '#1A8A35' : '#6B8070', fontWeight: r.daily_overtime_minutes > 0 ? 700 : 400 }}>
                        {r.daily_overtime_minutes > 0 ? fmtHM(r.daily_overtime_minutes) : '—'}
                      </td>
                      <td style={{ color: r.late_minutes > 0 ? '#B45309' : '#6B8070', fontWeight: r.late_minutes > 0 ? 700 : 400 }}>
                        {r.late_minutes > 0 ? `${r.late_minutes}m` : '—'}
                      </td>
                      <td><span className={`chip ${statusChip(r.status)}`}>{r.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeAttendance;