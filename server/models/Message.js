import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meeting',
      required: [true, 'Meeting reference is required'],
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    senderName: {
      type: String,
      required: [true, 'Sender name is required'],
      trim: true,
    },
    senderType: {
      type: String,
      enum: {
        values: ['user', 'ai', 'system'],
        message: 'senderType must be user, ai, or system',
      },
      default: 'user',
    },
    content: {
      type: String,
      required: [true, 'Message content cannot be empty'],
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    emotion: {
      type: String,
      enum: ['neutral', 'laugh', 'shock', 'roast', 'applause', 'think'],
      default: 'neutral',
    },
    sfxCue: {
      type: String,
      default: '',
    },
    isRapidFire: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

messageSchema.index({ meeting: 1, createdAt: 1 });
messageSchema.index({ content: 'text' });

const Message = mongoose.model('Message', messageSchema);
export default Message;
