import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meeting',
      required: [true, 'Meeting reference is required'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    joinedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    leftAt: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    raisedHandCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    messagesSent: {
      type: Number,
      default: 0,
      min: 0,
    },
    rapidFireScore: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

attendanceSchema.index({ meeting: 1, user: 1, joinedAt: -1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
