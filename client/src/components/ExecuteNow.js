import React, { useState, useRef, useEffect } from 'react';
import { Play, ChevronDown, Loader } from 'lucide-react';
import { useJobContext } from '../context/JobContext';
import toast from 'react-hot-toast';

const OUTCOMES = [
  { value: 'random',  label: 'Random (simulated)', hint: 'Auto success or failure', color: '#1d4ed8' },
  { value: 'success', label: 'Success',            hint: 'Record a successful run', color: '#047857' },
  { value: 'failed',  label: 'Failed',             hint: 'Record a failing run',    color: '#b91c1c' },
  { value: 'running', label: 'Running',            hint: 'Mark as in progress',     color: '#b45309' }
];

// Split "Execute Now" control: the main button fires a random simulated run
// (as before); the caret opens a menu to record a specific outcome instead.
// variant='icon' renders compact icon buttons for job cards, variant='button'
// renders the full primary button used on the detail header.
const ExecuteNow = ({ jobId, variant = 'button', onAfterRun }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const groupRef = useRef(null);
  const { triggerExecution } = useJobContext();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (groupRef.current && !groupRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const run = async (e, outcome) => {
    e && e.stopPropagation();
    setBusy(true);
    try {
      await triggerExecution(jobId, outcome);
      const msgs = {
        random: 'Execution triggered',
        success: 'Execution recorded — success',
        failed: 'Execution recorded — failure',
        running: 'Execution recorded as running'
      };
      toast.success(msgs[outcome]);
    } catch (err) {
      const msg = err.message || 'Failed to trigger execution';
      toast.error(outcome === 'random' && /dependency/i.test(msg)
        ? `${msg} — job marked blocked`
        : msg);
    }
    setBusy(false);
    setOpen(false);
    onAfterRun && onAfterRun();
  };

  if (variant === 'icon') {
    return (
      <div className="execute-group" ref={groupRef} onClick={(e) => e.stopPropagation()}>
        <button
          className="btn-icon green"
          onClick={(e) => run(e, 'random')}
          title="Execute Now (random outcome)"
          disabled={busy}
        >
          {busy ? <Loader size={14} className="spin" /> : <Play size={14} />}
        </button>
        <button
          className="btn-icon execute-caret"
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          title="Choose execution outcome"
        >
          <ChevronDown size={12} />
        </button>
        {open && (
          <div className="execute-menu">
            {OUTCOMES.map(o => (
              <button key={o.value} className="execute-option" onClick={(e) => run(e, o.value)}>
                <span className="execute-dot" style={{ background: o.color }} />
                <span className="execute-opt-text">
                  <span className="execute-opt-label">{o.label}</span>
                  <span className="execute-opt-hint">{o.hint}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="execute-group" ref={groupRef} onClick={(e) => e.stopPropagation()}>
      <button className="btn-primary execute-main" onClick={(e) => run(e, 'random')} disabled={busy}>
        {busy ? <Loader size={16} className="spin" /> : <Play size={16} />} Execute Now
      </button>
      <button
        type="button"
        className="btn-primary execute-caret"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        aria-label="Choose execution outcome"
      >
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="execute-menu">
          {OUTCOMES.map(o => (
            <button key={o.value} className="execute-option" onClick={(e) => run(e, o.value)}>
              <span className="execute-dot" style={{ background: o.color }} />
              <span className="execute-opt-text">
                <span className="execute-opt-label">{o.label}</span>
                <span className="execute-opt-hint">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExecuteNow;
