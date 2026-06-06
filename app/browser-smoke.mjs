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
  await form.getByRole('button', { name: 'Generar asistente' }).click();
  const output = page.locator('#module-output');
  await output.waitFor({ state: 'visible' });
  await page.waitForFunction(expected => {
    const node = document.querySelector('#module-output');
    const text = node?.textContent || '';
    return text.includes(expected) || (!node?.classList.contains('running') && text.trim().length > 0);
  }, expectedText);
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
  await page.locator('#scan-open-btn').click();
  await page.locator('#scan-schedule-card').waitFor();
  const scheduleText = await page.locator('#scan-schedule-card').innerText();
  assert(scheduleText.includes('Rutina de escaneo'), 'scanner schedule card is missing');
  assert(await page.locator('#scan-schedule-form input[name="frequencyDays"]').count() === 1, 'scanner schedule frequency control is missing');
  console.log('ok browser scanner schedule panel');
  await page.locator('#scan-company').fill('Anthropic');
  await page.locator('#scan-form').getByRole('button', { name: 'Escanear' }).click();
  await page.locator('#scan-log .scan-summary').waitFor({ timeout: 30000 });
  const scanSummary = await page.locator('#scan-log .scan-summary').innerText();
  assert(scanSummary.includes('Escaneo simulado completado') && scanSummary.includes('No se han escrito cambios'), 'scan dry-run summary is not human-readable');
  console.log('ok browser scan visual summary');
  await page.locator('[data-view="profile"]').click();
  await page.locator('#scanner-strategy-form').waitFor();
  assert(await page.locator('[role="tablist"] [role="tab"][aria-selected="true"]').count() === 1, 'profile tabs need one selected ARIA tab');
  await page.locator('#profile-tab-cv').click();
  assert(await page.locator('#profile-tab-cv[aria-selected="true"]').count() === 1, 'profile tab selection ARIA did not update');
  assert(await page.locator('#profile-editor[role="tabpanel"]:not([hidden])').count() === 1, 'profile editor tabpanel is not exposed after tab click');
  await page.locator('#profile-tab-insights').click();
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

  await submitModule(page, 'apply-assistant', 'No envíes nada hasta dar aprobación final.', '');
  await submitModule(page, 'deep-research', 'Devuelve hallazgos estructurados con fuentes');
  await submitModule(page, 'interview-prep', 'Checklist de preparación');
  await submitModule(page, 'outreach', 'Fixture outreach');
  await submitModule(page, 'offer-comparison', 'Comparativa de ofertas');
  await submitModule(page, 'training', 'Veredicto');
  await submitModule(page, 'project', 'Veredicto');

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

  await page.locator('[data-view="tracker"]').click();
  await page.locator('#applications-table').waitFor();
  assert(await page.locator('#applications-table[role="grid"]').count() === 1, 'tracker needs grid role');
  assert(await page.locator('#applications-table [role="columnheader"]').count() >= 5, 'tracker grid headers are missing');
  const trackerRows = page.locator('#applications-table [data-select-app]');
  if (await trackerRows.count()) {
    await trackerRows.first().click();
    await page.locator('[data-view="evaluate"]').click();
    await page.locator('#evaluate-jd').waitFor();
    const hydratedText = await page.locator('#evaluate-jd').inputValue();
    if (hydratedText.includes('Contexto del informe seleccionado')) {
      const requestsBeforeHydrated = autoPipelineRequests.length;
      await page.locator('#evaluate-url').fill('');
      await page.locator('#auto-pipeline-btn').click();
      await page.waitForFunction(() => document.querySelector('#evaluate-log')?.textContent?.trim().length > 0);
      const hydratedGuardText = await page.locator('#evaluate-log').textContent();
      assert(/contexto seleccionado|oferta completa/i.test(hydratedGuardText), 'hydrated-context auto-pipeline guard text is missing');
      assert(autoPipelineRequests.length === requestsBeforeHydrated, 'hydrated-context auto-pipeline click dispatched a job request');
      console.log('ok browser auto-pipeline hydrated-context guard');
      await page.locator('[data-view="dossier"]').click();
      await page.locator('#module-context:not(.hidden)').waitFor();
      const contextText = await page.locator('#module-context').innerText();
      assert(contextText.includes('Limpiar contexto'), 'dossier context strip is missing clear action');
      await page.locator('[data-clear-module-context]').click();
      assert(await page.locator('#module-context.hidden').count() === 1, 'dossier context strip did not clear');
      console.log('ok browser dossier context strip');
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.app-shell').waitFor();
  await page.locator('[data-view="tracker"]').click();
  await page.locator('#applications-table').waitFor();
  if (await page.locator('.outcome-journal').count()) {
    const outcomeText = await page.locator('.outcome-journal').first().innerText();
    assert(outcomeText.includes('Registrar decision') || outcomeText.includes('Registrar'), 'post-apply outcome journal is missing');
    assert(await page.locator('.outcome-journal textarea[name="finalAnswers"]').count() >= 1, 'final answers capture is missing');
    console.log('ok browser outcome journal panel');
  }
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

  await page.locator('[data-view="system"]').click();
  await page.locator('[data-v1-action="/api/profile/provider-readiness"]').click();
  await page.locator('#update-log .system-result details').waitFor();
  const systemSummary = await page.locator('#update-log .system-result').innerText();
  assert(systemSummary.includes('Resultado') && systemSummary.includes('Detalles técnicos'), 'system action result needs human summary plus technical details');
  console.log('ok browser system human-readable result');

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
