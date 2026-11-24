import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BarChart3, Download, ArrowLeft } from 'lucide-react';
import { apiFetch } from '../utils/api';

export default function AttendanceReportPage() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/api/meetings/${id}/attendance-report`);
        setReport(res.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const exportCsv = () => {
    if (!report?.participants) return;
    const headers = [
      'Name',
      'Email',
      'Role',
      'First Join Time',
      'Last Leave Time',
      'Total Minutes',
      'Sessions',
      'Hands Raised',
      'Messages Sent',
      'Rapid Fire Score',
    ];
    const rows = report.participants.map((p) => [
      `"${p.name}"`,
      `"${p.email}"`,
      p.role,
      new Date(p.firstJoinTime).toISOString(),
      new Date(p.lastLeaveTime).toISOString(),
      p.totalMinutes,
      p.sessionsCount,
      p.raisedHandCount,
      p.messagesSent,
      p.rapidFireScore,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${report.meeting.code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="container page-shell">
        <p style={{ color: 'var(--text-secondary)' }}>Running MongoDB attendance aggregation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container page-shell">
        <div className="alert-error">{error}</div>
        <Link to="/history" className="btn btn-ghost btn-sm" style={{ marginTop: 14 }}>
          <ArrowLeft size={14} /> Back to Shows
        </Link>
      </div>
    );
  }

  const { meeting, summary, participants } = report;

  return (
    <div className="container page-shell">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span className="badge badge-gold" style={{ marginBottom: 8 }}>
            MeetLite Aggregation Report · {meeting.code}
          </span>
          <h1 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart3 size={24} color="var(--accent-gold)" /> {meeting.title}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </button>
          <Link to="/history" className="btn btn-ghost btn-sm">
            <ArrowLeft size={15} /> Back
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card card-compact">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Participants</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 4 }}>{summary.totalParticipants}</div>
        </div>
        <div className="card card-compact">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Combined Watch Minutes</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 4, color: 'var(--accent-emerald)' }}>
            {summary.totalMinutesAll} min
          </div>
        </div>
        <div className="card card-compact">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Messages Exchanged</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 4, color: 'var(--accent-cyan)' }}>
            {summary.totalMessages}
          </div>
        </div>
        <div className="card card-compact">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Peak Rapid-Fire Score</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 4, color: 'var(--accent-gold)' }}>
            {summary.peakRapidFireScore} pts
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1.2rem', marginBottom: 14 }}>Per-Participant Attendance Breakdown</h2>
        {participants.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No attendance records captured for this show yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="studio-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Role</th>
                  <th>Join Time</th>
                  <th>Leave Time</th>
                  <th>Total Minutes</th>
                  <th>Hands Raised</th>
                  <th>Messages</th>
                  <th>Rapid-Fire</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.userId}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.email}</div>
                    </td>
                    <td>
                      <span className="badge badge-violet">{p.role}</span>
                    </td>
                    <td>{new Date(p.firstJoinTime).toLocaleString()}</td>
                    <td>
                      {p.stillActive ? (
                        <span className="badge badge-live">Active Now</span>
                      ) : (
                        new Date(p.lastLeaveTime).toLocaleString()
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>
                      {p.totalMinutes} min
                    </td>
                    <td>{p.raisedHandCount}</td>
                    <td>{p.messagesSent}</td>
                    <td>{p.rapidFireScore} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
