/**
 * Headless integration test for the Batch Monitor backend.
 *
 * Starts its own server with in-memory MongoDB on an OS-assigned ephemeral
 * port (PORT=0), parses the announced port from the child's stdout, and only
 * ever talks to that port. If the child dies before announcing (e.g. because
 * the port was taken), the run fails loudly instead of polling some other
 * server that happens to be listening.
 */
const http = require('http');

let BASE = null; // set once the spawned server announces its port
let serverProc = null;
let serverOut = '';
let serverErr = '';
let spawnExit = null;
let spawnError = null;

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    }).on('error', reject);
  });
}

function post(path, json) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(json || {});
    const req = http.request(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function put(path, json) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(json || {});
    const req = http.request(`${BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function del(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE}${path}`, { method: 'DELETE' }, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Seed a representative set of jobs via the public API so the
// seed-data assertions exercise realistic categories, priorities,
// statuses and dependencies.
async function seedTestData() {
  const make = (body) => post('/api/jobs', body);

  const etl = await make({
    name: 'ETL - Customer Data Pipeline',
    description: 'Extracts customer data from CRM, transforms and loads into analytics warehouse',
    cronExpression: '0 */2 * * *', category: 'ETL', priority: 'critical',
    status: 'active', estimatedDuration: 600, tags: ['crm', 'warehouse'], owner: 'Data Engineering Team'
  });
  assert(etl.status === 201, `Seed: create ETL job (got ${etl.status})`);

  const inventory = await make({
    name: 'Inventory Sync',
    description: 'Synchronizes inventory levels across all warehouse systems',
    cronExpression: '*/30 * * * *', category: 'DataSync', priority: 'critical',
    status: 'active', estimatedDuration: 180, tags: ['inventory'], owner: 'Supply Chain Team'
  });
  assert(inventory.status === 201, `Seed: create Inventory Sync (got ${inventory.status})`);

  const cleanup = await make({
    name: 'Log Rotation & Cleanup',
    description: 'Rotates application logs and cleans up old temporary files',
    cronExpression: '0 2 * * *', category: 'Cleanup', priority: 'low',
    status: 'paused', estimatedDuration: 120, tags: ['logs'], owner: 'DevOps'
  });
  assert(cleanup.status === 201, `Seed: create Cleanup job (got ${cleanup.status})`);

  const sales = await make({
    name: 'Daily Sales Report',
    description: 'Generates daily sales summary report and distributes to stakeholders',
    cronExpression: '0 6 * * *', category: 'Reporting', priority: 'high',
    status: 'active', estimatedDuration: 300, tags: ['sales'], owner: 'Business Intelligence',
    dependencies: [{ job: etl.data._id, status: 'satisfied' }]
  });
  assert(sales.status === 201, `Seed: create Reporting job (got ${sales.status})`);

  const ml = await make({
    name: 'ML Model Training',
    description: 'Retrains recommendation model with latest user interaction data',
    cronExpression: '0 3 * * *', category: 'Analytics', priority: 'medium',
    status: 'active', estimatedDuration: 3600, tags: ['ml'], owner: 'ML Engineering',
    dependencies: [{ job: etl.data._id, status: 'satisfied' }]
  });
  assert(ml.status === 201, `Seed: create Analytics job (got ${ml.status})`);

  const partner = await make({
    name: 'Partner API Sync',
    description: 'Synchronizes product catalog with partner marketplace APIs',
    cronExpression: '0 */3 * * *', category: 'DataSync', priority: 'high',
    status: 'failed', estimatedDuration: 720, consecutiveFailures: 3, tags: ['partner'], owner: 'Integration Team',
    dependencies: [{ job: inventory.data._id, status: 'failed' }]
  });
  assert(partner.status === 201, `Seed: create failed Partner job (got ${partner.status})`);

  const compliance = await make({
    name: 'Compliance Audit Export',
    description: 'Exports audit trail data for regulatory compliance',
    cronExpression: '0 0 * * 0', category: 'Compliance', priority: 'high',
    status: 'active', estimatedDuration: 1800, tags: ['compliance'], owner: 'Legal & Compliance',
    dependencies: [{ job: etl.data._id, status: 'satisfied' }]
  });
  assert(compliance.status === 201, `Seed: create Compliance job (got ${compliance.status})`);

  console.log(`  ✅ Seeded ${7} jobs across 6 categories, 4 priorities`);
}

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    failures.push(msg);
    console.log(`  ❌ ${msg}`);
  }
}

