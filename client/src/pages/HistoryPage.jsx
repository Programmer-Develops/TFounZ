import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Archive, BarChart3, Film, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import PersonaPortrait from '../components/ui/PersonaPortrait';
import { Badge, EmptyState, ErrorBanner, LoadingState } from '../components/ui/Primitives';

export default function HistoryPage() {
  const { isHost } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/meetings/history');
        setMeetings(res?.data?.meetings || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = meetings.filter((m) => (filter === 'all' ? true : m.status === filter));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Broadcast Ledger
          </div>
          <h1 style={{ fontSize: '1.65rem' }}>Show Archive &amp; Reports</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 4 }}>
            Complete history of hosted and attended shows with MongoDB attendance reports.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'live', 'scheduled', 'ended'].map((s) => (
            <button
              key={s}
              type="button"
              className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      <div className="surface">
        {loading ? (
          <LoadingState label="Loading show archive..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="No shows in this filter"
            description="Create a new show or switch status filters to browse past episodes."
          />
        ) : (
          <div className="table-wrap">
            <table className="editorial-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 210 }}>Show</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Code</th>
                  <th style={{ whiteSpace: 'nowrap' }}>AI Talent</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Activity</th>
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m._id}>
                    <td>
                      <div style={{ fontWeight: 600, lineHeight: 1.35 }}>{m.title}</div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {m.host?.name || 'Host'} · {new Date(m.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {m.code}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <PersonaPortrait styleKey={m.aiPersona?.avatarStyle} size={26} />
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{m.aiPersona?.name}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            AI {m.aiRole || 'host'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Badge
                        tone={m.status === 'live' ? 'live' : m.status === 'ended' ? 'neutral' : 'accent'}
                      >
                        {m.status}
                      </Badge>
                    </td>
                    <td className="tabular" style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <div>{m.uniqueParticipantCount || 0} guests · {m.messageCount || 0} turns</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Peak {m.rapidFireHighScore || 0} pts
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 5 }}>
                        {m.status !== 'ended' && (
                          <Link to={`/room/${m.code}`} className="btn btn-primary btn-sm">
                            <Play size={12} /> Join
                          </Link>
                        )}
                        {isHost && (
                          <Link to={`/meetings/${m._id}/report`} className="btn btn-secondary btn-sm">
                            <BarChart3 size={12} /> Report
                          </Link>
                        )}
                        <Link to={`/studio/${m._id}`} className="btn btn-ghost btn-sm">
                          <Film size={12} /> Studio
                        </Link>
                      </div>
                    </td>
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
