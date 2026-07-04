import React, { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api';

const toISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const minutesToHM = (mins) => {
  const m = Math.max(0, Number(mins || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h}h ${r} mins`;
};

const downloadCSV = (filename, rows) => {
  const escape = (v) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const csv = rows.map((r) => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const Reports = () => {
  const [range, setRange] = useState(() => {
    const today = new Date();
    return { from: toISODate(today), to: toISODate(today) };
  });
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [overtimeRows, setOvertimeRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const [att, ot] = await Promise.all([
        api.get(`/reports/attendance?from=${range.from}&to=${range.to}`),
        api.get(`/reports/overtime?from=${range.from}&to=${range.to}`)
      ]);
      setAttendanceRows(att.data || []);
      setOvertimeRows(ot.data || []);
      setError(null);
    } catch (e) {
      setError('Unable to load reports. Make sure the backend is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const worked = attendanceRows.reduce((s, r) => s + Number(r.worked_minutes || 0), 0);
    const ot = attendanceRows.reduce((s, r) => s + Number(r.daily_overtime_minutes || 0), 0);
    return { worked, ot };
  }, [attendanceRows]);

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
      <div className="dashboard-topbar">
        <div className="topbar-title">
          <h2>Reports</h2>
          <p>Attendance and overtime reporting (date range)</p>
        </div>
        <button className="btn-outline-tmc d-flex align-items-center gap-2" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && (
          <div className="alert alert-danger d-flex align-items-center gap-2 mb-0 border-0" role="alert" style={{ borderRadius: '10px', fontSize: '13px' }}>
            <ShieldAlert size={18} />
            {error}
          </div>
        )}

        <div className="card" style={{ padding: '14px 16px' }}>
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: '#6B8070' }}>From</label>
              <input className="form-control" type="date" value={range.from} onChange={(e) => setRange((s) => ({ ...s, from: e.target.value }))} />
            </div>
            <div className="col-md-3">
              <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: '#6B8070' }}>To</label>
              <input className="form-control" type="date" value={range.to} onChange={(e) => setRange((s) => ({ ...s, to: e.target.value }))} />
            </div>
            <div className="col-md-6 d-flex gap-2 justify-content-end">
              <button className="btn btn-success" onClick={() => load(true)}>Run Report</button>
              <button className="btn btn-outline-primary d-flex align-items-center gap-2" onClick={() => {
                const header = ['Date', 'Employee No', 'Employee', 'Department', 'Check In', 'Check Out', 'Worked Time', 'Overtime', 'Late', 'Early', 'Status'];
                const rows = attendanceRows.map((r) => [
                  r.date, r.employee_number, r.employee_name, r.department,
                  r.check_in || '', r.check_out || '',
                  minutesToHM(r.worked_minutes), minutesToHM(r.daily_overtime_minutes), minutesToHM(r.late_minutes), minutesToHM(r.early_departure_minutes), r.status
                ]);
                downloadCSV(`attendance-${range.from}-to-${range.to}.csv`, [header, ...rows]);
              }}>
                <Download size={16} /> Export Attendance CSV
              </button>
              <button className="btn btn-outline-primary d-flex align-items-center gap-2" onClick={() => {
                const header = ['Date', 'Employee No', 'Employee', 'Department', 'Worked Time', 'Overtime'];
                const rows = overtimeRows.map((r) => [
                  r.date, r.employee_number, r.employee_name, r.department, minutesToHM(r.worked_minutes), minutesToHM(r.daily_overtime_minutes)
                ]);
                downloadCSV(`overtime-${range.from}-to-${range.to}.csv`, [header, ...rows]);
              }}>
                <Download size={16} /> Export Overtime CSV
              </button>
            </div>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-lg-6">
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ fontWeight: 900, color: '#1E3027' }}>Totals (Attendance)</div>
              <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ background: '#F0F7F2', border: '1px solid #C8EDD1', borderRadius: 10, padding: 12, minWidth: 220 }}>
                  <div style={{ fontSize: 12, color: '#6B8070', fontWeight: 700 }}>Worked</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#1E3027' }}>{minutesToHM(totals.worked)}</div>
                </div>
                <div style={{ background: '#E6F5EB', border: '1px solid #C8EDD1', borderRadius: 10, padding: 12, minWidth: 220 }}>
                  <div style={{ fontSize: 12, color: '#1A8A35', fontWeight: 800 }}>Overtime</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#1E3027' }}>{minutesToHM(totals.ot)}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-6">
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ fontWeight: 900, color: '#1E3027' }}>Overtime Records</div>
              <div style={{ marginTop: 10, color: '#6B8070', fontSize: 13 }}>
                {overtimeRows.length} overtime events in range
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>Attendance Records</span>
            <span style={{ fontSize: 12, color: '#6B8070', fontWeight: 400 }}>{attendanceRows.length} rows</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table mb-0">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '24px !important' }}>Date</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Worked</th>
                  <th>Overtime</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRows.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '40px 0 !important', color: '#6B8070' }}>
                      No records for selected range.
                    </td>
                  </tr>
                ) : attendanceRows.map((r, i) => (
                  <tr key={`${r.employee_number}-${r.date}-${i}`}>
                    <td style={{ paddingLeft: 24, fontFamily: 'monospace' }}>{r.date}</td>
                    <td style={{ fontWeight: 800, color: '#1E3027' }}>{r.employee_name} <span style={{ color: '#6B8070', fontWeight: 600 }}>({r.employee_number})</span></td>
                    <td style={{ color: '#6B8070' }}>{r.department || '—'}</td>
                    <td style={{ color: '#6B8070', fontFamily: 'monospace' }}>{r.check_in ? new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td style={{ color: '#6B8070', fontFamily: 'monospace' }}>{r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td style={{ fontWeight: 900, color: '#1E3027' }}>{minutesToHM(r.worked_minutes)}</td>
                    <td style={{ fontWeight: 900, color: r.daily_overtime_minutes > 0 ? '#2DB54A' : '#6B8070' }}>{minutesToHM(r.daily_overtime_minutes)}</td>
                    <td style={{ color: '#6B8070' }}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;

