import { bullets, recommendation, table, text, weightedScore } from './_shared.mjs';

export const TRAINING_WEIGHTS = {
  northStar: 25,
  recruiterSignal: 20,
  timeEffort: 15,
  opportunityCost: 15,
  risk: 10,
  portfolioArtifact: 15,
};

export function evaluateTraining(input = {}) {
  const training = input.training || input;
  const scored = weightedScore(training.scores || training, { ...TRAINING_WEIGHTS, ...(input.weights || {}) });
  const verdict = scored.score >= 4.2 ? 'DO' : scored.score >= 3.5 ? 'DO WITH TIMEBOX' : 'DO NOT DO';
  const result = {
    title: text(training.title || training.name, 'Training'),
    provider: text(training.provider),
    score: scored.score,
    dimensions: scored.dimensions,
    verdict,
    recommendation: recommendation(scored.score, {
      strong: 'High-leverage credential or skill builder',
      yes: 'Useful if it produces visible proof',
      maybe: 'Only with a strict timebox',
      no: 'Use the time on a stronger signal',
    }),
    risks: Array.isArray(training.risks) ? training.risks : [],
    alternatives: Array.isArray(training.alternatives) ? training.alternatives : [],
  };
  result.markdown = `## Training Evaluation: ${result.title}

${result.provider ? `**Provider:** ${result.provider}\n` : ''}**Score:** ${result.score}/5
**Verdict:** ${result.verdict}

${table(['Dimension', 'Score'], Object.entries(result.dimensions).map(([key, value]) => [key, `${value}/5`]))}

## Recommendation
${result.recommendation}

## Risks
${bullets(result.risks, '- No major risks captured.')}

## Better Alternatives
${bullets(result.alternatives, '- No alternative captured.')}

## Suggested Plan
${bullets(training.plan || ['Week 1: extract the minimum useful syllabus and define one portfolio artifact.', 'Weeks 2-4: build proof while learning; stop if no demonstrable artifact emerges.'])}`;
  return result;
}

export default evaluateTraining;
