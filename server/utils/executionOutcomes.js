const BatchJob = require('../models/BatchJob');
const Execution = require('../models/Execution');
const Alert = require('../models/Alert');
const { EVENTS, ROOM_ALL, jobRoom } = require('../socketEvents');
const { blockDependentsOf } = require('./dependencies');

/**
 * Applies the consequences of an execution resolving to success or failure:
 * final execution state, job counters/status, the failure alert, and cascade
 * blocking of dependent jobs. Shared by the simulated runner (scheduler and
 * manual runs) and operator-recorded executions so every path raises
 * identical alerts, counters and blocked dependents.
 *
 * `job` is a mongoose doc whose status snapshot decides override semantics:
 * an operator-paused job keeps its state through the run; scheduled jobs
 * (active/failed) move to failed on failure and active on success.
 */
async function finalizeRun(execution, job, io, {
  willFail,
  durationSec,
  recordsProcessed = 0,
  recordsFailed = 0,
  error = null,
  alreadyComplete = false
}) {
  const status = willFail ? 'failed' : 'success';

  // Recorded executions are created in their final state with operator-
  // supplied timestamps/counters; only the running simulator needs the full
  // terminal write below.
  if (alreadyComplete) {
    await Execution.findByIdAndUpdate(execution._id, { status, progress: 100 });
  } else {
    await Execution.findByIdAndUpdate(execution._id, {
      status,
      completedAt: new Date(),
      duration: Math.max(1, Math.round(durationSec)),
      progress: 100,
      recordsProcessed,
      recordsFailed: willFail ? recordsFailed : 0,
      error: willFail && error ? (typeof error === 'string' ? { message: error } : error) : undefined
    });
  }

  const jobAfterRun = {};
  if (willFail) {
    jobAfterRun.$inc = { consecutiveFailures: 1 };
    if (job.status !== 'paused') jobAfterRun.$set = { status: 'failed' };
    await BatchJob.findByIdAndUpdate(job._id, jobAfterRun);
  } else {
    jobAfterRun.consecutiveFailures = 0;
    if (job.status !== 'paused') jobAfterRun.status = 'active';
    await BatchJob.findByIdAndUpdate(job._id, jobAfterRun);
  }

  const resultingJobStatus = job.status === 'paused' ? 'paused' : (willFail ? 'failed' : 'active');
  const errorMessage = error && (typeof error === 'string' ? error : error.message);

  if (willFail) {
    const alert = await Alert.create({
      type: 'failure',
      severity: job.priority === 'critical' ? 'critical' : 'error',
      title: `Job Failed: ${job.name}`,
      message: `Execution ${execution.executionId} failed after ${Math.round(durationSec)}s${errorMessage ? `: ${errorMessage}` : ''}`,
      job: job._id,
      execution: execution._id
    });

    if (io) {
      io.to(ROOM_ALL).emit(EVENTS.ALERT_NEW, {
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        jobName: job.name,
        jobId: job._id,
        executionId: execution._id
      });
    }

    // Cascade: dependents can no longer run while this job is failed.
    await blockDependentsOf(job._id, { io, rootJobName: job.name });
  }

  if (io) {
    io.to(jobRoom(job._id)).emit(EVENTS.EXECUTION_COMPLETE, {
      jobId: job._id,
      executionId: execution._id,
      status,
      duration: Math.max(1, Math.round(durationSec))
    });
    io.to(ROOM_ALL).emit(EVENTS.JOB_STATUS_CHANGE, {
      jobId: job._id,
      status: resultingJobStatus
    });
  }
}

module.exports = { finalizeRun };
