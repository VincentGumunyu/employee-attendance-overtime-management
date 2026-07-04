import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, IdCard, Plus, RefreshCw, ScanLine, ShieldAlert, Trash2 } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { api } from '../lib/api';

const formatEmp = (e) => `${e.first_name || ''} ${e.last_name || ''}`.trim();

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [defaultWeeklyHours, setDefaultWeeklyHours] = useState(45);

  const [form, setForm] = useState({
    employee_number: '',
    first_name: '',
    last_name: '',
    department_id: '',
    position: '',
    employment_status: 'Active',
    weekly_working_hours: 45,
    contact: '',
    rfid_uid: ''
  });
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);

  const cardRef = useRef(null);

  const load = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const [emps, depts] = await Promise.all([api.get('/employees'), api.get('/departments')]);
      setEmployees(emps.data || []);
      setDepartments(depts.data || []);
      // Keep a sensible default for new entries: use 45 unless configured otherwise later
      setDefaultWeeklyHours((prev) => (Number(prev) > 0 ? prev : 45));
      setForm((s) => ({
        ...s,
        weekly_working_hours: Number(s.weekly_working_hours || 0) > 0 ? s.weekly_working_hours : 45
      }));
      setError(null);
    } catch (e) {
      setError('Unable to load employees. Make sure the backend is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const deptNameById = useMemo(() => {
    const m = new Map();
    for (const d of departments) m.set(String(d.id), d.name);
    return m;
  }, [departments]);

  const create = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.department_id) return;
    try {
      setSaving(true);
      await api.post('/employees', {
        employee_number: form.employee_number.trim() || undefined,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        department_id: Number(form.department_id),
        position: form.position.trim() || undefined,
        employment_status: form.employment_status,
        weekly_working_hours: Number(form.weekly_working_hours || defaultWeeklyHours || 45),
        emergency_contact: form.contact.trim() || undefined,
        rfid_uid: form.rfid_uid.trim() || undefined
      });
      setForm({
        employee_number: '',
        first_name: '',
        last_name: '',
        department_id: '',
        position: '',
        employment_status: 'Active',
        weekly_working_hours: defaultWeeklyHours || 45,
        contact: '',
        rfid_uid: ''
      });
      await load();
    } catch (e2) {
      setError(e2.response?.data?.error || 'Failed to create employee.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (emp) => {
    const ok = window.confirm(`Delete ${formatEmp(emp)} (${emp.employee_number})?`);
    if (!ok) return;
    try {
      await api.delete(`/employees/${emp.id}`);
      if (selected?.id === emp.id) setSelected(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete employee.');
    }
  };

  const regenerateBarcode = async (emp) => {
    try {
      await api.post(`/employees/${emp.id}/barcode/regenerate`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to regenerate barcode.');
    }
  };

  const toggleBarcode = async (emp) => {
    try {
      if (emp.barcode_enabled) await api.post(`/employees/${emp.id}/barcode/disable`);
      else await api.post(`/employees/${emp.id}/barcode/enable`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update barcode status.');
    }
  };

  const downloadBarcodePNG = async (emp) => {
    const value = (emp.barcode_value || '').toUpperCase();
    if (!value) return;
    const canvasEl = document.createElement('canvas');
    JsBarcode(canvasEl, value, { format: 'CODE128', displayValue: true, margin: 10, height: 60 });
    const url = canvasEl.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${value}.png`;
    a.click();
  };

  const printIdCardPdf = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    // Render onto A4 (portrait) with true CR80 size centered.
    // CR80: 85.6 x 54 mm
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = 210;
    const pageH = 297;
    const cardW = 85.6;
    const cardH = 54;
    const x = (pageW - cardW) / 2;
    const y = (pageH - cardH) / 2;
    pdf.addImage(imgData, 'PNG', x, y, cardW, cardH);
    pdf.save(`${selected?.employee_number || 'employee'}-id-card.pdf`);
  };

  useEffect(() => {
    if (!selected?.barcode_value) return;
    try {
      const v = selected.barcode_value.toUpperCase();
      const svg1 = document.getElementById('emp-barcode-svg');
      const svg2 = document.getElementById('emp-barcode-svg-card');
      if (svg1) JsBarcode(svg1, v, { format: 'CODE128', displayValue: true, margin: 0, height: 40 });
      if (svg2) JsBarcode(svg2, v, { format: 'CODE128', displayValue: true, margin: 0, height: 36 });
    } catch {
      // ignore rendering errors
    }
  }, [selected]);

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
          <h2>Employees Management</h2>
          <p>Create employees, manage barcode credentials, and print ID cards</p>
        </div>
        <button className="btn-outline-tmc d-flex align-items-center gap-2" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div className="alert alert-danger d-flex align-items-center gap-2 mb-0 border-0" role="alert" style={{ borderRadius: '10px', fontSize: '13px' }}>
              <ShieldAlert size={18} />
              {error}
            </div>
          )}

          <div className="card" style={{ padding: '18px 20px' }}>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div style={{ fontWeight: 800, color: '#1E3027' }}>Register New Employee</div>
              <div style={{ fontSize: 12, color: '#6B8070' }}>
                Barcode + employee number auto-generated if blank
              </div>
            </div>
            <form onSubmit={create} className="row g-2">
              <div className="col-md-3">
                <input className="form-control" placeholder="Employee No (optional)" value={form.employee_number}
                  onChange={(e) => setForm((s) => ({ ...s, employee_number: e.target.value }))} />
              </div>
              <div className="col-md-3">
                <input className="form-control" placeholder="First name" value={form.first_name}
                  onChange={(e) => setForm((s) => ({ ...s, first_name: e.target.value }))} />
              </div>
              <div className="col-md-3">
                <input className="form-control" placeholder="Last name" value={form.last_name}
                  onChange={(e) => setForm((s) => ({ ...s, last_name: e.target.value }))} />
              </div>
              <div className="col-md-3">
                <select className="form-select" value={form.department_id}
                  onChange={(e) => setForm((s) => ({ ...s, department_id: e.target.value }))}>
                  <option value="">Department…</option>
                  {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                </select>
              </div>

              <div className="col-md-3">
                <input className="form-control" placeholder="Position" value={form.position}
                  onChange={(e) => setForm((s) => ({ ...s, position: e.target.value }))} />
              </div>
              <div className="col-md-3">
                <select className="form-select" value={form.employment_status}
                  onChange={(e) => setForm((s) => ({ ...s, employment_status: e.target.value }))}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Leave">On Leave</option>
                </select>
              </div>
              <div className="col-md-3">
                <input
                  type="number"
                  className="form-control"
                  placeholder="Weekly working hours (e.g. 45)"
                  value={form.weekly_working_hours}
                  onChange={(e) => setForm((s) => ({ ...s, weekly_working_hours: e.target.value }))}
                  min="1"
                  max="80"
                />
              </div>
              <div className="col-md-3">
                <input className="form-control" placeholder="Contact (optional)" value={form.contact}
                  onChange={(e) => setForm((s) => ({ ...s, contact: e.target.value }))} />
              </div>
              <div className="col-md-6">
                <input className="form-control" placeholder="RFID UID (optional)" value={form.rfid_uid}
                  onChange={(e) => setForm((s) => ({ ...s, rfid_uid: e.target.value }))} />
              </div>

              <div className="col-md-6 d-flex justify-content-end">
                <button className="btn btn-success d-flex align-items-center gap-2" disabled={saving}>
                  <Plus size={16} />
                  {saving ? 'Saving…' : 'Register Employee'}
                </button>
              </div>
            </form>
          </div>

          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>Employees</span>
              <span style={{ fontSize: 12, color: '#6B8070', fontWeight: 400 }}>{employees.length} total</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table mb-0">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: '24px !important' }}>Employee</th>
                    <th>Employee No</th>
                    <th>Department</th>
                    <th>Position</th>
                    <th>Barcode</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '40px 0 !important', color: '#6B8070' }}>
                        No employees yet.
                      </td>
                    </tr>
                  ) : employees.map((e) => (
                    <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(e)}>
                      <td style={{ fontWeight: 800, color: '#1E3027', paddingLeft: 24 }}>{formatEmp(e)}</td>
                      <td style={{ fontFamily: 'monospace' }}>{e.employee_number}</td>
                      <td style={{ color: '#6B8070' }}>{e.department}</td>
                      <td style={{ color: '#6B8070' }}>{e.position || '—'}</td>
                      <td style={{ fontFamily: 'monospace', color: e.barcode_enabled ? '#1E3027' : '#9CA3AF' }}>
                        {e.barcode_value || '—'} {e.barcode_enabled ? '' : '(disabled)'}
                      </td>
                      <td>
                        <button className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1" onClick={(ev) => { ev.stopPropagation(); remove(e); }}>
                          <Trash2 size={14} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '18px 20px' }}>
            <div className="d-flex align-items-center gap-2 mb-2" style={{ fontWeight: 800, color: '#1E3027' }}>
              <IdCard size={18} color="#2DB54A" />
              Employee Profile
            </div>
            {!selected ? (
              <div style={{ color: '#6B8070', fontSize: 13 }}>
                Select an employee from the table to view their barcode preview and print an ID card.
              </div>
            ) : (
              <>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 16, color: '#1E3027' }}>{formatEmp(selected)}</div>
                    <div style={{ fontSize: 12, color: '#6B8070' }}>
                      {deptNameById.get(String(selected.department_id)) || selected.department || '—'} · {selected.position || '—'}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B8070' }}>
                      Employee No: <span style={{ fontFamily: 'monospace', color: '#1E3027' }}>{selected.employee_number}</span>
                    </div>
                  </div>
                  <button className="btn btn-light btn-sm d-flex align-items-center gap-1" onClick={() => setSelected(null)}>
                    Close
                  </button>
                </div>

                <div style={{ border: '1px solid #E5EDE7', borderRadius: 12, padding: 12, background: '#fff' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6B8070', marginBottom: 8 }}>Barcode Preview</div>
                  {selected.barcode_value ? (
                    <>
                      <svg id="emp-barcode-svg" style={{ width: '100%' }} />
                      <div className="d-flex gap-2 mt-2 flex-wrap">
                        <button className="btn btn-success btn-sm d-flex align-items-center gap-1" onClick={() => regenerateBarcode(selected)}>
                          <RefreshCw size={14} /> Regenerate
                        </button>
                        <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" onClick={() => toggleBarcode(selected)}>
                          <ShieldAlert size={14} /> {selected.barcode_enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1" onClick={() => downloadBarcodePNG(selected)}>
                          <Download size={14} /> Download PNG
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: '#6B8070', fontSize: 13 }}>No barcode assigned.</div>
                  )}
                </div>

                <div className="card mt-2" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid #F0F4F1', fontWeight: 800, color: '#1E3027' }}>
                    Printable ID Card (PDF)
                  </div>

                  <div style={{ padding: 14 }}>
                    <div ref={cardRef} style={{
                      width: 340,
                      border: '1px solid #E5EDE7',
                      borderRadius: 12,
                      padding: 14,
                      background: '#fff'
                    }}>
                      <div style={{ textAlign: 'center', fontWeight: 900, letterSpacing: 0.5 }}>TAIT HOSPITAL</div>
                      <div style={{ textAlign: 'center', fontSize: 11, color: '#6B8070', fontWeight: 700, marginBottom: 10 }}>
                        EMPLOYEE IDENTIFICATION CARD
                      </div>

                      <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                        <div><strong>Name:</strong> {formatEmp(selected)}</div>
                        <div><strong>Employee Number:</strong> {selected.employee_number}</div>
                        <div><strong>Department:</strong> {deptNameById.get(String(selected.department_id)) || selected.department || '—'}</div>
                        <div><strong>Position:</strong> {selected.position || '—'}</div>
                        <div><strong>Status:</strong> {selected.employment_status || '—'}</div>
                        {selected.emergency_contact ? <div><strong>Contact:</strong> {selected.emergency_contact}</div> : null}
                        <div><strong>Issue Date:</strong> {todayISO()}</div>
                      </div>

                      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #E5EDE7' }}>
                        <svg id="emp-barcode-svg-card" style={{ width: '100%' }} />
                      </div>
                    </div>

                    <div className="d-flex gap-2 mt-2 flex-wrap">
                      <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={printIdCardPdf}>
                        <IdCard size={14} /> Download PDF
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Employees;

