import env from '../config/env.js';
import { AppError } from '../middleware/errorMiddleware.js';

export async function checkHealth() {
  try {
    const res = await fetch(`${env.filmyAiUrl}/api/v1/health`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      return { online: false, status: res.status, url: env.filmyAiUrl };
    }
    const payload = await res.json();
    return {
      online: true,
      url: env.filmyAiUrl,
      details: payload,
    };
  } catch (err) {
    return {
      online: false,
      url: env.filmyAiUrl,
      error: err?.name === 'TimeoutError' ? 'Space waking up / timed out' : err.message,
    };
  }
}

export async function uploadVideo(buffer, filename = 'episode.webm', mimetype = 'video/webm') {
  const form = new FormData();
  const blob = new Blob([buffer], { type: mimetype || 'video/webm' });
  form.append('file', blob, filename);

  let res;
  try {
    res = await fetch(`${env.filmyAiUrl}/api/v1/upload/video`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(90000),
    });
  } catch (err) {
    throw new AppError(
      `Filmy AI upload unreachable (${err.message}). If the Hugging Face Space was sleeping, wake it up and retry.`,
      502
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.status === 'error') {
    throw new AppError(
      data?.detail || data?.message || `Filmy AI upload failed (${res.status})`,
      502
    );
  }

  const videoId = data?.video_id || data?.filename || data?.data?.video_id;
  if (!videoId) {
    throw new AppError('Filmy AI did not return a video_id after upload', 502);
  }

  return { videoId, raw: data };
}

export async function instructVideo(videoId, instruction) {
  let res;
  try {
    res = await fetch(`${env.filmyAiUrl}/api/v1/instruct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: videoId, instruction }),
      signal: AbortSignal.timeout(240000),
    });
  } catch (err) {
    throw new AppError(
      `Filmy AI processing timed out or unreachable (${err.message})`,
      504
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.status === 'error') {
    throw new AppError(
      data?.detail || data?.message || `Filmy AI instruct failed (${res.status})`,
      502
    );
  }

  return {
    outputFile: data.output_file,
    processingTimeSeconds: data.processing_time_seconds ?? null,
    operations: data.operations || {},
  };
}

export async function downloadVideoResponse(filename) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safeName || safeName !== filename) {
    throw new AppError('Invalid Filmy AI filename', 400);
  }

  const res = await fetch(
    `${env.filmyAiUrl}/api/v1/download/${encodeURIComponent(safeName)}`,
    { signal: AbortSignal.timeout(90000) }
  );

  if (!res.ok) {
    throw new AppError(`Failed to fetch processed video (${res.status})`, res.status === 404 ? 404 : 502);
  }
  return res;
}
