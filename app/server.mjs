#!/usr/bin/env node

import { createServer } from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { classifyLiveness } from '../liveness-core.mjs';
import {
  buildModuleArtifactPath,
  runApplyAssistant,
  runDeepResearch,
  runInterviewPrep,
  runOutreach,
  writeUserArtifact,
} from './lib/assisted-workers.mjs';
import { renderCvTemplate } from './lib/cv-workspace.mjs';
import {
  buildDeepResearchPrompt as moduleDeepResearchPrompt,
  buildInterviewPrepDraft,
  compareOffers as moduleCompareOffers,
  createLinkedInOutreachMessage,
  draftApplicationResponses,
  evaluateProject as moduleEvaluateProject,
  evaluateTraining as moduleEvaluateTraining,
} from './lib/modules/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(__dirname, 'public');
const HOST = '127.0.0.1';
const PORT = Number(process.env.CAREER_OPS_APP_PORT || 4173);
const MAX_BODY = 10 * 1024 * 1024;
const JOB_LOG_LIMIT = Number(process.env.CAREER_OPS_JOB_LOG_LIMIT || 1200);
const JOB_TIMEOUT_MS = Number(process.env.CAREER_OPS_JOB_TIMEOUT_MS || 15 * 60 * 1000);

const jobs = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
};

const userFiles = {
  profile: path.join(ROOT, 'config', 'profile.yml'),
  cv: path.join(ROOT, 'cv.md'),
  profileMode: path.join(ROOT, 'modes', '_profile.md'),
  articleDigest: path.join(ROOT, 'article-digest.md'),
  pipeline: path.join(ROOT, 'data', 'pipeline.md'),
  applications: path.join(ROOT, 'data', 'applications.md'),
  portals: path.join(ROOT, 'portals.yml'),
  states: path.join(ROOT, 'templates', 'states.yml'),
  version: path.join(ROOT, 'VERSION'),
};

