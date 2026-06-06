import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getHostname, normalizeHttpUrl } from './url-safety.mjs';
import {
  buildDeepResearchPrompt,
  buildInterviewPrepDraft,
  createLinkedInOutreachMessage,
  draftApplicationResponses,
} from './modules/index.mjs';

const DEFAULT_TIMEOUT = 45000;

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function slugify(value) {
  return String(value || 'artifact')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'artifact';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function sourceLine(source) {
  return `- [${source.title || source.host || source.url}](${source.url}) - ${source.summary || 'source captured'}`;
}

async function withPage(work, options = {}) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(options.timeoutMs || DEFAULT_TIMEOUT);
    return await work(page);
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function capturePageSource(url, options = {}) {
  const target = normalizeHttpUrl(url, { allowLocal: Boolean(options.allowLocal) });
  return withPage(async page => {
    const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs || DEFAULT_TIMEOUT }).catch(() => null);
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    const title = cleanText(await page.title().catch(() => ''));
    const bodyText = cleanText(await page.locator('body').innerText({ timeout: 15000 }).catch(() => ''));
    const description = cleanText(await page.locator('meta[name="description"]').getAttribute('content').catch(() => ''));
    return {
      url: target,
      finalUrl: page.url(),
      host: getHostname(target),
      status: response?.status?.() || 0,
      title,
      description,
      bodyText,
      summary: cleanText(description || bodyText.slice(0, 360)),
    };
  }, options);
}

async function extractFieldsFromPage(page) {
  return page.locator('input, textarea, select').evaluateAll(nodes => nodes
    .map((node, index) => {
      const tag = node.tagName.toLowerCase();
      const type = (node.getAttribute('type') || tag).toLowerCase();
      if (['hidden', 'submit', 'button', 'reset', 'file', 'image'].includes(type)) return null;
      const id = node.getAttribute('id');
      const name = node.getAttribute('name');
      const aria = node.getAttribute('aria-label');
      const placeholder = node.getAttribute('placeholder');
      const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.innerText : '';
      const wrapped = node.closest('label')?.innerText || '';
      const nearby = node.closest('[class*="field"],[class*="question"],[class*="form"],div,li')?.innerText || '';
      const options = tag === 'select'
        ? [...node.querySelectorAll('option')].map(option => option.innerText || option.value).filter(Boolean).slice(0, 12)
        : [];
      return {
        index,
        tag,
        type,
        id,
        name,
        required: node.required || node.getAttribute('aria-required') === 'true',
        question: (label || aria || placeholder || wrapped || nearby || name || id || `Field ${index + 1}`).replace(/\s+/g, ' ').trim().slice(0, 300),
        options,
      };
    })
    .filter(Boolean)
    .slice(0, 80));
}

