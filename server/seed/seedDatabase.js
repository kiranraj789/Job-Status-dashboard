const BatchJob = require('../models/BatchJob');
const Execution = require('../models/Execution');
const Alert = require('../models/Alert');
const { v4: uuidv4 } = require('uuid');

const seedJobs = [
  {
    name: 'ETL - Customer Data Pipeline',
    description: 'Extracts customer data from CRM, transforms and loads into analytics warehouse',
    cronExpression: '0 */2 * * *',
    category: 'ETL',
    priority: 'critical',
    status: 'active',
    estimatedDuration: 600,
    maxRetries: 3,
    timeout: 1800,
    tags: ['crm', 'analytics', 'warehouse'],
    owner: 'Data Engineering Team'
  },
  {
    name: 'Daily Sales Report',
    description: 'Generates daily sales summary report and distributes to stakeholders',
    cronExpression: '0 6 * * *',
    category: 'Reporting',
    priority: 'high',
    status: 'active',
    estimatedDuration: 300,
    tags: ['sales', 'reports'],
    owner: 'Business Intelligence'
  },
  {
    name: 'Inventory Sync',
    description: 'Synchronizes inventory levels across all warehouse systems',
    cronExpression: '*/30 * * * *',
    category: 'DataSync',
    priority: 'critical',
    status: 'active',
    estimatedDuration: 180,
    tags: ['inventory', 'sync'],
    owner: 'Supply Chain Team'
  },
  {
    name: 'ML Model Training',
    description: 'Retrains recommendation model with latest user interaction data',
    cronExpression: '0 3 * * *',
    category: 'Analytics',
    priority: 'medium',
    status: 'active',
    estimatedDuration: 3600,
    tags: ['ml', 'training'],
    owner: 'ML Engineering'
  },
  {
    name: 'User Activity Aggregation',
    description: 'Aggregates user activity logs for analytics dashboards',
    cronExpression: '0 */4 * * *',
    category: 'Analytics',
    priority: 'high',
    status: 'active',
    estimatedDuration: 450,
    tags: ['analytics', 'logs'],
    owner: 'Data Engineering Team'
  },
  {
    name: 'Payment Processing',
    description: 'Processes pending payment transactions and settles with banks',
    cronExpression: '0 */1 * * *',
    category: 'ETL',
    priority: 'critical',
    status: 'active',
    estimatedDuration: 900,
    tags: ['payments', 'finance'],
    owner: 'Finance Team'
  },
  {
    name: 'Log Rotation & Cleanup',
    description: 'Rotates application logs and cleans up old temporary files',
    cronExpression: '0 2 * * *',
    category: 'Cleanup',
    priority: 'low',
    status: 'active',
    estimatedDuration: 120,
    tags: ['logs', 'cleanup'],
    owner: 'DevOps'
  },
  {
    name: 'Compliance Audit Export',
    description: 'Exports audit trail data for regulatory compliance',
    cronExpression: '0 0 * * 0',
    category: 'Compliance',
    priority: 'high',
    status: 'active',
    estimatedDuration: 1800,
    tags: ['compliance', 'audit'],
    owner: 'Legal & Compliance'
  },
  {
    name: 'Email Campaign Processor',
    description: 'Processes email campaign sends and tracks delivery metrics',
    cronExpression: '*/15 * * * *',
    category: 'ETL',
    priority: 'medium',
    status: 'active',
    estimatedDuration: 240,
    tags: ['email', 'campaign'],
    owner: 'Marketing Team'
  },
  {
    name: 'Database Maintenance',
    description: 'Performs database optimization, index rebuilds, and statistics updates',
    cronExpression: '0 4 * * *',
    category: 'Cleanup',
    priority: 'medium',
    status: 'paused',
    estimatedDuration: 2400,
    tags: ['database', 'maintenance'],
    owner: 'DBA Team'
  },
  {
    name: 'API Rate Limiter Reset',
    description: 'Resets API rate limiting counters for all client applications',
    cronExpression: '0 */6 * * *',
    category: 'DataSync',
    priority: 'low',
    status: 'active',
    estimatedDuration: 60,
    tags: ['api', 'rate-limit'],
    owner: 'Platform Team'
  },
  {
    name: 'Fraud Detection Scan',
    description: 'Runs fraud detection algorithms on recent transactions',
    cronExpression: '*/10 * * * *',
    category: 'Analytics',
    priority: 'critical',
    status: 'active',
    estimatedDuration: 350,
    tags: ['fraud', 'security'],
    owner: 'Security Team'
  },
  {
    name: 'Data Quality Check',
    description: 'Validates data quality across all production data sources',
    cronExpression: '0 */6 * * *',
    category: 'Analytics',
    priority: 'high',
    status: 'active',
    estimatedDuration: 500,
    tags: ['quality', 'validation'],
    owner: 'Data Engineering Team'
  },
  {
    name: 'Stale Session Cleanup',
    description: 'Removes expired user sessions and stale cache entries',
    cronExpression: '*/20 * * * *',
    category: 'Cleanup',
    priority: 'low',
    status: 'active',
    estimatedDuration: 90,
    tags: ['sessions', 'cache'],
    owner: 'Platform Team'
  },
  {
    name: 'Partner API Sync',
    description: 'Synchronizes product catalog with partner marketplace APIs',
    cronExpression: '0 */3 * * *',
    category: 'DataSync',
    priority: 'high',
    status: 'failed',
    estimatedDuration: 720,
    consecutiveFailures: 3,
    tags: ['partner', 'catalog'],
    owner: 'Integration Team'
  }
];

