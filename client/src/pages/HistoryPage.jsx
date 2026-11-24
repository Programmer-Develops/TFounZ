import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { History, BarChart3, Film, Tv } from 'lucide-react';
import { apiFetch } from '../utils/api';

export default function HistoryPage() {
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
    <div className="container page-shell">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <History size={24} color="var(--accent-gold)" /> Show &amp; Meeting Archive
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: 4 }}>
            Review every hosted or attended show, view MeetLite attendance aggregations, or remix clips.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {['all', 'live', 'scheduled', 'ended'].map((s) => (
            <button
              key={s}
              type="button"
              className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(s)}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading archive...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No shows match this filter yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="studio-table">
              <thead>
                <tr>
                  <th>Show Title</th>
                  <th>Code</th>
                  <th>Format &amp; AI Host</th>
                  <th>Status</th>
                  <th>Guests</th>
                  <th>Messages</th>
                  <th>Rapid-Fire Peak</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m._id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{m.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Host: {m.host?.name || 'Unknown'}
                      </div>
                    </td>
                    <td className="mono">{m.code}</td>
                    <td>
                      <div>{m.showFormat}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        {m.aiPersona?.name}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${m.status === 'live' ? 'badge-live' : m.status === 'ended' ? 'badge-gold' : 'badge-cyan'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td>{m.uniqueParticipantCount || 0}</td>
                    <td>{m.messageCount || 0}</td>
                    <td>{m.rapidFireHighScore || 0} pts</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {m.status !== 'ended' && (
                          <Link to={`/room/${m.code}`} className="btn btn-primary btn-sm">
                            <Tv size={13} /> Join
                          </Link>
                        )}
                        <Link to={`/meetings/${m._id}/report`} className="btn btn-ghost btn-sm">
                          <BarChart3 size={13} /> Attendance
                        </Link>
                        <Link to={`/studio/${m._id}`} className="btn btn-ghost btn-sm">
                          <Film size={13} /> Studio
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
