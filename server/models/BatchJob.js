const mongoose = require('mongoose');

const batchJobSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  description: String,
  cronExpression: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['ETL', 'Reporting', 'Analytics', 'DataSync', 'Cleanup', 'Compliance'],
    default: 'ETL'
  },
  priority: { 
    type: String, 
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium'
  },
  status: { 
    type: String, 
    enum: ['active', 'paused', 'failed', 'completed'],
    default: 'active'
  },
  dependencies: [{
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'BatchJob' },
    status: { type: String, enum: ['pending', 'satisfied', 'failed'], default: 'pending' }
  }],
  estimatedDuration: { type: Number, default: 300 }, // seconds
  maxRetries: { type: Number, default: 3 },
  timeout: { type: Number, default: 3600 }, // seconds
  alertThreshold: { type: Number, default: 1.5 }, // multiplier for duration alerts
  tags: [String],
  owner: String,
  lastExecution: Date,
  nextExecution: Date,
  consecutiveFailures: { type: Number, default: 0 }
}, { timestamps: true });

batchJobSchema.index({ status: 1, priority: 1 });
batchJobSchema.index({ nextExecution: 1 });

const BatchJob = mongoose.model('BatchJob', batchJobSchema);

// A job is on the schedule (enabled) unless an operator disabled it.
// 'failed' marks a scheduled job whose latest run failed rather than an
// operator disablement, so it stays eligible for risk predictions and
// predictive alerts; 'paused' and 'completed' are operator disablements.
// Used by the scheduler pickup query, predictions and the pause/resume API.
BatchJob.SCHEDULED_STATUSES = ['active', 'failed'];

module.exports = BatchJob;
