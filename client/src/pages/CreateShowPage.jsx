import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Radio, Mic, Users, Star, Sliders, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStudio } from '../context/StudioContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../utils/api';
import { cleanVoiceLabel, getStudioPrefs, saveStudioPrefs } from '../utils/studioPrefs';
import PersonaPortrait from '../components/ui/PersonaPortrait';
import { Badge, ErrorBanner, Field } from '../components/ui/Primitives';

export default function CreateShowPage() {
  const { user, isHost } = useAuth();
  const { presets, guestPresets, voices } = useStudio();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialPrefs = getStudioPrefs();

  const [experience, setExperience] = useState('host'); // 'host' | 'guest' | 'live-studio'
  const [form, setForm] = useState({
    title: '',
    description: '',
    showFormat: 'chai-with-ai',
    mode: 'ai-talkshow',
    aiRole: 'host',
    customHostName: '',
    customVoiceId: '',
  });
  const [voiceEngine, setVoiceEngine] = useState(initialPrefs.defaultVoiceEngine || 'browser');
  const [mirrorCamera, setMirrorCamera] = useState(initialPrefs.mirrorCamera);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Pre-select persona when arriving from AI Guest Library (?persona=...)
  useEffect(() => {
    const personaId = searchParams.get('persona');
    if (!personaId) return;
    const all = [...presets, ...guestPresets];
    const match = all.find((p) => p.id === personaId);
    if (!match) return;

    const isGuest = match.defaultAiRole === 'guest';
    const isLive = match.defaultMode === 'live-studio';
    setExperience(isLive ? 'live-studio' : isGuest ? 'guest' : 'host');
    setForm((prev) => ({
      ...prev,
      showFormat: match.id,
      mode: match.defaultMode || 'ai-talkshow',
      aiRole: match.defaultAiRole || 'host',
      customVoiceId: match.sounzVoiceId || '',
      title: prev.title || `${match.showTitle} ft. ${user?.name || 'Guest'}`,
    }));
  }, [searchParams, presets, guestPresets, user?.name]);

  const activeList =
    experience === 'guest'
      ? guestPresets
      : experience === 'live-studio'
        ? presets.filter((p) => p.id === 'classic-meet' || p.id === 'chai-with-ai' || p.id === 'mock-interview')
        : presets;

  const selectedPersona =
    [...presets, ...guestPresets].find((p) => p.id === form.showFormat) ||
    activeList[0] ||
    null;

  const handleExperienceChange = (next) => {
    setExperience(next);
    if (next === 'guest') {
      const first = guestPresets[0];
      if (first) {
        setForm((prev) => ({
          ...prev,
          showFormat: first.id,
          mode: 'ai-talkshow',
          aiRole: 'guest',
          customVoiceId: first.sounzVoiceId || '',
          title: `${first.showTitle} with ${user?.name || 'Host'}`,
        }));
      }
    } else if (next === 'live-studio') {
      const meet = presets.find((p) => p.id === 'classic-meet') || presets[0];
      if (meet) {
        setForm((prev) => ({
          ...prev,
          showFormat: meet.id,
          mode: 'live-studio',
          aiRole: 'co-host',
          customVoiceId: meet.sounzVoiceId || '',
          title: `Live Broadcast Studio — ${user?.name || 'Host'}`,
        }));
      }
    } else {
      const first = presets[0];
      if (first) {
        setForm((prev) => ({
          ...prev,
          showFormat: first.id,
          mode: 'ai-talkshow',
          aiRole: 'host',
          customVoiceId: first.sounzVoiceId || '',
          title: `${first.showTitle} ft. ${user?.name || 'Guest'}`,
        }));
      }
    }
  };

  const handlePickPersona = (persona) => {
    setForm((prev) => ({
      ...prev,
      showFormat: persona.id,
      aiRole:
        experience === 'live-studio'
          ? 'co-host'
          : persona.defaultAiRole || (experience === 'guest' ? 'guest' : 'host'),
      customVoiceId: persona.sounzVoiceId || '',
      title: `${persona.showTitle} ft. ${user?.name || 'Guest'}`,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    saveStudioPrefs({ defaultVoiceEngine: voiceEngine, mirrorCamera });
    try {
      const res = await apiFetch('/api/meetings', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      const meeting = res?.data?.meeting;
      if (meeting?.code) {
        toast(`Studio ${meeting.code} is live`, 'success');
        navigate(`/room/${meeting.code}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const allVoices = [
    ...(voices.human_actor_zero_shot || []),
    ...(voices.cartoon_anime_rvc || []),
  ];

  if (!isHost) {
    return (
      <div className="surface-padded" style={{ maxWidth: 540 }}>
        <h1 style={{ fontSize: '1.3rem', marginBottom: 8 }}>Host Role Required</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          Your account is registered as a <strong>Participant</strong>. Use the top bar to join any
          active show with a host’s <span className="mono">TFZ-...</span> code.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Production Setup
        </div>
        <h1 style={{ fontSize: '1.65rem' }}>Create New Show</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 4 }}>
          Configure your broadcast format, cast an AI Host or AI Guest, and set studio audio preferences.
        </p>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      <form onSubmit={handleSubmit} className="create-show-grid">
        {/* Left: Production Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Step 1: Broadcast Format */}
          <div className="surface-padded" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="eyebrow">01 · Broadcast Format</div>
            <div className="format-grid-3" style={{ gap: 10 }}>
              {[
                {
                  id: 'host',
                  title: 'AI Talk Host',
                  desc: 'AI hosts & interviews you on couch',
                  icon: Mic,
                },
                {
                  id: 'guest',
                  title: 'AI Celebrity Guest',
                  desc: 'You host & interview an AI guest',
                  icon: Star,
                },
                {
                  id: 'live-studio',
                  title: 'Multi-Guest Studio',
                  desc: 'WebRTC guests + live audience + AI',
                  icon: Users,
                },
              ].map(({ id, title, desc, icon: Icon }) => {
                const active = experience === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleExperienceChange(id)}
                    style={{
                      textAlign: 'left',
                      padding: '12px 13px',
                      borderRadius: 'var(--radius-sm)',
                      background: active ? 'var(--accent-soft)' : 'var(--bg-base)',
                      border: active
                        ? '1px solid var(--accent-border)'
                        : '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={16} color={active ? 'var(--accent)' : 'var(--text-muted)'} />
                    <div style={{ fontWeight: 600, fontSize: '0.86rem', marginTop: 8 }}>{title}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                      {desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Show Identity */}
          <div className="surface-padded" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="eyebrow">02 · Episode Details</div>
            <Field label="Show Title" htmlFor="create-title">
              <input
                id="create-title"
                required
                minLength={3}
                className="input"
                placeholder="Late Night Tech & Cinema — Episode 01"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>

            <Field
              label="Topic & Conversation Brief (Optional)"
              htmlFor="create-desc"
              hint="Sets context for Rapid-Fire rounds and AI Show Notes."
            >
              <textarea
                id="create-desc"
                rows={2}
                className="textarea"
                placeholder="Discuss building AI startups, rapid-fire cinema takes, and live Q&A..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>

          {/* Step 3: Cast AI Persona */}
          <div className="surface-padded" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="eyebrow">
              03 · Cast {experience === 'guest' ? 'AI Guest' : experience === 'live-studio' ? 'AI Co-Host' : 'AI Host'}
            </div>
            <div className="grid-2" style={{ gap: 10 }}>
              {activeList.map((p) => {
                const active = form.showFormat === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePickPersona(p)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      textAlign: 'left',
                      padding: '10px 12px',
                      minWidth: 0,
                      width: '100%',
                      borderRadius: 'var(--radius-sm)',
                      background: active ? 'var(--accent-soft)' : 'var(--bg-base)',
                      border: active
                        ? '1px solid var(--accent-border)'
                        : '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ flexShrink: 0 }}>
                      <PersonaPortrait styleKey={p.avatarStyle} size={42} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '0.86rem',
                          overflowWrap: 'break-word',
                        }}
                      >
                        {p.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--text-secondary)',
                          marginTop: 2,
                          overflowWrap: 'break-word',
                        }}
                      >
                        {p.showTitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 4: Audio & Video Preferences */}
          <div className="surface-padded" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sliders size={12} /> 04 · Audio &amp; Video Preferences
            </div>
            <div className="grid-2">
              <Field label="SounZ AI Character Voice" htmlFor="create-voice">
                <select
                  id="create-voice"
                  className="select"
                  value={form.customVoiceId}
                  onChange={(e) => setForm({ ...form, customVoiceId: e.target.value })}
                >
                  <option value="">Default Persona Voice</option>
                  {allVoices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {cleanVoiceLabel(v.label)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Live Speech Engine" htmlFor="create-engine">
                <select
                  id="create-engine"
                  className="select"
                  value={voiceEngine}
                  onChange={(e) => setVoiceEngine(e.target.value)}
                >
                  <option value="browser">Instant Browser Speech (Low Latency)</option>
                  <option value="sounz">SounZ AI Studio Synthesis (~3s, Mixed Audio)</option>
                </select>
              </Field>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={mirrorCamera}
                onChange={(e) => setMirrorCamera(e.target.checked)}
              />
              Mirror my self-view camera on the broadcast stage
            </label>
          </div>
        </div>

        {/* Right: Sticky Broadcast Preview Card */}
        <aside
          className="surface-padded"
          style={{ position: 'sticky', top: 76, display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="eyebrow">Stage Preview</span>
            <Badge tone="positive">Configured</Badge>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-stage)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <PersonaPortrait styleKey={selectedPersona?.avatarStyle} size={54} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.96rem' }}>
                  {selectedPersona?.name || 'AI Persona'}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  {selectedPersona?.tagline}
                </div>
              </div>
            </div>

            <div
              style={{
                borderLeft: '3px solid var(--accent)',
                paddingLeft: 10,
                background: 'rgba(20, 20, 24, 0.8)',
                padding: '8px 10px',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              <div style={{ fontSize: '0.68rem', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase' }}>
                {form.aiRole === 'guest' ? 'AI GUEST INTERVIEW' : form.aiRole === 'co-host' ? 'MULTI-GUEST STUDIO' : 'AI HOSTED SHOW'}
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, marginTop: 2 }}>
                {form.title || 'Untitled Broadcast Episode'}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>Mode</span>
              <span style={{ textAlign: 'right' }}>{form.mode === 'live-studio' ? 'Multi-Guest WebRTC' : 'Talk Show Couch'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>Live Voice</span>
              <span style={{ textAlign: 'right' }}>{voiceEngine === 'sounz' ? 'SounZ AI' : 'Instant Browser'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>Recording</span>
              <span style={{ textAlign: 'right' }}>1280×720 Composite + Mixed Audio</span>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
            <Radio size={16} /> {submitting ? 'Launching Studio...' : 'Launch Broadcast Studio'}
            <ArrowRight size={15} />
          </button>
        </aside>
      </form>
    </div>
  );
}
