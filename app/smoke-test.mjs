#!/usr/bin/env node

import { spawn } from 'node:child_process';

const port = process.env.CAREER_OPS_APP_SMOKE_PORT || '4174';
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['app/server.mjs'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, CAREER_OPS_APP_PORT: port },
});

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
}

try {
  await waitForServer();
  await assertOk('/api/health', data => typeof data.ok === 'boolean');
  await assertOk('/api/applications', data => Array.isArray(data.applications) && data.metrics);
  await assertOk('/api/pipeline', data => Array.isArray(data.entries));
  await assertOk('/api/reports', data => Array.isArray(data.reports));
  await assertOk('/api/jobs', data => Array.isArray(data.jobs));
  await assertOk('/api/setup/readiness', data => typeof data.ok === 'boolean' && Array.isArray(data.missing));
  await assertOk('/api/setup/data-contract', data => data.ok && Array.isArray(data.userLayer));
  await assertOk('/api/profile/provider-readiness', data => data.ok && 'opencode' in data);
  await assertOk('/api/profile/language', data => data.ok && Array.isArray(data.available));
  await assertOk('/api/integrity/verify', data => 'ok' in data);
  await assertPost('/api/learning/proposal', { company: 'Example', role: 'Role', decision: 'skip' }, data => data.ok && data.proposal?.content);
  await assertPost('/api/modules/deep-research', { company: 'Example', role: 'Role' }, data => data.ok && data.markdown);
  await assertPost('/api/modules/apply-assistant', { company: 'Example', role: 'Role', questions: ['Why this role?'] }, data => data.ok && data.result?.markdown);
  await assertPost('/api/modules/outreach', { company: 'Example', role: 'Role', type: 'recruiter' }, data => data.ok && data.result?.message);
  await assertPost('/api/modules/offer-comparison', { offers: [{ company: 'Example', role: 'Role', scores: { northStar: 4, cvMatch: 4 } }] }, data => data.ok && data.result?.rankings);
  await assertPost('/api/modules/training', { title: 'Course', scores: { northStar: 4, recruiterSignal: 3 } }, data => data.ok && data.result?.verdict);
  await assertPost('/api/modules/project', { title: 'Project', scores: { targetSignal: 4, demoAbility: 4 } }, data => data.ok && data.result?.verdict);
  await assertOk('/api/followups', data => 'ok' in data);
  await assertOk('/api/patterns', data => 'ok' in data);
} finally {
  server.kill();
}
