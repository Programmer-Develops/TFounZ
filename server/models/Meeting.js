import crypto from 'crypto';
import mongoose from 'mongoose';

/**
 * Generate a formatted join code using Node.js crypto (TFZ-XXXX-XXXX).
 */
export function generateShowCode() {
  const hex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `TFZ-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

const aiPersonaSchema = new mongoose.Schema(
  {
    id: { type: String, default: 'chai-with-ai' },
    name: { type: String, default: 'Karan AI' },
    tagline: { type: String, default: 'Rapid-Fire & Bollywood Couch' },
    sounzVoiceId: { type: String, default: 'romantic_hero' },
    accentColor: { type: String, default: '#f5b041' },
    avatarStyle: { type: String, default: 'glam' },
  },
  { _id: false }
);

const meetingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Show or meeting title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      default: generateShowCode,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Host reference is required'],
    },
    mode: {
      type: String,
      enum: {
        values: ['ai-talkshow', 'live-studio'],
        message: 'Mode must be ai-talkshow or live-studio',
      },
      default: 'ai-talkshow',
    },
    aiRole: {
      type: String,
      enum: {
        values: ['host', 'guest', 'co-host'],
        message: 'aiRole must be host, guest, or co-host',
      },
      default: 'host',
    },
    showFormat: {
      type: String,
      enum: {
        values: [
          'chai-with-ai',
          'hot-seat',
          'desi-roast',
          'anime-couch',
          'mock-interview',
          'classic-meet',
          'guest-superstar',
          'guest-anime',
          'guest-founder',
          'guest-cricket',
        ],
        message: 'Invalid showFormat preset',
      },
      default: 'chai-with-ai',
    },
    aiPersona: {
      type: aiPersonaSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: {
        values: ['scheduled', 'live', 'ended'],
        message: 'Status must be scheduled, live, or ended',
      },
      default: 'scheduled',
    },
    scheduledAt: {
      type: Date,
      default: Date.now,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    removedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    rapidFireHighScore: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

meetingSchema.index({ code: 1 }, { unique: true });
meetingSchema.index({ host: 1, createdAt: -1 });
meetingSchema.index({ status: 1, scheduledAt: 1 });

const Meeting = mongoose.model('Meeting', meetingSchema);
export default Meeting;
