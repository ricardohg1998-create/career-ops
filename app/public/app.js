import { api } from './modules/api.js';
import { state, statusLabels, viewTitles, moduleLabels, modeLabels, stepLabels } from './modules/state.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ═══════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════ */

function notify(message, type = 'ok', action = null) {
  const box = $('#mutation-feedback');
  if (!box) return;
  const el = document.createElement('div');
  el.dataset.type = type;
  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);
  if (action?.label && typeof action.onClick === 'function') {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await action.onClick();
      } catch (err) {
        notify(err.message, 'error');
      } finally {
        el.remove();
      }
    });
    el.appendChild(button);
  }
  box.appendChild(el);
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 400);
  }, 3200);
}

function confirmMutation({ title, files = [], detail = '' } = {}) {
  const lines = [
    title || 'Esta acción escribirá cambios locales.',
    detail,
    files.length ? 'Archivos afectados:' : '',
    ...files.map(file => `- ${file}`),
    '',
    'Continúa solo si quieres guardar estos cambios.'
  ].filter(Boolean);
  const ok = confirm(lines.join('\n'));
  if (!ok) notify('Acción cancelada. No se escribieron cambios.', 'warn');
  return ok;
}

function countLines(value = '') {
  if (!String(value).length) return 0;
  return String(value).split(/\r?\n/).length;
}

function summarizeTextDiff(before = '', after = '') {
  const beforeLines = String(before || '').split(/\r?\n/);
  const afterLines = String(after || '').split(/\r?\n/);
  const max = Math.max(beforeLines.length, afterLines.length);
  let changed = 0;
  for (let i = 0; i < max; i++) {
    if ((beforeLines[i] || '') !== (afterLines[i] || '')) changed++;
  }
  return [
    'Vista previa de cambios:',
    `- Lineas antes: ${countLines(before)}`,
    `- Lineas despues: ${countLines(after)}`,
    `- Lineas modificadas: ${changed}`,
  ].join('\n');
}

