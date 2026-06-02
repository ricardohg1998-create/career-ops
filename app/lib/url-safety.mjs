import net from 'node:net';

const DEFAULT_ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const LOCAL_HOSTNAMES = new Set(['localhost', 'localhost.localdomain']);

function parseIPv4(hostname) {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map(part => Number(part));
  if (nums.some(num => !Number.isInteger(num) || num < 0 || num > 255)) return null;
  return nums;
}

function isPrivateIPv4(hostname) {
  const ip = parseIPv4(hostname);
  if (!ip) return false;
  const [a, b] = ip;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isUnsafeIPv6(hostname) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  );
}

export function parseUrl(value) {
  try {
    return new URL(String(value || '').trim());
  } catch {
    return null;
  }
}

export function getHostname(value) {
  const url = value instanceof URL ? value : parseUrl(value);
  return url ? url.hostname.replace(/^www\./i, '') : '';
}

export function checkHttpUrl(value, options = {}) {
  const allowedProtocols = options.allowedProtocols || DEFAULT_ALLOWED_PROTOCOLS;
  const allowLocal = Boolean(options.allowLocal);
  const url = parseUrl(value);

  if (!url) return { ok: false, reason: 'invalid_url' };
  if (!allowedProtocols.has(url.protocol)) return { ok: false, reason: 'unsupported_protocol', url };

  const hostname = url.hostname.toLowerCase();
  if (!hostname) return { ok: false, reason: 'missing_hostname', url };
  if (!allowLocal && LOCAL_HOSTNAMES.has(hostname)) return { ok: false, reason: 'local_hostname', url };

  const ipVersion = net.isIP(hostname);
  if (!allowLocal && ipVersion === 4 && isPrivateIPv4(hostname)) return { ok: false, reason: 'private_ipv4', url };
  if (!allowLocal && ipVersion === 6 && isUnsafeIPv6(hostname)) return { ok: false, reason: 'private_ipv6', url };

  return { ok: true, url };
}

export function assertHttpUrl(value, options = {}) {
  const result = checkHttpUrl(value, options);
  if (!result.ok) {
    const err = new Error(`Unsafe or invalid URL: ${result.reason}`);
    err.code = result.reason;
    throw err;
  }
  return result.url;
}

export function normalizeHttpUrl(value, options = {}) {
  const url = assertHttpUrl(value, options);
  url.hash = '';
  return url.toString();
}

export function isSafeHttpUrl(value, options = {}) {
  return checkHttpUrl(value, options).ok;
}
