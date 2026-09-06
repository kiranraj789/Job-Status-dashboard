const BatchJob = require('../models/BatchJob');
const Execution = require('../models/Execution');
const Alert = require('../models/Alert');
const { v4: uuidv4 } = require('uuid');
const { EVENTS, ROOM_ALL, jobRoom } = require('../socketEvents');
const { simulateExecution } = require('../utils/simulation');
const { finalizeRun } = require('../utils/executionOutcomes');
const { computeJobRisk, RISK } = require('../utils/riskEngine');

// Get all batch jobs with stats
exports.getJobs = async (req, res) => {
  try {
    const { status, priority, category, search } = req.query;
    let query = {};
    
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    if (search) query.name = { $regex: search, $options: 'i' };

    const jobs = await BatchJob.find(query)
      .populate('dependencies.job', 'name status')
      .sort({ priority: 1, name: 1 });

    // Attach execution stats
    const jobsWithStats = await Promise.all(jobs.map(async (job) => {
      const recentExecutions = await Execution.find({ job: job._id })
        .sort({ createdAt: -1 })
        .limit(10);

      const successCount = recentExecutions.filter(e => e.status === 'success').length;
      const avgDuration = recentExecutions.reduce((sum, e) => sum + (e.duration || 0), 0) / (recentExecutions.length || 1);

      return {
        ...job.toObject(),
        stats: {
          recentExecutions: recentExecutions.length,
          successRate: recentExecutions.length > 0 ? ((successCount / recentExecutions.length) * 100).toFixed(1) : 0,
          avgDuration: Math.round(avgDuration),
          lastStatus: recentExecutions[0]?.status || 'none'
        }
      };
    }));

    res.json({ jobs: jobsWithStats, total: jobsWithStats.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single job with full details
exports.getJob = async (req, res) => {
  try {
    const job = await BatchJob.findById(req.params.id)
      .populate('dependencies.job', 'name status category');
    
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const executions = await Execution.find({ job: job._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ job, executions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create a new batch job
exports.createJob = async (req, res) => {
  try {
    const job = await BatchJob.create(req.body);
    res.status(201).json(job);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update a batch job
exports.updateJob = async (req, res) => {
  try {
    const job = await BatchJob.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete a batch job
exports.deleteJob = async (req, res) => {
  try {
    const job = await BatchJob.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ message: 'Job deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const emitStatusChange = (req, jobId, status) => {
  const io = req.app.get('io');
  if (io) io.to(ROOM_ALL).emit(EVENTS.JOB_STATUS_CHANGE, { jobId, status });
};

// Pause a scheduled job: it stops being auto-picked when due, while manual
// Execute Now still works as an operator override. Blocked jobs are pausable
// too so an operator can clear the blocked state (resume restores scheduling).
exports.pauseJob = async (req, res) => {
  try {
    const job = await BatchJob.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status === 'paused') return res.json(job);
    if (!BatchJob.PAUSABLE_STATUSES.includes(job.status)) {
      return res.status(400).json({ error: 'Only scheduled jobs can be paused' });
    }
    job.status = 'paused';
    await job.save();
    emitStatusChange(req, job._id, job.status);
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Resume a paused job: scheduled pickups are restored without losing state
// (schedule, counters and history are untouched). Also unblocks a job whose
// upstream dependency failure had it set to 'blocked'.
exports.resumeJob = async (req, res) => {
  try {
    const job = await BatchJob.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status === 'completed') {
      return res.status(400).json({ error: 'Cannot resume a completed job' });
    }
    if (job.status !== 'paused' && job.status !== 'blocked') return res.json(job); // already scheduled
    job.status = 'active';
    await job.save();
    emitStatusChange(req, job._id, job.status);
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Trigger manual execution.
//
// Dependency protection: unlike the old implementation, a manual run no
// longer bypasses upstream dependency checks. If any dependency job is in a
// failed state the dependent job is marked 'blocked' (a new status), a
// dependency alert is raised and the request is rejected with 409 — it never
// starts an execution.
//
// Body may carry an explicit outcome so an operator can record a run instead
// of leaving it to the random simulator:
//   { outcome: 'random'  } (default) simulated success/failure as before
//   { outcome: 'success' } run completes successfully
//   { outcome: 'failed'  } run completes with a failure (alert raised)
//   { outcome: 'running' } execution is recorded and left running (no completion)
exports.triggerExecution = async (req, res) => {
  try {
    const outcome = req.body && req.body.outcome;
    if (outcome && !['random', 'success', 'failed', 'running'].includes(outcome)) {
      return res.status(400).json({ error: `Invalid outcome '${outcome}'. Use random, success, failed or running` });
    }

    const job = await BatchJob.findById(req.params.id)
      .populate('dependencies.job', 'name status');
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Dependency protection: refuse to start when an upstream dependency has
    // failed, and surface the blockage as an explicit job status.
    const failedDeps = job.dependencies.filter(d => d.job && d.job.status === 'failed');
    if (failedDeps.length > 0) {
      if (job.status !== 'blocked') {
        job.status = 'blocked';
        await job.save();
        emitStatusChange(req, job._id, job.status);
      }

      const blockedBy = failedDeps.map(d => d.job.name);
      const alert = await Alert.create({
        type: 'dependency',
        severity: 'warning',
        title: `Dependency failure blocking: ${job.name}`,
        message: `Manual execution blocked — upstream dependencies failed: ${blockedBy.join(', ')}`,
        job: job._id,
        metadata: { affectedDownstream: blockedBy }
      });

      const io = req.app.get('io');
      if (io) {
        io.to(ROOM_ALL).emit(EVENTS.ALERT_NEW, {
          type: 'dependency',
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          jobName: job.name,
          jobId: job._id
        });
      }

      return res.status(409).json({
        error: 'Execution blocked: upstream dependency failures',
        blockedBy,
        jobStatus: 'blocked'
      });
    }

    const execution = await Execution.create({
      job: job._id,
      executionId: `EXEC-${uuidv4().slice(0, 8).toUpperCase()}`,
      status: 'running',
      startedAt: new Date(),
      triggeredBy: 'manual'
    });

    job.lastExecution = new Date();
    await job.save();

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(jobRoom(job._id)).emit(EVENTS.EXECUTION_START, { jobId: job._id, execution });
      io.to(ROOM_ALL).emit(EVENTS.JOB_STATUS_CHANGE, { jobId: job._id, status: 'running' });
    }

    // A recorded 'running' outcome stays running — no completion is simulated.
    if (outcome === 'running') {
      return res.json({ execution, message: 'Execution recorded as running' });
    }

    // Simulate execution completion, forcing the outcome when one was chosen.
    simulateExecution(execution, job, io, {
      forceOutcome: outcome === 'success' || outcome === 'failed' ? outcome : undefined
    });

    res.json({ execution, message: 'Execution triggered' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get execution history for a job
exports.getExecutions = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const executions = await Execution.find({ job: req.params.id })
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit));
    
    const total = await Execution.countDocuments({ job: req.params.id });
    res.json({ executions, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Record a completed (or still-running) execution directly — an operator
// backfilling what actually happened instead of relying on the simulator.
// Body: { status: success|failed|running|timeout, startedAt?, completedAt?,
// recordsProcessed?, recordsFailed?, error? (string or {message, code}) }
// A failed/timeout record applies the same job consequences as a real failed
// run (failure alert + dependent jobs blocked); success resets counters.
exports.recordExecution = async (req, res) => {
  try {
    const ALLOWED = ['success', 'failed', 'running', 'timeout'];
    const { status, startedAt, completedAt, recordsProcessed, recordsFailed, error } = req.body || {};

    if (!status || !ALLOWED.includes(status)) {
      return res.status(400).json({ error: `Invalid execution status '${status}'. Use ${ALLOWED.join(', ')}` });
    }

    const job = await BatchJob.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const start = startedAt ? new Date(startedAt) : new Date();
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ error: 'Invalid startedAt timestamp' });
    }
    const isRunning = status === 'running';
    const end = isRunning ? null : (completedAt ? new Date(completedAt) : new Date());
    if (!isRunning && Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid completedAt timestamp' });
    }
    if (end && end < start) {
      return res.status(400).json({ error: 'completedAt must be after startedAt' });
    }
    const durationSec = end ? (end.getTime() - start.getTime()) / 1000 : 0;
    const errorInfo = error
      ? (typeof error === 'string' ? { message: error, code: 'E_RECORDED' } : error)
      : undefined;

    const execution = await Execution.create({
      job: job._id,
      executionId: `EXEC-${uuidv4().slice(0, 8).toUpperCase()}`,
      status,
      startedAt: start,
      completedAt: end || undefined,
      duration: isRunning ? undefined : Math.max(0, Math.round(durationSec)),
      recordsProcessed: recordsProcessed || 0,
      recordsFailed: recordsFailed || 0,
      error: (status === 'failed' || status === 'timeout') ? errorInfo : undefined,
      triggeredBy: 'manual'
    });

    const io = req.app.get('io');

    if (isRunning) {
      job.lastExecution = start;
      await job.save();
      if (io) {
        io.to(jobRoom(job._id)).emit(EVENTS.EXECUTION_START, { jobId: job._id, execution });
        io.to(ROOM_ALL).emit(EVENTS.JOB_STATUS_CHANGE, { jobId: job._id, status: 'running' });
      }
      return res.status(201).json({ execution });
    }

    job.lastExecution = end;
    await job.save();

    // Same consequences as a simulated run resolving to that outcome.
    await finalizeRun(execution, job, io, {
      willFail: status !== 'success',
      durationSec: Math.max(0.5, durationSec),
      recordsProcessed,
      recordsFailed,
      error: (status === 'failed' || status === 'timeout') ? errorInfo : null,
      alreadyComplete: true
    });

    res.status(201).json({ execution });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get dependency graph
exports.getDependencyGraph = async (req, res) => {
  try {
    const jobs = await BatchJob.find({}).populate('dependencies.job', 'name status category priority');
    
    const nodes = jobs.map(job => ({
      id: job._id,
      name: job.name,
      status: job.status,
      category: job.category,
      priority: job.priority,
      consecutiveFailures: job.consecutiveFailures
    }));

    const edges = [];
    jobs.forEach(job => {
      job.dependencies.forEach(dep => {
        if (dep.job) {
          // An edge is red when its link was marked failed OR the upstream is
          // currently unhealthy (failed or blocked) — the path the cascade
          // took shows up red even when the link predates the failure.
          const upstream = dep.job;
          const unhealthy = upstream.status === 'failed' || upstream.status === 'blocked';
          edges.push({
            source: upstream._id.toString(),
            target: job._id.toString(),
            status: dep.status === 'failed' || unhealthy ? 'failed' : (dep.status === 'satisfied' ? 'satisfied' : dep.status)
          });
        }
      });
    });

    res.json({ nodes, edges });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const totalJobs = await BatchJob.countDocuments();
    const activeJobs = await BatchJob.countDocuments({ status: 'active' });
    const failedJobs = await BatchJob.countDocuments({ status: 'failed' });
    const pausedJobs = await BatchJob.countDocuments({ status: 'paused' });

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentExecutions = await Execution.find({ createdAt: { $gte: last24h } });
    const successCount = recentExecutions.filter(e => e.status === 'success').length;
    
    const activeAlerts = await Alert.countDocuments({ isActive: true });
    const criticalAlerts = await Alert.countDocuments({ isActive: true, severity: 'critical' });

    const avgDuration = recentExecutions.reduce((sum, e) => sum + (e.duration || 0), 0) / (recentExecutions.length || 1);

    // Status distribution for charts
    const statusDistribution = {
      success: recentExecutions.filter(e => e.status === 'success').length,
      failed: recentExecutions.filter(e => e.status === 'failed').length,
      running: recentExecutions.filter(e => e.status === 'running').length,
      queued: recentExecutions.filter(e => e.status === 'queued').length
    };

    // Hourly execution trend (last 24h)
    const hourlyTrend = [];
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(Date.now() - i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      const hourExecs = recentExecutions.filter(e => 
        e.createdAt >= hourStart && e.createdAt < hourEnd
      );
      hourlyTrend.push({
        hour: hourStart.toISOString(),
        total: hourExecs.length,
        success: hourExecs.filter(e => e.status === 'success').length,
        failed: hourExecs.filter(e => e.status === 'failed').length
      });
    }

    res.json({
      overview: { totalJobs, activeJobs, failedJobs, pausedJobs },
      executions: {
        last24h: recentExecutions.length,
        successRate: recentExecutions.length > 0 ? ((successCount / recentExecutions.length) * 100).toFixed(1) : 0,
        avgDuration: Math.round(avgDuration),
        distribution: statusDistribution
      },
      alerts: { active: activeAlerts, critical: criticalAlerts },
      hourlyTrend
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get predictive analysis. Any job on the schedule (active or failed after a
// bad run — not operator-paused) with enough history to score is included,
// so a job whose latest run failed stays visible exactly when it matters.
exports.getPredictions = async (req, res) => {
  try {
    const jobs = await BatchJob.find({ status: { $in: BatchJob.SCHEDULED_STATUSES } });
    const predictions = [];

    for (const job of jobs) {
      const recentExecutions = await Execution.find({ job: job._id })
        .sort({ createdAt: -1 })
        .limit(RISK.recentExecutions);

      const risk = computeJobRisk(job, recentExecutions);
      if (!risk || risk.riskScore === 0) continue;

      predictions.push({
        job: { id: job._id, name: job.name, priority: job.priority },
        ...risk,
        estimatedImpact: job.priority === 'critical' ? 'high' : job.priority === 'high' ? 'medium' : 'low',
        recommendation: risk.riskLevel === 'high'
          ? 'Immediate attention required. Consider pausing and investigating.'
          : risk.riskLevel === 'medium'
            ? 'Monitor closely. Schedule maintenance window for investigation.'
            : 'Continue monitoring. No immediate action needed.'
      });
    }

    predictions.sort((a, b) => b.riskScore - a.riskScore);
    res.json({ predictions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get alerts
exports.getAlerts = async (req, res) => {
  try {
    const { active, severity } = req.query;
    let query = {};
    
    if (active === 'true') query.isActive = true;
    if (severity) query.severity = severity;

    const alerts = await Alert.find(query)
      .populate('job', 'name category priority')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ alerts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Acknowledge an alert. Acknowledging also deactivates it so it leaves the
// active list (isActive: false) — it remains queryable via the 'all' view.
exports.acknowledgeAlert = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { acknowledged: true, acknowledgedBy: req.body.user || 'admin', acknowledgedAt: new Date(), isActive: false },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
