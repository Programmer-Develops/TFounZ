import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Volume2, Square, ArrowRight, Mic, Star } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import PersonaPortrait from '../components/ui/PersonaPortrait';
import { Badge, EmptyState } from '../components/ui/Primitives';

const CATEGORY_META = {
  'guest-superstar': 'Celebrity',
  'guest-anime': 'Anime',
  'guest-founder': 'Business',
  'guest-cricket': 'Sports',
  'chai-with-ai': 'Entertainment',
  'hot-seat': 'Entertainment',
  'desi-roast': 'Comedy',
  'anime-couch': 'Anime',
  'mock-interview': 'Business',
  'classic-meet': 'Studio',
};

export default function GuestLibraryPage() {
  const { guestPresets, presets } = useStudio();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'guest' | 'host'
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [previewingId, setPreviewingId] = useState('');

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const catalog = useMemo(() => {
    const combined = [...guestPresets, ...presets];
    return combined.map((item) => ({
      ...item,
      category: CATEGORY_META[item.id] || 'Studio',
      roleType: item.defaultAiRole === 'guest' ? 'guest' : 'host',
    }));
  }, [guestPresets, presets]);

  const categories = ['All', 'Celebrity', 'Entertainment', 'Anime', 'Business', 'Sports', 'Comedy', 'Studio'];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((p) => {
      if (roleFilter !== 'all' && p.roleType !== roleFilter) return false;
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.showTitle.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [catalog, query, roleFilter, categoryFilter]);

  const toggleVoicePreview = (persona) => {
    if (!window.speechSynthesis) return;
    if (previewingId === persona.id) {
      window.speechSynthesis.cancel();
      setPreviewingId('');
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(persona.openingLine || persona.tagline);
    utter.rate = 1.03;
    utter.onstart = () => setPreviewingId(persona.id);
    utter.onend = () => setPreviewingId('');
    utter.onerror = () => setPreviewingId('');
    window.speechSynthesis.speak(utter);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Talent &amp; Casting
          </div>
          <h1 style={{ fontSize: '1.65rem' }}>AI Guest &amp; Host Library</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 4 }}>
            Audition AI personalities, preview their voice style, and invite them directly onto your show.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'all', label: 'All Talent' },
            { id: 'guest', label: 'AI Guests' },
            { id: 'host', label: 'AI Hosts' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`btn btn-sm ${roleFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setRoleFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Category Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 360 }}>
          <Search
            size={15}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            className="input"
            style={{ paddingLeft: 34, height: 36 }}
            placeholder="Search by name, show format, or specialty..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`btn btn-sm ${categoryFilter === cat ? 'btn-secondary' : 'btn-ghost'}`}
              style={{
                borderColor: categoryFilter === cat ? 'var(--accent-border)' : 'transparent',
                color: categoryFilter === cat ? 'var(--accent)' : 'var(--text-secondary)',
              }}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Editorial Roster Grid */}
      {filtered.length === 0 ? (
        <div className="surface">
          <EmptyState
            title="No AI talent matched your filter"
            description="Try clearing your search or selecting another category."
            action={
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setQuery('');
                  setRoleFilter('all');
                  setCategoryFilter('All');
                }}
              >
                Reset Filters
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid-2">
          {filtered.map((persona) => {
            const isPreviewing = previewingId === persona.id;
            return (
              <article
                key={persona.id}
                className="surface-padded"
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <PersonaPortrait styleKey={persona.avatarStyle} size={58} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', marginBottom: 5 }}>
                      <Badge tone={persona.roleType === 'guest' ? 'accent' : 'neutral'}>
                        {persona.roleType === 'guest' ? <Star size={10} /> : <Mic size={10} />}
                        {persona.roleType === 'guest' ? 'AI Guest' : 'AI Host'}
                      </Badge>
                      <Badge>{persona.category}</Badge>
                    </div>
                    <h2 style={{ fontSize: '1.06rem' }}>{persona.name}</h2>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {persona.showTitle}
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  {persona.tagline}
                </p>

                {persona.openingLine && (
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      fontStyle: 'italic',
                      borderLeft: '2px solid var(--border-default)',
                      paddingLeft: 10,
                    }}
                  >
                    “{persona.openingLine}”
                  </div>
                )}

                <div
                  style={{
                    marginTop: 'auto',
                    paddingTop: 12,
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <span className="mono" style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                    voice: {persona.sounzVoiceId}
                  </span>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${isPreviewing ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => toggleVoicePreview(persona)}
                    >
                      {isPreviewing ? <Square size={12} fill="currentColor" /> : <Volume2 size={13} />}
                      {isPreviewing ? 'Stop' : 'Preview Voice'}
                    </button>

                    <Link
                      to={`/shows/new?persona=${encodeURIComponent(persona.id)}`}
                      className="btn btn-primary btn-sm"
                    >
                      Invite <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
