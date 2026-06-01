#!/usr/bin/env node

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { classifyLiveness } from '../liveness-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(__dirname, 'public');
const HOST = '127.0.0.1';
const PORT = Number(process.env.CAREER_OPS_APP_PORT || 4173);
const MAX_BODY = 10 * 1024 * 1024;

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
  const head = readText(safe).slice(0, 4000);
  return {
    url: head.match(/^\*\*URL:\*\*\s*(https?:\/\/\S+)/m)?.[1] || '',
    legitimacy: head.match(/^\*\*Legitimacy:\*\*\s*(.+)$/m)?.[1]?.trim() || '',
    tldr: head.match(/\*\*TL;DR(?::|\*\*\s*\|)\s*(.+)$/im)?.[1]?.trim() || '',
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
      raw,
    });
  }
  return { content, entries };
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
  };
  jobs.set(id, job);

  const child = spawn(command, args, {
    cwd: ROOT,
    shell: false,
    env: { ...process.env, FORCE_COLOR: '0' },
    ...options.spawn,
  });

  const push = (type, text) => {
    const lines = String(text).split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const event = { type, line, at: new Date().toISOString() };
      job.logs.push(event);
      for (const res of job.listeners) res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  child.stdout.on('data', data => push('stdout', data));
  child.stderr.on('data', data => push('stderr', data));
  child.on('error', err => {
    job.status = 'failed';
    job.endedAt = new Date().toISOString();
    push('error', err.message);
  });
  child.on('close', code => {
    job.status = code === 0 ? 'completed' : 'failed';
    job.exitCode = code;
    job.endedAt = new Date().toISOString();
    const event = { type: 'done', line: `${kind} ${job.status}`, code, at: job.endedAt };
    job.logs.push(event);
    for (const res of job.listeners) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      res.end();
    }
    job.listeners.clear();
    options.onClose?.(code, job);
  });

  return job;
}

async function extractJobText(url) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const title = await page.title().catch(() => '');
    const text = await page.locator('body').innerText({ timeout: 15000 });
    return `Source URL: ${url}\nPage title: ${title}\n\n${text}`.trim();
  } finally {
    await browser.close();
  }
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

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/health') {
    const checks = {
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
    return json(res, 200, {
      version: readText(userFiles.version, 'unknown').trim(),
      checks,
      ok: Object.values(checks).every(Boolean),
      root: ROOT,
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/applications') {
    const applications = parseApplications();
    return json(res, 200, {
      applications,
      metrics: computeMetrics(applications),
      states: loadStates().states.map(s => ({ id: s.id, label: s.label, description: s.description })),
    });
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
    const job = createJob('evaluate', process.execPath, args, {
      onClose(code, jobRecord) {
        if (code === 0) {
          const merge = spawn(process.execPath, ['merge-tracker.mjs'], { cwd: ROOT, shell: false });
          merge.stdout.on('data', d => jobRecord.logs.push({ type: 'stdout', line: String(d), at: new Date().toISOString() }));
          merge.stderr.on('data', d => jobRecord.logs.push({ type: 'stderr', line: String(d), at: new Date().toISOString() }));
        }
      },
    });
    return json(res, 202, { jobId: job.id, jdPath: rel });
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
    return json(res, 200, { jobs: [...jobs.values()].map(({ listeners, ...job }) => job) });
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

ensureUserDirs();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return await serveStatic(req, res, url);
  } catch (err) {
    json(res, err.status || 500, { error: err.message || 'Error interno del servidor' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Career-Ops web app disponible en http://${HOST}:${PORT}`);
});
