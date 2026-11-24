import User from '../models/User.js';
import Meeting from '../models/Meeting.js';
import Attendance from '../models/Attendance.js';
import Message from '../models/Message.js';
import ProductionJob from '../models/ProductionJob.js';
import { AppError, asyncHandler } from '../middleware/errorMiddleware.js';

export const getPlatformStats = asyncHandler(async (_req, res) => {
  const [
    totalUsers,
    totalMeetings,
    totalMessages,
    roleBreakdown,
    showFormatBreakdown,
    productionBreakdown,
    attendanceSummary,
  ] = await Promise.all([
    User.countDocuments(),
    Meeting.countDocuments(),
    Message.countDocuments(),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Meeting.aggregate([
      {
        $group: {
          _id: '$showFormat',
          count: { $sum: 1 },
          liveCount: {
            $sum: { $cond: [{ $eq: ['$status', 'live'] }, 1, 0] },
          },
        },
      },
      { $sort: { count: -1 } },
    ]),
    ProductionJob.aggregate([
      {
        $group: {
          _id: { engine: '$engine', status: '$status' },
          count: { $sum: 1 },
        },
      },
    ]),
    Attendance.aggregate([
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          totalMinutes: { $sum: '$durationMinutes' },
          totalHandsRaised: { $sum: '$raisedHandCount' },
        },
      },
    ]),
  ]);

  res.json({
    status: 'success',
    data: {
      totals: {
        users: totalUsers,
        meetings: totalMeetings,
        messages: totalMessages,
        sessions: attendanceSummary[0]?.totalSessions || 0,
        totalStudioMinutes: Number((attendanceSummary[0]?.totalMinutes || 0).toFixed(1)),
        totalHandsRaised: attendanceSummary[0]?.totalHandsRaised || 0,
      },
      roleBreakdown,
      showFormatBreakdown,
      productionBreakdown,
    },
  });
});

export const getAllUsers = asyncHandler(async (_req, res) => {
  const users = await User.find()
    .select('-password -refreshTokenHash')
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({
    status: 'success',
    data: { users },
  });
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['host', 'participant', 'admin'].includes(role)) {
    throw new AppError('Role must be host, participant, or admin', 400);
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true, runValidators: true }
  ).select('-password -refreshTokenHash');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    status: 'success',
    message: `Updated ${user.name}'s role to ${role}`,
    data: { user },
  });
});

export const getAllMeetings = asyncHandler(async (_req, res) => {
  const meetings = await Meeting.find()
    .populate('host', 'name email role')
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({
    status: 'success',
    data: { meetings },
  });
});

export const deleteMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findById(req.params.id);
  if (!meeting) {
    throw new AppError('Meeting not found', 404);
  }

  await Promise.all([
    Message.deleteMany({ meeting: meeting._id }),
    Attendance.deleteMany({ meeting: meeting._id }),
    ProductionJob.deleteMany({ meeting: meeting._id }),
    meeting.deleteOne(),
  ]);

  res.json({
    status: 'success',
    message: 'Meeting and associated logs deleted',
  });
});
