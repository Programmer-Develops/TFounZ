import mongoose from 'mongoose';
import Meeting, { generateShowCode } from '../models/Meeting.js';
import Message from '../models/Message.js';
import Attendance from '../models/Attendance.js';
import { getPresetById, SHOW_PRESETS, AI_GUEST_PRESETS } from '../services/personas.js';
import { AppError, asyncHandler } from '../middleware/errorMiddleware.js';

function assertHostOrAdmin(meeting, user) {
  const isOwner = meeting.host.toString() === user._id.toString();
  if (!isOwner && user.role !== 'admin') {
    throw new AppError('Only the show host or an admin can perform this action', 403);
  }
}

export const getPresets = asyncHandler(async (_req, res) => {
  const safePresets = SHOW_PRESETS.map(({ systemPrompt, ...rest }) => rest);
  const safeGuestPresets = AI_GUEST_PRESETS.map(({ systemPrompt, ...rest }) => rest);
  res.json({
    status: 'success',
    data: { presets: safePresets, guestPresets: safeGuestPresets },
  });
});

export const createMeeting = asyncHandler(async (req, res) => {
  const {
    title,
    description = '',
    mode,
    aiRole,
    showFormat = 'chai-with-ai',
    scheduledAt,
    customHostName,
    customVoiceId,
    startLive = true,
  } = req.body;

  if (!title || String(title).trim().length < 3) {
    throw new AppError('Show title must be at least 3 characters', 400);
  }

  const preset = getPresetById(showFormat);
  const resolvedMode = mode || preset.defaultMode || 'ai-talkshow';
  const resolvedAiRole = ['host', 'guest', 'co-host'].includes(aiRole)
    ? aiRole
    : preset.defaultAiRole || 'host';

  let code = generateShowCode();
  for (let attempt = 0; attempt < 4; attempt++) {
    const exists = await Meeting.exists({ code });
    if (!exists) break;
    code = generateShowCode();
  }

  const meeting = await Meeting.create({
    title: String(title).trim(),
    description: String(description).trim(),
    code,
    host: req.user._id,
    mode: resolvedMode,
    aiRole: resolvedAiRole,
    showFormat: preset.id,
    aiPersona: {
      id: preset.id,
      name: customHostName?.trim() || preset.name,
      tagline: preset.tagline,
      sounzVoiceId: customVoiceId?.trim() || preset.sounzVoiceId,
      accentColor: preset.accentColor,
      avatarStyle: preset.avatarStyle,
    },
    status: startLive ? 'live' : 'scheduled',
    scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
    startedAt: startLive ? new Date() : null,
  });

  if (resolvedMode === 'ai-talkshow' || preset.openingLine) {
    await Message.create({
      meeting: meeting._id,
      sender: null,
      senderName: meeting.aiPersona.name,
      senderType: 'ai',
      content: preset.openingLine,
      emotion: 'applause',
      sfxCue: 'applause',
    });
  }

  const populated = await Meeting.findById(meeting._id).populate(
    'host',
    'name email role avatarColor'
  );

  res.status(201).json({
    status: 'success',
    message: 'Show created successfully',
    data: { meeting: populated },
  });
});

export const getMeetingHistory = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user._id);

  const attendedIds = await Attendance.distinct('meeting', { user: userId });

  const meetings = await Meeting.aggregate([
    {
      $match: {
        $or: [{ host: userId }, { _id: { $in: attendedIds } }],
      },
    },
    { $sort: { createdAt: -1 } },
    { $limit: 40 },
    {
      $lookup: {
        from: 'users',
        localField: 'host',
        foreignField: '_id',
        as: 'hostDoc',
      },
    },
    { $unwind: { path: '$hostDoc', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'attendances',
        localField: '_id',
        foreignField: 'meeting',
        as: 'attendanceDocs',
      },
    },
    {
      $lookup: {
        from: 'messages',
        localField: '_id',
        foreignField: 'meeting',
        as: 'messageDocs',
      },
    },
    {
      $lookup: {
        from: 'productionjobs',
        localField: '_id',
        foreignField: 'meeting',
        as: 'jobDocs',
      },
    },
    {
      $project: {
        title: 1,
        description: 1,
        code: 1,
        mode: 1,
        aiRole: 1,
        showFormat: 1,
        aiPersona: 1,
        status: 1,
        scheduledAt: 1,
        startedAt: 1,
        endedAt: 1,
        rapidFireHighScore: 1,
        createdAt: 1,
        host: {
          _id: '$hostDoc._id',
          name: '$hostDoc.name',
          email: '$hostDoc.email',
          role: '$hostDoc.role',
        },
        uniqueParticipantCount: {
          $size: { $setUnion: ['$attendanceDocs.user', []] },
        },
        messageCount: { $size: '$messageDocs' },
        productionJobCount: { $size: '$jobDocs' },
      },
    },
  ]);

  res.json({
    status: 'success',
    data: { meetings },
  });
});

