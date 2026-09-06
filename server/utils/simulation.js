const BatchJob = require('../models/BatchJob');
const Execution = require('../models/Execution');
const Alert = require('../models/Alert');
const { EVENTS, ROOM_ALL, jobRoom } = require('../socketEvents');

// Simulated failure probability for demo executions (scheduler and manual runs)
const FAILURE_RATE = 0.15;

/**
 * Simulates an execution progressing over ~4-10 wall-clock seconds, then
 * resolving to success or failure. Both the API (manual triggers) and the
 * scheduler run executions through this single implementation so behavior
 * and the failure alert it raises are identical on every path.
 */
function simulateExecution(execution, job, io) {
  const willFail = Math.random() < FAILURE_RATE;

  // Simulated wall-clock runtime in seconds, scaled from the estimated
  // duration so executions visibly progress instead of completing instantly
  const simSeconds = Math.max(4, Math.min(10, Math.round(job.estimatedDuration / 40)));
  const ticks = simSeconds;
  const intervalMs = (simSeconds * 1000) / ticks;

  let progress = 0;
  const progressInterval = setInterval(async () => {
    progress += (100 / ticks) + Math.random() * 5;
    if (progress > 100) progress = 100;

    await Execution.findByIdAndUpdate(execution._id, { progress });
    if (io) {
      io.to(jobRoom(job._id)).emit(EVENTS.EXECUTION_PROGRESS, {
        executionId: execution._id,
        progress: Math.round(progress)
      });
    }

    if (progress >= 100) {
      clearInterval(progressInterval);

      const completedAt = new Date();
      const durationSec = (completedAt - execution.startedAt) / 1000;

      await Execution.findByIdAndUpdate(execution._id, {
        status: willFail ? 'failed' : 'success',
        completedAt,
        duration: Math.round(durationSec),
        progress: 100,
        recordsProcessed: Math.floor(Math.random() * 10000),
        recordsFailed: willFail ? Math.floor(Math.random() * 500) : 0,
        error: willFail ? { message: 'Simulated processing error', code: 'E_PROCESS_FAIL' } : undefined
      });

      // A paused job stays paused through an operator-override run: the
      // outcome only touches counters/status when the job is scheduled
      // (active or failed), never an explicit operator pause.
      const jobAfterRun = {};
      if (willFail) {
        jobAfterRun.$inc = { consecutiveFailures: 1 };
        if (job.status !== 'paused') jobAfterRun.$set = { status: 'failed' };
        await BatchJob.findByIdAndUpdate(job._id, jobAfterRun);

        const alert = await Alert.create({
          type: 'failure',
          severity: job.priority === 'critical' ? 'critical' : 'error',
          title: `Job Failed: ${job.name}`,
          message: `Execution ${execution.executionId} failed after ${Math.round(durationSec)}s`,
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
      } else {
        jobAfterRun.consecutiveFailures = 0;
        if (job.status !== 'paused') jobAfterRun.status = 'active';
        await BatchJob.findByIdAndUpdate(job._id, jobAfterRun);
      }

      const resultingJobStatus = job.status === 'paused' ? 'paused' : (willFail ? 'failed' : 'active');

      if (io) {
        io.to(jobRoom(job._id)).emit(EVENTS.EXECUTION_COMPLETE, {
          jobId: job._id,
          executionId: execution._id,
          status: willFail ? 'failed' : 'success',
          duration: Math.round(durationSec)
        });
        io.to(ROOM_ALL).emit(EVENTS.JOB_STATUS_CHANGE, {
          jobId: job._id,
          status: resultingJobStatus
        });
      }
    }
  }, intervalMs);
}

module.exports = { simulateExecution, FAILURE_RATE };
