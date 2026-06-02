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

export async function extractApplicationForm(url, options = {}) {
  const target = normalizeHttpUrl(url, { allowLocal: Boolean(options.allowLocal) });
  return withPage(async page => {
    const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs || DEFAULT_TIMEOUT }).catch(() => null);
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    const fields = await page.locator('input, textarea, select').evaluateAll(nodes => nodes
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
    const submitControls = await page.locator('button,input[type="submit"],a').evaluateAll(nodes => nodes
      .map(node => (node.innerText || node.value || node.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim())
      .filter(text => /submit|send|apply|postular|enviar/i.test(text))
      .slice(0, 20)).catch(() => []);
    return {
      url: target,
      finalUrl: page.url(),
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
  const draft = draftApplicationResponses({
    company: context.company,
    role: context.role,
    questions: [question],
    proofPoints: context.proofPoints,
    reportSummary: context.reportSummary,
    jobSignal: context.jobSignal,
    compensation: context.compensation,
    workAuthorization: context.workAuthorization,
  });
  const response = draft.responses[0]?.answer || '';
  let source = 'report/profile';
  let confidence = 0.72;
  if (/email/i.test(question)) {
    source = 'config/profile.yml';
    confidence = 0.9;
  } else if (/salary|compensation|visa|authorization/i.test(question)) {
    source = 'profile/logistics';
    confidence = 0.62;
  } else if (field.tag === 'select') {
    source = 'requires user choice';
    confidence = 0.4;
  }
  return { ...field, answer: response, confidence, source, action: 'copy_only' };
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
  const form = input.formUrl ? await extractApplicationForm(input.formUrl, { allowLocal: input.allowLocal }) : null;
  const fields = form?.fields?.length
    ? form.fields
    : (questions.length ? questions : defaultQuestions).map((question, index) => ({ index, tag: 'textarea', type: 'textarea', question, required: false, options: [] }));
  const mappedFields = fields.map(field => mapField(field, context));
  const markdown = [
    `## Apply Assistant: ${context.company || input.company || 'Company'} - ${context.role || input.role || 'Role'}`,
    '',
    '**Safety:** Draft/copy only. No automatic submit, send, or apply action is performed.',
    form ? `**Form URL:** ${form.finalUrl || form.url}` : '',
    '',
    ...mappedFields.flatMap((field, index) => [
      `### ${index + 1}. ${field.question}`,
      `- **Type:** ${field.tag}/${field.type}${field.required ? ' required' : ''}`,
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
    markdown,
    warnings: ['Review every field before pasting. Career-Ops does not submit forms.'],
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