/**
 * Seeds the connected database with demo data. Clears existing
 * collections first so re-running produces a consistent dataset.
 */
const seedDatabase = async () => {
  // Clear existing data
  await BatchJob.deleteMany({});
  await Execution.deleteMany({});
  await Alert.deleteMany({});

  // Create jobs
  const createdJobs = await BatchJob.insertMany(seedJobs);
  console.log(`Created ${createdJobs.length} batch jobs`);

  // Set up dependencies
  const etlJob = createdJobs.find(j => j.name.includes('ETL - Customer Data'));
  const salesJob = createdJobs.find(j => j.name.includes('Daily Sales Report'));
  const inventoryJob = createdJobs.find(j => j.name.includes('Inventory Sync'));
  const mlJob = createdJobs.find(j => j.name.includes('ML Model Training'));
  const activityJob = createdJobs.find(j => j.name.includes('User Activity'));
  const paymentJob = createdJobs.find(j => j.name.includes('Payment Processing'));
  const complianceJob = createdJobs.find(j => j.name.includes('Compliance Audit'));
  const fraudJob = createdJobs.find(j => j.name.includes('Fraud Detection'));
  const qualityJob = createdJobs.find(j => j.name.includes('Data Quality'));
  const partnerJob = createdJobs.find(j => j.name.includes('Partner API'));

  // Add dependencies
  salesJob.dependencies = [{ job: etlJob._id, status: 'satisfied' }];
  await salesJob.save();

  mlJob.dependencies = [
    { job: activityJob._id, status: 'satisfied' },
    { job: etlJob._id, status: 'satisfied' }
  ];
  await mlJob.save();

  fraudJob.dependencies = [
    { job: paymentJob._id, status: 'satisfied' },
    { job: etlJob._id, status: 'satisfied' }
  ];
  await fraudJob.save();

  complianceJob.dependencies = [
    { job: etlJob._id, status: 'satisfied' },
    { job: qualityJob._id, status: 'satisfied' }
  ];
  await complianceJob.save();

  partnerJob.dependencies = [
    { job: inventoryJob._id, status: 'failed' }
  ];
  await partnerJob.save();

  qualityJob.dependencies = [
    { job: etlJob._id, status: 'satisfied' }
  ];
  await qualityJob.save();

  // Generate execution history
  const executions = [];
  for (const job of createdJobs) {
    for (let i = 0; i < 20; i++) {
      const startedAt = new Date(Date.now() - (i * 60 * 60 * 1000) - Math.random() * 3600000);
      const willFail = Math.random() < (job.consecutiveFailures > 0 ? 0.4 : 0.1);
      const duration = job.estimatedDuration * (0.5 + Math.random() * 0.8);

      executions.push({
        job: job._id,
        executionId: `EXEC-${uuidv4().slice(0, 8).toUpperCase()}`,
        status: willFail ? 'failed' : 'success',
        startedAt,
        completedAt: new Date(startedAt.getTime() + duration * 1000),
        duration: Math.round(duration),
        progress: 100,
        recordsProcessed: Math.floor(Math.random() * 10000),
        recordsFailed: willFail ? Math.floor(Math.random() * 500) : 0,
        error: willFail ? { message: 'Processing error', code: 'E_FAIL' } : undefined,
        triggeredBy: i === 0 ? 'manual' : 'scheduler'
      });
    }
  }

  await Execution.insertMany(executions);
  console.log(`Created ${executions.length} executions`);

  // Generate alerts
  const alerts = [
    {
      type: 'failure',
      severity: 'critical',
      title: 'Partner API Sync - Critical Failure',
      message: 'Partner API Sync has failed 3 consecutive times. Upstream dependency Inventory Sync is also failing.',
      job: partnerJob._id,
      isActive: true,
      metadata: { impactScore: 85, affectedDownstream: ['Partner Marketplace'] }
    },
    {
      type: 'dependency',
      severity: 'error',
      title: 'Dependency Chain Broken',
      message: 'Inventory Sync failure is cascading to Partner API Sync',
      job: partnerJob._id,
      isActive: true,
      metadata: { impactScore: 70 }
    },
    {
      type: 'predictive',
      severity: 'warning',
      title: 'Predictive: ML Model Training Risk Elevated',
      message: 'Pattern analysis indicates 67% probability of failure in next 3 executions based on resource utilization trends',
      job: mlJob._id,
      isActive: true,
      metadata: {
        predictedAt: new Date(),
        confidence: 67,
        impactScore: 60
      }
    },
    {
      type: 'performance',
      severity: 'warning',
      title: 'Payment Processing Duration Anomaly',
      message: 'Last 3 executions took 2.3x longer than average. Possible database contention.',
      job: paymentJob._id,
      isActive: true,
      metadata: { impactScore: 55 }
    },
    {
      type: 'predictive',
      severity: 'info',
      title: 'Database Maintenance Recommended',
      message: 'Scheduled maintenance window approaching. Index fragmentation at 78%.',
      job: createdJobs.find(j => j.name.includes('Database Maintenance'))?._id,
      isActive: true,
      metadata: { confidence: 82, impactScore: 40 }
    }
  ];

  await Alert.insertMany(alerts.filter(a => a.job));
  console.log(`Created ${alerts.length} alerts`);

  // Update next execution times
  for (const job of createdJobs) {
    job.nextExecution = new Date(Date.now() + Math.random() * 3600000);
    job.lastExecution = new Date(Date.now() - Math.random() * 3600000);
    await job.save();
  }

  return createdJobs.length;
};

module.exports = { seedDatabase, seedJobs };
