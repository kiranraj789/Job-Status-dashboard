const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const batchController = require('../controllers/batchController');

// Return 404 for malformed ids instead of a 500 CastError
const requireValidId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: 'Resource not found' });
  }
  next();
};

// Dashboard
router.get('/dashboard/stats', batchController.getDashboardStats);

// Batch Jobs
router.get('/jobs', batchController.getJobs);
router.get('/jobs/:id', requireValidId, batchController.getJob);
router.post('/jobs', batchController.createJob);
router.put('/jobs/:id', requireValidId, batchController.updateJob);
router.put('/jobs/:id/pause', requireValidId, batchController.pauseJob);
router.put('/jobs/:id/resume', requireValidId, batchController.resumeJob);
router.delete('/jobs/:id', requireValidId, batchController.deleteJob);

// Executions
router.get('/jobs/:id/executions', requireValidId, batchController.getExecutions);
router.post('/jobs/:id/execute', requireValidId, batchController.triggerExecution);
router.post('/jobs/:id/record', requireValidId, batchController.recordExecution);

// Dependency Graph
router.get('/dependencies/graph', batchController.getDependencyGraph);

// Predictions & Alerts
router.get('/predictions', batchController.getPredictions);
router.get('/alerts', batchController.getAlerts);
router.put('/alerts/:id/acknowledge', batchController.acknowledgeAlert);

module.exports = router;
