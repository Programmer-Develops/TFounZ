import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  ArrowRight,
  Users,
  Film,
  BarChart3,
  Radio,
  Sparkles,
  Play,
  Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStudio } from '../context/StudioContext';
import { apiFetch } from '../utils/api';
import PersonaPortrait from '../components/ui/PersonaPortrait';
import { Badge, EmptyState, LoadingState } from '../components/ui/Primitives';

export default function DashboardPage() {
  const { user, isHost } = useAuth();
  const { guestPresets, presets } = useStudio();

  const [meetings, setMeetings] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, jRes] = await Promise.all([
        apiFetch('/api/meetings/history'),
        apiFetch('/api/studio/jobs'),
      ]);
      setMeetings(mRes?.data?.meetings || []);
      setJobs(jRes?.data?.jobs || []);
    } catch {
      // handled gracefully
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const liveShow = meetings.find((m) => m.status === 'live');
  const latestEnded = meetings.find((m) => m.status === 'ended');
  const totalMessages = meetings.reduce((acc, m) => acc + (m.messageCount || 0), 0);
  const peakRapidFire = meetings.reduce((acc, m) => Math.max(acc, m.rapidFireHighScore || 0), 0);
  const completedJobs = jobs.filter((j) => j.status === 'completed');

  const featuredGuests = (guestPresets.length ? guestPresets : presets).slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Editorial Welcome Header */}
      <section
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Creator Studio Overview
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 600 }}>
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: '0.9rem' }}>
            Direct live talk shows, interview AI guests, and cut broadcast highlights from one workspace.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/guests" className="btn btn-secondary">
            <Users size={15} /> Browse AI Guests
          </Link>
          {isHost && (
            <Link to="/shows/new" className="btn btn-primary">
              <PlusCircle size={15} /> Create New Show
            </Link>
          )}
        </div>
      </section>

      {/* Restrained KPI Strip (Single Bordered Hairline Row) */}
      <section className="kpi-strip">
        <div className="kpi-cell">
          <div className="eyebrow">Total Shows</div>
          <div className="tabular" style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: 6 }}>
            {meetings.length}
          </div>
        </div>
        <div className="kpi-cell">
          <div className="eyebrow">Studio Productions</div>
          <div className="tabular" style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: 6, color: 'var(--status-positive)' }}>
            {completedJobs.length}
          </div>
        </div>
        <div className="kpi-cell">
          <div className="eyebrow">Transcript Turns</div>
          <div className="tabular" style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: 6 }}>
            {totalMessages}
          </div>
        </div>
        <div className="kpi-cell">
          <div className="eyebrow">Rapid-Fire Record</div>
          <div className="tabular" style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: 6, color: 'var(--accent)' }}>
            {peakRapidFire} <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>pts</span>
          </div>
        </div>
      </section>

      {/* Continue Live / Continue Editing Spotlight Strip */}
      {(liveShow || latestEnded) && (
        <section
          className="surface"
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            borderColor: liveShow ? 'var(--status-live-border)' : 'var(--accent-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <PersonaPortrait
              styleKey={(liveShow || latestEnded).aiPersona?.avatarStyle}
              size={46}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Badge tone={liveShow ? 'live' : 'accent'}>
                  {liveShow ? 'On Air Now' : 'Continue Editing'}
                </Badge>
                <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {(liveShow || latestEnded).code}
                </span>
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.98rem' }}>
                {(liveShow || latestEnded).title}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {liveShow ? (
              <Link to={`/room/${liveShow.code}`} className="btn btn-primary btn-sm">
                <Radio size={14} /> Rejoin Broadcast Stage
              </Link>
            ) : (
              <>
                <Link to={`/studio/${latestEnded._id}`} className="btn btn-primary btn-sm">
                  <Film size={14} /> Open Post-Production
                </Link>
                {isHost && (
                  <Link to={`/meetings/${latestEnded._id}/report`} className="btn btn-secondary btn-sm">
                    <BarChart3 size={14} /> Attendance Report
                  </Link>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* Recent Shows Editorial Table */}
      <section className="section-block">
        <div className="section-header">
          <div>
            <h2 style={{ fontSize: '1.12rem' }}>Recent Shows</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              Your live broadcasts, AI interviews, and scheduled episodes.
            </p>
          </div>
          <Link to="/history" className="btn btn-ghost btn-sm">
            Full Archive <ArrowRight size={13} />
          </Link>
        </div>

        <div className="surface">
          {loading ? (
            <LoadingState label="Loading shows..." />
          ) : meetings.length === 0 ? (
            <EmptyState
              icon={Radio}
              title="No shows recorded yet"
              description="Create your first AI Talk Show or live multi-guest broadcast room to begin."
              action={
                isHost ? (
                  <Link to="/shows/new" className="btn btn-primary btn-sm">
                    <PlusCircle size={14} /> Create First Show
                  </Link>
                ) : null
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="editorial-table">
                <thead>
                  <tr>
                    <th>Episode</th>
                    <th>AI Persona</th>
                    <th>Status</th>
                    <th>Engagement</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.slice(0, 6).map((m) => (
                    <tr key={m._id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{m.title}</div>
                        <div className="mono" style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {m.code} · {new Date(m.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <PersonaPortrait styleKey={m.aiPersona?.avatarStyle} size={32} />
                          <div>
                            <div style={{ fontSize: '0.84rem', fontWeight: 500 }}>{m.aiPersona?.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              AI {m.aiRole || 'host'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge
                          tone={m.status === 'live' ? 'live' : m.status === 'ended' ? 'neutral' : 'accent'}
                        >
                          {m.status}
                        </Badge>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }} className="tabular">
                        {m.uniqueParticipantCount || 0} guests · {m.messageCount || 0} turns
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {m.status !== 'ended' && (
                            <Link to={`/room/${m.code}`} className="btn btn-primary btn-sm">
                              <Play size={12} /> Stage
                            </Link>
                          )}
                          <Link to={`/studio/${m._id}`} className="btn btn-secondary btn-sm">
                            Edit
                          </Link>
                          {isHost && (
                            <Link to={`/meetings/${m._id}/report`} className="btn btn-ghost btn-sm">
                              Report
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Lower Two-Column Editorial Split: AI Guest Discovery + Recent Productions */}
      <section className="section-block grid-2" style={{ alignItems: 'start', gap: 24 }}>
        {/* AI Guest Discovery */}
        <div>
          <div className="section-header">
            <div>
              <h2 style={{ fontSize: '1.08rem' }}>Featured AI Guests</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                Invite an AI celebrity or character onto your couch.
              </p>
            </div>
            <Link to="/guests" className="btn btn-ghost btn-sm">
              All Guests <ArrowRight size={13} />
            </Link>
          </div>

          <div className="surface">
            {featuredGuests.map((guest) => (
              <div key={guest.id} className="list-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <PersonaPortrait styleKey={guest.avatarStyle} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{guest.name}</div>
                    <div
                      style={{
                        fontSize: '0.77rem',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 290,
                      }}
                    >
                      {guest.tagline}
                    </div>
                  </div>
                </div>
                <Link
                  to={`/shows/new?persona=${encodeURIComponent(guest.id)}`}
                  className="btn btn-secondary btn-sm"
                >
                  Invite
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Productions & Activity */}
        <div>
          <div className="section-header">
            <div>
              <h2 style={{ fontSize: '1.08rem' }}>Recent Productions</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                Filmy AI video edits and SounZ AI audio masters.
              </p>
            </div>
            <Link to="/studio" className="btn btn-ghost btn-sm">
              Media Library <ArrowRight size={13} />
            </Link>
          </div>

          <div className="surface">
            {jobs.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No productions yet"
                description="Record a broadcast clip or upload audio in Productions to master with Filmy AI & SounZ AI."
                action={
                  <Link to="/studio" className="btn btn-secondary btn-sm">
                    Open Productions
                  </Link>
                }
              />
            ) : (
              jobs.slice(0, 5).map((job) => (
                <div key={job._id} className="list-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Badge tone={job.engine === 'filmy-ai' ? 'accent' : 'positive'}>
                        {job.engine}
                      </Badge>
                      <Badge
                        tone={
                          job.status === 'completed'
                            ? 'positive'
                            : job.status === 'failed'
                              ? 'live'
                              : 'warn'
                        }
                      >
                        {job.status}
                      </Badge>
                    </div>
                    <div
                      style={{
                        fontSize: '0.84rem',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 340,
                      }}
                    >
                      {job.instruction}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} /> {new Date(job.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Link to="/studio" className="btn btn-ghost btn-sm">
                    Open
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
