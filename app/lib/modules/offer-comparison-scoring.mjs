import { recommendation, table, text, weightedScore } from './_shared.mjs';

export const OFFER_WEIGHTS = {
  northStar: 25,
  cvMatch: 15,
  level: 15,
  compensation: 10,
  growth: 10,
  remote: 5,
  reputation: 5,
  techStack: 5,
  speed: 5,
  culture: 5,
};

const LABELS = {
  northStar: 'Alineación principal',
  cvMatch: 'Encaje CV',
  level: 'Nivel',
  compensation: 'Compensación',
  growth: 'Crecimiento',
  remote: 'Remote',
  reputation: 'Reputación',
  techStack: 'Stack técnico',
  speed: 'Velocidad',
  culture: 'Cultura',
};

export function compareOffers(input = {}) {
  const weights = { ...OFFER_WEIGHTS, ...(input.weights || {}) };
  const offers = Array.isArray(input.offers) ? input.offers : [];
  const rankings = offers.map((offer, index) => {
    const scored = weightedScore(offer.scores || offer, weights);
    return {
      rank: 0,
      id: text(offer.id, String(index + 1)),
      company: text(offer.company, 'Empresa'),
      role: text(offer.role, 'Rol'),
      url: text(offer.url),
      score: scored.score,
      dimensions: scored.dimensions,
      recommendation: recommendation(scored.score, {
        strong: 'Aplicar con prioridad',
        yes: 'Merece aplicar',
        maybe: 'Aplicar solo con una razón específica',
        no: 'Recomiendo no aplicar',
      }),
      notes: text(offer.notes),
    };
  }).sort((a, b) => b.score - a.score).map((offer, index) => ({ ...offer, rank: index + 1 }));

  const markdown = [
    '## Comparativa de ofertas',
    '',
    table(['Ranking', 'Empresa', 'Rol', 'Puntuación', 'Recomendación'], rankings.map(item => [
      item.rank,
      item.company,
      item.role,
      `${item.score}/5`,
      item.recommendation,
    ])),
    '',
    '## Pesos por dimensión',
    table(['Dimensión', 'Peso'], Object.entries(weights).map(([key, value]) => [LABELS[key] || key, `${value}%`])),
  ].join('\n');

  return { rankings, weights, markdown };
}

export default compareOffers;
