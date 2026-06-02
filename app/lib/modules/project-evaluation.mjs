import { bullets, recommendation, table, text, weightedScore } from './_shared.mjs';

export const PROJECT_WEIGHTS = {
  targetSignal: 25,
  uniqueness: 20,
  demoAbility: 20,
  metricsPotential: 15,
  timeToMvp: 10,
  starStory: 10,
};

export function evaluateProject(input = {}) {
  const project = input.project || input;
  const scored = weightedScore(project.scores || project, { ...PROJECT_WEIGHTS, ...(input.weights || {}) });
  const verdict = scored.score >= 4.1 ? 'BUILD' : scored.score >= 3.4 ? `PIVOT TO ${text(project.pivot, 'a sharper variant')}` : 'SKIP';
  const result = {
    title: text(project.title || project.name, 'Project'),
    url: text(project.url),
    legitimacy: text(project.legitimacy, 'High Confidence'),
    score: scored.score,
    dimensions: scored.dimensions,
    verdict,
    recommendation: recommendation(scored.score, {
      strong: 'Strong portfolio signal',
      yes: 'Worth building with a tight scope',
      maybe: 'Promising only after a sharper pivot',
      no: 'Not enough signal for the time cost',
    }),
    metrics: Array.isArray(project.metrics) ? project.metrics : [],
  };
  result.markdown = `## Project Evaluation: ${result.title}

**URL:** ${result.url || 'N/A'}
**Legitimacy:** ${result.legitimacy}
**Score:** ${result.score}/5
**Verdict:** ${result.verdict}

${table(['Dimension', 'Score'], Object.entries(result.dimensions).map(([key, value]) => [key, `${value}/5`]))}

## Recommendation
${result.recommendation}

## Interview Pack
- **One-pager:** product, architecture, metrics, and evaluation plan.
- **Demo:** live URL or 2 minute recorded walkthrough.
- **Postmortem:** what worked, what failed, and mitigations.

## Metrics To Prove
${bullets(result.metrics, '- Add at least one concrete metric: latency, cost, accuracy, conversion, reliability, or time saved.')}

## 80/20 Plan
${bullets(project.plan || ['Week 1: build MVP around the core metric.', 'Week 2: polish demo, write one-pager, and capture a concise postmortem.'])}`;
  return result;
}

export default evaluateProject;
