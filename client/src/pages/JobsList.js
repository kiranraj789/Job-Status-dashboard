import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Filter, Pause, Power, Trash2, Plus, Pencil,
  Clock, CheckCircle, AlertTriangle, RefreshCw,
  ArrowRight, Ban
} from 'lucide-react';
import { useJobContext } from '../context/JobContext';
import { PRIORITY } from '../constants';
import JobForm from '../components/JobForm';
import ExecuteNow from '../components/ExecuteNow';
import toast from 'react-hot-toast';

const formatNextRun = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const statusIcons = {
  active: <CheckCircle size={14} />,
  failed: <AlertTriangle size={14} />,
  paused: <Pause size={14} />,
  blocked: <Ban size={14} />,
  completed: <CheckCircle size={14} />
};


const JobsList = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', priority: '', category: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formJob, setFormJob] = useState(null);
  const { getJobs, pauseJob, resumeJob, deleteJob } = useJobContext();
  const navigate = useNavigate();

  const openAdd = () => { setFormJob(null); setFormOpen(true); };
  const openEdit = (e, job) => { e.stopPropagation(); setFormJob(job); setFormOpen(true); };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.category) params.category = filters.category;
      const data = await getJobs(params);
      setJobs(data.jobs || []);
    } catch (error) {
      toast.error('Failed to load jobs');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, [filters]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchJobs();
  };

  const handlePauseToggle = async (e, job) => {
    e.stopPropagation();
    if (job.status === 'blocked') {
      try {
        await resumeJob(job._id);
        toast.success('Job unblocked — scheduling restored');
        fetchJobs();
      } catch (error) {
        toast.error('Failed to unblock job');
      }
      return;
    }
    const pausing = job.status !== 'paused';
    try {
      await (pausing ? pauseJob(job._id) : resumeJob(job._id));
      toast.success(pausing ? 'Job paused' : 'Job resumed');
      fetchJobs();
    } catch (error) {
      toast.error(`Failed to ${pausing ? 'pause' : 'resume'} job`);
    }
  };

  const handleDelete = async (e, jobId, jobName) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${jobName}"?`)) return;
    try {
      await deleteJob(jobId);
      toast.success('Job deleted');
      fetchJobs();
    } catch (error) {
      toast.error('Failed to delete job');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Batch Jobs</h1>
          <p className="subtitle">Manage and monitor all scheduled jobs Kiran</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Job
        </button>
      </div>

      {/* Search & Filters */}
      <div className="toolbar">
        <form className="search-bar" onSubmit={handleSearch}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-search">Search</button>
        </form>
        <button 
          className={`btn-filter ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} /> Filters
        </button>
      </div>

      {showFilters && (
        <div className="filter-panel">
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="failed">Failed</option>
            <option value="paused">Paused</option>
            <option value="blocked">Blocked</option>
          </select>
          <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
            <option value="">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="">All Categories</option>
            <option value="ETL">ETL</option>
            <option value="Reporting">Reporting</option>
            <option value="Analytics">Analytics</option>
            <option value="DataSync">DataSync</option>
            <option value="Cleanup">Cleanup</option>
            <option value="Compliance">Compliance</option>
          </select>
          <button className="btn-clear" onClick={() => setFilters({ status: '', priority: '', category: '' })}>
            Clear Filters
          </button>
        </div>
      )}

      {/* Jobs Grid */}
      {loading ? (
        <div className="page-loading">
          <RefreshCw size={32} className="spin" />
        </div>
      ) : (
        <div className="jobs-grid">
          {jobs.map((job) => (
            <div 
              key={job._id} 
              className={`job-card status-${job.status}`}
              onClick={() => navigate(`/jobs/${job._id}`)}
            >
              <div className="job-card-header">
                <div className="job-status-badge">
                  {statusIcons[job.status]}
                  <span>{job.status}</span>
                </div>
                <span 
                  className="priority-badge"
                  style={{ background: PRIORITY[job.priority] }}
                >
                  {job.priority}
                </span>
              </div>

              <h3 className="job-name">{job.name}</h3>
              <p className="job-desc">{job.description}</p>

              <div className="job-meta">
                <span className="category-tag">{job.category}</span>
                <span className="cron-expr">
                  <Clock size={12} /> {job.cronExpression}
                </span>
              </div>

              {job.stats && (
                <div className="job-stats">
                  <div className="stat">
                    <span className="stat-num">{job.stats.successRate}%</span>
                    <span className="stat-lbl">Success</span>
                  </div>
                  <div className="stat">
                    <span className="stat-num">{job.stats.avgDuration}s</span>
                    <span className="stat-lbl">Avg Time</span>
                  </div>
                  <div className="stat">
                    <span className="stat-num">{job.stats.recentExecutions}</span>
                    <span className="stat-lbl">Executions</span>
                  </div>
                </div>
              )}

              {job.consecutiveFailures > 0 && (
                <div className="failure-warning">
                  <AlertTriangle size={14} />
                  <span>{job.consecutiveFailures} consecutive failures</span>
                </div>
              )}

              {job.nextExecution && (
                <div className={`next-run ${job.status === 'paused' || job.status === 'blocked' ? 'muted' : ''}`}>
                  <Clock size={12} />
                  <span>
                    {job.status === 'paused'
                      ? 'Paused — not scheduled'
                      : job.status === 'blocked'
                        ? 'Blocked by dependency — not scheduled'
                        : `Next run ${formatNextRun(job.nextExecution)}`}
                  </span>
                </div>
              )}

              <div className="job-card-actions">
                <ExecuteNow jobId={job._id} variant="icon" onAfterRun={fetchJobs} />
                {job.status !== 'completed' && (
                  <button 
                    className={`btn-icon ${job.status === 'paused' ? 'orange' : job.status === 'blocked' ? 'purple' : ''}`}
                    onClick={(e) => handlePauseToggle(e, job)}
                    title={job.status === 'blocked'
                      ? 'Unblock job'
                      : job.status === 'paused' ? 'Resume schedule' : 'Pause schedule'}
                  >
                    <Power size={14} />
                  </button>
                )}
                <button 
                  className="btn-icon"
                  onClick={(e) => openEdit(e, job)}
                  title="Edit job"
                >
                  <Pencil size={14} />
                </button>
                <button 
                  className="btn-icon red"
                  onClick={(e) => handleDelete(e, job._id, job.name)}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
                <button 
                  className="btn-icon"
                  onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${job._id}`); }}
                  title="View Details"
                >
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && jobs.length === 0 && (
        <div className="empty-state-large">
          <AlertTriangle size={48} />
          <h3>No jobs found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      )}

      {formOpen && (
        <JobForm
          job={formJob}
          onClose={() => setFormOpen(false)}
          onSaved={fetchJobs}
        />
      )}
    </div>
  );
};

export default JobsList;