async function extractSubmitControls(page) {
  return page.locator('button,input[type="submit"],a').evaluateAll(nodes => nodes
    .map(node => (node.innerText || node.value || node.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim())
    .filter(text => /submit|send|apply|postular|enviar|candidatura/i.test(text))
    .slice(0, 20)).catch(() => []);
}

async function discoverApplyLinks(page, options = {}) {
  const candidates = await page.locator('a[href]').evaluateAll(nodes => nodes
    .map(node => ({
      text: (node.innerText || node.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(),
      href: node.href,
    }))
    .filter(link => link.href && /apply|postular|candidatura|enviar|solicitar|careers|jobs|greenhouse|lever|ashby|workable|teamtailor|candee/i.test(`${link.text} ${link.href}`))
    .slice(0, 20)).catch(() => []);
  const seen = new Set();
  return candidates.map(link => {
    try {
      return { ...link, url: normalizeHttpUrl(link.href, { allowLocal: Boolean(options.allowLocal) }) };
    } catch {
      return null;
    }
  }).filter(Boolean).filter(link => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  }).slice(0, 8);
}

function hasApplicationFields(fields = []) {
  const signal = fields.filter(field => !/search|keyword|filter|newsletter/i.test(`${field.name || ''} ${field.question || ''}`));
  return signal.length >= 2 || signal.some(field => /cover|cv|resume|linkedin|salary|phone|email|name|motivation|why|work authorization/i.test(`${field.name || ''} ${field.question || ''}`));
}

export async function extractApplicationForm(url, options = {}) {
  const target = normalizeHttpUrl(url, { allowLocal: Boolean(options.allowLocal) });
  return withPage(async page => {
    const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs || DEFAULT_TIMEOUT }).catch(() => null);
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    let fields = await extractFieldsFromPage(page);
    let submitControls = await extractSubmitControls(page);
    const applyLinks = await discoverApplyLinks(page, options);
    let discoveredFormUrl = '';
    if (!hasApplicationFields(fields) && applyLinks.length) {
      for (const link of applyLinks) {
        const nextResponse = await page.goto(link.url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs || DEFAULT_TIMEOUT }).catch(() => null);
        await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
        const nextFields = await extractFieldsFromPage(page);
        const nextSubmitControls = await extractSubmitControls(page);
        if (hasApplicationFields(nextFields) || nextSubmitControls.length) {
          fields = nextFields;
          submitControls = nextSubmitControls;
          discoveredFormUrl = link.url;
          break;
        }
        if (nextResponse?.status?.() >= 400) continue;
      }
    }
    return {
      url: target,
      finalUrl: page.url(),
      discoveredFormUrl,
      applyLinks,
      status: response?.status?.() || 0,
      title: cleanText(await page.title().catch(() => '')),
      fields,
      submitControls,
      safety: 'Read-only extraction only. Career-Ops never clicks submit/send/apply.',
    };
  }, options);
}

function mapField(field, context = {}) {
  const question = field.question || field.name || `Field ${field.index + 1}`;
  const profileAnswer = profileAnswerForField(field, context);
  const draft = draftApplicationResponses({
    company: context.company,
    role: context.role,
    questions: [question],
    proofPoints: context.proofPoints,
    reportSummary: context.reportSummary,
    jobSignal: context.jobSignal,
    compensation: context.compensation,
    workAuthorization: context.workAuthorization,
    writingStyle: context.writingStyle,
  });
  const response = profileAnswer || draft.responses[0]?.answer || '';
  let source = 'report/profile';
  let confidence = 0.72;
  if (profileAnswer) {
    source = 'config/profile.yml';
    confidence = 0.92;
  } else if (/email/i.test(question)) {
    source = 'config/profile.yml';
    confidence = 0.9;
  } else if (/salary|compensation|visa|authorization/i.test(question)) {
    source = 'profile/logistics';
    confidence = 0.62;
  } else if (field.tag === 'select') {
    source = 'requires user choice';
    confidence = 0.4;
  }
  const fill = classifyFillAction(field, { answer: response, source, confidence });
  return { ...field, answer: response, confidence, source, ...fill };
}

function profileAnswerForField(field = {}, context = {}) {
  const q = `${field.name || ''} ${field.question || ''}`.toLowerCase();
  const profile = context.profile || {};
  const candidate = profile.candidate || {};
  if (/e-?mail|correo/.test(q)) return candidate.email || '';
  if (/phone|telefono|teléfono|mobile|movil|móvil/.test(q)) return candidate.phone || '';
  if (/linkedin/.test(q)) return candidate.linkedin || '';
  if (/portfolio|website|web/.test(q)) return candidate.portfolio_url || '';
  if (/full.*name|nombre.*completo|name|nombre/.test(q)) return candidate.full_name || '';
  if (/location|ubicacion|ubicación|city|ciudad/.test(q)) return candidate.location || '';
  return '';
}

