import { spawn } from 'node:child_process';

export function runCommand(command, args = [], options = {}) {
  const timeoutMs = Number(options.timeoutMs || 0);
  const maxBuffer = Number(options.maxBuffer || 10 * 1024 * 1024);

  return new Promise(resolve => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      env: { ...process.env, FORCE_COLOR: '0', ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killedForBuffer = false;
    let timer = null;

    const append = (stream, chunk) => {
      const text = String(chunk);
      if (stream === 'stdout') stdout += text;
      else stderr += text;
      options.onOutput?.(stream, text);
      if (stdout.length + stderr.length > maxBuffer) {
        killedForBuffer = true;
        child.kill();
      }
    };

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);
    }

    child.stdout.on('data', chunk => append('stdout', chunk));
    child.stderr.on('data', chunk => append('stderr', chunk));
    child.on('error', err => {
      if (timer) clearTimeout(timer);
      resolve({ ok: false, code: null, stdout, stderr, error: err.message, timedOut, killedForBuffer });
    });
    child.on('close', code => {
      if (timer) clearTimeout(timer);
      resolve({ ok: code === 0 && !timedOut && !killedForBuffer, code, stdout, stderr, timedOut, killedForBuffer });
    });
  });
}

export function runNodeScript(scriptPath, args = [], options = {}) {
  return runCommand(process.execPath, [scriptPath, ...args], options);
}

export async function runJsonCommand(command, args = [], options = {}) {
  const result = await runCommand(command, args, options);
  try {
    return { ...result, data: JSON.parse(result.stdout) };
  } catch {
    return { ...result, ok: false, data: null, error: result.error || 'Script did not return JSON' };
  }
}

export function runJsonNodeScript(scriptPath, args = [], options = {}) {
  return runJsonCommand(process.execPath, [scriptPath, ...args], options);
}
