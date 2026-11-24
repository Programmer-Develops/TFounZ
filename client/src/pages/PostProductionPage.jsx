import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Film,
  Mic,
  Square,
  Sparkles,
  Download,
  RefreshCw,
  Wand2,
  CheckCircle2,
  Clock,
  Play,
  Share2,
  AudioLines,
  Library,
  FileText,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { useToast } from '../context/ToastContext';
import { apiFetch, apiFetchBlobUrl } from '../utils/api';
import { blobToWavFile } from '../utils/wavEncoder';
import { getPendingClip, clearPendingClip } from '../utils/clipStore';
import { cleanVoiceLabel } from '../utils/studioPrefs';
import PersonaPortrait from '../components/ui/PersonaPortrait';
import { Badge, EmptyState, ErrorBanner, Field, LoadingState, Modal } from '../components/ui/Primitives';

const FILMY_CHIPS = [
  'Remove background noise, transcribe speech and add synchronized bottom subtitles',
  'Make it black and white, trim first 2 seconds and boost volume',
  'Speed up 1.25x and clean background noise',
];

const SOUNZ_MASTER_CHIPS = [
  'Remove background noise and normalize loudness',
  'Normalize loudness and inject applause at end',
  'Make voice sound like vintage radio with fade in and fade out',
  'Remove silence and speed up 1.15x',
];

function computeDurationLabel(meeting) {
  if (!meeting?.startedAt) return 'Draft';
  const start = new Date(meeting.startedAt).getTime();
  const end = meeting.endedAt ? new Date(meeting.endedAt).getTime() : Date.now();
  const mins = Math.max(1, Math.round((end - start) / 60000));
  return `${mins} min`;
}

export default function PostProductionPage() {
  const { meetingId } = useParams();
  const { voices, health, refreshHealth } = useStudio();
  const { toast } = useToast();

  const [sectionTab, setSectionTab] = useState('library'); // 'library' | 'filmy' | 'sounz'

  // Filmy AI state
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [filmyInstruction, setFilmyInstruction] = useState(FILMY_CHIPS[0]);
  const [filmyRunning, setFilmyRunning] = useState(false);
  const [filmyResult, setFilmyResult] = useState(null);
  const [filmyOutUrl, setFilmyOutUrl] = useState('');
  const [filmyError, setFilmyError] = useState('');

  // SounZ AI state
  const [audioFile, setAudioFile] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('');
  const [sounzInstruction, setSounzInstruction] = useState(SOUNZ_MASTER_CHIPS[0]);
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [recordingMic, setRecordingMic] = useState(false);
  const [sounzRunning, setSounzRunning] = useState(false);
  const [sounzResult, setSounzResult] = useState(null);
  const [sounzOutUrl, setSounzOutUrl] = useState('');
  const [sounzError, setSounzError] = useState('');

  // Library Data
  const [jobs, setJobs] = useState([]);
  const [shows, setShows] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [previewModal, setPreviewModal] = useState(null); // { job, blobUrl }
  const [loadingJobId, setLoadingJobId] = useState('');
  const [highlightsModal, setHighlightsModal] = useState(null); // { title, summary }
  const [loadingHighlightId, setLoadingHighlightId] = useState('');

  const micRecRef = useRef(null);
  const micChunksRef = useRef([]);

  useEffect(() => () => videoPreviewUrl && URL.revokeObjectURL(videoPreviewUrl), [videoPreviewUrl]);
  useEffect(() => () => filmyOutUrl && URL.revokeObjectURL(filmyOutUrl), [filmyOutUrl]);
  useEffect(() => () => audioPreviewUrl && URL.revokeObjectURL(audioPreviewUrl), [audioPreviewUrl]);
  useEffect(() => () => sounzOutUrl && URL.revokeObjectURL(sounzOutUrl), [sounzOutUrl]);
  useEffect(
    () => () => previewModal?.blobUrl && URL.revokeObjectURL(previewModal.blobUrl),
    [previewModal?.blobUrl]
  );

  const loadLibrary = useCallback(async () => {
    setLoadingLibrary(true);
    try {
      const q = meetingId ? `?meetingId=${encodeURIComponent(meetingId)}` : '';
      const [jRes, mRes] = await Promise.all([
        apiFetch(`/api/studio/jobs${q}`),
        apiFetch('/api/meetings/history'),
      ]);
      setJobs(jRes?.data?.jobs || []);
      setShows(mRes?.data?.meetings || []);
    } catch {
      // handled softly
    } finally {
      setLoadingLibrary(false);
    }
  }, [meetingId]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // Auto-load clip or AI-suggested director prompt transferred from ShowRoomPage
  useEffect(() => {
    const clip = getPendingClip();
    if (clip) {
      if (clip.videoBlob) {
        const file = new File([clip.videoBlob], clip.filename || 'tfounz_clip.webm', {
          type: clip.videoBlob.type || 'video/webm',
        });
        setVideoFile(file);
        setVideoPreviewUrl(URL.createObjectURL(file));
        setSectionTab('filmy');
      }
      if (clip.suggestedPrompt) {
        setFilmyInstruction(clip.suggestedPrompt);
        setSectionTab('filmy');
      }
      clearPendingClip();
    }
  }, []);

  const handleVideoSelect = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setVideoFile(f);
    setVideoPreviewUrl(URL.createObjectURL(f));
    setFilmyResult(null);
    setFilmyOutUrl('');
  };

  const handleRunFilmy = async (e) => {
    e.preventDefault();
    if (!videoFile) {
      setFilmyError('Select or record a video clip first.');
      return;
    }
    setFilmyError('');
    setFilmyRunning(true);
    try {
      const form = new FormData();
      form.append('file', videoFile);
      form.append('instruction', filmyInstruction);
      if (meetingId) form.append('meetingId', meetingId);

      const res = await apiFetch('/api/studio/filmy/process', { method: 'POST', body: form });
      setFilmyResult(res.data);
      const blobUrl = await apiFetchBlobUrl(res.data.downloadUrl);
      setFilmyOutUrl(blobUrl);
      toast('Filmy AI episode render completed', 'success');
      await loadLibrary();
    } catch (err) {
      setFilmyError(err.message);
    } finally {
      setFilmyRunning(false);
    }
  };

  const handleAudioSelect = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAudioFile(f);
    setAudioPreviewUrl(URL.createObjectURL(f));
    setSounzResult(null);
    setSounzOutUrl('');
  };

  const startRecordAudio = async () => {
    setSounzError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      micChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) micChunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const raw = new Blob(micChunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const wavFile = await blobToWavFile(raw, `studio_mic_${Date.now()}.wav`);
        setAudioFile(wavFile);
        setAudioPreviewUrl(URL.createObjectURL(wavFile));
      };
      rec.start();
      micRecRef.current = rec;
      setRecordingMic(true);
    } catch (err) {
      setSounzError(`Microphone error: ${err.message}`);
    }
  };

  const stopRecordAudio = () => {
    if (micRecRef.current && micRecRef.current.state !== 'inactive') {
      micRecRef.current.stop();
    }
    setRecordingMic(false);
  };

  const handleRunSounz = async (e) => {
    e.preventDefault();
    if (!audioFile) {
      setSounzError('Upload an audio file or record your microphone first.');
      return;
    }
    setSounzError('');
    setSounzRunning(true);
    try {
      const form = new FormData();
      form.append('file', audioFile);
      form.append('instruction', sounzInstruction);
      if (selectedVoiceId) form.append('voiceId', selectedVoiceId);
      if (meetingId) form.append('meetingId', meetingId);

      const res = await apiFetch('/api/studio/sounz/process', { method: 'POST', body: form });
      setSounzResult(res.data);
      const blobUrl = await apiFetchBlobUrl(res.data.downloadUrl);
      setSounzOutUrl(blobUrl);
      toast('SounZ AI audio master ready', 'success');
      await loadLibrary();
    } catch (err) {
      setSounzError(err.message);
    } finally {
      setSounzRunning(false);
    }
  };

  const handleOpenJobPlayback = async (job) => {
    if (!job?.proxyDownloadUrl) return;
    setLoadingJobId(job._id);
    try {
      const blobUrl = await apiFetchBlobUrl(job.proxyDownloadUrl);
      setPreviewModal({ job, blobUrl });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoadingJobId('');
    }
  };

  const handleLoadHighlights = async (show) => {
    setLoadingHighlightId(show._id);
    try {
      const res = await apiFetch(`/api/ai-show/${show._id}/summary`, { method: 'POST' });
      setHighlightsModal({ show, summary: res.data });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoadingHighlightId('');
    }
  };

  const handleCopyShareLink = (path) => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard?.writeText(url);
    toast('Production link copied to clipboard', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Header */}
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
            Post-Production &amp; Media Library
          </div>
          <h1 style={{ fontSize: '1.65rem' }}>Recordings &amp; Productions</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 4 }}>
            Replay recorded episodes, generate AI highlights, edit with Filmy AI, and master audio with SounZ AI.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={refreshHealth}
            disabled={health.checking}
          >
            <RefreshCw size={13} /> {health.checking ? 'Checking...' : 'Check Engines'}
          </button>
        </div>
      </div>

      {/* Section Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        {[
          { id: 'library', label: 'Media Library', icon: Library },
          { id: 'filmy', label: 'Filmy AI Video Director', icon: Film },
          { id: 'sounz', label: 'SounZ AI Audio & Voice Lab', icon: AudioLines },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`btn btn-sm ${sectionTab === id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSectionTab(id)}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* TAB 1: MEDIA LIBRARY & RECORDED SHOWS */}
      {sectionTab === 'library' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {/* Recorded Shows Grid */}
          <section>
            <div className="section-header">
              <div>
                <h2 style={{ fontSize: '1.1rem' }}>Recorded Episodes</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  Inspect transcripts, generate AI highlights, or open a show in the editor.
                </p>
              </div>
            </div>

            {loadingLibrary ? (
              <LoadingState label="Loading media library..." />
            ) : shows.length === 0 ? (
              <div className="surface">
                <EmptyState
                  icon={Film}
                  title="No recorded episodes yet"
                  description="Host a show and record a broadcast clip to populate your media library."
                  action={
                    <Link to="/shows/new" className="btn btn-primary btn-sm">
                      Create New Show
                    </Link>
                  }
                />
              </div>
            ) : (
              <div className="grid-3">
                {shows.slice(0, 6).map((show) => (
                  <article
                    key={show._id}
                    className="surface"
                    style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                  >
                    {/* Editorial Thumbnail Header */}
                    <div
                      style={{
                        height: 112,
                        background: 'var(--bg-stage)',
                        borderBottom: '1px solid var(--border-subtle)',
                        padding: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <PersonaPortrait styleKey={show.aiPersona?.avatarStyle} size={56} />
                        <div>
                          <div className="eyebrow" style={{ color: 'var(--accent)', fontSize: '0.64rem' }}>
                            AI {show.aiRole || 'host'}
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', marginTop: 2 }}>
                            {show.aiPersona?.name}
                          </div>
                        </div>
                      </div>
                      <span
                        className="mono"
                        style={{
                          position: 'absolute',
                          right: 10,
                          bottom: 10,
                          fontSize: '0.7rem',
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'rgba(11,11,13,0.85)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {computeDurationLabel(show)}
                      </span>
                    </div>

                    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{show.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                        <span>{new Date(show.createdAt).toLocaleDateString()}</span>
                        <span>·</span>
                        <span>{show.messageCount || 0} turns</span>
                      </div>

                      <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 10, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={loadingHighlightId === show._id}
                          onClick={() => handleLoadHighlights(show)}
                        >
                          <FileText size={12} />
                          {loadingHighlightId === show._id ? 'Generating...' : 'AI Highlights'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setSectionTab('filmy');
                          }}
                        >
                          Edit Video
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => handleCopyShareLink(`/room/${show.code}`)}
                          title="Copy show link"
                        >
                          <Share2 size={13} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Rendered Filmy AI & SounZ AI Productions Table */}
          <section className="section-block">
            <div className="section-header">
              <div>
                <h2 style={{ fontSize: '1.1rem' }}>Rendered Productions</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  Exported video cuts and mastered audio tracks stored in your studio history.
                </p>
              </div>
            </div>

            <div className="surface">
              {jobs.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="No rendered files yet"
                  description="Switch to Filmy AI Video Director or SounZ AI Audio Lab above to create your first production."
                />
              ) : (
                <div className="table-wrap">
                  <table className="editorial-table">
                    <thead>
                      <tr>
                        <th>Engine</th>
                        <th>Director Prompt</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((job) => (
                        <tr key={job._id}>
                          <td>
                            <Badge tone={job.engine === 'filmy-ai' ? 'accent' : 'positive'}>
                              {job.engine}
                            </Badge>
                          </td>
                          <td>
                            <div style={{ fontWeight: 500, fontSize: '0.84rem' }}>{job.instruction}</div>
                            <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              {job.remoteOutputFilename || job.errorMessage || '—'}
                            </div>
                          </td>
                          <td>
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
                          </td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            <Clock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                            {new Date(job.createdAt).toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {job.status === 'completed' && job.proxyDownloadUrl ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={loadingJobId === job._id}
                                onClick={() => handleOpenJobPlayback(job)}
                              >
                                <Play size={12} /> {loadingJobId === job._id ? 'Loading...' : 'Play & Save'}
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: FILMY AI VIDEO DIRECTOR */}
      {sectionTab === 'filmy' && (
        <div className="grid-2" style={{ alignItems: 'start', gap: 22 }}>
          <form onSubmit={handleRunFilmy} className="surface-padded" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Film size={17} color="var(--accent)" /> Filmy AI Video Director
              </h2>
              <Badge tone={health.filmyAi?.online ? 'positive' : 'warn'}>
                {health.filmyAi?.online ? 'Online' : 'Standby'}
              </Badge>
            </div>

            <Field label="Source Video Clip (.mp4, .webm, .mov)" htmlFor="filmy-file">
              <input
                id="filmy-file"
                type="file"
                accept="video/*"
                className="input"
                style={{ paddingTop: 6 }}
                onChange={handleVideoSelect}
              />
            </Field>

            {videoFile && (
              <div style={{ fontSize: '0.78rem', color: 'var(--status-positive)' }}>
                Loaded {videoFile.name} ({(videoFile.size / 1048576).toFixed(2)} MB)
              </div>
            )}

            <div className="field">
              <span className="field-label">Director Presets</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {FILMY_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ height: 'auto', padding: '5px 9px', whiteSpace: 'normal', textAlign: 'left', fontSize: '0.74rem' }}
                    onClick={() => setFilmyInstruction(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Editing Instruction" htmlFor="filmy-inst">
              <textarea
                id="filmy-inst"
                rows={3}
                className="textarea"
                value={filmyInstruction}
                onChange={(e) => setFilmyInstruction(e.target.value)}
                required
              />
            </Field>

            <ErrorBanner message={filmyError} onDismiss={() => setFilmyError('')} />

            <button type="submit" className="btn btn-primary" disabled={filmyRunning}>
              <Wand2 size={15} />
              {filmyRunning ? 'Rendering via Filmy AI (~15–60s)...' : 'Render Video Cut'}
            </button>
          </form>

          <div className="surface-padded" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="eyebrow">Monitor Deck</div>
            {filmyOutUrl ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--status-positive)', fontWeight: 600, fontSize: '0.86rem' }}>
                    <CheckCircle2 size={15} /> Export Ready
                  </span>
                  <a
                    href={filmyOutUrl}
                    download={filmyResult?.job?.remoteOutputFilename || 'filmy_export.mp4'}
                    className="btn btn-primary btn-sm"
                  >
                    <Download size={13} /> Download MP4
                  </a>
                </div>
                <video
                  controls
                  src={filmyOutUrl}
                  style={{ width: '100%', borderRadius: 6, background: '#000', maxHeight: 340 }}
                />
                {filmyResult?.processingTimeSeconds != null && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Rendered in {filmyResult.processingTimeSeconds}s
                  </div>
                )}
              </>
            ) : videoPreviewUrl ? (
              <>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Source Preview</div>
                <video
                  controls
                  src={videoPreviewUrl}
                  style={{ width: '100%', borderRadius: 6, background: '#000', maxHeight: 340 }}
                />
              </>
            ) : (
              <EmptyState
                icon={Film}
                title="No clip loaded"
                description="Upload a video clip or record directly from the Broadcast Studio to edit with natural language."
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SOUNZ AI AUDIO & VOICE LAB */}
      {sectionTab === 'sounz' && (
        <div className="grid-2" style={{ alignItems: 'start', gap: 22 }}>
          <form onSubmit={handleRunSounz} className="surface-padded" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AudioLines size={17} color="var(--status-positive)" /> SounZ AI Audio &amp; Voice Lab
              </h2>
              <Badge tone={health.sounzAi?.online ? 'positive' : 'warn'}>
                {health.sounzAi?.online ? 'Online' : 'Standby'}
              </Badge>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <Field label="Audio File (.wav, .mp3, .ogg, .flac, .m4a)" htmlFor="sounz-file">
                  <input
                    id="sounz-file"
                    type="file"
                    accept=".mp3,.wav,.ogg,.flac,.m4a,audio/*"
                    className="input"
                    style={{ paddingTop: 6 }}
                    onChange={handleAudioSelect}
                  />
                </Field>
              </div>
              {!recordingMic ? (
                <button type="button" className="btn btn-secondary" onClick={startRecordAudio}>
                  <Mic size={14} /> Record WAV
                </button>
              ) : (
                <button type="button" className="btn btn-danger" onClick={stopRecordAudio}>
                  <Square size={13} fill="currentColor" /> Stop Mic
                </button>
              )}
            </div>

            <div className="field">
              <span className="field-label">Character &amp; Celebrity Voices (RVC / Zero-Shot)</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 132, overflowY: 'auto' }}>
                {[...(voices.human_actor_zero_shot || []), ...(voices.cartoon_anime_rvc || [])].map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`btn btn-sm ${selectedVoiceId === v.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ height: 28, fontSize: '0.74rem' }}
                    onClick={() => {
                      setSelectedVoiceId(v.id);
                      setSounzInstruction(
                        `Convert my voice to ${v.id.replace(/_/g, ' ')} and normalize loudness`
                      );
                    }}
                  >
                    {cleanVoiceLabel(v.label)}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field-label">Mastering &amp; SFX Presets</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SOUNZ_MASTER_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ border: '1px solid var(--border-subtle)', fontSize: '0.74rem' }}
                    onClick={() => {
                      setSelectedVoiceId('');
                      setSounzInstruction(chip);
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Audio Processing Instruction" htmlFor="sounz-inst">
              <textarea
                id="sounz-inst"
                rows={2}
                className="textarea"
                value={sounzInstruction}
                onChange={(e) => setSounzInstruction(e.target.value)}
                required
              />
            </Field>

            <ErrorBanner message={sounzError} onDismiss={() => setSounzError('')} />

            <button type="submit" className="btn btn-primary" disabled={sounzRunning}>
              <Sparkles size={15} />
              {sounzRunning ? 'Processing on SounZ AI...' : 'Process Audio Master'}
            </button>
          </form>

          <div className="surface-padded" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="eyebrow">A / B Audio Comparison</div>

            {audioPreviewUrl ? (
              <div className="field">
                <span className="field-label">Original Track ({audioFile?.name})</span>
                <audio controls src={audioPreviewUrl} style={{ width: '100%' }} />
              </div>
            ) : (
              <EmptyState
                icon={AudioLines}
                title="No audio track loaded"
                description="Upload a track or record PCM WAV directly from your microphone."
              />
            )}

            {sounzOutUrl && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--status-positive-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--status-positive)', fontWeight: 600, fontSize: '0.84rem' }}>
                    Mastered Output
                  </span>
                  <a
                    href={sounzOutUrl}
                    download={sounzResult?.job?.remoteOutputFilename || 'sounz_master.mp3'}
                    className="btn btn-secondary btn-sm"
                  >
                    <Download size={13} /> Download
                  </a>
                </div>
                <audio controls src={sounzOutUrl} style={{ width: '100%' }} />
                {Array.isArray(sounzResult?.operations) && sounzResult.operations.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {sounzResult.operations.map((op, i) => (
                      <Badge key={i} tone="positive">
                        {op.operation_type || op.type}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Playback Modal for Archive Jobs */}
      <Modal
        open={Boolean(previewModal)}
        onClose={() => setPreviewModal(null)}
        title={previewModal?.job?.remoteOutputFilename || 'Production Preview'}
        subtitle={previewModal?.job?.instruction}
      >
        {previewModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {previewModal.job.engine === 'filmy-ai' ? (
              <video
                controls
                autoPlay
                src={previewModal.blobUrl}
                style={{ width: '100%', borderRadius: 6, background: '#000', maxHeight: 360 }}
              />
            ) : (
              <audio controls autoPlay src={previewModal.blobUrl} style={{ width: '100%' }} />
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <a
                href={previewModal.blobUrl}
                download={previewModal.job.remoteOutputFilename}
                className="btn btn-primary btn-sm"
              >
                <Download size={13} /> Download File
              </a>
            </div>
          </div>
        )}
      </Modal>

      {/* AI Highlights Modal */}
      <Modal
        open={Boolean(highlightsModal)}
        onClose={() => setHighlightsModal(null)}
        title={highlightsModal?.summary?.headline || 'AI Episode Highlights'}
        subtitle={highlightsModal?.show?.title}
      >
        {highlightsModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ul style={{ margin: '0 0 0 18px', padding: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              {(highlightsModal.summary.highlights || []).map((item, idx) => (
                <li key={idx} style={{ marginBottom: 6 }}>
                  {item}
                </li>
              ))}
            </ul>
            <div
              style={{
                borderLeft: '3px solid var(--accent)',
                paddingLeft: 12,
                fontStyle: 'italic',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
              }}
            >
              “{highlightsModal.summary.bestQuote}”
            </div>
            <div
              style={{
                padding: 12,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="eyebrow" style={{ marginBottom: 6 }}>
                Suggested Filmy AI Director Prompt
              </div>
              <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                {highlightsModal.summary.suggestedFilmyPrompt}
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setFilmyInstruction(highlightsModal.summary.suggestedFilmyPrompt);
                  setHighlightsModal(null);
                  setSectionTab('filmy');
                }}
              >
                <Film size={13} /> Load into Filmy AI Director
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
