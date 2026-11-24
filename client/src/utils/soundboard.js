let sharedCtx = null;
let sharedBroadcastDest = null;
let sharedAiAnalyser = null;
let activeAiSource = null;

function ensureAudioGraph() {
  if (!sharedCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    sharedCtx = new AudioCtx();
    sharedBroadcastDest = sharedCtx.createMediaStreamDestination();
    sharedAiAnalyser = sharedCtx.createAnalyser();
    sharedAiAnalyser.fftSize = 256;
    sharedAiAnalyser.smoothingTimeConstant = 0.72;
  }
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume().catch(() => {});
  }
  return { ctx: sharedCtx, dest: sharedBroadcastDest, analyser: sharedAiAnalyser };
}

export function getAiAnalyserNode() {
  const g = ensureAudioGraph();
  return g ? g.analyser : null;
}

function connectToOutputs(node, graph) {
  node.connect(graph.ctx.destination);
  if (graph.dest) {
    node.connect(graph.dest);
  }
}

function playTone(graph, freq, startTime, duration, type = 'triangle', gainVal = 0.14) {
  const osc = graph.ctx.createOscillator();
  const gain = graph.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(gainVal, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  connectToOutputs(gain, graph);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

function playNoiseBurst(graph, startTime, duration, filterFreq = 1200, gainVal = 0.08) {
  const { ctx } = graph;
  const sampleCount = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(filterFreq, startTime);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainVal, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  src.connect(filter);
  filter.connect(gain);
  connectToOutputs(gain, graph);
  src.start(startTime);
}

export const SFX_OPTIONS = [
  { id: 'applause', label: 'Applause' },
  { id: 'laugh', label: 'Studio Laugh' },
  { id: 'drumroll', label: 'Drumroll' },
  { id: 'rimshot', label: 'Rimshot' },
  { id: 'sip_tea', label: 'Chai Sip' },
  { id: 'buzzer', label: 'Buzzer' },
];

export function playStudioSfx(sfx) {
  const graph = ensureAudioGraph();
  if (!graph || !sfx) return;
  const now = graph.ctx.currentTime;

  switch (sfx) {
    case 'applause': {
      for (let i = 0; i < 8; i++) {
        playNoiseBurst(graph, now + i * 0.09, 0.22, 1600 + (i % 3) * 400, 0.09);
      }
      break;
    }
    case 'laugh': {
      [520, 460, 540, 420, 490].forEach((f, idx) => {
        playTone(graph, f, now + idx * 0.11, 0.09, 'sine', 0.12);
      });
      break;
    }
    case 'drumroll': {
      for (let i = 0; i < 10; i++) {
        playTone(graph, 130 + i * 6, now + i * 0.06, 0.05, 'triangle', 0.11);
      }
      break;
    }
    case 'rimshot': {
      playTone(graph, 160, now, 0.08, 'triangle', 0.2);
      playTone(graph, 210, now + 0.13, 0.08, 'triangle', 0.2);
      playNoiseBurst(graph, now + 0.26, 0.45, 3200, 0.13);
      break;
    }
    case 'sip_tea': {
      playNoiseBurst(graph, now, 0.22, 2400, 0.06);
      playTone(graph, 880, now + 0.26, 0.18, 'sine', 0.09);
      break;
    }
    case 'buzzer': {
      playTone(graph, 185, now, 0.42, 'sawtooth', 0.15);
      playTone(graph, 194, now, 0.42, 'sawtooth', 0.12);
      break;
    }
    default:
      break;
  }
}

export function stopAiAudioPlayback() {
  if (activeAiSource) {
    try {
      activeAiSource.stop();
    } catch {
      // ignore if already stopped
    }
    activeAiSource = null;
  }
}

/**
 * Plays a SounZ AI audio Blob URL through the shared AudioContext:
 * - Drives live AnalyserNode for true audio-frequency avatar lip-sync
 * - Routes into speakers AND sharedBroadcastDest for BroadcastRecorder capture
 */
export async function playAiAudioBlobUrl(blobUrl, { onStart, onEnd } = {}) {
  const graph = ensureAudioGraph();
  if (!graph) {
    onEnd?.();
    return;
  }

  stopAiAudioPlayback();

  const res = await fetch(blobUrl);
  const arrayBuf = await res.arrayBuffer();
  const audioBuffer = await graph.ctx.decodeAudioData(arrayBuf);

  const src = graph.ctx.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(graph.analyser);
  graph.analyser.connect(graph.ctx.destination);
  if (graph.dest) {
    graph.analyser.connect(graph.dest);
  }

  activeAiSource = src;
  onStart?.();
  src.onended = () => {
    if (activeAiSource === src) activeAiSource = null;
    onEnd?.();
  };
  src.start();
}

/**
 * Creates a live mixed audio track combining:
 * - SounZ AI speech & Studio Soundboard SFX (sharedBroadcastDest)
 * - Local microphone stream
 * - Connected WebRTC remote guest audio streams
 */
export function createBroadcastMixedAudio(micStream, remotePeers = []) {
  const graph = ensureAudioGraph();
  if (!graph) {
    return { tracks: micStream?.getAudioTracks?.() || [], cleanup: () => {} };
  }

  const mixDest = graph.ctx.createMediaStreamDestination();
  const connectedNodes = [];

  try {
    if (graph.dest?.stream?.getAudioTracks().length) {
      const studioSrc = graph.ctx.createMediaStreamSource(graph.dest.stream);
      studioSrc.connect(mixDest);
      connectedNodes.push(studioSrc);
    }
  } catch {
    // ignore
  }

  if (micStream && micStream.getAudioTracks().length > 0) {
    try {
      const micSrc = graph.ctx.createMediaStreamSource(micStream);
      micSrc.connect(mixDest);
      connectedNodes.push(micSrc);
    } catch {
      // ignore
    }
  }

  for (const peer of remotePeers || []) {
    if (peer?.stream && peer.stream.getAudioTracks().length > 0) {
      try {
        const peerSrc = graph.ctx.createMediaStreamSource(peer.stream);
        peerSrc.connect(mixDest);
        connectedNodes.push(peerSrc);
      } catch {
        // ignore
      }
    }
  }

  return {
    tracks: mixDest.stream.getAudioTracks(),
    cleanup: () => {
      connectedNodes.forEach((n) => {
        try {
          n.disconnect();
        } catch {
          // ignore
        }
      });
    },
  };
}
