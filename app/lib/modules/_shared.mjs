export function text(value, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

export function list(value) {
  if (Array.isArray(value)) return value.filter(item => item != null && text(item));
  if (value == null || value === '') return [];
  return [value];
}

export function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clampScore(value, fallback = 3) {
  return Math.max(1, Math.min(5, number(value, fallback)));
}

export function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(number(value) * factor) / factor;
}

export function slug(value) {
  return text(value, 'item')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

export function bullets(items, fallback = '- Unknown') {
  const rows = list(items).map(item => `- ${text(item)}`);
  return rows.length ? rows.join('\n') : fallback;
}

export function table(headers, rows) {
  const safeHeaders = headers.map(header => text(header));
  const safeRows = rows.map(row => row.map(cell => text(cell).replace(/\n/g, '<br>')));
  return [
    `| ${safeHeaders.join(' | ')} |`,
    `| ${safeHeaders.map(() => '---').join(' | ')} |`,
    ...safeRows.map(row => `| ${row.join(' | ')} |`),
  ].join('\n');
}

export function weightedScore(scores, weights) {
  let totalWeight = 0;
  let total = 0;
  const dimensions = {};
  for (const [key, weight] of Object.entries(weights)) {
    const score = clampScore(scores?.[key]);
    dimensions[key] = score;
    total += score * weight;
    totalWeight += weight;
  }
  return {
    score: round(totalWeight ? total / totalWeight : 0),
    dimensions,
  };
}

export function recommendation(score, labels = {}) {
  if (score >= 4.5) return labels.strong || 'Strong yes';
  if (score >= 4.0) return labels.yes || 'Worth doing';
  if (score >= 3.5) return labels.maybe || 'Only with a specific reason';
  return labels.no || 'Skip';
}

export function truncate(value, max = 300) {
  const clean = text(value).replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}...`;
}
