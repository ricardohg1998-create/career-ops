const state = {
  health: null,
  applications: [],
  metrics: null,
  states: [],
  pipeline: [],
  editorKey: 'profile',
  editorData: {},
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

function mdToHtml(markdown) {
  return escapeHtml(markdown)
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\n/g, '<br>');
}

function setView(name) {
  $$('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === name));
  $$('.view').forEach(view => view.classList.toggle('active', view.id === `view-${name}`));
  $('#view-title').textContent = {
    home: 'Inicio',
    applications: 'Seguimiento de aplicaciones',
    pipeline: 'Pipeline de ofertas',
    evaluate: 'Evaluar oferta',
    scan: 'Escáner de portales',
    profile: 'Perfil y CV',
    reports: 'Informes',
    insights: 'Seguimientos y patrones',
  }[name] || name;
}

async function loadAll() {
  const [health, apps, pipeline] = await Promise.all([
    api('/api/health'),
    api('/api/applications'),
    api('/api/pipeline'),
  ]);
  state.health = health;
  state.applications = apps.applications;
  state.metrics = apps.metrics;
  state.states = apps.states;
  state.pipeline = pipeline.entries;
  renderHealth();
  renderHome();
  renderApplications();
  renderPipeline();
  renderReports();
}

function renderHealth() {
  const healthLabels = {
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
  dot.classList.toggle('ok', state.health.ok);
  dot.classList.toggle('bad', !state.health.ok);
  $('#health-label').textContent = state.health.ok ? `Listo · v${state.health.version}` : 'Config incompleta';
  $('#health-list').innerHTML = Object.entries(state.health.checks).map(([key, ok]) => `
    <div class="check-item">
      <strong>${ok ? '✓' : '×'} ${escapeHtml(healthLabels[key] || key)}</strong>
      <span class="muted">${ok ? 'Correcto' : 'Falta o no se detecta'}</span>
    </div>
  `).join('');
}

function renderHome() {
  const m = state.metrics;
  $('#metrics').innerHTML = [
    ['Aplicaciones', m.total],
    ['Activas', m.active],
    ['Top ≥4', m.top],
    ['Score medio', m.averageScore ?? 'n/a'],
  ].map(([label, value]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join('');

  const pending = state.pipeline.filter(item => !item.done).slice(0, 5);
  const top = state.applications.filter(app => app.score >= 4 && app.status === 'Evaluated').slice(0, 5);
  $('#next-actions').innerHTML = [
    ...top.map(app => `<div class="action-item"><strong>${escapeHtml(app.company)}</strong><br><span>${escapeHtml(app.role)}</span><br><span class="muted">Score ${escapeHtml(app.scoreRaw)} · lista para decidir</span></div>`),
    ...pending.map(item => `<div class="action-item"><strong>${escapeHtml(item.company || 'URL del pipeline')}</strong><br><span>${escapeHtml(item.role || item.url)}</span></div>`),
  ].join('') || '<div class="action-item">Sin acciones claras ahora mismo. El tablero está tranquilo.</div>';
}

function renderApplications() {
  const statusFilter = $('#status-filter');
  if (!statusFilter.dataset.ready) {
    statusFilter.innerHTML = '<option value="all">Todos los estados</option>' + state.states.map(s => `<option value="${escapeHtml(s.label)}">${escapeHtml(statusLabels[s.label] || s.label)}</option>`).join('');
    statusFilter.dataset.ready = '1';
  }
  const query = $('#application-search').value.toLowerCase();
  const status = statusFilter.value;
  const score = $('#score-filter').value;
  const rows = state.applications.filter(app => {
    const hay = `${app.company} ${app.role} ${app.notes}`.toLowerCase();
    if (query && !hay.includes(query)) return false;
    if (status !== 'all' && app.status !== status) return false;
    if (score === 'top' && !(app.score >= 4)) return false;
    if (score === 'low' && !(app.score < 4)) return false;
    return true;
  });
  $('#applications-table').innerHTML = rows.map(app => {
    const scoreClass = app.score >= 4 ? 'top' : app.score < 4 ? 'low' : '';
    return `
      <tr>
        <td>${app.number}</td>
        <td><strong>${escapeHtml(app.company)}</strong></td>
        <td>${escapeHtml(app.role)}${app.score < 4 ? '<br><span class="score-pill low">Recomendado descartar</span>' : ''}</td>
        <td><span class="score-pill ${scoreClass}">${escapeHtml(app.scoreRaw || 'n/a')}</span></td>
        <td>
          <select data-status-for="${app.number}">
            ${state.states.map(s => `<option value="${escapeHtml(s.label)}" ${s.label === app.status ? 'selected' : ''}>${escapeHtml(statusLabels[s.label] || s.label)}</option>`).join('')}
          </select>
        </td>
        <td><div class="asset-row">
          ${app.reportPath ? `<a class="asset-link" href="/api/files?path=${encodeURIComponent(app.reportPath)}" target="_blank">Informe</a>` : ''}
          ${app.pdfPath ? `<a class="asset-link" href="/api/files?path=${encodeURIComponent(app.pdfPath)}" target="_blank">PDF</a>` : ''}
          ${app.jobUrl ? `<a class="asset-link" href="${escapeHtml(app.jobUrl)}" target="_blank" rel="noreferrer">Oferta</a>` : ''}
        </div></td>
        <td>${escapeHtml(app.notes)}</td>
      </tr>
    `;
  }).join('');

  $$('[data-status-for]').forEach(select => {
    select.addEventListener('change', async () => {
      await api(`/api/applications/${select.dataset.statusFor}/status`, { method: 'PATCH', body: { status: select.value } });
      await loadAll();
    }, { once: true });
  });
}

function renderPipeline() {
  $('#pipeline-list').innerHTML = state.pipeline.map(item => `
    <div class="queue-item">
      <input type="checkbox" ${item.done ? 'checked' : ''} data-pipeline-done="${item.id}">
      <div>
        <strong>${escapeHtml(item.company || item.url)}</strong><br>
        <span>${escapeHtml(item.role || item.url)}</span><br>
        <span class="muted">${escapeHtml(item.url)}</span>
      </div>
      <button class="ghost-btn" data-pipeline-delete="${item.id}">Delete</button>
    </div>
  `).join('') || '<div class="queue-item">El pipeline está vacío.</div>';

  $$('[data-pipeline-done]').forEach(input => input.addEventListener('change', async () => {
    await api(`/api/pipeline/${input.dataset.pipelineDone}`, { method: 'PATCH', body: { done: input.checked } });
    await loadAll();
  }));
  $$('[data-pipeline-delete]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/pipeline/${btn.dataset.pipelineDelete}`, { method: 'DELETE' });
    await loadAll();
  }));
}

function renderReports() {
  const reports = state.applications.filter(app => app.reportPath);
  $('#report-picker').innerHTML = reports.map(app => `<option value="${escapeHtml(app.reportPath)}">${String(app.number).padStart(3, '0')} · ${escapeHtml(app.company)} · ${escapeHtml(app.role)}</option>`).join('');
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

async function loadReport() {
  const reportPath = $('#report-picker').value;
  if (!reportPath) return;
  const res = await fetch(`/api/files?path=${encodeURIComponent(reportPath)}`);
  $('#report-viewer').innerHTML = mdToHtml(await res.text());
}

async function loadInsights() {
  const [followups, patterns] = await Promise.all([api('/api/followups'), api('/api/patterns')]);
  $('#followups-json').textContent = JSON.stringify(followups.data ?? followups, null, 2);
  $('#patterns-json').textContent = JSON.stringify(patterns.data ?? patterns, null, 2);
}

function wireEvents() {
  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
  $$('[data-jump]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.jump)));
  $('#refresh-btn').addEventListener('click', async () => {
    const button = $('#refresh-btn');
    const original = button.textContent;
    button.textContent = '…';
    button.disabled = true;
    try {
      await loadAll();
      button.textContent = '✓';
      button.title = 'Datos actualizados';
    } catch (err) {
      button.textContent = '!';
      button.title = err.message;
    } finally {
      setTimeout(() => {
        button.textContent = original;
        button.title = 'Actualizar datos';
        button.disabled = false;
      }, 1200);
    }
  });
  $('#application-search').addEventListener('input', renderApplications);
  $('#status-filter').addEventListener('change', renderApplications);
  $('#score-filter').addEventListener('change', renderApplications);
  $('#pipeline-form').addEventListener('submit', async event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    await api('/api/pipeline', { method: 'POST', body });
    event.currentTarget.reset();
    await loadAll();
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
  $$('.tab').forEach(tab => tab.addEventListener('click', () => {
    state.editorData[state.editorKey] = $('#editor').value;
    state.editorKey = tab.dataset.editor;
    $$('.tab').forEach(t => t.classList.toggle('active', t === tab));
    $('#editor').value = state.editorData[state.editorKey] || '';
  }));
  $('#save-editor').addEventListener('click', saveEditor);
  $('#report-picker').addEventListener('change', loadReport);
  $('#generate-report-pdf').addEventListener('click', async () => {
    try {
      const result = await api('/api/jobs/report-pdf', { method: 'POST', body: { reportPath: $('#report-picker').value } });
      streamJob(result.jobId, '#report-log');
    } catch (err) {
      $('#report-log').textContent = `[error] ${err.message}`;
    }
  });
  $('#load-followups').addEventListener('click', loadInsights);
  $('#load-patterns').addEventListener('click', loadInsights);
}

wireEvents();
await loadAll();
await loadEditor();
await loadReport();
await loadInsights();
