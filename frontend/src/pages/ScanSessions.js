import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';

const parseCartonSeq = (barcode) => {
  const match = String(barcode || '').match(/-(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
};

const computeSkips = (entries) => {
  const seqs = entries
    .filter(e => parseInt(e.success) === 1 && e.carton_seq !== null && e.carton_seq !== undefined)
    .map(e => parseInt(e.carton_seq));
  if (seqs.length < 2) return [];
  const sorted = [...seqs].sort((a, b) => a - b);
  const min = sorted[0], max = sorted[sorted.length - 1];
  const scannedSet = new Set(sorted);
  const gaps = [];
  for (let i = min; i <= max; i++) {
    if (!scannedSet.has(i)) gaps.push(i);
  }
  return gaps;
};

const formatGaps = (gaps) => {
  if (!gaps.length) return '';
  const ranges = [];
  let start = gaps[0], end = gaps[0];
  for (let i = 1; i < gaps.length; i++) {
    if (gaps[i] === end + 1) {
      end = gaps[i];
    } else {
      ranges.push(start === end ? `#${start}` : `#${start}–${end}`);
      start = end = gaps[i];
    }
  }
  ranges.push(start === end ? `#${start}` : `#${start}–${end}`);
  return ranges.join(', ');
};

const fmt = (dt) =>
  dt ? new Date(dt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

const generateTxt = (session, entries) => {
  const successEntries = entries.filter(e => parseInt(e.success) === 1);
  const failedEntries  = entries.filter(e => parseInt(e.success) === 0);
  const gaps = computeSkips(entries);
  const line    = '='.repeat(50);
  const divider = '-'.repeat(50);

  let txt = `${line}\n`;
  txt += `SCAN SESSION REPORT — FTM Garments\n`;
  txt += `${line}\n`;
  txt += `PO Number:      ${session.po_number}\n`;
  txt += `Date:           ${session.session_date}\n`;
  txt += `Operator:       ${session.operator_name || 'Unknown'}\n`;
  txt += `Started:        ${fmt(session.started_at)}\n`;
  txt += `Last activity:  ${fmt(session.last_activity_at)}\n`;
  txt += `${divider}\n`;
  txt += `SUMMARY\n`;
  txt += `  Total scanned : ${session.total_scanned}\n`;
  txt += `  Successful    : ${session.total_success}\n`;
  txt += `  Failed        : ${session.total_failed}\n`;
  txt += `  Sequence gaps : ${gaps.length ? `${gaps.length} missing (${formatGaps(gaps)})` : 'None'}\n`;
  txt += `${divider}\n`;

  if (successEntries.length > 0) {
    txt += `SCANNED SUCCESSFULLY (${successEntries.length}):\n`;
    successEntries.forEach(e => {
      const seq    = e.carton_seq !== null ? `#${String(e.carton_seq).padStart(3, ' ')}` : '    ';
      const action = e.action === 'enter' ? '[Enter]' : '[Exit ]';
      txt += `  ${seq}  ${fmt(e.scanned_at)}  ${e.barcode}  ${action}\n`;
    });
    txt += `${divider}\n`;
  }

  if (gaps.length > 0) {
    txt += `GAPS IN SEQUENCE (${gaps.length} missing):\n`;
    txt += `  ${formatGaps(gaps)}\n`;
    txt += `${divider}\n`;
  }

  if (failedEntries.length > 0) {
    txt += `FAILED SCANS (${failedEntries.length}):\n`;
    failedEntries.forEach(e => {
      const seq    = e.carton_seq !== null ? `#${String(e.carton_seq).padStart(3, ' ')}` : '    ';
      const action = e.action === 'enter' ? '[Enter]' : '[Exit ]';
      txt += `  ${seq}  ${fmt(e.scanned_at)}  ${e.barcode}  ${action}  ${e.error_message || ''}\n`;
    });
    txt += `${divider}\n`;
  }

  txt += `Generated: ${new Date().toLocaleString('en-ZA')}\n`;
  txt += `${line}\n`;
  return txt;
};

const downloadTxt = (session, entries) => {
  const txt  = generateTxt(session, entries);
  const blob = new Blob([txt], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `scan-session-${session.po_number}-${session.session_date}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

const ScanSessions = () => {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate]               = useState(today);
  const [sessions, setSessions]       = useState([]);
  const [expandedId, setExpandedId]   = useState(null);
  const [entries, setEntries]         = useState({});
  const [loading, setLoading]         = useState(false);
  const [loadingEntry, setLoadingEntry] = useState(null);
  const [error, setError]             = useState(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/scan_sessions.php`, {
        params: { date },
        withCredentials: true
      });
      setSessions(res.data.sessions || []);
    } catch {
      setError('Failed to load sessions. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const loadEntries = async (sessionId) => {
    if (entries[sessionId]) return entries[sessionId];
    setLoadingEntry(sessionId);
    try {
      const res = await axios.get(`${API_BASE_URL}/scan_sessions.php`, {
        params: { id: sessionId },
        withCredentials: true
      });
      const data = res.data.entries || [];
      setEntries(prev => ({ ...prev, [sessionId]: data }));
      return data;
    } catch {
      setEntries(prev => ({ ...prev, [sessionId]: [] }));
      return [];
    } finally {
      setLoadingEntry(null);
    }
  };

  const toggleExpand = async (sessionId) => {
    if (expandedId === sessionId) { setExpandedId(null); return; }
    setExpandedId(sessionId);
    await loadEntries(sessionId);
  };

  const handleDownload = async (session) => {
    const data = await loadEntries(session.id);
    downloadTxt(session, data);
  };

  // Group sessions by PO
  const sessionsByPo = sessions.reduce((acc, s) => {
    if (!acc[s.po_number]) acc[s.po_number] = [];
    acc[s.po_number].push(s);
    return acc;
  }, {});

  const totalScanned  = sessions.reduce((s, x) => s + parseInt(x.total_scanned),  0);
  const totalSuccess  = sessions.reduce((s, x) => s + parseInt(x.total_success),  0);
  const totalFailed   = sessions.reduce((s, x) => s + parseInt(x.total_failed),   0);

  return (
    <div className="py-2">
      <button className="btn btn-sm btn-outline-secondary mb-3" onClick={() => navigate(-1)}>
        <i className="bi bi-arrow-left me-1"></i> Back
      </button>

      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
        <h1 className="text-gradient mb-0">
          <i className="bi bi-journal-text me-2"></i>Scan Sessions
        </h1>
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted small mb-0">Date:</label>
          <input
            type="date"
            className="form-control form-control-sm"
            value={date}
            onChange={e => { setDate(e.target.value); setExpandedId(null); setEntries({}); }}
            style={{ width: '160px' }}
          />
          <button className="btn btn-sm btn-outline-primary" onClick={fetchSessions} title="Refresh">
            <i className="bi bi-arrow-clockwise"></i>
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Day summary strip */}
      {sessions.length > 0 && (
        <div className="row g-3 mb-4">
          {[
            { label: 'POs scanned', value: Object.keys(sessionsByPo).length, icon: 'bi-receipt', color: '#0d6efd' },
            { label: 'Total scanned', value: totalScanned, icon: 'bi-upc-scan', color: '#6c757d' },
            { label: 'Successful', value: totalSuccess, icon: 'bi-check-circle', color: '#198754' },
            { label: 'Failed', value: totalFailed, icon: 'bi-x-circle', color: '#dc3545' },
          ].map(card => (
            <div className="col-6 col-md-3" key={card.label}>
              <div className="modern-card h-100 p-3">
                <div className="d-flex align-items-center gap-2">
                  <i className={`bi ${card.icon} fs-4`} style={{ color: card.color }}></i>
                  <div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: card.color }}>{card.value}</div>
                    <div style={{ fontSize: '11px', color: '#6c757d' }}>{card.label}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-5 text-muted">
          <div className="spinner-border spinner-border-sm me-2"></div>
          Loading sessions…
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-journal-x fs-1 d-block mb-3"></i>
          <p className="mb-1">No scan sessions recorded for <strong>{date}</strong></p>
          <small>Sessions are created automatically when cartons are scanned.</small>
        </div>
      ) : (
        Object.entries(sessionsByPo)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([po, poSessions]) => (
            <div key={po} className="modern-card mb-4">
              <div className="modern-card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className="bi bi-receipt me-2"></i>{po}
                </h5>
                <small className="text-muted">
                  {poSessions.reduce((s, x) => s + parseInt(x.total_success), 0)} scanned successfully
                </small>
              </div>

              <div className="modern-card-body p-0">
                {poSessions.map(session => {
                  const isExpanded    = expandedId === session.id;
                  const sessionEntries = entries[session.id] || [];
                  const gaps = isExpanded ? computeSkips(sessionEntries) : [];
                  const hasGaps = isExpanded && gaps.length > 0;
                  const allClear = isExpanded && gaps.length === 0 &&
                    sessionEntries.filter(e => parseInt(e.success) === 1 && e.carton_seq !== null).length >= 2;

                  return (
                    <div key={session.id} className="border-bottom">
                      {/* Session row */}
                      <div
                        className="d-flex align-items-center justify-content-between p-3"
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggleExpand(session.id)}
                      >
                        <div className="d-flex align-items-center gap-3">
                          <i className={`bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'} text-muted`}></i>
                          <div>
                            <div className="fw-semibold">
                              {fmt(session.started_at)} — {fmt(session.last_activity_at)}
                            </div>
                            <small className="text-muted">
                              <i className="bi bi-person me-1"></i>{session.operator_name || 'Unknown'}
                            </small>
                          </div>
                        </div>

                        <div className="d-flex align-items-center gap-3 flex-wrap justify-content-end">
                          <div className="text-center" style={{ minWidth: '42px' }}>
                            <div className="fw-bold text-success">{session.total_success}</div>
                            <small className="text-muted" style={{ fontSize: '10px' }}>OK</small>
                          </div>
                          <div className="text-center" style={{ minWidth: '42px' }}>
                            <div className="fw-bold text-danger">{session.total_failed}</div>
                            <small className="text-muted" style={{ fontSize: '10px' }}>Failed</small>
                          </div>
                          <div className="text-center" style={{ minWidth: '42px' }}>
                            <div className="fw-bold">{session.total_scanned}</div>
                            <small className="text-muted" style={{ fontSize: '10px' }}>Total</small>
                          </div>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={e => { e.stopPropagation(); handleDownload(session); }}
                            title="Download TXT report"
                          >
                            <i className="bi bi-download me-1"></i>TXT
                          </button>
                        </div>
                      </div>

                      {/* Expanded entries */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1">
                          {loadingEntry === session.id ? (
                            <div className="text-center py-3 text-muted">
                              <div className="spinner-border spinner-border-sm me-2"></div>
                              Loading entries…
                            </div>
                          ) : (
                            <>
                              {hasGaps && (
                                <div className="alert alert-warning d-flex align-items-start gap-2 py-2 px-3 mb-3">
                                  <i className="bi bi-exclamation-triangle-fill mt-1"></i>
                                  <div>
                                    <strong>{gaps.length} sequence gap{gaps.length !== 1 ? 's' : ''} detected:</strong>
                                    {' '}{formatGaps(gaps)}
                                    <div className="small text-muted mt-1">
                                      These carton numbers are missing from the scanned range.
                                    </div>
                                  </div>
                                </div>
                              )}
                              {allClear && (
                                <div className="alert alert-success py-2 px-3 mb-3">
                                  <i className="bi bi-check-circle me-2"></i>
                                  No sequence gaps — all cartons in range were scanned.
                                </div>
                              )}
                              <div className="table-responsive">
                                <table className="table table-sm table-hover mb-0" style={{ fontSize: '13px' }}>
                                  <thead className="table-light">
                                    <tr>
                                      <th>Time</th>
                                      <th>#</th>
                                      <th>Barcode</th>
                                      <th>Action</th>
                                      <th>Status</th>
                                      <th>Note</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sessionEntries.map((entry, i) => (
                                      <tr key={i} className={parseInt(entry.success) ? '' : 'table-danger'}>
                                        <td className="text-muted">{fmt(entry.scanned_at)}</td>
                                        <td>
                                          {entry.carton_seq !== null
                                            ? <span className="fw-bold">#{entry.carton_seq}</span>
                                            : <span className="text-muted">—</span>}
                                        </td>
                                        <td className="fw-medium">{entry.barcode}</td>
                                        <td>
                                          <span className={`badge ${entry.action === 'enter' ? 'bg-primary' : 'bg-success'}`}>
                                            {entry.action}
                                          </span>
                                        </td>
                                        <td>
                                          {parseInt(entry.success)
                                            ? <span className="badge bg-success"><i className="bi bi-check"></i> OK</span>
                                            : <span className="badge bg-danger"><i className="bi bi-x"></i> Fail</span>}
                                        </td>
                                        <td className="text-danger" style={{ maxWidth: '220px', fontSize: '11px' }}>
                                          {entry.error_message || ''}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
      )}
    </div>
  );
};

export default ScanSessions;
