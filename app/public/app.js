import { api } from './modules/api.js';
import { state, statusLabels, viewTitles } from './modules/state.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function notify(message, type = 'ok') {
  const box = $('#mutation-feedback');
  if (!box) return;
  box.textContent = message;
  box.dataset.type = type;
  box.classList.add('visible');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => box.classList.remove('visible'), 3200);
}

function fatal(message) {
  const box = $('#fatal-error');
  if (!box) return;
  box.textContent = message;
  box.classList.remove('hidden');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function mdToHtml(markdown = '') {
  const escaped = escapeHtml(markdown);
  return renderMarkdownTables(escaped)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/^\s*[-*]\s+(.+)$/gm, '<p class="bullet">• $1</p>')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

function renderMarkdownTables(text = '') {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (isTableRow(lines[i]) && isSeparatorRow(lines[i + 1] || '')) {
      const headers = splitTableRow(lines[i]);
      i += 2;
      const rows = [];
      while (isTableRow(lines[i] || '')) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      i--;
      out.push(`<table class="md-table"><thead><tr>${headers.map(cell => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${headers.map((_, idx) => `<td>${row[idx] || ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    } else {
      out.push(lines[i]);
    }
  }
  return out.join('\n');
}

function isTableRow(line = '') {
  return /^\s*\|.+\|\s*$/.test(line);
}

function isSeparatorRow(line = '') {
  return /^\s*\|?[\s: -]+\|[\s|: -]*$/.test(line) && line.includes('-');
}

function splitTableRow(line = '') {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

function compactMdToHtml(markdown = '') {
  const escaped = escapeHtml(markdown).replace(/\r\n/g, '\n');
  const withTables = renderMarkdownTables(escaped);
  const lines = withTables.split('\n');
  const blocks = [];
  let list = [];
  const flushList = () => {
    if (!list.length) return;
    blocks.push(`<ul>${list.map(item => `<li>${item}</li>`).join('')}</ul>`);
    list = [];
  };
  for (const line of lines) {
    const item = line.match(/^\s*[-*]\s+(.+)$/);
    if (item) {
      list.push(item[1].trim());
      continue;
    }
    flushList();
    blocks.push(line);
  }
  flushList();
  return blocks.join('\n')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => /^(<h[1-3]|<ul|<table)/.test(block) ? block : `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function scoreClass(score) {
  if (typeof score !== 'number') return '';
  if (score >= 4) return 'top';
  if (score < 4) return 'low';
  return '';
}

function setView(name) {
  state.view = name;
  $$('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === name));
  $$('.view').forEach(view => view.classList.toggle('active', view.id === `view-${name}`));
  $('#view-title').textContent = viewTitles[name] || name;
  if (name === 'home') state.selected = { kind: 'home', id: null };
  if (name === 'inbox' && !state.selected.id) selectPipeline(state.pipeline.find(item => !item.done)?.id);
  if (name === 'tracker' && state.selected.kind !== 'app') selectApplication(state.applications[0]?.number);
  renderDetail();
}

async function loadAll() {
  const [health, apps, pipeline, reports, jobs] = await Promise.all([
    api('/api/health'),
    api('/api/applications'),
    api('/api/pipeline'),
    api('/api/reports'),
    api('/api/jobs'),
  ]);
  state.health = health;
  state.applications = apps.applications;
  state.metrics = apps.metrics;
  state.states = apps.states;
  state.pipeline = pipeline.entries;
  state.reports = reports.reports;
  state.jobs = jobs.jobs;
  renderAll();
}

function renderAll() {
  renderHealth();
  renderHome();
  renderPipeline();
  renderApplications();
  renderReports();
  renderJobsHint();
  renderDetail();
}

function renderHealth() {
  const labels = {
    cv: 'CV',
    profile: 'Perfil',
    profileMode: 'Personalizacion',
    portals: 'Portales',
    applications: 'Tracker',
    dataDir: 'Datos',
    reportsDir: 'Informes',
    outputDir: 'PDFs',
    nodeModules: 'Dependencias',
  };
  const dot = $('#health-dot');
  dot.classList.toggle('ok', state.health?.ok);
  dot.classList.toggle('bad', !state.health?.ok);
  $('#health-label').textContent = state.health?.ok ? `Listo · v${state.health.version}` : 'Setup incompleto';
  $('#health-list').innerHTML = Object.entries(state.health?.checks || {}).map(([key, ok]) => `
    <div class="check-item">
      <strong>${ok ? '✓' : '×'} ${escapeHtml(labels[key] || key)}</strong>
      <span>${ok ? 'Correcto' : 'Falta'}</span>
    </div>
  `).join('');
}

function renderHome() {
  const m = state.metrics || {};
  const pending = state.pipeline.filter(item => !item.done).length;
  const activeJobs = state.jobs.filter(job => job.status === 'running').length;
  $('#metrics').innerHTML = [
    ['Aplicaciones', m.total ?? 0],
    ['Activas', m.active ?? 0],
    ['Top >=4', m.top ?? 0],
    ['Pipeline', pending],
    ['Jobs vivos', activeJobs],
  ].map(([label, value]) => `<button class="metric" data-home-metric="${escapeHtml(label)}"><strong>${value}</strong><span>${label}</span></button>`).join('');

  const top = state.applications.filter(app => app.score >= 4 && app.status === 'Evaluated').slice(0, 5);
  const low = state.applications.filter(app => typeof app.score === 'number' && app.score < 4 && app.status === 'Evaluated').slice(0, 3);
  const pendingItems = state.pipeline.filter(item => !item.done).slice(0, 5);
  const items = [
    ...top.map(app => priorityApp(app, 'Lista para decidir')),
    ...pendingItems.map(item => priorityPipeline(item)),
    ...low.map(app => priorityApp(app, 'Score bajo: recomienda descartar')),
  ];
  $('#priority-list').innerHTML = items.join('') || '<div class="empty">No hay acciones urgentes. Buen momento para escanear portales o revisar patrones.</div>';
  renderFollowupSummary();
}

function priorityApp(app, label) {
  return `
    <button class="decision-item" data-select-app="${app.number}" data-jump="tracker">
      <span class="score-pill ${scoreClass(app.score)}">${escapeHtml(app.scoreRaw || 'n/a')}</span>
      <strong>${escapeHtml(app.company)}</strong>
      <span>${escapeHtml(app.role)}</span>
      <em>${escapeHtml(label)}</em>
    </button>
  `;
}

function priorityPipeline(item) {
  return `
    <button class="decision-item" data-select-pipeline="${item.id}" data-jump="inbox">
      <span class="score-pill">URL</span>
      <strong>${escapeHtml(item.company || item.sourceHost || 'Pipeline')}</strong>
      <span>${escapeHtml(item.role || item.url)}</span>
      <em>Pendiente de evaluacion</em>
    </button>
  `;
}

function renderFollowupSummary() {
  const data = state.followups?.data || state.followups;
  if (!data) {
    $('#followup-summary').innerHTML = '<button class="ghost-btn" data-load-insights>Calcular seguimientos</button>';
    return;
  }
  const text = JSON.stringify(data, null, 2).slice(0, 900);
  $('#followup-summary').innerHTML = `<pre>${escapeHtml(text)}</pre>`;
}

function renderPipeline() {
  const query = ($('#pipeline-search')?.value || '').toLowerCase();
  const filter = $('#pipeline-filter')?.value || 'pending';
  const rows = state.pipeline.filter(item => {
    const hay = `${item.url} ${item.company} ${item.role} ${item.sourceHost}`.toLowerCase();
    if (query && !hay.includes(query)) return false;
    if (filter === 'pending' && item.done) return false;
    if (filter === 'duplicates' && !item.duplicateCandidate) return false;
    if (filter === 'evaluated' && !item.evaluatedCandidate) return false;
    return true;
  });
  $('#pipeline-list').innerHTML = rows.map(item => `
    <button class="inbox-item ${state.selected.kind === 'pipeline' && state.selected.id === item.id ? 'selected' : ''}" data-select-pipeline="${item.id}">
      <span class="status-dot ${item.done ? 'done' : ''}"></span>
      <span>
        <strong>${escapeHtml(item.company || item.sourceHost || 'Sin empresa')}</strong>
        <small>${escapeHtml(item.role || item.url)}</small>
      </span>
      <span class="chip-row">
        ${item.duplicateCandidate ? '<em class="chip warn">duplicada</em>' : ''}
        ${item.evaluatedCandidate ? '<em class="chip blue">evaluada</em>' : ''}
        ${item.sourceHost ? `<em class="chip">${escapeHtml(item.sourceHost)}</em>` : ''}
      </span>
    </button>
  `).join('') || '<div class="empty">No hay entradas para este filtro.</div>';
}

function renderApplications() {
  const statusFilter = $('#status-filter');
  if (!statusFilter.dataset.ready) {
    statusFilter.innerHTML = '<option value="all">Todos los estados</option>' + state.states.map(s => `<option value="${escapeHtml(s.label)}">${escapeHtml(statusLabels[s.label] || s.label)}</option>`).join('');
    statusFilter.dataset.ready = '1';
  }
  const query = ($('#application-search')?.value || '').toLowerCase();
  const status = statusFilter.value;
  const score = $('#score-filter').value;
  const rows = state.applications.filter(app => {
    const hay = `${app.company} ${app.role} ${app.notes} ${app.tldr}`.toLowerCase();
    if (query && !hay.includes(query)) return false;
    if (status !== 'all' && app.status !== status) return false;
    if (score === 'top' && !(app.score >= 4)) return false;
    if (score === 'low' && !(app.score < 4)) return false;
    return true;
  });
  $('#applications-table').innerHTML = `
    <div class="table-head">
      <span>#</span><span>Empresa / rol</span><span>Score</span><span>Estado</span><span>Decision</span>
    </div>
    ${rows.map(app => `
      <button class="table-row ${state.selected.kind === 'app' && String(state.selected.id) === String(app.number) ? 'selected' : ''}" data-select-app="${app.number}">
        <span data-label="#">${app.number}</span>
        <span data-label="Empresa / rol"><strong>${escapeHtml(app.company)}</strong><small>${escapeHtml(app.role)}</small></span>
        <span data-label="Score"><em class="score-pill ${scoreClass(app.score)}">${escapeHtml(app.scoreRaw || 'n/a')}</em></span>
        <span data-label="Estado"><em class="chip">${escapeHtml(statusLabels[app.status] || app.status)}</em></span>
        <span data-label="Decision">${app.score < 4 ? '<em class="chip bad">descartar</em>' : '<em class="chip good">revisar</em>'}</span>
      </button>
    `).join('')}
  `;
}

function renderReports() {
  const selected = state.loadedReport?.id || state.reports[0]?.id || '';
  $('#report-picker').innerHTML = state.reports.map(report => `
    <option value="${escapeHtml(report.id)}" ${report.id === selected ? 'selected' : ''}>
      ${escapeHtml(report.id)} · ${escapeHtml(report.company || report.title)}
    </option>
  `).join('');
}

function appendLog(selector, message, reset = false) {
  const log = $(selector);
  if (!log) return;
  log.textContent = reset ? message : `${log.textContent}${message}`;
  log.scrollTop = log.scrollHeight;
}

function renderJobsHint() {
  const running = state.jobs.filter(job => job.status === 'running');
  $('#evaluate-status').textContent = running.length ? `${running.length} job(s) activos` : '';
}

function selectPipeline(id) {
  if (id === undefined || id === null) return;
  state.selected = { kind: 'pipeline', id: String(id) };
  renderPipeline();
  renderDetail();
}

function selectApplication(number) {
  if (number === undefined || number === null) return;
  state.selected = { kind: 'app', id: Number(number) };
  renderApplications();
  hydrateEvaluateFromSelection();
  hydrateAssistantsFromSelection();
  renderDetail();
}

async function selectReport(id) {
  if (!id) return;
  const { report } = await api(`/api/reports/${encodeURIComponent(id)}`);
  state.loadedReport = report;
  state.selected = { kind: 'report', id: report.id };
  renderReportViewer(report);
  hydrateEvaluateFromSelection();
  hydrateAssistantsFromSelection();
  renderReports();
  renderDetail();
}

function selectedContext() {
  if (state.selected.kind === 'report' && state.loadedReport) {
    return {
      kind: 'report',
      company: state.loadedReport.company || '',
      role: state.loadedReport.role || '',
      url: state.loadedReport.url || '',
      reportId: state.loadedReport.id || '',
      reportPath: state.loadedReport.path || '',
      notes: state.loadedReport.tldr || '',
    };
  }
  if (state.selected.kind === 'app') {
    const app = state.applications.find(row => row.number === state.selected.id);
    if (!app) return {};
    const reportId = app.reportPath ? app.reportPath.split('/').pop().replace(/\.md$/, '') : '';
    return {
      kind: 'app',
      company: app.company || '',
      role: app.role || '',
      url: app.jobUrl || '',
      reportId,
      reportPath: app.reportPath || '',
      notes: app.notes || app.tldr || '',
    };
  }
  if (state.selected.kind === 'pipeline') {
    const item = state.pipeline.find(row => String(row.id) === String(state.selected.id));
    if (!item) return {};
    return {
      kind: 'pipeline',
      company: item.company || '',
      role: item.role || '',
      url: item.url || '',
      reportId: '',
      reportPath: '',
      notes: '',
    };
  }
  return {};
}

function contextKey(ctx = selectedContext()) {
  return [ctx.kind, ctx.reportId, ctx.company, ctx.role, ctx.url].filter(Boolean).join('|');
}

function hydrateEvaluateFromSelection() {
  const ctx = selectedContext();
  if (!ctx.company && !ctx.role && !ctx.url) return;
  const key = contextKey(ctx);
  const changed = $('#evaluate-form')?.dataset.contextKey !== key;
  const urlInput = $('#evaluate-url');
  const titleInput = $('#evaluate-title');
  const jdInput = $('#evaluate-jd');
  if (urlInput) urlInput.value = ctx.url || '';
  if (titleInput) titleInput.value = [ctx.company, ctx.role].filter(Boolean).join(' - ');
  if (jdInput && ctx.notes && (changed || !jdInput.value.trim())) {
    jdInput.value = `Contexto del informe seleccionado:\n${ctx.notes}`;
  }
  if ($('#evaluate-form')) $('#evaluate-form').dataset.contextKey = key;
}

function hydrateAssistantsFromSelection(kind = null) {
  const form = $('#module-form');
  if (!form) return;
  const ctx = selectedContext();
  if (!ctx.company && !ctx.role && !ctx.url && !ctx.reportId) return;
  const key = contextKey(ctx);
  const changed = form.dataset.contextKey !== key;
  if (kind) form.elements.kind.value = kind;
  if (form.elements.company) form.elements.company.value = ctx.company || '';
  if (form.elements.role) form.elements.role.value = ctx.role || '';
  if (form.elements.url) form.elements.url.value = ctx.url || '';
  if (form.elements.notes && (changed || !form.elements.notes.value.trim())) {
    form.elements.notes.value = [
      ctx.reportId,
      ctx.notes ? `Contexto: ${ctx.notes}` : '',
    ].filter(Boolean).join('\n');
  }
  form.dataset.contextKey = key;
}

function renderReportViewer(report) {
  const sections = report.sections || {};
  const blocks = [
    ['Resumen', sections.roleSummary || report.tldr],
    ['Match', sections.match],
    ['Estrategia', sections.strategy],
    ['Compensacion', sections.comp],
    ['CV / LinkedIn', sections.customization],
    ['Entrevista', sections.interview],
    ['Legitimidad', sections.legitimacy],
  ].filter(([, content]) => content);
  $('#report-viewer').innerHTML = `
    <header class="report-hero">
      <div>
        <p class="eyebrow">${escapeHtml(report.company || 'Informe')}</p>
        <h2>${escapeHtml(report.role || report.title)}</h2>
        <p>${escapeHtml(report.tldr || 'Sin TL;DR extraido.')}</p>
      </div>
      <span class="score-tower ${scoreClass(report.score)}">${escapeHtml(report.scoreRaw || 'n/a')}</span>
    </header>
    <div class="report-blocks">
      ${blocks.map(([title, content]) => `
        <section class="report-block">
          <h3>${escapeHtml(title)}</h3>
          <div class="report-markdown">${compactMdToHtml(content).slice(0, 10000)}</div>
        </section>
      `).join('')}
    </div>
  `;
}

function renderDetail() {
  const box = $('#detail-panel');
  if (state.selected.kind === 'pipeline') return renderPipelineDetail(box);
  if (state.selected.kind === 'app') return renderApplicationDetail(box);
  if (state.selected.kind === 'report') return renderReportDetail(box);
  box.innerHTML = `
    <p class="eyebrow">Command Center</p>
    <h2>Decision primero</h2>
    <p class="muted">Selecciona una oferta, una aplicacion o un informe para ver acciones contextuales.</p>
    <div class="detail-stat"><strong>${state.pipeline.filter(i => !i.done).length}</strong><span>pendientes en inbox</span></div>
    <div class="detail-stat"><strong>${state.applications.filter(a => a.score >= 4 && a.status === 'Evaluated').length}</strong><span>top pendientes de decidir</span></div>
  `;
}

function renderPipelineDetail(box) {
  const item = state.pipeline.find(row => row.id === state.selected.id);
  if (!item) {
    state.selected = { kind: 'home', id: null };
    return renderDetail();
  }
  const live = state.liveness[item.id];
  box.innerHTML = `
    <p class="eyebrow">Inbox</p>
    <h2>${escapeHtml(item.company || item.sourceHost || 'Oferta')}</h2>
    <p>${escapeHtml(item.role || item.url)}</p>
    <dl class="detail-list">
      <dt>URL</dt><dd><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.sourceHost || item.url)}</a></dd>
      <dt>Estado</dt><dd>${item.done ? 'Marcada como hecha' : 'Pendiente'}</dd>
      <dt>Senales</dt><dd>${[
        item.duplicateCandidate ? 'posible duplicada' : '',
        item.evaluatedCandidate ? 'ya evaluada' : '',
        live ? `liveness: ${live.result}` : '',
      ].filter(Boolean).join(' · ') || 'sin alertas'}</dd>
    </dl>
    <div class="detail-actions">
      <button class="primary-btn" data-evaluate-pipeline="${item.id}">Evaluar</button>
      <button class="ghost-btn" data-liveness-pipeline="${item.id}">Verificar activa</button>
      <button class="ghost-btn" data-toggle-pipeline="${item.id}">${item.done ? 'Reabrir' : 'Marcar hecha'}</button>
      <button class="danger-btn" data-delete-pipeline="${item.id}">Eliminar</button>
    </div>
  `;
}

function renderApplicationDetail(box) {
  const app = state.applications.find(row => row.number === state.selected.id);
  if (!app) {
    state.selected = { kind: 'home', id: null };
    return renderDetail();
  }
  box.innerHTML = `
    <p class="eyebrow">Tracker #${app.number}</p>
    <h2>${escapeHtml(app.company)}</h2>
    <p>${escapeHtml(app.role)}</p>
    <div class="score-panel ${scoreClass(app.score)}">
      <strong>${escapeHtml(app.scoreRaw || 'n/a')}</strong>
      <span>${app.score < 4 ? 'Recomendacion: no aplicar salvo razon fuerte.' : 'Lista para decision humana.'}</span>
    </div>
    <dl class="detail-list">
      <dt>Estado</dt><dd>${escapeHtml(statusLabels[app.status] || app.status)}</dd>
      <dt>Legitimidad</dt><dd>${escapeHtml(app.legitimacy || 'No extraida')}</dd>
      <dt>Notas</dt><dd>${escapeHtml(app.notes || 'Sin notas')}</dd>
    </dl>
    <label class="field-label">Cambiar estado</label>
    <select data-status-detail="${app.number}">
      ${state.states.map(s => `<option value="${escapeHtml(s.label)}" ${s.label === app.status ? 'selected' : ''}>${escapeHtml(statusLabels[s.label] || s.label)}</option>`).join('')}
    </select>
    <div class="detail-actions">
      ${app.reportPath ? `<button class="primary-btn" data-open-report-path="${escapeHtml(app.reportPath)}">Ver informe</button>` : ''}
      <button class="ghost-btn" data-open-assistant="apply-assistant">Apply assistant</button>
      <button class="ghost-btn" data-open-assistant="interview-prep">Preparar entrevista</button>
      ${app.pdfPath ? `<a class="ghost-btn" href="/api/files?path=${encodeURIComponent(app.pdfPath)}" target="_blank">PDF</a>` : ''}
      ${app.jobUrl ? `<a class="ghost-btn" href="${escapeHtml(app.jobUrl)}" target="_blank" rel="noreferrer">Oferta</a>` : ''}
      <button class="ghost-btn" data-learning-app="${app.number}">Guardar aprendizaje</button>
    </div>
  `;
}

function renderReportDetail(box) {
  const report = state.loadedReport || state.reports.find(item => item.id === state.selected.id);
  if (!report) {
    state.selected = { kind: 'home', id: null };
    return renderDetail();
  }
  box.innerHTML = `
    <p class="eyebrow">Informe</p>
    <h2>${escapeHtml(report.company || report.title)}</h2>
    <p>${escapeHtml(report.role || report.tldr || '')}</p>
    <div class="score-panel ${scoreClass(report.score)}">
      <strong>${escapeHtml(report.scoreRaw || 'n/a')}</strong>
      <span>${escapeHtml(report.legitimacy || 'Legitimidad no extraida')}</span>
    </div>
    <dl class="detail-list">
      <dt>Fecha</dt><dd>${escapeHtml(report.date || 'n/a')}</dd>
      <dt>Arquetipo</dt><dd>${escapeHtml(report.archetype || 'n/a')}</dd>
      <dt>Archivo</dt><dd>${escapeHtml(report.path)}</dd>
    </dl>
    <div class="detail-actions">
      <button class="primary-btn" data-report-pdf="${escapeHtml(report.path)}">Generar PDF</button>
      <button class="ghost-btn" data-open-assistant="apply-assistant">Apply assistant</button>
      <button class="ghost-btn" data-open-assistant="deep-research">Research</button>
      <button class="ghost-btn" data-open-assistant="interview-prep">Entrevista</button>
      ${report.url ? `<a class="ghost-btn" href="${escapeHtml(report.url)}" target="_blank" rel="noreferrer">Oferta</a>` : ''}
      <button class="ghost-btn" data-learning-report="${escapeHtml(report.id)}">Guardar aprendizaje</button>
    </div>
  `;
}

async function loadEditor() {
  const [profile, cv, personalization] = await Promise.all([
    api('/api/profile'),
    api('/api/cv'),
    api('/api/personalization'),
  ]);
  state.editorData = {
    profile: profile.content,
    cv: cv.content,
    profileMode: personalization.profileMode,
    articleDigest: personalization.articleDigest,
  };
  $('#editor').value = state.editorData[state.editorKey] || '';
}

async function saveEditor() {
  const value = $('#editor').value;
  state.editorData[state.editorKey] = value;
  if (state.editorKey === 'profile') await api('/api/profile', { method: 'PUT', body: { content: value } });
  else if (state.editorKey === 'cv') await api('/api/cv', { method: 'PUT', body: { content: value } });
  else await api('/api/personalization', { method: 'PUT', body: state.editorData });
  $('#editor-status').textContent = `Guardado a las ${new Date().toLocaleTimeString()}`;
  notify('Cambios guardados en User Layer');
}

function streamJob(jobId, target) {
  const log = $(target);
  log.textContent = `[job] ${jobId}\n`;
  const source = new EventSource(`/api/jobs/${jobId}/events`);
  source.onmessage = event => {
    const item = JSON.parse(event.data);
    log.textContent += `[${item.type}] ${item.line}\n`;
    log.scrollTop = log.scrollHeight;
    if (['done', 'completed', 'error'].includes(item.type)) {
      source.close();
      notify(item.type === 'error' ? 'Job finalizado con error' : 'Job completado', item.type === 'error' ? 'error' : 'ok');
      loadAll().catch(console.error);
    }
  };
  source.onerror = () => {
    source.close();
    notify('Conexion de eventos cerrada', 'warn');
  };
}

function streamReturnedJob(result, target) {
  if (!result?.jobId) return false;
  streamJob(result.jobId, target);
  return true;
}

function setArtifactLink(selector, relPath) {
  const link = $(selector);
  if (!link) return;
  if (!relPath) {
    link.removeAttribute('href');
    link.classList.add('disabled');
    link.setAttribute('aria-disabled', 'true');
    return;
  }
  link.href = `/api/files?path=${encodeURIComponent(relPath)}`;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.classList.remove('disabled');
  link.removeAttribute('aria-disabled');
}

async function loadInsights() {
  const [followups, patterns] = await Promise.all([api('/api/followups'), api('/api/patterns')]);
  state.followups = followups;
  state.patterns = patterns;
  $('#followups-json').textContent = JSON.stringify(followups.data ?? followups, null, 2);
  $('#patterns-json').textContent = JSON.stringify(patterns.data ?? patterns, null, 2);
  renderFollowupSummary();
}

function fillEvaluateFromPipeline(id) {
  const item = state.pipeline.find(row => row.id === String(id));
  if (!item) return;
  setView('evaluate');
  const form = $('#evaluate-form');
  form.url.value = item.url || '';
  form.title.value = [item.company, item.role].filter(Boolean).join(' - ');
  form.jdText.focus();
}

async function updatePipeline(id, patch) {
  await api(`/api/pipeline/${id}`, { method: 'PATCH', body: patch });
  notify('Pipeline actualizado');
  await loadAll();
}

async function deletePipeline(id) {
  const item = state.pipeline.find(row => row.id === String(id));
  if (!item || !confirm(`Eliminar del pipeline?\n\n${item.company || item.url}`)) return;
  await api(`/api/pipeline/${id}`, { method: 'DELETE' });
  state.selected = { kind: 'pipeline', id: null };
  notify('Entrada eliminada del pipeline');
  await loadAll();
}

async function updateStatus(number, status) {
  await api(`/api/applications/${number}/status`, { method: 'PATCH', body: { status } });
  notify('Estado actualizado');
  await loadAll();
}

async function verifyPipeline(id) {
  const item = state.pipeline.find(row => row.id === String(id));
  if (!item) return;
  state.liveness[id] = { result: 'checking' };
  renderDetail();
  state.liveness[id] = await api('/api/jobs/liveness', { method: 'POST', body: { url: item.url } });
  notify(`Liveness: ${state.liveness[id].result}`);
  renderDetail();
}

async function openLearning(payload) {
  const { proposal } = await api('/api/learning/proposal', { method: 'POST', body: payload });
  $('#learning-destination').value = proposal.destination || 'profileMode';
  $('#learning-content').value = proposal.content || '';
  $('#learning-dialog').showModal();
}

async function applyLearningFromDialog() {
  await api('/api/learning/apply', {
    method: 'POST',
    body: {
      destination: $('#learning-destination').value,
      content: $('#learning-content').value,
    },
  });
  $('#learning-dialog').close();
  await loadEditor();
  notify('Aprendizaje guardado');
}

async function runV1Action(path, method, logSelector) {
  const log = $(logSelector);
  log.textContent = 'Ejecutando...\n';
  try {
    const result = await api(path, { method });
    if (streamReturnedJob(result, logSelector)) {
      notify(`Job iniciado: ${result.jobId}`);
      return;
    }
    log.textContent = JSON.stringify(result.result ?? result, null, 2);
    notify('Accion V1 completada');
  } catch (err) {
    log.textContent = `[error] ${err.message}`;
    notify(err.message, 'error');
  }
}

function modulePayload(form) {
  const data = Object.fromEntries(new FormData(form));
  const reportIds = String(data.notes || '').split(',').map(s => s.trim()).filter(Boolean);
  const questions = String(data.notes || '').split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(line => !state.reports.some(report => report.id === line))
    .filter(line => !/^contexto\s*:/i.test(line));
  const mode = data.mode || 'draft';
  const ctx = selectedContext();
  const reportId = reportIds.find(id => state.reports.some(report => report.id === id)) || ctx.reportId || '';
  return {
    company: data.company || ctx.company,
    role: data.role || ctx.role,
    mode,
    assisted: mode === 'assisted',
    url: data.url || ctx.url,
    formUrl: data.formUrl,
    contactUrl: data.contactUrl,
    type: data.contactUrl ? 'contact' : 'recruiter',
    notes: data.notes,
    questions,
    reportIds: reportId ? [reportId, ...reportIds.filter(id => id !== reportId)] : reportIds,
    reportId,
    title: data.company || data.role || ctx.company || ctx.role || data.kind,
    scores: { northStar: 3, recruiterSignal: 3, timeEffort: 3, opportunityCost: 3, risk: 3, portfolioArtifact: 3, targetSignal: 3, uniqueness: 3, demoAbility: 3, metricsPotential: 3, timeToMvp: 3, starStory: 3 },
  };
}

function renderModuleResult(result) {
  if (result.markdown) return result.markdown;
  if (result.result?.markdown) return result.result.markdown;
  if (result.result?.message) return result.result.message;
  return JSON.stringify(result.result ?? result, null, 2);
}

function renderAssistantOutput(result) {
  const box = $('#module-output');
  const text = renderModuleResult(result);
  box.classList.remove('job-log', 'running');
  box.innerHTML = `
    <div class="assistant-output-head">
      <strong>Resultado del asistente</strong>
      <span>Revisa antes de copiar, enviar o aplicar</span>
    </div>
    <div class="assistant-markdown">${compactMdToHtml(text)}</div>
  `;
}

function renderAssistantLog(jobId) {
  const box = $('#module-output');
  box.classList.add('job-log', 'running');
  box.textContent = `[job] ${jobId}\n`;
  const source = new EventSource(`/api/jobs/${jobId}/events`);
  source.onmessage = event => {
    const item = JSON.parse(event.data);
    if (item.type === 'artifact') {
      try {
        const artifact = JSON.parse(item.line);
        if (artifact.result) {
          renderAssistantOutput({
            result: {
              markdown: artifact.result.markdown || artifact.result.result?.message || JSON.stringify(artifact.result, null, 2),
            },
          });
          if (artifact.path) {
            $('#module-output').insertAdjacentHTML('beforeend', `<p class="assistant-artifact"><a href="/api/files?path=${encodeURIComponent(artifact.path)}" target="_blank" rel="noreferrer">Abrir archivo generado</a></p>`);
          }
          return;
        }
      } catch {}
    }
    if (box.classList.contains('job-log')) {
      box.textContent += `[${item.type}] ${item.line}\n`;
      box.scrollTop = box.scrollHeight;
    }
    if (['done', 'completed', 'error'].includes(item.type)) {
      source.close();
      notify(item.type === 'error' ? 'Job finalizado con error' : 'Asistente listo', item.type === 'error' ? 'error' : 'ok');
      loadAll().catch(console.error);
    }
  };
  source.onerror = () => {
    source.close();
    notify('Conexion de eventos cerrada', 'warn');
  };
}

function renderKeywordCoverage(keywords = [], sourceText = '') {
  const box = $('#keyword-coverage');
  const cvText = String(state.editorData?.cv || '').toLowerCase();
  const jdText = String(sourceText || '').toLowerCase();
  const unique = [...new Set(keywords.filter(Boolean))];
  const rows = unique.map(word => ({
    word,
    inCv: cvText.includes(String(word).toLowerCase()),
    inTarget: jdText.includes(String(word).toLowerCase()),
  }));
  const covered = rows.filter(row => row.inCv).length;
  box.innerHTML = `
    <div class="coverage-summary">
      <strong>${covered}/${rows.length || 0}</strong>
      <span>keywords covered in cv.md</span>
    </div>
    <div class="keyword-list">
      ${rows.map(row => `<span class="${row.inCv ? 'covered' : 'missing'}">${escapeHtml(row.word)}</span>`).join('') || '<span class="muted">Genera un CV para ver keywords.</span>'}
    </div>
  `;
}

function openAssistant(kind) {
  setView('lab');
  $$('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.lab === 'insights'));
  $$('.lab-pane').forEach(pane => pane.classList.toggle('active', pane.id === 'lab-insights'));
  hydrateAssistantsFromSelection(kind);
  $('#module-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  notify('Asistente preparado con la oferta seleccionada');
}

function wireEvents() {
  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
  document.addEventListener('click', async event => {
    const target = event.target.closest('button, a');
    if (!target) return;
    if (target.dataset.jump) setView(target.dataset.jump);
    if (target.dataset.selectPipeline) selectPipeline(target.dataset.selectPipeline);
    if (target.dataset.selectApp) selectApplication(target.dataset.selectApp);
    if (target.dataset.evaluatePipeline) fillEvaluateFromPipeline(target.dataset.evaluatePipeline);
    if (target.dataset.togglePipeline) {
      const item = state.pipeline.find(row => row.id === target.dataset.togglePipeline);
      if (item) await updatePipeline(item.id, { done: !item.done });
    }
    if (target.dataset.deletePipeline) await deletePipeline(target.dataset.deletePipeline);
    if (target.dataset.livenessPipeline) await verifyPipeline(target.dataset.livenessPipeline);
    if (target.dataset.openReportPath) {
      const id = target.dataset.openReportPath.split('/').pop().replace(/\.md$/, '');
      setView('evaluate');
      await selectReport(id);
      hydrateEvaluateFromSelection();
    }
    if (target.dataset.openAssistant) openAssistant(target.dataset.openAssistant);
    if (target.dataset.reportPdf) {
      const result = await api('/api/jobs/report-pdf', { method: 'POST', body: { reportPath: target.dataset.reportPdf } });
      streamJob(result.jobId, '#report-log');
    }
    if (target.dataset.v1Action) {
      const log = target.dataset.v1Log || (target.dataset.v1Action.includes('/update') || target.dataset.v1Action.includes('/provider') || target.dataset.v1Action.includes('/language') ? '#update-log' : '#integrity-log');
      await runV1Action(target.dataset.v1Action, target.dataset.v1Method || 'GET', log);
    }
    if (target.dataset.learningApp) {
      const app = state.applications.find(row => row.number === Number(target.dataset.learningApp));
      if (app) await openLearning({ company: app.company, role: app.role, score: app.scoreRaw, decision: app.score < 4 ? 'discard_low_fit' : 'decision_review', notes: app.notes });
    }
    if (target.dataset.learningReport) {
      const report = state.loadedReport || state.reports.find(row => row.id === target.dataset.learningReport);
      if (report) await openLearning({ company: report.company, role: report.role, score: report.scoreRaw, decision: 'report_feedback', notes: report.tldr });
    }
    if (target.dataset.loadInsights !== undefined) await loadInsights();
  });

  $('#refresh-btn').addEventListener('click', async () => {
    const button = $('#refresh-btn');
    button.disabled = true;
    button.textContent = '…';
    try {
      await loadAll();
      button.textContent = '✓';
    } catch (err) {
      button.textContent = '!';
      button.title = err.message;
    } finally {
      setTimeout(() => {
        button.disabled = false;
        button.textContent = '↻';
      }, 900);
    }
  });

  $('#pipeline-search').addEventListener('input', renderPipeline);
  $('#pipeline-filter').addEventListener('change', renderPipeline);
  $('#application-search').addEventListener('input', renderApplications);
  $('#status-filter').addEventListener('change', renderApplications);
  $('#score-filter').addEventListener('change', renderApplications);
  $('#scan-open-btn').addEventListener('click', () => $('#scan-panel').classList.toggle('hidden'));
  $('#scan-open-btn').addEventListener('click', event => {
    event.currentTarget.setAttribute('aria-expanded', String(!$('#scan-panel').classList.contains('hidden')));
  });

  $('#pipeline-form').addEventListener('submit', async event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    await api('/api/pipeline', { method: 'POST', body });
    event.currentTarget.reset();
    notify('Oferta anadida al inbox');
    await loadAll();
  });

  $('#scan-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = { company: form.get('company'), dryRun: form.has('dryRun'), verify: form.has('verify') };
    try {
      const result = await api('/api/jobs/scan', { method: 'POST', body });
      streamReturnedJob(result, '#scan-log');
      notify(`Scan job iniciado: ${result.jobId}`);
    } catch (err) {
      $('#scan-log').textContent = `[error] ${err.message}`;
    }
  });

  $('#evaluate-form').addEventListener('submit', async event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    if (!String(body.url || '').trim() && !String(body.jdText || '').trim()) {
      $('#evaluate-log').textContent = '[error] Pega un JD o indica una URL.';
      return;
    }
    try {
      const result = await api('/api/jobs/evaluate', { method: 'POST', body });
      streamReturnedJob(result, '#evaluate-log');
      notify(`Evaluate job iniciado: ${result.jobId}`);
    } catch (err) {
      $('#evaluate-log').textContent = `[error] ${err.message}`;
    }
  });

  $('#auto-pipeline-btn').addEventListener('click', async () => {
    const body = Object.fromEntries(new FormData($('#evaluate-form')));
    if (!String(body.url || '').trim() && !String(body.jdText || '').trim()) {
      $('#evaluate-log').textContent = '[error] Pega un JD o indica una URL.';
      return;
    }
    try {
      const result = await api('/api/jobs/auto-pipeline', { method: 'POST', body });
      streamReturnedJob(result, '#evaluate-log');
      notify(`Auto-pipeline iniciado: ${result.jobId}`);
    } catch (err) {
      $('#evaluate-log').textContent = `[error] ${err.message}`;
      notify(err.message, 'error');
    }
  });

  $('#report-picker').addEventListener('change', event => selectReport(event.target.value));
  $('#generate-report-pdf').addEventListener('click', async () => {
    const report = state.loadedReport || state.reports.find(row => row.id === $('#report-picker').value);
    if (!report) return;
    const result = await api('/api/jobs/report-pdf', { method: 'POST', body: { reportPath: report.path } });
    streamReturnedJob(result, '#report-log');
    notify(`PDF job iniciado: ${result.jobId}`);
  });
  $('#generate-cv-pdf').addEventListener('click', async () => {
    const report = state.loadedReport || state.reports.find(row => row.id === $('#report-picker').value);
    try {
      const result = await api('/api/jobs/cv-pdf', { method: 'POST', body: { reportId: report?.id, company: report?.company } });
      streamReturnedJob(result, '#report-log');
      setArtifactLink('#cv-preview-link', result.htmlPath);
      setArtifactLink('#cv-download-link', result.outputPath);
      renderKeywordCoverage(result.keywords, report?.markdown || '');
      notify(`CV ATS iniciado: ${result.jobId}`);
    } catch (err) {
      $('#report-log').textContent = `[error] ${err.message}`;
      notify(err.message, 'error');
    }
  });

  $('#cv-workspace-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    const report = state.loadedReport || state.reports.find(row => row.id === $('#report-picker').value);
    if (report?.id) body.reportId = report.id;
    try {
      const result = await api('/api/jobs/cv-pdf', { method: 'POST', body });
      streamReturnedJob(result, '#report-log');
      setArtifactLink('#cv-preview-link', result.htmlPath);
      setArtifactLink('#cv-download-link', result.outputPath);
      renderKeywordCoverage(result.keywords, body.jdText || report?.markdown || '');
      notify(`CV preview job iniciado: ${result.jobId}`);
    } catch (err) {
      $('#report-log').textContent = `[error] ${err.message}`;
      notify(err.message, 'error');
    }
  });

  $('#fill-liveness-from-pipeline').addEventListener('click', () => {
    const urls = state.pipeline.filter(item => !item.done && item.url).map(item => item.url);
    $('#bulk-liveness-urls').value = urls.join('\n');
    notify(`${urls.length} URLs pendientes cargadas`);
  });

  $('#bulk-liveness-form').addEventListener('submit', async event => {
    event.preventDefault();
    const urls = String(new FormData(event.currentTarget).get('urls') || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!urls.length) {
      appendLog('#batch-log', '[error] Pega al menos una URL.\n', true);
      return;
    }
    try {
      const result = await api('/api/jobs/liveness-bulk', { method: 'POST', body: { urls } });
      streamReturnedJob(result, '#batch-log');
      notify(`Liveness job iniciado: ${result.jobId}`);
    } catch (err) {
      $('#batch-log').textContent = `[error] ${err.message}`;
      notify(err.message, 'error');
    }
  });

  $('#module-form').addEventListener('submit', async event => {
    event.preventDefault();
    const kind = new FormData(event.currentTarget).get('kind');
    try {
      const result = await api(`/api/modules/${kind}`, { method: 'POST', body: modulePayload(event.currentTarget) });
      if (result.jobId) {
        renderAssistantLog(result.jobId);
        notify(`Modulo job iniciado: ${result.jobId}`);
        return;
      }
      renderAssistantOutput(result);
      notify('Asistente generado');
    } catch (err) {
      $('#module-output').classList.remove('job-log', 'running');
      $('#module-output').innerHTML = `<div class="assistant-error">Error: ${escapeHtml(err.message)}</div>`;
      notify(err.message, 'error');
    }
  });

  document.addEventListener('change', async event => {
    const detailStatus = event.target.closest('[data-status-detail]');
    if (detailStatus) await updateStatus(detailStatus.dataset.statusDetail, detailStatus.value);
  });

  $$('.tab').forEach(tab => tab.addEventListener('click', () => {
    $$('.tab').forEach(t => t.classList.toggle('active', t === tab));
    $$('.lab-pane').forEach(pane => pane.classList.toggle('active', pane.id === (tab.dataset.lab === 'insights' ? 'lab-insights' : 'lab-editor')));
    if (tab.dataset.lab !== 'insights') {
      state.editorData[state.editorKey] = $('#editor').value;
      state.editorKey = tab.dataset.lab;
      $('#editor').value = state.editorData[state.editorKey] || '';
    }
  }));
  $('#save-editor').addEventListener('click', saveEditor);
  $('#load-followups').addEventListener('click', loadInsights);
  $('#load-patterns').addEventListener('click', loadInsights);
  $('#confirm-learning').addEventListener('click', event => {
    event.preventDefault();
    applyLearningFromDialog().catch(err => alert(err.message));
  });
}

try {
  wireEvents();
  await loadAll();
  await loadEditor();
  await loadInsights().catch(() => {});
  if (state.reports[0]) await selectReport(state.reports[0].id).catch(() => {});
  setView('home');
} catch (err) {
  fatal(`No se pudo iniciar la app: ${err.message}`);
}
