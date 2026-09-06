const mongoose = require('mongoose');

const executionSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'BatchJob', required: true, index: true },
  executionId: { type: String, required: true, unique: true },
  status: { 
    type: String, 
    enum: ['queued', 'running', 'success', 'failed', 'timeout', 'cancelled'],
    default: 'queued'
  },
  startedAt: Date,
  completedAt: Date,
  duration: Number, // seconds
  recordsProcessed: { type: Number, default: 0 },
  recordsFailed: { type: Number, default: 0 },
  error: {
    message: String,
    code: String,
    stack: String
  },
  logs: [{
    timestamp: Date,
    level: { type: String, enum: ['info', 'warn', 'error', 'debug'] },
    message: String
  }],
  progress: { type: Number, default: 0, min: 0, max: 100 },
  retryCount: { type: Number, default: 0 },
  triggeredBy: { type: String, enum: ['scheduler', 'manual', 'dependency', 'retry'], default: 'scheduler' },
  metrics: {
    memoryUsage: Number,
    cpuUsage: Number,
    ioOps: Number
  }
}, { timestamps: true });

executionSchema.index({ job: 1, createdAt: -1 });
executionSchema.index({ status: 1 });
executionSchema.index({ startedAt: -1 });

module.exports = mongoose.model('Execution', executionSchema);
