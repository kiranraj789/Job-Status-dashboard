const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['failure', 'warning', 'predictive', 'dependency', 'performance', 'critical'],
    required: true,
    index: true
  },
  severity: { 
    type: String, 
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'warning'
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'BatchJob' },
  execution: { type: mongoose.Schema.Types.ObjectId, ref: 'Execution' },
  acknowledged: { type: Boolean, default: false },
  acknowledgedBy: String,
  acknowledgedAt: Date,
  metadata: {
    predictedAt: Date,
    predictedFailure: Date,
    confidence: Number,
    impactScore: Number,
    affectedDownstream: [String],
    rootCause: String
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

alertSchema.index({ type: 1, severity: 1, isActive: 1 });
alertSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
