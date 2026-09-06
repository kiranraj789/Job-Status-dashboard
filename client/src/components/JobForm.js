import React, { useState, useEffect } from 'react';
import { X, Plus, Save, Link2 } from 'lucide-react';
import { useJobContext } from '../context/JobContext';
import toast from 'react-hot-toast';

const CATEGORIES = ['ETL', 'Reporting', 'Analytics', 'DataSync', 'Cleanup', 'Compliance'];
const PRIORITIES = ['critical', 'high', 'medium', 'low'];
const STATUSES = ['active', 'paused', 'completed', 'failed', 'blocked'];

const defaultJob = {
  name: '',
  description: '',
  cronExpression: '*/30 * * * *',
  category: 'ETL',
  priority: 'medium',
  status: 'active',
  estimatedDuration: 300,
  maxRetries: 3,
  timeout: 3600,
  alertThreshold: 1.5,
  owner: '',
  tags: ''
};

const JobForm = ({ job, onClose, onSaved }) => {
  const { createJob, updateJob, getJobs } = useJobContext();
  const [form, setForm] = useState(() => job
    ? {
        name: job.name || '',
        description: job.description || '',
        cronExpression: job.cronExpression || '',
        category: job.category || 'ETL',
        priority: job.priority || 'medium',
        status: job.status || 'active',
        estimatedDuration: job.estimatedDuration ?? 300,
        maxRetries: job.maxRetries ?? 3,
        timeout: job.timeout ?? 3600,
        alertThreshold: job.alertThreshold ?? 1.5,
        owner: job.owner || '',
        tags: (job.tags || []).join(', ')
      }
    : defaultJob);
  const [depIds, setDepIds] = useState(() => new Set(
    (job?.dependencies || []).map(d => d.job?._id || d.job).filter(Boolean)
  ));
  const [candidates, setCandidates] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load every job so dependencies can be picked (edit mode excludes self)
  useEffect(() => {
    getJobs({})
      .then(data => setCandidates(data.jobs || []))
      .catch(() => setCandidates([]));
  }, []);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const toggleDep = (id) => {
    const next = new Set(depIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDepIds(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Job name is required'); return; }
    if (!form.cronExpression.trim()) { setError('Schedule (cron expression) is required'); return; }

    setSubmitting(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      cronExpression: form.cronExpression.trim(),
      category: form.category,
      priority: form.priority,
      status: form.status,
      estimatedDuration: Number(form.estimatedDuration) || 0,
      maxRetries: Number(form.maxRetries) || 0,
      timeout: Number(form.timeout) || 0,
      alertThreshold: Number(form.alertThreshold) || 0,
      owner: form.owner.trim(),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      // Tag each dependency link with the upstream's live state so the graph
      // renders satisfied/failed accurately without a separate status field.
      dependencies: [...depIds].map(id => {
        const dep = candidates.find(c => c._id === id);
        return { job: id, status: dep && dep.status === 'failed' ? 'failed' : 'satisfied' };
      })
    };

    try {
      if (job) {
        await updateJob(job._id, payload);
        toast.success('Job updated');
      } else {
        await createJob(payload);
        toast.success('Job created');
      }
      onSaved && onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save job');
      toast.error(err.message || 'Failed to save job');
    }
    setSubmitting(false);
  };

  const label = job ? 'Edit Job' : 'Add Job';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={label}>
        <div className="modal-header">
          <h2>{label}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-field span-2">
              <label className="form-label">Job Name *</label>
              <input
                className="form-input"
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="e.g. Nightly CRM Sync"
                autoFocus
              />
            </div>

            <div className="form-field span-2">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={form.description}
                onChange={set('description')}
                placeholder="What does this job do?"
              />
            </div>

            <div className="form-field span-2">
              <label className="form-label">Schedule (cron) *</label>
              <input
                className="form-input mono"
                type="text"
                value={form.cronExpression}
                onChange={set('cronExpression')}
                placeholder="0 */2 * * *"
              />
              <span className="form-hint">
                Examples: */30 * * * * (every 30 min), 0 */2 * * * (every 2 hours), 0 6 * * * (daily 6:00)
              </span>
            </div>

            <div className="form-field">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={set('category')}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label">Priority</label>
              <select className="form-select" value={form.priority} onChange={set('priority')}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={set('status')}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label">Owner</label>
              <input
                className="form-input"
                type="text"
                value={form.owner}
                onChange={set('owner')}
                placeholder="e.g. Data Engineering Team"
              />
            </div>

            <div className="form-field">
              <label className="form-label">Est. Duration (seconds)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={form.estimatedDuration}
                onChange={set('estimatedDuration')}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Max Retries</label>
              <input
                className="form-input"
                type="number"
                min="0"
                value={form.maxRetries}
                onChange={set('maxRetries')}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Timeout (seconds)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={form.timeout}
                onChange={set('timeout')}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Alert Threshold (× avg duration)</label>
              <input
                className="form-input"
                type="number"
                step="0.1"
                min="0.1"
                value={form.alertThreshold}
                onChange={set('alertThreshold')}
              />
            </div>

            <div className="form-field span-2">
              <label className="form-label">Tags (comma separated)</label>
              <input
                className="form-input"
                type="text"
                value={form.tags}
                onChange={set('tags')}
                placeholder="crm, nightly, warehouse"
              />
            </div>

            <div className="form-field span-2">
              <label className="form-label">
                <Link2 size={13} /> Dependencies — run only after these finish successfully
              </label>
              <div className="dep-check-grid">
                {candidates.length === 0 && (
                  <span className="form-hint">No other jobs available to depend on.</span>
                )}
                {candidates
                  .filter(c => c._id !== (job && job._id))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(c => (
                    <label key={c._id} className={`dep-check ${depIds.has(c._id) ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={depIds.has(c._id)}
                        onChange={() => toggleDep(c._id)}
                      />
                      <span className="dep-check-name">{c.name}</span>
                      <span className={`dep-check-status ${c.status}`}>{c.status}</span>
                    </label>
                  ))}
              </div>
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : (
                <>
                  {job ? <Save size={16} /> : <Plus size={16} />}
                  {job ? 'Save Changes' : 'Create Job'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JobForm;
