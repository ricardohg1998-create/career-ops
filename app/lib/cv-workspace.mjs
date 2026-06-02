import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function stripMarkdown(value = '') {
  return String(value)
    .replace(/^#+\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .trim();
}

function inlineMarkdown(value = '') {
  let html = escapeHtml(String(value ?? '').trim());
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return html;
}

function text(value, fallback = '') {
  if (value === null || value === undefined) return String(fallback ?? '').trim();
  if (typeof value === 'object') return String(fallback ?? '').trim();
  return String(value).trim();
}

function normalizeKey(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeUrl(value = '') {
  const clean = text(value);
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean) || clean.startsWith('mailto:')) return clean;
  if (clean.includes('@') && !clean.includes('/')) return `mailto:${clean}`;
  return `https://${clean}`;
}

function displayUrl(value = '') {
  return text(value)
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}

function getCandidate(profile = {}) {
  return profile.candidate || profile;
}

function getLanguage(profile = {}) {
  const modesDir = text(profile.language?.modes_dir);
  const output = text(profile.language?.output);
  if (output) return output;
  if (modesDir.includes('/es') || modesDir.endsWith('\\es')) return 'es';
  return 'en';
}

function localizedLabels(language) {
  if (language === 'es') {
    return {
      summary: 'Perfil Profesional',
      competencies: 'Competencias Clave',
      experience: 'Experiencia Profesional',
      projects: 'Proyectos Destacados',
      education: 'Formación Académica',
      certifications: 'Certificaciones',
      skills: 'Idiomas y Habilidades',
    };
  }
  return {
    summary: 'Professional Summary',
    competencies: 'Core Competencies',
    experience: 'Experience',
    projects: 'Projects',
    education: 'Education',
    certifications: 'Certifications',
    skills: 'Skills',
  };
}

function markdownSections(markdown = '') {
  const lines = String(markdown).split(/\r?\n/);
  const sections = [];
  let current = { heading: '_intro', content: [] };
  for (const line of lines) {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      sections.push(current);
      current = { heading: stripMarkdown(match[1]), content: [] };
    } else {
      current.content.push(line);
    }
  }
  sections.push(current);
  return sections;
}

function section(markdown = '', aliases = []) {
  const wanted = aliases.map(normalizeKey);
  const found = markdownSections(markdown).find(item => wanted.includes(normalizeKey(item.heading)));
  return found?.content.join('\n').replace(/^\s*---+\s*$/gm, '').trim() || '';
}