const REPORT_SECTION_LABELS = [
  ['roleSummary', /^##\s+A\).*role summary/im],
  ['match', /^##\s+B\).*match/im],
  ['strategy', /^##\s+C\).*level.*strategy/im],
  ['comp', /^##\s+D\).*comp/im],
  ['customization', /^##\s+E\).*customization/im],
  ['interview', /^##\s+F\).*interview/im],
  ['legitimacy', /^##\s+G\).*posting legitimacy/im],
];

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

function json(res, status, body) {
  send(res, status, body, { 'content-type': 'application/json; charset=utf-8' });
}

function readText(file, fallback = '') {
  return existsSync(file) ? readFileSync(file, 'utf-8') : fallback;
}

function scriptJson(args, options = {}) {
  return new Promise(resolve => {
    execFile(process.execPath, args, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: options.timeout || 120000,
      env: { ...process.env, FORCE_COLOR: '0', ...(options.env || {}) },
    }, (error, stdout = '', stderr = '') => {
      let data = null;
      try {
        const trimmed = stdout.trim();
        data = trimmed ? JSON.parse(trimmed) : null;
      } catch {}
      resolve({
        ok: !error,
        code: error?.code ?? 0,
        data,
        stdout,
        stderr,
        error: error?.message || null,
      });
    });
  });
}

function commandText(command, args = [], options = {}) {
  return new Promise(resolve => {
    execFile(command, args, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: options.timeout || 120000,
      env: { ...process.env, FORCE_COLOR: '0', ...(options.env || {}) },
    }, (error, stdout = '', stderr = '') => {
      resolve({ ok: !error, code: error?.code ?? 0, stdout, stderr, error: error?.message || null });
    });
  });
}

function isSafeHttpUrl(value) {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.localhost')) return false;
    if (host === '0.0.0.0' || host === '::' || host === '::1') return false;
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return false;
    const private172 = host.match(/^172\.(\d+)\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false;
    if (/^169\.254\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function requireSafeUrl(value) {
  const target = String(value || '').trim();
  if (!isSafeHttpUrl(target)) {
    throw Object.assign(new Error('URL no permitida. Usa una URL http(s) publica.'), { status: 400 });
  }
  return target;
}

function ensureUserDirs() {
  for (const dir of ['data', 'reports', 'output', 'jds', 'batch/tracker-additions']) {
    mkdirSync(path.join(ROOT, dir), { recursive: true });
  }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > MAX_BODY) {
        reject(Object.assign(new Error('El cuerpo de la petición es demasiado grande'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('JSON inválido'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function parseTableLine(line) {
  if (!line.trim().startsWith('|')) return null;
  const cells = line.trim().slice(1, -1).split('|').map(cell => cell.trim());
  if (cells.length < 8 || cells[0] === '#' || /^-+$/.test(cells[0])) return null;
  return cells;
}

function parseApplications() {
  const content = readText(userFiles.applications);
  const rows = [];
  for (const line of content.split(/\r?\n/)) {
    const cells = parseTableLine(line);
    if (!cells) continue;
    const number = Number.parseInt(cells[0], 10);
    if (!Number.isFinite(number)) continue;
    const reportMatch = (cells[7] || '').match(/\[([^\]]+)\]\(([^)]+)\)/);
    const scoreMatch = (cells[4] || '').match(/(\d+(?:\.\d+)?)\/5/);
    const reportPath = reportMatch?.[2] || '';
    const pdfPath = findPdfForReport(reportPath, number);
    const reportMeta = reportPath ? parseReportMeta(reportPath) : {};
    rows.push({
      number,
      date: cells[1] || '',
      company: cells[2] || '',
      role: cells[3] || '',
      scoreRaw: cells[4] || '',
      score: scoreMatch ? Number(scoreMatch[1]) : null,
      status: cells[5] || '',
      hasPdf: /✅|âœ…/.test(cells[6] || ''),
      report: cells[7] || '',
      reportPath,
      pdfPath,
      notes: cells[8] || '',
      jobUrl: reportMeta.url || '',
      legitimacy: reportMeta.legitimacy || '',
      tldr: reportMeta.tldr || '',
    });
  }
  return rows;
}

function getSourceHost(value = '') {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function reportIdFromPath(reportPath = '') {
  return path.basename(reportPath, '.md');
}

function findPdfForReport(reportPath, number) {
  if (!existsSync(path.join(ROOT, 'output'))) return '';
  const slug = reportPath ? path.basename(reportPath, '.md') : String(number).padStart(3, '0');
  const files = readdirSync(path.join(ROOT, 'output')).filter(f => f.toLowerCase().endsWith('.pdf'));
  const hit = files.find(f => f.includes(slug)) || files.find(f => f.includes(String(number).padStart(3, '0')));
  return hit ? `output/${hit}` : '';
}

function parseReportMeta(reportPath) {
  const safe = resolveAllowedPath(reportPath, ['reports']);
  if (!safe || !existsSync(safe)) return {};
  const text = readText(safe);
  const head = text.slice(0, 5000);
  const title = head.match(/^#\s+(.+)$/m)?.[1]?.trim() || reportIdFromPath(reportPath);
  const companyRole = title.match(/^Evaluation:\s*(.+?)\s+[—-]\s+(.+)$/i);
  const scoreRaw = head.match(/^\*\*Score:\*\*\s*(.+)$/m)?.[1]?.trim() || '';
  const score = scoreRaw.match(/(\d+(?:\.\d+)?)\/5/)?.[1];
  return {
    id: reportIdFromPath(reportPath),
    path: reportPath,
    title,
    company: companyRole?.[1]?.trim() || '',
    role: companyRole?.[2]?.trim() || '',
    date: head.match(/^\*\*Date:\*\*\s*(.+)$/m)?.[1]?.trim() || '',
    archetype: head.match(/^\*\*Archetype:\*\*\s*(.+)$/m)?.[1]?.trim() || '',
    scoreRaw,
    score: score ? Number(score) : null,
    url: head.match(/^\*\*URL:\*\*\s*(https?:\/\/\S+)/m)?.[1] || '',
    legitimacy: head.match(/^\*\*Legitimacy:\*\*\s*(.+)$/m)?.[1]?.trim() || '',
    pdf: head.match(/^\*\*PDF:\*\*\s*(.+)$/m)?.[1]?.trim() || '',
    tool: head.match(/^\*\*Tool:\*\*\s*(.+)$/m)?.[1]?.trim() || '',
    tldr: extractTldr(text),
  };
}

function extractTldr(text = '') {
  const bold = text.match(/\*\*TL;DR(?::|\*\*\s*\|)\s*(.+)$/im)?.[1]?.trim();
  if (bold) return bold.replace(/\s+\|.*$/, '').trim();
  const table = text.match(/\|\s*(?:\*\*)?TL;DR(?:\*\*)?\s*\|\s*(.+?)\s*\|/i)?.[1]?.trim();
  if (table) return table;
  const bullet = text.match(/^\s*[-*]\s+\*\*TL;DR:\*\*\s*(.+)$/im)?.[1]?.trim();
  return bullet || '';
}

function parseReportSections(markdown = '') {
  const hits = REPORT_SECTION_LABELS
    .map(([key, pattern]) => {
      const match = pattern.exec(markdown);
      return match ? { key, index: match.index } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);
  const sections = {};
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].index;
    const end = hits[i + 1]?.index ?? markdown.length;
    sections[hits[i].key] = markdown.slice(start, end).trim();
  }
  return sections;
}

function listReports() {
  const reportsDir = path.join(ROOT, 'reports');
  if (!existsSync(reportsDir)) return [];
  return readdirSync(reportsDir)
    .filter(file => file.toLowerCase().endsWith('.md'))
    .map(file => {
      const rel = `reports/${file}`;
      const stat = statSync(path.join(reportsDir, file));
      return { ...parseReportMeta(rel), path: rel, id: reportIdFromPath(rel), updatedAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => String(b.date || b.updatedAt).localeCompare(String(a.date || a.updatedAt)));
}

function readReportById(id) {
  const clean = slugify(id);
  const report = listReports().find(item => item.id === clean);
  if (!report) return null;
  const full = resolveAllowedPath(report.path, ['reports']);
  if (!full || !existsSync(full)) return null;
  const markdown = readText(full);
  return {
    ...report,
    markdown,
    sections: parseReportSections(markdown),
    pdfPath: findPdfForReport(report.path, Number(report.id.match(/^\d+/)?.[0] || 0)),
  };
}

function computeMetrics(apps) {
  const total = apps.length;
  const counts = Object.fromEntries(['Evaluated', 'Applied', 'Responded', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP'].map(s => [s, 0]));
  let top = 0;
  let scoreTotal = 0;
  let scored = 0;
  for (const app of apps) {
    const label = normalizeStatus(app.status).label;
    counts[label] = (counts[label] || 0) + 1;
    if (typeof app.score === 'number') {
      scoreTotal += app.score;
      scored++;
      if (app.score >= 4) top++;
    }
  }
  return {
    total,
    counts,
    top,
    averageScore: scored ? Number((scoreTotal / scored).toFixed(2)) : null,
    active: (counts.Applied || 0) + (counts.Responded || 0) + (counts.Interview || 0) + (counts.Offer || 0),
  };
}

function loadStates() {
  const parsed = yaml.load(readText(userFiles.states, 'states: []')) || {};
  const states = parsed.states || [];
  const byLabel = new Map();
  const byAlias = new Map();
  for (const state of states) {
    byLabel.set(String(state.label).toLowerCase(), state);
    byAlias.set(String(state.id).toLowerCase(), state);
    for (const alias of state.aliases || []) byAlias.set(String(alias).toLowerCase(), state);
  }
  return { states, byLabel, byAlias };
}

function normalizeStatus(raw) {
  const { states, byLabel, byAlias } = loadStates();
  const clean = String(raw || '').replace(/\*\*/g, '').trim().toLowerCase();
  const state = byLabel.get(clean) || byAlias.get(clean) || states.find(s => s.label === 'Evaluated');
  return state || { id: 'evaluated', label: 'Evaluated' };
}

function updateApplicationStatus(num, status) {
  const target = Number.parseInt(num, 10);
  const state = normalizeStatus(status);
  if (!state?.label) throw Object.assign(new Error('Estado desconocido'), { status: 400 });
  const content = readText(userFiles.applications);
  const lines = content.split(/\r?\n/);
  let updated = false;
  const next = lines.map(line => {
    const cells = parseTableLine(line);
    if (!cells) return line;
    const rowNum = Number.parseInt(cells[0], 10);
    if (rowNum !== target) return line;
    cells[5] = state.label;
    updated = true;
    return `| ${cells.join(' | ')} |`;
  });
  if (!updated) throw Object.assign(new Error(`Aplicación #${target} no encontrada`), { status: 404 });
  writeFileSync(userFiles.applications, next.join('\n'), 'utf-8');
  return state;
}

function parsePipeline() {
  const content = readText(userFiles.pipeline, '# Pipeline de Ofertas de Empleo\n\n## Pendientes\n');
  const entries = [];
  let index = 0;
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^-\s+\[([ xX])\]\s+(.+)$/);
    if (!match) continue;
    const raw = match[2].trim();
    const parts = raw.split('|').map(p => p.trim());
    entries.push({
      id: String(index++),
      done: match[1].toLowerCase() === 'x',
      url: parts[0] || '',
      company: parts[1] || '',
      role: parts.slice(2).join(' | ') || '',
      sourceHost: getSourceHost(parts[0] || ''),
      raw,
    });
  }
  return { content, entries: enrichPipelineEntries(entries) };
}

function normalizeKey(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function enrichPipelineEntries(entries) {
  const apps = parseApplications();
  const seenUrls = new Map();
  const appKeys = new Set(apps.map(app => `${normalizeKey(app.company)}|${normalizeKey(app.role)}`));
  const appUrls = new Set(apps.map(app => app.jobUrl).filter(Boolean));
  return entries.map(entry => {
    const urlKey = normalizeKey(entry.url);
    const pairKey = `${normalizeKey(entry.company)}|${normalizeKey(entry.role)}`;
    const duplicateCandidate = Boolean(urlKey && seenUrls.has(urlKey));
    if (urlKey && !seenUrls.has(urlKey)) seenUrls.set(urlKey, entry.id);
    return {
      ...entry,
      sourceHost: entry.sourceHost || getSourceHost(entry.url),
      duplicateCandidate,
      evaluatedCandidate: Boolean(appUrls.has(entry.url) || appKeys.has(pairKey)),
    };
  });
}

function writePipelineEntries(entries) {
  const lines = ['# Pipeline de Ofertas de Empleo', '', '## Pendientes', ''];
  for (const entry of entries) {
    const raw = [entry.url, entry.company, entry.role].filter(Boolean).join(' | ');
    lines.push(`- [${entry.done ? 'x' : ' '}] ${raw}`);
  }
  writeFileSync(userFiles.pipeline, `${lines.join('\n')}\n`, 'utf-8');
}

function resolveAllowedPath(inputPath, roots) {
  if (!inputPath || path.isAbsolute(inputPath)) return null;
  const normalized = inputPath.replace(/\\/g, '/');
  const first = normalized.split('/')[0];
  if (!roots.includes(first)) return null;
  const full = path.resolve(ROOT, normalized);
  const allowed = roots.some(root => {
    const base = path.resolve(ROOT, root);
    return full === base || full.startsWith(base + path.sep);
  });
  return allowed ? full : null;
}

function createJob(kind, command, args, options = {}) {
  const id = randomUUID();
  const job = {
    id,
    kind,
    status: 'running',
    startedAt: new Date().toISOString(),
    endedAt: null,
    exitCode: null,
    logs: [],
    listeners: new Set(),
    child: null,
    cancel() {
      if (job.status !== 'running') return false;
      job.status = 'cancelled';
      job.endedAt = new Date().toISOString();
      job.child?.kill('SIGTERM');
      push('error', 'Job cancelado por el usuario');
      finish('cancelled', null);
      return true;
    },
  };
  jobs.set(id, job);

  const child = spawn(command, args, {
    cwd: ROOT,
    shell: false,
    env: { ...process.env, FORCE_COLOR: '0' },
    ...options.spawn,
  });
  job.child = child;

  const push = (type, text) => {
    const lines = String(text).split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const event = { type, line, at: new Date().toISOString() };
      job.logs.push(event);
      if (job.logs.length > JOB_LOG_LIMIT) job.logs.splice(0, job.logs.length - JOB_LOG_LIMIT);
      for (const res of job.listeners) res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  const finish = (status, code) => {
    if (job.listeners.size === 0 && job.status === status && job.endedAt) return;
    job.status = status;
    job.exitCode = code;
    job.endedAt = job.endedAt || new Date().toISOString();
    const event = { type: status === 'completed' ? 'completed' : 'error', line: `${kind} ${status}`, code, at: job.endedAt };
    const compat = { type: 'done', line: `${kind} ${status}`, code, at: job.endedAt };
    job.logs.push(event, compat);
    for (const res of job.listeners) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      res.write(`data: ${JSON.stringify(compat)}\n\n`);
      res.end();
    }
    job.listeners.clear();
  };

  const timeout = setTimeout(() => {
    if (job.status === 'running') {
      push('warning', `Timeout tras ${Math.round(JOB_TIMEOUT_MS / 1000)}s`);
      job.status = 'failed';
      job.child?.kill('SIGTERM');
    }
  }, options.timeoutMs || JOB_TIMEOUT_MS);

  push('started', `${kind} iniciado`);
  child.stdout.on('data', data => push('progress', data));
  child.stderr.on('data', data => push('warning', data));
  child.on('error', err => {
    clearTimeout(timeout);
    job.status = 'failed';
    job.endedAt = new Date().toISOString();
    push('error', err.message);
    finish('failed', 1);
  });
  child.on('close', async code => {
    clearTimeout(timeout);
    if (job.status === 'cancelled') return;
    let finalCode = code;
    let finalStatus = code === 0 ? 'completed' : 'failed';
    if (code === 0 && options.onClose) {
      try {
        const result = await options.onClose(code, job, push);
        if (result?.code && result.code !== 0) {
          finalCode = result.code;
          finalStatus = 'failed';
        }
      } catch (err) {
        push('error', err.message);
        finalCode = 1;
        finalStatus = 'failed';
      }
    }
    job.endedAt = new Date().toISOString();
    finish(finalStatus, finalCode);
  });

  return job;
}

function createInlineJob(kind, work, options = {}) {
  const id = randomUUID();
  const job = {
    id,
    kind,
    status: 'running',
    startedAt: new Date().toISOString(),
    endedAt: null,
    exitCode: null,
    logs: [],
    listeners: new Set(),
    cancel() {
      if (job.status !== 'running') return false;
      job.status = 'cancelled';
      job.endedAt = new Date().toISOString();
      push('error', 'Job cancelado por el usuario');
      finish('cancelled', null);
      return true;
    },
  };
  jobs.set(id, job);
  let settled = false;

  const push = (type, line, extra = {}) => {
    if (job.status !== 'running' && type !== 'error' && type !== 'warning') return;
    const event = { type, line: String(line), at: new Date().toISOString(), ...extra };
    job.logs.push(event);
    if (job.logs.length > JOB_LOG_LIMIT) job.logs.splice(0, job.logs.length - JOB_LOG_LIMIT);
    for (const res of job.listeners) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const finish = (status, code = status === 'completed' ? 0 : 1) => {
    if (settled) return;
    settled = true;
    job.status = status;
    job.exitCode = code;
    job.endedAt = new Date().toISOString();
    const event = { type: status === 'completed' ? 'completed' : 'error', line: `${kind} ${status}`, code, at: job.endedAt };
    const compat = { type: 'done', line: `${kind} ${status}`, code, at: job.endedAt };
    job.logs.push(event, compat);
    for (const res of job.listeners) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      res.write(`data: ${JSON.stringify(compat)}\n\n`);
      res.end();
    }
    job.listeners.clear();
  };

  push('started', `${kind} iniciado`);
  const timeout = setTimeout(() => {
    if (job.status === 'running') {
      push('warning', `Timeout tras ${Math.round((options.timeoutMs || JOB_TIMEOUT_MS) / 1000)}s`);
      finish('failed', 1);
    }
  }, options.timeoutMs || JOB_TIMEOUT_MS);
  Promise.resolve()
    .then(() => work({ job, push }))
    .then(() => {
      clearTimeout(timeout);
      finish(job.status === 'cancelled' ? 'cancelled' : 'completed', 0);
    })
    .catch(err => {
      clearTimeout(timeout);
      push('error', err.message || err);
      finish('failed', 1);
    });
  return job;
}

async function extractJobText(url) {
  const target = requireSafeUrl(url);
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const title = await page.title().catch(() => '');
    const text = await page.locator('body').innerText({ timeout: 15000 });
    return `Source URL: ${url}\nPage title: ${title}\n\n${text}`.trim();
  } finally {
    await browser.close();
  }
}

async function checkLiveness(url) {
  const target = requireSafeUrl(url);
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    const bodyText = await page.locator('body').innerText({ timeout: 15000 }).catch(() => '');
    const applyControls = await page.locator('a,button,input[type="submit"]').evaluateAll(nodes =>
      nodes.map(node => node.innerText || node.value || node.getAttribute('aria-label') || '').filter(Boolean)
    ).catch(() => []);
    const classified = classifyLiveness({
      status: response?.status?.() || 0,
      finalUrl: page.url(),
      bodyText,
      applyControls,
    });
    return {
      ok: true,
      url: target,
      finalUrl: page.url(),
      status: response?.status?.() || 0,
      active: classified.result === 'active',
      result: classified.result,
      code: classified.code,
      reason: classified.reason,
    };
  } catch (err) {
    return { ok: false, url: target, result: 'unconfirmed', code: 'playwright_error', reason: err.message };
  } finally {
    await browser.close().catch(() => {});
  }
}

function buildLearningProposal(body) {
  const company = String(body.company || 'esta empresa').trim();
  const role = String(body.role || 'este rol').trim();
  const signal = String(body.signal || body.decision || 'decision del usuario').trim();
  const reason = String(body.reason || body.notes || '').trim();
  const score = String(body.score || '').trim();
  const recommendation = [
    `- Decision observada: ${signal} en ${company} / ${role}${score ? ` (score ${score})` : ''}.`,
    reason ? `- Motivo del usuario: ${reason}` : '- Motivo del usuario: pendiente de concretar.',
    '- Ajuste sugerido: reforzar esta preferencia en futuras evaluaciones y filtros de pipeline.',
  ].join('\n');
  return {
    destination: 'profileMode',
    title: `Learning: ${company} - ${role}`,
    content: `\n\n## Learning - ${new Date().toISOString().slice(0, 10)} - ${company} - ${role}\n\n${recommendation}\n`,
  };
}

function applyLearning(body) {
  const destination = String(body.destination || '').trim();
  const content = String(body.content || '').trim();
  if (!content) throw Object.assign(new Error('Hace falta contenido de aprendizaje.'), { status: 400 });
  if (!['profileMode', 'articleDigest', 'profile'].includes(destination)) {
    throw Object.assign(new Error('Destino de aprendizaje no permitido.'), { status: 400 });
  }

  if (destination === 'profileMode') {
    writeFileSync(userFiles.profileMode, `${readText(userFiles.profileMode).replace(/\s*$/, '')}\n\n${content}\n`, 'utf-8');
    return { ok: true, destination: 'modes/_profile.md' };
  }
  if (destination === 'articleDigest') {
    writeFileSync(userFiles.articleDigest, `${readText(userFiles.articleDigest).replace(/\s*$/, '')}\n\n${content}\n`, 'utf-8');
    return { ok: true, destination: 'article-digest.md' };
  }

  const parsed = yaml.load(readText(userFiles.profile, '{}')) || {};
  parsed.learning_notes = Array.isArray(parsed.learning_notes) ? parsed.learning_notes : [];
  parsed.learning_notes.push({
    date: new Date().toISOString().slice(0, 10),
    note: content,
  });
  writeFileSync(userFiles.profile, yaml.dump(parsed, { lineWidth: 120 }), 'utf-8');
  return { ok: true, destination: 'config/profile.yml' };
}

function slugify(value) {
  return String(value || 'job')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'job';
}

function latestReportAfter(previousIds = new Set()) {
  return listReports().find(report => !previousIds.has(report.id)) || listReports()[0] || null;
}

function healthChecks() {
  return {
    cv: existsSync(userFiles.cv),
    profile: existsSync(userFiles.profile),
    profileMode: existsSync(userFiles.profileMode),
    portals: existsSync(userFiles.portals),
    applications: existsSync(userFiles.applications),
    dataDir: existsSync(path.join(ROOT, 'data')),
    reportsDir: existsSync(path.join(ROOT, 'reports')),
    outputDir: existsSync(path.join(ROOT, 'output')),
    nodeModules: existsSync(path.join(ROOT, 'node_modules')),
  };
}

function ensureSetupTemplates() {
  const changedFiles = [];
  if (!existsSync(userFiles.profileMode) && existsSync(path.join(ROOT, 'modes', '_profile.template.md'))) {
    copyFileSync(path.join(ROOT, 'modes', '_profile.template.md'), userFiles.profileMode);
    changedFiles.push('modes/_profile.md');
  }
  if (!existsSync(userFiles.profile) && existsSync(path.join(ROOT, 'config', 'profile.example.yml'))) {
    copyFileSync(path.join(ROOT, 'config', 'profile.example.yml'), userFiles.profile);
    changedFiles.push('config/profile.yml');
  }
  if (!existsSync(userFiles.portals) && existsSync(path.join(ROOT, 'templates', 'portals.example.yml'))) {
    copyFileSync(path.join(ROOT, 'templates', 'portals.example.yml'), userFiles.portals);
    changedFiles.push('portals.yml');
  }
  if (!existsSync(userFiles.applications)) {
    mkdirSync(path.dirname(userFiles.applications), { recursive: true });
    writeFileSync(userFiles.applications, [
      '# Applications Tracker',
      '',
      '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
      '|---|------|---------|------|-------|--------|-----|--------|-------|',
      '',
    ].join('\n'), 'utf-8');
    changedFiles.push('data/applications.md');
  }
  ensureUserDirs();
  return changedFiles;
}

function dataContractSummary() {
  return {
    userLayer: ['cv.md', 'config/profile.yml', 'modes/_profile.md', 'article-digest.md', 'portals.yml', 'data/*', 'reports/*', 'output/*', 'interview-prep/*', 'jds/*'],
    systemLayer: ['modes/_shared.md', 'modes/oferta.md', 'modes/pdf.md', 'AGENTS.md', 'CLAUDE.md', '*.mjs', 'dashboard/*', 'templates/*'],
  };
}

function providerReadiness() {
  return {
    opencode: Boolean(process.env.OPENCODE_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.OPENCODE_MODEL || 'deepseek-v4-pro',
    warnings: [
      process.env.OPENCODE_API_KEY ? '' : 'OPENCODE_API_KEY no configurada: las evaluaciones API pueden fallar o requerir --mock.',
    ].filter(Boolean),
  };
}

function getLanguageConfig() {
  const parsed = yaml.load(readText(userFiles.profile, '{}')) || {};
  const modesDir = parsed.language?.modes_dir || 'modes';
  const available = ['modes', 'modes/de', 'modes/es', 'modes/fr', 'modes/ja', 'modes/pt', 'modes/ru', 'modes/tr', 'modes/ua']
    .filter(dir => existsSync(path.join(ROOT, dir)));
  return { modesDir, available };
}

function updateLanguageConfig(modesDir) {
  const available = getLanguageConfig().available;
  if (!available.includes(modesDir)) throw Object.assign(new Error('Directorio de modos no disponible'), { status: 400 });
  const parsed = yaml.load(readText(userFiles.profile, '{}')) || {};
  parsed.language = { ...(parsed.language || {}), modes_dir: modesDir };
  writeFileSync(userFiles.profile, yaml.dump(parsed, { lineWidth: 120 }), 'utf-8');
  return { modesDir };
}

function buildCvHtml({ title = 'Career-Ops CV Draft', jdText = '', report = null } = {}) {
  return renderCvTemplate(ROOT, { title, jdText, report });
}

function buildApplyAssistant(body) {
  const questions = String(body.questions || '').split(/\r?\n/).map(q => q.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
  const report = body.reportId ? readReportById(body.reportId) : null;
  const company = body.company || report?.company || 'Company';
  const role = body.role || report?.role || 'Role';
  const base = report?.tldr || 'Use the strongest verified proof points from cv.md and the evaluation report.';
  return {
    ok: true,
    markdown: [`## Responses for ${company} - ${role}`, '', `Based on: ${report?.id || 'manual context'}`, ''].concat(
      (questions.length ? questions : ['Why are you interested in this role?', 'Why do you want to work here?', 'Tell us about a relevant achievement.'])
        .map((q, idx) => `### ${idx + 1}. ${q}\n> ${base} I would answer this with a specific example tied to ${role}, keeping it concise and evidence-led.`)
    ).join('\n\n'),
  };
}

function buildDeepResearchPrompt(body) {
  const company = body.company || 'Company';
  const role = body.role || 'Role';
  return { ok: true, markdown: `## Deep Research: ${company} - ${role}

Context: I am evaluating a candidacy for ${role} at ${company}. Produce sourced, actionable interview intelligence.

### 1. AI Strategy
### 2. Recent moves (last 6 months)
### 3. Engineering culture
### 4. Likely challenges
### 5. Competitors and differentiation
### 6. Candidate angle

Use cv.md, config/profile.yml, modes/_profile.md, and article-digest.md as candidate context. Cite every factual claim.` };
}

function buildInterviewPrep(body) {
  const company = body.company || 'Company';
  const role = body.role || 'Role';
  return { ok: true, markdown: `# Interview Intel: ${company} - ${role}

**URL:** ${body.url || 'N/A'}
**Legitimacy:** ${body.legitimacy || 'unknown'}
**Report:** ${body.reportId || 'N/A'}
**Researched:** ${new Date().toISOString().slice(0, 10)}

## Audience Map
- Recruiter screen: motivation, compensation, location, timing.
- Hiring manager: scope fit, first 90 days, ownership.
- Peer technical: implementation depth, tradeoffs, collaboration.

## Story Gaps
Review interview-prep/story-bank.md and add STAR+R stories for any missing role requirements.` };
}

function buildOutreach(body) {
  const company = body.company || 'Company';
  const role = body.role || 'Role';
  const type = body.type || 'hiring-manager';
  return { ok: true, message: `Hi - I am evaluating ${role} at ${company}. Your team seems focused on exactly the kind of applied AI/automation work I have been building. Open to a quick exchange on what matters most for this role?`.slice(0, 300), type };
}

function compareOffers(body) {
  const ids = Array.isArray(body.reportIds) ? body.reportIds : [];
  const reports = ids.map(id => readReportById(id)).filter(Boolean);
  const rows = reports.map(report => ({
    id: report.id,
    company: report.company,
    role: report.role,
    score: report.score || 0,
    recommendation: (report.score || 0) >= 4 ? 'prioritize' : 'deprioritize',
  })).sort((a, b) => b.score - a.score);
  return { ok: true, rows };
}

function evaluateTraining(body) {
  const title = body.title || 'Training';
  const northStar = Number(body.northStar || 3);
  const portfolio = Number(body.portfolio || 3);
  const effort = Number(body.effort || 3);
  const score = Number(((northStar * 0.45 + portfolio * 0.35 + (6 - effort) * 0.20)).toFixed(1));
  return { ok: true, title, score, verdict: score >= 4 ? 'HACER' : score >= 3 ? 'HACER CON TIMEBOX' : 'NO HACER' };
}

function evaluateProject(body) {
  const title = body.title || 'Project';
  const signal = Number(body.signal || 3);
  const demo = Number(body.demo || 3);
  const uniqueness = Number(body.uniqueness || 3);
  const score = Number(((signal * 0.45 + demo * 0.35 + uniqueness * 0.20)).toFixed(1));
  return { ok: true, title, score, verdict: score >= 4 ? 'BUILD' : score >= 3 ? 'PIVOT' : 'SKIP' };
}

function moduleContext(body = {}) {
  const report = body.reportId ? readReportById(String(body.reportId)) : null;
  const profile = yaml.load(readText(userFiles.profile, '{}')) || {};
  return {
    report,
    company: body.company || report?.company || 'Company',
    role: body.role || report?.role || 'Role',
    reportSummary: body.reportSummary || report?.tldr || '',
    jobSignal: body.jobSignal || report?.sections?.match || report?.tldr || '',
    candidateContext: [
      readText(userFiles.cv),
      readText(userFiles.profileMode),
      readText(userFiles.articleDigest),
    ].filter(Boolean).join('\n\n').slice(0, 24000),
    compensation: body.compensation || profile.compensation?.target || profile.salary?.target || '',
    workAuthorization: body.workAuthorization || profile.work_authorization || '',
  };
}

function artifactMarkdownFor(kind, result) {
  if (result?.markdown) return result.markdown;
  if (result?.result?.message) return [
    `# Outreach Draft`,
    '',
    `**Safety:** ${result.result.safety || 'Draft only. Do not send automatically.'}`,
    '',
    result.result.message,
  ].join('\n');
  return JSON.stringify(result, null, 2);
}

function createAssistedModuleJob(kind, body) {
  const job = createInlineJob(`module:${kind}`, async ({ push }) => {
    const context = moduleContext(body);
    push('progress', `Preparando ${kind} asistido`);
    let result;
    if (kind === 'apply-assistant') result = await runApplyAssistant(body, context);
    else if (kind === 'deep-research') result = await runDeepResearch(body, context);
    else if (kind === 'interview-prep') result = await runInterviewPrep(body, context);
    else if (kind === 'outreach') result = await runOutreach(body, context);
    else throw new Error(`Modulo asistido no soportado: ${kind}`);

    const artifactPath = buildModuleArtifactPath(kind, { ...body, company: context.company, role: context.role });
    const changed = writeUserArtifact(ROOT, artifactPath, artifactMarkdownFor(kind, result));
    push('artifact', JSON.stringify({ kind, path: changed, result }));
    push('completed', `${kind} asistido listo`, { changedFiles: [changed] });
  }, { timeoutMs: JOB_TIMEOUT_MS });
  return job;
}

async function runAssistedModuleDryRun(kind, body) {
  const context = moduleContext(body);
  if (kind === 'apply-assistant') return runApplyAssistant(body, context);
  if (kind === 'deep-research') return runDeepResearch(body, context);
  if (kind === 'interview-prep') return runInterviewPrep(body, context);
  if (kind === 'outreach') return runOutreach(body, context);
  throw new Error(`Modulo asistido no soportado: ${kind}`);
}

function stepStates(names) {
  return Object.fromEntries(names.map(name => [name, 'pending']));
}

function setStep(push, steps, step, status, extra = {}) {
  steps[step] = status;
  push('artifact', JSON.stringify({ step, status, steps, ...extra }));
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/health') {
    const checks = healthChecks();
    return json(res, 200, {
      version: readText(userFiles.version, 'unknown').trim(),
      checks,
      ok: Object.values(checks).every(Boolean),
      root: ROOT,
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/setup/readiness') {
    const checks = healthChecks();
    return json(res, 200, {
      ok: Object.values(checks).every(Boolean),
      checks,
      missing: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key),
      dataContract: dataContractSummary(),
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/setup/repair') {
    return json(res, 200, { ok: true, changedFiles: ensureSetupTemplates(), checks: healthChecks() });
  }

  if (req.method === 'GET' && url.pathname === '/api/setup/doctor') {
    const result = await commandText(process.execPath, ['doctor.mjs']);
    return json(res, result.ok ? 200 : 500, { ok: result.ok, result });
  }

  if (req.method === 'GET' && url.pathname === '/api/setup/data-contract') {
    return json(res, 200, { ok: true, ...dataContractSummary() });
  }

  if (req.method === 'GET' && url.pathname === '/api/integrity/verify') {
    const result = await commandText(process.execPath, ['verify-pipeline.mjs']);
    return json(res, result.ok ? 200 : 500, { ok: result.ok, result });
  }

  const integrityMatch = url.pathname.match(/^\/api\/integrity\/(normalize|dedup|merge|sync-check)$/);
  if (integrityMatch && (req.method === 'GET' || req.method === 'POST')) {
    const apply = req.method === 'POST';
    const scripts = {
      normalize: 'normalize-statuses.mjs',
      dedup: 'dedup-tracker.mjs',
      merge: 'merge-tracker.mjs',
      'sync-check': 'cv-sync-check.mjs',
    };
    const args = [scripts[integrityMatch[1]]];
    if (!apply && integrityMatch[1] !== 'sync-check') args.push('--dry-run');
    const result = await commandText(process.execPath, args);
    return json(res, result.ok ? 200 : 500, { ok: result.ok, mode: apply ? 'apply' : 'preview', result });
  }

  if (req.method === 'GET' && url.pathname === '/api/profile/portals') {
    return json(res, 200, { content: readText(userFiles.portals), parsed: yaml.load(readText(userFiles.portals, '{}')) || {} });
  }

  if (req.method === 'PUT' && url.pathname === '/api/profile/portals') {
    const body = await parseJsonBody(req);
    yaml.load(String(body.content || ''));
    writeFileSync(userFiles.portals, String(body.content || ''), 'utf-8');
    return json(res, 200, { ok: true, changedFiles: ['portals.yml'] });
  }

  if (req.method === 'GET' && url.pathname === '/api/profile/language') {
    return json(res, 200, { ok: true, ...getLanguageConfig() });
  }

  if (req.method === 'PUT' && url.pathname === '/api/profile/language') {
    const body = await parseJsonBody(req);
    return json(res, 200, { ok: true, ...updateLanguageConfig(String(body.modesDir || 'modes')) });
  }

  if (req.method === 'GET' && url.pathname === '/api/profile/provider-readiness') {
    return json(res, 200, { ok: true, ...providerReadiness() });
  }

  if (req.method === 'GET' && url.pathname === '/api/update/check') {
    const result = await scriptJson(['update-system.mjs', 'check']);
    return json(res, result.ok || result.data ? 200 : 500, { ok: Boolean(result.data), result: result.data, raw: result });
  }

  if (req.method === 'GET' && url.pathname === '/api/update/preview') {
    const fetchResult = await commandText('git', ['fetch', 'https://github.com/santifer/career-ops.git', 'main']);
    if (!fetchResult.ok) return json(res, 500, { ok: false, result: fetchResult });
    const diff = await commandText('git', ['diff', 'HEAD..FETCH_HEAD', '--stat', '--', 'modes/', 'CLAUDE.md', 'AGENTS.md', '*.mjs', 'batch/', 'dashboard/', 'templates/', 'docs/', 'VERSION', 'DATA_CONTRACT.md']);
    return json(res, diff.ok ? 200 : 500, { ok: diff.ok, result: diff });
  }

  const updateAction = url.pathname.match(/^\/api\/update\/(apply|dismiss|rollback)$/);
  if (req.method === 'POST' && updateAction) {
    const result = await commandText(process.execPath, ['update-system.mjs', updateAction[1]]);
    return json(res, result.ok ? 200 : 500, { ok: result.ok, result });
  }

  if (req.method === 'GET' && url.pathname === '/api/applications') {
    const applications = parseApplications();
    return json(res, 200, {
      applications,
      metrics: computeMetrics(applications),
      states: loadStates().states.map(s => ({ id: s.id, label: s.label, description: s.description })),
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/reports') {
    return json(res, 200, { reports: listReports() });
  }

  const reportMatch = url.pathname.match(/^\/api\/reports\/([^/]+)$/);
  if (req.method === 'GET' && reportMatch) {
    const report = readReportById(decodeURIComponent(reportMatch[1]));
    if (!report) return json(res, 404, { error: 'Informe no encontrado' });
    return json(res, 200, { report });
  }

  const statusMatch = url.pathname.match(/^\/api\/applications\/(\d+)\/status$/);
  if (req.method === 'PATCH' && statusMatch) {
    const body = await parseJsonBody(req);
    const state = updateApplicationStatus(statusMatch[1], body.status);
    return json(res, 200, { ok: true, state });
  }

  if (url.pathname === '/api/pipeline') {
    if (req.method === 'GET') return json(res, 200, { entries: parsePipeline().entries });
    if (req.method === 'POST') {
      const body = await parseJsonBody(req);
    if (!body.url && !body.raw) return json(res, 400, { error: 'Hace falta una URL o texto raw.' });
      const { entries } = parsePipeline();
      entries.push({
        done: false,
        url: String(body.url || body.raw).trim(),
        company: String(body.company || '').trim(),
        role: String(body.role || '').trim(),
      });
      writePipelineEntries(entries);
      return json(res, 201, { entries: parsePipeline().entries });
    }
  }

  const pipelineMatch = url.pathname.match(/^\/api\/pipeline\/(\d+)$/);
  if (pipelineMatch && (req.method === 'PATCH' || req.method === 'DELETE')) {
    const idx = Number(pipelineMatch[1]);
    const { entries } = parsePipeline();
    if (!entries[idx]) return json(res, 404, { error: 'Entrada del pipeline no encontrada' });
    if (req.method === 'DELETE') entries.splice(idx, 1);
    if (req.method === 'PATCH') {
      const body = await parseJsonBody(req);
      entries[idx] = { ...entries[idx], ...body };
    }
    writePipelineEntries(entries);
    return json(res, 200, { entries: parsePipeline().entries });
  }

  if (url.pathname === '/api/profile') {
    if (req.method === 'GET') return json(res, 200, { content: readText(userFiles.profile), parsed: yaml.load(readText(userFiles.profile, '{}')) || {} });
    if (req.method === 'PUT') {
      const body = await parseJsonBody(req);
      yaml.load(String(body.content || ''));
      writeFileSync(userFiles.profile, String(body.content || ''), 'utf-8');
      return json(res, 200, { ok: true });
    }
  }

  if (url.pathname === '/api/cv') {
    if (req.method === 'GET') return json(res, 200, { content: readText(userFiles.cv) });
    if (req.method === 'PUT') {
      const body = await parseJsonBody(req);
      writeFileSync(userFiles.cv, String(body.content || ''), 'utf-8');
      return json(res, 200, { ok: true });
    }
  }

  if (url.pathname === '/api/personalization') {
    if (req.method === 'GET') return json(res, 200, {
      profileMode: readText(userFiles.profileMode),
      articleDigest: readText(userFiles.articleDigest),
    });
    if (req.method === 'PUT') {
      const body = await parseJsonBody(req);
      if (body.profileMode !== undefined) writeFileSync(userFiles.profileMode, String(body.profileMode), 'utf-8');
      if (body.articleDigest !== undefined) writeFileSync(userFiles.articleDigest, String(body.articleDigest), 'utf-8');
      return json(res, 200, { ok: true });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/jobs/scan') {
    const body = await parseJsonBody(req);
    const args = ['scan.mjs'];
    if (body.dryRun) args.push('--dry-run');
    if (body.verify) args.push('--verify');
    if (body.company) args.push('--company', String(body.company));
    const job = createJob('scan', process.execPath, args);
    return json(res, 202, { jobId: job.id });
  }

  if (req.method === 'GET' && url.pathname === '/api/scanner/history') {
    const historyPath = path.join(ROOT, 'data', 'scan-history.tsv');
    const lines = readText(historyPath).split(/\r?\n/).filter(Boolean).slice(-200);
    const entries = lines.map((line, index) => {
      const cells = line.split('\t');
      return { index, raw: line, cells, url: cells.find(cell => /^https?:\/\//i.test(cell)) || '' };
    });
    return json(res, 200, { ok: true, entries });
  }

  if (req.method === 'POST' && url.pathname === '/api/jobs/batch') {
    const body = await parseJsonBody(req);
    const rows = String(body.tsv || body.urls || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 100);
    const parsed = rows.map((line, index) => {
      const cells = line.includes('\t') ? line.split('\t') : line.split(/\s+/);
      const urlCell = cells.find(cell => /^https?:\/\//i.test(cell)) || cells[0] || '';
      return { index, raw: line, cells, url: urlCell, status: 'pending', attempts: 0, logs: [] };
    });
    if (body.dryRun) return json(res, 200, { ok: true, dryRun: true, rows: parsed, warning: 'Dry-run only: no offers will be applied to.' });
    const job = createInlineJob('batch-control-room', async ({ push }) => {
      const results = [];
      for (const row of parsed) {
        row.status = 'running';
        row.attempts += 1;
        push('progress', `Fila ${row.index + 1}: ${row.url || 'sin URL'}`);
        try {
          const target = requireSafeUrl(row.url);
          const live = body.verify ? await checkLiveness(target) : { result: 'not-verified' };
          row.status = live.active === false ? 'partial' : 'completed';
          row.logs.push(body.verify ? live.reason : 'Queued without verification');
          results.push({ ...row, live });
          push('artifact', JSON.stringify({ row: row.index, status: row.status, live }));
        } catch (err) {
          row.status = 'failed';
          row.logs.push(err.message);
          results.push({ ...row, error: err.message });
          push('warning', `Fila ${row.index + 1} fallida: ${err.message}`);
        }
      }
      push('artifact', JSON.stringify({ summary: { total: results.length, completed: results.filter(item => item.status === 'completed').length, failed: results.filter(item => item.status === 'failed').length }, results, safety: 'Batch evaluates/validates only. It never applies to offers automatically.' }));
    }, { timeoutMs: JOB_TIMEOUT_MS });
    return json(res, 202, { ok: true, jobId: job.id, rows: parsed.length });
  }

  if (req.method === 'POST' && url.pathname === '/api/jobs/liveness') {
    const body = await parseJsonBody(req);
    const target = requireSafeUrl(body.url);
    return json(res, 200, await checkLiveness(target));
  }

  if (req.method === 'POST' && url.pathname === '/api/jobs/liveness-bulk') {
    const body = await parseJsonBody(req);
    const urls = Array.isArray(body.urls) ? body.urls : [];
    const job = createInlineJob('liveness-bulk', async ({ push }) => {
      const results = [];
      for (const value of urls.slice(0, 100)) {
        const target = requireSafeUrl(value);
        push('progress', `Verificando ${target}`);
        results.push(await checkLiveness(target));
      }
      push('artifact', JSON.stringify({ results }));
    });
    return json(res, 202, { ok: true, jobId: job.id });
  }

  if (req.method === 'POST' && url.pathname === '/api/jobs/evaluate') {
    const body = await parseJsonBody(req);
    let jdText = String(body.jdText || '').trim();
    const sourceUrl = String(body.url || '').trim();
    if (!jdText && !sourceUrl) return json(res, 400, { error: 'Pega un JD o indica una URL.' });
    if (!jdText && sourceUrl) jdText = await extractJobText(sourceUrl);
    mkdirSync(path.join(ROOT, 'jds'), { recursive: true });
    const name = `${new Date().toISOString().slice(0, 10)}-${slugify(body.title || sourceUrl)}-${Date.now()}.txt`;
    const jdPath = path.join(ROOT, 'jds', name);
    writeFileSync(jdPath, jdText, 'utf-8');
    const rel = `jds/${name}`;
    const args = ['opencode-eval.mjs', '--file', rel];
    if (sourceUrl) args.push('--url', sourceUrl);
    if (body.preset) args.push('--preset', String(body.preset));
    if (body.mock) args.push('--mock');
    const job = createJob('evaluate', process.execPath, args, {
      async onClose(code, jobRecord, push) {
        if (code === 0) {
          push('progress', 'Fusionando tracker-additions...');
          const merge = await commandText(process.execPath, ['merge-tracker.mjs']);
          if (merge.stdout) push('progress', merge.stdout);
          if (merge.stderr) push('warning', merge.stderr);
          return { code: merge.ok ? 0 : 1 };
        }
        return { code };
      },
    });
    return json(res, 202, { ok: true, jobId: job.id, jdPath: rel });
  }

  if (req.method === 'POST' && url.pathname === '/api/jobs/cv-pdf') {
    const body = await parseJsonBody(req);
    const report = body.reportId ? readReportById(String(body.reportId)) : null;
    const cvDraft = buildCvHtml({ title: body.title, jdText: body.jdText, report });
    mkdirSync(path.join(ROOT, 'output'), { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    const base = `cv-${slugify(body.company || report?.company || body.title || 'draft')}-${today}`;
    const htmlRel = `output/${base}.html`;
    const pdfRel = `output/${base}.pdf`;
    writeFileSync(path.join(ROOT, htmlRel), cvDraft.html, 'utf-8');
    const format = ['a4', 'letter'].includes(String(body.format)) ? String(body.format) : 'a4';
    const job = createJob('cv-pdf', process.execPath, ['generate-pdf.mjs', htmlRel, pdfRel, `--format=${format}`], {
      async onClose(code, jobRecord, push) {
        if (code === 0 && existsSync(path.join(ROOT, pdfRel))) {
          push('artifact', JSON.stringify({ htmlPath: htmlRel, outputPath: pdfRel, coverage: cvDraft.coverage }));
          return { code: 0 };
        }
        push('error', `No se verifico el PDF esperado: ${pdfRel}`);
        return { code: 1 };
      },
    });
    return json(res, 202, { ok: true, jobId: job.id, htmlPath: htmlRel, outputPath: pdfRel, keywords: cvDraft.keywords, coverage: cvDraft.coverage });
  }

  if (req.method === 'POST' && url.pathname === '/api/jobs/auto-pipeline') {
    const body = await parseJsonBody(req);
    const job = createInlineJob('auto-pipeline', async ({ push }) => {
      const steps = stepStates(['url-guard', 'liveness', 'jd-extraction', 'evaluation', 'tracker-merge', 'report-pdf', 'cv-pdf', 'apply-draft']);
      const before = new Set(listReports().map(report => report.id));
      let jdText = String(body.jdText || '').trim();
      const sourceUrl = String(body.url || '').trim();
      let extractionTrust = jdText ? 'trusted-manual' : 'untrusted';
      if (sourceUrl) {
        setStep(push, steps, 'url-guard', 'running');
        const target = requireSafeUrl(sourceUrl);
        setStep(push, steps, 'url-guard', 'completed', { url: target });
        setStep(push, steps, 'liveness', 'running');
        const live = await checkLiveness(target);
        setStep(push, steps, 'liveness', live.active ? 'completed' : 'partial', { live });
        if (!jdText) {
          setStep(push, steps, 'jd-extraction', 'running');
          jdText = await extractJobText(target);
          extractionTrust = jdText.length > 1200 ? 'trusted-playwright' : 'untrusted';
          setStep(push, steps, 'jd-extraction', extractionTrust === 'trusted-playwright' ? 'completed' : 'partial', {
            chars: jdText.length,
            trust: extractionTrust,
          });
        }
      } else {
        setStep(push, steps, 'url-guard', 'completed', { url: null });
        setStep(push, steps, 'liveness', 'partial', { reason: 'No URL supplied' });
        setStep(push, steps, 'jd-extraction', jdText ? 'completed' : 'failed', { trust: extractionTrust });
      }
      if (!jdText) throw new Error('Pega un JD o indica una URL.');
      mkdirSync(path.join(ROOT, 'jds'), { recursive: true });
      const name = `${new Date().toISOString().slice(0, 10)}-${slugify(body.title || sourceUrl || 'job')}-${Date.now()}.txt`;
      const rel = `jds/${name}`;
      writeFileSync(path.join(ROOT, rel), jdText, 'utf-8');
      push('artifact', JSON.stringify({ step: 'jd', path: rel, trust: body.mock ? 'untrusted-mock' : extractionTrust }));

      const evalArgs = ['opencode-eval.mjs', '--file', rel];
      if (sourceUrl) evalArgs.push('--url', sourceUrl);
      if (body.preset) evalArgs.push('--preset', String(body.preset));
      if (body.mock) evalArgs.push('--mock');
      setStep(push, steps, 'evaluation', 'running', { trust: body.mock ? 'untrusted-mock' : extractionTrust });
      const evaluation = await commandText(process.execPath, evalArgs, { timeout: JOB_TIMEOUT_MS });
      if (evaluation.stdout) push('progress', evaluation.stdout);
      if (evaluation.stderr) push('warning', evaluation.stderr);
      if (!evaluation.ok) {
        setStep(push, steps, 'evaluation', 'failed');
        throw new Error(evaluation.error || 'Evaluation failed');
      }
      setStep(push, steps, 'evaluation', body.mock ? 'partial' : 'completed', { trust: body.mock ? 'untrusted-mock' : extractionTrust });

      setStep(push, steps, 'tracker-merge', 'running');
      const merge = await commandText(process.execPath, ['merge-tracker.mjs']);
      if (merge.stdout) push('progress', merge.stdout);
      if (!merge.ok) throw new Error(merge.error || 'Tracker merge failed');
      setStep(push, steps, 'tracker-merge', 'completed');

      const report = latestReportAfter(before);
      if (report?.path) {
        const reportPdfRel = `output/${path.basename(report.path, '.md')}.pdf`;
        setStep(push, steps, 'report-pdf', 'running');
        const reportPdf = await commandText(process.execPath, ['generate-report-pdf.mjs', report.path, reportPdfRel], { timeout: JOB_TIMEOUT_MS });
        if (reportPdf.stdout) push('progress', reportPdf.stdout);
        if (reportPdf.stderr) push('warning', reportPdf.stderr);
        if (reportPdf.ok && existsSync(path.join(ROOT, reportPdfRel))) {
          setStep(push, steps, 'report-pdf', 'completed', { reportPdf: reportPdfRel });
        } else {
          setStep(push, steps, 'report-pdf', 'failed', { reportPdf: reportPdfRel });
          push('warning', `Report PDF no verificado: ${reportPdfRel}`);
        }

        setStep(push, steps, 'cv-pdf', 'running');
        const cvDraft = buildCvHtml({ title: report.title, jdText, report: readReportById(report.id) });
        const base = `cv-${slugify(report.company)}-${new Date().toISOString().slice(0, 10)}`;
        const htmlRel = `output/${base}.html`;
        const pdfRel = `output/${base}.pdf`;
        writeFileSync(path.join(ROOT, htmlRel), cvDraft.html, 'utf-8');
        const cvPdf = await commandText(process.execPath, ['generate-pdf.mjs', htmlRel, pdfRel, '--format=a4'], { timeout: JOB_TIMEOUT_MS });
        if (cvPdf.stdout) push('progress', cvPdf.stdout);
        if (cvPdf.stderr) push('warning', cvPdf.stderr);
        if (cvPdf.ok && existsSync(path.join(ROOT, pdfRel))) {
          setStep(push, steps, 'cv-pdf', 'completed', { htmlPath: htmlRel, cvPdf: pdfRel, coverage: cvDraft.coverage });
        } else {
          setStep(push, steps, 'cv-pdf', 'failed', { htmlPath: htmlRel, cvPdf: pdfRel, coverage: cvDraft.coverage });
          push('warning', `CV PDF no verificado: ${pdfRel}`);
        }

        if ((report.score || 0) >= 4.5) {
          setStep(push, steps, 'apply-draft', 'running');
          const applyDraft = await runApplyAssistant({
            company: report.company,
            role: report.role,
            questions: ['Why are you interested in this role?', 'Tell us about a relevant achievement.'],
          }, moduleContext({ reportId: report.id }));
          const applyPath = writeUserArtifact(ROOT, buildModuleArtifactPath('apply-assistant', report), applyDraft.markdown);
          setStep(push, steps, 'apply-draft', 'completed', { path: applyPath });
          push('artifact', JSON.stringify({ step: 'draft-answers', path: applyPath, draft: applyDraft.markdown }));
        } else {
          setStep(push, steps, 'apply-draft', 'partial', { reason: 'Score below 4.5' });
        }
        push('artifact', JSON.stringify({ step: 'completed', report: report.path, reportPdf: reportPdfRel, cvPdf: pdfRel, steps }));
      } else {
        push('warning', 'No se detecto informe nuevo tras la evaluacion.');
        setStep(push, steps, 'report-pdf', 'failed');
        setStep(push, steps, 'cv-pdf', 'failed');
      }
    }, { timeoutMs: JOB_TIMEOUT_MS });
    return json(res, 202, { ok: true, jobId: job.id });
  }

  if (req.method === 'POST' && url.pathname === '/api/jobs/report-pdf') {
    const body = await parseJsonBody(req);
    const input = resolveAllowedPath(String(body.reportPath || ''), ['reports']);
    if (!input || !existsSync(input)) return json(res, 400, { error: 'Hace falta una ruta válida dentro de reports/*.' });
    mkdirSync(path.join(ROOT, 'output'), { recursive: true });
    const outRel = `output/${path.basename(input, '.md')}.pdf`;
    const job = createJob('report-pdf', process.execPath, ['generate-report-pdf.mjs', path.relative(ROOT, input), outRel]);
    return json(res, 202, { jobId: job.id, outputPath: outRel });
  }

  if (req.method === 'GET' && url.pathname === '/api/jobs') {
    return json(res, 200, { jobs: [...jobs.values()].map(({ listeners, child, cancel, ...job }) => job) });
  }

  const cancelMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/cancel$/);
  if (req.method === 'POST' && cancelMatch) {
    const job = jobs.get(cancelMatch[1]);
    if (!job) return json(res, 404, { error: 'Job no encontrado' });
    return json(res, 200, { ok: job.cancel?.() ?? false, jobId: job.id, status: job.status });
  }

  const eventsMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/events$/);
  if (req.method === 'GET' && eventsMatch) {
    const job = jobs.get(eventsMatch[1]);
    if (!job) return json(res, 404, { error: 'Job no encontrado' });
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    });
    for (const event of job.logs) res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (job.status === 'running') {
      job.listeners.add(res);
      req.on('close', () => job.listeners.delete(res));
    } else {
      res.write(`data: ${JSON.stringify({ type: 'done', line: job.status, code: job.exitCode, at: job.endedAt })}\n\n`);
      res.end();
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/patterns') {
    const result = await runScriptJson(['analyze-patterns.mjs']);
    return json(res, result.data ? 200 : 500, result);
  }

  if (req.method === 'GET' && url.pathname === '/api/followups') {
    const result = await runScriptJson(['followup-cadence.mjs']);
    return json(res, result.data ? 200 : 500, result);
  }

  if (req.method === 'POST' && url.pathname === '/api/learning/proposal') {
    const body = await parseJsonBody(req);
    return json(res, 200, { ok: true, proposal: buildLearningProposal(body) });
  }

  if (req.method === 'POST' && url.pathname === '/api/learning/apply') {
    const body = await parseJsonBody(req);
    return json(res, 200, applyLearning(body));
  }

  if (req.method === 'POST' && url.pathname === '/api/modules/apply-assistant') {
    const body = await parseJsonBody(req);
    if (body.mode === 'assisted') {
      if (body.dryRun) return json(res, 200, { ok: true, result: await runAssistedModuleDryRun('apply-assistant', body), dryRun: true });
      const job = createAssistedModuleJob('apply-assistant', body);
      return json(res, 202, { ok: true, jobId: job.id });
    }
    const report = body.reportId ? readReportById(String(body.reportId)) : null;
    return json(res, 200, { ok: true, result: draftApplicationResponses({
      ...body,
      company: body.company || report?.company,
      role: body.role || report?.role,
      reportSummary: body.reportSummary || report?.tldr,
      basedOn: report?.id,
      candidateSummary: 'the candidate profile and CV stored in Career-Ops',
    }) });
  }

  if (req.method === 'POST' && url.pathname === '/api/modules/deep-research') {
    const body = await parseJsonBody(req);
    if (body.mode === 'assisted') {
      if (body.dryRun) return json(res, 200, { ok: true, result: await runAssistedModuleDryRun('deep-research', body), dryRun: true });
      const job = createAssistedModuleJob('deep-research', body);
      return json(res, 202, { ok: true, jobId: job.id });
    }
    return json(res, 200, { ok: true, markdown: moduleDeepResearchPrompt({ ...body, candidateContext: readText(userFiles.cv) }) });
  }

  if (req.method === 'POST' && url.pathname === '/api/modules/interview-prep') {
    const body = await parseJsonBody(req);
    if (body.mode === 'assisted') {
      if (body.dryRun) return json(res, 200, { ok: true, result: await runAssistedModuleDryRun('interview-prep', body), dryRun: true });
      const job = createAssistedModuleJob('interview-prep', body);
      return json(res, 202, { ok: true, jobId: job.id });
    }
    return json(res, 200, { ok: true, markdown: buildInterviewPrepDraft(body) });
  }

  if (req.method === 'POST' && url.pathname === '/api/modules/outreach') {
    const body = await parseJsonBody(req);
    if (body.mode === 'assisted') {
      if (body.dryRun) return json(res, 200, { ok: true, result: await runAssistedModuleDryRun('outreach', body), dryRun: true });
      const job = createAssistedModuleJob('outreach', body);
      return json(res, 202, { ok: true, jobId: job.id });
    }
    return json(res, 200, { ok: true, result: createLinkedInOutreachMessage(body) });
  }

  if (req.method === 'POST' && url.pathname === '/api/modules/offer-comparison') {
    const body = await parseJsonBody(req);
    const reportOffers = (Array.isArray(body.reportIds) ? body.reportIds : []).map(id => readReportById(id)).filter(Boolean).map(report => ({
      id: report.id,
      company: report.company,
      role: report.role,
      scores: { northStar: report.score || 3, cvMatch: report.score || 3, level: 3, compensation: 3, growth: 3, remote: 3, reputation: 3, techStack: 3, speed: 3, culture: 3 },
      notes: report.tldr,
    }));
    return json(res, 200, { ok: true, result: moduleCompareOffers({ offers: [...reportOffers, ...(body.offers || [])] }) });
  }

  if (req.method === 'POST' && url.pathname === '/api/modules/training') {
    const body = await parseJsonBody(req);
    return json(res, 200, { ok: true, result: moduleEvaluateTraining(body) });
  }

  if (req.method === 'POST' && url.pathname === '/api/modules/project') {
    const body = await parseJsonBody(req);
    return json(res, 200, { ok: true, result: moduleEvaluateProject(body) });
  }

  if (req.method === 'GET' && url.pathname === '/api/files') {
    const rel = url.searchParams.get('path') || '';
    const full = resolveAllowedPath(rel, ['reports', 'output', 'jds']);
    if (!full || !existsSync(full) || !statSync(full).isFile()) return send(res, 404, 'No encontrado');
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
    return res.end(readFileSync(full));
  }

  return json(res, 404, { error: 'Ruta API no encontrada' });
}

function runScriptJson(args) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd: ROOT, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => stdout += d);
    child.stderr.on('data', d => stderr += d);
    child.on('close', code => {
      try {
        resolve({ ok: code === 0, data: JSON.parse(stdout), stderr });
      } catch {
        resolve({ ok: false, data: null, stdout, stderr, error: 'El script no devolvió JSON' });
      }
    });
  });
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const full = path.resolve(PUBLIC_DIR, `.${pathname}`);
  if (!full.startsWith(PUBLIC_DIR + path.sep) || !existsSync(full) || !statSync(full).isFile()) {
    return send(res, 404, 'No encontrado');
  }
  const ext = path.extname(full).toLowerCase();
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(await readFile(full));
}

export function createAppServer(options = {}) {
  const host = options.host || HOST;
  const port = Number(options.port || PORT);
  ensureUserDirs();
  return createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', `http://${host}:${port}`);
      if (requestUrl.pathname.startsWith('/api/')) return await handleApi(req, res, requestUrl);
      return await serveStatic(req, res, requestUrl);
    } catch (err) {
      json(res, err.status || 500, { error: err.message || 'Error interno del servidor' });
    }
  });
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const server = createAppServer({ host: HOST, port: PORT });
  server.listen(PORT, HOST, () => {
    console.log(`Career-Ops web app disponible en http://${HOST}:${PORT}`);
  });
}
