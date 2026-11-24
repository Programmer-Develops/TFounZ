import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import User from '../models/User.js';
import Meeting from '../models/Meeting.js';
import Message from '../models/Message.js';
import Attendance from '../models/Attendance.js';

// Map<meetingCode, Map<socketId, participantInfo>>
const activeRooms = new Map();

function getRoomParticipants(code) {
  const roomMap = activeRooms.get(code);
  if (!roomMap) return [];
  return Array.from(roomMap.values());
}

async function closeAttendanceRecord(attendanceId) {
  if (!attendanceId) return;
  const rec = await Attendance.findById(attendanceId);
  if (!rec || rec.leftAt) return;
  const now = new Date();
  rec.leftAt = now;
  rec.durationMinutes = Math.max(
    0.1,
    Number(((now - rec.joinedAt) / 60000).toFixed(2))
  );
  await rec.save();
}

export function attachMeetingSocket(io) {
  // JWT Authentication handshake middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Unauthorized: missing socket token'));
      }
      const decoded = jwt.verify(token, env.jwtAccessSecret);
      const user = await User.findById(decoded.id).select('-password -refreshTokenHash');
      if (!user) {
        return next(new Error('Unauthorized: user not found'));
      }
      socket.user = user;
      return next();
    } catch {
      return next(new Error('Unauthorized: invalid or expired socket token'));
    }
  });

  io.on('connection', (socket) => {
    const leaveCurrentRoom = async () => {
      const code = socket.data.meetingCode;
      if (!code) return;

      const roomMap = activeRooms.get(code);
      if (roomMap) {
        roomMap.delete(socket.id);
        if (roomMap.size === 0) {
          activeRooms.delete(code);
        }
      }

      await closeAttendanceRecord(socket.data.attendanceId);

      socket.leave(code);
      socket.to(code).emit('webrtc:peer-left', {
        socketId: socket.id,
        userId: socket.user._id.toString(),
      });
      io.to(code).emit('room:participants', {
        participants: getRoomParticipants(code),
      });

      socket.data.meetingCode = null;
      socket.data.meetingId = null;
      socket.data.attendanceId = null;
    };

    socket.on('room:join', async ({ code }) => {
      try {
        const normalizedCode = String(code || '').toUpperCase().trim();
        if (!normalizedCode) return;

        if (socket.data.meetingCode && socket.data.meetingCode !== normalizedCode) {
          await leaveCurrentRoom();
        }

        const meeting = await Meeting.findOne({ code: normalizedCode });
        if (!meeting) {
          socket.emit('room:error', { message: 'Show not found' });
          return;
        }
        if (meeting.status === 'ended') {
          socket.emit('room:error', { message: 'This show has already ended' });
          return;
        }

        const isRemoved = meeting.removedUsers.some(
          (uid) => uid.toString() === socket.user._id.toString()
        );
        if (isRemoved && socket.user.role !== 'admin') {
          socket.emit('room:kicked', {
            code: normalizedCode,
            targetUserId: socket.user._id.toString(),
            reason: 'You were removed from this show by the host',
          });
          return;
        }

        // Transition scheduled show to live when host joins
        if (
          meeting.status === 'scheduled' &&
          (meeting.host.toString() === socket.user._id.toString() ||
            socket.user.role === 'admin')
        ) {
          meeting.status = 'live';
          meeting.startedAt = meeting.startedAt || new Date();
          await meeting.save();
        }

        // Close any stale open attendance rows for this user in this meeting
        const staleRows = await Attendance.find({
          meeting: meeting._id,
          user: socket.user._id,
          leftAt: null,
        });
        const now = new Date();
        await Promise.all(
          staleRows.map((row) => {
            row.leftAt = now;
            row.durationMinutes = Math.max(
              0.1,
              Number(((now - row.joinedAt) / 60000).toFixed(2))
            );
            return row.save();
          })
        );

        const attendance = await Attendance.create({
          meeting: meeting._id,
          user: socket.user._id,
          joinedAt: now,
        });

        socket.join(normalizedCode);
        socket.data.meetingCode = normalizedCode;
        socket.data.meetingId = meeting._id.toString();
        socket.data.attendanceId = attendance._id.toString();
        socket.data.kicked = false;

        if (!activeRooms.has(normalizedCode)) {
          activeRooms.set(normalizedCode, new Map());
        }
        const roomMap = activeRooms.get(normalizedCode);
        roomMap.set(socket.id, {
          socketId: socket.id,
          userId: socket.user._id.toString(),
          name: socket.user.name,
          role: socket.user.role,
          avatarColor: socket.user.avatarColor,
          isHost: meeting.host.toString() === socket.user._id.toString(),
          handRaised: false,
          joinedAt: now.toISOString(),
        });

        const roster = getRoomParticipants(normalizedCode);
        socket.emit('room:joined', {
          code: normalizedCode,
          meetingId: meeting._id.toString(),
          participants: roster,
        });
        io.to(normalizedCode).emit('room:participants', {
          participants: roster,
        });
      } catch (err) {
        socket.emit('room:error', { message: err.message || 'Failed to join show' });
      }
    });

    socket.on('room:leave', async () => {
      await leaveCurrentRoom();
    });

    socket.on('chat:send', async ({ code, content }) => {
      try {
        if (socket.data.kicked) return;
        const normalizedCode = String(code || socket.data.meetingCode || '')
          .toUpperCase()
          .trim();
        const text = String(content || '').trim();
        if (!normalizedCode || !text || !socket.data.meetingId) return;

        const meeting = await Meeting.findById(socket.data.meetingId).select('status removedUsers');
        if (!meeting || meeting.status === 'ended') return;
        const isRemoved = meeting.removedUsers.some(
          (uid) => uid.toString() === socket.user._id.toString()
        );
        if (isRemoved && socket.user.role !== 'admin') return;

        const msg = await Message.create({
          meeting: socket.data.meetingId,
          sender: socket.user._id,
          senderName: socket.user.name,
          senderType: 'user',
          content: text.slice(0, 2000),
        });

        if (socket.data.attendanceId) {
          await Attendance.findByIdAndUpdate(socket.data.attendanceId, {
            $inc: { messagesSent: 1 },
          });
        }

        io.to(normalizedCode).emit('chat:message', msg);
      } catch (err) {
        socket.emit('room:error', { message: err.message });
      }
    });

    socket.on('hand:toggle', async ({ code }) => {
      if (socket.data.kicked) return;
      const normalizedCode = String(code || socket.data.meetingCode || '')
        .toUpperCase()
        .trim();
      const roomMap = activeRooms.get(normalizedCode);
      if (!roomMap) return;

      const entry = roomMap.get(socket.id);
      if (!entry) return;

      entry.handRaised = !entry.handRaised;
      roomMap.set(socket.id, entry);

      if (entry.handRaised && socket.data.attendanceId) {
        await Attendance.findByIdAndUpdate(socket.data.attendanceId, {
          $inc: { raisedHandCount: 1 },
        });
      }

      io.to(normalizedCode).emit('room:participants', {
        participants: getRoomParticipants(normalizedCode),
      });
      io.to(normalizedCode).emit('hand:updated', {
        userId: entry.userId,
        name: entry.name,
        handRaised: entry.handRaised,
      });
    });

    socket.on('sfx:trigger', ({ code, sfx }) => {
      const normalizedCode = String(code || socket.data.meetingCode || '')
        .toUpperCase()
        .trim();
      if (!normalizedCode || !sfx) return;
      io.to(normalizedCode).emit('sfx:play', {
        sfx,
        triggeredBy: socket.user.name,
      });
    });

    socket.on('host:remove-participant', async ({ code, targetUserId }) => {
      try {
        const normalizedCode = String(code || socket.data.meetingCode || '')
          .toUpperCase()
          .trim();
        const meeting = await Meeting.findOne({ code: normalizedCode });
        if (!meeting) return;

        const isHostOrAdmin =
          meeting.host.toString() === socket.user._id.toString() ||
          socket.user.role === 'admin';
        if (!isHostOrAdmin || meeting.host.toString() === String(targetUserId)) {
          return;
        }

        if (!meeting.removedUsers.some((u) => u.toString() === String(targetUserId))) {
          meeting.removedUsers.push(targetUserId);
          await meeting.save();
        }

        const now = new Date();
        const openRows = await Attendance.find({
          meeting: meeting._id,
          user: targetUserId,
          leftAt: null,
        });
        await Promise.all(
          openRows.map((row) => {
            row.leftAt = now;
            row.durationMinutes = Math.max(
              0.1,
              Number(((now - row.joinedAt) / 60000).toFixed(2))
            );
            return row.save();
          })
        );

        io.to(normalizedCode).emit('room:kicked', {
          code: normalizedCode,
          targetUserId: String(targetUserId),
          reason: 'Removed by show host',
        });

        const roomMap = activeRooms.get(normalizedCode);
        if (roomMap) {
          for (const [sid, info] of roomMap.entries()) {
            if (info.userId === String(targetUserId)) {
              roomMap.delete(sid);
              const targetSock = io.sockets.sockets.get(sid);
              if (targetSock) {
                targetSock.data.kicked = true;
                targetSock.leave(normalizedCode);
                targetSock.data.meetingCode = null;
              }
            }
          }
          io.to(normalizedCode).emit('room:participants', {
            participants: getRoomParticipants(normalizedCode),
          });
        }
      } catch (err) {
        socket.emit('room:error', { message: err.message });
      }
    });

    socket.on('host:end-meeting', async ({ code }) => {
      try {
        const normalizedCode = String(code || socket.data.meetingCode || '')
          .toUpperCase()
          .trim();
        const meeting = await Meeting.findOne({ code: normalizedCode });
        if (!meeting) return;

        const isHostOrAdmin =
          meeting.host.toString() === socket.user._id.toString() ||
          socket.user.role === 'admin';
        if (!isHostOrAdmin) return;

        const now = new Date();
        meeting.status = 'ended';
        meeting.endedAt = now;
        await meeting.save();

        const openRows = await Attendance.find({ meeting: meeting._id, leftAt: null });
        await Promise.all(
          openRows.map((row) => {
            row.leftAt = now;
            row.durationMinutes = Math.max(
              0.1,
              Number(((now - row.joinedAt) / 60000).toFixed(2))
            );
            return row.save();
          })
        );

        io.to(normalizedCode).emit('room:ended', {
          code: normalizedCode,
          endedAt: now.toISOString(),
          endedBy: socket.user.name,
        });
      } catch (err) {
        socket.emit('room:error', { message: err.message });
      }
    });

    // --- 1-to-1 WebRTC Video Signaling ---
    socket.on('webrtc:ready', ({ code }) => {
      const normalizedCode = String(code || socket.data.meetingCode || '')
        .toUpperCase()
        .trim();
      if (!normalizedCode) return;
      socket.to(normalizedCode).emit('webrtc:ready', {
        fromSocketId: socket.id,
        userId: socket.user._id.toString(),
        name: socket.user.name,
      });
    });

    socket.on('webrtc:offer', ({ code, targetSocketId, sdp }) => {
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc:offer', {
          fromSocketId: socket.id,
          name: socket.user.name,
          sdp,
        });
      } else if (code) {
        socket.to(String(code).toUpperCase().trim()).emit('webrtc:offer', {
          fromSocketId: socket.id,
          name: socket.user.name,
          sdp,
        });
      }
    });

    socket.on('webrtc:answer', ({ code, targetSocketId, sdp }) => {
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc:answer', {
          fromSocketId: socket.id,
          name: socket.user.name,
          sdp,
        });
      } else if (code) {
        socket.to(String(code).toUpperCase().trim()).emit('webrtc:answer', {
          fromSocketId: socket.id,
          name: socket.user.name,
          sdp,
        });
      }
    });

    socket.on('webrtc:ice-candidate', ({ code, targetSocketId, candidate }) => {
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc:ice-candidate', {
          fromSocketId: socket.id,
          candidate,
        });
      } else if (code) {
        socket.to(String(code).toUpperCase().trim()).emit('webrtc:ice-candidate', {
          fromSocketId: socket.id,
          candidate,
        });
      }
    });

    socket.on('disconnect', async () => {
      await leaveCurrentRoom();
    });
  });
}