function paragraphs(markdown = '') {
  return String(markdown)
    .split(/\n{2,}/)
    .map(block => block.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter(block => !/^[-*]\s+\*\*(?:tel[eé]fono|email|linkedin|web|ubicaci[oó]n|otros):/i.test(block))
    .map(inlineMarkdown)
    .join('<br><br>');
}

function keywordCandidates(value = '') {
  const stop = new Set([
    'with', 'from', 'this', 'that', 'will', 'role', 'team', 'work', 'about', 'your', 'para', 'como', 'este', 'esta',
    'the', 'and', 'date', 'score', 'archetype', 'evaluation', 'report', 'pdf', 'legitimacy', 'status', 'url',
  ]);
  return [...new Set(String(value || '')
    .toLowerCase()
    .match(/[a-záéíóúüñ][a-záéíóúüñ0-9+#./-]{2,}/gi) || [])]
    .map(word => word.replace(/\s+/g, ' ').trim())
    .filter(word => word.length <= 42 && !stop.has(normalizeKey(word)))
    .slice(0, 40);
}

export function computeKeywordCoverage(sourceText = '', cvText = '') {
  const keywords = keywordCandidates(sourceText);
  const cvLower = String(cvText || '').toLowerCase();
  const covered = keywords.filter(keyword => cvLower.includes(keyword.toLowerCase()));
  const missing = keywords.filter(keyword => !cvLower.includes(keyword.toLowerCase()));
  return {
    keywords,
    covered,
    missing,
    score: keywords.length ? Number((covered.length / keywords.length).toFixed(2)) : null,
  };
}

function unique(values = []) {
  const seen = new Set();
  return values
    .map(value => stripMarkdown(value))
    .filter(Boolean)
    .filter(value => {
      const key = normalizeKey(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function competencyList(profile, skillsSection, coverage) {
  const targetRoles = profile.target_roles?.primary || [];
  const superpowers = profile.narrative?.superpowers || [];
  const skillBullets = String(skillsSection).split(/\r?\n/)
    .filter(line => /^[-*]\s+/.test(line))
    .map(line => line.replace(/^[-*]\s+/, '').replace(/:\s+.+$/, ''));
  return unique([...targetRoles, ...superpowers, ...skillBullets, ...coverage.covered])
    .slice(0, 9)
    .map(item => `<span class="competency-tag">${inlineMarkdown(item)}</span>`)
    .join('\n');
}

function collectEntries(markdown = '') {
  const lines = String(markdown).split(/\r?\n/);
  const entries = [];
  let current = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = line.match(/^###\s+(.+)$/);
    if (heading) {
      if (current) entries.push(current);
      current = { heading: stripMarkdown(heading[1]), lines: [] };
      continue;
    }
    if (current && line) current.lines.push(line);
  }
  if (current) entries.push(current);
  return entries;
}

function bulletItems(lines = [], limit = 3) {
  return lines
    .filter(line => /^[-*]\s+/.test(line))
    .slice(0, limit)
    .map(line => `<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>`)
    .join('\n');
}

function renderExperience(markdown = '') {
  const hasPeriod = value => /\d{4}|\b(?:presente|present|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|dec)\b/i.test(String(value));
  return collectEntries(markdown)
    .slice(0, 6)
    .map((entry, index) => {
      const parts = entry.heading.split(/\s+\|\s+/).map(stripMarkdown).filter(Boolean);
      const role = parts[0] || entry.heading;
      const company = parts.length >= 3 ? parts[1] : parts[1] && !hasPeriod(parts[1]) ? parts[1] : role;
      const period = parts.find(hasPeriod) || '';
      const bullets = bulletItems(entry.lines, index === 0 ? 5 : 1);
      return `<div class="job">
  <div class="job-header">
    <span class="job-company">${inlineMarkdown(company)}</span>
    ${period ? `<span class="job-period">${inlineMarkdown(period)}</span>` : ''}
  </div>
  <div class="job-role">${inlineMarkdown(role)}</div>
  ${bullets ? `<ul>${bullets}</ul>` : ''}
</div>`;
    })
    .join('\n');
}

function renderProjects(markdown = '') {
  return collectEntries(markdown)
    .slice(0, 3)
    .map(entry => {
      const title = entry.heading.replace(/\s+\(.+$/, '').trim();
      const description = entry.lines.find(line => !/^[-*]\s+/.test(line) && !/^\*stack/i.test(line)) || '';
      const stack = entry.lines.find(line => /^\*?Stack/i.test(stripMarkdown(line))) || '';
      const highlights = bulletItems(entry.lines, 2);
      return `<div class="project">
  <div><span class="project-title">${inlineMarkdown(title)}</span><span class="project-badge">MarTech</span></div>
  ${description ? `<div class="project-desc">${inlineMarkdown(description)}</div>` : ''}
  ${highlights ? `<ul>${highlights}</ul>` : ''}
  ${stack ? `<div class="project-tech">${inlineMarkdown(stack)}</div>` : ''}
</div>`;
    })
    .join('\n');
}

function renderEducation(markdown = '') {
  const lines = String(markdown).split(/\r?\n/);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^[-*]\s+/.test(line)) continue;
    const clean = line.trim().replace(/^[-*]\s+/, '');
    const parts = clean.split(/\s+\|\s+/).map(stripMarkdown).filter(Boolean);
    const title = parts[0] || stripMarkdown(clean);
    const year = clean.match(/\(([^)]*\d{4}[^)]*)\)/)?.[1] || '';
    const org = parts[1]?.replace(/\s*\([^)]*\)\s*$/, '') || '';
    const nextLine = lines[i + 1] || '';
    const desc = /^\s+/.test(nextLine) && !/^\s+[-*]\s+/.test(nextLine)
      ? nextLine.trim().replace(/^\*+\s*/, '').replace(/\*+$/, '').trim()
      : '';
    items.push(`<div class="edu-item">
  <div class="edu-header">
    <span class="edu-title">${inlineMarkdown(title)}</span>
    ${year ? `<span class="edu-year">${inlineMarkdown(year)}</span>` : ''}
  </div>
  ${org || desc ? `<div class="edu-desc">${org ? `<span class="edu-org">${inlineMarkdown(org)}</span>` : ''}${org && desc ? '. ' : ''}${inlineMarkdown(desc)}</div>` : ''}
</div>`);
  }
  return items.slice(0, 4).join('\n');
}

function renderSkills(markdown = '') {
  return String(markdown)
    .split(/\r?\n/)
    .filter(line => /^[-*]\s+/.test(line.trim()))
    .slice(0, 6)
    .map(line => {
      const clean = line.trim().replace(/^[-*]\s+/, '');
      const plain = stripMarkdown(clean);
      const colon = plain.indexOf(':');
      const category = colon >= 0 ? plain.slice(0, colon).trim() : plain;
      const body = colon >= 0 ? plain.slice(colon + 1).trim() : '';
      return `<div class="skill-item"><span class="skill-category">${inlineMarkdown(category)}:</span> ${inlineMarkdown(body)}</div>`;
    })
    .join('\n');
}

function renderFallbackBlocks(markdown = '') {
  const lines = String(markdown).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const chunks = [];
  let list = [];
  const flush = () => {
    if (!list.length) return;
    chunks.push(`<ul>${list.map(item => `<li>${inlineMarkdown(item)}</li>`).join('\n')}</ul>`);
    list = [];
  };
  for (const line of lines) {
    if (/^[-*]\s+/.test(line)) {
      list.push(line.replace(/^[-*]\s+/, ''));
    } else {
      flush();
      if (/^###\s+/.test(line)) chunks.push(`<div class="item-title">${inlineMarkdown(line.replace(/^###\s+/, ''))}</div>`);
      else chunks.push(`<p>${inlineMarkdown(line.replace(/^#+\s*/, ''))}</p>`);
    }
  }
  flush();
  return chunks.join('\n');
}

function removeEmptySection(html, comment, content) {
  if (String(content || '').trim()) return html;
  return html.replace(new RegExp(`\\n?\\s*<!-- ${comment} -->[\\s\\S]*?(?=\\n\\s*<!-- |\\n</div>\\s*</body>)`, 'i'), '\n');
}

function safeSourceText(jdText = '', report = null) {
  if (jdText) return jdText;
  const keywordBlock = report?.markdown?.match(/(?:ATS|Keywords?|Palabras clave)[\s\S]{0,1400}/i)?.[0] || '';
  return [report?.title, report?.role, report?.tldr, keywordBlock].filter(Boolean).join('\n');
}

export function renderCvTemplate(root, { title = 'Career-Ops CV', jdText = '', report = null, format = 'a4' } = {}) {
  const profilePath = path.join(root, 'config', 'profile.yml');
  const cvPath = path.join(root, 'cv.md');
  const templatePath = path.join(root, 'templates', 'cv-template.html');
  const profile = existsSync(profilePath) ? yaml.load(readFileSync(profilePath, 'utf-8')) || {} : {};
  const candidate = getCandidate(profile);
  const cv = existsSync(cvPath) ? readFileSync(cvPath, 'utf-8') : '';
  const template = existsSync(templatePath) ? readFileSync(templatePath, 'utf-8') : null;
  const language = getLanguage(profile);
  const labels = localizedLabels(language);
  const sourceText = safeSourceText(jdText, report);
  const coverage = computeKeywordCoverage(sourceText, cv);

  const summarySection = section(cv, ['Summary', 'Professional Summary', 'Perfil Profesional', 'Perfil']);
  const experienceSection = section(cv, ['Experience', 'Professional Experience', 'Experiencia Profesional']);
  const projectsSection = section(cv, ['Projects', 'Proyectos', 'Proyectos Propios MarTech', 'Proyectos Propios MarTech (Diseño, Desarrollo y Despliegue)']);
  const educationSection = section(cv, ['Education', 'Formación Académica', 'Formacion Academica']);
  const certificationsSection = section(cv, ['Certifications', 'Certificaciones']);
  const skillsSection = section(cv, ['Skills', 'Idiomas y Habilidades', 'Habilidades', 'Idiomas']);

  const name = text(candidate.full_name || profile.name || profile.full_name, title);
  const phone = text(candidate.phone || profile.phone);
  const email = text(candidate.email || profile.email);
  const linkedin = text(candidate.linkedin || candidate.linkedin_url || profile.linkedin || profile.linkedin_url);
  const portfolio = text(candidate.portfolio_url || candidate.website || profile.portfolio_url || profile.website);
  const location = text(candidate.location || profile.location);

  const replacements = {
    LANG: language,
    PAGE_WIDTH: format === 'letter' ? '8.5in' : '210mm',
    NAME: escapeHtml(name),
    PHONE: escapeHtml(phone),
    EMAIL: escapeHtml(email),
    LINKEDIN_URL: escapeHtml(normalizeUrl(linkedin)),
    LINKEDIN_DISPLAY: escapeHtml(displayUrl(linkedin)),
    PORTFOLIO_URL: escapeHtml(normalizeUrl(portfolio)),
    PORTFOLIO_DISPLAY: escapeHtml(displayUrl(portfolio)),
    LOCATION: escapeHtml(location),
    SECTION_SUMMARY: labels.summary,
    SUMMARY_TEXT: paragraphs(summarySection) || inlineMarkdown(profile.narrative?.exit_story || ''),
    SECTION_COMPETENCIES: labels.competencies,
    COMPETENCIES: competencyList(profile, skillsSection, coverage),
    SECTION_EXPERIENCE: labels.experience,
    EXPERIENCE: renderExperience(experienceSection) || renderFallbackBlocks(experienceSection),
    SECTION_PROJECTS: labels.projects,
    PROJECTS: renderProjects(projectsSection) || renderFallbackBlocks(projectsSection),
    SECTION_EDUCATION: labels.education,
    EDUCATION: renderEducation(educationSection) || renderFallbackBlocks(educationSection),
    SECTION_CERTIFICATIONS: labels.certifications,
    CERTIFICATIONS: renderFallbackBlocks(certificationsSection),
    SECTION_SKILLS: labels.skills,
    SKILLS: renderSkills(skillsSection) || renderFallbackBlocks(skillsSection),
  };

  if (!template) {
    return {
      keywords: coverage.keywords,
      coverage,
      html: `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(name)} - CV</title></head><body><h1>${escapeHtml(name)}</h1><pre>${escapeHtml(cv)}</pre></body></html>`,
    };
  }

  let html = template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => replacements[key] ?? '');
  html = removeEmptySection(html, 'PROJECTS', replacements.PROJECTS);
  html = removeEmptySection(html, 'EDUCATION', replacements.EDUCATION);
  html = removeEmptySection(html, 'CERTIFICATIONS', replacements.CERTIFICATIONS);
  html = removeEmptySection(html, 'SKILLS', replacements.SKILLS);

  return { html, keywords: coverage.keywords, coverage };
}
