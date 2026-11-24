import Meeting from '../models/Meeting.js';
import Message from '../models/Message.js';
import Attendance from '../models/Attendance.js';
import { getPresetById } from '../services/personas.js';
import {
  generateHostReply,
  generateRapidFireSet,
  generateEpisodeSummary,
} from '../services/geminiService.js';
import { synthesizeSpeechWithSounz } from '../services/sounzService.js';
import { AppError, asyncHandler } from '../middleware/errorMiddleware.js';

function assertMeetingAccess(meeting, user, { allowEnded = false } = {}) {
  if (!meeting) {
    throw new AppError('Show or meeting not found', 404);
  }
  const isRemoved = meeting.removedUsers.some(
    (uid) => uid.toString() === user._id.toString()
  );
  if (isRemoved && user.role !== 'admin') {
    throw new AppError('You were removed from this show by the host', 403);
  }
  if (!allowEnded && meeting.status === 'ended') {
    throw new AppError('This show has already ended', 400);
  }
}

export const respondAsAiHost = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const { userMessage, isRapidFire = false, saveUserMessage = true } = req.body;

  if (!userMessage || !String(userMessage).trim()) {
    throw new AppError('userMessage is required for AI response', 400);
  }

  const meeting = await Meeting.findById(meetingId);
  assertMeetingAccess(meeting, req.user);

  const cleanText = String(userMessage).trim();
  const io = req.app.get('io');

  let savedUserMsg = null;
  if (saveUserMessage) {
    savedUserMsg = await Message.create({
      meeting: meeting._id,
      sender: req.user._id,
      senderName: req.user.name,
      senderType: 'user',
      content: cleanText,
      isRapidFire: Boolean(isRapidFire),
    });

    await Attendance.findOneAndUpdate(
      { meeting: meeting._id, user: req.user._id, leftAt: null },
      { $inc: { messagesSent: 1 } }
    );

    if (io) {
      io.to(meeting.code).emit('chat:message', savedUserMsg);
    }
  }

  const recentHistory = await Message.find({ meeting: meeting._id })
    .sort({ createdAt: -1 })
    .limit(12);
  recentHistory.reverse();

  const preset = getPresetById(meeting.showFormat);
  const aiRole = meeting.aiRole || preset.defaultAiRole || 'host';
  const persona = {
    ...preset,
    name: meeting.aiPersona?.name || preset.name,
    tagline: meeting.aiPersona?.tagline || preset.tagline,
    sounzVoiceId: meeting.aiPersona?.sounzVoiceId || preset.sounzVoiceId,
  };

  const aiResult = await generateHostReply({
    persona,
    aiRole,
    history: recentHistory,
    userMessage: cleanText,
    guestName: req.user.name,
    isRapidFire: Boolean(isRapidFire),
  });

  const savedAiMsg = await Message.create({
    meeting: meeting._id,
    sender: null,
    senderName: persona.name,
    senderType: 'ai',
    content: aiResult.reply,
    emotion: aiResult.emotion,
    sfxCue: aiResult.sfxCue,
    isRapidFire: Boolean(isRapidFire),
  });

  if (isRapidFire && aiResult.rapidFirePoints > 0) {
    const updatedAttendance = await Attendance.findOneAndUpdate(
      { meeting: meeting._id, user: req.user._id, leftAt: null },
      { $inc: { rapidFireScore: aiResult.rapidFirePoints } },
      { new: true }
    );
    const candidateHigh = updatedAttendance?.rapidFireScore || aiResult.rapidFirePoints;
    if (candidateHigh > meeting.rapidFireHighScore) {
      meeting.rapidFireHighScore = candidateHigh;
      await meeting.save();
    }
  }

  if (io) {
    io.to(meeting.code).emit('chat:message', savedAiMsg);
    io.to(meeting.code).emit('ai:reaction', {
      emotion: aiResult.emotion,
      sfxCue: aiResult.sfxCue,
      lowerThirdText: aiResult.lowerThirdText,
      rapidFirePoints: aiResult.rapidFirePoints,
      speakerName: persona.name,
      aiRole,
      reply: aiResult.reply,
      dspVoicePreset: preset.dspVoicePreset || '',
    });
  }

  res.json({
    status: 'success',
    data: {
      userMessage: savedUserMsg,
      aiMessage: savedAiMsg,
      aiRole,
      ...aiResult,
    },
  });
});

export const startRapidFireRound = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const { topic = '' } = req.body;

  const meeting = await Meeting.findById(meetingId);
  assertMeetingAccess(meeting, req.user);

  const preset = getPresetById(meeting.showFormat);
  const aiRole = meeting.aiRole || preset.defaultAiRole || 'host';
  const { questions, source, modelUsed } = await generateRapidFireSet({
    persona: preset,
    aiRole,
    topic,
  });

  const introMsg = await Message.create({
    meeting: meeting._id,
    sender: null,
    senderName: meeting.aiPersona?.name || preset.name,
    senderType: 'ai',
    content:
      aiRole === 'guest'
        ? `Bring on your 60-second Rapid-Fire round, host! Try firing this first question: "${questions[0]}"`
        : `RAPID-FIRE ROUND STARTED! First question: ${questions[0]}`,
    emotion: 'shock',
    sfxCue: 'drumroll',
    isRapidFire: true,
  });

  const io = req.app.get('io');
  if (io) {
    io.to(meeting.code).emit('chat:message', introMsg);
    io.to(meeting.code).emit('rapid-fire:start', {
      questions,
      durationSeconds: 60,
      startedBy: req.user.name,
    });
  }

  res.json({
    status: 'success',
    data: {
      questions,
      durationSeconds: 60,
      source,
      modelUsed: modelUsed || null,
      introMessage: introMsg,
    },
  });
});

export const speakAsAi = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const { text, sfxCue = '', dspVoicePreset } = req.body;

  const meeting = await Meeting.findById(meetingId);
  assertMeetingAccess(meeting, req.user);

  const preset = getPresetById(meeting.showFormat);
  const resolvedDsp =
    typeof dspVoicePreset === 'string' ? dspVoicePreset : preset.dspVoicePreset || '';

  const synthesized = await synthesizeSpeechWithSounz({
    text,
    dspVoicePreset: resolvedDsp,
    sfxCue,
  });

  res.json({
    status: 'success',
    data: {
      engine: 'sounz-ai',
      outputFilename: synthesized.outputFilename,
      downloadUrl: synthesized.proxyDownloadUrl,
    },
  });
});

export const summarizeEpisode = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const meeting = await Meeting.findById(meetingId);
  assertMeetingAccess(meeting, req.user, { allowEnded: true });

  const transcript = await Message.find({ meeting: meeting._id })
    .sort({ createdAt: 1 })
    .limit(40);

  const preset = getPresetById(meeting.showFormat);
  const summary = await generateEpisodeSummary({
    meetingTitle: meeting.title,
    persona: { ...preset, name: meeting.aiPersona?.name || preset.name },
    aiRole: meeting.aiRole || 'host',
    transcript,
  });

  res.json({
    status: 'success',
    data: summary,
  });
});
