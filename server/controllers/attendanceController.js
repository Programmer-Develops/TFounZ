import mongoose from 'mongoose';
import Meeting from '../models/Meeting.js';
import Attendance from '../models/Attendance.js';
import Message from '../models/Message.js';
import { AppError, asyncHandler } from '../middleware/errorMiddleware.js';

/**
 * MeetLite Unique Twist:
 * Generates per-participant attendance report (join time, leave time, total minutes,
 * messages sent, hands raised, rapid-fire score) using a MongoDB Aggregation Pipeline.
 */
export const getAttendanceReport = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findById(req.params.id).populate('host', 'name email');
  if (!meeting) {
    throw new AppError('Show or meeting not found', 404);
  }

  const isOwner = meeting.host._id.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    throw new AppError('Only the show host or an admin can view the attendance report', 403);
  }

  const meetingObjectId = new mongoose.Types.ObjectId(meeting._id);

  const participants = await Attendance.aggregate([
    { $match: { meeting: meetingObjectId } },
    {
      $addFields: {
        effectiveLeave: { $ifNull: ['$leftAt', '$$NOW'] },
      },
    },
    {
      $addFields: {
        computedMinutes: {
          $cond: [
            { $gt: ['$durationMinutes', 0] },
            '$durationMinutes',
            {
              $divide: [{ $subtract: ['$effectiveLeave', '$joinedAt'] }, 60000],
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: '$user',
        firstJoinTime: { $min: '$joinedAt' },
        lastLeaveTime: { $max: '$effectiveLeave' },
        totalMinutes: { $sum: '$computedMinutes' },
        sessionsCount: { $sum: 1 },
        raisedHandCount: { $sum: '$raisedHandCount' },
        messagesSent: { $sum: '$messagesSent' },
        rapidFireScore: { $max: '$rapidFireScore' },
        activeSessions: {
          $sum: { $cond: [{ $eq: ['$leftAt', null] }, 1, 0] },
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userDoc',
      },
    },
    { $unwind: '$userDoc' },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        name: '$userDoc.name',
        email: '$userDoc.email',
        role: '$userDoc.role',
        firstJoinTime: 1,
        lastLeaveTime: 1,
        totalMinutes: { $round: ['$totalMinutes', 2] },
        sessionsCount: 1,
        raisedHandCount: 1,
        messagesSent: 1,
        rapidFireScore: 1,
        stillActive: { $gt: ['$activeSessions', 0] },
      },
    },
    { $sort: { totalMinutes: -1, firstJoinTime: 1 } },
  ]);

  const totalMessages = await Message.countDocuments({ meeting: meeting._id });
  const totalMinutesAll = Number(
    participants.reduce((acc, p) => acc + (p.totalMinutes || 0), 0).toFixed(2)
  );

  res.json({
    status: 'success',
    data: {
      meeting: {
        _id: meeting._id,
        title: meeting.title,
        code: meeting.code,
        mode: meeting.mode,
        showFormat: meeting.showFormat,
        status: meeting.status,
        host: meeting.host,
        startedAt: meeting.startedAt,
        endedAt: meeting.endedAt,
        rapidFireHighScore: meeting.rapidFireHighScore,
      },
      summary: {
        totalParticipants: participants.length,
        totalMinutesAll,
        totalMessages,
        peakRapidFireScore: meeting.rapidFireHighScore,
      },
      participants,
    },
  });
});
