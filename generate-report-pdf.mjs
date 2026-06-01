#!/usr/bin/env node

/**
 * generate-report-pdf.mjs — Markdown Report → Stunning executive PDF via Playwright
 *
 * Usage:
 *   node generate-report-pdf.mjs <input.md> <output.pdf>
 */

import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Simple, extremely robust markdown-to-HTML parser designed specifically for career-ops reports
function parseMarkdownToHTML(markdown) {
  let lines = markdown.split('\n');
  let html = '';
  let inList = false;
  let listType = null; // 'ul' or 'ol'
  let inTable = false;
  let tableHeaderParsed = false;
  let tableRows = [];

  const closeListIfNeeded = () => {
    if (inList) {
      html += `</${listType}>\n`;
      inList = false;
      listType = null;
    }
  };

  const closeTableIfNeeded = () => {
    if (inTable) {
      html += renderTable(tableRows);
      inTable = false;
      tableHeaderParsed = false;
      tableRows = [];
    }
  };

  function renderTable(rows) {
    if (rows.length === 0) return '';
    let out = '<table>\n';
    
    // Check if rows[1] is a separator (like |---|---|)
    let startIndex = 0;
    let headers = [];
    
    if (rows[0] && rows[1] && rows[1].every(cell => /^[:-|-]+$/.test(cell.trim()))) {
      headers = rows[0];
      startIndex = 2;
    } else if (rows[0]) {
      headers = rows[0];
      startIndex = 1;
    }

    if (headers.length > 0) {
      out += '  <thead>\n    <tr>\n';
      for (const h of headers) {
        out += `      <th>${formatInline(h)}</th>\n`;
      }
      out += '    </tr>\n  </thead>\n';
    }

    out += '  <tbody>\n';
    for (let r = startIndex; r < rows.length; r++) {
      out += '    <tr>\n';
      for (const cell of rows[r]) {
        out += `      <td>${formatInline(cell)}</td>\n`;
      }
      out += '    </tr>\n';
    }
    out += '  </tbody>\n</table>\n';
    return out;
  }

  function formatInline(text) {
    let t = text.trim();
    // Escape standard HTML tags in text to avoid issues
    t = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Bold **text**
    t = t.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic *text*
    t = t.replace(/\*([^\*]+)\*/g, '<em>$1</em>');

    // Inline code `code`
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Link [text](url)
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Emoji/Icon pill formatting for specific tags
    t = t.replace(/✅ Excelente/g, '<span class="gap-badge gap-none">✅ Excelente</span>');
    t = t.replace(/✅/g, '<span class="gap-badge gap-none">✅</span>');
    t = t.replace(/⚠️ Medio-Alto/g, '<span class="gap-badge gap-moderate">⚠️ Medio-Alto</span>');
    t = t.replace(/⚠️ Medio/g, '<span class="gap-badge gap-moderate">⚠️ Medio</span>');
    t = t.replace(/⚠️/g, '<span class="gap-badge gap-moderate">⚠️</span>');
    t = t.replace(/❌ Bajo-moderado/g, '<span class="gap-badge gap-critical">❌ Bajo-moderado</span>');
    t = t.replace(/❌/g, '<span class="gap-badge gap-critical">❌</span>');
    
    return t;
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Skip empty lines but close lists and tables
    if (line === '') {
      closeListIfNeeded();
      closeTableIfNeeded();
      continue;
    }

    // Skip horizontal rule lines that separate header metadata
    if (line === '---') {
      closeListIfNeeded();
      closeTableIfNeeded();
      html += '<hr>\n';
      continue;
    }

    // Table Row detection: | cell | cell |
    if (line.startsWith('|') && line.endsWith('|')) {
      closeListIfNeeded();
      inTable = true;
      let cells = line.split('|').slice(1, -1).map(c => c.trim());
      tableRows.push(cells);
      continue;
    } else {
      closeTableIfNeeded();
    }

    // Header 1
    if (line.startsWith('# ')) {
      closeListIfNeeded();
      html += `<h1>${formatInline(line.slice(2))}</h1>\n`;
      continue;
    }

    // Header 2
    if (line.startsWith('## ')) {
      closeListIfNeeded();
      html += `<h2>${formatInline(line.slice(3))}</h2>\n`;
      continue;
    }

    // Header 3
    if (line.startsWith('### ')) {
      closeListIfNeeded();
      html += `<h3>${formatInline(line.slice(4))}</h3>\n`;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      closeListIfNeeded();
      html += `<blockquote>${formatInline(line.slice(2))}</blockquote>\n`;
      continue;
    }

    // Unordered List (- or *)
    if (line.startsWith('- ') || line.startsWith('* ')) {
      let content = line.startsWith('- ') ? line.slice(2) : line.slice(2);
      if (!inList || listType !== 'ul') {
        closeListIfNeeded();
        inList = true;
        listType = 'ul';
        html += '<ul>\n';
      }
      html += `  <li>${formatInline(content)}</li>\n`;
      continue;
    }

    // Numbered List (1. 2. etc.)
    if (/^\d+\.\s/.test(line)) {
      let content = line.replace(/^\d+\.\s/, '');
      if (!inList || listType !== 'ol') {
        closeListIfNeeded();
        inList = true;
        listType = 'ol';
        html += '<ol>\n';
      }
      html += `  <li>${formatInline(content)}</li>\n`;
      continue;
    }

    // Standard paragraph
    closeListIfNeeded();
    html += `<p>${formatInline(line)}</p>\n`;
  }

  closeListIfNeeded();
  closeTableIfNeeded();

  return html;
}

