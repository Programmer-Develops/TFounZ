import env from '../config/env.js';
import { AppError } from '../middleware/errorMiddleware.js';

const FALLBACK_VOICES = {
  cartoon_anime_rvc: [
    { id: 'shinchan', label: 'Shinchan (Cartoon)', emoji: '🖍️', category: 'cartoon' },
    { id: 'doraemon', label: 'Doraemon (Cartoon)', emoji: '🔔', category: 'cartoon' },
    { id: 'gojo', label: 'Gojo Satoru (JJK)', emoji: '🤞', category: 'anime' },
    { id: 'goku', label: 'Goku (Dragon Ball Z)', emoji: '🔥', category: 'anime' },
    { id: 'naruto', label: 'Naruto Uzumaki (Anime)', emoji: '🍥', category: 'anime' },
  ],
  human_actor_zero_shot: [
    { id: 'romantic_hero', label: 'SRK / King Romance Style', emoji: '💫', category: 'human' },
    { id: 'bollywood_baritone', label: 'Amitabh / Megastar Baritone', emoji: '🎙️', category: 'human' },
    { id: 'desi_gamer', label: 'Desi Gamer (Techno / Carry Vibe)', emoji: '🎮', category: 'human' },
    { id: 'cricket_captain', label: 'Cricket Captain (Virat / Mahi Vibe)', emoji: '🏏', category: 'human' },
    { id: 'bollywood_diva', label: 'Alia / Gen-Z Actress', emoji: '💃', category: 'human' },
    { id: 'expressive_host', label: 'Expressive Show Host', emoji: '🎤', category: 'human' },
  ],
  dsp_presets: [
    { id: 'chipmunk', label: 'Chipmunk', emoji: '🐿️' },
    { id: 'deep', label: 'Deep Bass', emoji: '🔊' },
    { id: 'robot', label: 'Robot Synth', emoji: '🤖' },
    { id: 'radio', label: 'Vintage Radio', emoji: '📻' },
  ],
};

const VALID_DSP_PRESETS = new Set(['chipmunk', 'deep', 'robot', 'reverb', 'radio']);
const SOUNZ_SFX_MAP = {
  applause: 'applause',
  laugh: 'laughter',
  drumroll: 'whoosh',
  rimshot: 'ding',
  buzzer: 'beep',
};

