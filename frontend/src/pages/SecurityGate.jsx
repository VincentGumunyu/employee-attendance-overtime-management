import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, LogOut, ShieldCheck, ScanLine } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { api } from '../lib/api';

const SecurityGate = () => {
  const [barcode, setBarcode] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(new Date());
  const barcodeRef = useRef(null);
  const navigate = useNavigate();

  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;
  const fullName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Security';

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/security/barcode');
        setBarcode(res.data.barcode);
        setError(null);
      } catch (e) {
        setError(e.response?.data?.error || 'Unable to load gate barcode.');
      }
    })();
  }, []);

  useEffect(() => {
    if (barcode && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, barcode, {
          format: 'CODE128',
          displayValue: true,
          height: 90,
          width: 2.4,
          margin: 10,
          fontSize: 20,
        });
      } catch {
        // ignore render errors
      }
    }
  }, [barcode]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="sg-shell">
      {/* Header */}
      <div className="sg-top">
        <div className="sg-brand">
          <div className="sg-logo">
            <HeartPulse size={24} />
          </div>
          <div className="sg-brand-text">
            <div className="sg-title">Medi<span className="sg-accent">Shift</span> — Gate Terminal</div>
            <div className="sg-sub">
              {fullName} · {now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}
              <b>{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</b>
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="sg-signout"
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#EF4444'; e.currentTarget.style.color = '#EF4444'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#C9DCD1'; }}
        >
          <LogOut size={15} /> Sign Out
        </button>
      </div>

      {/* Barcode Card */}
      <div className="sg-card">
        <div className="sg-icon-tile">
          <ScanLine size={32} color="#2DB54A" />
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#1E3027', marginBottom: '6px' }}>
          Scan Your Attendance Here
        </h1>
        <p style={{ fontSize: '14px', color: '#6B8070', lineHeight: '1.6', marginBottom: '24px' }}>
          Employees, open your phone, sign in and use the camera scanner to scan the barcode below to clock in or out.
        </p>

        {error ? (
          <div style={{ color: '#B91C1C', fontWeight: '600', fontSize: '14px' }}>{error}</div>
        ) : barcode ? (
          <div className="sg-barcode-well">
            <svg ref={barcodeRef} style={{ width: '100%', maxHeight: '130px' }} />
            <div className="sg-live-chip">
              <ShieldCheck size={14} />
              Live gate barcode — refresh this screen to rotate
            </div>
          </div>
        ) : (
          <div className="spinner-border" style={{ color: '#2DB54A' }} role="status">
            <span className="visually-hidden">Loading…</span>
          </div>
        )}
      </div>

      <p className="sg-foot">
        Employees scan this barcode with their own phone camera while logged in. Attendance is recorded
        automatically for each scanning employee.
      </p>
    </div>
  );
};

export default SecurityGate;