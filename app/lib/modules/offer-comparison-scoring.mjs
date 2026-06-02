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
  northStar: 'North Star',
  cvMatch: 'CV match',
  level: 'Level',
  compensation: 'Comp',
  growth: 'Growth',
  remote: 'Remote',
  reputation: 'Reputation',
  techStack: 'Tech stack',
  speed: 'Speed',
  culture: 'Culture',
};

export function compareOffers(input = {}) {
  const weights = { ...OFFER_WEIGHTS, ...(input.weights || {}) };
  const offers = Array.isArray(input.offers) ? input.offers : [];
  const rankings = offers.map((offer, index) => {
    const scored = weightedScore(offer.scores || offer, weights);
    return {
      rank: 0,
      id: text(offer.id, String(index + 1)),
      company: text(offer.company, 'Company'),
      role: text(offer.role, 'Role'),
      url: text(offer.url),
      score: scored.score,
      dimensions: scored.dimensions,
      recommendation: recommendation(scored.score, {
        strong: 'Apply immediately',
        yes: 'Worth applying',
        maybe: 'Apply only with a specific reason',
        no: 'Recommend against applying',
      }),
      notes: text(offer.notes),
    };
  }).sort((a, b) => b.score - a.score).map((offer, index) => ({ ...offer, rank: index + 1 }));

  const markdown = [
    '## Offer Comparison',
    '',
    table(['Rank', 'Company', 'Role', 'Score', 'Recommendation'], rankings.map(item => [
      item.rank,
      item.company,
      item.role,
      `${item.score}/5`,
      item.recommendation,
    ])),
    '',
    '## Dimension Weights',
    table(['Dimension', 'Weight'], Object.entries(weights).map(([key, value]) => [LABELS[key] || key, `${value}%`])),
  ].join('\n');

  return { rankings, weights, markdown };
}

export default compareOffers;