function buildSilentSeedWav(durationSec = 0.1, sampleRate = 16000) {
  const numSamples = Math.max(160, Math.floor(sampleRate * durationSec));
  const buf = Buffer.alloc(44 + numSamples * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + numSamples * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(numSamples * 2, 40);
  return buf;
}

export async function checkHealth() {
  try {
    const res = await fetch(`${env.sounzAiUrl}/api/v1/health`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      return { online: false, status: res.status, url: env.sounzAiUrl };
    }
    const payload = await res.json();
    return {
      online: true,
      url: env.sounzAiUrl,
      details: payload?.data || payload,
    };
  } catch (err) {
    return {
      online: false,
      url: env.sounzAiUrl,
      error: err?.name === 'TimeoutError' ? 'Space waking up / timed out' : err.message,
    };
  }
}

export async function getVoices() {
  try {
    const res = await fetch(`${env.sounzAiUrl}/api/v1/voices`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { ...FALLBACK_VOICES, fallback: true };
    }
    const payload = await res.json();
    return { ...(payload?.data || FALLBACK_VOICES), fallback: false };
  } catch {
    return { ...FALLBACK_VOICES, fallback: true };
  }
}

export async function uploadAudio(buffer, filename = 'recording.wav', mimetype = 'audio/wav') {
  const form = new FormData();
  const blob = new Blob([buffer], { type: mimetype || 'audio/wav' });
  form.append('file', blob, filename);

  let res;
  try {
    res = await fetch(`${env.sounzAiUrl}/api/v1/upload/audio`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(60000),
    });
  } catch (err) {
    throw new AppError(
      `SounZ AI upload unreachable (${err.message}). If the Hugging Face Space was sleeping, wait 30s and retry.`,
      502
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AppError(
      data?.detail || data?.message || `SounZ AI upload failed (${res.status})`,
      res.status >= 400 && res.status < 500 ? 400 : 502
    );
  }

  const audioId =
    data?.data?.metadata?.audio_id || data?.data?.audio_id || data?.audio_id;
  if (!audioId) {
    throw new AppError('SounZ AI did not return an audio_id after upload', 502);
  }

  return { audioId, metadata: data?.data?.metadata || data?.data || {} };
}

export async function processInstruction(audioId, instruction) {
  let res;
  try {
    res = await fetch(`${env.sounzAiUrl}/api/v1/process/instruction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_id: audioId, instruction }),
      signal: AbortSignal.timeout(240000),
    });
  } catch (err) {
    throw new AppError(
      `SounZ AI processing timed out or unreachable (${err.message})`,
      504
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.status === 'error') {
    throw new AppError(
      data?.detail || data?.message || `SounZ AI processing failed (${res.status})`,
      502
    );
  }

  return {
    outputFilename: data.output_filename,
    operations: data.operations || [],
    remoteDownloadUrl: data.download_url,
  };
}

/**
 * Live AI Talk Show speech synthesis via SounZ AI's structured /process/operations endpoint
 * (`voice_clone` -> trim seed silence -> optional fast DSP voice_changer -> optional inject_sfx -> normalize).
 * Verified live at ~3 seconds on the hosted Hugging Face Space.
 */
export async function synthesizeSpeechWithSounz({
  text,
  dspVoicePreset = '',
  sfxCue = '',
}) {
  const cleanText = String(text || '').trim().slice(0, 420);
  if (!cleanText) {
    throw new AppError('Text is required for SounZ AI speech synthesis', 400);
  }

  const seedWav = buildSilentSeedWav(0.1, 16000);
  const { audioId } = await uploadAudio(seedWav, 'ai_seed.wav', 'audio/wav');

  const operations = [
    {
      operation_type: 'voice_clone',
      parameters: { text: cleanText, position: 'append' },
    },
    {
      operation_type: 'trim',
      parameters: { start_time: 0.35 },
    },
  ];

  if (dspVoicePreset && VALID_DSP_PRESETS.has(dspVoicePreset)) {
    operations.push({
      operation_type: 'voice_changer',
      parameters: { preset: dspVoicePreset },
    });
  }

  const mappedSfx = SOUNZ_SFX_MAP[sfxCue];
  if (mappedSfx) {
    operations.push({
      operation_type: 'inject_sfx',
      parameters: { sfx_name: mappedSfx, position: 'end', gain_db: -6.0 },
    });
  }

  operations.push({
    operation_type: 'normalize',
    parameters: { headroom: -0.1 },
  });

  let res;
  try {
    res = await fetch(`${env.sounzAiUrl}/api/v1/process/operations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(35000),
      body: JSON.stringify({
        audio_id: audioId,
        output_format: 'mp3',
        operations,
      }),
    });
  } catch (err) {
    throw new AppError(`SounZ AI speech synthesis timed out (${err.message})`, 504);
  }

  const data = await res.json().catch(() => ({}));
  const outputFilename = data?.data?.output_filename || data?.output_filename;
  if (!res.ok || data?.status === 'error' || !outputFilename) {
    throw new AppError(
      data?.detail || data?.message || `SounZ AI synthesis failed (${res.status})`,
      502
    );
  }

  return {
    audioId,
    outputFilename,
    proxyDownloadUrl: `/api/studio/sounz/download/${encodeURIComponent(outputFilename)}`,
  };
}

export async function downloadAudioResponse(filename) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safeName || safeName !== filename) {
    throw new AppError('Invalid SounZ AI filename', 400);
  }

  const res = await fetch(
    `${env.sounzAiUrl}/api/v1/download/${encodeURIComponent(safeName)}`,
    { signal: AbortSignal.timeout(60000) }
  );

  if (!res.ok) {
    throw new AppError(
      `Failed to fetch processed audio (${res.status})`,
      res.status === 404 ? 404 : 502
    );
  }
  return res;
}