function summarizeListChange(label, before = [], afterText = '') {
  const after = String(afterText || '').split(/\r?\n|,/).map(item => item.trim()).filter(Boolean);
  const previous = Array.isArray(before) ? before : [];
  const added = after.filter(item => !previous.includes(item));
  const removed = previous.filter(item => !after.includes(item));
  return `${label}: ${previous.length} -> ${after.length}${added.length ? `, +${added.length}` : ''}${removed.length ? `, -${removed.length}` : ''}`;
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

/* ═══════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════ */

const viewAliases = { inbox: 'opportunities', lab: 'dossier' };

function setView(name) {
  const resolved = viewAliases[name] || name;
  state.view = resolved;
  $$('.nav-item').forEach(btn => {
    const btnView = viewAliases[btn.dataset.view] || btn.dataset.view;
    const active = btnView === resolved && !btn.classList.contains('nav-compat');
    btn.classList.toggle('active', active);
    if (active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
  $$('.view').forEach(view => {
    const viewId = view.id.replace('view-', '');
    view.classList.toggle('active', viewId === resolved);
  });
  $('#view-title').textContent = viewTitles[resolved] || resolved;
  if (resolved === 'home') state.selected = { kind: 'home', id: null };
  if (resolved === 'opportunities' && !state.selected.id) selectPipeline(state.pipeline.find(item => !item.done)?.id);
  if (resolved === 'tracker' && state.selected.kind !== 'app') selectApplication(state.applications[0]?.number);
  if (resolved === 'dossier') hydrateAssistantsFromSelection();
  renderDetail();
}

function openScanPanel() {
  const panel = $('#scan-panel');
  const button = $('#scan-open-btn');
  if (!panel) return;
  panel.classList.remove('hidden');
  button?.setAttribute('aria-expanded', 'true');
  panel.scrollIntoView({ block: 'nearest' });
}

/* ═══════════════════════════════════════════
   DATA LOADING
   ═══════════════════════════════════════════ */

async function loadAll() {
  const [health, apps, pipeline, reports, jobs, nextActions, scanner, scannerSchedule] = await Promise.all([
    api('/api/health'),
    api('/api/applications'),
    api('/api/pipeline'),
    api('/api/reports'),
    api('/api/jobs'),
    api('/api/next-actions'),
    api('/api/scanner/discovery'),
    api('/api/scanner/schedule'),
  ]);
  state.health = health;
  state.applications = apps.applications;
  state.applicationEvents = apps.events || [];
  state.metrics = apps.metrics;
  state.states = apps.states;
  state.pipeline = pipeline.entries;
  state.reports = reports.reports;
  state.jobs = jobs.jobs;
  state.nextActions = nextActions.actions || [];
  state.scanner = scanner;
  state.scannerSchedule = scannerSchedule;
  renderAll();
}

function renderAll() {
  renderHealth();
  renderHome();
  renderOpportunities();
  renderScannerSchedule();
  renderApplications();
  renderReports();
  renderJobsHint();
  renderDetail();
}

/* ═══════════════════════════════════════════
   HEALTH
   ═══════════════════════════════════════════ */

function renderHealth() {
  const labels = {
    cv: 'CV',
    profile: 'Perfil',
    profileMode: 'Personalización',
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
      <strong>${ok ? '✓' : 'x'} ${escapeHtml(labels[key] || key)}</strong>
      <span>${ok ? 'Correcto' : 'Falta'}</span>
    </div>
  `).join('');
}

/* ═══════════════════════════════════════════
   HOME
   ═══════════════════════════════════════════ */

function renderHome() {
  const m = state.metrics || {};
  const pending = state.pipeline.filter(item => !item.done).length;
  const activeJobs = state.jobs.filter(job => job.status === 'running').length;
  $('#metrics').innerHTML = [
    ['Aplicaciones', m.total ?? 0],
    ['Activas', m.active ?? 0],
    ['Alta >=4', m.top ?? 0],
    ['Cola', pending],
    ['Trabajos vivos', activeJobs],
  ].map(([label, value]) => `<button class="metric" data-home-metric="${escapeHtml(label)}"><strong>${value}</strong><span>${label}</span></button>`).join('');

  renderNorthStar();
  const serverActions = (state.nextActions || []).slice(1, 8).map(renderNextAction);
  $('#priority-list').innerHTML = serverActions.join('') || `<div class="empty-state"><span class="empty-icon">◇</span><span class="empty-title">Sin acciones urgentes</span><span class="empty-subtitle">Buen momento para escanear portales o revisar patrones.</span></div>`;
  renderFollowupSummary();
  return;

  const top = state.applications.filter(app => app.score >= 4 && app.status === 'Evaluated').slice(0, 4);
  const low = state.applications.filter(app => typeof app.score === 'number' && app.score < 4 && app.status === 'Evaluated').slice(0, 3);
  const pendingItems = state.pipeline.filter(item => !item.done).slice(0, 4);
  const actions = [
    ...top.map(app => nextActionApp(app, 'Revisar candidatura', 'Alta afinidad: decide si merece CV y dossier.')),
    ...pendingItems.map(item => nextActionPipeline(item)),
    ...low.map(app => nextActionApp(app, 'Descartar o justificar', 'Score bajo: no aplicar salvo una razón estratégica fuerte.')),
  ].slice(0, 7);
  $('#priority-list').innerHTML = actions.join('') || `<div class="empty-state"><span class="empty-icon">◇</span><span class="empty-title">Sin acciones urgentes</span><span class="empty-subtitle">Buen momento para escanear portales o revisar patrones.</span></div>`;
  renderFollowupSummary();
}

function renderNorthStar() {
  const action = (state.nextActions || [])[0];
  const box = $('#north-star-answer');
  if (!box) return;
  if (!action) {
    box.innerHTML = `
      <div class="north-star-copy">
        <span class="action-kicker">North Star</span>
        <h2>Escanear o revisar patrones</h2>
        <p>No hay acciones urgentes cargadas todavía.</p>
      </div>
      <button class="primary-btn" data-jump="opportunities">Escanear</button>
    `;
    return;
  }
  box.innerHTML = `
    <div class="north-star-copy">
      <span class="action-kicker">${escapeHtml(action.recommendation || action.type || 'Accion')}</span>
      <h2>${escapeHtml(action.headline || action.label)}</h2>
      <p>${escapeHtml(action.reason || '')}</p>
      <div class="action-meta">
        <span>${escapeHtml((action.priority || 'medium').toUpperCase())}</span>
        <span>${escapeHtml(action.safety || 'Revisión humana antes de enviar o aplicar.')}</span>
      </div>
    </div>
    <button class="primary-btn" ${action.targetView ? `data-jump="${escapeHtml(action.targetView)}"` : ''} ${action.selectKind === 'app' ? `data-select-app="${escapeHtml(action.selectId)}"` : ''} ${action.selectKind === 'pipeline' ? `data-select-pipeline="${escapeHtml(action.selectId)}"` : ''} ${action.openScanPanel ? 'data-open-scan-panel' : ''}>${escapeHtml(action.primaryAction || 'Abrir')}</button>
  `;
}

function renderNextAction(action) {
  return `
    <button class="decision-item" ${action.targetView ? `data-jump="${escapeHtml(action.targetView)}"` : ''} ${action.selectKind === 'app' ? `data-select-app="${escapeHtml(action.selectId)}"` : ''} ${action.selectKind === 'pipeline' ? `data-select-pipeline="${escapeHtml(action.selectId)}"` : ''} ${action.openScanPanel ? 'data-open-scan-panel' : ''}>
      <span class="score-pill ${scoreClass(Number.parseFloat(action.score))}">${escapeHtml(action.score || action.recommendation || action.type || 'acción')}</span>
      <strong>${escapeHtml(action.headline || action.label)}</strong>
      <span>${escapeHtml([action.company, action.role].filter(Boolean).join(' - ') || action.label || '')}</span>
      <em>${escapeHtml(action.reason || '')}</em>
    </button>
  `;
}

function nextActionApp(app, action, reason) {
  return `
    <button class="decision-item" data-select-app="${app.number}" data-jump="tracker">
      <span class="score-pill ${scoreClass(app.score)}">${escapeHtml(app.scoreRaw || 'n/a')}</span>
      <strong>${escapeHtml(action)}</strong>
      <span>${escapeHtml(app.company)} · ${escapeHtml(app.role)}</span>
      <em>${escapeHtml(reason)}</em>
    </button>
  `;
}

function nextActionPipeline(item) {
  return `
    <button class="decision-item" data-select-pipeline="${item.id}" data-jump="opportunities">
      <span class="score-pill">URL</span>
      <strong>Evaluar oportunidad</strong>
      <span>${escapeHtml(item.company || item.sourceHost || 'Cola')} · ${escapeHtml(item.role || item.url)}</span>
      <em>Pendiente de scoring, legitimidad y siguiente decisión.</em>
    </button>
  `;
}

function renderFollowupSummary() {
  const data = state.followups?.data || state.followups;
  if (!data) {
    $('#followup-summary').innerHTML = '<button class="ghost-btn" data-load-insights>Calcular seguimientos</button>';
    return;
  }
  const items = extractFollowupItems(data);
  if (!items.length) {
    $('#followup-summary').innerHTML = '<div class="empty">Sin seguimientos pendientes.</div>';
    return;
  }
  $('#followup-summary').innerHTML = `<div class="insights-list">${items.slice(0, 5).map(renderFollowupItem).join('')}</div>`;
}

function extractFollowupItems(data) {
  const items = [];
  const pushEntry = (entry, fallbackUrgency = 'upcoming') => {
    const raw = String(entry.urgency || entry.status || '').toLowerCase();
    const urgency = raw === 'overdue' || entry.daysUntilNext < 0
      ? 'overdue'
      : raw === 'urgent' || raw === 'due' || entry.daysUntilNext === 0
        ? 'due'
        : fallbackUrgency;
    items.push({ ...entry, urgency });
  };
  if (Array.isArray(data?.overdue)) {
    data.overdue.forEach(f => pushEntry(f, 'overdue'));
  }
  if (Array.isArray(data?.due)) {
    data.due.forEach(f => pushEntry(f, 'due'));
  }
  if (Array.isArray(data?.upcoming)) {
    data.upcoming.forEach(f => pushEntry(f, 'upcoming'));
  }
  if (Array.isArray(data?.entries)) {
    data.entries.forEach(f => pushEntry(f));
  }
  if (Array.isArray(data)) {
    data.forEach(f => pushEntry(f, f.overdue ? 'overdue' : (f.due ? 'due' : 'upcoming')));
  }
  return items.sort((a, b) => {
    const rank = { overdue: 0, due: 1, upcoming: 2 };
    return (rank[a.urgency] ?? 3) - (rank[b.urgency] ?? 3);
  });
}

function renderFollowupItem(item) {
  const urgency = item.urgency || 'upcoming';
  const icon = urgency === 'overdue' ? '⚠' : urgency === 'due' ? '◎' : '◇';
  const label = urgency === 'overdue' ? 'Vencido' : urgency === 'due' ? 'Pendiente' : 'Próximo';
  const company = item.company || item.Company || '';
  const role = item.role || item.Role || '';
  const days = item.daysSinceLastFollowup ?? item.daysSinceApplication ?? item.daysSinceContact ?? item.days ?? '';
  const nextDate = item.nextFollowupDate ? ` · próximo ${escapeHtml(item.nextFollowupDate)}` : '';
  const action = item.recommendedAction || item.action || item.nextAction || (urgency === 'overdue' ? 'preparar seguimiento' : '');
  return `
    <div class="insight-item ${urgency}">
      <span class="insight-icon">${icon}</span>
      <div class="insight-body">
        <span class="insight-title">${escapeHtml(company)}${role ? ` — ${escapeHtml(role)}` : ''}</span>
        <span class="insight-meta">${escapeHtml(label)}${days !== '' && days !== null ? ` · ${escapeHtml(days)} días` : ''}${nextDate}${action ? ` · ${escapeHtml(action)}` : ''}</span>
      </div>
    </div>
  `;
}

/* ═══════════════════════════════════════════
   OPORTUNIDADES
   ═══════════════════════════════════════════ */

function renderOpportunities() {
  const query = ($('#pipeline-search')?.value || '').toLowerCase();
  const filter = $('#pipeline-filter')?.value || 'pending';
  renderScannerDiscovery();
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
  `).join('') || '<div class="empty-state"><span class="empty-icon">◎</span><span class="empty-title">Sin entradas</span><span class="empty-subtitle">No hay entradas para este filtro.</span></div>';
}

/* ═══════════════════════════════════════════
   TRACKER
   ═══════════════════════════════════════════ */

function discoveryStateLabel(stateValue = '') {
  return {
    pending: 'Pendiente',
    evaluated: 'Evaluada',
    processed: 'Procesada',
    closed: 'Cerrada',
    no_apply_control: 'Sin apply',
    blocked: 'Bloqueada',
    missing_from_pipeline: 'Fuera de cola',
  }[stateValue] || 'Revisar';
}

function discoveryStateClass(stateValue = '') {
  if (stateValue === 'pending') return 'good';
  if (stateValue === 'evaluated' || stateValue === 'processed') return 'blue';
  if (stateValue === 'closed' || stateValue === 'blocked') return 'bad';
  if (stateValue === 'missing_from_pipeline' || stateValue === 'no_apply_control') return 'warn';
  return '';
}

function renderDiscoveryAction(entry) {
  if (entry.pipelineId) return `<button class="ghost-btn" data-select-pipeline="${escapeHtml(entry.pipelineId)}">${escapeHtml(entry.recommendedAction || 'Abrir')}</button>`;
  if (entry.applicationNumber) return `<button class="ghost-btn" data-select-app="${escapeHtml(entry.applicationNumber)}">Abrir evaluación</button>`;
  if (entry.state === 'missing_from_pipeline') return `<button class="ghost-btn" data-import-discovery="${escapeHtml(entry.id)}">Reimportar</button>`;
  return `<a class="ghost-btn" href="${escapeHtml(entry.url)}" target="_blank" rel="noreferrer">Abrir URL</a>`;
}

function renderScannerDiscovery() {
  const box = $('#scanner-discovery');
  if (!box) return;
  const scanner = state.scanner || {};
  const entries = (scanner.entries || []).slice(0, 6);
  const summary = scanner.summary || {};
  box.innerHTML = `
    <div class="scanner-head">
      <div>
        <span class="action-kicker">Descubrimiento</span>
        <h3>Ofertas descubiertas automáticamente</h3>
        <p>${escapeHtml(scanner.guidance || 'Escanea portales para importar oportunidades sin pegar cada URL.')}</p>
      </div>
      <div class="scanner-stats">
        <span><strong>${summary.pending || 0}</strong> pendientes</span>
        <span><strong>${summary.evaluated || 0}</strong> evaluadas</span>
        <span><strong>${summary.highConfidence || 0}</strong> alta confianza</span>
      </div>
    </div>
    <div class="discovery-list">
      ${entries.map(entry => `
        <div class="discovery-row">
          <div class="discovery-main">
            <strong>${escapeHtml(entry.company || entry.sourceHost || 'Sin empresa')}</strong>
            <span>${escapeHtml(entry.title || entry.url)}</span>
            <small>${escapeHtml([entry.firstSeen, entry.location, entry.portal].filter(Boolean).join(' · '))}</small>
          </div>
          <div class="discovery-meta">
            <em class="chip ${discoveryStateClass(entry.state)}">${escapeHtml(discoveryStateLabel(entry.state))}</em>
            <em class="chip">${escapeHtml(entry.confidence?.label || 'Fuente')}</em>
            ${entry.score ? `<em class="score-pill ${scoreClass(Number.parseFloat(entry.score))}">${escapeHtml(entry.score)}</em>` : ''}
          </div>
          <div class="discovery-action">${renderDiscoveryAction(entry)}</div>
        </div>
      `).join('') || '<div class="empty-state"><span class="empty-icon">◇</span><span class="empty-title">Sin historial de escaneo</span><span class="empty-subtitle">Ejecuta un escaneo para importar ofertas automáticamente.</span></div>'}
    </div>
  `;
}

async function importDiscoveryOffer(id) {
  const entry = (state.scanner?.entries || []).find(item => String(item.id) === String(id));
  if (!entry?.url) return;
  await api('/api/pipeline', {
    method: 'POST',
    body: { url: entry.url, company: entry.company, role: entry.title },
  });
  notify('Oferta reimportada a oportunidades');
  await loadAll();
}

function renderScannerSchedule() {
  const box = $('#scan-schedule-card');
  if (!box) return;
  const schedule = state.scannerSchedule || {};
  const status = schedule.enabled
    ? schedule.due
      ? 'Vence ahora'
      : `Proximo scan: ${schedule.nextScanDate || 'sin historial'}`
    : 'Rutina desactivada';
  box.innerHTML = `
    <form id="scan-schedule-form" class="scan-schedule-form" aria-label="Rutina de discovery">
      <div class="scan-schedule-head">
        <div>
          <span class="action-kicker">Discovery recurrente</span>
          <h3>Rutina de escaneo</h3>
          <p>${escapeHtml(status)}${schedule.lastScanDate ? ` - ultimo ${escapeHtml(schedule.lastScanDate)}` : ''}</p>
        </div>
        <label class="check"><input name="enabled" type="checkbox" ${schedule.enabled ? 'checked' : ''}> Activa</label>
      </div>
      <div class="scan-schedule-grid">
        <label class="field-label">Cada dias<input name="frequencyDays" type="number" min="1" max="30" value="${escapeHtml(schedule.frequencyDays || 3)}"></label>
        <label class="field-label">Empresa opcional<input name="company" value="${escapeHtml(schedule.company || '')}" placeholder="Todas"></label>
        <label class="check"><input name="dryRun" type="checkbox" ${schedule.dryRun !== false ? 'checked' : ''}> Simulacion</label>
        <label class="check"><input name="verify" type="checkbox" ${schedule.verify ? 'checked' : ''}> Verificar activas</label>
      </div>
      <div class="scan-command-row">
        <code>${escapeHtml(schedule.command || 'node scan.mjs --dry-run')}</code>
        <div class="toolbar">
          <button class="ghost-btn" type="submit">Guardar rutina</button>
          <button class="primary-btn" type="button" data-run-scheduled-scan>Ejecutar ahora</button>
        </div>
      </div>
    </form>
  `;
}

async function saveScannerSchedule(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  if (!confirmMutation({
    title: 'Guardar rutina de escaneo.',
    files: ['data/scan-schedule.json'],
    detail: data.has('enabled') ? `Frecuencia: cada ${data.get('frequencyDays') || 3} dias.` : 'La rutina quedara desactivada.',
  })) return;
  state.scannerSchedule = await api('/api/scanner/schedule', {
    method: 'PUT',
    body: {
      enabled: data.has('enabled'),
      frequencyDays: data.get('frequencyDays'),
      company: data.get('company'),
      dryRun: data.has('dryRun'),
      verify: data.has('verify'),
    },
  });
  renderScannerSchedule();
  state.nextActions = (await api('/api/next-actions')).actions || [];
  renderHome();
  notify('Rutina de discovery guardada');
}

async function runScheduledScan() {
  const schedule = state.scannerSchedule || {};
  const result = await api('/api/jobs/scan', {
    method: 'POST',
    body: {
      company: schedule.company || '',
      dryRun: schedule.dryRun !== false,
      verify: Boolean(schedule.verify),
    },
  });
  streamReturnedJob(result, '#scan-log');
  notify(`Escaneo de rutina iniciado: ${result.jobId}`);
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
  $('#applications-table').setAttribute('role', 'grid');
  $('#applications-table').setAttribute('aria-label', 'Aplicaciones evaluadas');
  $('#applications-table').innerHTML = `
    <div class="table-head" role="row">
      <span role="columnheader">#</span><span role="columnheader">Empresa / rol</span><span role="columnheader">Puntuación</span><span role="columnheader">Estado</span><span role="columnheader">Decisión</span>
    </div>
    ${rows.map(app => `
      <button class="table-row ${state.selected.kind === 'app' && String(state.selected.id) === String(app.number) ? 'selected' : ''}" data-select-app="${app.number}" role="row" aria-label="${escapeHtml(`#${app.number} ${app.company} ${app.role}`)}">
        <span role="gridcell" data-label="#">${app.number}</span>
        <span role="gridcell" data-label="Empresa / rol"><strong>${escapeHtml(app.company)}</strong><small>${escapeHtml(app.role)}</small></span>
        <span role="gridcell" data-label="Puntuación"><em class="score-pill ${scoreClass(app.score)}">${escapeHtml(app.scoreRaw || 'n/a')}</em></span>
        <span role="gridcell" data-label="Estado"><em class="chip">${escapeHtml(statusLabels[app.status] || app.status)}</em></span>
        <span role="gridcell" data-label="Decisión">${app.score < 4 ? '<em class="chip bad">descartar</em>' : '<em class="chip good">revisar</em>'}</span>
      </button>
    `).join('')}
  `;
}

/* ═══════════════════════════════════════════
   REPORTS
   ═══════════════════════════════════════════ */

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
  $('#evaluate-status').textContent = running.length ? `${running.length} trabajos activos` : '';
  renderRecentJobs();
}

function formatJobDuration(job = {}) {
  const start = job.startedAt ? new Date(job.startedAt).getTime() : null;
  const end = job.endedAt ? new Date(job.endedAt).getTime() : Date.now();
  if (!start || Number.isNaN(start) || Number.isNaN(end)) return 'Duración no disponible';
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function jobArtifacts(job = {}) {
  const artifacts = [];
  for (const event of job.logs || []) {
    if (event.type !== 'artifact') continue;
    try {
      const data = JSON.parse(event.line);
      for (const value of Object.values(data)) {
        if (typeof value === 'string' && /^(reports|output|jds|interview-prep)\//.test(value)) artifacts.push(value);
      }
    } catch {}
  }
  return [...new Set(artifacts)].slice(0, 4);
}

function jobStepTimeline(job = {}) {
  const steps = new Map();
  for (const event of job.logs || []) {
    if (event.type !== 'artifact') continue;
    try {
      const data = JSON.parse(event.line);
      if (data.step && data.status) steps.set(data.step, data.status);
      if (data.steps && typeof data.steps === 'object') {
        for (const [step, item] of Object.entries(data.steps)) {
          steps.set(step, item?.status || item || 'completed');
        }
      }
    } catch {}
  }
  if (!steps.size && job.status) steps.set(job.kind || job.type || 'job', job.status);
  return [...steps.entries()].slice(-8).map(([step, status]) => ({
    step,
    status,
    label: stepLabels[step] || step,
  }));
}

function renderRecentJobs() {
  const box = $('#recent-jobs');
  if (!box) return;
  const jobs = [...(state.jobs || [])]
    .sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')))
    .slice(0, 6);
  if (!jobs.length) {
    box.innerHTML = '<div class="empty">Sin trabajos recientes.</div>';
    return;
  }
  box.innerHTML = jobs.map(job => {
    const artifacts = jobArtifacts(job);
    const steps = jobStepTimeline(job);
    const lastError = [...(job.logs || [])].reverse().find(event => event.type === 'error')?.line || '';
    return `
      <article class="job-card ${escapeHtml(job.status || 'unknown')}">
        <div>
          <span class="status-badge ${escapeHtml(job.status || 'unknown')}">${escapeHtml(job.status || 'sin estado')}</span>
          <strong>${escapeHtml(job.kind || job.type || job.id)}</strong>
          <small>${escapeHtml(formatJobDuration(job))}${job.exitCode !== null && job.exitCode !== undefined ? ` - código ${escapeHtml(job.exitCode)}` : ''}</small>
          ${lastError ? `<em>${escapeHtml(lastError)}</em>` : ''}
          ${steps.length ? `<ol class="job-timeline" aria-label="Pasos del trabajo">${steps.map(item => `<li data-status="${escapeHtml(item.status)}"><span></span>${escapeHtml(item.label)}</li>`).join('')}</ol>` : ''}
          ${artifacts.length ? `<div class="job-artifacts">${artifacts.map(file => `<a href="/api/files?path=${encodeURIComponent(file)}" target="_blank" rel="noreferrer">${escapeHtml(file)}</a>`).join('')}</div>` : ''}
        </div>
        ${job.status === 'running' ? `<button class="danger-btn" data-cancel-job="${escapeHtml(job.id)}">Cancelar</button>` : ''}
      </article>
    `;
  }).join('');
}

/* ═══════════════════════════════════════════
   LOGS
   ═══════════════════════════════════════════ */

function appendLog(selector, message, reset = false) {
  const log = $(selector);
  if (!log) return;
  log.textContent = reset ? message : `${log.textContent}${message}`;
  log.scrollTop = log.scrollHeight;
}

/* ═══════════════════════════════════════════
   SELECTION
   ═══════════════════════════════════════════ */

function selectPipeline(id) {
  if (id === undefined || id === null) return;
  state.selected = { kind: 'pipeline', id: String(id) };
  renderOpportunities();
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
    jdInput.dataset.sourceKind = 'hydrated-context';
    jdInput.dataset.inputTrust = 'untrusted-context';
  }
  if ($('#evaluate-form')) $('#evaluate-form').dataset.contextKey = key;
}

function hydrateAssistantsFromSelection(kind = null, mode = null) {
  const form = $('#module-form');
  if (!form) return;
  const ctx = selectedContext();
  renderModuleContext(ctx);
  if (!ctx.company && !ctx.role && !ctx.url && !ctx.reportId) return;
  const key = contextKey(ctx);
  const changed = form.dataset.contextKey !== key;
  if (kind) form.elements.kind.value = kind;
  if (mode && form.elements.mode) form.elements.mode.value = mode;
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
  renderModuleContext(ctx);
}

function renderModuleContext(ctx = selectedContext()) {
  const box = $('#module-context');
  if (!box) return;
  const hasContext = Boolean(ctx.company || ctx.role || ctx.url || ctx.reportId);
  box.classList.toggle('hidden', !hasContext);
  if (!hasContext) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = `
    <div>
      <strong>${escapeHtml([ctx.company, ctx.role].filter(Boolean).join(' - ') || 'Contexto seleccionado')}</strong>
      <span>${escapeHtml([ctx.reportId ? `Report ${ctx.reportId}` : '', ctx.url || ''].filter(Boolean).join(' · '))}</span>
    </div>
    <button class="ghost-btn" type="button" data-clear-module-context>Limpiar contexto</button>
  `;
}

function clearModuleContext() {
  state.selected = { kind: 'dossier', id: null };
  const form = $('#module-form');
  if (form) {
    form.dataset.contextKey = '';
    ['company', 'role', 'url', 'formUrl', 'contactUrl', 'notes'].forEach(name => {
      if (form.elements[name]) form.elements[name].value = '';
    });
  }
  renderModuleContext({});
  notify('Contexto del Dossier limpiado');
}

/* ═══════════════════════════════════════════
   REPORT VIEWER
   ═══════════════════════════════════════════ */

function renderReportViewer(report) {
  const sections = report.sections || {};
  const blocks = [
    ['Resumen', sections.roleSummary || report.tldr],
    ['Match', sections.match],
    ['Estrategia', sections.strategy],
    ['Compensación', sections.comp],
    ['CV / LinkedIn', sections.customization],
    ['Entrevista', sections.interview],
    ['Legitimidad', sections.legitimacy],
  ].filter(([, content]) => content);
  $('#report-viewer').innerHTML = `
    <header class="report-hero">
      <div>
        <p class="eyebrow">${escapeHtml(report.company || 'Informe')}</p>
        <h2>${escapeHtml(report.role || report.title)}</h2>
        <p>${escapeHtml(report.tldr || 'Sin TL;DR extraído.')}</p>
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

/* ═══════════════════════════════════════════
   DETAIL PANEL
   ═══════════════════════════════════════════ */

function renderDetail() {
  const box = $('#detail-panel');
  if (state.selected.kind === 'pipeline') return renderPipelineDetail(box);
  if (state.selected.kind === 'app') return renderApplicationDetail(box);
  if (state.selected.kind === 'report') return renderReportDetail(box);
  box.innerHTML = `
    <p class="eyebrow">Centro de decisiones</p>
    <h2>Decisión primero</h2>
    <p class="muted">Selecciona una oferta, una aplicación o un informe para ver acciones contextuales.</p>
    <div class="detail-stat"><strong>${state.pipeline.filter(i => !i.done).length}</strong><span>pendientes en oportunidades</span></div>
    <div class="detail-stat"><strong>${state.applications.filter(a => a.score >= 4 && a.status === 'Evaluated').length}</strong><span>alta prioridad pendientes de decidir</span></div>
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
    <p class="eyebrow">Oportunidad</p>
    <h2>${escapeHtml(item.company || item.sourceHost || 'Oferta')}</h2>
    <p>${escapeHtml(item.role || item.url)}</p>
    <dl class="detail-list">
      <dt>URL</dt><dd><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.sourceHost || item.url)}</a></dd>
      <dt>Estado</dt><dd>${item.done ? 'Marcada como hecha' : 'Pendiente'}</dd>
      <dt>Señales</dt><dd>${[
        item.duplicateCandidate ? 'posible duplicada' : '',
        item.evaluatedCandidate ? 'ya evaluada' : '',
        live ? `liveness: ${live.result}` : '',
      ].filter(Boolean).join(' · ') || 'sin alertas'}</dd>
    </dl>
    ${renderOpportunityConsole(item, live)}
    <div class="detail-actions">
      <button class="primary-btn" data-evaluate-pipeline="${item.id}">Evaluar</button>
      <button class="ghost-btn" data-liveness-pipeline="${item.id}">Verificar activa</button>
      <button class="ghost-btn" data-toggle-pipeline="${item.id}">${item.done ? 'Reabrir' : 'Marcar hecha'}</button>
      <button class="danger-btn" data-delete-pipeline="${item.id}">Eliminar</button>
    </div>
  `;
}

function renderOpportunityConsole(item = {}, live = null) {
  const verifiedLive = live?.result === 'active';
  const blocked = item.done || item.duplicateCandidate || item.evaluatedCandidate || live?.result === 'expired';
  const recommendation = blocked ? 'Revisar' : (verifiedLive ? 'Evaluar' : 'Verificar');
  const text = blocked
    ? 'Hay una señal que conviene resolver antes de invertir tiempo en materiales.'
    : verifiedLive
      ? 'La oferta parece activa. El siguiente paso de mayor valor es calcular score, legitimidad y decisión.'
      : 'Primero confirma que la oferta sigue viva; después evalúa y prepara materiales solo si merece la pena.';
  const readiness = [
    { label: 'Oferta localizada', ok: Boolean(item.url), detail: item.url || 'Falta URL' },
    { label: 'Vigencia verificada', ok: verifiedLive, detail: live ? `Resultado: ${live.result}` : 'Pendiente de verificación con Playwright' },
    { label: 'Sin duplicados', ok: !item.duplicateCandidate && !item.evaluatedCandidate, detail: item.evaluatedCandidate ? 'Parece ya evaluada' : item.duplicateCandidate ? 'Posible duplicada' : 'Sin alerta de duplicado' },
    { label: 'Score calculado', ok: false, detail: 'Pendiente de Evaluación 360' },
    { label: 'Revisión humana', ok: false, detail: 'Pendiente antes de enviar o aplicar' },
  ];
  return `
    <section class="application-console opportunity-console">
      <div class="console-head">
        <span class="action-kicker">${recommendation}</span>
        <h3>Decisión de oportunidad</h3>
        <p>${escapeHtml(text)}</p>
      </div>
      ${renderReadinessList(readiness)}
      <div class="console-actions">
        <button class="primary-btn" data-evaluate-pipeline="${item.id}">Evaluar oferta</button>
        <button class="ghost-btn" data-liveness-pipeline="${item.id}">Verificar activa</button>
        <button class="ghost-btn" data-open-assistant="form-reader" data-assistant-mode="draft">Buscar formulario</button>
        <button class="ghost-btn" data-open-assistant="apply-assistant" data-assistant-mode="draft">Preparar respuestas</button>
      </div>
      <p class="console-guardrail">Primero se decide si merece la pena. Career-Ops puede preparar y rellenar campos seguros, pero siempre se detiene antes del envío final.</p>
    </section>
  `;
}

function consoleItem(item = {}) {
  const reportId = item.reportPath ? item.reportPath.split('/').pop().replace(/\.md$/, '') : item.id;
  const report = reportId ? state.reports.find(row => row.id === reportId) : null;
  const key = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const itemCompany = key(item.company || report?.company);
  const itemRole = key(item.role || report?.role);
  const pipelineHit = state.pipeline.find(row => {
    const company = key(row.company);
    const role = key(row.role);
    if (!row.url) return false;
    if (itemCompany) return company && (company.includes(itemCompany) || itemCompany.includes(company));
    return itemRole && role && (role.includes(itemRole) || itemRole.includes(role));
  });
  return {
    ...(report || {}),
    ...item,
    url: item.jobUrl || item.url || report?.url || pipelineHit?.url || '',
    path: item.reportPath || item.path || report?.path || '',
    pdf: item.pdfPath || item.pdf || report?.pdf || '',
  };
}

function recommendationFor(item = {}) {
  item = consoleItem(item);
  const score = typeof item.score === 'number' ? item.score : Number.parseFloat(item.scoreRaw || '');
  if (item.status === 'Applied') return { label: 'Seguimiento', text: 'Ya aplicada. Revisa cadencia, respuesta y siguiente seguimiento.' };
  if (['Responded', 'Interview', 'Offer'].includes(item.status)) return { label: 'Preparar', text: 'Proceso activo. Prioriza preparación, dossier y respuestas.' };
  if (['Discarded', 'SKIP', 'Rejected'].includes(item.status)) return { label: 'Aprender', text: 'Captura aprendizaje si hubo feedback o una decisión clara.' };
  if (Number.isFinite(score) && score < 4) return { label: 'Descartar', text: 'Score bajo: recomienda descartar salvo razón estratégica fuerte.' };
  if (Number.isFinite(score) && score >= 4) return { label: item.reportPath || item.path ? 'Candidatura asistida' : 'Aplicar', text: 'Fit alto. Prepara materiales y revisa antes de aplicar.' };
  return { label: 'Revisar', text: 'Falta evidencia para recomendar aplicación o descarte.' };
}

function readinessItems(item = {}) {
  item = consoleItem(item);
  const score = typeof item.score === 'number' ? item.score : Number.parseFloat(item.scoreRaw || '');
  return [
    { label: 'Oferta localizada', ok: Boolean(item.url), detail: item.url ? 'URL disponible; se intentará detectar formulario automáticamente' : 'Falta URL de oferta o formulario' },
    { label: 'Score calculado', ok: Number.isFinite(score), detail: item.scoreRaw || 'Pendiente de evaluación' },
    { label: 'Informe generado', ok: Boolean(item.reportPath || item.path), detail: item.reportPath || item.path || 'Genera o abre informe' },
    { label: 'PDF listo', ok: Boolean(item.pdfPath || item.pdf), detail: item.pdfPath || item.pdf ? 'Artefacto disponible' : 'Puede generarse desde Evaluación 360' },
    { label: 'Revisión humana', ok: false, detail: 'Pendiente antes de enviar o aplicar' },
  ];
}

function renderReadinessList(items) {
  return `
    <div class="readiness-list">
      ${items.map(item => `
        <div class="readiness-item ${item.ok ? 'ok' : 'pending'}">
          <span>${item.ok ? 'OK' : 'PEND'}</span>
          <strong>${escapeHtml(item.label)}</strong>
          <em>${escapeHtml(item.detail)}</em>
        </div>
      `).join('')}
    </div>
  `;
}

function renderApplicationConsole(item = {}) {
  item = consoleItem(item);
  const recommendation = recommendationFor(item);
  return `
    <section class="application-console">
      <div class="console-head">
        <span class="action-kicker">${escapeHtml(recommendation.label)}</span>
        <h3>Consola de candidatura</h3>
        <p>${escapeHtml(recommendation.text)}</p>
      </div>
      ${renderReadinessList(readinessItems(item))}
      <div class="console-actions">
        <button class="primary-btn" data-open-assistant="form-reader" data-assistant-mode="draft">Buscar formulario</button>
        <button class="primary-btn" data-open-assistant="apply-assistant" data-assistant-mode="draft">Borrador respuestas</button>
        <button class="ghost-btn" data-open-assistant="apply-assistant" data-assistant-mode="assisted">Subagente / formulario</button>
        <button class="ghost-btn" data-open-assistant="deep-research" data-assistant-mode="draft">Dossier empresa</button>
        <button class="ghost-btn" data-open-assistant="interview-prep" data-assistant-mode="draft">Entrevista</button>
      </div>
      <div class="feedback-actions" aria-label="Aprendizaje rápido">
        <button class="ghost-btn" data-learning-template="score_too_high">Score demasiado alto</button>
        <button class="ghost-btn" data-learning-template="would_not_apply">No aplicaría</button>
        <button class="ghost-btn" data-learning-template="missed_experience">Faltó experiencia</button>
        <button class="ghost-btn" data-learning-template="voice_mismatch">No suena a mi</button>
      </div>
      <p class="console-guardrail">Career-Ops prepara respuestas con tu voz personal calibrada y puede buscar formularios desde la URL de la oferta. El envío final siempre queda en tus manos.</p>
    </section>
  `;
}

function renderOutcomeJournal(app = {}) {
  const recent = (state.applicationEvents || [])
    .filter(event => Number(event.application) === Number(app.number))
    .slice(0, 3);
  return `
    <section class="outcome-journal">
      <div class="console-head">
        <span class="action-kicker">Post-candidatura</span>
        <h3>Registrar decisión o resultado</h3>
        <p>Guarda solo lo que hayas confirmado: envío real, rechazo, entrevista, descarte, notas y próximo paso.</p>
      </div>
      <form class="outcome-form" data-outcome-form="${app.number}">
        <div class="outcome-grid">
          <label class="field-label">Estado
            <select name="status">
              ${state.states.map(s => `<option value="${escapeHtml(s.label)}" ${s.label === app.status ? 'selected' : ''}>${escapeHtml(statusLabels[s.label] || s.label)}</option>`).join('')}
            </select>
          </label>
          <label class="field-label">Resultado
            <select name="outcome">
              <option value="applied">Aplicación enviada</option>
              <option value="discarded">Descartada por candidato</option>
              <option value="rejected">Rechazo recibido</option>
              <option value="interview">Entrevista agendada</option>
              <option value="follow_up">Seguimiento preparado</option>
              <option value="note">Nota de decisión</option>
            </select>
          </label>
          <label class="field-label">Follow-up
            <input name="followUpDate" type="date">
          </label>
        </div>
        <textarea name="finalAnswers" rows="4" placeholder="Respuestas finales enviadas o notas del formulario. No pegues datos sensibles innecesarios."></textarea>
        <textarea name="notes" rows="3" placeholder="Qué pasó, por qué se tomó la decisión y qué debe aprender Career-Ops"></textarea>
        <div class="scan-command-row">
          <input name="nextAction" placeholder="Siguiente acción: seguimiento, preparar entrevista, esperar respuesta...">
          <button class="primary-btn">Guardar resultado</button>
        </div>
      </form>
      <div class="event-list">
        ${recent.map(event => `
          <div class="event-item">
            <strong>${escapeHtml(event.date)} - ${escapeHtml(event.outcome || event.status || 'evento')}</strong>
            <span>${escapeHtml([event.status, event.nextAction, event.followUpDate].filter(Boolean).join(' - '))}</span>
            ${event.notes ? `<em>${escapeHtml(event.notes)}</em>` : ''}
          </div>
        `).join('') || '<div class="empty">Sin resultados registrados todavía.</div>'}
      </div>
      <p class="console-guardrail">Este registro no envia nada. Solo actualiza tu tracker y escribe en <code>data/application-events.md</code>.</p>
    </section>
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
      <span>${app.score < 4 ? 'Recomendación: no aplicar salvo razón fuerte.' : 'Lista para decisión humana.'}</span>
    </div>
    <dl class="detail-list">
      <dt>Estado</dt><dd>${escapeHtml(statusLabels[app.status] || app.status)}</dd>
      <dt>Legitimidad</dt><dd>${escapeHtml(app.legitimacy || 'No extraída')}</dd>
      <dt>Notas</dt><dd>${escapeHtml(app.notes || 'Sin notas')}</dd>
    </dl>
    ${renderApplicationConsole(app)}
    ${renderOutcomeJournal(app)}
    <label class="field-label">Cambiar estado</label>
    <select data-status-detail="${app.number}" aria-label="Cambiar estado de ${escapeHtml(app.company)} ${escapeHtml(app.role)}">
      ${state.states.map(s => `<option value="${escapeHtml(s.label)}" ${s.label === app.status ? 'selected' : ''}>${escapeHtml(statusLabels[s.label] || s.label)}</option>`).join('')}
    </select>
    <div class="detail-actions">
      ${app.reportPath ? `<button class="primary-btn" data-open-report-path="${escapeHtml(app.reportPath)}">Ver informe</button>` : ''}
      <button class="ghost-btn" data-open-assistant="apply-assistant">Aplicar asistido</button>
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
      <span>${escapeHtml(report.legitimacy || 'Legitimidad no extraída')}</span>
    </div>
    <dl class="detail-list">
      <dt>Fecha</dt><dd>${escapeHtml(report.date || 'n/a')}</dd>
      <dt>Arquetipo</dt><dd>${escapeHtml(report.archetype || 'n/a')}</dd>
      <dt>Archivo</dt><dd>${escapeHtml(report.path)}</dd>
    </dl>
    ${renderApplicationConsole(report)}
    <div class="detail-actions">
      <button class="primary-btn" data-report-pdf="${escapeHtml(report.path)}">Generar PDF</button>
      <button class="ghost-btn" data-open-assistant="apply-assistant">Aplicar asistido</button>
      <button class="ghost-btn" data-open-assistant="deep-research">Investigación</button>
      <button class="ghost-btn" data-open-assistant="interview-prep">Entrevista</button>
      ${report.url ? `<a class="ghost-btn" href="${escapeHtml(report.url)}" target="_blank" rel="noreferrer">Oferta</a>` : ''}
      <button class="ghost-btn" data-learning-report="${escapeHtml(report.id)}">Guardar aprendizaje</button>
    </div>
  `;
}

/* ═══════════════════════════════════════════
   EDITOR (Profile view)
   ═══════════════════════════════════════════ */

async function loadEditor() {
  const [profile, cv, personalization, scannerStrategy] = await Promise.all([
    api('/api/profile'),
    api('/api/cv'),
    api('/api/personalization'),
    api('/api/scanner/strategy'),
  ]);
  state.editorData = {
    profile: profile.content,
    cv: cv.content,
    profileMode: personalization.profileMode,
    articleDigest: personalization.articleDigest,
  };
  state.scannerStrategy = scannerStrategy;
  $('#editor').value = state.editorData[state.editorKey] || '';
  renderScannerStrategy();
}

async function saveEditor() {
  const value = $('#editor').value;
  const fileByKey = {
    profile: 'config/profile.yml',
    cv: 'cv.md',
    profileMode: 'modes/_profile.md',
    articleDigest: 'article-digest.md',
  };
  const previous = state.editorData[state.editorKey] || '';
  if (!confirmMutation({
    title: 'Guardar cambios del User Layer.',
    files: [fileByKey[state.editorKey] || 'modes/_profile.md / article-digest.md'],
    detail: summarizeTextDiff(previous, value),
  })) return;
  state.editorData[state.editorKey] = value;
  if (state.editorKey === 'profile') await api('/api/profile', { method: 'PUT', body: { content: value } });
  else if (state.editorKey === 'cv') await api('/api/cv', { method: 'PUT', body: { content: value } });
  else await api('/api/personalization', { method: 'PUT', body: state.editorData });
  $('#editor-status').textContent = `Guardado a las ${new Date().toLocaleTimeString()}`;
  notify('Cambios guardados en User Layer');
}

/* ═══════════════════════════════════════════
   INSIGHTS (Profile → Resumen tab)
   ═══════════════════════════════════════════ */

function listToText(list = []) {
  return (list || []).join('\n');
}

function renderScannerStrategy() {
  const strategy = state.scannerStrategy;
  const form = $('#scanner-strategy-form');
  if (!strategy || !form) return;
  form.elements.positive.value = listToText(strategy.titleFilter?.positive);
  form.elements.negative.value = listToText(strategy.titleFilter?.negative);
  form.elements.allowLocations.value = listToText(strategy.locationFilter?.allow);
  form.elements.blockLocations.value = listToText(strategy.locationFilter?.block);
  const summary = strategy.summary || {};
  $('#scanner-strategy-summary').innerHTML = [
    ['Empresas activas', `${summary.enabledCompanies || 0}/${summary.companies || 0}`],
    ['Palabras clave', summary.positiveKeywords || 0],
    ['Bloqueos', summary.negativeKeywords || 0],
    ['Ubicaciones', `${summary.allowedLocations || 0}/${summary.blockedLocations || 0}`],
  ].map(([label, value]) => `<span><strong>${escapeHtml(value)}</strong>${escapeHtml(label)}</span>`).join('');
  $('#scanner-companies').innerHTML = (strategy.companies || []).map(company => `
    <label class="scanner-company">
      <input type="checkbox" name="enabledCompany" value="${escapeHtml(company.name)}" ${company.enabled ? 'checked' : ''}>
      <span>
        <strong>${escapeHtml(company.name)}</strong>
        <small>${escapeHtml([company.provider || company.scanMethod, company.careersUrl ? 'careers' : '', company.api ? 'api' : ''].filter(Boolean).join(' · ') || 'sin proveedor visible')}</small>
      </span>
    </label>
  `).join('');
}

async function saveScannerStrategy(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const enabledCompanies = {};
  $$('input[name="enabledCompany"]', form).forEach(input => { enabledCompanies[input.value] = input.checked; });
  const strategy = state.scannerStrategy || {};
  const currentCompanies = Object.fromEntries((strategy.companies || []).map(company => [company.name, Boolean(company.enabled)]));
  const toggledCompanies = Object.entries(enabledCompanies)
    .filter(([name, enabled]) => currentCompanies[name] !== enabled)
    .map(([name, enabled]) => `${enabled ? '+' : '-'} ${name}`);
  const detail = [
    'Vista previa de cambios:',
    summarizeListChange('Keywords objetivo', strategy.titleFilter?.positive, form.elements.positive.value),
    summarizeListChange('Keywords bloqueadas', strategy.titleFilter?.negative, form.elements.negative.value),
    summarizeListChange('Ubicaciones permitidas', strategy.locationFilter?.allow, form.elements.allowLocations.value),
    summarizeListChange('Ubicaciones bloqueadas', strategy.locationFilter?.block, form.elements.blockLocations.value),
    `Empresas cambiadas: ${toggledCompanies.length}`,
    ...toggledCompanies.slice(0, 6).map(item => `- ${item}`),
  ].join('\n');
  if (!confirmMutation({
    title: 'Guardar estrategia de escaneo.',
    files: ['portals.yml'],
    detail,
  })) return;
  state.scannerStrategy = await api('/api/scanner/strategy', {
    method: 'PUT',
    body: {
      positive: form.elements.positive.value,
      negative: form.elements.negative.value,
      allowLocations: form.elements.allowLocations.value,
      blockLocations: form.elements.blockLocations.value,
      enabledCompanies,
    },
  });
  state.scanner = await api('/api/scanner/discovery');
  renderScannerStrategy();
  renderOpportunities();
  notify('Estrategia de escaneo guardada en portals.yml');
}

async function reloadScannerStrategy() {
  state.scannerStrategy = await api('/api/scanner/strategy');
  renderScannerStrategy();
  notify('Estrategia de escaneo recargada');
}
async function loadInsights() {
  const [followups, patterns] = await Promise.all([api('/api/followups'), api('/api/patterns')]);
  state.followups = followups;
  state.patterns = patterns;
  renderInsights();
  renderFollowupSummary();
}

function renderInsights() {
  renderFollowupsInsight();
  renderPatternsInsight();
}

function renderFollowupsInsight() {
  const container = $('#followups-render');
  if (!container) return;
  const data = state.followups?.data || state.followups;
  if (!data) {
    container.innerHTML = '<div class="empty">Pulsa Recargar para obtener datos de seguimientos.</div>';
    return;
  }
  const items = extractFollowupItems(data);
  if (!items.length) {
    container.innerHTML = '<div class="empty">Sin seguimientos pendientes.</div>';
    return;
  }
  container.innerHTML = items.map(renderFollowupItem).join('');
}

function renderPatternsInsight() {
  const container = $('#patterns-render');
  if (!container) return;
  const data = state.patterns?.data || state.patterns;
  if (!data) {
    container.innerHTML = '<div class="empty">Pulsa Recargar para obtener datos de patrones.</div>';
    return;
  }

  const cards = [];

  // Top archetypes
  const archetypes = data.topArchetypes || data.top_archetypes || [];
  if (archetypes.length) {
    cards.push(`
      <div class="insight-item">
        <span class="insight-icon">◆</span>
        <div class="insight-body">
          <span class="insight-title">Arquetipos más frecuentes</span>
          <span class="insight-meta">${archetypes.map(a => escapeHtml(typeof a === 'string' ? a : `${a.name || a.archetype} (${a.count || a.percentage || ''})`)).join(' · ')}</span>
        </div>
      </div>
    `);
  }

  // Score distribution
  const scores = data.scoreDistribution || data.score_distribution || {};
  const scoreEntries = Object.entries(scores);
  if (scoreEntries.length) {
    cards.push(`
      <div class="insight-item">
        <span class="insight-icon">▦</span>
        <div class="insight-body">
          <span class="insight-title">Distribución de scores</span>
          <span class="insight-meta">${scoreEntries.map(([k, v]) => `${escapeHtml(k)}: ${v}`).join(' · ')}</span>
        </div>
      </div>
    `);
  }

  // Status distribution
  const statuses = data.statusDistribution || data.status_distribution || {};
  const statusEntries = Object.entries(statuses);
  if (statusEntries.length) {
    cards.push(`
      <div class="insight-item">
        <span class="insight-icon">◉</span>
        <div class="insight-body">
          <span class="insight-title">Distribución de estados</span>
          <span class="insight-meta">${statusEntries.map(([k, v]) => `${escapeHtml(statusLabels[k] || k)}: ${v}`).join(' · ')}</span>
        </div>
      </div>
    `);
  }

  // Rejection reasons
  const rejections = data.rejectionReasons || data.rejection_reasons || [];
  if (rejections.length) {
    cards.push(`
      <div class="insight-item">
        <span class="insight-icon">✕</span>
        <div class="insight-body">
          <span class="insight-title">Razones de rechazo</span>
          <span class="insight-meta">${rejections.map(r => escapeHtml(typeof r === 'string' ? r : `${r.reason || r.name} (${r.count || ''})`)).join(' · ')}</span>
        </div>
      </div>
    `);
  }

  // Fallback: if no structured data was found, show raw summary
  if (!cards.length) {
    const raw = JSON.stringify(data, null, 2).slice(0, 800);
    cards.push(`
      <div class="insight-item">
        <span class="insight-icon">◇</span>
        <div class="insight-body">
          <span class="insight-title">Datos sin procesar</span>
          <span class="insight-meta" style="white-space: pre-wrap; font-family: var(--font-mono); font-size: 12px;">${escapeHtml(raw)}</span>
        </div>
      </div>
    `);
  }

  container.innerHTML = cards.join('');
}

/* ═══════════════════════════════════════════
   STREAMING / TRABAJOS
   ═══════════════════════════════════════════ */

function streamJob(jobId, target) {
  const log = $(target);
  const rawLines = [];
  log.textContent = `[trabajo] ${jobId}\n`;
  const source = new EventSource(`/api/jobs/${jobId}/events`);
  source.onmessage = event => {
    const item = JSON.parse(event.data);
    rawLines.push(`[${item.type}] ${item.line}`);
    const stepEvent = normalizeStepEvent(item);

    if (stepEvent) {
      updateProgressStep(stepEvent.step, stepEvent.status);
    }

    log.textContent += `[${item.type}] ${item.line}\n`;
    log.scrollTop = log.scrollHeight;
    if (['done', 'completed', 'error'].includes(item.type)) {
      source.close();
      if (target === '#scan-log') renderScanJobSummary(log, rawLines.join('\n'));
      notify(item.type === 'error' ? 'Trabajo finalizado con error' : 'Trabajo completado', item.type === 'error' ? 'error' : 'ok');
      loadAll().catch(console.error);
    }
  };
  source.onerror = () => {
    source.close();
    notify('Conexión de eventos cerrada', 'warn');
  };
}

function parseScanMetric(raw, label) {
  const match = raw.match(new RegExp(`${label}:\\s+([0-9]+)`, 'i'));
  return match ? Number(match[1]) : null;
}

function renderScanJobSummary(container, raw) {
  const metrics = [
    ['Empresas', parseScanMetric(raw, 'Companies scanned')],
    ['Encontradas', parseScanMetric(raw, 'Total jobs found')],
    ['Filtro título', parseScanMetric(raw, 'Filtered by title')],
    ['Filtro ubicación', parseScanMetric(raw, 'Filtered by location')],
    ['Duplicadas', parseScanMetric(raw, 'Duplicates')],
    ['Añadidas', parseScanMetric(raw, 'New offers added')],
  ].filter(([, value]) => value !== null);
  if (!metrics.length) return;
  const dryRun = /dry run/i.test(raw);
  container.innerHTML = `
    <div class="scan-summary">
      <div>
        <strong>${dryRun ? 'Escaneo simulado completado' : 'Escaneo completado'}</strong>
        <span>${dryRun ? 'No se han escrito cambios.' : 'Revisa oportunidades para las ofertas añadidas.'}</span>
      </div>
      <div class="scan-metric-grid">
        ${metrics.map(([label, value]) => `
          <span><strong>${value}</strong>${escapeHtml(label)}</span>
        `).join('')}
      </div>
      <details>
        <summary>Log técnico</summary>
        <pre>${escapeHtml(raw)}</pre>
      </details>
    </div>
  `;
}

function normalizeStepEvent(item) {
  let payload = item;
  if (!payload.step && item.type === 'artifact') {
    try {
      payload = { ...item, ...JSON.parse(item.line) };
    } catch {
      payload = item;
    }
  }
  if (!payload.step) return null;
  const status = payload.status
    || (item.type === 'error' ? 'failed' : (item.type === 'done' || item.type === 'completed' ? 'completed' : 'running'));
  return { step: payload.step, status };
}

function streamReturnedJob(result, target) {
  if (!result?.jobId) return false;
  streamJob(result.jobId, target);
  return true;
}

function updateProgressStep(stepId, status) {
  const item = $(`#pipeline-progress li[data-step="${stepId}"]`);
  if (!item) return;
  // Mark previous steps as completed if they're still pending
  const allSteps = $$('#pipeline-progress li');
  let found = false;
  for (const step of allSteps) {
    if (step === item) { found = true; break; }
    if (step.dataset.status === 'pending' || step.dataset.status === 'running') {
      step.dataset.status = 'completed';
    }
  }
  item.dataset.status = status;
}

function resetProgressChecklist() {
  $$('#pipeline-progress li').forEach(li => { li.dataset.status = 'pending'; });
}

function evaluatePayload(form) {
  const body = Object.fromEntries(new FormData(form));
  const jdInput = form.elements.jdText;
  body.sourceKind = jdInput?.dataset.sourceKind || (String(body.jdText || '').trim() ? 'manual-jd' : 'extracted-url');
  body.inputTrust = jdInput?.dataset.inputTrust || (String(body.jdText || '').trim() ? 'trusted-manual' : 'trusted-playwright');
  return body;
}

function evaluateInputPreview(body) {
  const url = String(body.url || '').trim();
  const jdText = String(body.jdText || '').trim();
  const title = String(body.title || '').trim();
  const lines = ['Validación de input', 'No se escribieron archivos.'];

  if (!url && !jdText) {
    return `${lines.join('\n')}\n\nEstado: no listo.\nFalta una URL pública o una descripción completa de la oferta.`;
  }

  if ((body.sourceKind === 'hydrated-context' || body.inputTrust === 'untrusted-context') && !url) {
    return `${lines.join('\n')}\n\nEstado: bloqueado.\nEl texto procede del contexto seleccionado, no de una oferta completa. Pega una JD real o usa una URL pública.`;
  }

  if (!url && jdText.length < 500 && !body.mock) {
    return `${lines.join('\n')}\n\nEstado: revisar antes de guardar.\nLa descripción parece corta (${jdText.length} caracteres). Puedes evaluarla, pero el flujo completo exigirá confirmación y puede ser demasiado poco fiable.`;
  }

  return [
    ...lines,
    '',
    'Estado: listo para evaluar.',
    `Fuente: ${url ? 'URL pública o verificable' : 'JD pegada manualmente'}.`,
    'Persistencia: solo el botón "Flujo completo" puede guardar, y pedirá confirmación.',
    title ? `Etiqueta: ${title}.` : 'Etiqueta: sin etiqueta corta.',
  ].join('\n');
}

/* ═══════════════════════════════════════════
   CV / ARTIFACTS
   ═══════════════════════════════════════════ */

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
      <span>palabras clave cubiertas en cv.md</span>
    </div>
    <div class="keyword-list">
      ${rows.map(row => `<span class="${row.inCv ? 'covered' : 'missing'}">${escapeHtml(row.word)}</span>`).join('') || '<span class="muted">Genera un CV para ver palabras clave.</span>'}
    </div>
  `;
}

/* ═══════════════════════════════════════════
   ASSISTANT (Dossier)
   ═══════════════════════════════════════════ */

function openAssistant(kind, mode = null) {
  setView('dossier');
  hydrateAssistantsFromSelection(kind, mode);
  $('#module-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  notify('Asistente preparado con la oferta seleccionada');
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
  const formUrl = data.formUrl || (data.kind === 'form-reader' ? (data.url || ctx.url) : '');
  return {
    kind: data.kind,
    company: data.company || ctx.company,
    role: data.role || ctx.role,
    mode,
    assisted: mode === 'assisted',
    url: data.url || ctx.url,
    formUrl,
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

function moduleResultData(result = {}) {
  return result.result || result;
}

function renderFillPlanPanel(result = {}) {
  const data = moduleResultData(result);
  const plan = data.fillPlan;
  if (!plan) return '';
  const counts = [
    { key: 'safePrefill', label: 'Prefill seguro', value: plan.safePrefill || 0 },
    { key: 'draftForReview', label: 'Borrador a revisar', value: plan.draftForReview || 0 },
    { key: 'reviewRequired', label: 'Sensible', value: plan.reviewRequired || 0 },
    { key: 'manualChoice', label: 'Elección manual', value: plan.manualChoice || 0 },
    { key: 'manualUpload', label: 'Subida manual', value: plan.manualUpload || 0 },
  ];
  const fields = Array.isArray(data.fields) ? data.fields : [];
  const submitControls = Array.isArray(data.submitControls) ? data.submitControls : [];
  const filters = [
    { key: 'all', label: 'Todos' },
    { key: 'safe', label: 'Seguros' },
    { key: 'draft', label: 'Borradores' },
    { key: 'sensitive', label: 'Sensibles' },
    { key: 'upload', label: 'Subidas' },
  ];
  return `
    <section class="fill-plan-panel" aria-label="Plan de rellenado seguro">
      <div class="fill-plan-head">
        <span class="action-kicker">Plan de rellenado seguro</span>
        <h3>Qué puede hacer Career-Ops con este formulario</h3>
        <p>Puede preparar campos de bajo riesgo. Cualquier envío, dato sensible o selección ambigua queda para revisión humana.</p>
      </div>
      ${submitControls.length ? `<div class="submit-alert"><strong>Controles de envío detectados</strong><span>${escapeHtml(submitControls.map(item => item.label || item.text || item.type || 'submit').join(', '))}</span></div>` : ''}
      <div class="fill-plan-grid">
        ${counts.map(item => `
          <div class="fill-plan-stat ${item.key}">
            <strong>${item.value}</strong>
            <span>${escapeHtml(item.label)}</span>
          </div>
        `).join('')}
      </div>
      ${fields.length ? `
        <div class="fill-filter-row" role="group" aria-label="Filtrar campos del formulario">
          ${filters.map((filter, index) => `<button class="ghost-btn ${index === 0 ? 'active' : ''}" type="button" data-fill-filter="${filter.key}">${filter.label}</button>`).join('')}
        </div>
        <div class="fill-field-list">
          ${fields.map(field => `
            <div class="fill-field-row ${escapeHtml(field.risk || 'medium')}" data-fill-kind="${escapeHtml(fillFieldKind(field))}">
              <span>${escapeHtml(field.fillSafe ? 'SEGURO' : field.risk === 'sensitive' ? 'REVISAR' : field.action === 'draft_for_review' ? 'BORRADOR' : 'MANUAL')}</span>
              <strong>${escapeHtml(field.label || field.name || field.type || 'Campo')}</strong>
              <em>${escapeHtml(field.fillReason || field.action || 'Pendiente de clasificar')}</em>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <div class="fill-plan-actions">
        <button class="primary-btn" data-form-reader-to-apply>Preparar respuestas con este contexto</button>
        ${data.discoveredFormUrl ? `<a class="ghost-btn" href="${escapeHtml(data.discoveredFormUrl)}" target="_blank" rel="noreferrer">Abrir formulario detectado</a>` : ''}
      </div>
    </section>
  `;
}

function fillFieldKind(field = {}) {
  if (field.fillSafe) return 'safe';
  if (field.risk === 'sensitive') return 'sensitive';
  if (field.action === 'manual_upload') return 'upload';
  if (field.action === 'draft_for_review') return 'draft';
  return 'manual';
}

function continueFromFormReader() {
  const form = $('#module-form');
  const data = moduleResultData(state.lastModuleResult || {});
  if (!form) return;
  form.elements.kind.value = 'apply-assistant';
  form.elements.mode.value = 'draft';
  if (data.discoveredFormUrl && form.elements.formUrl) form.elements.formUrl.value = data.discoveredFormUrl;
  const fieldNotes = Array.isArray(data.fields)
    ? data.fields.map(field => `- ${field.label || field.name || field.type}: ${field.action || 'draft_for_review'} (${field.risk || 'medium'})`).join('\n')
    : '';
  if (form.elements.notes && fieldNotes) {
    const existing = form.elements.notes.value.trim();
    form.elements.notes.value = [existing, 'Campos detectados para preparar respuestas:', fieldNotes].filter(Boolean).join('\n\n');
  }
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  notify('Asistente de candidatura preparado con el formulario detectado');
}

function renderModuleResult(result) {
  if (result.markdown) return result.markdown;
  if (result.result?.markdown) return result.result.markdown;
  if (result.result?.message) return result.result.message;
  return JSON.stringify(result.result ?? result, null, 2);
}

function renderAssistantOutput(result, requestId = state.currentModuleRequestId, meta = {}) {
  if (requestId !== state.currentModuleRequestId) return;
  const box = $('#module-output');
  const text = renderModuleResult(result);
  state.lastModuleResult = result;
  box.classList.remove('job-log', 'running');
  box.innerHTML = `
    <div class="assistant-output-head">
      <strong>${escapeHtml(moduleLabels[meta.kind] || 'Resultado del asistente')}</strong>
      <span>${escapeHtml([meta.company, meta.role].filter(Boolean).join(' - ') || 'Revisa antes de copiar, enviar o aplicar')}</span>
    </div>
    ${renderFillPlanPanel(result)}
    <div class="assistant-markdown">${compactMdToHtml(text)}</div>
  `;
}

function renderAssistantLog(jobId, requestId = state.currentModuleRequestId, meta = {}) {
  const box = $('#module-output');
  box.dataset.requestId = String(requestId);
  box.classList.add('job-log', 'running');
  box.textContent = `[trabajo] ${jobId}\nGenerando ${moduleLabels[meta.kind] || meta.kind || 'asistente'}...\n`;
  const source = new EventSource(`/api/jobs/${jobId}/events`);
  source.onmessage = event => {
    if (requestId !== state.currentModuleRequestId) {
      source.close();
      return;
    }
    const item = JSON.parse(event.data);
    if (item.type === 'artifact') {
      try {
        const artifact = JSON.parse(item.line);
        if (artifact.result) {
          renderAssistantOutput({
            result: {
              markdown: artifact.result.markdown || artifact.result.result?.message || JSON.stringify(artifact.result, null, 2),
            },
          }, requestId, meta);
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
      notify(item.type === 'error' ? 'Trabajo finalizado con error' : 'Asistente listo', item.type === 'error' ? 'error' : 'ok');
      loadAll().catch(console.error);
    }
  };
  source.onerror = () => {
    if (requestId !== state.currentModuleRequestId) return;
    source.close();
    notify('Conexión de eventos cerrada', 'warn');
  };
}

/* ═══════════════════════════════════════════
   MUTATIONS
   ═══════════════════════════════════════════ */

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
  const before = state.pipeline.find(row => row.id === String(id));
  if (!before) return;
  if (!confirmMutation({
    title: patch.done ? 'Marcar oportunidad como hecha.' : 'Reabrir oportunidad en la cola.',
    files: ['data/pipeline.md'],
    detail: before.company || before.url,
  })) return;
  await api(`/api/pipeline/${id}`, { method: 'PATCH', body: patch });
  notify('Cola actualizada', 'ok', {
    label: 'Deshacer',
    onClick: () => restorePipelineEntry(before),
  });
  await loadAll();
}

async function deletePipeline(id) {
  const item = state.pipeline.find(row => row.id === String(id));
  if (!item || !confirmMutation({
    title: 'Eliminar oportunidad de la cola.',
    files: ['data/pipeline.md'],
    detail: item.company || item.url,
  })) return;
  await api(`/api/pipeline/${id}`, { method: 'DELETE' });
  state.selected = { kind: 'pipeline', id: null };
  notify('Entrada eliminada de oportunidades', 'ok', {
    label: 'Deshacer',
    onClick: () => reinsertPipelineEntry(item),
  });
  await loadAll();
}

async function updateStatus(number, status) {
  const app = state.applications.find(row => row.number === Number(number));
  if (!confirmMutation({
    title: `Cambiar estado a ${statusLabels[status] || status}.`,
    files: ['data/applications.md'],
    detail: app ? `#${app.number} ${app.company} - ${app.role}` : `Aplicación #${number}`,
  })) {
    renderApplications();
    renderDetail();
    return;
  }
  await api(`/api/applications/${number}/status`, { method: 'PATCH', body: { status } });
  notify('Estado actualizado', 'ok', {
    label: 'Deshacer',
    onClick: () => restoreApplicationStatus(number, app?.status),
  });
  await loadAll();
}

