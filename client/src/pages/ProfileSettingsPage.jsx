import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Sliders, Cpu, RefreshCw, LogOut, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStudio } from '../context/StudioContext';
import { useToast } from '../context/ToastContext';
import { getStudioPrefs, saveStudioPrefs } from '../utils/studioPrefs';
import { Badge, Field } from '../components/ui/Primitives';

export default function ProfileSettingsPage() {
  const { user, logout } = useAuth();
  const { health, refreshHealth } = useStudio();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [prefs, setPrefs] = useState(() => getStudioPrefs());
  const [devices, setDevices] = useState({ video: [], audio: [] });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        setDevices({
          video: list.filter((d) => d.kind === 'videoinput'),
          audio: list.filter((d) => d.kind === 'audioinput'),
        });
      } catch {
        // ignore permission-restricted enumeration
      }
    })();
  }, []);

  const handleSavePrefs = (e) => {
    e.preventDefault();
    saveStudioPrefs(prefs);
    setSaved(true);
    toast('Studio preferences saved', 'success');
    setTimeout(() => setSaved(false), 1800);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 860 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Account &amp; Studio Configuration
        </div>
        <h1 style={{ fontSize: '1.65rem' }}>Profile &amp; Settings</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 4 }}>
          Manage your creator identity, connected AI production engines, and default camera/audio devices.
        </p>
      </div>

      {/* Account Profile */}
      <section className="surface-padded" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={16} color="var(--accent)" /> Account Profile
          </h2>
          <Badge tone="accent">{user?.role}</Badge>
        </div>

        <div className="grid-2">
          <div>
            <div className="eyebrow">Full Name</div>
            <div style={{ marginTop: 4, fontWeight: 500 }}>{user?.name}</div>
          </div>
          <div>
            <div className="eyebrow">Email Address</div>
            <div style={{ marginTop: 4, fontWeight: 500 }}>{user?.email}</div>
          </div>
          <div>
            <div className="eyebrow">Creator Bio</div>
            <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
              {user?.bio || 'No bio added'}
            </div>
          </div>
          <div>
            <div className="eyebrow">Member Since</div>
            <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active Session'}
            </div>
          </div>
        </div>
      </section>

      {/* Studio Audio & Video Preferences */}
      <form onSubmit={handleSavePrefs} className="surface-padded" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sliders size={16} color="var(--accent)" /> Broadcast Hardware &amp; Voice Defaults
        </h2>

        <div className="grid-2">
          <Field label="Default Camera" htmlFor="pref-cam">
            <select
              id="pref-cam"
              className="select"
              value={prefs.videoDeviceId}
              onChange={(e) => setPrefs({ ...prefs, videoDeviceId: e.target.value })}
            >
              <option value="">System Default Camera</option>
              {devices.video.map((d, idx) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Default Microphone" htmlFor="pref-mic">
            <select
              id="pref-mic"
              className="select"
              value={prefs.audioDeviceId}
              onChange={(e) => setPrefs({ ...prefs, audioDeviceId: e.target.value })}
            >
              <option value="">System Default Microphone</option>
              {devices.audio.map((d, idx) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone ${idx + 1}`}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Default AI Voice Engine" htmlFor="pref-voice-engine">
          <select
            id="pref-voice-engine"
            className="select"
            value={prefs.defaultVoiceEngine}
            onChange={(e) => setPrefs({ ...prefs, defaultVoiceEngine: e.target.value })}
          >
            <option value="browser">Instant Browser Speech (Sub-second latency)</option>
            <option value="sounz">SounZ AI Studio Synthesis (~3s, mixed into recordings)</option>
          </select>
        </Field>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={prefs.mirrorCamera}
            onChange={(e) => setPrefs({ ...prefs, mirrorCamera: e.target.checked })}
          />
          Mirror local camera preview in Broadcast Studio
        </label>

        <div>
          <button type="submit" className="btn btn-primary btn-sm">
            {saved ? <Check size={14} /> : null} {saved ? 'Saved' : 'Save Preferences'}
          </button>
        </div>
      </form>

      {/* AI Microservice Integrations */}
      <section className="surface-padded" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cpu size={16} color="var(--accent)" /> Connected AI Integrations
          </h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={refreshHealth}
            disabled={health.checking}
          >
            <RefreshCw size={13} /> {health.checking ? 'Checking...' : 'Ping Services'}
          </button>
        </div>

        <div className="surface">
          <div className="list-row">
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Gemini Conversational Engine</div>
              <div className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Model: {health.gemini?.model || 'gemini-flash-lite-latest'} (503 circuit-breaker active)
              </div>
            </div>
            <Badge tone={health.gemini?.configured ? 'positive' : 'warn'}>
              {health.gemini?.configured ? 'Configured' : 'Fallback'}
            </Badge>
          </div>

          <div className="list-row">
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>SounZ AI Audio &amp; Voice API</div>
              <div className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {health.sounzAi?.url || 'Hosted Hugging Face Space'}
              </div>
            </div>
            <Badge tone={health.sounzAi?.online ? 'positive' : 'warn'}>
              {health.sounzAi?.online ? 'Online' : 'Standby'}
            </Badge>
          </div>

          <div className="list-row">
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Filmy AI Video Director API</div>
              <div className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {health.filmyAi?.url || 'Hosted Hugging Face Space'}
              </div>
            </div>
            <Badge tone={health.filmyAi?.online ? 'positive' : 'warn'}>
              {health.filmyAi?.online ? 'Online' : 'Standby'}
            </Badge>
          </div>
        </div>
      </section>

      {/* Session Sign Out */}
      <section className="surface-padded" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Active Session</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Revokes your refresh token hash on the server and signs out of this browser.
          </div>
        </div>
        <button type="button" className="btn btn-danger btn-sm" onClick={handleLogout}>
          <LogOut size={14} /> Sign Out
        </button>
      </section>
    </div>
  );
}
