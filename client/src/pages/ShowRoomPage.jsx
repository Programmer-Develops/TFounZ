import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
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
  ArrowLeft,
  MessageSquare,
  Users,
  Sliders,
  PanelRightClose,
  PanelRightOpen,
  Music2,
  Wifi,
  WifiOff,
  Radio,
  Disc,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStudio } from '../context/StudioContext';
import { useToast } from '../context/ToastContext';
import { apiFetch, apiFetchBlobUrl, ensureFreshAccessToken } from '../utils/api';
import {
  playStudioSfx,
  SFX_OPTIONS,
  playAiAudioBlobUrl,
  stopAiAudioPlayback,
  getAiAnalyserNode,
} from '../utils/soundboard';
import { setPendingClip } from '../utils/clipStore';
import { getStudioPrefs, saveStudioPrefs } from '../utils/studioPrefs';
import AiHostStage from '../components/AiHostStage';
import BroadcastRecorder from '../components/BroadcastRecorder';
import LiveVoiceDubPanel from '../components/LiveVoiceDubPanel';
import PersonaPortrait from '../components/ui/PersonaPortrait';
import { ErrorBanner, LoadingState } from '../components/ui/Primitives';

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || '').replace(/\/+$/, '');

function formatElapsed(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return h > 0 ? `${String(h).padStart(2, '0')}:${m}:${s}` : `${m}:${s}`;
}

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
    <div className="stage-tile">
      <video ref={ref} autoPlay playsInline />
      <div className="stage-tile-top">
        <span className="stage-nameplate">
          <User size={11} color="var(--status-positive)" />
          {peer.name || 'Live Guest'}
        </span>
      </div>
    </div>
  );
}

