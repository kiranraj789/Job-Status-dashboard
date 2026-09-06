import React, { useState } from 'react';
import { X, ClipboardList, Save } from 'lucide-react';
import { useJobContext } from '../context/JobContext';
import toast from 'react-hot-toast';

// Format a Date as a local datetime-local input value (YYYY-MM-DDTHH:mm)
const toLocalInput = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalInput = (v) => (v ? new Date(v).toISOString() : undefined);

// Modal for recording an execution that already happened — the operator
// supplies the outcome, window, volume and error instead of the simulator.
const RecordExecution = ({ jobId, jobName, onDone }) => {
  const { recordExecution } = useJobContext();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('failed');
  const now = new Date();
  const [startedAt, setStartedAt] = useState(toLocalInput(new Date(now.getTime() - 60 * 60 * 1000)));
  const [completedAt, setCompletedAt] = useState(toLocalInput(now));
  const [recordsProcessed, setRecordsProcessed] = useState(0);
  const [recordsFailed, setRecordsFailed] = useState(0);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isTerminal = status !== 'running';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const start = new Date(startedAt);
    const end = isTerminal ? new Date(completedAt) : null;
    if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime()))) {
      setFormError('Please provide valid start/end times');
      return;
    }
    if (end && end < start) {
      setFormError('End time must be after start time');
      return;
    }
    if ((status === 'failed' || status === 'timeout') && !error.trim()) {
      setFormError('An error message is required for a failed or timed-out run');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      await recordExecution(jobId, {
        status,
        startedAt: start.toISOString(),
        completedAt: isTerminal ? end.toISOString() : undefined,
        recordsProcessed: Number(recordsProcessed) || 0,
        recordsFailed: Number(recordsFailed) || 0,
        error: (status === 'failed' || status === 'timeout') ? error.trim() : undefined
      });
      toast.success('Execution recorded');
      setOpen(false);
      onDone && onDone();
    } catch (err) {
      setFormError(err.message || 'Failed to record execution');
      toast.error(err.message || 'Failed to record execution');
    }
    setSubmitting(false);
  };

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        <ClipboardList size={16} /> Record Execution
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Record Execution">
            <div className="modal-header">
              <div>
                <h2>Record Execution</h2>
                <p className="subtitle">{jobName || 'Job'}</p>
              </div>
              <button className="modal-close" onClick={() => setOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-field span-2">
                  <label className="form-label">Outcome *</label>
                  <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                    <option value="timeout">Timeout</option>
                    <option value="running">Running (still in progress)</option>
                  </select>
                  <span className="form-hint">
                    Recording a failure marks this job failed and blocks its dependents until unblocked.
                  </span>
                </div>

                <div className="form-field">
                  <label className="form-label">Started At</label>
                  <input
                    className="form-input"
                    type="datetime-local"
                    value={startedAt}
                    onChange={(e) => setStartedAt(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Ended At</label>
                  <input
                    className="form-input"
                    type="datetime-local"
                    value={completedAt}
                    onChange={(e) => setCompletedAt(e.target.value)}
                    disabled={!isTerminal}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Records Processed</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={recordsProcessed}
                    onChange={(e) => setRecordsProcessed(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Records Failed</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={recordsFailed}
                    onChange={(e) => setRecordsFailed(e.target.value)}
                  />
                </div>

                {(status === 'failed' || status === 'timeout') && (
                  <div className="form-field span-2">
                    <label className="form-label">Error Message *</label>
                    <textarea
                      className="form-textarea"
                      rows={2}
                      value={error}
                      onChange={(e) => setError(e.target.value)}
                      placeholder="e.g. Row 412 violates NOT NULL constraint in customers.stage"
                    />
                  </div>
                )}
              </div>

              {formError && <div className="form-error">{formError}</div>}

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : <><Save size={16} /> Record Execution</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default RecordExecution;