function classifyFillAction(field = {}, draft = {}) {
  const q = `${field.name || ''} ${field.question || ''} ${field.type || ''}`.toLowerCase();
  if (/file|resume|cv|upload|adjuntar|subir/.test(q)) {
    return { action: 'manual_upload', risk: 'manual', fillSafe: false, fillReason: 'Los archivos deben ser revisados y seleccionados por el usuario.' };
  }
  if (field.tag === 'select' || /radio|checkbox/.test(field.type || '')) {
    return { action: 'manual_choice', risk: 'manual', fillSafe: false, fillReason: 'Los campos de elección pueden implicar consentimiento, elegibilidad o significado legal.' };
  }
  if (/salary|compensation|expect|visa|authorization|sponsorship|notice|relocation|disability|gender|race|ethnicity|legal|criminal/i.test(q)) {
    return { action: 'review_required', risk: 'sensitive', fillSafe: false, fillReason: 'Respuesta logística sensible o legal/RRHH. Solo borrador.' };
  }
  if (draft.source === 'config/profile.yml' && draft.confidence >= 0.9) {
    return { action: 'safe_prefill_candidate_data', risk: 'low', fillSafe: true, fillReason: 'Dato estable del perfil candidato; revisar igualmente antes de enviar.' };
  }
  return { action: 'draft_for_review', risk: 'medium', fillSafe: false, fillReason: 'La respuesta narrativa generada debe revisarse antes de rellenar.' };
}

function fillPlanSummary(fields = []) {
  const counts = fields.reduce((acc, field) => {
    acc[field.action] = (acc[field.action] || 0) + 1;
    return acc;
  }, {});
  return {
    safePrefill: counts.safe_prefill_candidate_data || 0,
    draftForReview: counts.draft_for_review || 0,
    reviewRequired: counts.review_required || 0,
    manualChoice: counts.manual_choice || 0,
    manualUpload: counts.manual_upload || 0,
    counts,
    safety: 'Rellenado seguro significa preparación de bajo riesgo. El usuario revisa antes de enviar.',
  };
}

function renderFillPlan(fields = []) {
  const plan = fillPlanSummary(fields);
  return [
    '## Plan de rellenado seguro',
    `- **Prefill seguro de perfil:** ${plan.safePrefill}`,
    `- **Borradores para revisar:** ${plan.draftForReview}`,
    `- **Revisión sensible requerida:** ${plan.reviewRequired}`,
    `- **Elecciones/subidas manuales:** ${plan.manualChoice + plan.manualUpload}`,
    '- **Límite:** Career-Ops puede preparar campos seguros, pero se detiene antes de enviar, mandar o aplicar.',
  ].join('\n');
}

export async function runApplyAssistant(input = {}, context = {}) {
  const defaultQuestions = [
    'Why are you interested in this role?',
    'Why do you want to work at this company?',
    'Tell us about a relevant achievement for this role.',
    'What salary range or compensation expectations should we discuss?',
    'What is your work authorization and availability?',
  ];
  const questions = Array.isArray(input.questions) ? input.questions : String(input.questions || input.notes || '')
    .split(/\r?\n/)
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
  const formSource = input.formUrl || input.url;
  const form = formSource ? await extractApplicationForm(formSource, { allowLocal: input.allowLocal }) : null;
  const fields = form?.fields?.length
    ? form.fields
    : (questions.length ? questions : defaultQuestions).map((question, index) => ({ index, tag: 'textarea', type: 'textarea', question, required: false, options: [] }));
  const mappedFields = fields.map(field => mapField(field, context));
  const markdown = [
    `## Asistente de candidatura: ${context.company || input.company || 'Empresa'} - ${context.role || input.role || 'Rol'}`,
    '',
    '**Seguridad:** Solo borrador/copia. No se realiza ningún envío, mensaje o aplicación automática.',
    form ? `**URL del formulario:** ${form.finalUrl || form.url}` : '',
    form?.discoveredFormUrl ? `**Formulario detectado automáticamente:** ${form.discoveredFormUrl}` : '',
    '',
    renderFillPlan(mappedFields),
    '',
    ...mappedFields.flatMap((field, index) => [
      `### ${index + 1}. ${field.question}`,
      `- **Tipo:** ${field.tag}/${field.type}${field.required ? ' requerido' : ''}`,
      `- **Acción de rellenado:** ${field.action} (${field.risk})`,
      `- **Seguro para rellenar:** ${field.fillSafe ? 'sí' : 'no'}`,
      `- **Motivo:** ${field.fillReason}`,
      `- **Confianza:** ${field.confidence}`,
      `- **Fuente:** ${field.source}`,
      field.options?.length ? `- **Opciones:** ${field.options.join(', ')}` : '',
      '',
      `> ${field.answer.replace(/\n/g, '\n> ')}`,
      '',
    ]),
  ].filter(Boolean).join('\n');
  return {
    ok: true,
    mode: form ? 'assisted' : 'draft',
    form,
    fields: mappedFields,
    fillPlan: fillPlanSummary(mappedFields),
    markdown,
    warnings: ['Revisa cada campo antes de pegarlo. Career-Ops no envía formularios.'],
    writingStyleApplied: Boolean(context.writingStyle),
  };
}

