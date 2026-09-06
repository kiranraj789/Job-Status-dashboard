// Client-side copy of the Socket.IO contract. The server package owns the
// authoritative strings in server/socketEvents.js; this mirror keeps the
// client free of inline event literals. Keep the two in sync.
export const EVENTS = {
  SUBSCRIBE_JOB: 'subscribe:job',
  SUBSCRIBE_ALL: 'subscribe:all',
  EXECUTION_START: 'execution:start',
  EXECUTION_PROGRESS: 'execution:progress',
  EXECUTION_COMPLETE: 'execution:complete',
  JOB_STATUS_CHANGE: 'job:statusChange',
  ALERT_NEW: 'alert:new'
};
