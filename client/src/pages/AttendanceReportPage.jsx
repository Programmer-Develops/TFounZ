import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Download, ArrowLeft, BarChart3 } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { Badge, EmptyState, ErrorBanner, LoadingState } from '../components/ui/Primitives';

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

  if (loading) return <LoadingState label="Aggregating session attendance..." />;
  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ErrorBanner message={error} />
        <Link to="/history" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={14} /> Back to Archive
        </Link>
      </div>
    );
  }

  const { meeting, summary, participants } = report;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            MongoDB Aggregation Report · <span className="mono">{meeting.code}</span>
          </div>
          <h1 style={{ fontSize: '1.65rem' }}>{meeting.title}</h1>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={exportCsv}>
            <Download size={14} /> Export CSV
          </button>
          <Link to="/history" className="btn btn-secondary btn-sm">
            <ArrowLeft size={14} /> Archive
          </Link>
        </div>
      </div>

      <div className="kpi-strip">
        <div className="kpi-cell">
          <div className="eyebrow">Participants</div>
          <div className="tabular" style={{ fontSize: '1.45rem', fontWeight: 600, marginTop: 6 }}>
            {summary.totalParticipants}
          </div>
        </div>
        <div className="kpi-cell">
          <div className="eyebrow">Total Watch Time</div>
          <div className="tabular" style={{ fontSize: '1.45rem', fontWeight: 600, marginTop: 6, color: 'var(--status-positive)' }}>
            {summary.totalMinutesAll} min
          </div>
        </div>
        <div className="kpi-cell">
          <div className="eyebrow">Messages</div>
          <div className="tabular" style={{ fontSize: '1.45rem', fontWeight: 600, marginTop: 6 }}>
            {summary.totalMessages}
          </div>
        </div>
        <div className="kpi-cell">
          <div className="eyebrow">Rapid-Fire Peak</div>
          <div className="tabular" style={{ fontSize: '1.45rem', fontWeight: 600, marginTop: 6, color: 'var(--accent)' }}>
            {summary.peakRapidFireScore} pts
          </div>
        </div>
      </div>

      <div className="surface">
        {participants.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No attendance logs yet"
            description="Participants are logged automatically as they join and leave the studio room."
          />
        ) : (
          <div className="table-wrap">
            <table className="editorial-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Role</th>
                  <th>First Join</th>
                  <th>Last Leave</th>
                  <th>Duration</th>
                  <th>Hands</th>
                  <th>Messages</th>
                  <th>Rapid-Fire</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.userId}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.email}</div>
                    </td>
                    <td>
                      <Badge>{p.role}</Badge>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {new Date(p.firstJoinTime).toLocaleString()}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {p.stillActive ? (
                        <Badge tone="live">Active</Badge>
                      ) : (
                        new Date(p.lastLeaveTime).toLocaleString()
                      )}
                    </td>
                    <td className="tabular" style={{ fontWeight: 600, color: 'var(--status-positive)' }}>
                      {p.totalMinutes} min
                    </td>
                    <td className="tabular">{p.raisedHandCount}</td>
                    <td className="tabular">{p.messagesSent}</td>
                    <td className="tabular">{p.rapidFireScore} pts</td>
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