export const getMeetingByCode = asyncHandler(async (req, res) => {
  const code = String(req.params.code || '').toUpperCase().trim();
  const meeting = await Meeting.findOne({ code }).populate(
    'host',
    'name email role avatarColor'
  );

  if (!meeting) {
    throw new AppError(`No show found with code '${code}'`, 404);
  }

  const isRemoved = meeting.removedUsers.some(
    (uid) => uid.toString() === req.user._id.toString()
  );
  if (isRemoved && req.user.role !== 'admin') {
    throw new AppError('You were removed from this show by the host', 403);
  }

  const messages = await Message.find({ meeting: meeting._id })
    .sort({ createdAt: 1 })
    .limit(80);

  res.json({
    status: 'success',
    data: { meeting, messages },
  });
});

export const getMeetingById = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findById(req.params.id).populate(
    'host',
    'name email role avatarColor'
  );
  if (!meeting) {
    throw new AppError('Show or meeting not found', 404);
  }

  const isRemoved = meeting.removedUsers.some(
    (uid) => uid.toString() === req.user._id.toString()
  );
  if (isRemoved && req.user.role !== 'admin') {
    throw new AppError('You were removed from this show by the host', 403);
  }

  res.json({
    status: 'success',
    data: { meeting },
  });
});

export const updateMeetingStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['scheduled', 'live', 'ended'].includes(status)) {
    throw new AppError('Status must be scheduled, live, or ended', 400);
  }

  const meeting = await Meeting.findById(req.params.id);
  if (!meeting) {
    throw new AppError('Show or meeting not found', 404);
  }
  assertHostOrAdmin(meeting, req.user);

  const now = new Date();
  meeting.status = status;
  if (status === 'live' && !meeting.startedAt) {
    meeting.startedAt = now;
  }
  if (status === 'ended') {
    meeting.endedAt = now;
    const openRecords = await Attendance.find({ meeting: meeting._id, leftAt: null });
    await Promise.all(
      openRecords.map((rec) => {
        const mins = Math.max(0.1, Number(((now - rec.joinedAt) / 60000).toFixed(2)));
        rec.leftAt = now;
        rec.durationMinutes = mins;
        return rec.save();
      })
    );

    const io = req.app.get('io');
    if (io) {
      io.to(meeting.code).emit('room:ended', {
        code: meeting.code,
        endedAt: now.toISOString(),
        endedBy: req.user.name,
      });
    }
  }

  await meeting.save();

  res.json({
    status: 'success',
    message: `Show status updated to ${status}`,
    data: { meeting },
  });
});

export const removeParticipant = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    throw new AppError('Target userId is required', 400);
  }

  const meeting = await Meeting.findById(req.params.id);
  if (!meeting) {
    throw new AppError('Show or meeting not found', 404);
  }
  assertHostOrAdmin(meeting, req.user);

  if (meeting.host.toString() === String(userId)) {
    throw new AppError('Host cannot remove themselves from their own show', 400);
  }

  if (!meeting.removedUsers.some((u) => u.toString() === String(userId))) {
    meeting.removedUsers.push(userId);
    await meeting.save();
  }

  const now = new Date();
  const openRecords = await Attendance.find({
    meeting: meeting._id,
    user: userId,
    leftAt: null,
  });
  await Promise.all(
    openRecords.map((rec) => {
      rec.leftAt = now;
      rec.durationMinutes = Math.max(0.1, Number(((now - rec.joinedAt) / 60000).toFixed(2)));
      return rec.save();
    })
  );

  const io = req.app.get('io');
  if (io) {
    io.to(meeting.code).emit('room:kicked', {
      code: meeting.code,
      targetUserId: String(userId),
      reason: 'Removed by show host',
    });
  }

  res.json({
    status: 'success',
    message: 'Participant removed from show',
  });
});

export const getMeetingMessages = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findById(req.params.id);
  if (!meeting) {
    throw new AppError('Show or meeting not found', 404);
  }

  const isRemoved = meeting.removedUsers.some(
    (uid) => uid.toString() === req.user._id.toString()
  );
  if (isRemoved && req.user.role !== 'admin') {
    throw new AppError('You were removed from this show by the host', 403);
  }

  const q = String(req.query.q || '').trim();
  let messages;

  if (q) {
    messages = await Message.find({
      meeting: meeting._id,
      $text: { $search: q },
    })
      .sort({ createdAt: 1 })
      .limit(100);

    // Substring fallback if partial word didn't match stemmed $text tokens
    if (!messages.length) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      messages = await Message.find({
        meeting: meeting._id,
        content: { $regex: escaped, $options: 'i' },
      })
        .sort({ createdAt: 1 })
        .limit(100);
    }
  } else {
    messages = await Message.find({ meeting: meeting._id })
      .sort({ createdAt: 1 })
      .limit(150);
  }

  res.json({
    status: 'success',
    data: { messages },
  });
});
