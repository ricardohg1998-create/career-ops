export const JOB_EVENT_TYPES = Object.freeze({
  START: 'start',
  STDOUT: 'stdout',
  STDERR: 'stderr',
  ERROR: 'error',
  DONE: 'done',
});

export function nowIso() {
  return new Date().toISOString();
}

export function createJobEvent(type, fields = {}) {
  const cleanType = String(type || '').trim();
  if (!cleanType) throw new TypeError('Job event type is required');

  const event = {
    type: cleanType,
    at: fields.at || nowIso(),
  };

  if ('line' in fields) event.line = String(fields.line);
  if ('jobId' in fields) event.jobId = String(fields.jobId);
  if ('kind' in fields) event.kind = String(fields.kind);
  if ('code' in fields) event.code = fields.code;
  if ('status' in fields) event.status = String(fields.status);
  if ('data' in fields) event.data = fields.data;

  return event;
}

export function createLineEvents(type, chunk, fields = {}) {
  return String(chunk)
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => createJobEvent(type, { ...fields, line }));
}

export function createDoneEvent({ jobId, kind, status, code, at } = {}) {
  const line = [kind, status].filter(Boolean).join(' ');
  return createJobEvent(JOB_EVENT_TYPES.DONE, { jobId, kind, status, code, at, line });
}

export function encodeSseEvent(event) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function writeSseEvent(res, event) {
  res.write(encodeSseEvent(event));
}

export function replayJobEvents(res, events = []) {
  for (const event of events) writeSseEvent(res, event);
}
