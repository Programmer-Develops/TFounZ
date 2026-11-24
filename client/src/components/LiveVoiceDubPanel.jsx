import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, AudioLines, Volume2 } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { apiFetch, apiFetchBlobUrl } from '../utils/api';
import { blobToWavFile } from '../utils/wavEncoder';
import { cleanVoiceLabel } from '../utils/studioPrefs';

export default function LiveVoiceDubPanel({ meetingId, defaultVoiceId = 'romantic_hero' }) {
  const { voices } = useStudio();
  const [voiceId, setVoiceId] = useState(defaultVoiceId);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => () => resultUrl && URL.revokeObjectURL(resultUrl), [resultUrl]);

  const allVoiceOptions = [
    ...(voices.human_actor_zero_shot || []),
    ...(voices.cartoon_anime_rvc || []),
  ];

  const startMic = async () => {
    setError('');
    setStatusMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const rawBlob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        await convertWithSounz(rawBlob);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch (err) {
      setError(`Microphone access failed: ${err.message}`);
    }
  };

  const stopMic = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  const convertWithSounz = async (rawBlob) => {
    setProcessing(true);
    setStatusMsg('Encoding PCM WAV and sending to SounZ AI...');
    try {
      const wavFile = await blobToWavFile(rawBlob, `show_dub_${Date.now()}.wav`);
      const picked = allVoiceOptions.find((v) => v.id === voiceId);
      const voicePhrase = picked ? picked.id.replace(/_/g, ' ') : voiceId;

      const form = new FormData();
      form.append('file', wavFile);
      form.append('instruction', `Convert my voice to ${voicePhrase} and normalize loudness`);
      form.append('voiceId', voiceId);
      if (meetingId) form.append('meetingId', meetingId);

      const res = await apiFetch('/api/studio/sounz/process', {
        method: 'POST',
        body: form,
      });

      const blobUrl = await apiFetchBlobUrl(res.data.downloadUrl);
      setResultUrl(blobUrl);
      setStatusMsg(`Converted with ${cleanVoiceLabel(picked?.label || voiceId)}.`);
    } catch (err) {
      setError(err.message);
      setStatusMsg('');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <AudioLines size={14} color="var(--accent)" />
        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>SounZ AI Character Dub</span>
      </div>

      <select
        className="select"
        style={{ height: 34, fontSize: '0.8rem' }}
        value={voiceId}
        onChange={(e) => setVoiceId(e.target.value)}
        disabled={recording || processing}
      >
        {allVoiceOptions.length === 0 ? (
          <option value={defaultVoiceId}>{defaultVoiceId.replace(/_/g, ' ')}</option>
        ) : (
          allVoiceOptions.map((v) => (
            <option key={v.id} value={v.id}>
              {cleanVoiceLabel(v.label)}
            </option>
          ))
        )}
      </select>

      {!recording ? (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={startMic}
          disabled={processing}
        >
          <Mic size={13} /> {processing ? 'Converting Voice...' : 'Record & Dub Line'}
        </button>
      ) : (
        <button type="button" className="btn btn-danger btn-sm" onClick={stopMic}>
          <Square size={12} fill="currentColor" /> Stop &amp; Convert
        </button>
      )}

      {statusMsg && (
        <div style={{ fontSize: '0.76rem', color: 'var(--status-positive)' }}>{statusMsg}</div>
      )}
      {error && <div className="banner-error" style={{ padding: 8, fontSize: '0.76rem' }}>{error}</div>}
      {resultUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Volume2 size={14} color="var(--accent)" />
          <audio controls src={resultUrl} autoPlay style={{ height: 32, flex: 1 }} />
        </div>
      )}
    </div>
  );
}
