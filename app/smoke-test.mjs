#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { renderCvTemplate } from './lib/cv-workspace.mjs';

const port = process.env.CAREER_OPS_APP_SMOKE_PORT || '4174';
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['app/server.mjs'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, CAREER_OPS_APP_PORT: port },
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(value, needle, label) {
  assert(String(value).includes(needle), `${label} missing "${needle}"`);
}

function waitForServer() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server did not start in time')), 10000);
    server.stdout.on('data', data => {
      if (String(data).includes('Career-Ops web app disponible')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.stderr.on('data', data => process.stderr.write(data));
  });
}

async function assertOk(path, check) {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  const data = await res.json();
  if (check && !check(data)) throw new Error(`${path} returned unexpected payload`);
  console.log(`ok ${path}`);
  return data;
}

async function assertPost(path, body, check) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  const data = await res.json();
  if (check && !check(data)) throw new Error(`${path} returned unexpected payload`);
  console.log(`ok ${path}`);
  return data;
}

function listFiles(dir) {
  return existsSync(dir) ? readdirSync(dir).sort() : [];
}

function commandText(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', data => stdout += data);
    child.stderr.on('data', data => stderr += data);
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`${args.join(' ')} exited ${code}\n${stdout}\n${stderr}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function assertMockAutoPipelineFixture() {
  const reportsBefore = listFiles('reports');
  const additionsBefore = listFiles(path.join('batch', 'tracker-additions'));
  const result = await commandText([
    'opencode-eval.mjs',
    '--mock',
    '--no-save',
    '--file',
    path.join('app', 'test-fixtures', 'auto-pipeline-mock-jd.md'),
    '--url',
    'https://jobs.example.test/mock-role',
  ]);
  assertIncludes(result.stdout, 'Mock Mode enabled', 'mock evaluation output');
  assertIncludes(result.stdout, 'SCORE', 'mock evaluation output');
  assert(
    JSON.stringify(reportsBefore) === JSON.stringify(listFiles('reports')),
    'mock fixture evaluation changed reports/'
  );
  assert(
    JSON.stringify(additionsBefore) === JSON.stringify(listFiles(path.join('batch', 'tracker-additions'))),
    'mock fixture evaluation changed batch/tracker-additions/'
  );
  console.log('ok auto-pipeline mock fixture (--no-save)');
}

function assertOpenCodeLanguagePolicy() {
  const source = readFileSync('opencode-eval.mjs', 'utf-8');
  assert(!source.includes('Generate Blocks A through G in full, in English'), 'opencode evaluator still forces English internal reports');
  assert(source.includes('internal evaluation report') && source.includes('language.modes_dir'), 'opencode evaluator does not document localized internal report language');
  console.log('ok opencode localized report language policy');
}

function assertCvRendererPolicy() {
  const draft = renderCvTemplate(process.cwd(), {
    title: 'CV smoke test',
    jdText: 'Head of Growth Marketing MarTech CRM funnels automation',
    format: 'a4',
  });
  const body = draft.html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || draft.html;
  assertIncludes(body, 'Ricardo Huertas', 'cv renderer body');
  assertIncludes(body, 'Perfil Profesional', 'cv renderer body');
  assertIncludes(body, 'Competencias Clave', 'cv renderer body');
  assertIncludes(body, 'Experiencia Profesional', 'cv renderer body');
  assert(!body.includes('[object Object]'), 'cv renderer leaked object values into visible HTML');
  assert(!body.includes('TARGETED KEYWORDS'), 'cv renderer leaked old English keyword label');
  assert(!body.includes('>Professional Summary<'), 'cv renderer did not localize summary label');
  assert(!body.includes('**'), 'cv renderer left raw markdown emphasis in visible HTML');
  console.log('ok localized cv renderer policy');
}

try {
  await waitForServer();
  assertOpenCodeLanguagePolicy();
  assertCvRendererPolicy();
  await assertOk('/api/health', data => typeof data.ok === 'boolean');
  await assertOk('/api/dashboard', data => data.ok && data.metrics && data.priorities && data.health);
  await assertOk('/api/next-actions', data => data.ok && Array.isArray(data.actions));
  const appPayload = await assertOk('/api/applications', data => Array.isArray(data.applications) && data.metrics);
  if (appPayload.applications.length) {
    await assertPost(`/api/applications/${appPayload.applications[0].number}/outcome`, {
      status: appPayload.applications[0].status,
      outcome: 'note',
      notes: 'Smoke dry run',
      finalAnswers: 'No real submission.',
      dryRun: true,
    }, data => data.ok && data.dryRun && data.path === 'data/application-events.md');
  }
  await assertOk('/api/pipeline', data => Array.isArray(data.entries));
  await assertOk('/api/reports', data => Array.isArray(data.reports));
  await assertOk('/api/jobs', data => Array.isArray(data.jobs));
  await assertOk('/api/setup/readiness', data => typeof data.ok === 'boolean' && Array.isArray(data.missing));
  await assertOk('/api/setup/data-contract', data => data.ok && Array.isArray(data.userLayer));
  await assertOk('/api/profile/provider-readiness', data => data.ok && 'opencode' in data);
  await assertOk('/api/profile/language', data => data.ok && Array.isArray(data.available));
  await assertOk('/api/integrity/verify', data => 'ok' in data);
  const learning = await assertPost('/api/learning/proposal', { company: 'Example', role: 'Role', decision: 'skip' }, data => data.ok && data.proposal?.content);
  assert(learning.proposal.destination === 'profileMode', 'learning proposal is not routed to the user profile mode file');
  const guidedLearning = await assertPost('/api/learning/proposal', {
    company: 'Example',
    role: 'Role',
    feedbackType: 'score_too_high',
    decision: 'score_too_high',
  }, data => data.ok && data.proposal?.content);
  assertIncludes(guidedLearning.proposal.content, 'Tipo de aprendizaje: score_too_high', 'guided learning type');
  assertIncludes(guidedLearning.proposal.content, 'Ajuste sugerido', 'guided learning adjustment');

  const deepResearch = await assertPost('/api/modules/deep-research', { company: 'Example', role: 'Role' }, data => data.ok && data.markdown);
  assertIncludes(deepResearch.markdown, 'Return structured findings with sources', 'deep research module');
  const assistedResearch = await assertPost('/api/modules/deep-research', { company: 'Example', role: 'Role', mode: 'assisted', dryRun: true }, data => data.ok && data.dryRun && data.result?.markdown);
  assertIncludes(assistedResearch.result.markdown, 'Sources Captured', 'assisted research dry-run');

  const applyAssistant = await assertPost('/api/modules/apply-assistant', {
    company: 'Example',
    role: 'Role',
    questions: ['Why this role?', 'Salary expectations?', 'Work authorization?'],
  }, data => data.ok && data.result?.markdown && Array.isArray(data.result.responses));
  assert(applyAssistant.result.responses.length === 3, 'apply assistant did not draft every requested answer');
  assertIncludes(applyAssistant.result.markdown, 'Review every answer before pasting it into the form.', 'apply assistant guardrail');
  assertIncludes(applyAssistant.result.markdown, 'Do not submit until the candidate gives final approval.', 'apply assistant guardrail');
  assertIncludes(applyAssistant.result.markdown, 'Writing style applied', 'apply assistant personal voice');
  const assistedApply = await assertPost('/api/modules/apply-assistant', {
    company: 'Example',
    role: 'Role',
    mode: 'assisted',
    dryRun: true,
    questions: ['Why this role?'],
  }, data => data.ok && data.dryRun && data.result?.markdown);
  assertIncludes(assistedApply.result.markdown, 'No automatic submit', 'assisted apply safety');
  assert(assistedApply.result.writingStyleApplied === true, 'assisted apply did not receive personal writing style');
  assertIncludes(assistedApply.result.markdown, 'Safe Fill Plan', 'assisted apply safe fill plan');

  const formReader = await assertPost('/api/modules/form-reader', {
    company: 'Example',
    role: 'Role',
    mode: 'assisted',
    dryRun: true,
    allowLocal: true,
    url: `${base}/offer-with-apply-fixture.html`,
  }, data => data.ok && data.dryRun && data.result?.form?.fields?.length >= 4);
  assertIncludes(formReader.result.markdown, 'Read-only inspection', 'form reader safety');
  assertIncludes(formReader.result.markdown, 'Auto-discovered form', 'form reader auto discovery');
  assertIncludes(formReader.result.markdown, 'Safe Fill Plan', 'form reader safe fill plan');
  assert(formReader.result.fillPlan.safePrefill >= 1, 'form reader did not mark stable profile fields as safe prefill');
  assertIncludes(formReader.result.markdown, 'Why this role?', 'form reader field extraction');
  assertIncludes(formReader.result.markdown, 'Submit application', 'form reader submit detection');

  const outreach = await assertPost('/api/modules/outreach', { company: 'Example', role: 'Role', type: 'recruiter', maxLength: 180 }, data => data.ok && data.result?.message);
  assert(outreach.result.withinLimit, 'outreach module exceeded requested length');
  await assertPost('/api/modules/interview-prep', { company: 'Example', role: 'Role', mode: 'assisted', dryRun: true }, data => data.ok && data.dryRun && data.result?.markdown);
  await assertPost('/api/modules/outreach', { company: 'Example', role: 'Role', mode: 'assisted', dryRun: true }, data => data.ok && data.dryRun && data.result?.result?.message);

  const comparison = await assertPost('/api/modules/offer-comparison', {
    offers: [
      { company: 'StrongCo', role: 'AI Engineer', scores: { northStar: 5, cvMatch: 5, level: 4 } },
      { company: 'WeakCo', role: 'Legacy Admin', scores: { northStar: 1, cvMatch: 1, level: 1 } },
    ],
  }, data => data.ok && data.result?.rankings);
  assert(comparison.result.rankings[0].company === 'StrongCo', 'offer comparison ranking is not score-ordered');
  assertIncludes(comparison.result.rankings.at(-1).recommendation, 'Recommend against applying', 'low-fit offer recommendation');

  await assertPost('/api/modules/training', { title: 'Course', scores: { northStar: 4, recruiterSignal: 3 } }, data => data.ok && data.result?.verdict);
  await assertPost('/api/modules/project', { title: 'Project', scores: { targetSignal: 4, demoAbility: 4 } }, data => data.ok && data.result?.verdict);
  await assertOk('/api/scanner/history', data => data.ok && Array.isArray(data.entries));
  const discovery = await assertOk('/api/scanner/discovery', data => data.ok && data.summary && Array.isArray(data.entries));
  assert('pending' in discovery.summary, 'scanner discovery summary is missing pending count');
  if (discovery.entries.length) assert(discovery.entries[0].recommendedAction, 'scanner discovery entries need an action');
  const strategy = await assertOk('/api/scanner/strategy', data => data.ok && data.titleFilter && data.summary && Array.isArray(data.companies));
  assert(Array.isArray(strategy.titleFilter.positive), 'scanner strategy needs positive title keywords');
  assert('enabledCompanies' in strategy.summary, 'scanner strategy summary is missing enabled company count');
  const schedule = await assertOk('/api/scanner/schedule', data => data.ok && typeof data.enabled === 'boolean' && data.command);
  assert(Number.isFinite(schedule.frequencyDays), 'scanner schedule needs a numeric frequency');
  await assertPost('/api/jobs/batch', { dryRun: true, tsv: 'https://example.com/jobs/1\tExample\tRole' }, data => data.ok && data.dryRun && data.rows.length === 1);
  await assertOk('/api/followups', data => 'ok' in data);
  await assertOk('/api/patterns', data => 'ok' in data);
  await assertMockAutoPipelineFixture();
} finally {
  server.kill();
}
