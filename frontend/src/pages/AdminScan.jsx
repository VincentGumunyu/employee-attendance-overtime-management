import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera, CameraOff, ScanLine, Calendar, Clock, Award, KeyRound,
  AlertCircle, RefreshCw, Lock, CheckCircle2, Activity, UserRound, HeartPulse
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { BrowserMultiFormatReader } from '@zxing/library';
import { api } from '../lib/api';

const fmtHM = (m) => {
  const v = Math.max(0, Number(m || 0));
  return `${Math.floor(v / 60)}h ${v % 60}m`;
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const toISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const greetingByHour = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const classifyError = (msg = '') => {
  if (/invalid|not a valid|unknown|could not find|not found|no employee/i.test(msg)) return 'danger';
  if (/twice|too soon|already|minutes|location|presence|on-site|office wi|turn on|blocked/i.test(msg)) return 'warn';
  if (/camera|permission|denied|microphone/i.test(msg)) return 'warn';
  return 'danger';
};

const getLocation = () => new Promise((resolve) => {
  if (!navigator.geolocation) return resolve(null);
  navigator.geolocation.getCurrentPosition(
    (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
    () => resolve(null),
    { timeout: 6000, maximumAge: 30000, enableHighAccuracy: false }
  );
});

const statusChipKind = (s) => {
  if (s === 'On Time' || s === 'Checked Out') return 'green';
  if (s === 'Late') return 'amber';
  if (s === 'Early Departure') return 'red';
  return 'gray';
};

const AdminScan = () => {
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;
  const firstName = (user?.first_name || '').trim() || 'there';

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [manualValue, setManualValue] = useState('');

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const videoRef = useRef(null);
  const lastValueRef = useRef('');
  const busyRef = useRef(false);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get('/attendance/mine/stats');
      setStats(res.data);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const from = new Date();
    from.setDate(from.getDate() - 13);
    try {
      const res = await api.get(`/attendance/mine?from=${toISODate(from)}&to=${toISODate(new Date())}`);
      setHistory(res.data || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadHistory();
  }, [loadStats, loadHistory]);

  useEffect(() => {
    if (!('mediaDevices' in navigator) || !navigator.mediaDevices?.getUserMedia) {
      setCameraSupported(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      try { controlsRef.current?.stop(); } catch { /* ignore */ }
      controlsRef.current = null;
    };
  }, []);

  const startCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraSupported(false);
      setError('Camera scanning is not supported by this device. Use the manual entry below.');
      return;
    }
    setCameraStarting(true);
    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        videoRef.current,
        (result) => {
          if (result && !busyRef.current) {
            const value = (result.getText() || '').trim().toUpperCase();
            if (value && value !== lastValueRef.current) {
              lastValueRef.current = value;
              handleScan(value);
            }
          }
        }
      );
      controlsRef.current = controls;
      setCameraOn(true);
    } catch (err) {
      setCameraOn(false);
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError' || err.name === 'NotFoundError' || err.name === 'NotReadableError');
      setError(
        denied
          ? 'Camera permission was denied. Allow camera access in your browser settings, or use manual entry below.'
          : 'Could not start the camera. Check your connection or use manual entry below.'
      );
    } finally {
      setCameraStarting(false);
    }
  };

  const stopCamera = () => {
    try { controlsRef.current?.stop(); } catch { /* ignore */ }
    controlsRef.current = null;
    readerRef.current = null;
    setCameraOn(false);
  };

  const handleScan = async (barcode) => {
    busyRef.current = true;
    setScanning(true);
    setError(null);
    try {
      const location = await getLocation();
      const res = await api.post('/attendance/self-scan', {
        barcode,
        device: 'MOBILE-CAMERA',
        latitude: location ? location.latitude : null,
        longitude: location ? location.longitude : null,
      });
      setScanResult(res.data);
      if (res.data.action === 'check_in') {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.5 }, colors: ['#2DB54A', '#52D76B', '#E6F5EB'] });
      }
      loadStats();
      loadHistory();
    } catch (err) {
      setScanResult(null);
      setError(err.response?.data?.error || 'Could not reach the server. Check your connection and try again.');
    } finally {
      setScanning(false);
      setTimeout(() => { busyRef.current = false; }, 400);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const value = manualValue.trim().toUpperCase();
    if (!value) return;
    lastValueRef.current = value;
    handleScan(value);
    setManualValue('');
  };

  const resetScanner = () => {
    lastValueRef.current = '';
    setScanResult(null);
    setError(null);
    loadStats();
    loadHistory();
  };

  const today = stats?.today;
  const statusKind = today?.checked_in ? (today.checked_out ? 'out' : 'in') : 'idle';

  return (
    <div style={{ height: '100%' }}>
      <div className="dashboard-topbar">
        <div className="topbar-title">
          <h2>Scan to Work</h2>
          <p>Clock in / clock out like staff by scanning the gate barcode on your phone</p>
        </div>
        <button
          className="btn-outline-tmc d-flex align-items-center gap-2"
          onClick={() => { loadStats(); loadHistory(); }}
          disabled={statsLoading}
        >
          <RefreshCw size={14} className={statsLoading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="mc-page">
        {error && (
          <div className="alert alert-danger mb-3 border-0 d-flex align-items-center gap-2 align-items-start"
            style={{ borderRadius: 14, fontSize: 13 }} role="alert" aria-live="polite">
            {classifyError(error) === 'warn' ? <Lock size={16} aria-hidden="true" className="mt-1" /> : <AlertCircle size={16} aria-hidden="true" className="mt-1" />}
            <span>{error}</span>
          </div>
        )}

        <div className="row g-3">
          {/* Scanner */}
          <div className="col-12 col-lg-7">
            <div className="card" style={{ padding: '20px' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span className="panel-title">
                  <ScanLine size={17} color="#2DB54A" aria-hidden="true" /> Camera Scanner
                </span>
                {cameraOn && (
                  <button type="button" className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" onClick={stopCamera} style={{ minHeight: 38 }}>
                    <CameraOff size={14} aria-hidden="true" /> Stop Camera
                  </button>
                )}
              </div>

              <div className="scanner-viewport">
                <video ref={videoRef} playsInline muted className="scanner-video" aria-label="Live camera preview" />
                {cameraOn ? (
                  <>
                    <div className="scanner-shade" aria-hidden="true" />
                    <span className="scanner-corner tl" aria-hidden="true" />
                    <span className="scanner-corner tr" aria-hidden="true" />
                    <span className="scanner-corner bl" aria-hidden="true" />
                    <span className="scanner-corner br" aria-hidden="true" />
                    <div className="scanner-target-hint" aria-hidden="true">
                      <span className="hint-label">Align barcode within the frame</span>
                    </div>
                    <span className="scanner-chip">
                      <span className="live-dot" aria-hidden="true" />
                      {scanning ? 'Recording…' : 'Camera live'}
                    </span>
                  </>
                ) : (
                  <div className="scanner-empty">
                    {cameraStarting ? (
                      <>
                        <div className="spinner-border" style={{ color: '#2DB54A' }} role="status" aria-label="Starting camera">
                          <span className="visually-hidden">Loading…</span>
                        </div>
                        <div className="scanner-empty-title">Starting camera…</div>
                      </>
                    ) : (
                      <>
                        <button type="button" className="scanner-cta" onClick={startCamera} aria-label="Enable camera scanning">
                          {cameraSupported ? <Camera size={26} aria-hidden="true" /> : <CameraOff size={26} aria-hidden="true" />}
                        </button>
                        <div className="scanner-empty-title">
                          {cameraSupported ? 'Start camera scanning' : 'Camera scanning not supported here'}
                        </div>
                        <div className={`scanner-empty-sub${cameraSupported ? '' : ' amber'}`}>
                          {cameraSupported
                            ? 'Tap to enable the camera, then hold your phone steady over the barcode on the security gate terminal.'
                            : 'Use the manual entry below to type the gate barcode instead.'}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Manual entry */}
              <div className="manual-entry mt-3">
                <label className="manual-label" htmlFor="admin-manual-barcode">
                  <KeyRound size={15} color="#2DB54A" aria-hidden="true" /> Can't scan? Enter the gate barcode
                </label>
                <form className="manual-row" onSubmit={handleManualSubmit}>
                  <input
                    id="admin-manual-barcode"
                    type="text"
                    className="manual-input"
                    placeholder="GATE-…"
                    autoComplete="off"
                    spellCheck="false"
                    value={manualValue}
                    onChange={(e) => setManualValue(e.target.value)}
                  />
                  <button type="submit" className="manual-btn" disabled={!manualValue.trim() || scanning}>
                    {scanning ? 'Recording…' : 'Submit'}
                  </button>
                </form>
                <p className="manual-hint">
                  The barcode is shown on the security terminal screen (e.g. <strong>GATE-SECURITY</strong>).
                </p>
              </div>
            </div>
          </div>

          {/* Status + History */}
          <div className="col-12 col-lg-5 d-flex flex-column" style={{ gap: 16 }}>
            <div className="card" style={{ padding: '20px' }}>
              {scanResult ? (
                <ResultCard result={scanResult} />
              ) : (
                <div aria-live="polite">
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <span className="status-avatar">
                      <HeartPulse size={22} />
                    </span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#3D5245', lineHeight: 1.3 }}>
                        <strong>{greetingByHour()}, {firstName}.</strong>
                      </div>
                      {!statsLoading && (
                        <div style={{ fontSize: 12.5, color: '#6B8070', marginTop: 2 }}>
                          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                      )}
                    </div>
                  </div>

                  {statsLoading ? (
                    <div className="d-flex align-items-center gap-2 py-2">
                      <div className="spinner-border spinner-border-sm" style={{ color: '#2DB54A' }} role="status" aria-label="Loading status" />
                      <span style={{ fontSize: 13, color: '#6B8070' }}>Loading status…</span>
                    </div>
                  ) : statusKind === 'in' ? (
                    <div className="status-line green mb-2">
                      <span className="status-dot green" aria-hidden="true" />
                      <span>You're clocked in <Activity size={15} aria-hidden="true" style={{ verticalAlign: -2 }} /></span>
                    </div>
                  ) : statusKind === 'out' ? (
                    <div className="status-line neutral mb-2">
                      <span className="status-dot gray" aria-hidden="true" />
                      <span>You're clocked out</span>
                    </div>
                  ) : (
                    <div className="status-line amber mb-2">
                      <span className="status-dot amber" aria-hidden="true" />
                      <span>You haven't clocked in today</span>
                    </div>
                  )}

                  {!statsLoading && statusKind === 'in' && (
                    <>
                      <div className="status-meta">
                        <Calendar size={14} aria-hidden="true" /> Started at <strong style={{ color: '#1E3027' }}>{fmtTime(today.checked_in)}</strong>
                      </div>
                      <div className="status-meta" style={{ marginTop: 6, color: '#3D5245' }}>
                        Scan the barcode again when you leave to clock out.
                      </div>
                    </>
                  )}
                  {!statsLoading && statusKind === 'out' && (
                    <>
                      <div className="status-meta">
                        <Clock size={14} aria-hidden="true" /> Today's hours: <strong style={{ color: '#1E3027' }}>{fmtHM(today.worked_minutes)}</strong>
                      </div>
                      {Number(stats.month_worked_minutes) > 0 && (
                        <div className="status-meta">
                          <Award size={14} aria-hidden="true" /> This month: <strong style={{ color: '#1E3027' }}>{fmtHM(stats.month_worked_minutes)}</strong>
                        </div>
                      )}
                    </>
                  )}
                  {!statsLoading && statusKind === 'idle' && (
                    <div className="status-meta" style={{ marginTop: 6, color: '#3D5245' }}>
                      Ready when you are — scan the gate barcode to clock in.
                    </div>
                  )}

                  {scanResult && (
                    <button type="button" className="btn btn-outline-secondary w-100 mt-3" style={{ minHeight: 42 }} onClick={resetScanner}>
                      <RefreshCw size={15} style={{ marginRight: 6 }} /> New Scan
                    </button>
                  )}
                </div>
              )}

              {!scanResult && (
                <div className="help-tip" style={{ marginTop: 16 }}>
                  <UserRound size={15} color="#456255" aria-hidden="true" style={{ minWidth: 15, marginTop: 1 }} />
                  <span>
                    Your attendance is recorded under your admin profile and appears in the Employees list.
                  </span>
                </div>
              )}
            </div>

            {/* History */}
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span>My Recent Attendance</span>
                <span style={{ fontSize: '12px', color: '#6B8070', fontWeight: '400' }}>Last 14 days</span>
              </div>
              <div className="mc-table-scroll">
                {historyLoading ? (
                  <div className="loading-block py-4 d-flex justify-content-center">
                    <div className="spinner-border spinner-border-sm" style={{ color: '#2DB54A' }} role="status" aria-label="Loading history" />
                  </div>
                ) : history.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: '#6B8070', fontSize: 13 }}>
                    <Clock size={20} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.5 }} />
                    No attendance recorded yet.
                  </div>
                ) : (
                  <table className="table mb-0">
                    <thead>
                      <tr>
                        <th className="mc-th-first">Date</th>
                        <th>In</th>
                        <th>Out</th>
                        <th>Worked</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((r, i) => (
                        <tr key={i}>
                          <td className="mc-th-first" style={{ fontWeight: 700, color: '#1E3027' }}>
                            {new Date(`${r.date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </td>
                          <td>{fmtTime(r.check_in)}</td>
                          <td>{fmtTime(r.check_out)}</td>
                          <td style={{ fontWeight: 600, color: '#1E3027' }}>{r.check_out ? fmtHM(r.worked_minutes) : '—'}</td>
                          <td><span className={`chip ${statusChipKind(r.status)}`}>{r.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ResultCard = ({ result }) => {
  const isIn = result.action === 'check_in';
  const bannerBg = isIn
    ? 'linear-gradient(90deg, #1A8A35, #2DB54A)'
    : 'linear-gradient(90deg, #1E7A34, #34C25A)';
  return (
    <div role="status" aria-live="assertive" style={{ overflow: 'hidden' }}>
      <div style={{ borderRadius: 12, background: bannerBg, color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>
          <CheckCircle2 size={16} aria-hidden="true" style={{ marginRight: 7, verticalAlign: -2 }} />
          {isIn ? 'Clocked In' : 'Clocked Out'}
        </span>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{result.time}</span>
      </div>

      {(result.greeting?.text) && (
        <div style={{ padding: '10px 14px', background: isIn ? '#F0F7F2' : '#EFF4FF', fontSize: 13, fontWeight: 600, color: isIn ? '#15603A' : '#3730A3' }}>
          {result.greeting.emoji} {result.greeting.text}
        </div>
      )}

      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontWeight: 800, color: '#1E3027', fontSize: 16 }}>{result.employee}</div>
        <div style={{ color: '#6B8070', fontSize: 13, marginTop: 2 }}>{result.department}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
          <div className="status-meta">
            <Calendar size={14} aria-hidden="true" />
            <span>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <div className="status-meta">
            <Clock size={14} aria-hidden="true" />
            <span><strong>{isIn ? 'In' : 'Out'}:</strong> {result.time}</span>
          </div>
          {result.verification?.verified && (
            <div className="status-meta" style={{ color: '#1A8A35', fontWeight: 600 }}>
              <ScanLine size={14} aria-hidden="true" />
              <span>On-site verified · {result.verification.method_label || 'location check'}</span>
            </div>
          )}
        </div>
        <span className={`chip ${result.status === 'Late' ? 'amber' : result.status === 'Early Departure' ? 'red' : 'green'}`} style={{ marginTop: 12 }}>
          {result.status}
        </span>
        {!isIn && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="status-meta">
              <Clock size={13} aria-hidden="true" /> Worked today: <strong style={{ color: '#1E3027' }}>{fmtHM(result.worked_minutes)}</strong>
            </div>
            {Number(result.daily_overtime_minutes) > 0 && (
              <div className="status-meta">
                <Award size={13} aria-hidden="true" /> Overtime: <strong style={{ color: '#2DB54A' }}>+{fmtHM(result.daily_overtime_minutes)}</strong>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminScan;