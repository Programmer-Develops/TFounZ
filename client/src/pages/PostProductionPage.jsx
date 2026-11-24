import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
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
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { apiFetch, apiFetchBlobUrl } from '../utils/api';
import { blobToWavFile } from '../utils/wavEncoder';
import { getPendingClip, clearPendingClip } from '../utils/clipStore';

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

export default function PostProductionPage() {
  const { meetingId } = useParams();
  const { voices, health, refreshHealth } = useStudio();

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
  const [sounzInstruction, setSounzInstruction] = useState(
    'Remove background noise and normalize loudness'
  );
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [recordingMic, setRecordingMic] = useState(false);
  const [sounzRunning, setSounzRunning] = useState(false);
  const [sounzResult, setSounzResult] = useState(null);
  const [sounzOutUrl, setSounzOutUrl] = useState('');
  const [sounzError, setSounzError] = useState('');

  // Jobs Archive + Archive Media Previewer
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [archivePreview, setArchivePreview] = useState(null); // { job, blobUrl }
  const [archiveLoadingId, setArchiveLoadingId] = useState('');

  const micRecRef = useRef(null);
  const micChunksRef = useRef([]);

  // Clean up object URLs on replacement/unmount
  useEffect(() => () => videoPreviewUrl && URL.revokeObjectURL(videoPreviewUrl), [videoPreviewUrl]);
  useEffect(() => () => filmyOutUrl && URL.revokeObjectURL(filmyOutUrl), [filmyOutUrl]);
  useEffect(() => () => audioPreviewUrl && URL.revokeObjectURL(audioPreviewUrl), [audioPreviewUrl]);
  useEffect(() => () => sounzOutUrl && URL.revokeObjectURL(sounzOutUrl), [sounzOutUrl]);
  useEffect(
    () => () => archivePreview?.blobUrl && URL.revokeObjectURL(archivePreview.blobUrl),
    [archivePreview?.blobUrl]
  );

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const q = meetingId ? `?meetingId=${encodeURIComponent(meetingId)}` : '';
      const res = await apiFetch(`/api/studio/jobs${q}`);
      setJobs(res?.data?.jobs || []);
    } catch {
      // handled softly
    } finally {
      setLoadingJobs(false);
    }
  }, [meetingId]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

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
      }
      if (clip.suggestedPrompt) {
        setFilmyInstruction(clip.suggestedPrompt);
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
      setFilmyError('Please select or record a video clip first.');
      return;
    }
    setFilmyError('');
    setFilmyRunning(true);
    try {
      const form = new FormData();
      form.append('file', videoFile);
      form.append('instruction', filmyInstruction);
      if (meetingId) form.append('meetingId', meetingId);

      const res = await apiFetch('/api/studio/filmy/process', {
        method: 'POST',
        body: form,
      });
      setFilmyResult(res.data);
      const blobUrl = await apiFetchBlobUrl(res.data.downloadUrl);
      setFilmyOutUrl(blobUrl);
      await loadJobs();
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
      setSounzError('Please upload an audio file or record your mic first.');
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

      const res = await apiFetch('/api/studio/sounz/process', {
        method: 'POST',
        body: form,
      });
      setSounzResult(res.data);
      const blobUrl = await apiFetchBlobUrl(res.data.downloadUrl);
      setSounzOutUrl(blobUrl);
      await loadJobs();
    } catch (err) {
      setSounzError(err.message);
    } finally {
      setSounzRunning(false);
    }
  };

  const pickVoiceChip = (voice) => {
    setSelectedVoiceId(voice.id);
    setSounzInstruction(
      `Convert my voice to ${voice.id.replace(/_/g, ' ')} and normalize loudness`
    );
  };

  const handlePlayArchiveJob = async (job) => {
    if (!job?.proxyDownloadUrl) return;
    setArchiveLoadingId(job._id);
    try {
      const blobUrl = await apiFetchBlobUrl(job.proxyDownloadUrl);
      setArchivePreview({ job, blobUrl });
    } catch (err) {
      setSounzError(`Could not load archived output: ${err.message}`);
    } finally {
      setArchiveLoadingId('');
    }
  };

  return (
    <div className="container page-shell">
      <div
        className="card card-compact"
        style={{
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <span className="badge badge-gold" style={{ marginBottom: 6 }}>
            AI Post-Production Studio
          </span>
          <h1 style={{ fontSize: '1.8rem' }}>Filmy AI Director &amp; SounZ AI Voice Lab</h1>
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={refreshHealth}
          disabled={health.checking}
        >
          <RefreshCw size={14} /> {health.checking ? 'Checking Spaces...' : 'Ping AI Spaces'}
        </button>
      </div>

      <div className="grid-2" style={{ alignItems: 'start', marginBottom: 24 }}>
        {/* Filmy AI Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Film size={20} color="var(--accent-cyan)" />
              <h2 style={{ fontSize: '1.3rem' }}>Filmy AI Video Director</h2>
            </div>
            <span className={`badge ${health.filmyAi?.online ? 'badge-cyan' : 'badge-gold'}`}>
              {health.filmyAi?.online ? 'Space Live' : 'Standby'}
            </span>
          </div>

          <form onSubmit={handleRunFilmy} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="field-label" htmlFor="filmy-upload">
                Upload Episode Clip (or auto-loaded from Show Room)
              </label>
              <input
                id="filmy-upload"
                type="file"
                accept="video/*"
                className="input"
                onChange={handleVideoSelect}
              />
              {videoFile && (
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', marginTop: 6 }}>
                  Loaded: <strong>{videoFile.name}</strong> ({(videoFile.size / 1048576).toFixed(2)} MB)
                </div>
              )}
            </div>

            {videoPreviewUrl && (
              <video
                controls
                src={videoPreviewUrl}
                style={{ width: '100%', borderRadius: 12, maxHeight: 220, background: '#000' }}
              />
            )}

            <div>
              <label className="field-label">Quick Director Prompts</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {FILMY_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => setFilmyInstruction(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="filmy-prompt">
                Natural Language Video Edit Command
              </label>
              <textarea
                id="filmy-prompt"
                rows={3}
                className="textarea"
                value={filmyInstruction}
                onChange={(e) => setFilmyInstruction(e.target.value)}
                required
              />
            </div>

            {filmyError && <div className="alert-error">{filmyError}</div>}

            <button type="submit" className="btn btn-primary" disabled={filmyRunning}>
              <Wand2 size={16} />
              {filmyRunning ? 'Rendering on Filmy AI (may take ~30–60s)...' : 'Produce Video with Filmy AI'}
            </button>
          </form>

          {filmyOutUrl && (
            <div className="glass-panel" style={{ marginTop: 16, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={16} /> Filmy AI Output Ready
                </strong>
                <a
                  href={filmyOutUrl}
                  download={filmyResult?.job?.remoteOutputFilename || 'filmy_edited.mp4'}
                  className="btn btn-ghost btn-sm"
                >
                  <Download size={14} /> Download MP4
                </a>
              </div>
              <video
                controls
                src={filmyOutUrl}
                style={{ width: '100%', borderRadius: 10, maxHeight: 250, background: '#000' }}
              />
              {filmyResult?.processingTimeSeconds != null && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>
                  Render time: {filmyResult.processingTimeSeconds}s
                </div>
              )}
            </div>
          )}
        </div>

        {/* SounZ AI Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sparkles size={20} color="var(--accent-emerald)" />
              <h2 style={{ fontSize: '1.3rem' }}>SounZ AI Audio &amp; Voice Lab</h2>
            </div>
            <span className={`badge ${health.sounzAi?.online ? 'badge-emerald' : 'badge-gold'}`}>
              {health.sounzAi?.online ? 'Space Live' : 'Standby'}
            </span>
          </div>

          <form onSubmit={handleRunSounz} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label className="field-label" htmlFor="sounz-upload">
                  Upload Audio (.wav, .mp3, .ogg, .flac, .m4a)
                </label>
                <input
                  id="sounz-upload"
                  type="file"
                  accept=".mp3,.wav,.ogg,.flac,.m4a,audio/*"
                  className="input"
                  onChange={handleAudioSelect}
                />
              </div>

              <div style={{ paddingTop: 22 }}>
                {!recordingMic ? (
                  <button type="button" className="btn btn-emerald btn-sm" onClick={startRecordAudio}>
                    <Mic size={14} /> Record WAV
                  </button>
                ) : (
                  <button type="button" className="btn btn-crimson btn-sm" onClick={stopRecordAudio}>
                    <Square size={14} /> Stop Mic
                  </button>
                )}
              </div>
            </div>

            {audioPreviewUrl && (
              <div className="glass-panel" style={{ padding: '8px 12px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Original Track: {audioFile?.name}
                </div>
                <audio controls src={audioPreviewUrl} style={{ width: '100%', height: 34 }} />
              </div>
            )}

            <div>
              <label className="field-label">
                SounZ AI Character &amp; Bollywood Voices{' '}
                <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                  (Neural RVC/Seed-VC takes ~30–60s on ZeroGPU)
                </span>
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 135, overflowY: 'auto' }}>
                {[...(voices.human_actor_zero_shot || []), ...(voices.cartoon_anime_rvc || [])].map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`btn btn-sm ${selectedVoiceId === v.id ? 'btn-emerald' : 'btn-ghost'}`}
                    style={{ fontSize: '0.75rem', padding: '5px 9px' }}
                    onClick={() => pickVoiceChip(v)}
                  >
                    {v.emoji || '🎙️'} {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="field-label">Fast Studio Mastering &amp; SFX Presets (~3–8s)</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SOUNZ_MASTER_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '0.75rem' }}
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

            <div>
              <label className="field-label" htmlFor="sounz-prompt">
                Natural Language Audio / Voice Command
              </label>
              <textarea
                id="sounz-prompt"
                rows={2}
                className="textarea"
                value={sounzInstruction}
                onChange={(e) => setSounzInstruction(e.target.value)}
                required
              />
            </div>

            {sounzError && <div className="alert-error">{sounzError}</div>}

            <button type="submit" className="btn btn-emerald" disabled={sounzRunning}>
              <Sparkles size={16} />
              {sounzRunning ? 'Processing on SounZ AI...' : 'Process Audio with SounZ AI'}
            </button>
          </form>

          {sounzOutUrl && (
            <div className="glass-panel" style={{ marginTop: 16, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={16} /> SounZ AI Master Ready
                </strong>
                <a
                  href={sounzOutUrl}
                  download={sounzResult?.job?.remoteOutputFilename || 'sounz_master.mp3'}
                  className="btn btn-ghost btn-sm"
                >
                  <Download size={14} /> Download Audio
                </a>
              </div>
              <audio controls src={sounzOutUrl} style={{ width: '100%', height: 36 }} />
              {Array.isArray(sounzResult?.operations) && sounzResult.operations.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {sounzResult.operations.map((op, idx) => (
                    <span key={idx} className="badge badge-emerald">
                      {op.operation_type || op.type}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Saved Production Jobs Archive */}
      <div className="card">
        <h2 style={{ fontSize: '1.25rem', marginBottom: 14 }}>Production Jobs Archive</h2>

        {archivePreview && (
          <div className="glass-panel" style={{ padding: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ fontSize: '0.9rem' }}>
                Previewing: {archivePreview.job.remoteOutputFilename}
              </strong>
              <a
                href={archivePreview.blobUrl}
                download={archivePreview.job.remoteOutputFilename}
                className="btn btn-primary btn-sm"
              >
                <Download size={14} /> Download
              </a>
            </div>
            {archivePreview.job.engine === 'filmy-ai' ? (
              <video
                controls
                autoPlay
                src={archivePreview.blobUrl}
                style={{ width: '100%', maxHeight: 280, borderRadius: 10, background: '#000' }}
              />
            ) : (
              <audio controls autoPlay src={archivePreview.blobUrl} style={{ width: '100%' }} />
            )}
          </div>
        )}

        {loadingJobs ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading jobs...</p>
        ) : jobs.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>
            No Filmy AI or SounZ AI jobs yet. Run a clip above to save your first production!
          </p>
        ) : (
          <div className="table-wrap">
            <table className="studio-table">
              <thead>
                <tr>
                  <th>Engine</th>
                  <th>Instruction</th>
                  <th>Status</th>
                  <th>Output File</th>
                  <th>Created</th>
                  <th>Playback</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job._id}>
                    <td>
                      <span className={`badge ${job.engine === 'filmy-ai' ? 'badge-cyan' : 'badge-emerald'}`}>
                        {job.engine}
                      </span>
                    </td>
                    <td>{job.instruction}</td>
                    <td>
                      <span
                        className={`badge ${
                          job.status === 'completed'
                            ? 'badge-emerald'
                            : job.status === 'failed'
                              ? 'badge-live'
                              : 'badge-gold'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: '0.8rem' }}>
                      {job.remoteOutputFilename || job.errorMessage || '-'}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      <Clock size={12} style={{ verticalAlign: 'middle' }} />{' '}
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                    <td>
                      {job.status === 'completed' && job.proxyDownloadUrl ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={archiveLoadingId === job._id}
                          onClick={() => handlePlayArchiveJob(job)}
                        >
                          <Play size={13} /> {archiveLoadingId === job._id ? 'Loading...' : 'Play / Save'}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
