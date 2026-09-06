import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Power, RefreshCw, Clock, Pencil,
  CheckCircle, AlertTriangle, XCircle, Loader,
  BarChart3, Calendar, User, Zap
} from 'lucide-react';
import JobForm from '../components/JobForm';
import ExecuteNow from '../components/ExecuteNow';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, LineChart, Line 
} from 'recharts';
import { useJobContext } from '../context/JobContext';
import { useSocket } from '../context/SocketContext';
import { EVENTS } from '../socketEvents';
import toast from 'react-hot-toast';

const JobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [formOpen, setFormOpen] = useState(false);
  const { getJob, pauseJob, resumeJob } = useJobContext();
  const { socket } = useSocket();

  const fetchData = async () => {
    try {
      const data = await getJob(id);
      setJob(data.job);
      setExecutions(data.executions || []);
    } catch (error) {
      toast.error('Failed to load job details');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (!socket) return;
    
    socket.emit(EVENTS.SUBSCRIBE_JOB, id);
    
    socket.on(EVENTS.EXECUTION_START, (data) => {
      if (data.jobId === id) {
        toast.success('Execution started');
        fetchData();
      }
    });

    socket.on(EVENTS.EXECUTION_COMPLETE, (data) => {
      if (data.jobId === id) {
        toast[data.status === 'success' ? 'success' : 'error'](
          `Execution ${data.status}`
        );
        fetchData();
      }
    });

    return () => {
      socket.off(EVENTS.EXECUTION_START);
      socket.off(EVENTS.EXECUTION_COMPLETE);
    };
  }, [socket, id]);

  // A blocked job pauses via the pause endpoint, but its primary action is a
  // single-click unblock straight back to scheduled 'active'.
  const handlePauseToggle = async () => {
    if (job.status === 'blocked') {
      try {
        await resumeJob(id);
        toast.success('Job unblocked — scheduling restored');
        fetchData();
      } catch (error) {
        toast.error('Failed to unblock job');
      }
      return;
    }
    const pausing = job.status !== 'paused';
    try {
      await (pausing ? pauseJob(id) : resumeJob(id));
      toast.success(pausing ? 'Job paused' : 'Job resumed');
      fetchData();
    } catch (error) {
      toast.error(`Failed to ${pausing ? 'pause' : 'resume'} job`);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <RefreshCw size={32} className="spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="page-container">
        <p>Job not found</p>
        <button onClick={() => navigate('/jobs')}>Back to Jobs</button>
      </div>
    );
  }

  // Prepare chart data
  const durationData = executions.slice(0, 15).reverse().map((exec, idx) => ({
    name: `#${idx + 1}`,
    duration: exec.duration || 0,
    status: exec.status
  }));

  const recordsData = executions.slice(0, 15).reverse().map((exec, idx) => ({
    name: `#${idx + 1}`,
    processed: exec.recordsProcessed || 0,
    failed: exec.recordsFailed || 0
  }));

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/jobs')}>
            <ArrowLeft size={18} /> Back
          </button>
          <div>
            <h1>{job.name}</h1>
            <p className="subtitle">{job.description}</p>
          </div>
        </div>
        <div className="header-actions">
          {job.status !== 'completed' && (
            <button className="btn-secondary" onClick={handlePauseToggle}>
              <Power size={16} />
              {job.status === 'blocked' ? 'Unblock' : job.status === 'paused' ? 'Resume' : 'Pause'}
            </button>
          )}
          <button className="btn-secondary" onClick={() => setFormOpen(true)}>
            <Pencil size={16} /> Edit
          </button>
          <ExecuteNow jobId={job._id} onAfterRun={fetchData} />
        </div>
      </div>

      {/* Job Info Cards */}
      <div className="detail-info-grid">
        <div className="info-card">
          <Zap size={16} />
          <span className="info-label">Status</span>
          <span className={`info-value status-${job.status}`}>{job.status}</span>
        </div>
        <div className="info-card">
          <BarChart3 size={16} />
          <span className="info-label">Category</span>
          <span className="info-value">{job.category}</span>
        </div>
        <div className="info-card">
          <Clock size={16} />
          <span className="info-label">Schedule</span>
          <span className="info-value mono">{job.cronExpression}</span>
        </div>
        <div className="info-card">
          <Calendar size={16} />
          <span className="info-label">Est. Duration</span>
          <span className="info-value">{job.estimatedDuration}s</span>
        </div>
        <div className="info-card">
          <User size={16} />
          <span className="info-label">Owner</span>
          <span className="info-value">{job.owner || 'N/A'}</span>
        </div>
        <div className="info-card">
          <RefreshCw size={16} />
          <span className="info-label">Consecutive Fails</span>
          <span className={`info-value ${job.consecutiveFailures > 0 ? 'text-red' : ''}`}>
            {job.consecutiveFailures}
          </span>
        </div>
      </div>

      {/* Tags */}
      {job.tags && job.tags.length > 0 && (
        <div className="tags-row">
          {job.tags.map((tag, idx) => (
            <span key={idx} className="tag">{tag}</span>
          ))}
        </div>
      )}

      {/* Dependencies */}
      {job.dependencies && job.dependencies.length > 0 && (
        <div className="dependencies-section">
          <h3>Dependencies</h3>
          <div className="dep-list">
            {job.dependencies.map((dep, idx) => (
              <div key={idx} className={`dep-item dep-${dep.status}`}>
                <span className="dep-name">{dep.job?.name || 'Unknown'}</span>
                <span className={`dep-status ${dep.status}`}>{dep.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {['overview', 'history', 'charts'].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="overview-content">
          <div className="panel-card">
            <h3>Recent Executions</h3>
            <div className="executions-table">
              <div className="table-header">
                <span>ID</span>
                <span>Status</span>
                <span>Duration</span>
                <span>Records</span>
                <span>Started</span>
              </div>
              {executions.slice(0, 10).map((exec) => (
                <div key={exec._id} className="table-row">
                  <span className="mono">{exec.executionId}</span>
                  <span className={`status-cell ${exec.status}`}>
                    {exec.status === 'success' && <CheckCircle size={14} />}
                    {exec.status === 'failed' && <XCircle size={14} />}
                    {exec.status === 'running' && <Loader size={14} className="spin" />}
                    {exec.status}
                  </span>
                  <span>{exec.duration ? `${exec.duration}s` : '-'}</span>
                  <span>{exec.recordsProcessed?.toLocaleString() || 0}</span>
                  <span>{new Date(exec.startedAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="history-content">
          <div className="executions-timeline">
            {executions.map((exec) => (
              <div key={exec._id} className={`timeline-item ${exec.status}`}>
                <div className="timeline-marker">
                  {exec.status === 'success' && <CheckCircle size={16} />}
                  {exec.status === 'failed' && <XCircle size={16} />}
                  {exec.status === 'running' && <Loader size={16} className="spin" />}
                </div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <span className="mono">{exec.executionId}</span>
                    <span className="timeline-time">
                      {new Date(exec.startedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="timeline-details">
                    <span>Duration: {exec.duration ? `${exec.duration}s` : 'In progress'}</span>
                    <span>Records: {exec.recordsProcessed?.toLocaleString() || 0}</span>
                    <span>Triggered: {exec.triggeredBy}</span>
                  </div>
                  {exec.progress < 100 && exec.status === 'running' && (
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${exec.progress}%` }} />
                      <span>{exec.progress}%</span>
                    </div>
                  )}
                  {exec.error && (
                    <div className="error-box">
                      <AlertTriangle size={14} />
                      <span>{exec.error.message}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {formOpen && (
        <JobForm
          job={job}
          onClose={() => setFormOpen(false)}
          onSaved={fetchData}
        />
      )}

      {activeTab === 'charts' && (
        <div className="charts-content">
          <div className="charts-row">
            <div className="chart-card">
              <h3>Execution Duration</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={durationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#475569" fontSize={11} />
                  <YAxis stroke="#475569" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                  <Bar dataKey="duration" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <h3>Records Processed</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={recordsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#475569" fontSize={11} />
                  <YAxis stroke="#475569" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                  <Bar dataKey="processed" fill="#047857" radius={[4, 4, 0, 0]} name="Processed" />
                  <Bar dataKey="failed" fill="#b91c1c" radius={[4, 4, 0, 0]} name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetail;
