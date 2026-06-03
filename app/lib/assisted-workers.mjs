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
    return { action: 'manual_upload', risk: 'manual', fillSafe: false, fillReason: 'File uploads must be reviewed and selected by the user.' };
  }
  if (field.tag === 'select' || /radio|checkbox/.test(field.type || '')) {
    return { action: 'manual_choice', risk: 'manual', fillSafe: false, fillReason: 'Choice fields can encode consent, eligibility, or legal meaning.' };
  }
  if (/salary|compensation|expect|visa|authorization|sponsorship|notice|relocation|disability|gender|race|ethnicity|legal|criminal/i.test(q)) {
    return { action: 'review_required', risk: 'sensitive', fillSafe: false, fillReason: 'Sensitive logistics or legal/HR answer. Draft only.' };
  }
  if (draft.source === 'config/profile.yml' && draft.confidence >= 0.9) {
    return { action: 'safe_prefill_candidate_data', risk: 'low', fillSafe: true, fillReason: 'Stable candidate profile data; still review before submit.' };
  }
  return { action: 'draft_for_review', risk: 'medium', fillSafe: false, fillReason: 'Generated narrative answer should be reviewed before filling.' };
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
    safety: 'Safe-prefill means low-risk preparation only. The user still reviews before submit.',
  };
}

function renderFillPlan(fields = []) {
  const plan = fillPlanSummary(fields);
  return [
    '## Safe Fill Plan',
    `- **Safe profile prefill:** ${plan.safePrefill}`,
    `- **Draft for review:** ${plan.draftForReview}`,
    `- **Sensitive review required:** ${plan.reviewRequired}`,
    `- **Manual choices/uploads:** ${plan.manualChoice + plan.manualUpload}`,
    '- **Boundary:** Career-Ops can prepare safe fields, but must stop before final submit/send/apply.',
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
    `## Apply Assistant: ${context.company || input.company || 'Company'} - ${context.role || input.role || 'Role'}`,
    '',
    '**Safety:** Draft/copy only. No automatic submit, send, or apply action is performed.',
    form ? `**Form URL:** ${form.finalUrl || form.url}` : '',
    form?.discoveredFormUrl ? `**Auto-discovered form:** ${form.discoveredFormUrl}` : '',
    '',
    renderFillPlan(mappedFields),
    '',
    ...mappedFields.flatMap((field, index) => [
      `### ${index + 1}. ${field.question}`,
      `- **Type:** ${field.tag}/${field.type}${field.required ? ' required' : ''}`,
      `- **Fill action:** ${field.action} (${field.risk})`,
      `- **Fill safe:** ${field.fillSafe ? 'yes' : 'no'}`,
      `- **Why:** ${field.fillReason}`,
      `- **Confidence:** ${field.confidence}`,
      `- **Source:** ${field.source}`,
      field.options?.length ? `- **Options:** ${field.options.join(', ')}` : '',
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
    warnings: ['Review every field before pasting. Career-Ops does not submit forms.'],
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
    `## Form Reader: ${context.company || input.company || 'Company'} - ${context.role || input.role || 'Role'}`,
    '',
    '**Safety:** Read-only inspection. Career-Ops does not fill, submit, send, or apply.',
    `**Form URL:** ${form.finalUrl || form.url}`,
    form.discoveredFormUrl ? `**Auto-discovered form:** ${form.discoveredFormUrl}` : '',
    form.applyLinks?.length ? `**Apply links considered:** ${form.applyLinks.map(link => link.text || link.url).join(', ')}` : '',
    `**Status:** ${form.status || 'unknown'}`,
    form.submitControls?.length ? `**Submit-like controls detected:** ${form.submitControls.join(', ')}` : '**Submit-like controls detected:** none',
    '',
    renderFillPlan(plannedFields),
    '',
    '## Fields Detected',
    plannedFields.length ? plannedFields.flatMap((field, index) => [
      `### ${index + 1}. ${field.question}`,
      `- **Type:** ${field.tag}/${field.type}${field.required ? ' required' : ''}`,
      field.name ? `- **Name:** ${field.name}` : '',
      `- **Fill action:** ${field.action} (${field.risk})`,
      `- **Fill safe:** ${field.fillSafe ? 'yes' : 'no'}`,
      `- **Why:** ${field.fillReason}`,
      field.options?.length ? `- **Options:** ${field.options.join(', ')}` : '',
      '',
    ]).filter(Boolean).join('\n') : '- No visible input, textarea, or select fields were detected.',
    '',
    '## Next Safe Step',
    form.fields.length
      ? '- Run Apply Assistant in draft mode to prepare answers for these fields, then review manually.'
      : '- Confirm this is the actual application form or open it in a guided browser session for manual review.',
  ].filter(Boolean).join('\n');
  return {
    ok: true,
    mode: 'form-reader',
    form,
    fields: plannedFields,
    fillPlan: fillPlanSummary(plannedFields),
    markdown,
    warnings: ['Read-only extraction only. Do not submit until the candidate gives final approval.'],
  };
}

export async function runDeepResearch(input = {}, context = {}) {
  const sourceUrls = [...new Set([...(Array.isArray(input.sourceUrls) ? input.sourceUrls : []), input.url, input.companyUrl].filter(Boolean))];
  const sources = [];
  for (const sourceUrl of sourceUrls.slice(0, 6)) {
    sources.push(await capturePageSource(sourceUrl, { allowLocal: input.allowLocal }).catch(err => ({
      url: sourceUrl,
      title: 'Source unavailable',
      summary: err.message,
      error: err.message,
    })));
  }
  const company = input.company || context.company || sources[0]?.host || 'Company';
  const role = input.role || context.role || 'Role';
  const prompt = buildDeepResearchPrompt({
    ...input,
    company,
    role,
    candidateContext: context.candidateContext || 'Candidate profile stored in Career-Ops.',
    extraQuestions: [
      ...(input.extraQuestions || []),
      'Use the captured sources below; mark everything else as uncertain.',
    ],
  });
  const markdown = [
    `# Deep Research: ${company} - ${role}`,
    '',
    '## Sources Captured',
    sources.length ? sources.map(sourceLine).join('\n') : '- No live source URLs supplied. Research prompt generated only.',
    '',
    '## Synthesis',
    sources.length
      ? sources.map(source => `- ${source.title || source.host}: ${source.summary || 'No summary captured.'}`).join('\n')
      : '- No external claims verified. Treat this as a research brief, not a sourced report.',
    '',
    '## Assisted Research Prompt',
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
    sources: sources.length ? sources.map(source => source.url || source).join(', ') : 'Research sources pending or captured in Deep Research.',
    risks: input.risks || [
      research ? 'Review claims against captured sources before interview use.' : 'No live research attached; confirm company facts before relying on this prep.',
      'Prepare crisp answer for any requirement not strongly evidenced in the CV.',
    ],
  });
  return { ok: true, mode: research || sources.length ? 'assisted' : 'draft', markdown };
}

export async function runOutreach(input = {}, context = {}) {
  const sources = [];
  if (input.contactUrl) {
    sources.push(await capturePageSource(input.contactUrl, { allowLocal: input.allowLocal }).catch(err => ({
      url: input.contactUrl,
      title: 'Contact source unavailable',
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
      safety: 'Draft only. Career-Ops never sends LinkedIn/email messages automatically.',
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
