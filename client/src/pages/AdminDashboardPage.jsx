import React, { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { Badge, ErrorBanner, LoadingState } from '../components/ui/Primitives';

export default function AdminDashboardPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sRes, uRes, mRes] = await Promise.all([
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/users'),
        apiFetch('/api/admin/meetings'),
      ]);
      setStats(sRes.data);
      setUsers(uRes.data.users || []);
      setMeetings(mRes.data.meetings || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRoleChange = async (userId, role) => {
    try {
      await apiFetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      toast(`Role updated to ${role}`, 'success');
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteMeeting = async (meetingId) => {
    try {
      await apiFetch(`/api/admin/meetings/${meetingId}`, { method: 'DELETE' });
      toast('Show removed from studio records', 'info');
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <LoadingState label="Loading admin telemetry..." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          RBAC Protected · Administration
        </div>
        <h1 style={{ fontSize: '1.65rem' }}>Platform Operations</h1>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {stats && (
        <div className="kpi-strip">
          <div className="kpi-cell">
            <div className="eyebrow">Total Accounts</div>
            <div className="tabular" style={{ fontSize: '1.45rem', fontWeight: 600, marginTop: 6 }}>
              {stats.totals.users}
            </div>
          </div>
          <div className="kpi-cell">
            <div className="eyebrow">Total Shows</div>
            <div className="tabular" style={{ fontSize: '1.45rem', fontWeight: 600, marginTop: 6 }}>
              {stats.totals.meetings}
            </div>
          </div>
          <div className="kpi-cell">
            <div className="eyebrow">Watch Minutes</div>
            <div className="tabular" style={{ fontSize: '1.45rem', fontWeight: 600, marginTop: 6, color: 'var(--status-positive)' }}>
              {stats.totals.totalStudioMinutes} min
            </div>
          </div>
          <div className="kpi-cell">
            <div className="eyebrow">Stored Messages</div>
            <div className="tabular" style={{ fontSize: '1.45rem', fontWeight: 600, marginTop: 6, color: 'var(--accent)' }}>
              {stats.totals.messages}
            </div>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ alignItems: 'start', gap: 20 }}>
        <div className="surface">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, fontSize: '0.94rem' }}>
            User Role Access Control
          </div>
          <div className="table-wrap">
            <table className="editorial-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                    </td>
                    <td>
                      <select
                        className="select"
                        style={{ height: 32, width: 132, fontSize: '0.8rem' }}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u._id, e.target.value)}
                      >
                        <option value="host">host</option>
                        <option value="participant">participant</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="surface">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, fontSize: '0.94rem' }}>
            Studio Moderation
          </div>
          <div className="table-wrap">
            <table className="editorial-table">
              <thead>
                <tr>
                  <th>Show</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => (
                  <tr key={m._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{m.title}</div>
                      <div className="mono" style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                        {m.code} · {m.host?.name}
                      </div>
                    </td>
                    <td>
                      <Badge tone={m.status === 'live' ? 'live' : 'neutral'}>{m.status}</Badge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteMeeting(m._id)}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
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
}
