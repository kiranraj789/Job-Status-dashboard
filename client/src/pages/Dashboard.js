import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import { 
  Activity, AlertTriangle, CheckCircle, Clock, 
  TrendingUp, Zap, RefreshCw, ArrowRight
} from 'lucide-react';
import { useJobContext } from '../context/JobContext';
import { useSocket } from '../context/SocketContext';
import { EVENTS } from '../socketEvents';
import { STATUS } from '../constants';

const COLORS = {
  success: STATUS.success.color,
  failed: STATUS.failed.color,
  running: STATUS.running.color,
  queued: STATUS.queued.color
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { getDashboardStats, getPredictions, getAlerts } = useJobContext();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, predData, alertData] = await Promise.all([
        getDashboardStats(),
        getPredictions(),
        getAlerts({ active: 'true' })
      ]);
      setStats(statsData);
      setPredictions(predData.predictions || []);
      setAlerts(alertData.alerts || []);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    }
    setLoading(false);
  };

  // Always call the latest fetchData from event handlers without resubscribing
  const fetchRef = useRef(fetchData);
  fetchRef.current = fetchData;

  useEffect(() => {
    fetchData();
    // Slow fallback so state converges if events were missed across a reconnect
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Live updates: any run starting/finishing or alert firing anywhere on the
  // all-jobs stream triggers a (debounced) refetch, so the Command Center
  // surfaces follow the socket within a couple of seconds. Refetch-on-event is
  // preferred over incremental state math for correctness; the burst of
  // status changes around one run coalesces into a single fetch.
  useEffect(() => {
    if (!socket) return;
    let timer = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fetchRef.current(), 400);
    };
    socket.on(EVENTS.JOB_STATUS_CHANGE, refresh);
    socket.on(EVENTS.ALERT_NEW, refresh);
    socket.on('connect', refresh);
    return () => {
      if (timer) clearTimeout(timer);
      socket.off(EVENTS.JOB_STATUS_CHANGE, refresh);
      socket.off(EVENTS.ALERT_NEW, refresh);
      socket.off('connect', refresh);
    };
  }, [socket]);

  if (loading && !stats) {
    return (
      <div className="page-loading">
        <RefreshCw size={32} className="spin" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const pieData = stats?.executions?.distribution ? [
    { name: 'Success', value: stats.executions.distribution.success, color: COLORS.success },
    { name: 'Failed', value: stats.executions.distribution.failed, color: COLORS.failed },
    { name: 'Running', value: stats.executions.distribution.running, color: COLORS.running },
    { name: 'Queued', value: stats.executions.distribution.queued, color: COLORS.queued }
  ] : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Command Center</h1>
          <p className="subtitle">Real-time batch job monitoring & predictive analytics</p>
        </div>
        <button className="btn-refresh" onClick={fetchData}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Activity size={20} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.overview?.totalJobs || 0}</span>
            <span className="stat-label">Total Jobs</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle size={20} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.overview?.activeJobs || 0}</span>
            <span className="stat-label">Active</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><AlertTriangle size={20} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.overview?.failedJobs || 0}</span>
            <span className="stat-label">Failed</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><Clock size={20} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.alerts?.critical || 0}</span>
            <span className="stat-label">Critical Alerts</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><TrendingUp size={20} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.executions?.successRate || 0}%</span>
            <span className="stat-label">Success Rate (24h)</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Zap size={20} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.executions?.avgDuration || 0}s</span>
            <span className="stat-label">Avg Duration</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <h3>Execution Trend (24h)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={stats?.hourlyTrend || []}>
              <defs>
                <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="failedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.failed} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.failed} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="hour" 
                stroke="#475569"
                tickFormatter={(v) => new Date(v).getHours() + ':00'}
                fontSize={11}
              />
              <YAxis stroke="#475569" fontSize={11} />
              <Tooltip 
                contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                labelFormatter={(v) => new Date(v).toLocaleTimeString()}
              />
              <Area type="monotone" dataKey="success" stroke={COLORS.success} fill="url(#successGrad)" name="Success" />
              <Area type="monotone" dataKey="failed" stroke={COLORS.failed} fill="url(#failedGrad)" name="Failed" />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card pie-card">
          <h3>Execution Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Predictive Alerts & Active Alerts */}
      <div className="bottom-row">
        <div className="panel-card">
          <div className="panel-header">
            <h3><AlertTriangle size={18} /> Predictive Analysis</h3>
            <span className="badge">{predictions.length}</span>
          </div>
          <div className="predictions-list">
            {predictions.length === 0 ? (
              <div className="empty-state">
                <CheckCircle size={32} className="text-green" />
                <p>No risk predictions</p>
              </div>
            ) : (
              predictions.slice(0, 5).map((pred, idx) => (
                <div key={idx} className={`prediction-item risk-${pred.riskLevel}`}>
                  <div className="pred-header">
                    <span className="pred-job">{pred.job.name}</span>
                    <span className={`risk-badge ${pred.riskLevel}`}>{pred.riskScore}%</span>
                  </div>
                  <div className="risk-bar">
                    <div 
                      className={`risk-fill risk-${pred.riskLevel}`}
                      style={{ width: `${pred.riskScore}%` }}
                    />
                  </div>
                  <p className="pred-reason">{pred.reasons[0]}</p>
                  <button 
                    className="btn-link"
                    onClick={() => navigate(`/jobs/${pred.job.id}`)}
                  >
                    View Details <ArrowRight size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-header">
            <h3><Zap size={18} /> Active Alerts</h3>
            <span className="badge red">{alerts.length}</span>
          </div>
          <div className="alerts-list">
            {alerts.length === 0 ? (
              <div className="empty-state">
                <CheckCircle size={32} className="text-green" />
                <p>All clear</p>
              </div>
            ) : (
              alerts.slice(0, 6).map((alert, idx) => (
                <div key={idx} className={`alert-item severity-${alert.severity}`}>
                  <div className="alert-header">
                    <span className={`alert-type ${alert.type}`}>{alert.type}</span>
                    <span className="alert-time">
                      {new Date(alert.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <h4>{alert.title}</h4>
                  <p>{alert.message}</p>
                  {alert.metadata?.confidence && (
                    <div className="confidence">
                      <span>Confidence: {alert.metadata.confidence}%</span>
                      <div className="confidence-bar">
                        <div style={{ width: `${alert.metadata.confidence}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          {alerts.length > 0 && (
            <button className="btn-view-all" onClick={() => navigate('/alerts')}>
              View All Alerts <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
