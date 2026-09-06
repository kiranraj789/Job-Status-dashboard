// Single source of truth for the Socket.IO contract. Every event name and
// room used by server.js, the controllers, the scheduler and the simulation
// module lives here; the client package mirrors these strings in
// client/src/socketEvents.js. Renames land in exactly one file per package.
const EVENTS = {
  SUBSCRIBE_JOB: 'subscribe:job',
  SUBSCRIBE_ALL: 'subscribe:all',
  EXECUTION_START: 'execution:start',
  EXECUTION_PROGRESS: 'execution:progress',
  EXECUTION_COMPLETE: 'execution:complete',
  JOB_STATUS_CHANGE: 'job:statusChange',
  ALERT_NEW: 'alert:new'
};

const ROOM_ALL = 'all-jobs';
const jobRoom = (jobId) => `job:${jobId}`;

module.exports = { EVENTS, ROOM_ALL, jobRoom };
