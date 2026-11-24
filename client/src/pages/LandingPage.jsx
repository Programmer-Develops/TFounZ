import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Radio, AudioLines, Film, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStudio } from '../context/StudioContext';
import Navbar from '../components/Navbar';
import PersonaPortrait from '../components/ui/PersonaPortrait';
import { Badge } from '../components/ui/Primitives';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const { presets, guestPresets } = useStudio();
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

  const featuredRoster = [...guestPresets.slice(0, 2), ...presets.slice(0, 4)].slice(0, 6);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />

      <main className="container" style={{ paddingTop: 56, paddingBottom: 88 }}>
        {/* Editorial Hero */}
        <section
          className="landing-hero-grid"
          style={{
            paddingBottom: 56,
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="eyebrow" style={{ color: 'var(--accent)', letterSpacing: '0.14em' }}>
              Virtual Talk Show Studio
            </div>

            <h1 style={{ fontSize: 'clamp(2.1rem, 4vw, 3.15rem)', lineHeight: 1.08, fontWeight: 600 }}>
              Direct your own{' '}
              <span style={{ color: 'var(--accent)' }}>AI-hosted talk show</span> in the browser.
            </h1>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', lineHeight: 1.65, maxWidth: 540 }}>
              TFounZ is a virtual production studio for conversational video shows. Host live interviews
              with AI celebrity guests, invite human co-hosts over WebRTC, record mixed broadcasts, and
              master every cut with SounZ AI and Filmy AI.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              <Link to={isAuthenticated ? '/dashboard' : '/register'} className="btn btn-primary btn-lg">
                <Radio size={16} /> {isAuthenticated ? 'Enter Studio' : 'Launch Your Studio'}
                <ArrowRight size={15} />
              </Link>

              <form onSubmit={handleJoin} style={{ display: 'flex', gap: 6 }}>
                <input
                  className="input mono"
                  style={{ width: 185, height: 42 }}
                  placeholder="Code (TFZ-...)"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button type="submit" className="btn btn-secondary btn-lg">
                  Join
                </button>
              </form>
            </div>
          </div>

          {/* Editorial Broadcast Studio Photography */}
          <figure
            style={{
              margin: 0,
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-stage)',
              boxShadow: 'var(--shadow-lg)',
              position: 'relative',
            }}
          >
            <img
              src="/studio-hero.jpg"
              alt="TFounZ acoustic dark-wood broadcast interview studio set with cinema camera and twin studio microphones"
              style={{
                width: '100%',
                aspectRatio: '16 / 10',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, rgba(7,7,9,0.04) 55%, rgba(7,7,9,0.72) 100%)',
                pointerEvents: 'none',
              }}
            />
            <figcaption
              style={{
                position: 'absolute',
                left: 16,
                right: 16,
                bottom: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
              }}
            >
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                Multi-camera WebRTC stage &amp; live AI talent
              </span>
              <span className="mono" style={{ color: 'var(--accent)', fontSize: '0.72rem' }}>
                SounZ AI · Filmy AI
              </span>
            </figcaption>
          </figure>
        </section>

        {/* Three-Column Production Architecture */}
        <section
          className="grid-3"
          style={{
            padding: '44px 0',
            borderBottom: '1px solid var(--border-subtle)',
            gap: 28,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Users size={18} color="var(--accent)" />
            <h2 style={{ fontSize: '1.05rem' }}>Live Studio &amp; Multi-Guest WebRTC</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.6 }}>
              Host solo AI interviews or invite human guests and audience chat via unique show codes,
              complete with screen sharing, Rapid-Fire rounds, and MongoDB attendance reports.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <AudioLines size={18} color="var(--status-positive)" />
            <h2 style={{ fontSize: '1.05rem' }}>SounZ AI Audio &amp; Character Voices</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.6 }}>
              Synthesize live AI dialogue, record clean PCM WAV audio directly in the browser, apply
              noise reduction, or transform voices with 38+ Bollywood and anime models.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Film size={18} color="var(--accent)" />
            <h2 style={{ fontSize: '1.05rem' }}>Filmy AI Post-Production</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.6 }}>
              Capture 1280×720 composite episodes with dynamic lower-third chyrons and send clips straight
              to Filmy AI for auto-subtitles, noise cleanup, and pacing edits.
            </p>
          </div>
        </section>

        {/* Featured AI Talent Roster */}
        {featuredRoster.length > 0 && (
          <section style={{ paddingTop: 44 }}>
            <div className="section-header">
              <div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>
                  Casting Roster
                </div>
                <h2 style={{ fontSize: '1.35rem' }}>AI Hosts &amp; Celebrity Guests</h2>
              </div>
              <Link to={isAuthenticated ? '/guests' : '/register'} className="btn btn-secondary btn-sm">
                Explore Library <ArrowRight size={13} />
              </Link>
            </div>

            <div className="grid-3">
              {featuredRoster.map((p) => (
                <div key={p.id} className="surface-padded" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <PersonaPortrait styleKey={p.avatarStyle} size={46} />
                    <div>
                      <Badge tone={p.defaultAiRole === 'guest' ? 'accent' : 'neutral'}>
                        {p.defaultAiRole === 'guest' ? 'AI Guest' : 'AI Host'}
                      </Badge>
                      <div style={{ fontWeight: 600, fontSize: '0.94rem', marginTop: 4 }}>{p.name}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    {p.tagline}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
