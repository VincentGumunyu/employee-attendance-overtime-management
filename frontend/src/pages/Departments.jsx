import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Building2, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

const Departments = () => {
  const [departments, setDepartments] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const res = await api.get('/departments');
      setDepartments(res.data || []);
      setError(null);
    } catch (e) {
      setError('Unable to load departments. Make sure the backend is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    try {
      setSaving(true);
      await api.post('/departments', { name: n });
      setName('');
      await load();
    } catch (e2) {
      setError(e2.response?.data?.error || 'Failed to create department.');
    } finally {
      setSaving(false);
    }
  };

  const rename = async (dept) => {
    const next = window.prompt('Rename department', dept.name);
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    try {
      await api.put(`/departments/${dept.id}`, { name: trimmed });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update department.');
    }
  };

  const remove = async (dept) => {
    const ok = window.confirm(`Delete department "${dept.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/departments/${dept.id}`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete department. It may be in use by employees.');
    }
  };

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
          <h2>Departments</h2>
          <p>Manage hospital departments used in employee profiles</p>
        </div>
        <button
          className="btn-outline-tmc d-flex align-items-center gap-2"
          onClick={() => load(true)}
          disabled={refreshing}
        >
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && (
          <div className="alert alert-danger mb-0 border-0" role="alert" style={{ borderRadius: '10px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <div className="card" style={{ padding: '18px 20px' }}>
          <form onSubmit={create} className="d-flex align-items-center gap-2">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
              <div className="stat-card-icon" style={{ background: 'rgba(45,181,74,0.1)' }}>
                <Building2 size={18} color="#2DB54A" />
              </div>
              <input
                className="form-control"
                placeholder="New department name (e.g. Laboratory)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <button className="btn btn-success d-flex align-items-center gap-2" disabled={saving}>
              <Plus size={16} />
              {saving ? 'Adding…' : 'Add'}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>All Departments</span>
            <span style={{ fontSize: '12px', color: '#6B8070', fontWeight: '400' }}>
              {departments.length} total
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table mb-0">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '24px !important' }}>Name</th>
                  <th style={{ width: 180 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.length === 0 ? (
                  <tr>
                    <td colSpan="2" style={{ textAlign: 'center', padding: '40px 0 !important', color: '#6B8070' }}>
                      No departments yet.
                    </td>
                  </tr>
                ) : departments.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: '700', color: '#1E3027', paddingLeft: '24px' }}>{d.name}</td>
                    <td>
                      <div className="d-flex gap-2">
                        <button className="btn btn-light btn-sm d-flex align-items-center gap-1" onClick={() => rename(d)}>
                          <Pencil size={14} /> Rename
                        </button>
                        <button className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1" onClick={() => remove(d)}>
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </td>
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

export default Departments;

