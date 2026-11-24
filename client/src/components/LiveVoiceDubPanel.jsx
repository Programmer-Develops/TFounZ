import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Sparkles, Volume2 } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { apiFetch, apiFetchBlobUrl } from '../utils/api';
import { blobToWavFile } from '../utils/wavEncoder';

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
    setStatusMsg('Encoding WAV & sending to SounZ AI...');
    try {
      const wavFile = await blobToWavFile(rawBlob, `show_dub_${Date.now()}.wav`);
      const picked = allVoiceOptions.find((v) => v.id === voiceId);
      const voicePhrase = picked ? `${picked.id.replace(/_/g, ' ')}` : voiceId;

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
      setStatusMsg(`Converted with SounZ AI (${picked?.label || voiceId})!`);
    } catch (err) {
      setError(err.message);
      setStatusMsg('');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} color="var(--accent-emerald)" />
          <strong style={{ fontSize: '0.88rem' }}>SounZ AI Live Voice Dub</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select
            className="select"
            style={{ width: 'auto', minWidth: 210, padding: '6px 10px', fontSize: '0.82rem' }}
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            disabled={recording || processing}
          >
            {allVoiceOptions.length === 0 ? (
              <option value={defaultVoiceId}>🎙️ {defaultVoiceId.replace(/_/g, ' ')}</option>
            ) : (
              allVoiceOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.emoji || '🎙️'} {v.label}
                </option>
              ))
            )}
          </select>

          {!recording ? (
            <button
              type="button"
              className="btn btn-emerald btn-sm"
              onClick={startMic}
              disabled={processing}
            >
              <Mic size={14} /> {processing ? 'Converting...' : 'Dub 5s Line'}
            </button>
          ) : (
            <button type="button" className="btn btn-crimson btn-sm" onClick={stopMic}>
              <Square size={14} /> Stop &amp; Convert
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', marginTop: 8 }}>
          {statusMsg}
        </div>
      )}
      {error && (
        <div className="alert-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      {resultUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <Volume2 size={16} color="var(--accent-gold)" />
          <audio controls src={resultUrl} autoPlay style={{ height: 34, flex: 1 }} />
        </div>
      )}
    </div>
  );
}
