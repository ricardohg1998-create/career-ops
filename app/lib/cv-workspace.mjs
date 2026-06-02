import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function text(value, fallback = '') {
  return String(value ?? fallback ?? '').trim();
}

function section(markdown = '', heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|$)`, 'im'));
  return match?.[1]?.trim() || '';
}

function markdownToBlocks(markdown = '') {
  const lines = markdown.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines.map(line => {
    if (/^[-*]\s+/.test(line)) return `<div class="bullet-item">${escapeHtml(line.replace(/^[-*]\s+/, ''))}</div>`;
    if (/^###\s+/.test(line)) return `<div class="item-title">${escapeHtml(line.replace(/^###\s+/, ''))}</div>`;
    return `<p>${escapeHtml(line.replace(/^#+\s*/, ''))}</p>`;
  }).join('\n');
}

function keywordCandidates(textValue = '') {
  const stop = new Set(['with', 'from', 'this', 'that', 'will', 'role', 'team', 'work', 'about', 'your', 'para', 'como', 'este', 'esta', 'the', 'and']);
  return [...new Set(String(textValue || '')
    .toLowerCase()
    .match(/[a-z][a-z0-9+#.-]{3,}/g) || [])]
    .filter(word => !stop.has(word))
    .slice(0, 40);
}

export function computeKeywordCoverage(sourceText = '', cvText = '') {
  const keywords = keywordCandidates(sourceText);
  const cvLower = String(cvText || '').toLowerCase();
  const covered = keywords.filter(keyword => cvLower.includes(keyword));
  const missing = keywords.filter(keyword => !cvLower.includes(keyword));
  return {
    keywords,
    covered,
    missing,
    score: keywords.length ? Number((covered.length / keywords.length).toFixed(2)) : null,
  };
}

export function renderCvTemplate(root, { title = 'Career-Ops CV', jdText = '', report = null, format = 'a4' } = {}) {
  const profilePath = path.join(root, 'config', 'profile.yml');
  const cvPath = path.join(root, 'cv.md');
  const templatePath = path.join(root, 'templates', 'cv-template.html');
  const profile = existsSync(profilePath) ? yaml.load(readFileSync(profilePath, 'utf-8')) || {} : {};
  const cv = existsSync(cvPath) ? readFileSync(cvPath, 'utf-8') : '';
  const template = existsSync(templatePath) ? readFileSync(templatePath, 'utf-8') : null;
  const sourceText = [jdText, report?.markdown, report?.tldr].filter(Boolean).join('\n');
  const coverage = computeKeywordCoverage(sourceText, cv);
  const name = text(profile.name || profile.full_name, title);
  const summary = section(cv, 'Summary') || cv.split(/\r?\n/).find(line => line.trim() && !line.startsWith('#')) || '';
  const replacements = {
    LANG: profile.language?.output || 'en',
    PAGE_WIDTH: format === 'letter' ? '8.5in' : '210mm',
    NAME: name,
    PHONE: profile.phone || '',
    EMAIL: profile.email || '',
    LINKEDIN_URL: profile.linkedin_url || profile.linkedin || '#',
    LINKEDIN_DISPLAY: profile.linkedin_display || profile.linkedin_url || profile.linkedin || '',
    PORTFOLIO_URL: profile.portfolio_url || profile.website || '#',
    PORTFOLIO_DISPLAY: profile.portfolio_display || profile.portfolio_url || profile.website || '',
    LOCATION: profile.location || '',
    SECTION_SUMMARY: 'Professional Summary',
    SUMMARY_TEXT: escapeHtml(summary),
    SECTION_COMPETENCIES: 'Targeted Keywords',
    COMPETENCIES: coverage.keywords.slice(0, 12).map(keyword => `<span>${escapeHtml(keyword)}</span>`).join('\n'),
    SECTION_EXPERIENCE: 'Experience',
    EXPERIENCE: markdownToBlocks(section(cv, 'Experience') || cv),
    SECTION_PROJECTS: 'Projects',
    PROJECTS: markdownToBlocks(section(cv, 'Projects')),
    SECTION_EDUCATION: 'Education',
    EDUCATION: markdownToBlocks(section(cv, 'Education')),
    SECTION_CERTIFICATIONS: 'Certifications',
    CERTIFICATIONS: markdownToBlocks(section(cv, 'Certifications')),
    SECTION_SKILLS: 'Skills',
    SKILLS: markdownToBlocks(section(cv, 'Skills')),
  };

  if (template) {
    const html = template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => replacements[key] ?? '');
    return { html, keywords: coverage.keywords, coverage };
  }

  return {
    keywords: coverage.keywords,
    coverage,
    html: `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(name)} - CV</title></head><body><h1>${escapeHtml(name)}</h1><pre>${escapeHtml(cv)}</pre></body></html>`,
  };
}