async function restorePipelineEntry(entry = {}) {
  if (!entry.id) return;
  await api(`/api/pipeline/${entry.id}`, {
    method: 'PATCH',
    body: {
      done: Boolean(entry.done),
      url: entry.url || '',
      company: entry.company || '',
      role: entry.role || '',
    },
  });
  notify('Cambio de cola deshecho');
  await loadAll();
  selectPipeline(entry.id);
}

async function reinsertPipelineEntry(entry = {}) {
  const result = await api('/api/pipeline', {
    method: 'POST',
    body: {
      url: entry.url || entry.raw || '',
      company: entry.company || '',
      role: entry.role || '',
    },
  });
  const restoredFromResponse = [...(result.entries || [])]
    .reverse()
    .find(row => row.url === entry.url && row.company === entry.company && row.role === entry.role);
  if (entry.done && restoredFromResponse) {
    await api(`/api/pipeline/${restoredFromResponse.id}`, { method: 'PATCH', body: { done: true } });
  }
  notify('Oportunidad restaurada en la cola');
  await loadAll();
  const restored = [...state.pipeline].reverse().find(row => row.url === entry.url && row.company === entry.company && row.role === entry.role);
  if (restored) selectPipeline(restored.id);
}

async function restoreApplicationStatus(number, status) {
  if (!status) return;
  await api(`/api/applications/${number}/status`, { method: 'PATCH', body: { status } });
  notify('Estado restaurado');
  await loadAll();
  selectApplication(number);
}