// Wait for the spawned child to print its bound port, then confirm /health
// answers on exactly that port. Resolves with the port, or null if the child
// exited / never announced within the budget.
async function waitForServer(maxMs = 30000) {
  const portRe = /Server running on port (\d+)/;
  const start = Date.now();
  let port = null;

  while (Date.now() - start < maxMs) {
    if (spawnExit || spawnError) return null;
    const m = portRe.exec(serverOut);
    if (m) { port = parseInt(m[1], 10); break; }
    await new Promise(r => setTimeout(r, 200));
  }
  if (!port) return null;

  BASE = `http://127.0.0.1:${port}`;

  // The server announces only after the DB is connected and any auto-seed has
  // finished (both precede listen()), so this is a short confirmatory poll.
  while (Date.now() - start < maxMs) {
    try {
      const r = await get('/health');
      if (r.status === 200 && r.data.status === 'ok') return port;
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  return null;
}

async function runTests() {
  console.log('🚀 Starting server with in-memory MongoDB...\n');
  
  // Start the server as a child process on an OS-assigned ephemeral port so
  // it can never collide with another server that happens to be listening.
  const { spawn } = require('child_process');
  serverProc = spawn('node', ['server.js'], {
    env: { ...process.env, USE_IN_MEMORY_DB: 'true', PORT: '0', AUTO_SEED: 'false' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  serverProc.stdout.on('data', d => { serverOut += d; process.stdout.write(`  [server] ${d}`); });
  serverProc.stderr.on('data', d => { serverErr += d; process.stderr.write(`  [server:err] ${d}`); });
  serverProc.on('exit', (code, signal) => { spawnExit = { code, signal }; });
  serverProc.on('error', (err) => { spawnError = err.message; });

  console.log('⏳ Waiting for spawned server to announce its port...');
  const port = await waitForServer(30000);
  if (!port) {
    console.error('\n❌ Spawned server failed to start within 30 seconds');
    if (spawnExit) console.error(`   child exited: code=${spawnExit.code} signal=${spawnExit.signal}`);
    if (spawnError) console.error(`   spawn error: ${spawnError}`);
    console.error('stdout:', serverOut);
    console.error('stderr:', serverErr);
    cleanup();
    process.exit(1);
  }
  console.log(`✅ Server is up on http://127.0.0.1:${port}!\n`);

  // ============ HEALTH CHECK ============
  console.log('--- Health Check ---');
  const health = await get('/health');
  assert(health.status === 200, `Health endpoint returns 200 (got ${health.status})`);
  assert(health.data.status === 'ok', `Health status is "ok"`);

  // ============ SEED DEMO DATA ============
  console.log('\n--- Seed Demo Data (via API) ---');
  await seedTestData();

  // ============ DASHBOARD STATS ============
  console.log('\n--- Dashboard Stats ---');
  const dash = await get('/api/dashboard/stats');
  assert(dash.status === 200, `Dashboard stats returns 200`);
  assert(dash.data.overview !== undefined, `Dashboard has overview object`);
  assert(dash.data.executions !== undefined, `Dashboard has executions object`);
  assert(dash.data.alerts !== undefined, `Dashboard has alerts object`);
  assert(Array.isArray(dash.data.hourlyTrend), `Dashboard has hourlyTrend array`);
  console.log(`  📊 Overview: ${JSON.stringify(dash.data.overview)}`);

  // ============ CREATE JOB ============
  console.log('\n--- Create Job ---');
  const createRes = await post('/api/jobs', {
    name: 'Test ETL Pipeline',
    description: 'Integration test job',
    cronExpression: '0 */4 * * *',
    category: 'ETL',
    priority: 'high',
    status: 'active',
    estimatedDuration: 300
  });
  assert(createRes.status === 201, `Create job returns 201 (got ${createRes.status})`);
  assert(createRes.data._id !== undefined, `Created job has _id`);
  assert(createRes.data.name === 'Test ETL Pipeline', `Job name matches`);
  const jobId = createRes.data._id;

  // ============ LIST JOBS ============
  console.log('\n--- List Jobs ---');
  const jobs = await get('/api/jobs');
  assert(jobs.status === 200, `List jobs returns 200`);
  assert(jobs.data.jobs.length >= 1, `At least 1 job returned (got ${jobs.data.jobs.length})`);
  assert(jobs.data.total >= 1, `Total count >= 1`);

  // Check job has stats attached
  const firstJob = jobs.data.jobs[0];
  assert(firstJob.stats !== undefined, `Job has stats object`);
  assert(typeof firstJob.stats.successRate !== 'undefined', `Stats has successRate`);

  // ============ FILTER JOBS ============
  console.log('\n--- Filter Jobs ---');
  const filtered = await get('/api/jobs?status=active&priority=high');
  assert(filtered.status === 200, `Filter jobs returns 200`);
  assert(Array.isArray(filtered.data.jobs), `Filtered result is array`);

  // ============ GET SINGLE JOB ============
  console.log('\n--- Get Single Job ---');
  const single = await get(`/api/jobs/${jobId}`);
  assert(single.status === 200, `Get job returns 200`);
  assert(single.data.job._id === jobId, `Job ID matches`);
  assert(Array.isArray(single.data.executions), `Has executions array`);

  // ============ UPDATE JOB ============
  console.log('\n--- Update Job ---');
  const updated = await put(`/api/jobs/${jobId}`, {
    description: 'Updated description',
    priority: 'critical'
  });
  assert(updated.status === 200, `Update job returns 200`);
  assert(updated.data.description === 'Updated description', `Description updated`);
  assert(updated.data.priority === 'critical', `Priority updated`);

  // ============ PAUSE / RESUME CONTRACT ============
  console.log('\n--- Pause / Resume Contract ---');
  const scheduleMarker = new Date(Date.now() + 3600 * 1000).toISOString();
  await put(`/api/jobs/${jobId}`, { nextExecution: scheduleMarker });

  const transitions = [
    { name: 'pause a scheduled job',           action: 'pause',  expect: 'paused' },
    { name: 'pause again is idempotent',       action: 'pause',  expect: 'paused' },
    { name: 'resume a paused job',             action: 'resume', expect: 'active' },
    { name: 'resume an active job is a no-op', action: 'resume', expect: 'active' }
  ];
  for (const t of transitions) {
    const r = await put(`/api/jobs/${jobId}/${t.action}`);
    assert(r.status === 200, `${t.name}: returns 200 (got ${r.status})`);
    assert(r.data.status === t.expect, `${t.name}: status becomes ${t.expect} (got ${r.data.status})`);
  }

  // Pausing/resuming preserves schedule state (nextExecution unchanged)
  await put(`/api/jobs/${jobId}/pause`);
  const pausedView = await get(`/api/jobs/${jobId}`);
  assert(pausedView.data.job.status === 'paused', `Paused job reads paused via GET`);
  assert(pausedView.data.job.nextExecution === scheduleMarker, `Pause preserves nextExecution`);
  const resumedView = await put(`/api/jobs/${jobId}/resume`);
  assert(resumedView.data.status === 'active', `Resume restores scheduled status`);
  assert(resumedView.data.nextExecution === scheduleMarker, `Resume does not lose schedule state`);

  // Only scheduled jobs can be paused
  const completedJob = await post('/api/jobs', {
    name: 'Retired Job', cronExpression: '0 0 * * *', category: 'Cleanup',
    priority: 'low', status: 'completed', estimatedDuration: 60
  });
  const badPause = await put(`/api/jobs/${completedJob.data._id}/pause`);
  assert(badPause.status === 400, `Completed job rejects pause (got ${badPause.status})`);
  await del(`/api/jobs/${completedJob.data._id}`);

  // A failed job is still on the schedule: pausable, resumable
  const failedJob = await post('/api/jobs', {
    name: 'Failing Pipeline', cronExpression: '0 */2 * * *', category: 'ETL',
    priority: 'high', status: 'failed', estimatedDuration: 300, consecutiveFailures: 2
  });
  const pauseFailed = await put(`/api/jobs/${failedJob.data._id}/pause`);
  assert(pauseFailed.status === 200 && pauseFailed.data.status === 'paused',
    `Failed (still scheduled) job can be paused (got ${pauseFailed.status})`);
  const resumeFailed = await put(`/api/jobs/${failedJob.data._id}/resume`);
  assert(resumeFailed.status === 200 && resumeFailed.data.status === 'active',
    `Failed job resumes to scheduled (got ${resumeFailed.status})`);
  await del(`/api/jobs/${failedJob.data._id}`);

  // ============ TRIGGER EXECUTION (while paused = operator override) ============
  console.log('\n--- Trigger Execution While Paused ---');
  await put(`/api/jobs/${jobId}/pause`);
  const trigger = await post(`/api/jobs/${jobId}/execute`);
  assert(trigger.status === 200, `Manual execute works on a paused job (got ${trigger.status})`);
  assert(trigger.data.execution.executionId.startsWith('EXEC-'), `Execution ID format correct`);
  assert(trigger.data.execution.status === 'running', `Execution starts as running`);

  // Wait for execution to complete (it's simulated over ~4-10s)
  console.log('  ⏳ Waiting for simulated execution to complete...');
  await new Promise(r => setTimeout(r, 12000));

  // ============ GET EXECUTIONS ============
  console.log('\n--- Get Executions ---');
  const execs = await get(`/api/jobs/${jobId}/executions`);
  assert(execs.status === 200, `Get executions returns 200`);
  assert(Array.isArray(execs.data.executions), `Executions is array`);
  assert(execs.data.total >= 1, `At least 1 execution`);
  console.log(`  📊 Found ${execs.data.executions.length} executions`);

  // Check execution completed
  const lastExec = execs.data.executions[0];
  assert(lastExec.status === 'success' || lastExec.status === 'failed', 
    `Execution completed with status: ${lastExec.status}`);

  // An override run must not silently unpause the job
  const afterOverride = await get(`/api/jobs/${jobId}`);
  assert(afterOverride.data.job.status === 'paused',
    `Paused job stays paused after an override run (got ${afterOverride.data.job.status})`);
  const finalResume = await put(`/api/jobs/${jobId}/resume`);
  assert(finalResume.status === 200 && finalResume.data.status === 'active', `Resume after override run`);

  // ============ DEPENDENCY GRAPH ============
  console.log('\n--- Dependency Graph ---');
  const graph = await get('/api/dependencies/graph');
  assert(graph.status === 200, `Dependency graph returns 200`);
  assert(Array.isArray(graph.data.nodes), `Graph has nodes array`);
  assert(Array.isArray(graph.data.edges), `Graph has edges array`);
  assert(graph.data.nodes.length >= 1, `At least 1 node (got ${graph.data.nodes.length})`);
  
  // Verify node shape
  const node = graph.data.nodes[0];
  assert(node.id !== undefined, `Node has id`);
  assert(node.name !== undefined, `Node has name`);
  assert(node.status !== undefined, `Node has status`);

  // ============ PREDICTIONS ============
  console.log('\n--- Predictive Analysis ---');
  const preds = await get('/api/predictions');
  assert(preds.status === 200, `Predictions returns 200`);
  assert(Array.isArray(preds.data.predictions), `Predictions is array`);
  console.log(`  🔮 ${preds.data.predictions.length} predictions generated`);
  
  if (preds.data.predictions.length > 0) {
    const pred = preds.data.predictions[0];
    assert(pred.job !== undefined, `Prediction has job`);
    assert(typeof pred.riskScore === 'number', `Prediction has numeric riskScore`);
    assert(pred.riskLevel !== undefined, `Prediction has riskLevel`);
    assert(Array.isArray(pred.reasons), `Prediction has reasons array`);
    assert(pred.recommendation !== undefined, `Prediction has recommendation`);
    console.log(`  📊 Top prediction: ${pred.job.name} (risk: ${pred.riskScore}, level: ${pred.riskLevel})`);
  }

  // ============ ALERTS ============
  console.log('\n--- Alerts ---');
  const alerts = await get('/api/alerts?active=true');
  assert(alerts.status === 200, `Alerts returns 200`);
  assert(Array.isArray(alerts.data.alerts), `Alerts is array`);
  console.log(`  🔔 ${alerts.data.alerts.length} active alerts`);

  if (alerts.data.alerts.length > 0) {
    const alert = alerts.data.alerts[0];
    assert(alert.type !== undefined, `Alert has type`);
    assert(alert.severity !== undefined, `Alert has severity`);
    assert(alert.title !== undefined, `Alert has title`);
    
    // Acknowledge it
    const ack = await put(`/api/alerts/${alert._id}/acknowledge`);
    assert(ack.status === 200, `Acknowledge alert returns 200`);
    assert(ack.data.acknowledged === true, `Alert is now acknowledged`);
  }

  // ============ SEED DATA VERIFICATION ============
  console.log('\n--- Seed Data Verification ---');
  const allJobs = await get('/api/jobs');
  assert(allJobs.data.jobs.length >= 1, `Database has seeded jobs (count: ${allJobs.data.jobs.length})`);
  
  // Check categories exist
  const categories = [...new Set(allJobs.data.jobs.map(j => j.category))];
  console.log(`  📂 Categories: ${categories.join(', ')}`);
  assert(categories.length >= 3, `Multiple categories present`);
  
  // Check priorities exist
  const priorities = [...new Set(allJobs.data.jobs.map(j => j.priority))];
  console.log(`  🎯 Priorities: ${priorities.join(', ')}`);
  assert(priorities.length >= 3, `Multiple priorities present`);

  // Check for jobs with dependencies
  const jobsWithDeps = allJobs.data.jobs.filter(j => j.dependencies && j.dependencies.length > 0);
  assert(jobsWithDeps.length >= 1, `Jobs with dependencies exist (count: ${jobsWithDeps.length})`);
  console.log(`  🔗 Jobs with dependencies: ${jobsWithDeps.length}`);

  // Check for failed jobs
  const failedJobs = allJobs.data.jobs.filter(j => j.status === 'failed');
  assert(failedJobs.length >= 1, `Failed jobs exist (count: ${failedJobs.length})`);
  console.log(`  ❌ Failed jobs: ${failedJobs.length}`);

  // Check for paused jobs
  const pausedJobs = allJobs.data.jobs.filter(j => j.status === 'paused');
  console.log(`  ⏸️  Paused jobs: ${pausedJobs.length}`);

  // ============ DELETE JOB ============
  console.log('\n--- Delete Job ---');
  const deleted = await del(`/api/jobs/${jobId}`);
  assert(deleted.status === 200, `Delete job returns 200`);
  
  // Verify deleted
  const afterDelete = await get(`/api/jobs/${jobId}`);
  assert(afterDelete.status === 404, `Deleted job returns 404`);

  // ============ INVALID REQUESTS ============
  console.log('\n--- Error Handling ---');
  const notFound = await get('/api/jobs/nonexistent');
  assert(notFound.status === 404, `Non-existent job returns 404`);
  
  const badCreate = await post('/api/jobs', {});
  assert(badCreate.status === 400, `Invalid create returns 400`);

  // ============ DASHBOARD WITH DATA ============
  console.log('\n--- Dashboard with Data ---');
  const dashAfter = await get('/api/dashboard/stats');
  assert(dashAfter.status === 200, `Dashboard stats still works`);
  assert(dashAfter.data.overview.totalJobs >= 1, `Total jobs count correct`);
  assert(dashAfter.data.hourlyTrend.length === 24, `Hourly trend has 24 entries`);

  // ============ SUMMARY ============
  console.log('\n' + '='.repeat(60));
  console.log(`\n📋 TEST RESULTS:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  if (failures.length > 0) {
    console.log('\n   Failures:');
    failures.forEach(f => console.log(`     - ${f}`));
  }

  console.log('\n' + '='.repeat(60));
  cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

function cleanup() {
  if (serverProc) {
    serverProc.kill('SIGTERM');
    // Force kill after 2s
    setTimeout(() => { try { serverProc.kill('SIGKILL'); } catch {} }, 2000);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  cleanup();
  process.exit(1);
});
