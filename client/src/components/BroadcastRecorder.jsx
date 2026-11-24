import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Circle, Square, Download, Film } from 'lucide-react';
import { setPendingClip } from '../utils/clipStore';
import { createBroadcastMixedAudio } from '../utils/soundboard';

function formatTime(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default function BroadcastRecorder({
  localVideoRef,
  aiCanvasRef,
  screenVideoRef = null,
  localStreamRef,
  remotePeers = [],
  remoteVideoMapRef = null,
  meetingId,
  meetingTitle,
  hostName,
  aiRole = 'host',
  lowerThirdText,
  suggestedFilmyPrompt = '',
  onRecordingStateChange = null,
}) {
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordedClip, setRecordedClip] = useState(null);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef(null);
  const rafRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioCleanupRef = useRef(null);

  const liveMetaRef = useRef({ lowerThirdText, hostName, meetingTitle, aiRole });
  useEffect(() => {
    liveMetaRef.current = { lowerThirdText, hostName, meetingTitle, aiRole };
  }, [lowerThirdText, hostName, meetingTitle, aiRole]);

  useEffect(() => {
    onRecordingStateChange?.({ recording, seconds });
  }, [recording, seconds, onRecordingStateChange]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      audioCleanupRef.current?.();
      if (recordedClip?.url) URL.revokeObjectURL(recordedClip.url);
    };
  }, [recordedClip?.url]);

  const pickMimeType = () => {
    const candidates = [
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    return candidates.find((m) => window.MediaRecorder?.isTypeSupported(m)) || '';
  };

  const startRecording = () => {
    setError('');
    if (!window.MediaRecorder) {
      setError('MediaRecorder is unsupported in this browser.');
      return;
    }

    const compCanvas = document.createElement('canvas');
    compCanvas.width = 1280;
    compCanvas.height = 720;
    const ctx = compCanvas.getContext('2d');

    const drawVideoCover = (source, x, y, w, h) => {
      const sw = source.videoWidth || source.width || w;
      const sh = source.videoHeight || source.height || h;
      if (!sw || !sh) return;
      const srcRatio = sw / sh;
      const dstRatio = w / h;
      let sx = 0;
      let sy = 0;
      let cropW = sw;
      let cropH = sh;
      if (srcRatio > dstRatio) {
        cropW = sh * dstRatio;
        sx = (sw - cropW) / 2;
      } else {
        cropH = sw / dstRatio;
        sy = (sh - cropH) / 2;
      }
      ctx.drawImage(source, sx, sy, cropW, cropH, x, y, w, h);
    };

    const drawComposite = () => {
      const meta = liveMetaRef.current;
      ctx.fillStyle = '#070709';
      ctx.fillRect(0, 0, 1280, 720);

      const remoteVideos = remoteVideoMapRef?.current
        ? Array.from(remoteVideoMapRef.current.values()).filter((v) => v && v.readyState >= 2)
        : [];
      const screenVid = screenVideoRef?.current;
      const thirdSource =
        screenVid && screenVid.readyState >= 2 ? screenVid : remoteVideos[0] || null;

      const vid = localVideoRef?.current;
      const aiCanvas = aiCanvasRef?.current;

      if (thirdSource) {
        if (vid && vid.readyState >= 2) drawVideoCover(vid, 20, 74, 404, 492);
        else {
          ctx.fillStyle = '#141418';
          ctx.fillRect(20, 74, 404, 492);
        }
        if (aiCanvas) drawVideoCover(aiCanvas, 438, 74, 404, 492);
        drawVideoCover(thirdSource, 856, 74, 404, 492);
      } else {
        if (vid && vid.readyState >= 2) drawVideoCover(vid, 20, 74, 608, 492);
        else {
          ctx.fillStyle = '#141418';
          ctx.fillRect(20, 74, 608, 492);
          ctx.fillStyle = '#6E6B66';
          ctx.font = '600 18px Inter, sans-serif';
          ctx.fillText('CAMERA STANDBY', 240, 326);
        }
        if (aiCanvas) drawVideoCover(aiCanvas, 652, 74, 608, 492);
      }

      // Top broadcast bar
      ctx.fillStyle = '#C84B53';
      ctx.beginPath();
      ctx.roundRect(22, 22, 96, 30, 4);
      ctx.fill();
      ctx.fillStyle = '#F5F2EB';
      ctx.font = '700 13px Inter, sans-serif';
      ctx.fillText('● ON AIR', 38, 42);

      ctx.fillStyle = '#F5F2EB';
      ctx.font = '600 19px Inter, sans-serif';
      ctx.fillText(meta.meetingTitle || 'TFounZ Studio Broadcast', 136, 44);

      // Editorial Lower-Third Chyron
      const roleTag =
        meta.aiRole === 'guest'
          ? 'AI GUEST'
          : meta.aiRole === 'co-host'
            ? 'AI CO-HOST'
            : 'AI HOST';
      ctx.fillStyle = 'rgba(11, 11, 13, 0.94)';
      ctx.fillRect(20, 588, 1240, 104);
      ctx.fillStyle = '#C9A96E';
      ctx.fillRect(20, 588, 6, 104);
      ctx.font = '600 14px Inter, sans-serif';
      ctx.fillText(
        `TFOUNZ STUDIO · ${roleTag}: ${String(meta.hostName || 'AI').toUpperCase()}`,
        44,
        622
      );
      ctx.fillStyle = '#F5F2EB';
      ctx.font = '600 24px Inter, sans-serif';
      ctx.fillText(
        String(meta.lowerThirdText || 'LIVE TALK SHOW BROADCAST').slice(0, 64),
        44,
        662
      );

      rafRef.current = requestAnimationFrame(drawComposite);
    };

    drawComposite();

    const canvasStream = compCanvas.captureStream(24);
    const mixedAudio = createBroadcastMixedAudio(localStreamRef?.current, remotePeers);
    audioCleanupRef.current = mixedAudio.cleanup;

    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...mixedAudio.tracks,
    ]);

    const mimeType = pickMimeType();
    const recorder = mimeType
      ? new MediaRecorder(combinedStream, { mimeType })
      : new MediaRecorder(combinedStream);

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      audioCleanupRef.current?.();
      audioCleanupRef.current = null;

      const finalType = recorder.mimeType || 'video/webm';
      const ext = finalType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunksRef.current, { type: finalType });
      const url = URL.createObjectURL(blob);
      const filename = `tfounz_episode_${Date.now()}.${ext}`;
      setRecordedClip((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return { blob, url, filename };
      });
      setRecording(false);
    };

    recorder.start(500);
    mediaRecorderRef.current = recorder;
    setRecordedClip((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    setSeconds(0);
    setRecording(true);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const sendToFilmyStudio = () => {
    if (!recordedClip?.blob) return;
    setPendingClip({
      videoBlob: recordedClip.blob,
      filename: recordedClip.filename,
      meetingId,
      meetingTitle,
      suggestedPrompt: suggestedFilmyPrompt,
      recordedAt: new Date().toISOString(),
    });
    navigate(meetingId ? `/studio/${meetingId}` : '/studio');
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {!recording ? (
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={startRecording}
          title="Record composite split-screen broadcast with mixed audio"
        >
          <Circle size={12} fill="currentColor" /> Record
        </button>
      ) : (
        <button type="button" className="btn btn-danger btn-sm mono" onClick={stopRecording}>
          <Square size={12} fill="currentColor" /> Stop {formatTime(seconds)}
        </button>
      )}

      {recordedClip && (
        <>
          <a
            href={recordedClip.url}
            download={recordedClip.filename}
            className="btn btn-secondary btn-sm"
            title="Download recorded episode clip"
          >
            <Download size={13} /> Save
          </a>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={sendToFilmyStudio}
            title="Open clip in Filmy AI & SounZ AI Post-Production"
          >
            <Film size={13} /> Edit Clip
          </button>
        </>
      )}

      {error && <span style={{ fontSize: '0.75rem', color: 'var(--status-live)' }}>{error}</span>}
    </div>
  );
}
