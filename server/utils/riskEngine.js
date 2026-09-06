// Single source of truth for job risk scoring. The API prediction view
// (batchController.getPredictions) and the scheduler's predictive-alert
// engine both score with computeJobRisk; all thresholds live here and
// nowhere else, so the two can never disagree about a job.

const RISK = {
  recentExecutions: 20,         // sample window both callers fetch
  minExecutions: 3,             // need at least this many executions to judge a job
  highFailureRate: 0.3,         // failure-rate factor: +40 points
  moderateFailureRate: 0.15,    // failure-rate factor: +20 points
  durationAnomalyMultiplier: 2, // duration factor: +25 points
  consecutiveFailurePenalty: 15,
  dependencyFailurePenalty: 20,
  high: 70,
  medium: 40
};

// Multi-factor risk score (0-100) per the documented algorithm: failure
// rate, duration anomalies, consecutive failures, dependency failures.
// Returns null when there aren't enough executions to judge the job.
function computeJobRisk(job, recentExecutions) {
  if (!recentExecutions || recentExecutions.length < RISK.minExecutions) return null;

  const failures = recentExecutions.filter(e => e.status === 'failed').length;
  const failureRate = failures / recentExecutions.length;
  const durations = recentExecutions.map(e => e.duration || 0);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const maxDuration = Math.max(...durations);

  let riskScore = 0;
  const reasons = [];

  // Factor 1: Failure rate
  if (failureRate > RISK.highFailureRate) {
    riskScore += 40;
    reasons.push(`High failure rate: ${(failureRate * 100).toFixed(0)}%`);
  } else if (failureRate > RISK.moderateFailureRate) {
    riskScore += 20;
    reasons.push(`Moderate failure rate: ${(failureRate * 100).toFixed(0)}%`);
  }

  // Factor 2: Duration anomaly
  if (maxDuration > avgDuration * RISK.durationAnomalyMultiplier) {
    riskScore += 25;
    reasons.push('Duration anomalies detected');
  }

  // Factor 3: Consecutive failures
  if (job.consecutiveFailures > 0) {
    riskScore += job.consecutiveFailures * RISK.consecutiveFailurePenalty;
    reasons.push(`${job.consecutiveFailures} consecutive failures`);
  }

  // Factor 4: Dependency failures
  const depFailures = job.dependencies.filter(d => d.status === 'failed').length;
  if (depFailures > 0) {
    riskScore += depFailures * RISK.dependencyFailurePenalty;
    reasons.push(`${depFailures} dependency failures`);
  }

  return {
    riskScore: Math.min(riskScore, 100),
    riskLevel: riskScore >= RISK.high ? 'high' : riskScore >= RISK.medium ? 'medium' : 'low',
    reasons
  };
}

module.exports = { computeJobRisk, RISK };
