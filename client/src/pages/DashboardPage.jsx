import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Tv,
  PlusCircle,
  RefreshCw,
  LogIn,
  BarChart3,
  Film,
  Sparkles,
  Users,
  Mic,
  Star,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStudio } from '../context/StudioContext';
import { apiFetch } from '../utils/api';

export default function DashboardPage() {
  const { user, isHost } = useAuth();
  const { presets, guestPresets, voices, health, refreshHealth } = useStudio();
  const navigate = useNavigate();

  const [joinCode, setJoinCode] = useState('');
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [experienceTab, setExperienceTab] = useState('host'); // 'host' | 'guest'

  const [form, setForm] = useState({
    title: '',
    description: '',
    showFormat: 'chai-with-ai',
    mode: 'ai-talkshow',
    aiRole: 'host',
    customVoiceId: '',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const loadRecent = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiFetch('/api/meetings/history');
      setRecentMeetings(res?.data?.meetings || []);
    } catch {
      // handled softly
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const displayedPresets = experienceTab === 'guest' ? guestPresets : presets;

  const switchExperience = (tab) => {
    setExperienceTab(tab);
    const list = tab === 'guest' ? guestPresets : presets;
    const first = list[0];
    if (first) {
      setForm((prev) => ({
        ...prev,
        showFormat: first.id,
        mode: first.defaultMode || 'ai-talkshow',
        aiRole: first.defaultAiRole || (tab === 'guest' ? 'guest' : 'host'),
        customVoiceId: first.sounzVoiceId || '',
        title: `${first.showTitle} ft. ${user?.name || 'Guest'}`,
      }));
    }
  };

  const handlePresetPick = (preset) => {
    setForm((prev) => ({
      ...prev,
      showFormat: preset.id,
      mode: preset.defaultMode || 'ai-talkshow',
      aiRole: preset.defaultAiRole || (experienceTab === 'guest' ? 'guest' : 'host'),
      customVoiceId: preset.sounzVoiceId,
      title: `${preset.showTitle} ft. ${user?.name || 'Guest'}`,
    }));
  };

  const handleCreateShow = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await apiFetch('/api/meetings', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      const meeting = res?.data?.meeting;
      if (meeting?.code) {
        navigate(`/room/${meeting.code}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinCode = (e) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (!cleaned) return;
    navigate(`/room/${cleaned}`);
  };

  const voiceOptions = [
    ...(voices.human_actor_zero_shot || []),
    ...(voices.cartoon_anime_rvc || []),
  ];

  return (
    <div className="container page-shell">
      {/* Top Banner + Join Bar */}
      <div
        className="card"
        style={{
          marginBottom: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <span className="badge badge-gold" style={{ marginBottom: 8 }}>
            Studio Control Room
          </span>
          <h1 style={{ fontSize: '1.85rem' }}>Welcome back, {user?.name}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: 4 }}>
            Step onto an AI-hosted talk couch, interview a celebrity AI Guest, or open a multi-guest
            WebRTC broadcast room.
          </p>
        </div>

        <form onSubmit={handleJoinCode} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="input mono"
            style={{ width: 220 }}
            placeholder="Enter Code (TFZ-...)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            <LogIn size={16} /> Join Show
          </button>
        </form>
      </div>

      {/* AI Spaces Health Bar */}
      <div className="card card-compact" style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '0.9rem' }}>Connected AI Engines:</strong>
            <span className={`badge ${health.sounzAi?.online ? 'badge-emerald' : 'badge-gold'}`}>
              SounZ AI ({health.sounzAi?.online ? 'Online' : 'Waking / Standby'})
            </span>
            <span className={`badge ${health.filmyAi?.online ? 'badge-cyan' : 'badge-gold'}`}>
              Filmy AI ({health.filmyAi?.online ? 'Online' : 'Waking / Standby'})
            </span>
            <span className={`badge ${health.gemini?.configured ? 'badge-violet' : 'badge-gold'}`}>
              Gemini ({health.gemini?.configured ? health.gemini.model || 'Ready' : 'Fallback Active'})
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={refreshHealth}
            disabled={health.checking}
          >
            <RefreshCw size={14} />
            {health.checking ? 'Pinging Spaces...' : 'Wake / Refresh Spaces'}
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Left: Start New Show (Host / Admin RBAC) */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Tv size={20} color="var(--accent-gold)" />
              <h2 style={{ fontSize: '1.35rem' }}>Create &amp; Go On Air</h2>
            </div>
            {!isHost && <span className="badge badge-live">Host Role Required</span>}
          </div>

          {!isHost ? (
            <div className="glass-panel" style={{ padding: 16, color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
              You are logged in as a <strong>Participant</strong>. Use the{' '}
              <strong>Join Show</strong> box above with a host’s <span className="mono">TFZ-...</span>{' '}
              code, or explore the <strong>Post-Production Studio</strong>!
            </div>
          ) : (
            <form onSubmit={handleCreateShow} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {error && <div className="alert-error">{error}</div>}

              {/* Experience Switcher: AI Host vs AI Guest */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${experienceTab === 'host' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1 }}
                  onClick={() => switchExperience('host')}
                >
                  <Mic size={14} /> AI Interviews Me (AI Host)
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${experienceTab === 'guest' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1 }}
                  onClick={() => switchExperience('guest')}
                >
                  <Star size={14} /> I Interview AI (AI Guest)
                </button>
              </div>

              <div>
                <label className="field-label">
                  1. Pick a {experienceTab === 'guest' ? 'Celebrity AI Guest' : 'Talk Show Format'}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  {displayedPresets.map((p) => {
                    const active = form.showFormat === p.id;
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => handlePresetPick(p)}
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: active
                            ? `1.5px solid ${p.accentColor}`
                            : '1px solid var(--border-subtle)',
                          background: active
                            ? 'rgba(245, 176, 65, 0.1)'
                            : 'rgba(11, 10, 19, 0.75)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '0.86rem', color: active ? p.accentColor : '#fff' }}>
                          {p.showTitle}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {p.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="show-title">
                  2. Episode / Meeting Title
                </label>
                <input
                  id="show-title"
                  required
                  minLength={3}
                  className="input"
                  placeholder="Chai with Karan AI — Late Night Special"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className="grid-2">
                <div>
                  <label className="field-label" htmlFor="show-mode">
                    Stage Mode
                  </label>
                  <select
                    id="show-mode"
                    className="select"
                    value={form.mode}
                    onChange={(e) => setForm({ ...form, mode: e.target.value })}
                  >
                    <option value="ai-talkshow">Solo Talk Couch (+ Optional Guests)</option>
                    <option value="live-studio">Multi-Guest WebRTC Studio + Audience</option>
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="show-voice">
                    SounZ AI Character Voice
                  </label>
                  <select
                    id="show-voice"
                    className="select"
                    value={form.customVoiceId}
                    onChange={(e) => setForm({ ...form, customVoiceId: e.target.value })}
                  >
                    <option value="">Default Preset Voice</option>
                    {voiceOptions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.emoji || '🎙️'} {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="show-desc">
                  Episode Description (Optional)
                </label>
                <input
                  id="show-desc"
                  className="input"
                  placeholder="Rapid-fire questions, live audience Q&A, and Filmy AI highlights"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={creating}>
                <PlusCircle size={17} /> {creating ? 'Starting Studio...' : 'Launch Studio Room'}
              </button>
            </form>
          )}
        </div>

        {/* Right: Recent Shows */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sparkles size={20} color="var(--accent-cyan)" />
              <h2 style={{ fontSize: '1.35rem' }}>Your Recent Shows</h2>
            </div>
            <Link to="/history" className="btn btn-ghost btn-sm">
              View All
            </Link>
          </div>

          {loadingHistory ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading studio history...</p>
          ) : recentMeetings.length === 0 ? (
            <div className="glass-panel" style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>
              No shows yet. Launch your first AI Talk Show on the left!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recentMeetings.slice(0, 6).map((m) => (
                <div
                  key={m._id}
                  className="glass-panel"
                  style={{
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span
                        className={`badge ${
                          m.status === 'live'
                            ? 'badge-live'
                            : m.status === 'ended'
                              ? 'badge-gold'
                              : 'badge-cyan'
                        }`}
                      >
                        {m.status}
                      </span>
                      <span className="badge badge-violet" style={{ fontSize: '0.68rem' }}>
                        AI {m.aiRole || 'host'}
                      </span>
                      <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {m.code}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.96rem' }}>{m.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      <Users size={12} style={{ verticalAlign: 'middle' }} /> {m.uniqueParticipantCount || 0} guests ·{' '}
                      {m.messageCount || 0} messages
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {m.status !== 'ended' && (
                      <Link to={`/room/${m.code}`} className="btn btn-primary btn-sm">
                        Enter
                      </Link>
                    )}
                    <Link to={`/meetings/${m._id}/report`} className="btn btn-ghost btn-sm" title="Attendance Report">
                      <BarChart3 size={14} /> Report
                    </Link>
                    <Link to={`/studio/${m._id}`} className="btn btn-ghost btn-sm" title="Filmy & SounZ Studio">
                      <Film size={14} /> Studio
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
