import React, { useState, useEffect } from 'react';
import { 
  Bell, AlertTriangle, CheckCircle, Info, 
  Shield, RefreshCw, Filter, Eye
} from 'lucide-react';
import { useJobContext } from '../context/JobContext';
import { ALERT_TYPE } from '../constants';
import toast from 'react-hot-toast';

const severityIcons = {
  info: <Info size={16} />,
  warning: <AlertTriangle size={16} />,
  error: <AlertTriangle size={16} />,
  critical: <Shield size={16} />
};

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ severity: '', type: '', active: 'true' });
  const { getAlerts, acknowledgeAlert } = useJobContext();

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.severity) params.severity = filter.severity;
      if (filter.type) params.type = filter.type;
      if (filter.active) params.active = filter.active;
      const data = await getAlerts(params);
      setAlerts(data.alerts || []);
    } catch (error) {
      toast.error('Failed to load alerts');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const handleAcknowledge = async (alertId) => {
    try {
      await acknowledgeAlert(alertId);
      toast.success('Alert acknowledged');
      fetchAlerts();
    } catch (error) {
      toast.error('Failed to acknowledge alert');
    }
  };

  const activeAlerts = alerts.filter(a => a.isActive);
  const criticalCount = activeAlerts.filter(a => a.severity === 'critical').length;
  const warningCount = activeAlerts.filter(a => a.severity === 'warning').length;
  const errorCount = activeAlerts.filter(a => a.severity === 'error').length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Alert Center</h1>
          <p className="subtitle">Monitor and manage system alerts & predictive warnings</p>
        </div>
        <button className="btn-refresh" onClick={fetchAlerts}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Alert Summary Cards */}
      <div className="alert-summary-grid">
        <div className="alert-summary-card critical">
          <Shield size={24} />
          <div>
            <span className="summary-num">{criticalCount}</span>
            <span className="summary-label">Critical</span>
          </div>
        </div>
        <div className="alert-summary-card error">
          <AlertTriangle size={24} />
          <div>
            <span className="summary-num">{errorCount}</span>
            <span className="summary-label">Errors</span>
          </div>
        </div>
        <div className="alert-summary-card warning">
          <Bell size={24} />
          <div>
            <span className="summary-num">{warningCount}</span>
            <span className="summary-label">Warnings</span>
          </div>
        </div>
        <div className="alert-summary-card total">
          <CheckCircle size={24} />
          <div>
            <span className="summary-num">{activeAlerts.length}</span>
            <span className="summary-label">Active Alerts</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="toolbar">
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filter.active === 'true' ? 'active' : ''}`}
            onClick={() => setFilter({ ...filter, active: 'true' })}
          >
            Active
          </button>
          <button 
            className={`filter-tab ${filter.active === '' ? 'active' : ''}`}
            onClick={() => setFilter({ ...filter, active: '' })}
          >
            All
          </button>
        </div>
        <select 
          className="filter-select"
          value={filter.severity} 
          onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
        >
          <option value="">All Severity</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select 
          className="filter-select"
          value={filter.type}
          onChange={(e) => setFilter({ ...filter, type: e.target.value })}
        >
          <option value="">All Types</option>
          <option value="failure">Failure</option>
          <option value="predictive">Predictive</option>
          <option value="dependency">Dependency</option>
          <option value="performance">Performance</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="page-loading">
          <RefreshCw size={32} className="spin" />
        </div>
      ) : (
        <div className="alerts-full-list">
          {alerts.map((alert) => (
            <div 
              key={alert._id} 
              className={`alert-full-item severity-${alert.severity} ${alert.acknowledged ? 'acknowledged' : ''}`}
            >
              <div className="alert-left">
                <div 
                  className="alert-type-icon"
                  style={{ background: `${ALERT_TYPE[alert.type].color}20`, color: ALERT_TYPE[alert.type].color }}
                >
                  {severityIcons[alert.severity]}
                </div>
                <div className="alert-content">
                  <div className="alert-title-row">
                    <h4>{alert.title}</h4>
                    <span className="alert-type-badge" style={{ color: ALERT_TYPE[alert.type].color }}>
                      {alert.type}
                    </span>
                  </div>
                  <p className="alert-message">{alert.message}</p>
                  <div className="alert-meta">
                    {alert.job && (
                      <span className="alert-job">
                        <Eye size={12} /> {alert.job.name}
                      </span>
                    )}
                    <span className="alert-time">
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                    {alert.metadata?.confidence && (
                      <span className="alert-confidence">
                        Confidence: {alert.metadata.confidence}%
                      </span>
                    )}
                    {alert.metadata?.impactScore && (
                      <span className="alert-impact">
                        Impact: {alert.metadata.impactScore}/100
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="alert-actions">
                {alert.acknowledged ? (
                  <span className="acknowledged-badge">
                    <CheckCircle size={14} /> Acknowledged
                  </span>
                ) : (
                  <button 
                    className="btn-acknowledge"
                    onClick={() => handleAcknowledge(alert._id)}
                  >
                    <CheckCircle size={14} /> Acknowledge
                  </button>
                )}
              </div>
            </div>
          ))}

          {alerts.length === 0 && (
            <div className="empty-state-large">
              <CheckCircle size={48} className="text-green" />
              <h3>No alerts</h3>
              <p>System is running smoothly</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Alerts;