// Generates the fully styled HTML from parsed report markdown
function buildHTMLReport(markdownContent) {
  // Extract report title and metadata at the top
  const titleMatch = markdownContent.match(/^#\s*Evaluation:\s*([^\n]+)/m) || 
                     markdownContent.match(/^#\s*([^\n]+)/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Evaluation Report';

  // Extract Metadata entries
  const metadata = {
    company: 'Unknown',
    role: 'Unknown',
    date: 'N/A',
    url: 'N/A',
    score: 'N/A',
    archetype: 'N/A',
    legitimacy: 'N/A',
    tool: 'N/A'
  };

  // Parse title into company + role if possible (e.g. SYRSA — Responsable CRM)
  if (title.includes('—')) {
    const parts = title.split('—');
    metadata.company = parts[0].trim();
    metadata.role = parts[1].trim();
  } else if (title.includes(':')) {
    const parts = title.split(':');
    if (parts[1] && parts[1].includes('—')) {
      const subparts = parts[1].split('—');
      metadata.company = subparts[0].trim();
      metadata.role = subparts[1].trim();
    }
  }

  const dateMatch = markdownContent.match(/\*\*Date:\*\*\s*([^\n]+)/i);
  if (dateMatch) metadata.date = dateMatch[1].trim();

  const urlMatch = markdownContent.match(/\*\*URL:\*\*\s*([^\n]+)/i);
  if (urlMatch) metadata.url = urlMatch[1].trim();

  const scoreMatch = markdownContent.match(/\*\*Score:\*\*\s*([^\n]+)/i);
  if (scoreMatch) metadata.score = scoreMatch[1].trim();

  const archetypeMatch = markdownContent.match(/\*\*Archetype:\*\*\s*([^\n]+)/i);
  if (archetypeMatch) metadata.archetype = archetypeMatch[1].trim();

  const legitimacyMatch = markdownContent.match(/\*\*Legitimacy:\*\*\s*([^\n]+)/i);
  if (legitimacyMatch) metadata.legitimacy = legitimacyMatch[1].trim();

  const toolMatch = markdownContent.match(/\*\*Tool:\*\*\s*([^\n]+)/i);
  if (toolMatch) metadata.tool = toolMatch[1].trim();

  // Strip the title and metadata header block from the markdown to avoid duplication in body
  let cleanedMarkdown = markdownContent
    .replace(/^#\s*Evaluation:[\s\S]*?(?=##|---)/i, '') // strip title and keys
    .replace(/^---\s*$/m, '') // strip leading hr
    .trim();

  // If there's another duplicate header line, strip it
  if (cleanedMarkdown.startsWith('# Evaluation:')) {
    cleanedMarkdown = cleanedMarkdown.replace(/^#\s*Evaluation:[\s\S]*?(?=##|---)/i, '').trim();
  }
  
  // Make sure we remove any double dashed separators
  cleanedMarkdown = cleanedMarkdown.replace(/^---\s*$/gm, '').trim();

  const bodyHTML = parseMarkdownToHTML(cleanedMarkdown);

  const htmlTemplate = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;600;800&display=swap');
    
    body {
      font-family: 'Inter', sans-serif;
      color: #1e293b;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      background: #f8fafc;
    }
    
    .container {
      max-width: 840px;
      margin: 0 auto;
      padding: 2.5rem;
      background: #ffffff;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
      border-radius: 12px;
      margin-top: 2rem;
      margin-bottom: 2rem;
    }
    
    /* Header Card styling */
    .header-card {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      padding: 2.5rem;
      border-radius: 16px;
      margin-bottom: 2.5rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      position: relative;
      overflow: hidden;
    }
    
    .header-card::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, transparent 70%);
      border-radius: 50%;
    }
    
    .company-pre {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #38bdf8;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .header-card h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 2rem;
      margin-top: 0;
      margin-bottom: 1.5rem;
      line-height: 1.25;
      font-weight: 800;
      background: linear-gradient(to right, #ffffff, #e2e8f0);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.25rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 1.5rem;
    }
    
    .metadata-item {
      display: flex;
      flex-direction: column;
    }
    
    .metadata-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
      margin-bottom: 0.25rem;
      font-weight: 600;
    }
    
    .metadata-value {
      font-size: 0.95rem;
      font-weight: 500;
      color: #f8fafc;
    }

    .metadata-value a {
      color: #38bdf8;
      text-decoration: none;
    }

    .metadata-value a:hover {
      text-decoration: underline;
    }
    
    .score-container {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .score-badge {
      display: inline-flex;
      align-items: center;
      background: rgba(14, 165, 233, 0.15);
      border: 1px solid rgba(14, 165, 233, 0.3);
      color: #38bdf8;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 1.1rem;
    }
    
    /* Markdown Element Stylings */
    h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.4rem;
      color: #0f172a;
      border-left: 4px solid #0ea5e9;
      padding-left: 0.75rem;
      margin-top: 2.5rem;
      margin-bottom: 1.25rem;
      font-weight: 700;
      page-break-after: avoid;
    }
    
    h3 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.1rem;
      color: #1e293b;
      margin-top: 1.75rem;
      margin-bottom: 0.75rem;
      font-weight: 600;
      page-break-after: avoid;
    }
    
    p {
      margin-top: 0;
      margin-bottom: 1.25rem;
      color: #334155;
    }
    
    ul, ol {
      margin-top: 0;
      margin-bottom: 1.5rem;
      padding-left: 1.5rem;
    }
    
    li {
      margin-bottom: 0.6rem;
      color: #334155;
    }
    
    li strong {
      color: #0f172a;
    }

    code {
      font-family: Consolas, Monaco, 'Andale Mono', monospace;
      background: #f1f5f9;
      padding: 0.125rem 0.35rem;
      border-radius: 4px;
      font-size: 0.9em;
      color: #0f172a;
    }
    
    /* Elegant Table Design */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.75rem 0;
      font-size: 0.9rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    
    th {
      background-color: #f8fafc;
      color: #0f172a;
      font-weight: 600;
      text-align: left;
      padding: 0.85rem 1.1rem;
      border-bottom: 2px solid #e2e8f0;
    }
    
    td {
      padding: 0.85rem 1.1rem;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
      vertical-align: top;
    }
    
    tr:last-child td {
      border-bottom: none;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    
    /* Gaps / Alerts styling */
    .gap-badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      white-space: nowrap;
    }
    
    .gap-critical {
      background-color: #fef2f2;
      color: #ef4444;
      border: 1px solid #fee2e2;
    }
    
    .gap-moderate {
      background-color: #fffbeb;
      color: #d97706;
      border: 1px solid #fef3c7;
    }
    
    .gap-none {
      background-color: #f0fdf4;
      color: #16a34a;
      border: 1px solid #dcfce7;
    }
    
    /* Horizontal Rule */
    hr {
      border: 0;
      height: 1px;
      background: #e2e8f0;
      margin: 2.5rem 0;
    }
    
    /* Highlight blockquote */
    blockquote {
      margin: 1.75rem 0;
      padding: 1.25rem 1.75rem;
      background: #f8fafc;
      border-left: 4px solid #6366f1;
      border-radius: 0 8px 8px 0;
      font-style: italic;
      color: #475569;
    }
    
    /* Page break control for printing/PDF generation */
    @media print {
      body {
        background: transparent;
        color: #000000;
      }
      .container {
        padding: 0;
        box-shadow: none;
        margin: 0;
        max-width: 100%;
      }
      h2, h3 {
        page-break-after: avoid;
      }
      tr {
        page-break-inside: avoid;
      }
      .header-card {
        box-shadow: none;
        border: 1px solid #cbd5e1;
        background: #0f172a !important;
        color: #ffffff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .header-card h1 {
        color: #ffffff !important;
        -webkit-text-fill-color: initial !important;
      }
      .gap-badge {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-card">
      <div class="company-pre">${metadata.company}</div>
      <h1>${metadata.role}</h1>
      
      <div class="metadata-grid">
        <div class="metadata-item">
          <span class="metadata-label">Fecha del Informe</span>
          <span class="metadata-value">${metadata.date}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Puntuación de Encaje</span>
          <div class="score-container">
            <span class="score-badge">${metadata.score}</span>
          </div>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Arquetipo Principal</span>
          <span class="metadata-value">${metadata.archetype}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Legitimidad de Oferta</span>
          <span class="metadata-value">${metadata.legitimacy}</span>
        </div>
        <div class="metadata-item" style="grid-column: span 2;">
          <span class="metadata-label">Enlace de Oferta</span>
          <span class="metadata-value"><a href="${metadata.url}" target="_blank">${metadata.url}</a></span>
        </div>
      </div>
    </div>

    ${bodyHTML}
  </div>
</body>
</html>`;

  return htmlTemplate;
}

async function generateReportPDF() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node generate-report-pdf.mjs <input.md> <output.pdf>');
    process.exit(1);
  }

  const inputPath = resolve(args[0]);
  const outputPath = resolve(args[1]);

  if (!existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`📄 Leyendo informe: ${inputPath}`);
  const mdContent = await readFile(inputPath, 'utf-8');

  console.log('🧹 Generando diseño premium HTML...');
  const htmlContent = buildHTMLReport(mdContent);

  // Write temporary HTML file for Playwright
  const tempHtmlPath = inputPath.replace(/\.md$/, '.html');
  await writeFile(tempHtmlPath, htmlContent, 'utf-8');

  console.log('🚀 Inicializando Playwright Headless Browser...');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    console.log('🎨 Cargando contenido del informe en el renderizador...');
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle',
      baseURL: `file://${dirname(tempHtmlPath)}/`,
    });

    console.log('⏳ Esperando a que las fuentes se carguen...');
    await page.evaluate(() => document.fonts.ready);

    console.log('📏 Renderizando y guardando PDF (Formato A4)...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
      preferCSSPageSize: false,
    });

    await writeFile(outputPath, pdfBuffer);

    // Count pages
    const pdfString = pdfBuffer.toString('latin1');
    const pageCount = (pdfString.match(/\/Type\s*\/Page[^s]/g) || []).length;

    console.log(`\n✨ ¡ÉXITO! PDF del análisis generado correctamente.`);
    console.log(`📁 Destino: ${outputPath}`);
    console.log(`📊 Páginas: ${pageCount}`);
    console.log(`📦 Tamaño: ${(pdfBuffer.length / 1024).toFixed(1)} KB\n`);

    // Clean up temporary HTML
    const { unlinkSync } = await import('fs');
    unlinkSync(tempHtmlPath);

    return { outputPath, pageCount, size: pdfBuffer.length };
  } finally {
    await browser.close();
  }
}

generateReportPDF().catch((err) => {
  console.error('❌ Error al generar el PDF del informe:', err.message);
  process.exit(1);
});
