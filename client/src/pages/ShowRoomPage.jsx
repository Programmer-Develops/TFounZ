import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Hand,
  Sparkles,
  Send,
  Copy,
  Check,
  Zap,
  Volume2,
  VolumeX,
  PhoneOff,
  UserX,
  BarChart3,
  Film,
  Search,
  FileText,
  AudioLines,
  X,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStudio } from '../context/StudioContext';
import { apiFetch, apiFetchBlobUrl, ensureFreshAccessToken } from '../utils/api';
import {
  playStudioSfx,
  SFX_OPTIONS,
  playAiAudioBlobUrl,
  stopAiAudioPlayback,
  getAiAnalyserNode,
} from '../utils/soundboard';
import { setPendingClip } from '../utils/clipStore';
import AiHostStage from '../components/AiHostStage';
import BroadcastRecorder from '../components/BroadcastRecorder';
import LiveVoiceDubPanel from '../components/LiveVoiceDubPanel';

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || '').replace(/\/+$/, '');

function RemoteVideoTile({ peer, registerVideoEl }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (el && peer.stream) {
      el.srcObject = peer.stream;
      el.play().catch(() => {});
    }
    registerVideoEl?.(peer.socketId, el);
    return () => registerVideoEl?.(peer.socketId, null);
  }, [peer.socketId, peer.stream, registerVideoEl]);

  return (
    <div className="stage-frame">
      <video ref={ref} autoPlay playsInline />
      <div className="stage-overlay-top">
        <span className="badge badge-cyan">{peer.name || 'Live Guest'} • WEBRTC</span>
      </div>
    </div>
  );
}

async function requestMediaWithFallback() {
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      stream: null,
      hasVideo: false,
      hasAudio: false,
      warning: 'Camera/mic API unavailable in this browser context (use localhost or HTTPS).',
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: true,
    });
    return {
      stream,
      hasVideo: stream.getVideoTracks().length > 0,
      hasAudio: stream.getAudioTracks().length > 0,
      warning: '',
    };
  } catch (bothErr) {
    // Fallback 1: video only (e.g., webcam present without microphone)
    try {
      const videoOnly = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      return {
        stream: videoOnly,
        hasVideo: true,
        hasAudio: false,
        warning: 'Camera active (microphone unavailable or denied).',
      };
    } catch {
      // Fallback 2: audio only (e.g., mic present without webcam)
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        return {
          stream: audioOnly,
          hasVideo: false,
          hasAudio: true,
          warning: 'Microphone active (camera unavailable or blocked by another app).',
        };
      } catch {
        const reason =
          bothErr?.name === 'NotAllowedError'
            ? 'Camera & microphone permission denied. Allow access in your browser address bar, then click Enable Camera.'
            : bothErr?.name === 'NotReadableError'
              ? 'Camera is in use by another app. Close the other app and click Enable Camera.'
              : `Camera/mic unavailable (${bothErr?.name || 'device error'}).`;
        return { stream: null, hasVideo: false, hasAudio: false, warning: reason };
      }
    }
  }
}

