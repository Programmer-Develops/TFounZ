import path from 'path';
import { Readable } from 'stream';
import mongoose from 'mongoose';
import ProductionJob from '../models/ProductionJob.js';
import env from '../config/env.js';
import * as sounzService from '../services/sounzService.js';
import * as filmyService from '../services/filmyService.js';
import { AppError, asyncHandler } from '../middleware/errorMiddleware.js';

const SUPPORTED_AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a']);
const SUPPORTED_VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv']);

function parseOptionalMeetingId(raw) {
  if (!raw) return null;
  if (!mongoose.isValidObjectId(raw)) {
    throw new AppError(`Invalid meetingId: ${raw}`, 400);
  }
  return raw;
}

function streamUpstreamResponse(upstream, res, fallbackContentType, filename) {
  const contentType = upstream.headers.get('content-type') || fallbackContentType;
  const contentLength = upstream.headers.get('content-length');

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  if (contentLength) {
    res.setHeader('Content-Length', contentLength);
  }

  if (upstream.body) {
    const nodeStream = Readable.fromWeb(upstream.body);
    nodeStream.on('error', () => {
      if (!res.headersSent) res.status(502).end();
      else res.end();
    });
    nodeStream.pipe(res);
    return;
  }

  res.status(502).json({ status: 'error', message: 'Upstream returned empty media stream' });
}

export const getStudioHealth = asyncHandler(async (_req, res) => {
  const [filmy, sounz] = await Promise.all([
    filmyService.checkHealth(),
    sounzService.checkHealth(),
  ]);

  const geminiConfigured =
    Boolean(env.geminiApiKey) &&
    !env.geminiApiKey.toLowerCase().includes('your_gemini_api_key');

  res.json({
    status: 'success',
    data: {
      filmyAi: filmy,
      sounzAi: sounz,
      gemini: { configured: geminiConfigured, model: env.geminiModel },
    },
  });
});

export const getSounzVoices = asyncHandler(async (_req, res) => {
  const voices = await sounzService.getVoices();
  res.json({
    status: 'success',
    data: voices,
  });
});

export const getProductionJobs = asyncHandler(async (req, res) => {
  const filter = { createdBy: req.user._id };
  if (req.query.meetingId) {
    filter.meeting = parseOptionalMeetingId(req.query.meetingId);
  }

  const jobs = await ProductionJob.find(filter)
    .populate('meeting', 'title code')
    .sort({ createdAt: -1 })
    .limit(40);

  res.json({
    status: 'success',
    data: { jobs },
  });
});

export const processWithSounzAi = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Audio file is required (field name: file)', 400);
  }

  const instruction = String(req.body.instruction || '').trim();
  if (!instruction) {
    throw new AppError('Natural-language audio instruction is required', 400);
  }

  const meetingId = parseOptionalMeetingId(req.body.meetingId);

  const ext = path.extname(req.file.originalname || '').toLowerCase();
  if (!SUPPORTED_AUDIO_EXTS.has(ext)) {
    throw new AppError(
      `Unsupported audio format '${ext || 'unknown'}'. SounZ AI supports: mp3, wav, ogg, flac, m4a`,
      400
    );
  }

  const job = await ProductionJob.create({
    meeting: meetingId,
    createdBy: req.user._id,
    engine: 'sounz-ai',
    instruction,
    voiceId: req.body.voiceId || '',
    status: 'processing',
  });

  try {
    const { audioId } = await sounzService.uploadAudio(
      req.file.buffer,
      req.file.originalname || 'recording.wav',
      req.file.mimetype
    );

    const processed = await sounzService.processInstruction(audioId, instruction);
    const proxyDownloadUrl = `/api/studio/sounz/download/${encodeURIComponent(
      processed.outputFilename
    )}`;

    job.status = 'completed';
    job.remoteFileId = audioId;
    job.remoteOutputFilename = processed.outputFilename;
    job.proxyDownloadUrl = proxyDownloadUrl;
    job.operationsApplied = processed.operations;
    await job.save();

    res.status(201).json({
      status: 'success',
      message: 'Audio processed with SounZ AI',
      data: {
        job,
        downloadUrl: proxyDownloadUrl,
        operations: processed.operations,
      },
    });
  } catch (err) {
    job.status = 'failed';
    job.errorMessage = err.message;
    await job.save();
    throw err;
  }
});

export const downloadSounzAudio = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  const upstream = await sounzService.downloadAudioResponse(filename);
  streamUpstreamResponse(upstream, res, 'audio/mpeg', filename);
});

export const processWithFilmyAi = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Video file is required (field name: file)', 400);
  }

  const instruction = String(req.body.instruction || '').trim();
  if (!instruction) {
    throw new AppError('Natural-language video editing instruction is required', 400);
  }

  const meetingId = parseOptionalMeetingId(req.body.meetingId);

  const ext = path.extname(req.file.originalname || '').toLowerCase();
  if (ext && !SUPPORTED_VIDEO_EXTS.has(ext)) {
    throw new AppError(
      `Unsupported video format '${ext}'. Supported: mp4, webm, mov, avi, mkv, flv`,
      400
    );
  }

  const job = await ProductionJob.create({
    meeting: meetingId,
    createdBy: req.user._id,
    engine: 'filmy-ai',
    instruction,
    status: 'processing',
  });

  try {
    const { videoId } = await filmyService.uploadVideo(
      req.file.buffer,
      req.file.originalname || 'episode.webm',
      req.file.mimetype
    );

    const processed = await filmyService.instructVideo(videoId, instruction);
    const proxyDownloadUrl = `/api/studio/filmy/download/${encodeURIComponent(
      processed.outputFile
    )}`;

    job.status = 'completed';
    job.remoteFileId = videoId;
    job.remoteOutputFilename = processed.outputFile;
    job.proxyDownloadUrl = proxyDownloadUrl;
    job.operationsApplied = processed.operations;
    job.processingTimeSeconds = processed.processingTimeSeconds;
    await job.save();

    res.status(201).json({
      status: 'success',
      message: 'Episode produced with Filmy AI',
      data: {
        job,
        downloadUrl: proxyDownloadUrl,
        operations: processed.operations,
        processingTimeSeconds: processed.processingTimeSeconds,
      },
    });
  } catch (err) {
    job.status = 'failed';
    job.errorMessage = err.message;
    await job.save();
    throw err;
  }
});

export const downloadFilmyVideo = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  const upstream = await filmyService.downloadVideoResponse(filename);
  streamUpstreamResponse(upstream, res, 'video/mp4', filename);
});
