import React, { createContext, useContext, useState, useCallback } from 'react';

const JobContext = createContext(null);

export const useJobContext = () => useContext(JobContext);

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const JobProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apiCall = useCallback(async (endpoint, options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      setLoading(false);
      return data;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, []);

  const getDashboardStats = () => apiCall('/dashboard/stats');
  const getJobs = (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiCall(`/jobs?${query}`);
  };
  const getJob = (id) => apiCall(`/jobs/${id}`);
  const createJob = (data) => apiCall('/jobs', { method: 'POST', body: JSON.stringify(data) });
  const updateJob = (id, data) => apiCall(`/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  const pauseJob = (id) => apiCall(`/jobs/${id}/pause`, { method: 'PUT' });
  const resumeJob = (id) => apiCall(`/jobs/${id}/resume`, { method: 'PUT' });
  const deleteJob = (id) => apiCall(`/jobs/${id}`, { method: 'DELETE' });
  const triggerExecution = (id) => apiCall(`/jobs/${id}/execute`, { method: 'POST' });
  const getExecutions = (id, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiCall(`/jobs/${id}/executions?${query}`);
  };
  const getDependencyGraph = () => apiCall('/dependencies/graph');
  const getPredictions = () => apiCall('/predictions');
  const getAlerts = (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiCall(`/alerts?${query}`);
  };
  const acknowledgeAlert = (id) => apiCall(`/alerts/${id}/acknowledge`, { method: 'PUT' });

  return (
    <JobContext.Provider value={{
      loading, error,
      getDashboardStats, getJobs, getJob, createJob, updateJob, pauseJob, resumeJob, deleteJob,
      triggerExecution, getExecutions, getDependencyGraph, getPredictions,
      getAlerts, acknowledgeAlert
    }}>
      {children}
    </JobContext.Provider>
  );
};
