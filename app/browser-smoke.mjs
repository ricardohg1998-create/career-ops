#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = process.env.CAREER_OPS_APP_BROWSER_SMOKE_PORT || '4175';
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['app/server.mjs'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, CAREER_OPS_APP_PORT: port },
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

async function submitModule(page, kind, expectedText, notes = [
  'Why this role?',
  'Salary expectations?',
  'Work authorization?',
].join('\n')) {
  const form = page.locator('#module-form');
  await form.locator('#module-kind').selectOption(kind);
  await form.locator('input[name="company"]').fill(`Fixture ${kind}`);
  await form.locator('input[name="role"]').fill('Assisted Module Role');
  await form.locator('textarea[name="notes"]').fill(notes);
  await page.locator('#module-output').evaluate(node => node.textContent = '');
  await form.locator('button').click();
  const output = page.locator('#module-output');
  await output.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#module-output')?.textContent?.trim().length > 0);
  const text = await output.textContent();
  assert(text.includes(expectedText), `${kind} output did not include "${expectedText}"`);
  assert(!/\b(submitted|sent application|clicked submit)\b/i.test(text), `${kind} output implies a real submission`);
  console.log(`ok browser module ${kind}`);
}

try {
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const autoPipelineRequests = [];
  page.on('request', request => {
    if (request.url().includes('/api/jobs/auto-pipeline')) autoPipelineRequests.push(request.url());
  });

  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.safety-pill').waitFor();
  const safetyText = await page.locator('.safety-pill').textContent();
  assert(safetyText.includes('No env') && safetyText.includes('aplica'), 'app-level no-submit safety banner is missing');
  if (await page.locator('#north-star-answer .primary-btn').count()) {
    await page.locator('#north-star-answer .primary-btn').click();
    if (await page.locator('.application-console').count()) {
      assert(await page.locator('[data-learning-template="score_too_high"]').count() === 1, 'guided learning feedback action is missing');
    }
    await page.locator('[data-view="home"]').click();
  }
  await page.locator('[data-view="opportunities"]').click();
  await page.locator('#scanner-discovery').waitFor();
  const discoveryText = await page.locator('#scanner-discovery').innerText();
  assert(discoveryText.includes('Ofertas descubiertas automaticamente'), 'scanner discovery panel is missing');
  console.log('ok browser scanner discovery panel');
  await page.locator('[data-view="profile"]').click();
  await page.locator('#scanner-strategy-form').waitFor();
  const strategyText = await page.locator('#scanner-strategy-form').innerText();
  assert(strategyText.includes('Empresas objetivo'), 'scanner strategy form is missing company controls');
  assert(await page.locator('#scanner-companies input[name="enabledCompany"]').count() > 0, 'scanner strategy company checkboxes are missing');
  console.log('ok browser scanner strategy panel');
  const followups = await page.evaluate(async () => {
    const res = await fetch('/api/followups');
    return res.ok ? res.json() : null;
  });
  const followupEntries = followups?.data?.entries || followups?.entries || [];
  if (followupEntries.length) {
    const homeText = await page.locator('#followup-summary').textContent();
    assert(homeText.includes(followupEntries[0].company), 'home follow-up summary hides API entries');
  }
  await page.locator('[data-view="dossier"]').click();
  await page.locator('#module-form').waitFor();
  assert((await page.locator('#module-form').textContent()).includes('Generar asistente'), 'assistant CTA copy is missing');
  assert(await page.locator('#module-kind option[value="form-reader"]').count() === 1, 'form-reader module option is missing');

  await submitModule(page, 'apply-assistant', 'Do not submit until the candidate gives final approval.', '');
  await submitModule(page, 'deep-research', 'Return structured findings with sources');
  await submitModule(page, 'interview-prep', 'Prep Checklist');
  await submitModule(page, 'outreach', 'Fixture outreach');
  await submitModule(page, 'offer-comparison', 'Offer Comparison');
  await submitModule(page, 'training', 'Verdict');
  await submitModule(page, 'project', 'Verdict');

  await page.locator('[data-view="evaluate"]').click();
  await page.locator('#evaluate-url').waitFor();
  await page.locator('#evaluate-url').fill('');
  await page.locator('#evaluate-jd').fill('');
  await page.locator('#auto-pipeline-btn').click();
  await page.waitForFunction(() => document.querySelector('#evaluate-log')?.textContent?.trim().length > 0);
  const emptyGuardText = await page.locator('#evaluate-log').textContent();
  assert(emptyGuardText.includes('Pega una') && emptyGuardText.includes('URL'), 'empty auto-pipeline guard text is missing');
  assert(autoPipelineRequests.length === 0, 'empty auto-pipeline click dispatched a job request');
  console.log('ok browser auto-pipeline empty-input guard');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.app-shell').waitFor();
  await page.locator('[data-view="tracker"]').click();
  await page.locator('#applications-table').waitFor();
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 2;
  });
  assert(!overflow, 'mobile viewport has horizontal overflow');
  console.log('ok browser mobile viewport');

  // Navigation: click through all 7 sections and verify each becomes active
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(base, { waitUntil: 'networkidle' });
  const sections = ['home', 'opportunities', 'evaluate', 'dossier', 'tracker', 'profile', 'system'];
  for (const section of sections) {
    const nav = page.locator(`[data-view="${section}"]`);
    if (await nav.count() === 0) continue;
    await nav.click();
    await page.waitForTimeout(200);
    const isActive = await nav.evaluate(el => el.classList.contains('active') || el.getAttribute('aria-current') === 'page' || el.closest('.active') !== null);
    assert(isActive, `nav section "${section}" did not become active after click`);
  }
  console.log('ok browser navigation sections');

  // Verify no visible key English words remain in the UI
  const forbiddenPhrases = [
    'Command Center',
    'Batch control room',
    'Draft only',
    'Assisted mode',
    'No submit/send/apply',
    'Liveness',
    'Merge tracker',
    'System Layer',
  ];
  const bodyText = await page.locator('body').innerText();
  for (const phrase of forbiddenPhrases) {
    assert(!bodyText.includes(phrase), `UI body contains English phrase: "${phrase}"`);
  }
  console.log('ok browser no English key phrases');

  await browser.close();
} finally {
  server.kill();
}
