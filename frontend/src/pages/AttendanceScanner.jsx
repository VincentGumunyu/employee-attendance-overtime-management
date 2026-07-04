import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanFace, Clock, Calendar, Award, HeartPulse, LogOut } from 'lucide-react';
import { api } from '../lib/api';
import confetti from 'canvas-confetti';

const AttendanceScanner = () => {
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [scanInput, setScanInput] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Detect if the current user is a Security gate user
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;
  const isSecurityUser = user?.role === 'Security';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  useEffect(() => {
    const focusInput = () => {
      if (inputRef.current) inputRef.current.focus();
    };
    focusInput();
    document.addEventListener('click', focusInput);
    return () => document.removeEventListener('click', focusInput);
  }, []);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    try {
      const raw = scanInput.trim();
      const isBarcode = /^EMP\d{6,}$/i.test(raw);
      const response = await api.post('/attendance/scan', {
        identifier_type: isBarcode ? 'barcode' : 'rfid',
        identifier_value: raw,
        device: 'WEB-TERMINAL'
      });
      setScanResult(response.data);
      setError(null);
      
      // Professional celebratory confetti for check-in
      if (response.data.action === 'check_in') {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#2DB54A', '#52D76B', '#E6F5EB']
        });
      }
    } catch (err) {
      setScanResult(null);
      setError(err.response?.data?.error || 'An error occurred during scan.');
    }
    setScanInput('');
  };

  const formatMinutes = (minutes) => {
    const m = Math.max(0, Number(minutes || 0));
    const h = Math.floor(m / 60);
    const r = m % 60;
    return `${h}h ${r} mins`;
  };

  const statusColor = (status) => {
    if (!status) return '#6B8070';
    if (status === 'On Time' || status === 'Checked Out') return '#1A8A35';
    if (status === 'Late') return '#B45309';
    if (status === 'Early Departure') return '#B91C1C';
    return '#6B8070';
  };

  const statusBg = (status) => {
    if (!status) return '#F0F4F1';
    if (status === 'On Time' || status === 'Checked Out') return '#E6F5EB';
    if (status === 'Late') return '#FFFBEB';
    if (status === 'Early Departure') return '#FEF2F2';
    return '#F0F4F1';
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F1', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <div className="dashboard-topbar">
        <div className="topbar-title">
          <h2>Attendance Terminal (Barcode/RFID)</h2>
          <p>Scan your employee badge to record attendance</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#6B8070' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2DB54A', display: 'inline-block', boxShadow: '0 0 0 3px rgba(45,181,74,0.2)' }} />
            Terminal Active
          </div>
          {isSecurityUser && (
            <button
              onClick={handleLogout}
              title="Sign Out"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'none', border: '1px solid #E5EDE7',
                borderRadius: '8px', padding: '6px 14px',
                color: '#6B8070', fontSize: '12px', fontWeight: '600',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#EF4444'; e.currentTarget.style.color = '#EF4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5EDE7'; e.currentTarget.style.color = '#6B8070'; }}
            >
              <LogOut size={14} />
              Sign Out
            </button>
          )}
        </div>
      </div>

      {/* Scanner Body */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 28px' }}>
        <div style={{ width: '100%', maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Main Scan Card */}
          <div className="card" style={{ padding: '48px 40px', textAlign: 'center' }}>
            {/* Logo Badge */}
            <div style={{
              width: '80px', height: '80px', borderRadius: '20px',
              background: 'linear-gradient(135deg, #2DB54A, #52D76B)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 8px 24px rgba(45,181,74,0.3)'
            }}>
              <HeartPulse size={40} color="white" />
            </div>

            <ScanFace className="rfid-icon" />

            <h3 style={{ fontWeight: '800', color: '#1E3027', marginBottom: '8px' }}>
              Tait Medical Centre
            </h3>
            <p style={{ color: '#6B8070', fontSize: '14px', lineHeight: '1.6' }}>
              Scan your barcode or RFID badge on the terminal reader.<br />
              The system will automatically record your check-in or check-out.
            </p>

            {/* Hidden capture input */}
            <form onSubmit={handleScan}>
              <input
                type="text"
                className="rfid-input"
                ref={inputRef}
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                autoFocus
              />
            </form>
          </div>

          {/* Scan Result Card */}
          {scanResult && (
            <div className="card" style={{ overflow: 'hidden', animation: 'celebratoryPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
              {/* Result Header */}
              <div style={{
                padding: '14px 24px',
                background: scanResult.action === 'check_in'
                  ? 'linear-gradient(90deg, #1A8A35, #2DB54A)'
                  : 'linear-gradient(90deg, #1D4ED8, #3B82F6)',
                color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <span style={{ fontWeight: '700', fontSize: '14px' }}>
                  {scanResult.action === 'check_in' ? '✓ Check-In Registered' : '✓ Check-Out Registered'}
                </span>
                <span style={{ fontSize: '12px', opacity: 0.85 }}>{scanResult.time}</span>
              </div>

              {/* Greeting Banner */}
              {scanResult.greeting && (
                <div style={{
                  padding: '16px 24px',
                  background: scanResult.action === 'check_in'
                    ? 'linear-gradient(135deg, #E6F5EB, #F0FAF3)'
                    : 'linear-gradient(135deg, #EEF2FF, #F0F4FF)',
                  borderBottom: '1px solid ' + (scanResult.action === 'check_in' ? '#C8EDD1' : '#C7D2FE'),
                  display: 'flex', alignItems: 'center', gap: '12px',
                  animation: 'fadeSlideUp 0.5s ease-out 0.15s both',
                }}>
                  <span style={{ fontSize: '28px', lineHeight: 1, flexShrink: 0 }}>
                    {scanResult.greeting.emoji}
                  </span>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: scanResult.action === 'check_in' ? '#15603A' : '#3730A3',
                    lineHeight: '1.5',
                  }}>
                    {scanResult.greeting.text}
                  </span>
                </div>
              )}

              {/* Result Body */}
              <div style={{ padding: '20px 24px' }}>
                <div style={{ fontWeight: '800', fontSize: '18px', color: '#1E3027', marginBottom: '14px' }}>
                  {scanResult.employee}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6B8070' }}>
                    <Calendar size={15} />
                    <span><strong style={{ color: '#1E3027' }}>Date:</strong> {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6B8070' }}>
                    <Clock size={15} />
                    <span><strong style={{ color: '#1E3027' }}>Time:</strong> {scanResult.time}</span>
                  </div>
                </div>

                {/* Status badge */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '5px 14px', borderRadius: '20px',
                  background: statusBg(scanResult.status),
                  color: statusColor(scanResult.status),
                  fontWeight: '700', fontSize: '12px', marginBottom: '16px'
                }}>
                  {scanResult.status}
                </div>

                {/* Checkout worked/overtime summary */}
                {scanResult.action === 'check_out' && (
                  <div style={{ background: '#F0F7F2', borderRadius: '10px', padding: '14px 16px', borderLeft: '3px solid #2DB54A' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: scanResult.daily_overtime_minutes > 0 ? '8px' : '0' }}>
                      <span style={{ fontSize: '12px', color: '#6B8070', fontWeight: '600' }}>Worked Today</span>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#1E3027' }}>{formatMinutes(scanResult.worked_minutes)}</span>
                    </div>
                    {scanResult.daily_overtime_minutes > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #C8EDD1' }}>
                        <span style={{ fontSize: '12px', color: '#1A8A35', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Award size={13} /> Overtime
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#2DB54A' }}>+{formatMinutes(scanResult.daily_overtime_minutes)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Card */}
          {error && (
            <div className="card" style={{ border: '1px solid #FCA5A5 !important', padding: '16px 20px' }}>
              <div style={{ color: '#B91C1C', fontWeight: '600', fontSize: '13px' }}>
                <strong>Scan Error:</strong> {error}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceScanner;
