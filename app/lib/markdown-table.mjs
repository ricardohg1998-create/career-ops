function unescapeCell(value) {
  return String(value || '').replace(/\\\|/g, '|').trim();
}

function escapeCell(value) {
  return String(value ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}

function isSeparatorCell(cell) {
  return /^:?-{3,}:?$/.test(cell.trim());
}

export function parseTableRow(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;

  const cells = [];
  let current = '';
  let escaped = false;

  for (let i = 1; i < trimmed.length - 1; i++) {
    const char = trimmed[i];
    if (escaped) {
      current += char === '|' ? '\\|' : `\\${char}`;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '|') {
      cells.push(unescapeCell(current));
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(unescapeCell(current));
  return cells;
}

export function isMarkdownTableSeparator(line) {
  const cells = parseTableRow(line);
  return Boolean(cells?.length && cells.every(isSeparatorCell));
}

export function parseMarkdownTable(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const rows = [];
  let header = null;
  let startLine = -1;
  let endLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const cells = parseTableRow(lines[i]);
    if (!cells) {
      if (header && endLine === -1) endLine = i;
      continue;
    }
    if (startLine === -1) startLine = i;
    if (!header) {
      header = cells;
      continue;
    }
    if (isMarkdownTableSeparator(lines[i])) continue;
    rows.push(cells);
  }

  if (!header) return { header: [], rows: [], startLine: -1, endLine: -1 };
  return { header, rows, startLine, endLine: endLine === -1 ? lines.length : endLine };
}

export function rowToObject(header, row) {
  return Object.fromEntries(header.map((name, index) => [name, row[index] ?? '']));
}

export function rowsToObjects(header, rows) {
  return rows.map(row => rowToObject(header, row));
}

export function formatTableRow(cells) {
  return `| ${cells.map(escapeCell).join(' | ')} |`;
}

export function formatMarkdownTable(header, rows) {
  const separator = header.map(() => '---');
  return [formatTableRow(header), formatTableRow(separator), ...rows.map(formatTableRow)].join('\n');
}

export function replaceMarkdownTable(markdown, nextTable) {
  const text = String(markdown || '');
  const parsed = parseMarkdownTable(text);
  if (parsed.startLine === -1) return `${text.replace(/\s*$/, '')}\n\n${nextTable}\n`;

  const lines = text.split(/\r?\n/);
  return [
    ...lines.slice(0, parsed.startLine),
    nextTable,
    ...lines.slice(parsed.endLine),
  ].join('\n');
}