async function saveApplicationOutcome(form) {
  const number = form.dataset.outcomeForm;
  const data = Object.fromEntries(new FormData(form));
  const app = state.applications.find(row => row.number === Number(number));
  if (!confirmMutation({
    title: 'Guardar decisión o aprendizaje en journal.',
    files: ['data/application-events.md', data.status ? 'data/applications.md' : ''].filter(Boolean),
    detail: app ? `#${app.number} ${app.company} - ${app.role}` : `Aplicación #${number}`,
  })) return;
  await api(`/api/applications/${number}/outcome`, { method: 'POST', body: data });
  notify('Resultado guardado en el journal');
  await loadAll();
  selectApplication(Number(number));
}

async function verifyPipeline(id) {
  const item = state.pipeline.find(row => row.id === String(id));
  if (!item) return;
  state.liveness[id] = { result: 'verificando' };
  renderDetail();
  state.liveness[id] = await api('/api/jobs/liveness', { method: 'POST', body: { url: item.url } });
  notify(`Vigencia: ${state.liveness[id].result}`);
  renderDetail();
}

async function cancelJob(id) {
  if (!confirmMutation({
    title: 'Cancelar trabajo en curso.',
    files: [],
    detail: id,
  })) return;
  const result = await api(`/api/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
  notify(result.ok ? 'Trabajo cancelado' : 'No se pudo cancelar el trabajo', result.ok ? 'ok' : 'warn');
  await loadAll();
}

async function openLearning(payload) {
  const { proposal } = await api('/api/learning/proposal', { method: 'POST', body: payload });
  $('#learning-destination').value = proposal.destination || 'profileMode';
  $('#learning-content').value = proposal.content || '';
  $('#learning-dialog').showModal();
}

async function openLearningTemplate(template) {
  const ctx = selectedContext();
  const app = state.selected.kind === 'app' ? state.applications.find(row => row.number === state.selected.id) : null;
  const report = state.selected.kind === 'report' ? (state.loadedReport || state.reports.find(row => row.id === state.selected.id)) : null;
  const item = app || report || {};
  const copy = {
    score_too_high: {
      decision: 'score_too_high',
      reason: 'El score/recomendacion parece demasiado optimista para mi criterio real.',
      futureAdjustment: 'Exigir más evidencia antes de recomendar aplicar en ofertas parecidas.',
    },
    would_not_apply: {
      decision: 'would_not_apply',
      reason: 'Aunque pueda haber fit técnico, no aplicaría a una oferta de este tipo.',
      futureAdjustment: 'Priorizar descarte cuando aparezcan señales similares.',
    },
    missed_experience: {
      decision: 'missed_experience',
      reason: 'La evaluación no tuvo en cuenta una experiencia o prueba importante de mi perfil.',
      futureAdjustment: 'Buscar esta evidencia en cv.md, _profile.md o article-digest.md antes de puntuar.',
    },
    voice_mismatch: {
      decision: 'voice_mismatch',
      reason: 'El tono de las respuestas no suena suficientemente a mi forma natural de escribir.',
      futureAdjustment: 'Ajustar los borradores para que sean más directos, personales y menos corporativos.',
    },
  }[template] || { decision: template, reason: '', futureAdjustment: '' };
  await openLearning({
    feedbackType: template,
    company: ctx.company || item.company,
    role: ctx.role || item.role,
    score: item.scoreRaw || '',
    notes: item.notes || item.tldr || ctx.notes || '',
    ...copy,
  });
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

async function runV1Action(path, method, logSelector, body = null) {
  const log = $(logSelector);
  const upperMethod = String(method || 'GET').toUpperCase();
  if (upperMethod !== 'GET' && !confirmMutation({
    title: 'Ejecutar acción persistente del sistema.',
    files: mutationFilesForAction(path),
    detail: path.includes('/provider-test') && body?.mode === 'real'
      ? 'Puede llamar al proveedor real configurado. Se ejecuta con --no-save y no debe escribir reports ni tracker.'
      : path,
  })) return;
  log.textContent = 'Ejecutando...\n';
  try {
    const result = await api(path, { method: upperMethod, body });
    if (streamReturnedJob(result, logSelector)) {
      notify(`Trabajo iniciado: ${result.jobId}`);
      return;
    }
    renderSystemResult(log, result, { path, method: upperMethod });
    notify('Acción completada');
  } catch (err) {
    log.textContent = `[error] ${err.message}`;
    notify(err.message, 'error');
  }
}

function renderSystemResult(container, result, meta = {}) {
  const raw = result.result ?? result;
  const ok = result.ok ?? raw.ok ?? true;
  const mode = result.mode === 'preview' ? 'Vista previa' : result.mode === 'apply' ? 'Aplicado' : meta.method === 'GET' ? 'Lectura' : 'Escritura';
  const stdout = String(raw.stdout || result.stdout || '').trim();
  const stderr = String(raw.stderr || result.stderr || '').trim();
  const warnings = [
    stderr,
    ...(Array.isArray(result.warnings) ? result.warnings : []),
    ...(Array.isArray(raw.warnings) ? raw.warnings : []),
  ].filter(Boolean);
  const changes = [
    ...(Array.isArray(result.changedFiles) ? result.changedFiles : []),
    ...(Array.isArray(raw.changedFiles) ? raw.changedFiles : []),
  ];
  const facts = [];
  if ('opencode' in result) facts.push(`OpenCode: ${result.opencode ? 'listo' : 'no listo'}`);
  if ('gemini' in result) facts.push(`Gemini: ${result.gemini ? 'listo' : 'no listo'}`);
  if (meta.path?.includes('/provider-test')) facts.push(`Prueba de proveedor: ${result.mode || 'mock'}`);
  if ('noSave' in result) facts.push(result.noSave ? 'Ejecutado con --no-save.' : 'Puede escribir archivos.');
  if ('wroteFiles' in result) facts.push(result.wroteFiles ? 'Se detectaron escrituras inesperadas.' : 'No se escribieron reports ni tracker.');
  if (result.available) facts.push(`Modo activo: ${result.modesDir || 'modes'}`);
  if (changes.length) facts.push(`Archivos tocados: ${changes.join(', ')}`);
  if (!changes.length && meta.method === 'GET') facts.push('No se escribieron cambios.');
  if (stdout && facts.length < 4) facts.push(...stdout.split(/\r?\n/).filter(Boolean).slice(0, 3));

  container.innerHTML = `
    <div class="system-result ${ok ? 'ok' : 'bad'}">
      <strong>${ok ? 'Resultado correcto' : 'Resultado con errores'}</strong>
      <span>${escapeHtml(mode)} · ${escapeHtml(meta.path || '')}</span>
      ${facts.length ? `<ul>${facts.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
      ${warnings.length ? `<p class="assistant-error">${escapeHtml(warnings.join('\n'))}</p>` : ''}
      <details>
        <summary>Detalles técnicos</summary>
        <pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>
      </details>
    </div>
  `;
}

function mutationFilesForAction(path = '') {
  if (path.includes('/provider-test')) return ['Sin escritura esperada (--no-save)'];
  if (path.includes('/integrity/merge')) return ['data/applications.md', 'batch/tracker-additions/'];
  if (path.includes('/integrity/normalize') || path.includes('/integrity/dedup')) return ['data/applications.md'];
  if (path.includes('/setup/repair')) return ['cv.md', 'config/profile.yml', 'modes/_profile.md', 'portals.yml'];
  if (path.includes('/update/')) return ['System Layer files'];
  return ['Archivos locales del workspace'];
}

/* ═══════════════════════════════════════════
   EVENT WIRING
   ═══════════════════════════════════════════ */

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
    if (target.dataset.importDiscovery) await importDiscoveryOffer(target.dataset.importDiscovery);
    if (target.dataset.livenessPipeline) await verifyPipeline(target.dataset.livenessPipeline);
    if (target.dataset.openReportPath) {
      const id = target.dataset.openReportPath.split('/').pop().replace(/\.md$/, '');
      setView('evaluate');
      await selectReport(id);
      hydrateEvaluateFromSelection();
    }
    if (target.dataset.openAssistant) openAssistant(target.dataset.openAssistant, target.dataset.assistantMode || null);
    if (target.dataset.clearModuleContext !== undefined) clearModuleContext();
    if (target.dataset.formReaderToApply !== undefined) continueFromFormReader();
    if (target.dataset.fillFilter) {
      const panel = target.closest('.fill-plan-panel');
      panel?.querySelectorAll('[data-fill-filter]').forEach(button => button.classList.toggle('active', button === target));
      panel?.querySelectorAll('[data-fill-kind]').forEach(row => {
        row.hidden = target.dataset.fillFilter !== 'all' && row.dataset.fillKind !== target.dataset.fillFilter;
      });
    }
    if (target.dataset.cancelJob) await cancelJob(target.dataset.cancelJob);
    if (target.dataset.reportPdf) {
      if (!confirmMutation({
        title: 'Generar PDF del informe.',
        files: ['output/*.pdf'],
        detail: target.dataset.reportPdf,
      })) return;
      const result = await api('/api/jobs/report-pdf', { method: 'POST', body: { reportPath: target.dataset.reportPdf } });
      streamJob(result.jobId, '#report-log');
    }
    if (target.dataset.v1Action) {
      const log = target.dataset.v1Log || (target.dataset.v1Action.includes('/update') || target.dataset.v1Action.includes('/provider') || target.dataset.v1Action.includes('/language') ? '#update-log' : '#integrity-log');
      let body = null;
      if (target.dataset.v1Body) {
        try {
          body = JSON.parse(target.dataset.v1Body);
        } catch (err) {
          notify(`JSON de acción inválido: ${err.message}`, 'error');
          return;
        }
      }
      await runV1Action(target.dataset.v1Action, target.dataset.v1Method || 'GET', log, body);
    }
    if (target.dataset.learningApp) {
      const app = state.applications.find(row => row.number === Number(target.dataset.learningApp));
      if (app) await openLearning({ company: app.company, role: app.role, score: app.scoreRaw, decision: app.score < 4 ? 'discard_low_fit' : 'decision_review', notes: app.notes });
    }
    if (target.dataset.learningReport) {
      const report = state.loadedReport || state.reports.find(row => row.id === target.dataset.learningReport);
      if (report) await openLearning({ company: report.company, role: report.role, score: report.scoreRaw, decision: 'report_feedback', notes: report.tldr });
    }
    if (target.dataset.learningTemplate) await openLearningTemplate(target.dataset.learningTemplate);
    if (target.dataset.loadInsights !== undefined) await loadInsights();
    if (target.dataset.runScheduledScan !== undefined) await runScheduledScan();
    if (target.dataset.openScanPanel !== undefined) openScanPanel();
  });

  document.addEventListener('submit', async event => {
    if (event.target?.id === 'scan-schedule-form') await saveScannerSchedule(event);
    if (event.target?.dataset?.outcomeForm) {
      event.preventDefault();
      await saveApplicationOutcome(event.target);
    }
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

  $('#pipeline-search').addEventListener('input', renderOpportunities);
  $('#pipeline-filter').addEventListener('change', renderOpportunities);
  $('#scanner-strategy-form')?.addEventListener('submit', saveScannerStrategy);
  $('#reload-scanner-strategy')?.addEventListener('click', reloadScannerStrategy);
  $('#application-search').addEventListener('input', renderApplications);
  $('#status-filter').addEventListener('change', renderApplications);
  $('#score-filter').addEventListener('change', renderApplications);
  $('#evaluate-jd').addEventListener('input', event => {
    event.currentTarget.dataset.sourceKind = 'manual-jd';
    event.currentTarget.dataset.inputTrust = 'trusted-manual';
  });
  $('#scan-open-btn').addEventListener('click', () => $('#scan-panel').classList.toggle('hidden'));
  $('#scan-open-btn').addEventListener('click', event => {
    event.currentTarget.setAttribute('aria-expanded', String(!$('#scan-panel').classList.contains('hidden')));
  });

  $('#pipeline-form').addEventListener('submit', async event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    await api('/api/pipeline', { method: 'POST', body });
    event.currentTarget.reset();
    notify('Oferta añadida al inbox');
    await loadAll();
  });

  $('#scan-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = { company: form.get('company'), dryRun: form.has('dryRun'), verify: form.has('verify') };
    try {
      const result = await api('/api/jobs/scan', { method: 'POST', body });
      streamReturnedJob(result, '#scan-log');
      notify(`Escaneo iniciado: ${result.jobId}`);
    } catch (err) {
      $('#scan-log').textContent = `[error] ${err.message}`;
    }
  });

  $('#evaluate-form').addEventListener('submit', async event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    if (!String(body.url || '').trim() && !String(body.jdText || '').trim()) {
      $('#evaluate-log').textContent = '[error] Pega una descripción o indica una URL.';
      return;
    }
    try {
      const result = await api('/api/jobs/evaluate', { method: 'POST', body });
      streamReturnedJob(result, '#evaluate-log');
      notify(`Evaluación iniciada: ${result.jobId}`);
    } catch (err) {
      $('#evaluate-log').textContent = `[error] ${err.message}`;
    }
  });

  $('#validate-evaluate-input').addEventListener('click', () => {
    const body = evaluatePayload($('#evaluate-form'));
    $('#evaluate-log').textContent = evaluateInputPreview(body);
  });

  $('#auto-pipeline-btn').addEventListener('click', async () => {
    const form = $('#evaluate-form');
    const body = evaluatePayload(form);
    if (!String(body.url || '').trim() && !String(body.jdText || '').trim()) {
      $('#evaluate-log').textContent = '[error] Pega una descripción o indica una URL.';
      return;
    }
    if ((body.sourceKind === 'hydrated-context' || body.inputTrust === 'untrusted-context') && !String(body.url || '').trim()) {
      $('#evaluate-log').textContent = '[error] El contexto seleccionado no es una oferta completa. Pega una JD real o usa una URL publica antes de ejecutar el flujo completo.';
      return;
    }
    const confirmed = confirm([
      'El flujo completo escribira archivos locales:',
      '- jds/',
      '- reports/',
      '- batch/tracker-additions/ y data/applications.md',
      '- output/ PDFs y CVs',
      '',
      'Continua solo si la JD o URL corresponde a una oferta real.'
    ].join('\n'));
    if (!confirmed) {
      $('#evaluate-log').textContent = '[cancelado] No se escribieron archivos.';
      return;
    }
    body.persistConfirmed = true;
    resetProgressChecklist();
    try {
      const result = await api('/api/jobs/auto-pipeline', { method: 'POST', body });
      streamReturnedJob(result, '#evaluate-log');
      notify(`Flujo completo iniciado: ${result.jobId}`);
    } catch (err) {
      $('#evaluate-log').textContent = `[error] ${err.message}`;
      notify(err.message, 'error');
    }
  });

  $('#report-picker').addEventListener('change', event => selectReport(event.target.value));
  $('#generate-report-pdf').addEventListener('click', async () => {
    const report = state.loadedReport || state.reports.find(row => row.id === $('#report-picker').value);
    if (!report) return;
    if (!confirmMutation({
      title: 'Generar PDF del informe.',
      files: ['output/*.pdf'],
      detail: report.path,
    })) return;
    const result = await api('/api/jobs/report-pdf', { method: 'POST', body: { reportPath: report.path } });
    streamReturnedJob(result, '#report-log');
    notify(`PDF iniciado: ${result.jobId}`);
  });
  $('#generate-cv-pdf').addEventListener('click', async () => {
    const report = state.loadedReport || state.reports.find(row => row.id === $('#report-picker').value);
    try {
      if (!confirmMutation({
        title: 'Generar CV ATS.',
        files: ['output/*.html', 'output/*.pdf'],
        detail: report ? `${report.company || ''} ${report.role || ''}`.trim() : 'Borrador sin informe seleccionado',
      })) return;
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
      if (!confirmMutation({
        title: 'Generar vista previa de CV.',
        files: ['output/*.html', 'output/*.pdf'],
        detail: body.title || report?.title || 'CV ATS',
      })) return;
      const result = await api('/api/jobs/cv-pdf', { method: 'POST', body });
      streamReturnedJob(result, '#report-log');
      setArtifactLink('#cv-preview-link', result.htmlPath);
      setArtifactLink('#cv-download-link', result.outputPath);
      renderKeywordCoverage(result.keywords, body.jdText || report?.markdown || '');
      notify(`Vista previa CV iniciada: ${result.jobId}`);
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
      notify(`Verificación de vigencia iniciada: ${result.jobId}`);
    } catch (err) {
      $('#batch-log').textContent = `[error] ${err.message}`;
      notify(err.message, 'error');
    }
  });

  $('#module-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = modulePayload(form);
    const kind = payload.kind;
    const requestId = state.currentModuleRequestId + 1;
    state.currentModuleRequestId = requestId;
    const output = $('#module-output');
    output.classList.remove('job-log');
    output.classList.add('running');
    output.dataset.requestId = String(requestId);
    output.innerHTML = `<div class="assistant-output-head"><strong>${escapeHtml(moduleLabels[kind] || 'Asistente')}</strong><span>Generando respuesta...</span></div>`;
    try {
      const result = await api(`/api/modules/${kind}`, { method: 'POST', body: payload });
      if (requestId !== state.currentModuleRequestId) return;
      if (result.jobId) {
        renderAssistantLog(result.jobId, requestId, payload);
        notify(`Módulo iniciado: ${result.jobId}`);
        return;
      }
      renderAssistantOutput(result, requestId, payload);
      notify('Asistente generado');
    } catch (err) {
      if (requestId !== state.currentModuleRequestId) return;
      $('#module-output').classList.remove('job-log', 'running');
      $('#module-output').innerHTML = `<div class="assistant-error">Error: ${escapeHtml(err.message)}</div>`;
      notify(err.message, 'error');
    }
  });

  document.addEventListener('change', async event => {
    const detailStatus = event.target.closest('[data-status-detail]');
    if (detailStatus) await updateStatus(detailStatus.dataset.statusDetail, detailStatus.value);
  });

  // Profile tabs
  $$('[data-profile-tab]').forEach(tab => tab.addEventListener('click', () => {
    $$('[data-profile-tab]').forEach(t => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', String(t === tab));
      t.tabIndex = t === tab ? 0 : -1;
    });
    const isInsights = tab.dataset.profileTab === 'insights';
    $('#profile-insights')?.classList.toggle('active', isInsights);
    $('#profile-editor')?.classList.toggle('active', !isInsights);
    if ($('#profile-insights')) $('#profile-insights').hidden = !isInsights;
    if ($('#profile-editor')) {
      $('#profile-editor').hidden = isInsights;
      $('#profile-editor').setAttribute('aria-labelledby', tab.id || 'profile-tab-profile');
    }
    if (!isInsights) {
      state.editorData[state.editorKey] = $('#editor').value;
      state.editorKey = tab.dataset.profileTab;
      $('#editor').value = state.editorData[state.editorKey] || '';
    }
  }));

  // Backward compat: old .tab[data-lab] tabs (in case any remain in compat view)
  $$('.tab[data-lab]').forEach(tab => tab.addEventListener('click', () => {
    $$('.tab[data-lab]').forEach(t => t.classList.toggle('active', t === tab));
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

/* ═══════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════ */

try {
  wireEvents();
  await loadAll();
  await loadEditor();
  await loadInsights().catch(() => {});
  renderInsights();
  if (state.reports[0]) await selectReport(state.reports[0].id).catch(() => {});
  setView('home');
} catch (err) {
  fatal(`No se pudo iniciar la app: ${err.message}`);
}
