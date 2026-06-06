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
  const verdict = scored.score >= 4.2 ? 'HACER' : scored.score >= 3.5 ? 'HACER CON TIMEBOX' : 'NO HACER';
  const result = {
    title: text(training.title || training.name, 'Formación'),
    provider: text(training.provider),
    score: scored.score,
    dimensions: scored.dimensions,
    verdict,
    recommendation: recommendation(scored.score, {
      strong: 'Credencial o aprendizaje de alto impacto',
      yes: 'Útil si produce prueba visible',
      maybe: 'Solo con límite de tiempo estricto',
      no: 'Usa ese tiempo en una señal más fuerte',
    }),
    risks: Array.isArray(training.risks) ? training.risks : [],
    alternatives: Array.isArray(training.alternatives) ? training.alternatives : [],
  };
  result.markdown = `## Evaluación de formación: ${result.title}

${result.provider ? `**Proveedor:** ${result.provider}\n` : ''}**Puntuación:** ${result.score}/5
**Veredicto:** ${result.verdict}

${table(['Dimensión', 'Puntuación'], Object.entries(result.dimensions).map(([key, value]) => [key, `${value}/5`]))}

## Recomendación
${result.recommendation}

## Riesgos
${bullets(result.risks, '- No se han detectado riesgos principales.')}

## Mejores alternativas
${bullets(result.alternatives, '- No hay alternativa registrada.')}

## Plan sugerido
${bullets(training.plan || ['Semana 1: extraer el temario mínimo útil y definir un artefacto de portfolio.', 'Semanas 2-4: construir prueba visible mientras aprendes; parar si no aparece evidencia demostrable.'])}`;
  return result;
}

export default evaluateTraining;
