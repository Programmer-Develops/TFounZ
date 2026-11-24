import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Tv, Mic, Film, Sparkles, Radio, Users, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStudio } from '../context/StudioContext';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const { presets } = useStudio();
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  const handleJoin = (e) => {
    e.preventDefault();
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return;
    if (isAuthenticated) {
      navigate(`/room/${cleaned}`);
    } else {
      navigate('/login', { state: { from: `/room/${cleaned}` } });
    }
  };

  return (
    <div className="container page-shell">
      {/* Hero */}
      <section
        className="card"
        style={{
          padding: '42px 32px',
          background:
            'radial-gradient(circle at 85% 20%, rgba(245, 176, 65, 0.16), transparent 45%), radial-gradient(circle at 15% 80%, rgba(255, 77, 109, 0.14), transparent 50%), rgba(20, 17, 32, 0.92)',
          marginBottom: 28,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 820 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className="badge badge-live">
              <span className="pulse-dot" /> ON AIR • MERN + WEBRTC + AI STUDIO
            </span>
            <span className="badge badge-gold">Powered by Filmy AI &amp; SounZ AI</span>
          </div>

          <h1 style={{ fontSize: 'clamp(2.1rem, 4.5vw, 3.35rem)', lineHeight: 1.08 }}>
            Your Personal{' '}
            <span style={{ color: 'var(--accent-gold)' }}>AI Talk Show</span> &amp; Live Video Studio
          </h1>

          <p style={{ fontSize: '1.08rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Forget boring grid-only video clones. Step onto the split-screen couch for{' '}
            <strong>Chai with Karan AI</strong>, <strong>Midnight Hot Seat</strong>,{' '}
            <strong>Anime Couch</strong>, or host live WebRTC audience rooms — then edit your episode
            automatically with <strong>Filmy AI</strong> and dub character voices with{' '}
            <strong>SounZ AI</strong>.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
            <Link to={isAuthenticated ? '/dashboard' : '/register'} className="btn btn-primary">
              <Tv size={18} /> {isAuthenticated ? 'Open Control Room' : 'Start Your Show'}
              <ArrowRight size={16} />
            </Link>

            <form onSubmit={handleJoin} style={{ display: 'flex', gap: 8 }}>
              <input
                className="input mono"
                style={{ width: 205 }}
                placeholder="Show Code (TFZ-...)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button type="submit" className="btn btn-ghost">
                Join Stage
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Engine Triad */}
      <section className="grid-3" style={{ marginBottom: 28 }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Radio size={20} color="var(--accent-gold)" />
            <h3>1. Live Talk Show + WebRTC</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.93rem', lineHeight: 1.55 }}>
            Split-screen stage pairing your live camera &amp; WebRTC guest video with an audio-reactive
            AI Host Avatar, 60-second Rapid-Fire round, studio soundboard, and Socket.IO audience chat.
          </p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Mic size={20} color="var(--accent-emerald)" />
            <h3>2. SounZ AI Voice &amp; Audio Lab</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.93rem', lineHeight: 1.55 }}>
            Record directly in the browser as PCM WAV and transform voices into Bollywood icons, anime
            legends (Gojo, Shinchan, Goku), or run natural-language denoising &amp; BGM ducking.
          </p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Film size={20} color="var(--accent-cyan)" />
            <h3>3. Filmy AI Video Director</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.93rem', lineHeight: 1.55 }}>
            Record your composite TV broadcast with chyrons and send it straight to Filmy AI to trim,
            denoise audio, apply cinema grades, and burn synchronized captions with plain English prompts.
          </p>
        </div>
      </section>

      {/* Presets Gallery */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: '1.55rem' }}>Featured Show Formats</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
              Each format comes with a tailored Gemini Host personality, canvas avatar style &amp; SounZ AI voice
            </p>
          </div>
          <span className="badge badge-gold">
            <Sparkles size={13} /> 6 Studio Presets
          </span>
        </div>

        <div className="grid-3">
          {presets.map((preset) => (
            <div key={preset.id} className="card card-compact" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  className="badge"
                  style={{
                    borderColor: `${preset.accentColor}66`,
                    color: preset.accentColor,
                  }}
                >
                  {preset.defaultMode === 'live-studio' ? <Users size={12} /> : <Tv size={12} />}
                  {preset.defaultMode === 'live-studio' ? 'Live Studio' : 'AI Talk Show'}
                </span>
                <span className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  voice: {preset.sounzVoiceId}
                </span>
              </div>
              <h3 style={{ fontSize: '1.15rem' }}>{preset.showTitle}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                {preset.tagline}
              </p>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 'auto', paddingTop: 6 }}>
                Hosted by <strong style={{ color: 'var(--text-primary)' }}>{preset.name}</strong>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
