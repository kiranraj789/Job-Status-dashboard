const BatchJob = require('../models/BatchJob');
const Alert = require('../models/Alert');
const { EVENTS, ROOM_ALL } = require('../socketEvents');

/**
 * A job cannot run while any of its dependencies is unhealthy (failed or
 * itself blocked). When an upstream job's run fails, every scheduled
 * dependent — and transitively their dependents — is marked 'blocked'
 * instead of remaining 'active'/'failed', so the UI, scheduler and risk
 * engine all stop treating them as runnable. Each newly blocked job raises
 * one dependency alert naming the original upstream as the root cause.
 *
 * Only jobs that actually transition into blocked get an alert, so repeated
 * failures upstream do not stack duplicates. Jobs already paused or
 * completed by an operator are never touched.
 *
 * @returns {Promise<Array<{job: object, rootCause: string}>>} newly blocked jobs
 */
async function blockDependentsOf(failedJobId, { io, rootJobName } = {}) {
  const root = rootJobName
    ? { name: rootJobName }
    : await BatchJob.findById(failedJobId).select('name');

  const queue = [failedJobId];
  const newlyBlocked = [];

  while (queue.length) {
    const upstreamId = queue.shift();
    const dependents = await BatchJob.find({
      'dependencies.job': upstreamId,
      status: { $in: BatchJob.SCHEDULED_STATUSES }
    });

    for (const dep of dependents) {
      dep.status = 'blocked';
      await dep.save();
      newlyBlocked.push({ job: dep, rootCause: root ? root.name : upstreamId.toString() });

      const alert = await Alert.create({
        type: 'dependency',
        severity: 'warning',
        title: `Blocked: ${dep.name}`,
        message: `${dep.name} is blocked because upstream dependency ${root ? root.name : upstreamId.toString()} failed (root cause)`,
        job: dep._id,
        metadata: {
          rootCause: failedJobId.toString(),
          affectedDownstream: [root ? root.name : upstreamId.toString()]
        }
      });

      if (io) {
        io.to(ROOM_ALL).emit(EVENTS.JOB_STATUS_CHANGE, { jobId: dep._id, status: 'blocked' });
        io.to(ROOM_ALL).emit(EVENTS.ALERT_NEW, {
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          jobName: dep.name,
          jobId: dep._id
        });
      }

      // Their dependents are blocked too (a blocked upstream is unhealthy).
      queue.push(dep._id);
    }
  }

  return newlyBlocked;
}

module.exports = { blockDependentsOf };
