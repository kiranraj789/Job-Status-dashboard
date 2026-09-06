const Execution = require('../models/Execution');
const { EVENTS, ROOM_ALL, jobRoom } = require('../socketEvents');
const { finalizeRun } = require('./executionOutcomes');

// Simulated failure probability for demo executions (scheduler and manual runs)
const FAILURE_RATE = 0.15;

/**
 * Simulates an execution progressing over ~4-10 wall-clock seconds, then
 * resolving to success or failure. Both the API (manual triggers) and the
 * scheduler run executions through this single implementation so behavior
 * and the failure alert it raises are identical on every path.
 *
 * opts.forceOutcome ('success' | 'failed') pins the result so an operator
 * can record a manual run instead of leaving it to the random simulator.
 */
function simulateExecution(execution, job, io, opts = {}) {
  const willFail = opts.forceOutcome === 'failed'
    ? true
    : opts.forceOutcome === 'success'
      ? false
      : Math.random() < FAILURE_RATE;

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
      const errorMessage = 'Simulated processing error';

      await finalizeRun(execution, job, io, {
        willFail,
        durationSec,
        recordsProcessed: Math.floor(Math.random() * 10000),
        recordsFailed: Math.floor(Math.random() * 500),
        error: willFail ? { message: errorMessage, code: 'E_PROCESS_FAIL' } : null
      });
    }
  }, intervalMs);
}

module.exports = { simulateExecution, FAILURE_RATE };
