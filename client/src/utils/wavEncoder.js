/**
 * Encode Float32Array PCM samples into a genuine 16-bit mono WAV Blob.
 * Required because SounZ AI's /api/v1/upload/audio validates wav/mp3/ogg/flac/m4a
 * and rejects browser MediaRecorder .webm audio containers.
 */
export function encodeSamplesToWav(samples, sampleRate = 44100) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function blobToWavFile(audioBlob, filename = 'recording.wav') {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    // Mix down to mono
    const length = audioBuffer.length;
    const mono = new Float32Array(length);
    const channels = audioBuffer.numberOfChannels;
    for (let c = 0; c < channels; c++) {
      const chData = audioBuffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        mono[i] += chData[i] / channels;
      }
    }

    const wavBlob = encodeSamplesToWav(mono, audioBuffer.sampleRate);
    return new File([wavBlob], filename, { type: 'audio/wav' });
  } finally {
    await ctx.close().catch(() => {});
  }
}
