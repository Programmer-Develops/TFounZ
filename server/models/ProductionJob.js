import mongoose from 'mongoose';

const productionJobSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meeting',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator reference is required'],
    },
    engine: {
      type: String,
      enum: {
        values: ['filmy-ai', 'sounz-ai'],
        message: 'Engine must be filmy-ai or sounz-ai',
      },
      required: true,
    },
    instruction: {
      type: String,
      required: [true, 'Processing instruction is required'],
      trim: true,
      maxlength: [600, 'Instruction cannot exceed 600 characters'],
    },
    voiceId: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
    },
    remoteFileId: {
      type: String,
      default: '',
    },
    remoteOutputFilename: {
      type: String,
      default: '',
    },
    proxyDownloadUrl: {
      type: String,
      default: '',
    },
    operationsApplied: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    processingTimeSeconds: {
      type: Number,
      default: null,
    },
    errorMessage: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

productionJobSchema.index({ meeting: 1, createdAt: -1 });
productionJobSchema.index({ createdBy: 1, createdAt: -1 });

const ProductionJob = mongoose.model('ProductionJob', productionJobSchema);
export default ProductionJob;