async function requestMediaWithFallback(prefs = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      stream: null,
      hasVideo: false,
      hasAudio: false,
      warning: 'Camera and microphone require localhost or HTTPS.',
    };
  }

  const videoConstraint = prefs.videoDeviceId
    ? { deviceId: { exact: prefs.videoDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
    : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' };
  const audioConstraint = prefs.audioDeviceId
    ? { deviceId: { exact: prefs.audioDeviceId } }
    : true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraint,
      audio: audioConstraint,
    });
    return {
      stream,
      hasVideo: stream.getVideoTracks().length > 0,
      hasAudio: stream.getAudioTracks().length > 0,
      warning: '',
    };
  } catch (bothErr) {
    try {
      const videoOnly = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      return {
        stream: videoOnly,
        hasVideo: true,
        hasAudio: false,
        warning: 'Camera active. Microphone unavailable or denied.',
      };
    } catch {
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        return {
          stream: audioOnly,
          hasVideo: false,
          hasAudio: true,
          warning: 'Microphone active. Camera unavailable or in use by another app.',
        };
      } catch {
        const reason =
          bothErr?.name === 'NotAllowedError'
            ? 'Camera & microphone permission denied. Allow access in your browser bar, then retry.'
            : bothErr?.name === 'NotReadableError'
              ? 'Camera is in use by another application.'
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
  const { toast } = useToast();

  const initialPrefs = getStudioPrefs();

  const [meeting, setMeeting] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [remotePeers, setRemotePeers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roomError, setRoomError] = useState('');
  const [mediaWarning, setMediaWarning] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [recState, setRecState] = useState({ recording: false, seconds: 0 });

  // Media & Screen Share state
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [mirrorCamera, setMirrorCamera] = useState(initialPrefs.mirrorCamera);
  const [devices, setDevices] = useState({ video: [], audio: [] });
  const [selectedVideoId, setSelectedVideoId] = useState(initialPrefs.videoDeviceId);
  const [selectedAudioId, setSelectedAudioId] = useState(initialPrefs.audioDeviceId);

  // AI Talk Show state
  const [promptText, setPromptText] = useState('');
  const [chatText, setChatText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [askingAi, setAskingAi] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [aiVoiceEnabled, setAiVoiceEnabled] = useState(true);
  const [voiceEngine, setVoiceEngine] = useState(initialPrefs.defaultVoiceEngine || 'browser');
  const [sounzSynthesizing, setSounzSynthesizing] = useState(false);
  const [emotion, setEmotion] = useState('neutral');
  const [lowerThird, setLowerThird] = useState('LIVE BROADCAST');
  const [listeningMic, setListeningMic] = useState(false);
  const [analyserNode, setAnalyserNode] = useState(null);

  // AI Show Notes
  const [summaryData, setSummaryData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Rapid-Fire 60s Round
  const [rapidFireActive, setRapidFireActive] = useState(false);
  const [rapidFireQuestions, setRapidFireQuestions] = useState([]);
  const [rapidFireIdx, setRapidFireIdx] = useState(0);
  const [rapidFireTimer, setRapidFireTimer] = useState(60);
  const [rapidFireScore, setRapidFireScore] = useState(0);

  // Studio Dock & Panel UI
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'audience' | 'audio' | 'notes'
  const [sfxOpen, setSfxOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  // Stable refs
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const remoteVideoMapRef = useRef(new Map());
  const aiCanvasRef = useRef(null);
  const chatEndRef = useRef(null);
  const meetingIdRef = useRef(null);
  const aiVoiceEnabledRef = useRef(aiVoiceEnabled);
  const voiceEngineRef = useRef(voiceEngine);

  // Elapsed studio timer
  useEffect(() => {
    if (!meeting || meeting.status === 'ended') return;
    const id = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [meeting]);

  // Attach localStream to <video> whenever mounted or updated
  useEffect(() => {
    const videoEl = localVideoRef.current;
    if (!videoEl) return;
    if (localStream) {
      if (videoEl.srcObject !== localStream) videoEl.srcObject = localStream;
      videoEl.play().catch(() => {});
    } else {
      videoEl.srcObject = null;
    }
  }, [localStream, loading, camOn]);

  // Attach screenStream to <video>
  useEffect(() => {
    const el = screenVideoRef.current;
    if (!el) return;
    if (screenStream) {
      el.srcObject = screenStream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [screenStream]);

  // Enumerate media devices once stream is active
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        video: list.filter((d) => d.kind === 'videoinput'),
        audio: list.filter((d) => d.kind === 'audioinput'),
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (localStream) refreshDevices();
  }, [localStream, refreshDevices]);

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
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setLocalStream(null);
    setScreenStream(null);
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
      utter.rate = 1.03;
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

  // Rapid-fire timer
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

  // Auto-scroll transcript
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Boot studio ONCE per [code, user._id]
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
          `${loadedMeeting.aiPersona?.name || 'AI'} · ${loadedMeeting.title}`.toUpperCase()
        );

        if (loadedMeeting.status === 'ended') {
          setRoomError('This show has already ended.');
          setLoading(false);
          return;
        }

        const media = await requestMediaWithFallback(getStudioPrefs());
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
          setSocketConnected(true);
          socket.emit('room:join', { code: loadedMeeting.code });
        });

        socket.on('disconnect', () => {
          setSocketConnected(false);
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
          setRoomError('The host has ended this show. View the Attendance Report or Post-Production.');
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
            // ignore race
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
            // ignore race
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

  const switchMediaDevices = async (nextVideoId, nextAudioId) => {
    setMediaWarning('');
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    const prefs = saveStudioPrefs({ videoDeviceId: nextVideoId, audioDeviceId: nextAudioId });
    const media = await requestMediaWithFallback(prefs);
    localStreamRef.current = media.stream;
    setLocalStream(media.stream);
    setCamOn(media.hasVideo);
    setMicOn(media.hasAudio);
    setMediaWarning(media.warning);

    if (media.stream && socketRef.current && meeting?.code) {
      for (const pc of peersRef.current.values()) {
        const senders = pc.getSenders();
        media.stream.getTracks().forEach((track) => {
          const match = senders.find((s) => s.track?.kind === track.kind);
          if (match) match.replaceTrack(track).catch(() => {});
          else pc.addTrack(track, media.stream);
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
      await switchMediaDevices(selectedVideoId, selectedAudioId);
    }
  };

  const toggleCam = async () => {
    const track = localStreamRef.current?.getVideoTracks?.()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    } else {
      await switchMediaDevices(selectedVideoId, selectedAudioId);
    }
  };

  const toggleScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      toast('Screen sharing stopped', 'info');
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast('Screen sharing is not supported in this browser.', 'error');
      return;
    }

    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const [screenTrack] = display.getVideoTracks();
      screenTrack.onended = () => {
        screenStreamRef.current = null;
        setScreenStream(null);
      };
      screenStreamRef.current = display;
      setScreenStream(display);
      toast('Screen share live on broadcast stage', 'success');
    } catch {
      // user cancelled picker
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
      toast('Speech recognition unavailable in this browser; type your line below.', 'error');
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
      toast('60-second Rapid-Fire round started', 'info');
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
      toast('AI episode highlights generated', 'success');
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
    toast('Participant removed from stage', 'info');
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
    toast(`Show code ${meeting.code} copied`, 'success');
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const openPanelTab = (tab) => {
    if (panelOpen && activeTab === tab) {
      setPanelOpen(false);
    } else {
      setActiveTab(tab);
      setPanelOpen(true);
    }
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
      <div className="studio-viewport" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <LoadingState label="Initializing broadcast studio..." />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div style={{ maxWidth: 520, margin: '80px auto', padding: 24 }} className="surface">
        <ErrorBanner message={roomError || 'Show not found'} />
        <Link to="/dashboard" className="btn btn-secondary btn-sm" style={{ marginTop: 14 }}>
          <ArrowLeft size={14} /> Return to Overview
        </Link>
      </div>
    );
  }

  const aiLabel = aiRole === 'guest' ? 'AI Guest' : aiRole === 'co-host' ? 'AI Co-Host' : 'AI Host';
  const totalStageTiles = 2 + (screenStream ? 1 : 0) + remotePeers.length;
  const gridColsClass = totalStageTiles >= 3 ? 'cols-3' : 'cols-2';

  return (
    <div className="studio-viewport">
      {/* Top Broadcast Header */}
      <header className="studio-topbar">
        <div className="studio-topbar-left">
          <Link to="/dashboard" className="btn btn-ghost btn-icon btn-sm" title="Back to Studio Overview">
            <ArrowLeft size={16} />
          </Link>

          <span className={`badge ${meeting.status === 'live' ? 'badge-live' : 'badge-accent'}`}>
            <Radio size={11} /> {meeting.status}
          </span>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: '0.88rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={meeting.title}
            >
              {meeting.title}
            </div>
            <div
              className="studio-topbar-sub"
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {aiRole === 'guest' ? 'Interviewing' : 'Hosted by'} {meeting.aiPersona?.name} ·{' '}
              <span className="mono">{formatElapsed(elapsedSec)}</span>
            </div>
          </div>
        </div>

        <div className="studio-topbar-right">
          {recState.recording && (
            <span className="badge badge-live mono">
              <Disc size={11} /> REC {formatElapsed(recState.seconds)}
            </span>
          )}

          <span
            className={`badge ${socketConnected ? 'badge-positive' : 'badge-warn'}`}
            title="Real-time Studio Connection"
          >
            {socketConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
            {socketConnected ? 'Connected' : 'Reconnecting'}
          </span>

          <button type="button" className="btn btn-secondary btn-sm mono" onClick={copyShowCode}>
            {copiedCode ? <Check size={13} color="var(--status-positive)" /> : <Copy size={13} />}
            {meeting.code}
          </button>

          {isHost && meeting.status !== 'ended' && (
            <button type="button" className="btn btn-danger btn-sm" onClick={handleEndShow}>
              <PhoneOff size={13} /> End Show
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace: Stage + Collapsible Side Panel */}
      <div className="studio-body">
        <div className="studio-stage-area">
          {roomError && <ErrorBanner message={roomError} onDismiss={() => setRoomError('')} />}

          {/* Rapid-Fire Broadcast Ticker */}
          {rapidFireActive && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 14,
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--accent-border)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="badge badge-live">
                    <Zap size={11} /> Rapid-Fire Round
                  </span>
                  <span className="badge badge-accent mono">
                    <Trophy size={11} /> {rapidFireScore} pts
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                  Q{rapidFireIdx + 1}: {rapidFireQuestions[rapidFireIdx] || 'Answer quickly'}
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
                    Ask AI Guest
                  </button>
                )}
                <div className="mono" style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--accent)' }}>
                  00:{String(rapidFireTimer).padStart(2, '0')}
                </div>
              </div>
            </div>
          )}

          {/* Primary Central Video Stage */}
          <div className={`studio-video-grid ${gridColsClass}`}>
            {/* Human Host / Guest Camera Tile */}
            <div className="stage-tile">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{ transform: mirrorCamera ? 'scaleX(-1)' : 'none' }}
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
                    background: '#0F0F13',
                  }}
                >
                  <VideoOff size={24} color="var(--text-muted)" />
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Camera Off</div>
                  {mediaWarning && (
                    <div style={{ fontSize: '0.76rem', color: 'var(--status-warn)', maxWidth: 280 }}>
                      {mediaWarning}
                    </div>
                  )}
                  {meeting.status !== 'ended' && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={toggleCam}>
                      <Video size={13} /> Enable Camera
                    </button>
                  )}
                </div>
              )}
              <div className="stage-tile-top">
                <span className="stage-nameplate">
                  {micOn ? (
                    <Mic size={12} color="var(--status-positive)" />
                  ) : (
                    <MicOff size={12} color="var(--status-live)" />
                  )}
                  {user?.name} ({aiRole === 'guest' ? 'Host' : 'You'})
                </span>
                {handRaised && (
                  <span className="badge badge-accent">
                    <Hand size={11} /> Raised
                  </span>
                )}
              </div>
            </div>

            {/* AI Host / AI Guest Stage */}
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

            {/* Screen Share Feed Tile */}
            {screenStream && (
              <div className="stage-tile">
                <video ref={screenVideoRef} autoPlay playsInline muted />
                <div className="stage-tile-top">
                  <span className="stage-nameplate">
                    <Monitor size={12} color="var(--accent)" /> Shared Screen
                  </span>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ pointerEvents: 'auto', height: 24, padding: '0 8px' }}
                    onClick={toggleScreenShare}
                  >
                    Stop
                  </button>
                </div>
              </div>
            )}

            {/* Multi-Participant WebRTC Remote Video Tiles */}
            {remotePeers.map((peer) => (
              <RemoteVideoTile
                key={peer.socketId}
                peer={peer}
                registerVideoEl={registerRemoteVideoEl}
              />
            ))}
          </div>

          {/* Conversation Command Bar */}
          <div className="studio-command-bar">
            <form onSubmit={handleAskAi} className="studio-command-form">
              <button
                type="button"
                className={`btn btn-sm ${listeningMic ? 'btn-danger' : 'btn-secondary'}`}
                onClick={handleDictatePrompt}
                title="Voice-to-text dictation"
              >
                <Mic size={13} /> {listeningMic ? 'Listening' : 'Dictate'}
              </button>

              <input
                className="input"
                style={{ flex: 1, minWidth: 110, height: 32, fontSize: '0.82rem' }}
                placeholder={
                  aiRole === 'guest'
                    ? `Ask ${meeting.aiPersona?.name} a question...`
                    : `Speak or type to ${meeting.aiPersona?.name}...`
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
                <Sparkles size={13} /> {askingAi ? 'Responding...' : `Ask ${aiLabel}`}
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleStartRapidFire}
                disabled={meeting.status === 'ended'}
              >
                <Zap size={13} color="var(--accent)" /> Rapid-Fire
              </button>
            </form>

            {starterPrompts.length > 0 && meeting.status !== 'ended' && (
              <div className="studio-prompt-row">
                {starterPrompts.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    className="btn btn-ghost btn-sm studio-prompt-chip"
                    disabled={askingAi}
                    onClick={() => handleAskAi(null, starter)}
                  >
                    {starter}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Right Studio Panel */}
        {panelOpen && (
          <aside className="studio-sidepanel">
            <div className="studio-sidepanel-tabs">
              {[
                { id: 'chat', label: 'Chat', icon: MessageSquare },
                { id: 'audience', label: `Stage (${participants.length})`, icon: Users },
                { id: 'audio', label: 'Audio', icon: Sliders },
                { id: 'notes', label: 'Notes', icon: FileText },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`btn btn-sm ${activeTab === id ? 'btn-secondary' : 'btn-ghost'}`}
                  style={{
                    borderColor: activeTab === id ? 'var(--border-default)' : 'transparent',
                    color: activeTab === id ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                  onClick={() => setActiveTab(id)}
                >
                  <Icon size={12} style={{ flexShrink: 0 }} /> {label}
                </button>
              ))}
            </div>

            {/* Tab 1: Transcript & Room Chat */}
            {activeTab === 'chat' && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 12, gap: 10 }}>
                <form onSubmit={handleSearchMessages} style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="input"
                    style={{ height: 32, fontSize: '0.8rem' }}
                    placeholder="Search transcript..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => {
                        setSearchQuery('');
                        handleSearchMessages(null, '');
                      }}
                      title="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                  <button type="submit" className="btn btn-secondary btn-icon btn-sm" title="Search">
                    <Search size={13} />
                  </button>
                </form>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {messages.map((m) => (
                    <div
                      key={m._id}
                      style={{
                        padding: '9px 11px',
                        borderRadius: 'var(--radius-sm)',
                        background:
                          m.senderType === 'ai' ? 'rgba(201, 169, 110, 0.06)' : 'var(--bg-surface)',
                        border:
                          m.senderType === 'ai'
                            ? '1px solid var(--accent-border)'
                            : '1px solid var(--border-subtle)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 4,
                          fontSize: '0.72rem',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            color: m.senderType === 'ai' ? 'var(--accent)' : 'var(--text-primary)',
                          }}
                        >
                          {m.senderName}
                          {m.senderType === 'ai' ? ` · ${aiLabel}` : ''}
                        </span>
                        {m.isRapidFire && (
                          <span className="badge badge-live" style={{ height: 18, fontSize: '0.62rem' }}>
                            Rapid-Fire
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.48 }}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleSendRoomChat} style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="input"
                    style={{ height: 34, fontSize: '0.82rem' }}
                    placeholder="Message studio room..."
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    disabled={meeting.status === 'ended'}
                  />
                  <button
                    type="submit"
                    className="btn btn-secondary btn-icon btn-sm"
                    style={{ height: 34, width: 34 }}
                    disabled={meeting.status === 'ended'}
                  >
                    <Send size={14} />
                  </button>
                </form>
              </div>
            )}

            {/* Tab 2: Stage Participants */}
            {activeTab === 'audience' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="eyebrow" style={{ marginBottom: 2 }}>
                  Live Roster ({participants.length})
                </div>
                {participants.map((p) => (
                  <div
                    key={p.socketId}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {p.name}
                        {p.handRaised && <Hand size={13} color="var(--accent)" />}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {p.isHost ? 'Show Host' : p.role}
                      </div>
                    </div>
                    {isHost && p.userId !== user._id && (
                      <button
                        type="button"
                        className="btn btn-danger btn-icon btn-sm"
                        onClick={() => handleKickUser(p.userId)}
                        title="Remove participant"
                      >
                        <UserX size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Tab 3: AI & Audio Settings */}
            {activeTab === 'audio' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: 10,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <PersonaPortrait styleKey={meeting.aiPersona?.avatarStyle} size={44} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{meeting.aiPersona?.name}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{aiLabel} · {meeting.showFormat}</div>
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">AI Voice Synthesis Engine</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${voiceEngine === 'browser' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => setVoiceEngine('browser')}
                    >
                      Instant Browser
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${voiceEngine === 'sounz' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => setVoiceEngine('sounz')}
                    >
                      <AudioLines size={13} /> SounZ AI
                    </button>
                  </div>
                </div>

                {devices.video.length > 0 && (
                  <div className="field">
                    <label className="field-label" htmlFor="studio-cam-select">
                      Camera Source
                    </label>
                    <select
                      id="studio-cam-select"
                      className="select"
                      style={{ height: 34, fontSize: '0.8rem' }}
                      value={selectedVideoId}
                      onChange={(e) => {
                        setSelectedVideoId(e.target.value);
                        switchMediaDevices(e.target.value, selectedAudioId);
                      }}
                    >
                      <option value="">System Default Camera</option>
                      {devices.video.map((d, idx) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {devices.audio.length > 0 && (
                  <div className="field">
                    <label className="field-label" htmlFor="studio-mic-select">
                      Microphone Source
                    </label>
                    <select
                      id="studio-mic-select"
                      className="select"
                      style={{ height: 34, fontSize: '0.8rem' }}
                      value={selectedAudioId}
                      onChange={(e) => {
                        setSelectedAudioId(e.target.value);
                        switchMediaDevices(selectedVideoId, e.target.value);
                      }}
                    >
                      <option value="">System Default Microphone</option>
                      {devices.audio.map((d, idx) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Microphone ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <span>Mirror self-view camera</span>
                  <input
                    type="checkbox"
                    checked={mirrorCamera}
                    onChange={(e) => {
                      setMirrorCamera(e.target.checked);
                      saveStudioPrefs({ mirrorCamera: e.target.checked });
                    }}
                  />
                </label>

                <LiveVoiceDubPanel
                  meetingId={meeting._id}
                  defaultVoiceId={meeting.aiPersona?.sounzVoiceId || 'romantic_hero'}
                />
              </div>
            )}

            {/* Tab 4: Notes & Post-Production */}
            {activeTab === 'notes' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleGenerateSummary}
                  disabled={loadingSummary}
                >
                  <Sparkles size={13} />
                  {loadingSummary ? 'Generating Highlights...' : 'Generate AI Show Notes'}
                </button>

                {summaryData && (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--accent)' }}>
                      {summaryData.headline}
                    </div>
                    <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {(summaryData.highlights || []).map((h, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>
                          {h}
                        </li>
                      ))}
                    </ul>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        fontStyle: 'italic',
                        borderLeft: '2px solid var(--accent)',
                        paddingLeft: 8,
                        color: 'var(--text-primary)',
                      }}
                    >
                      “{summaryData.bestQuote}”
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={openFilmyWithSuggestedPrompt}
                    >
                      <Film size={13} /> Send Director Prompt to Filmy AI
                    </button>
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Link to={`/studio/${meeting._id}`} className="btn btn-secondary btn-sm">
                    <Film size={13} /> Open Post-Production Lab
                  </Link>
                  {isHost && (
                    <Link to={`/meetings/${meeting._id}/report`} className="btn btn-secondary btn-sm">
                      <BarChart3 size={13} /> Attendance &amp; Engagement Report
                    </Link>
                  )}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Bottom Riverside-Style Production Dock */}
      <footer className="studio-dock">
        {/* Left: Participant Media Controls */}
        <div className="dock-group">
          <button
            type="button"
            className={`btn btn-sm ${micOn ? 'btn-secondary' : 'btn-danger'}`}
            onClick={toggleMic}
            title={micOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            {micOn ? <Mic size={14} /> : <MicOff size={14} />}
            <span>{micOn ? 'Mic' : 'Muted'}</span>
          </button>

          <button
            type="button"
            className={`btn btn-sm ${camOn ? 'btn-secondary' : 'btn-danger'}`}
            onClick={toggleCam}
            title={camOn ? 'Disable camera' : 'Enable camera'}
          >
            {camOn ? <Video size={14} /> : <VideoOff size={14} />}
            <span>{camOn ? 'Camera' : 'Off'}</span>
          </button>

          <button
            type="button"
            className={`btn btn-sm ${screenStream ? 'btn-primary' : 'btn-secondary'}`}
            onClick={toggleScreenShare}
            title="Share screen onto broadcast stage"
          >
            {screenStream ? <MonitorOff size={14} /> : <Monitor size={14} />}
            <span>{screenStream ? 'Stop Share' : 'Share'}</span>
          </button>

          <button
            type="button"
            className={`btn btn-sm ${handRaised ? 'btn-primary' : 'btn-secondary'}`}
            onClick={toggleHand}
            title="Raise hand on stage"
          >
            <Hand size={14} />
          </button>
        </div>

        {/* Center: Recording, Soundboard & AI Audio */}
        <div className="dock-group" style={{ position: 'relative' }}>
          <BroadcastRecorder
            localVideoRef={localVideoRef}
            aiCanvasRef={aiCanvasRef}
            screenVideoRef={screenVideoRef}
            localStreamRef={localStreamRef}
            remotePeers={remotePeers}
            remoteVideoMapRef={remoteVideoMapRef}
            meetingId={meeting._id}
            meetingTitle={meeting.title}
            hostName={meeting.aiPersona?.name}
            aiRole={aiRole}
            lowerThirdText={lowerThird}
            suggestedFilmyPrompt={summaryData?.suggestedFilmyPrompt || ''}
            onRecordingStateChange={setRecState}
          />

          <button
            type="button"
            className={`btn btn-sm ${sfxOpen ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSfxOpen((o) => !o)}
          >
            <Music2 size={14} /> SFX
          </button>

          {sfxOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: 46,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: 8,
                display: 'flex',
                gap: 6,
                boxShadow: 'var(--shadow-lg)',
                zIndex: 40,
                flexWrap: 'wrap',
                minWidth: 340,
                justifyContent: 'center',
              }}
            >
              {SFX_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    playStudioSfx(item.id);
                    socketRef.current?.emit('sfx:trigger', { code: meeting.code, sfx: item.id });
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className={`btn btn-sm ${voiceEngine === 'sounz' ? 'btn-positive' : 'btn-secondary'}`}
            onClick={() => setVoiceEngine((v) => (v === 'sounz' ? 'browser' : 'sounz'))}
            title="Switch between Browser speech and SounZ AI synthesis"
          >
            <AudioLines size={14} />
            {voiceEngine === 'sounz' ? (sounzSynthesizing ? 'Synthesizing...' : 'SounZ Voice') : 'Browser Voice'}
          </button>

          <button
            type="button"
            className={`btn btn-icon btn-sm ${aiVoiceEnabled ? 'btn-secondary' : 'btn-danger'}`}
            onClick={() => setAiVoiceEnabled((v) => !v)}
            title={aiVoiceEnabled ? 'Mute AI output' : 'Unmute AI output'}
          >
            {aiVoiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
        </div>

        {/* Right: Panel Controls */}
        <div className="dock-group">
          <button
            type="button"
            className={`btn btn-icon btn-sm ${panelOpen && activeTab === 'chat' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => openPanelTab('chat')}
            title="Transcript"
          >
            <MessageSquare size={14} />
          </button>
          <button
            type="button"
            className={`btn btn-icon btn-sm ${panelOpen && activeTab === 'audience' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => openPanelTab('audience')}
            title="Stage Participants"
          >
            <Users size={14} />
          </button>
          <button
            type="button"
            className={`btn btn-icon btn-sm ${panelOpen && activeTab === 'audio' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => openPanelTab('audio')}
            title="AI & Audio Settings"
          >
            <Sliders size={14} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => setPanelOpen((o) => !o)}
            title={panelOpen ? 'Expand stage' : 'Open studio panel'}
          >
            {panelOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </button>
        </div>
      </footer>
    </div>
  );
}