export async function runFormReader(input = {}, context = {}) {
  const formUrl = input.formUrl || input.url;
  if (!formUrl) {
    throw new Error('Indica una URL de formulario para inspeccionar.');
  }
  const form = await extractApplicationForm(formUrl, { allowLocal: Boolean(input.allowLocal) });
  const plannedFields = form.fields.map(field => {
    const profileAnswer = profileAnswerForField(field, context);
    const source = profileAnswer ? 'config/profile.yml' : 'form-reader';
    const confidence = profileAnswer ? 0.92 : 0.5;
    return { ...field, answer: profileAnswer, source, confidence, ...classifyFillAction(field, { source, confidence, answer: profileAnswer }) };
  });
  const markdown = [
    `## Lector de formulario: ${context.company || input.company || 'Empresa'} - ${context.role || input.role || 'Rol'}`,
    '',
    '**Seguridad:** Inspección de solo lectura. Career-Ops no rellena, envía, manda ni aplica.',
    `**URL del formulario:** ${form.finalUrl || form.url}`,
    form.discoveredFormUrl ? `**Formulario detectado automáticamente:** ${form.discoveredFormUrl}` : '',
    form.applyLinks?.length ? `**Enlaces de aplicación considerados:** ${form.applyLinks.map(link => link.text || link.url).join(', ')}` : '',
    `**Estado:** ${form.status || 'desconocido'}`,
    form.submitControls?.length ? `**Controles tipo submit detectados:** ${form.submitControls.join(', ')}` : '**Controles tipo submit detectados:** ninguno',
    '',
    renderFillPlan(plannedFields),
    '',
    '## Campos detectados',
    plannedFields.length ? plannedFields.flatMap((field, index) => [
      `### ${index + 1}. ${field.question}`,
      `- **Tipo:** ${field.tag}/${field.type}${field.required ? ' requerido' : ''}`,
      field.name ? `- **Nombre:** ${field.name}` : '',
      `- **Acción de rellenado:** ${field.action} (${field.risk})`,
      `- **Seguro para rellenar:** ${field.fillSafe ? 'sí' : 'no'}`,
      `- **Motivo:** ${field.fillReason}`,
      field.options?.length ? `- **Opciones:** ${field.options.join(', ')}` : '',
      '',
    ]).filter(Boolean).join('\n') : '- No se detectaron campos visibles input, textarea o select.',
    '',
    '## Siguiente paso seguro',
    form.fields.length
      ? '- Ejecuta el Asistente de candidatura en modo borrador para preparar respuestas y revisarlas manualmente.'
      : '- Confirma que este es el formulario real o ábrelo en una sesión guiada para revisión manual.',
  ].filter(Boolean).join('\n');
  return {
    ok: true,
    mode: 'form-reader',
    form,
    fields: plannedFields,
    fillPlan: fillPlanSummary(plannedFields),
    markdown,
    warnings: ['Extracción de solo lectura. No enviar hasta que la persona candidata dé aprobación final.'],
  };
}

