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
  const verdict = scored.score >= 4.1 ? 'CONSTRUIR' : scored.score >= 3.4 ? `PIVOTAR A ${text(project.pivot, 'una variante más enfocada')}` : 'DESCARTAR';
  const result = {
    title: text(project.title || project.name, 'Proyecto'),
    url: text(project.url),
    legitimacy: text(project.legitimacy, 'Alta confianza'),
    score: scored.score,
    dimensions: scored.dimensions,
    verdict,
    recommendation: recommendation(scored.score, {
      strong: 'Señal fuerte de portfolio',
      yes: 'Merece construirse con alcance ajustado',
      maybe: 'Prometedor solo tras un pivote más claro',
      no: 'No aporta suficiente señal para el coste de tiempo',
    }),
    metrics: Array.isArray(project.metrics) ? project.metrics : [],
  };
  result.markdown = `## Evaluación de proyecto: ${result.title}

**URL:** ${result.url || 'N/A'}
**Legitimidad:** ${result.legitimacy}
**Puntuación:** ${result.score}/5
**Veredicto:** ${result.verdict}

${table(['Dimensión', 'Puntuación'], Object.entries(result.dimensions).map(([key, value]) => [key, `${value}/5`]))}

## Recomendación
${result.recommendation}

## Pack para entrevista
- **One-pager:** producto, arquitectura, métricas y plan de evaluación.
- **Demo:** URL viva o walkthrough grabado de 2 minutos.
- **Postmortem:** qué funcionó, qué falló y mitigaciones.

## Métricas a demostrar
${bullets(result.metrics, '- Añade al menos una métrica concreta: latencia, coste, precisión, conversión, fiabilidad o tiempo ahorrado.')}

## Plan 80/20
${bullets(project.plan || ['Semana 1: construir el MVP alrededor de la métrica principal.', 'Semana 2: pulir demo, escribir one-pager y capturar un postmortem conciso.'])}`;
  return result;
}

export default evaluateProject;
