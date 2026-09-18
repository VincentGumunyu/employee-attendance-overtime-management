import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera, CameraOff, ScanLine, Calendar, Clock, Award, KeyRound,
  AlertCircle, RefreshCw, Lock, CheckCircle2, Activity, UserRound,
  WifiOff, MapPin, Info
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

const timeAgo = (iso) => {
  if (!iso) return '';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
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
  const employeeName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Administrator';

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
  const streamRef = useRef(null);
  const lastValueRef = useRef('');
  const busyRef = useRef(false);
  const readerRef = useRef(null);
  const scanOnRef = useRef(false);

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
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopStream = () => {
    scanOnRef.current = false;
    try { readerRef.current?.reset(); } catch { /* ignore */ }
    readerRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.srcObject = null; } catch { /* ignore */ }
    }
  };

  const startCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraSupported(false);
      setError('Camera scanning is not supported by this device. Use the manual entry below.');
      return;
    }
    setCameraStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      scanOnRef.current = true;
      setCameraOn(true);
      const tick = async () => {
        if (!scanOnRef.current) return;
        if (!busyRef.current) {
          try {
            const videoEl = videoRef.current;
            if (videoEl && videoEl.videoWidth > 0 && !videoEl.paused) {
              const result = reader.decode(videoEl);
              if (result) {
                const value = (result.getText() || '').trim().toUpperCase();
                if (value && value !== lastValueRef.current) {
                  lastValueRef.current = value;
                  await handleScan(value);
                }
              }
            }
          } catch {
            // NotFound or frame not ready — keep scanning
          }
        }
        setTimeout(tick, 200);
      };
      tick();
    } catch (err) {
      scanOnRef.current = false;
      stopStream();
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
    stopStream();
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
    <div className="pt-page">
      {/* Page header */}
      <div className="pt-head">
        <div>
          <h1 className="pt-title">Scan to Work</h1>
          <p className="pt-sub">
            Clock in / clock out like staff by scanning the gate barcode on your phone.
          </p>
        </div>
        <div className="pt-actions">
          {scanResult && (
            <button type="button" className="btn btn-outline-secondary d-flex align-items-center gap-1" style={{ minHeight: 42 }} onClick={resetScanner}>
              <RefreshCw size={15} /> New Scan
            </button>
          )}
          <button type="button" className="btn btn-outline-secondary d-flex align-items-center gap-1" style={{ minHeight: 42 }} onClick={() => { loadStats(); loadHistory(); }} disabled={statsLoading}>
            <RefreshCw size={14} className={statsLoading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="eh-grid">
        {/* ---- Status / result (mobile: first) ---- */}
        <section className="eh-greeting" aria-label="Attendance status">
          {scanResult ? (
            <div className="rise-in">
              <ResultCard result={scanResult} />
            </div>
          ) : (
            <div className="panel status-card" aria-live="polite">
              <div className="status-top">
                <span className="status-avatar">
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(employeeName)}&background=2DB54A&color=fff&bold=true&size=64`}
                    alt=""
                    style={{ width: 46, height: 46, borderRadius: 12, objectFit: 'cover' }}
                  />
                </span>
                <div>
                  <div className="status-greet">
                    <strong>{greetingByHour()}, {firstName}.</strong>
                  </div>
                  {!statsLoading && (
                    <div style={{ fontSize: 12.5, color: '#6B8070' }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                  )}
                </div>
              </div>

              {statsLoading ? (
                <div className="loading-block" style={{ justifyContent: 'flex-start', padding: '18px 0 8px' }}>
                  <div className="spinner-border spinner-border-sm" style={{ color: '#2DB54A' }} role="status" aria-label="Loading status" />
                </div>
              ) : statusKind === 'in' ? (
                <div className="status-line green">
                  <span className="status-dot green" aria-hidden="true" />
                  <span>You're clocked in <Activity size={15} aria-hidden="true" style={{ verticalAlign: -2 }} /></span>
                </div>
              ) : statusKind === 'out' ? (
                <div className="status-line neutral">
                  <span className="status-dot gray" aria-hidden="true" />
                  <span>You're clocked out</span>
                </div>
              ) : (
                <div className="status-line amber">
                  <span className="status-dot amber" aria-hidden="true" />
                  <span>You haven't clocked in today</span>
                </div>
              )}

              {!statsLoading && statusKind === 'in' && (
                <>
                  <div className="status-meta">
                    <Calendar size={14} aria-hidden="true" /> Started at <strong style={{ color: '#1E3027' }}>{fmtTime(today.checked_in)}</strong>
                  </div>
                  <div className="status-meta">
                    <Clock size={14} aria-hidden="true" /> {timeAgo(today.checked_in)}
                  </div>
                  <div className="status-meta" style={{ marginTop: 8, color: '#3D5245' }}>
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
            </div>
          )}
        </section>

        {/* ---- Scanner (desktop: first) ---- */}
        <section className="eh-scanner" aria-label="Barcode scanner">
          <div className="panel panel-pad">
            <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: 14 }}>
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

            {error && (
              <div className={`eh-error ${classifyError(error)}`} role="alert" aria-live="polite" style={{ marginTop: 14 }}>
                {classifyError(error) === 'warn' ? <Lock size={16} aria-hidden="true" /> : <AlertCircle size={16} aria-hidden="true" />}
                <span>{error}</span>
              </div>
            )}

            {/* Manual entry */}
            <div className="manual-entry">
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
        </section>

        {/* ---- Help + recent attendance (mobile: last) ---- */}
        <aside className="eh-help" aria-label="How to clock in">
          <div className="panel help-card">
            <span className="panel-title" style={{ fontSize: 15, marginBottom: 14, display: 'flex' }}>
              <Info size={17} color="#2DB54A" aria-hidden="true" style={{ marginRight: 8 }} /> How to clock in / out
            </span>
            <div className="help-steps">
              <div className="help-step">
                <span className="help-step-num" aria-hidden="true">1</span>
                <span className="help-step-text">
                  <strong>Sign in on your phone</strong> — you're already signed in here.
                </span>
              </div>
              <div className="help-step">
                <span className="help-step-num" aria-hidden="true">2</span>
                <span className="help-step-text">
                  <strong>Point your camera</strong> at the barcode shown on the security terminal screen.
                </span>
              </div>
              <div className="help-step">
                <span className="help-step-num" aria-hidden="true">3</span>
                <span className="help-step-text">
                  <strong>When the line turns green</strong>, your clock-in or clock-out has been recorded.
                </span>
              </div>
            </div>
            <div className="help-tip">
              <WifiOff size={15} color="#456255" aria-hidden="true" style={{ minWidth: 15, marginTop: 1 }} />
              <span>
                If the camera won't open, tap in the barcode field below the scanner and press <strong>Submit</strong>.
              </span>
            </div>
            <div className="help-tip">
              <MapPin size={15} color="#456255" aria-hidden="true" style={{ minWidth: 15, marginTop: 1 }} />
              <span>
                For security, clock-in/out only works while you are on the company premises. Keep <strong>location (GPS)</strong> on and stay connected to the <strong>office Wi-Fi</strong>.
              </span>
            </div>
            <div className="help-tip">
              <UserRound size={15} color="#456255" aria-hidden="true" style={{ minWidth: 15, marginTop: 1 }} />
              <span>
                Your attendance is recorded under your admin profile and appears in the Employees list.
              </span>
            </div>
          </div>

          {/* Recent attendance */}
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-head d-flex justify-content-between align-items-center">
              <span className="panel-title">My Recent Attendance</span>
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
        </aside>
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