export async function runDeepResearch(input = {}, context = {}) {
  const sourceUrls = [...new Set([...(Array.isArray(input.sourceUrls) ? input.sourceUrls : []), input.url, input.companyUrl].filter(Boolean))];
  const sources = [];
  for (const sourceUrl of sourceUrls.slice(0, 6)) {
    sources.push(await capturePageSource(sourceUrl, { allowLocal: input.allowLocal }).catch(err => ({
      url: sourceUrl,
      title: 'Fuente no disponible',
      summary: err.message,
      error: err.message,
    })));
  }
  const company = input.company || context.company || sources[0]?.host || 'Empresa';
  const role = input.role || context.role || 'Rol';
  const prompt = buildDeepResearchPrompt({
    ...input,
    company,
    role,
    candidateContext: context.candidateContext || 'Perfil del candidato almacenado en Career-Ops.',
    extraQuestions: [
      ...(input.extraQuestions || []),
      'Usa las fuentes capturadas abajo; marca todo lo demás como incierto.',
    ],
  });
  const markdown = [
    `# Investigación profunda: ${company} - ${role}`,
    '',
    '## Fuentes capturadas',
    sources.length ? sources.map(sourceLine).join('\n') : '- No se aportaron URLs vivas. Solo se generó el prompt de investigación.',
    '',
    '## Síntesis',
    sources.length
      ? sources.map(source => `- ${source.title || source.host}: ${source.summary || 'Sin resumen capturado.'}`).join('\n')
      : '- No hay afirmaciones externas verificadas. Trátalo como brief de research, no como informe con fuentes.',
    '',
    '## Prompt de investigación asistida',
    prompt,
  ].join('\n');
  return { ok: true, mode: sources.length ? 'assisted' : 'draft', sources, markdown };
}

export async function runInterviewPrep(input = {}, context = {}) {
  const research = input.researchMarkdown || input.research || '';
  const sources = Array.isArray(input.sources) ? input.sources : [];
  const markdown = buildInterviewPrepDraft({
    ...input,
    company: input.company || context.company,
    role: input.role || context.role,
    sources: sources.length ? sources.map(source => source.url || source).join(', ') : 'Fuentes pendientes o capturadas en Investigación profunda.',
    risks: input.risks || [
      research ? 'Revisa las afirmaciones contra fuentes capturadas antes de usarlas en entrevista.' : 'No hay research vivo adjunto; confirma datos de empresa antes de apoyarte en esta preparación.',
      'Prepara una respuesta clara para cualquier requisito que no esté fuertemente evidenciado en el CV.',
    ],
  });
  return { ok: true, mode: research || sources.length ? 'assisted' : 'draft', markdown };
}

export async function runOutreach(input = {}, context = {}) {
  const sources = [];
  if (input.contactUrl) {
    sources.push(await capturePageSource(input.contactUrl, { allowLocal: input.allowLocal }).catch(err => ({
      url: input.contactUrl,
      title: 'Fuente de contacto no disponible',
      summary: err.message,
      error: err.message,
    })));
  }
  const inferredType = input.type || input.contactType || (/recruit/i.test(sources[0]?.bodyText || '') ? 'recruiter' : 'hiring-manager');
  const result = createLinkedInOutreachMessage({
    ...input,
    type: inferredType,
    company: input.company || context.company,
    role: input.role || context.role,
    proof: input.proof || context.reportSummary,
    topic: input.topic || sources[0]?.title,
  });
  return {
    ok: true,
    mode: sources.length ? 'assisted' : 'draft',
    sources,
    result: {
      ...result,
      safety: 'Solo borrador. Career-Ops nunca envía mensajes de LinkedIn/email automáticamente.',
    },
  };
}

export function writeUserArtifact(root, relPath, content) {
  const safeRel = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const full = path.resolve(root, safeRel);
  if (!full.startsWith(path.resolve(root) + path.sep)) throw new Error('Artifact path escapes root');
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf-8');
  return safeRel;
}

export function buildModuleArtifactPath(kind, input = {}) {
  const company = slugify(input.company || 'company');
  const role = slugify(input.role || 'role');
  const date = today();
  if (kind === 'interview-prep') return `interview-prep/${company}-${role}-${date}.md`;
  if (kind === 'deep-research') return `reports/research-${company}-${role}-${date}.md`;
  if (kind === 'apply-assistant') return `output/apply-${company}-${role}-${date}.md`;
  if (kind === 'outreach') return `output/outreach-${company}-${role}-${date}.md`;
  return `output/${kind}-${company}-${role}-${date}.md`;
}

export function readOptional(file) {
  return existsSync(file) ? readFileSync(file, 'utf-8') : '';
}
