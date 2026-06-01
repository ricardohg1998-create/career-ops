const state = {
  view: 'home',
  health: null,
  applications: [],
  metrics: null,
  states: [],
  pipeline: [],
  reports: [],
  jobs: [],
  followups: null,
  patterns: null,
  selected: { kind: 'home', id: null },
  editorKey: 'profile',
  editorData: {},
  loadedReport: null,
  liveness: {},
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const statusLabels = {
  Evaluated: 'Evaluada',
  Applied: 'Aplicada',
  Responded: 'Respondida',
  Interview: 'Entrevista',
  Offer: 'Oferta',
  Rejected: 'Rechazada',
  Discarded: 'Descartada',
  SKIP: 'No aplicar',
};

const viewTitles = {
  home: 'Inicio',
  inbox: 'Inbox de oportunidades',
  evaluate: 'Evaluar y decidir',
  tracker: 'Tracker operativo',
  lab: 'Lab de perfil e insights',
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
  return data;
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
        <span>${app.number}</span>
        <span><strong>${escapeHtml(app.company)}</strong><small>${escapeHtml(app.role)}</small></span>
        <span><em class="score-pill ${scoreClass(app.score)}">${escapeHtml(app.scoreRaw || 'n/a')}</em></span>
        <span><em class="chip">${escapeHtml(statusLabels[app.status] || app.status)}</em></span>
        <span>${app.score < 4 ? '<em class="chip bad">descartar</em>' : '<em class="chip good">revisar</em>'}</span>
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
  renderDetail();
}

async function selectReport(id) {
  if (!id) return;
  const { report } = await api(`/api/reports/${encodeURIComponent(id)}`);
  state.loadedReport = report;
  state.selected = { kind: 'report', id: report.id };
  renderReportViewer(report);
  renderReports();
  renderDetail();
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
          <div>${mdToHtml(content).slice(0, 10000)}</div>
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
}

function streamJob(jobId, target) {
  const log = $(target);
  log.textContent = '';
  const source = new EventSource(`/api/jobs/${jobId}/events`);
  source.onmessage = event => {
    const item = JSON.parse(event.data);
    log.textContent += `[${item.type}] ${item.line}\n`;
    log.scrollTop = log.scrollHeight;
    if (item.type === 'done') {
      source.close();
      loadAll().catch(console.error);
    }
  };
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
  await loadAll();
}

async function deletePipeline(id) {
  const item = state.pipeline.find(row => row.id === String(id));
  if (!item || !confirm(`Eliminar del pipeline?\n\n${item.company || item.url}`)) return;
  await api(`/api/pipeline/${id}`, { method: 'DELETE' });
  state.selected = { kind: 'pipeline', id: null };
  await loadAll();
}

async function updateStatus(number, status) {
  await api(`/api/applications/${number}/status`, { method: 'PATCH', body: { status } });
  await loadAll();
}

async function verifyPipeline(id) {
  const item = state.pipeline.find(row => row.id === String(id));
  if (!item) return;
  state.liveness[id] = { result: 'checking' };
  renderDetail();
  state.liveness[id] = await api('/api/jobs/liveness', { method: 'POST', body: { url: item.url } });
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
    }
    if (target.dataset.reportPdf) {
      const result = await api('/api/jobs/report-pdf', { method: 'POST', body: { reportPath: target.dataset.reportPdf } });
      streamJob(result.jobId, '#report-log');
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

  $('#pipeline-form').addEventListener('submit', async event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    await api('/api/pipeline', { method: 'POST', body });
    event.currentTarget.reset();
    await loadAll();
  });

  $('#scan-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = { company: form.get('company'), dryRun: form.has('dryRun'), verify: form.has('verify') };
    try {
      const result = await api('/api/jobs/scan', { method: 'POST', body });
      streamJob(result.jobId, '#scan-log');
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
      streamJob(result.jobId, '#evaluate-log');
    } catch (err) {
      $('#evaluate-log').textContent = `[error] ${err.message}`;
    }
  });

  $('#report-picker').addEventListener('change', event => selectReport(event.target.value));
  $('#generate-report-pdf').addEventListener('click', async () => {
    const report = state.loadedReport || state.reports.find(row => row.id === $('#report-picker').value);
    if (!report) return;
    const result = await api('/api/jobs/report-pdf', { method: 'POST', body: { reportPath: report.path } });
    streamJob(result.jobId, '#report-log');
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

wireEvents();
await loadAll();
await loadEditor();
await loadInsights().catch(() => {});
if (state.reports[0]) await selectReport(state.reports[0].id).catch(() => {});
setView('home');
