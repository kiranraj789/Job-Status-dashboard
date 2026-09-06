const cron = require('node-cron');
const BatchJob = require('../models/BatchJob');
const Execution = require('../models/Execution');
const Alert = require('../models/Alert');
const { v4: uuidv4 } = require('uuid');
const { EVENTS, ROOM_ALL, jobRoom } = require('../socketEvents');
const { simulateExecution } = require('./simulation');
const { computeJobRisk, RISK } = require('./riskEngine');

let io = null;

const initScheduler = (socketIo) => {
  io = socketIo;

  // Check for pending jobs every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const now = new Date();
      const dueJobs = await BatchJob.find({
        status: 'active',
        nextExecution: { $lte: now }
      }).populate('dependencies.job');

      for (const job of dueJobs) {
        // Check dependencies
        const depsFailed = job.dependencies.some(d => 
          d.job && d.job.status === 'failed'
        );

        if (depsFailed) {
          // Same dependency protection as manual runs: the job is marked
          // blocked (rather than left 'active' retrying every cycle) and an
          // alert names the failing upstream as the root cause.
          const failedUpstream = job.dependencies
            .filter(d => d.job && d.job.status === 'failed')
            .map(d => d.job.name);

          job.status = 'blocked';
          await job.save();

          const alert = await Alert.create({
            type: 'dependency',
            severity: 'warning',
            title: `Blocked: ${job.name}`,
            message: `${job.name} is blocked because upstream dependency ${failedUpstream.join(', ')} failed (root cause)`,
            job: job._id,
            metadata: {
              rootCause: failedUpstream.join(', '),
              affectedDownstream: failedUpstream
            }
          });

          if (io) {
            io.to(ROOM_ALL).emit(EVENTS.JOB_STATUS_CHANGE, { jobId: job._id, status: 'blocked' });
            io.to(ROOM_ALL).emit(EVENTS.ALERT_NEW, {
              type: 'dependency',
              severity: alert.severity,
              title: alert.title,
              message: alert.message,
              jobName: job.name,
              jobId: job._id
            });
          }
          continue;
        }

        // Create execution
        const execution = await Execution.create({
          job: job._id,
          executionId: `EXEC-${uuidv4().slice(0, 8).toUpperCase()}`,
          status: 'running',
          startedAt: now,
          triggeredBy: 'scheduler'
        });

        job.lastExecution = now;
        job.nextExecution = calculateNextExecution(job.cronExpression);
        await job.save();

        if (io) {
          io.to(jobRoom(job._id)).emit(EVENTS.EXECUTION_START, { jobId: job._id, execution });
          io.to(ROOM_ALL).emit(EVENTS.JOB_STATUS_CHANGE, { jobId: job._id, status: 'running' });
        }

        // Simulate completion through the shared execution simulator
        simulateExecution(execution, job, io);
      }
    } catch (error) {
      console.error('Scheduler error:', error);
    }
  });

  // Generate predictive alerts every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await generatePredictiveAlerts();
    } catch (error) {
      console.error('Predictive alert generation error:', error);
    }
  });

  console.log('Scheduler initialized');
};

function calculateNextExecution(cronExpr) {
  // Simple next execution calculator (for demo)
  const parts = cronExpr.split(' ');
  const now = new Date();
  
  // Parse simple intervals
  if (parts[0].startsWith('*/')) {
    const minutes = parseInt(parts[0].slice(2));
    return new Date(now.getTime() + minutes * 60 * 1000);
  }
  if (parts[1].startsWith('*/')) {
    const hours = parseInt(parts[1].slice(2));
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
  }
  
  // Default: next hour
  return new Date(now.getTime() + 60 * 60 * 1000);
}

async function generatePredictiveAlerts() {
  // Same membership rule as /api/predictions: any scheduled job, including
  // one whose latest run failed, can be flagged high-risk.
  const jobs = await BatchJob.find({ status: { $in: BatchJob.SCHEDULED_STATUSES } });

  for (const job of jobs) {
    const recentExecs = await Execution.find({ job: job._id })
      .sort({ createdAt: -1 })
      .limit(RISK.recentExecutions);

    // Same scoring as the /api/predictions view: alert once a job is judged
    // high-risk on the shared engine (previously a divergent rate+consecutive
    // heuristic with its own thresholds)
    const risk = computeJobRisk(job, recentExecs);
    if (!risk || risk.riskLevel !== 'high') continue;

    const existing = await Alert.findOne({
      job: job._id,
      type: 'predictive',
      isActive: true
    });

    if (existing) continue;

    await Alert.create({
      type: 'predictive',
      severity: 'warning',
      title: `Predictive Alert: ${job.name}`,
      message: `Risk score ${risk.riskScore}/100 (${risk.riskLevel}). ${risk.reasons[0]}`,
      job: job._id,
      metadata: {
        predictedAt: new Date(),
        confidence: Math.min(risk.riskScore, 95),
        impactScore: job.priority === 'critical' ? 90 : job.priority === 'high' ? 70 : 40
      }
    });

    if (io) {
      io.to(ROOM_ALL).emit(EVENTS.ALERT_NEW, {
        type: 'predictive',
        jobName: job.name
      });
    }
  }
}

module.exports = { initScheduler };
