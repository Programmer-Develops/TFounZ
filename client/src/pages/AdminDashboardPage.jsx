import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Trash2 } from 'lucide-react';
import { apiFetch } from '../utils/api';

export default function AdminDashboardPage() {
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
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteMeeting = async (meetingId) => {
    try {
      await apiFetch(`/api/admin/meetings/${meetingId}`, { method: 'DELETE' });
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="container page-shell">
        <p style={{ color: 'var(--text-secondary)' }}>Loading Admin RBAC Console...</p>
      </div>
    );
  }

  return (
    <div className="container page-shell">
      <div style={{ marginBottom: 20 }}>
        <span className="badge badge-violet" style={{ marginBottom: 8 }}>
          RBAC Protected · Admin Only
        </span>
        <h1 style={{ fontSize: '1.85rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={24} color="var(--accent-violet)" /> TFounZ Admin Console
        </h1>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {stats && (
        <div className="grid-4" style={{ marginBottom: 22 }}>
          <div className="card card-compact">
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Users</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 4 }}>{stats.totals.users}</div>
          </div>
          <div className="card card-compact">
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Shows</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 4 }}>{stats.totals.meetings}</div>
          </div>
          <div className="card card-compact">
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Watch Minutes</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 4, color: 'var(--accent-emerald)' }}>
              {stats.totals.totalStudioMinutes} min
            </div>
          </div>
          <div className="card card-compact">
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Messages Stored</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 4, color: 'var(--accent-cyan)' }}>
              {stats.totals.messages}
            </div>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h2 style={{ fontSize: '1.2rem', marginBottom: 14 }}>User Roles Management</h2>
          <div className="table-wrap">
            <table className="studio-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{u.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{u.email}</div>
                    </td>
                    <td>
                      <select
                        className="select"
                        style={{ width: 145, padding: '6px 10px' }}
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

        <div className="card">
          <h2 style={{ fontSize: '1.2rem', marginBottom: 14 }}>All Studio Shows</h2>
          <div className="table-wrap">
            <table className="studio-table">
              <thead>
                <tr>
                  <th>Show</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => (
                  <tr key={m._id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{m.title}</div>
                      <div className="mono" style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        {m.code} · {m.host?.name}
                      </div>
                    </td>
                    <td>
                      <span className="badge">{m.status}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-crimson btn-sm"
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
