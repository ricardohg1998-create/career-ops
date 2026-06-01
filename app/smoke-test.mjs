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

try {
  await waitForServer();
  await assertOk('/api/health', data => typeof data.ok === 'boolean');
  await assertOk('/api/applications', data => Array.isArray(data.applications) && data.metrics);
  await assertOk('/api/pipeline', data => Array.isArray(data.entries));
  await assertOk('/api/followups', data => 'ok' in data);
  await assertOk('/api/patterns', data => 'ok' in data);
} finally {
  server.kill();
}
