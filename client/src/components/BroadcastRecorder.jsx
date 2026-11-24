import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Square, Download, Film } from 'lucide-react';
import { setPendingClip } from '../utils/clipStore';
import { createBroadcastMixedAudio } from '../utils/soundboard';

export default function BroadcastRecorder({
  localVideoRef,
  aiCanvasRef,
  localStreamRef,
  remotePeers = [],
  remoteVideoMapRef = null,
  meetingId,
  meetingTitle,
  hostName,
  aiRole = 'host',
  lowerThirdText,
  suggestedFilmyPrompt = '',
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

  // Live refs prevent stale closures during active recording
  const liveMetaRef = useRef({ lowerThirdText, hostName, meetingTitle, aiRole });
  useEffect(() => {
    liveMetaRef.current = { lowerThirdText, hostName, meetingTitle, aiRole };
  }, [lowerThirdText, hostName, meetingTitle, aiRole]);

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
      setError('MediaRecorder is not supported in this browser.');
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
      ctx.fillStyle = '#0a0912';
      ctx.fillRect(0, 0, 1280, 720);

      // Check if a remote WebRTC guest video is active
      const remoteVideos = remoteVideoMapRef?.current
        ? Array.from(remoteVideoMapRef.current.values()).filter((v) => v && v.readyState >= 2)
        : [];
      const hasRemote = remoteVideos.length > 0;

      const vid = localVideoRef?.current;
      const aiCanvas = aiCanvasRef?.current;

      if (hasRemote) {
        // 3-panel broadcast layout: Local + AI + Remote Co-Guest
        if (vid && vid.readyState >= 2) {
          drawVideoCover(vid, 20, 76, 404, 490);
        } else {
          ctx.fillStyle = '#181528';
          ctx.fillRect(20, 76, 404, 490);
        }
        if (aiCanvas) {
          drawVideoCover(aiCanvas, 438, 76, 404, 490);
        }
        drawVideoCover(remoteVideos[0], 856, 76, 404, 490);
      } else {
        // 2-panel split-screen TV couch
        if (vid && vid.readyState >= 2) {
          drawVideoCover(vid, 20, 76, 608, 490);
        } else {
          ctx.fillStyle = '#181528';
          ctx.fillRect(20, 76, 608, 490);
          ctx.fillStyle = '#9ca3af';
          ctx.font = '600 22px Outfit, sans-serif';
          ctx.fillText('STAGE CAMERA OFF', 210, 330);
        }
        if (aiCanvas) {
          drawVideoCover(aiCanvas, 652, 76, 608, 490);
        }
      }

      // Top broadcast bar
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath();
      ctx.roundRect(24, 22, 118, 34, 17);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 16px Outfit, sans-serif';
      ctx.fillText('● ON AIR', 44, 45);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 22px Outfit, sans-serif';
      ctx.fillText(meta.meetingTitle || 'TFounZ Talk Show', 160, 46);

      // Dynamic TV Lower-Third Chyron (reads live ref every frame)
      const roleTag =
        meta.aiRole === 'guest'
          ? 'AI GUEST'
          : meta.aiRole === 'co-host'
            ? 'AI CO-HOST'
            : 'AI HOST';
      ctx.fillStyle = 'rgba(14, 12, 24, 0.92)';
      ctx.fillRect(20, 588, 1240, 106);
      ctx.fillStyle = '#f5b041';
      ctx.fillRect(20, 588, 10, 106);
      ctx.font = '700 18px Outfit, sans-serif';
      ctx.fillText(
        `TFOUNZ STUDIO • ${roleTag}: ${String(meta.hostName || 'AI').toUpperCase()}`,
        48,
        624
      );
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 26px Outfit, sans-serif';
      ctx.fillText(
        String(meta.lowerThirdText || 'LIVE TALK SHOW BROADCAST').slice(0, 62),
        48,
        666
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
    <div className="glass-panel" style={{ padding: '12px 14px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!recording ? (
            <button type="button" className="btn btn-crimson btn-sm" onClick={startRecording}>
              <Video size={15} /> Record Broadcast Episode
            </button>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={stopRecording}>
              <Square size={14} fill="#ff4d6d" color="#ff4d6d" /> Stop Broadcast ({seconds}s)
            </button>
          )}
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Records video + live chyrons + mic + SounZ AI voice + SFX
          </span>
        </div>

        {recordedClip && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <a
              href={recordedClip.url}
              download={recordedClip.filename}
              className="btn btn-ghost btn-sm"
            >
              <Download size={14} /> Save Clip
            </a>
            <button type="button" className="btn btn-primary btn-sm" onClick={sendToFilmyStudio}>
              <Film size={14} /> Produce in Filmy AI Studio
            </button>
          </div>
        )}
      </div>
      {error && (
        <div className="alert-error" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}
    </div>
  );
}