export default function ShowRoomPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { presets, guestPresets } = useStudio();

  const [meeting, setMeeting] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [remotePeers, setRemotePeers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roomError, setRoomError] = useState('');
  const [mediaWarning, setMediaWarning] = useState('');

  // Media state (storing localStream in state ensures <video> attaches right after loading finishes!)
  const [localStream, setLocalStream] = useState(null);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);

  // AI Talk Show state
  const [promptText, setPromptText] = useState('');
  const [chatText, setChatText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [askingAi, setAskingAi] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [aiVoiceEnabled, setAiVoiceEnabled] = useState(true);
  const [voiceEngine, setVoiceEngine] = useState('browser'); // 'browser' | 'sounz'
  const [sounzSynthesizing, setSounzSynthesizing] = useState(false);
  const [emotion, setEmotion] = useState('neutral');
  const [lowerThird, setLowerThird] = useState('WELCOME TO TFOUNZ STUDIO');
  const [listeningMic, setListeningMic] = useState(false);
  const [analyserNode, setAnalyserNode] = useState(null);

  // AI Show Notes / Summary state
  const [summaryData, setSummaryData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Rapid-Fire 60s Round state
  const [rapidFireActive, setRapidFireActive] = useState(false);
  const [rapidFireQuestions, setRapidFireQuestions] = useState([]);
  const [rapidFireIdx, setRapidFireIdx] = useState(0);
  const [rapidFireTimer, setRapidFireTimer] = useState(60);
  const [rapidFireScore, setRapidFireScore] = useState(0);

  // UI state
  const [activeTab, setActiveTab] = useState('chat');
  const [copiedCode, setCopiedCode] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  // Stable refs
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const remoteVideoMapRef = useRef(new Map());
  const aiCanvasRef = useRef(null);
  const chatEndRef = useRef(null);
  const meetingIdRef = useRef(null);
  const aiVoiceEnabledRef = useRef(aiVoiceEnabled);
  const voiceEngineRef = useRef(voiceEngine);

  // Attach localStream to <video> whenever loading transitions to false or localStream updates
  useEffect(() => {
    const videoEl = localVideoRef.current;
    if (!videoEl) return;
    if (localStream) {
      if (videoEl.srcObject !== localStream) {
        videoEl.srcObject = localStream;
      }
      videoEl.play().catch(() => {});
    } else {
      videoEl.srcObject = null;
    }
  }, [localStream, loading, camOn]);

  useEffect(() => {
    aiVoiceEnabledRef.current = aiVoiceEnabled;
    if (!aiVoiceEnabled) {
      window.speechSynthesis?.cancel();
      stopAiAudioPlayback();
      setAiSpeaking(false);
    }
  }, [aiVoiceEnabled]);

  useEffect(() => {
    voiceEngineRef.current = voiceEngine;
  }, [voiceEngine]);

  const registerRemoteVideoEl = useCallback((socketId, el) => {
    if (el) remoteVideoMapRef.current.set(socketId, el);
    else remoteVideoMapRef.current.delete(socketId);
  }, []);

  const teardownMediaAndPeers = useCallback(() => {
    window.speechSynthesis?.cancel();
    stopAiAudioPlayback();
    for (const pc of peersRef.current.values()) {
      try {
        pc.close();
      } catch {
        // ignore
      }
    }
    peersRef.current.clear();
    setRemotePeers([]);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setCamOn(false);
    setMicOn(false);
  }, []);

  const speakBrowserFallback = useCallback((text) => {
    if (!window.speechSynthesis || !text) {
      setAiSpeaking(true);
      setTimeout(() => setAiSpeaking(false), 2400);
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.04;
      utter.pitch = 1.0;
      utter.onstart = () => setAiSpeaking(true);
      utter.onend = () => setAiSpeaking(false);
      utter.onerror = () => setAiSpeaking(false);
      window.speechSynthesis.speak(utter);
    } catch {
      setAiSpeaking(false);
    }
  }, []);

  const speakAiReply = useCallback(
    async ({ reply, sfxCue = '', dspVoicePreset = '' }) => {
      if (!reply) return;
      if (!aiVoiceEnabledRef.current) {
        setAiSpeaking(true);
        setTimeout(() => setAiSpeaking(false), 2200);
        return;
      }

      if (voiceEngineRef.current === 'sounz' && meetingIdRef.current) {
        setSounzSynthesizing(true);
        let blobUrl = '';
        try {
          const res = await apiFetch(`/api/ai-show/${meetingIdRef.current}/speak`, {
            method: 'POST',
            body: JSON.stringify({ text: reply, sfxCue, dspVoicePreset }),
          });
          blobUrl = await apiFetchBlobUrl(res.data.downloadUrl);
          setAnalyserNode(getAiAnalyserNode());
          setSounzSynthesizing(false);
          await playAiAudioBlobUrl(blobUrl, {
            onStart: () => setAiSpeaking(true),
            onEnd: () => {
              setAiSpeaking(false);
              if (blobUrl) URL.revokeObjectURL(blobUrl);
            },
          });
          return;
        } catch {
          setSounzSynthesizing(false);
          if (blobUrl) URL.revokeObjectURL(blobUrl);
        }
      }

      speakBrowserFallback(reply);
    },
    [speakBrowserFallback]
  );

  // Rapid-fire countdown
  useEffect(() => {
    if (!rapidFireActive) return;
    if (rapidFireTimer <= 0) {
      setRapidFireActive(false);
      playStudioSfx('buzzer');
      return;
    }
    const id = setInterval(() => setRapidFireTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [rapidFireActive, rapidFireTimer]);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Boot room ONCE per [code, user._id]
  useEffect(() => {
    let active = true;

    const getOrCreatePeer = (targetSocketId, targetName = 'Live Guest') => {
      const existing = peersRef.current.get(targetSocketId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      pc.onicecandidate = (e) => {
        if (e.candidate && socketRef.current) {
          socketRef.current.emit('webrtc:ice-candidate', {
            code,
            targetSocketId,
            candidate: e.candidate,
          });
        }
      };

      pc.ontrack = (e) => {
        const stream = e.streams?.[0];
        if (!stream) return;
        setRemotePeers((prev) => {
          const exists = prev.some((p) => p.socketId === targetSocketId);
          if (exists) {
            return prev.map((p) =>
              p.socketId === targetSocketId ? { ...p, stream, name: targetName || p.name } : p
            );
          }
          return [...prev, { socketId: targetSocketId, name: targetName, stream }];
        });
      };

      pc.onconnectionstatechange = () => {
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
          peersRef.current.delete(targetSocketId);
          setRemotePeers((prev) => prev.filter((p) => p.socketId !== targetSocketId));
        }
      };

      peersRef.current.set(targetSocketId, pc);
      return pc;
    };

    const bootRoom = async () => {
      try {
        const res = await apiFetch(`/api/meetings/code/${encodeURIComponent(code)}`);
        if (!active) return;
        const loadedMeeting = res.data.meeting;
        meetingIdRef.current = loadedMeeting._id;
        setMeeting(loadedMeeting);
        setMessages(res.data.messages || []);
        setLowerThird(
          `${loadedMeeting.aiPersona?.name || 'AI'} • ${loadedMeeting.title}`.toUpperCase()
        );

        if (loadedMeeting.status === 'ended') {
          setRoomError('This show has already ended.');
          setLoading(false);
          return;
        }

        // Request Camera & Mic with graceful fallback
        const media = await requestMediaWithFallback();
        if (!active) {
          media.stream?.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = media.stream;
        setLocalStream(media.stream);
        setCamOn(media.hasVideo);
        setMicOn(media.hasAudio);
        setMediaWarning(media.warning);

        const accessToken = await ensureFreshAccessToken();
        const socket = io(SOCKET_URL || undefined, {
          auth: { token: accessToken },
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          socket.emit('room:join', { code: loadedMeeting.code });
        });

        socket.on('room:joined', ({ participants: roster }) => {
          setParticipants(roster || []);
          socket.emit('webrtc:ready', { code: loadedMeeting.code });
        });

        socket.on('room:participants', ({ participants: list }) => {
          setParticipants(list || []);
        });

        socket.on('chat:message', (msg) => {
          setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
        });

        socket.on('ai:reaction', (payload) => {
          if (payload.emotion) setEmotion(payload.emotion);
          if (payload.lowerThirdText) setLowerThird(payload.lowerThirdText);
          if (payload.rapidFirePoints) {
            setRapidFireScore((s) => s + Number(payload.rapidFirePoints || 0));
          }
          if (payload.sfxCue && voiceEngineRef.current !== 'sounz') {
            playStudioSfx(payload.sfxCue);
          }
          if (payload.reply) {
            speakAiReply({
              reply: payload.reply,
              sfxCue: payload.sfxCue || '',
              dspVoicePreset: payload.dspVoicePreset || '',
            });
          }
        });

        socket.on('sfx:play', ({ sfx }) => {
          playStudioSfx(sfx);
        });

        socket.on('rapid-fire:start', ({ questions, durationSeconds }) => {
          setRapidFireQuestions(questions || []);
          setRapidFireIdx(0);
          setRapidFireScore(0);
          setRapidFireTimer(durationSeconds || 60);
          setRapidFireActive(true);
          playStudioSfx('drumroll');
        });

        socket.on('room:kicked', ({ targetUserId, reason }) => {
          if (targetUserId === user._id) {
            setRoomError(reason || 'You were removed from the show by the host.');
            teardownMediaAndPeers();
            socket.disconnect();
          }
        });

        socket.on('room:ended', () => {
          setMeeting((prev) => (prev ? { ...prev, status: 'ended' } : prev));
          setRoomError(
            'The host has ended this show. Open the Attendance Report or Post-Production Studio!'
          );
          teardownMediaAndPeers();
        });

        socket.on('room:error', ({ message }) => {
          setRoomError(message);
        });

        // Multi-Peer WebRTC Signaling
        socket.on('webrtc:ready', async ({ fromSocketId, name }) => {
          if (!fromSocketId || fromSocketId === socket.id) return;
          try {
            const pc = getOrCreatePeer(fromSocketId, name);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('webrtc:offer', {
              code: loadedMeeting.code,
              targetSocketId: fromSocketId,
              sdp: offer,
            });
          } catch {
            // ignore negotiation race
          }
        });

        socket.on('webrtc:offer', async ({ fromSocketId, name, sdp }) => {
          if (!fromSocketId || !sdp) return;
          try {
            const pc = getOrCreatePeer(fromSocketId, name);
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('webrtc:answer', {
              code: loadedMeeting.code,
              targetSocketId: fromSocketId,
              sdp: answer,
            });
          } catch {
            // ignore negotiation race
          }
        });

        socket.on('webrtc:answer', async ({ fromSocketId, sdp }) => {
          const pc = peersRef.current.get(fromSocketId);
          if (pc && sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp)).catch(() => {});
          }
        });

        socket.on('webrtc:ice-candidate', async ({ fromSocketId, candidate }) => {
          const pc = peersRef.current.get(fromSocketId);
          if (pc && candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          }
        });

        socket.on('webrtc:peer-left', ({ socketId }) => {
          const pc = peersRef.current.get(socketId);
          if (pc) {
            pc.close();
            peersRef.current.delete(socketId);
          }
          setRemotePeers((prev) => prev.filter((p) => p.socketId !== socketId));
        });

        setLoading(false);
      } catch (err) {
        if (active) {
          setRoomError(err.message);
          setLoading(false);
        }
      }
    };

    bootRoom();

    return () => {
      active = false;
      if (socketRef.current) {
        socketRef.current.emit('room:leave');
        socketRef.current.disconnect();
      }
      teardownMediaAndPeers();
    };
  }, [code, user._id, speakAiReply, teardownMediaAndPeers]);

  const isHost =
    Boolean(meeting && user) &&
    (meeting.host?._id === user._id || meeting.host === user._id || isAdmin);

  const aiRole = meeting?.aiRole || 'host';
  const activePreset = [...presets, ...guestPresets].find((p) => p.id === meeting?.showFormat);
  const starterPrompts = activePreset?.starterPrompts || [];

  const retryEnableMedia = async () => {
    setMediaWarning('');
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    const media = await requestMediaWithFallback();
    localStreamRef.current = media.stream;
    setLocalStream(media.stream);
    setCamOn(media.hasVideo);
    setMicOn(media.hasAudio);
    setMediaWarning(media.warning);

    // Notify connected WebRTC peers if new tracks were acquired
    if (media.stream && socketRef.current && meeting?.code) {
      for (const pc of peersRef.current.values()) {
        media.stream.getTracks().forEach((track) => {
          const alreadySending = pc.getSenders().some((s) => s.track?.kind === track.kind);
          if (!alreadySending) pc.addTrack(track, media.stream);
        });
      }
      socketRef.current.emit('webrtc:ready', { code: meeting.code });
    }
  };

  const toggleMic = async () => {
    const track = localStreamRef.current?.getAudioTracks?.()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    } else {
      await retryEnableMedia();
    }
  };

  const toggleCam = async () => {
    const track = localStreamRef.current?.getVideoTracks?.()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    } else {
      await retryEnableMedia();
    }
  };

  const toggleHand = () => {
    setHandRaised((h) => !h);
    socketRef.current?.emit('hand:toggle', { code: meeting.code });
  };

  const handleAskAi = async (e, overrideText = null) => {
    e?.preventDefault();
    const text = (overrideText ?? promptText).trim();
    if (!text || !meeting || askingAi) return;

    setAskingAi(true);
    setPromptText('');
    try {
      await apiFetch(`/api/ai-show/${meeting._id}/respond`, {
        method: 'POST',
        body: JSON.stringify({
          userMessage: text,
          isRapidFire: rapidFireActive,
          saveUserMessage: true,
        }),
      });
      if (rapidFireActive && rapidFireQuestions.length > 0) {
        setRapidFireIdx((i) => (i + 1) % rapidFireQuestions.length);
      }
    } catch (err) {
      setRoomError(err.message);
    } finally {
      setAskingAi(false);
    }
  };

  const handleDictatePrompt = () => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setRoomError('Browser speech recognition is unavailable; type your line below.');
      return;
    }
    const rec = new SpeechRec();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    setListeningMic(true);
    rec.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript || '';
      if (spoken) setPromptText((prev) => (prev ? `${prev} ${spoken}` : spoken));
    };
    rec.onend = () => setListeningMic(false);
    rec.onerror = () => setListeningMic(false);
    rec.start();
  };

  const handleStartRapidFire = async () => {
    if (!meeting) return;
    try {
      await apiFetch(`/api/ai-show/${meeting._id}/rapid-fire`, {
        method: 'POST',
        body: JSON.stringify({ topic: meeting.title }),
      });
    } catch (err) {
      setRoomError(err.message);
    }
  };

  const handleGenerateSummary = async () => {
    if (!meeting) return;
    setLoadingSummary(true);
    try {
      const res = await apiFetch(`/api/ai-show/${meeting._id}/summary`, {
        method: 'POST',
      });
      setSummaryData(res.data);
    } catch (err) {
      setRoomError(err.message);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleSendRoomChat = (e) => {
    e.preventDefault();
    const text = chatText.trim();
    if (!text || !socketRef.current || !meeting) return;
    socketRef.current.emit('chat:send', { code: meeting.code, content: text });
    setChatText('');
  };

  const handleSearchMessages = async (e, overrideQuery = null) => {
    e?.preventDefault();
    if (!meeting) return;
    const q = overrideQuery !== null ? overrideQuery : searchQuery;
    try {
      const res = await apiFetch(
        `/api/meetings/${meeting._id}/messages?q=${encodeURIComponent(q)}`
      );
      setMessages(res.data.messages || []);
    } catch (err) {
      setRoomError(err.message);
    }
  };

  const handleKickUser = (targetUserId) => {
    if (!meeting || !socketRef.current) return;
    socketRef.current.emit('host:remove-participant', {
      code: meeting.code,
      targetUserId,
    });
  };

  const handleEndShow = async () => {
    if (!meeting) return;
    try {
      await apiFetch(`/api/meetings/${meeting._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ended' }),
      });
      teardownMediaAndPeers();
      navigate(`/meetings/${meeting._id}/report`);
    } catch (err) {
      setRoomError(err.message);
    }
  };

  const copyShowCode = () => {
    if (!meeting?.code) return;
    navigator.clipboard?.writeText(meeting.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const openFilmyWithSuggestedPrompt = () => {
    if (!summaryData?.suggestedFilmyPrompt) return;
    setPendingClip({
      videoBlob: null,
      suggestedPrompt: summaryData.suggestedFilmyPrompt,
      meetingId: meeting._id,
      meetingTitle: meeting.title,
    });
    navigate(`/studio/${meeting._id}`);
  };

  if (loading) {
    return (
      <div className="container page-shell">
        <p style={{ color: 'var(--text-secondary)' }}>Entering studio stage...</p>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="container page-shell">
        <div className="alert-error">{roomError || 'Show not found'}</div>
        <Link to="/dashboard" className="btn btn-ghost btn-sm" style={{ marginTop: 14 }}>
          Back to Control Room
        </Link>
      </div>
    );
  }

  const aiLabel = aiRole === 'guest' ? 'AI Guest' : aiRole === 'co-host' ? 'AI Co-Host' : 'AI Host';

  return (
    <div className="container page-shell" style={{ paddingTop: 18 }}>
      {/* Top Broadcast Header */}
      <div
        className="card card-compact"
        style={{
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className={`badge ${meeting.status === 'live' ? 'badge-live' : 'badge-gold'}`}>
            <span className="pulse-dot" /> {meeting.status}
          </span>
          <div>
            <h1 style={{ fontSize: '1.2rem' }}>{meeting.title}</h1>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {aiRole === 'guest' ? 'You are the Show Host interviewing' : 'Hosted by'}{' '}
              <strong>{meeting.aiPersona?.name}</strong> ({aiLabel}) ·{' '}
              {(camOn ? 1 : 0) + remotePeers.length} live camera
              {(camOn ? 1 : 0) + remotePeers.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm mono" onClick={copyShowCode}>
            {copiedCode ? <Check size={14} color="var(--accent-emerald)" /> : <Copy size={14} />}
            {meeting.code}
          </button>

          <button
            type="button"
            className={`btn btn-sm ${voiceEngine === 'sounz' ? 'btn-emerald' : 'btn-ghost'}`}
            onClick={() => setVoiceEngine((v) => (v === 'sounz' ? 'browser' : 'sounz'))}
            title="Switch between Instant Browser Voice and SounZ AI Studio Voice"
          >
            <AudioLines size={14} />
            {voiceEngine === 'sounz'
              ? sounzSynthesizing
                ? 'SounZ AI...'
                : 'SounZ AI Voice'
              : 'Browser Voice'}
          </button>

          <button
            type="button"
            className={`btn btn-sm ${micOn ? 'btn-ghost' : 'btn-crimson'}`}
            onClick={toggleMic}
            title={micOn ? 'Mute Mic' : 'Enable Mic'}
          >
            {micOn ? <Mic size={14} /> : <MicOff size={14} />}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${camOn ? 'btn-ghost' : 'btn-crimson'}`}
            onClick={toggleCam}
            title={camOn ? 'Turn Off Camera' : 'Enable Camera'}
          >
            {camOn ? <Video size={14} /> : <VideoOff size={14} />}
          </button>
          <button type="button" className={`btn btn-sm ${handRaised ? 'btn-primary' : 'btn-ghost'}`} onClick={toggleHand}>
            <Hand size={14} /> {handRaised ? 'Hand Raised' : 'Raise Hand'}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${aiVoiceEnabled ? 'btn-ghost' : 'btn-crimson'}`}
            onClick={() => setAiVoiceEnabled((v) => !v)}
            title={aiVoiceEnabled ? 'Mute AI Speech' : 'Unmute AI Speech'}
          >
            {aiVoiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>

          {isHost && meeting.status !== 'ended' && (
            <button type="button" className="btn btn-crimson btn-sm" onClick={handleEndShow}>
              <PhoneOff size={14} /> End Show
            </button>
          )}
        </div>
      </div>

      {roomError && (
        <div className="alert-error" style={{ marginBottom: 14 }}>
          {roomError}
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="show-layout">
        {/* Left Stage Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Rapid-Fire Banner */}
          {rapidFireActive && (
            <div
              className="card card-compact"
              style={{
                borderColor: 'rgba(255, 77, 109, 0.5)',
                background:
                  'linear-gradient(90deg, rgba(255, 77, 109, 0.16), rgba(245, 176, 65, 0.12))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="badge badge-live">
                      <Zap size={12} /> 60s RAPID-FIRE ROUND
                    </span>
                    <span className="badge badge-gold">
                      <Trophy size={12} /> {rapidFireScore} pts
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.02rem' }}>
                    Q{rapidFireIdx + 1}: {rapidFireQuestions[rapidFireIdx] || 'Answer fast!'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {aiRole === 'guest' && rapidFireQuestions[rapidFireIdx] && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={askingAi}
                      onClick={() => handleAskAi(null, rapidFireQuestions[rapidFireIdx])}
                    >
                      Fire at AI Guest
                    </button>
                  )}
                  <div
                    className="mono"
                    style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--accent-gold)' }}
                  >
                    {rapidFireTimer}s
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Split-Screen TV Couch */}
          <div className="stage-grid">
            <div className="stage-frame">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{ transform: 'scaleX(-1)' }}
              />
              {!camOn && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    padding: 20,
                    textAlign: 'center',
                    background: '#13101e',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <VideoOff size={28} color="var(--text-muted)" />
                  <div style={{ fontWeight: 700 }}>Camera Off ({user?.name})</div>
                  {mediaWarning && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', maxWidth: 280 }}>
                      {mediaWarning}
                    </div>
                  )}
                  {meeting.status !== 'ended' && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={toggleCam}>
                      <Video size={14} /> Enable Camera
                    </button>
                  )}
                </div>
              )}
              <div className="stage-overlay-top">
                <span className="badge">
                  {user?.name} ({aiRole === 'guest' ? 'Show Host' : 'You'})
                </span>
              </div>
            </div>

            <AiHostStage
              avatarStyle={meeting.aiPersona?.avatarStyle}
              hostName={meeting.aiPersona?.name}
              aiRole={aiRole}
              tagline={meeting.aiPersona?.tagline}
              emotion={emotion}
              lowerThirdText={lowerThird}
              isSpeaking={aiSpeaking}
              analyserNode={analyserNode}
              externalCanvasRef={aiCanvasRef}
            />
          </div>

          {/* Multi-Participant WebRTC Remote Video Grid */}
          {(remotePeers.length > 0 || meeting.mode === 'live-studio') && (
            <div className="stage-grid">
              {remotePeers.map((peer) => (
                <RemoteVideoTile
                  key={peer.socketId}
                  peer={peer}
                  registerVideoEl={registerRemoteVideoEl}
                />
              ))}
              {remotePeers.length === 0 && meeting.mode === 'live-studio' && (
                <div
                  className="glass-panel"
                  style={{
                    gridColumn: '1 / -1',
                    padding: '14px 16px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.88rem',
                  }}
                >
                  Invite co-hosts or guests using show code{' '}
                  <strong className="mono" style={{ color: 'var(--accent-gold)' }}>
                    {meeting.code}
                  </strong>{' '}
                  — live WebRTC video tiles appear automatically when they join!
                </div>
              )}
            </div>
          )}

          {/* Talk to AI Host / Guest Controls */}
          <div className="card card-compact">
            <form onSubmit={handleAskAi} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-sm ${listeningMic ? 'btn-crimson' : 'btn-ghost'}`}
                onClick={handleDictatePrompt}
                title="Speak via Web Speech API"
              >
                <Mic size={15} /> {listeningMic ? 'Listening...' : 'Speak'}
              </button>

              <input
                className="input"
                style={{ flex: 1, minWidth: 200 }}
                placeholder={
                  aiRole === 'guest'
                    ? `Interview ${meeting.aiPersona?.name} on air...`
                    : `Say something on air to ${meeting.aiPersona?.name}...`
                }
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                disabled={meeting.status === 'ended'}
              />

              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={askingAi || !promptText.trim() || meeting.status === 'ended'}
              >
                <Sparkles size={15} /> {askingAi ? 'Thinking...' : `Talk to ${aiLabel}`}
              </button>

              <button
                type="button"
                className="btn btn-crimson btn-sm"
                onClick={handleStartRapidFire}
                disabled={meeting.status === 'ended'}
              >
                <Zap size={15} /> Rapid-Fire
              </button>
            </form>

            {/* 1-Click Conversation Starters */}
            {starterPrompts.length > 0 && meeting.status !== 'ended' && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {starterPrompts.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                    disabled={askingAi}
                    onClick={() => handleAskAi(null, starter)}
                  >
                    💬 {starter}
                  </button>
                ))}
              </div>
            )}

            {/* Studio Soundboard */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {SFX_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    playStudioSfx(item.id);
                    socketRef.current?.emit('sfx:trigger', {
                      code: meeting.code,
                      sfx: item.id,
                    });
                  }}
                >
                  {item.emoji} {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Composite Episode Recorder + SounZ AI Live Voice Dub */}
          <BroadcastRecorder
            localVideoRef={localVideoRef}
            aiCanvasRef={aiCanvasRef}
            localStreamRef={localStreamRef}
            remotePeers={remotePeers}
            remoteVideoMapRef={remoteVideoMapRef}
            meetingId={meeting._id}
            meetingTitle={meeting.title}
            hostName={meeting.aiPersona?.name}
            aiRole={aiRole}
            lowerThirdText={lowerThird}
            suggestedFilmyPrompt={summaryData?.suggestedFilmyPrompt || ''}
          />

          <LiveVoiceDubPanel
            meetingId={meeting._id}
            defaultVoiceId={meeting.aiPersona?.sounzVoiceId || 'romantic_hero'}
          />
        </div>

        {/* Right Sidebar: Chat / Audience / Studio Controls */}
        <aside className="card card-compact" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'chat' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1 }}
              onClick={() => setActiveTab('chat')}
            >
              Chat ({messages.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'audience' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1 }}
              onClick={() => setActiveTab('audience')}
            >
              Stage ({participants.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'controls' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1 }}
              onClick={() => setActiveTab('controls')}
            >
              Studio
            </button>
          </div>

          {activeTab === 'chat' && (
            <>
              <form onSubmit={handleSearchMessages} style={{ display: 'flex', gap: 6 }}>
                <input
                  className="input"
                  style={{ padding: '7px 10px', fontSize: '0.82rem' }}
                  placeholder="Search transcript..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    title="Clear Search"
                    onClick={() => {
                      setSearchQuery('');
                      handleSearchMessages(null, '');
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
                <button type="submit" className="btn btn-ghost btn-sm" title="Search Chat">
                  <Search size={14} />
                </button>
              </form>

              <div
                style={{
                  height: 410,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  paddingRight: 4,
                }}
              >
                {messages.map((m) => (
                  <div
                    key={m._id}
                    className="glass-panel"
                    style={{
                      padding: '9px 11px',
                      borderColor:
                        m.senderType === 'ai' ? 'rgba(245, 176, 65, 0.35)' : 'var(--border-subtle)',
                      background:
                        m.senderType === 'ai'
                          ? 'rgba(245, 176, 65, 0.08)'
                          : 'rgba(255, 255, 255, 0.03)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.75rem',
                        marginBottom: 3,
                      }}
                    >
                      <strong
                        style={{
                          color:
                            m.senderType === 'ai' ? 'var(--accent-gold)' : 'var(--accent-cyan)',
                        }}
                      >
                        {m.senderName}
                        {m.senderType === 'ai' ? ` • ${aiLabel.toUpperCase()}` : ''}
                      </strong>
                      {m.isRapidFire && (
                        <span className="badge badge-live" style={{ fontSize: '0.62rem', padding: '1px 6px' }}>
                          Rapid-Fire
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.87rem', lineHeight: 1.45 }}>{m.content}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendRoomChat} style={{ display: 'flex', gap: 6 }}>
                <input
                  className="input"
                  style={{ padding: '9px 12px' }}
                  placeholder="Audience room chat..."
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  disabled={meeting.status === 'ended'}
                />
                <button type="submit" className="btn btn-ghost btn-sm" disabled={meeting.status === 'ended'}>
                  <Send size={15} />
                </button>
              </form>
            </>
          )}

          {activeTab === 'audience' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 460, overflowY: 'auto' }}>
              {participants.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                  Connecting live participant roster...
                </p>
              ) : (
                participants.map((p) => (
                  <div
                    key={p.socketId}
                    className="glass-panel"
                    style={{
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                        {p.name} {p.handRaised ? '✋' : ''}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {p.isHost ? 'Show Host' : p.role}
                      </div>
                    </div>

                    {isHost && p.userId !== user._id && (
                      <button
                        type="button"
                        className="btn btn-crimson btn-sm"
                        onClick={() => handleKickUser(p.userId)}
                        title="Remove from show"
                      >
                        <UserX size={13} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'controls' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="glass-panel" style={{ padding: 12 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Invite Guest Code</div>
                <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: 4 }}>
                  {meeting.code}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-emerald btn-sm"
                onClick={handleGenerateSummary}
                disabled={loadingSummary}
              >
                <FileText size={15} />
                {loadingSummary ? 'Generating AI Show Notes...' : 'Generate AI Episode Notes'}
              </button>

              {summaryData && (
                <div className="glass-panel" style={{ padding: 12, fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-gold)', marginBottom: 6 }}>
                    {summaryData.headline}
                  </div>
                  <ul style={{ margin: '0 0 8px 16px', padding: 0, color: 'var(--text-secondary)' }}>
                    {(summaryData.highlights || []).map((h, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        {h}
                      </li>
                    ))}
                  </ul>
                  <div style={{ fontStyle: 'italic', color: '#fff', marginBottom: 8 }}>
                    “{summaryData.bestQuote}”
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%' }}
                    onClick={openFilmyWithSuggestedPrompt}
                  >
                    <Film size={14} /> Send Prompt to Filmy AI Studio
                  </button>
                </div>
              )}

              <Link to={`/studio/${meeting._id}`} className="btn btn-primary btn-sm">
                <Film size={15} /> Open Post-Production Studio
              </Link>

              {isHost && (
                <Link to={`/meetings/${meeting._id}/report`} className="btn btn-ghost btn-sm">
                  <BarChart3 size={15} /> View Attendance Report
                </Link>
              )}

              {isHost && meeting.status !== 'ended' && (
                <button type="button" className="btn btn-crimson btn-sm" onClick={handleEndShow}>
                  <PhoneOff size={15} /> End Show &amp; Generate Report
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
