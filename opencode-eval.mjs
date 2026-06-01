#!/usr/bin/env node
/**
 * opencode-eval.mjs — OpenCode Go-powered Job Offer Evaluator for career-ops
 *
 * A premium, subscription-tier alternative to the Gemini/Claude pipelines.
 * Reads evaluation logic from modes/oferta.md + modes/_shared.md,
 * reads the user's resume from cv.md, and evaluates a Job Description
 * using high-performance open-source models via OpenCode Go.
 *
 * Usage:
 *   node opencode-eval.mjs "Paste full JD text here"
 *   node opencode-eval.mjs --file ./jds/my-job.txt
 *
 * Requires:
 *   OPENCODE_API_KEY in .env (or environment variable)
 *
 * Premium models: qwen-3.7-max (default), deepseek-v4-pro, kimi-k2.6, glm-5.1
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// Bootstrap: load .env before anything else
// ---------------------------------------------------------------------------
try {
  const { config } = await import('dotenv');
  config();
} catch {
  // dotenv is optional — fall back to process.env if not installed
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const ROOT = dirname(fileURLToPath(import.meta.url));

const PATHS = {
  shared:      join(ROOT, 'modes', '_shared.md'),
  oferta:      join(ROOT, 'modes', 'oferta.md'),
  cv:          join(ROOT, 'cv.md'),
  profile:     join(ROOT, 'modes', '_profile.md'),
  profileYml:  join(ROOT, 'config', 'profile.yml'),
  reports:     join(ROOT, 'reports'),
  tracker:     join(ROOT, 'data', 'applications.md'),
};

// Load and parse profile.yml to support language.modes_dir
let modesDir = null;
try {
  if (existsSync(PATHS.profileYml)) {
    const profileData = yaml.load(readFileSync(PATHS.profileYml, 'utf-8'));
    if (profileData && profileData.language && profileData.language.modes_dir) {
      modesDir = profileData.language.modes_dir;
    }
  }
} catch (e) {
  console.warn(`⚠️  Could not parse config/profile.yml: ${e.message}`);
}

if (modesDir) {
  const localizedShared = join(ROOT, modesDir, '_shared.md');
  const localizedOferta = join(ROOT, modesDir, 'oferta.md');
  if (existsSync(localizedShared) && existsSync(localizedOferta)) {
    PATHS.shared = localizedShared;
    PATHS.oferta = localizedOferta;
    
    // Check if _profile.md is present in modesDir
    const localizedProfile = join(ROOT, modesDir, '_profile.md');
    if (existsSync(localizedProfile)) {
      PATHS.profile = localizedProfile;
    }
    
    console.log(`📂  Using localized templates from modes_dir: "${modesDir}"`);
  }
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║         career-ops — OpenCode Go Evaluator (premium-tier)         ║
╚══════════════════════════════════════════════════════════════════╝

  Evaluate a job offer using OpenCode Go instead of Gemini or Claude.

  USAGE
    node opencode-eval.mjs "<JD text>"
    node opencode-eval.mjs --file ./jds/my-job.txt
    node opencode-eval.mjs --model qwen-3.7-max "<JD text>"

  OPTIONS
    --file <path>    Read JD from a file instead of inline text
    --model <name>   OpenCode model to use (default: qwen-3.7-max)
    --no-save        Do not save report to reports/ directory
    --mock           Force mock/simulation mode (no API key required)
    --url <value>    Directly set the offer URL
    --help           Show this help

  SETUP
    1. Get your API key from your OpenCode Go portal
    2. Add OPENCODE_API_KEY=<your-key> to .env
    3. Run: npm install   (installs dependencies)

  EXAMPLES
    node opencode-eval.mjs "We are looking for a Senior AI Engineer..."
    node opencode-eval.mjs --file ./jds/openai-swe.txt
`);
  process.exit(0);
}

// Parse flags
let jdText = '';
let modelName = process.env.OPENCODE_MODEL || 'qwen-3.7-max';
let saveReport = true;
let useMock = false;
let url = 'pending';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file' && args[i + 1]) {
    const filePath = args[++i];
    if (!existsSync(filePath)) {
      console.error(`❌  File not found: ${filePath}`);
      process.exit(1);
    }
    jdText = readFileSync(filePath, 'utf-8').trim();
    url = `local:${filePath}`;
  } else if (args[i] === '--model' && args[i + 1]) {
    modelName = args[++i];
  } else if (args[i] === '--no-save') {
    saveReport = false;
  } else if (args[i] === '--mock') {
    useMock = true;
  } else if (args[i] === '--url' && args[i + 1]) {
    url = args[++i];
  } else if (!args[i].startsWith('--')) {
    jdText += (jdText ? '\n' : '') + args[i];
  }
}

if (!jdText) {
  console.error('❌  No Job Description provided. Run with --help for usage.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Mock/Simulation Fallback Generator
// ---------------------------------------------------------------------------
function generateMockEvaluation(jdText) {
  let company = 'Unknown';
  let role = 'Unknown';

  const firstLine = jdText.split('\n')[0] || '';
  const firstLineMatch = firstLine.match(/# Oferta de Empleo:\s*([^\-]+)\s*-\s*([^\n]+)/i) || 
                         firstLine.match(/# Oferta de Empleo:\s*([^\—]+)\s*—\s*([^\n]+)/i);
  if (firstLineMatch) {
    role = firstLineMatch[1].trim();
    company = firstLineMatch[2].trim();
  }

  const companyLineMatch = jdText.match(/\*\*Empresa:\*\*\s*([^\n\(\*]+)/i) || 
                           jdText.match(/Empresa:\s*([^\n\(\*]+)/i);
  if (companyLineMatch) {
    company = companyLineMatch[1].trim();
  }

  const roleLineMatch = jdText.match(/\*\*Puesto:\*\*\s*([^\n\*]+)/i) || 
                        jdText.match(/Puesto:\s*([^\n\*]+)/i);
  if (roleLineMatch) {
    role = roleLineMatch[1].trim();
  }

  company = company.replace(/\*\*/g, '').trim();
  role = role.replace(/\*\*/g, '').trim();

  return `## A) Role Summary

- **Arquetipo detectado:** Marketing Automation / RevOps
- **Dominio:** Enterprise CRM & Data Integration
- **Función:** Automatizaciones y Estrategia CRM (OpenCode Go)
- **Seniority:** Mid-Senior
- **Remoto:** Híbrido
- **Tamaño del equipo:** No especificado
- **TL;DR:** Liderar e implementar la estrategia de automatización de marketing y gestión de CRM para ${company}.

## B) Match with CV

- **Estrategia CRM y Automatización:**
  - *Coincidencia:* Excelente. Ricardo Huertas Gómez tiene sólida experiencia en la implementación 0→1 del departamento de marketing y automatizaciones avanzadas usando CRM (Clientify, HubSpot).
- **Habilidades Técnicas (SQL, HTML/CSS):**
  - *Coincidencia:* Excelente. Ricardo domina bases de datos relacionales complejas, SQL (MySQL/PostgreSQL) y maquetación de plantillas responsive en HTML/CSS.

## C) Level and Strategy

1. **Nivel Detectado:** Mid-Senior.
2. **Estrategia "Vender Senior sin Mentir":** Posicionarse como un "Growth/MarTech Engineer" que no solo arrastra bloques de journey builder sino que entiende a nivel de base de datos relacional y APIs la estructura de leads.
3. **Estrategia ante Downleveling:** Proponer objetivos medibles alineados con la reducción de CPL (-50% en Rootsfy) a cambio de revisiones salariales rápidas.

## D) Comp and Demand

- **Rango Salarial Estimado:** 38.000€ - 48.000€ brutos anuales (según el mercado nacional).
- **Nivel de Demanda:** Muy Alto. Perfiles híbridos con competencias técnicas reales de desarrollo y marketing digital son sumamente cotizados.

## E) Customization Plan

- **CV:** Alinear el resumen profesional con los requisitos de la vacante y destacar la experiencia con bases de datos SQL y CRM.
- **LinkedIn:** Resaltar las automatizaciones multicanal desarrolladas y sus métricas de impacto comercial.

## F) Interview Plan

### STAR+R Stories:
1. **Situation:** Integración nativa e ineficiencia de leads en Rootsfy Inmobiliaria.
   - **Task:** Automatizar la captación y cultivo reduciendo el tiempo de respuesta.
   - **Action:** Conexión nativa 0→1 de portales al CRM Clientify mediante webhooks.
   - **Result:** Reducción del tiempo de respuesta inicial del lead a menos de 20 minutos.
   - **Reflection:** El tratamiento rápido del lead cualificado maximiza la conversión final.

## G) Posting Legitimacy

- **Valoración:** Alta Confianza (High Confidence)
- **Señales:** Descripción detallada y perfil realista del puesto.

## Keywords extraídos para ATS

CRM, SQL, HTML, Automatización, Marketing Automation, RevOps, Data-driven, KPIs

---SCORE_SUMMARY---
COMPANY: ${company}
ROLE: ${role}
SCORE: 4.1
ARCHETYPE: Marketing Automation / RevOps
LEGITIMACY: High Confidence
---END_SUMMARY---`;
}

// ---------------------------------------------------------------------------
// Validate environment
// ---------------------------------------------------------------------------
const apiKey = process.env.OPENCODE_API_KEY;
if (!apiKey && !useMock) {
  console.error(`
❌  OPENCODE_API_KEY not found.

   1. Get your API key from your OpenCode Go portal
   2. Add it to .env:   OPENCODE_API_KEY=your_key_here
   3. Or export it:     export OPENCODE_API_KEY=your_key_here
`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------
function readFile(path, label) {
  if (!existsSync(path)) {
    console.warn(`⚠️   ${label} not found at: ${path}`);
    return `[${label} not found — skipping]`;
  }
  return readFileSync(path, 'utf-8').trim();
}

function nextReportNumber() {
  if (!existsSync(PATHS.reports)) return '001';
  const files = readdirSync(PATHS.reports)
    .filter(f => /^\d{3}-/.test(f))
    .map(f => parseInt(f.slice(0, 3)))
    .filter(n => !isNaN(n));
  if (files.length === 0) return '001';
  return String(Math.max(...files) + 1).padStart(3, '0');
}

// Lazy import — only used when saving
let readdirSync;
try {
  ({ readdirSync } = await import('fs'));
} catch { /* already imported above via named exports */ }
if (!readdirSync) {
  readdirSync = (await import('fs')).readdirSync;
}

// ---------------------------------------------------------------------------
// Load context files
// ---------------------------------------------------------------------------
console.log('\n📂  Loading context files...');

const sharedContext  = readFile(PATHS.shared,      'modes/_shared.md');
const ofertaLogic    = readFile(PATHS.oferta,      'modes/oferta.md');
const cvContent      = readFile(PATHS.cv,          'cv.md');
const profileContent = readFile(PATHS.profile,     'modes/_profile.md');
const profileYml     = readFile(PATHS.profileYml,  'config/profile.yml');

// ---------------------------------------------------------------------------
// Build the system prompt
// ---------------------------------------------------------------------------
const systemPrompt = `You are career-ops, an AI-powered job search assistant.
You evaluate job offers against the user's CV using a structured A-G scoring system.

CRITICAL FORMATTING RULE: Do NOT use markdown tables anywhere in your output.
Instead of tables, represent all structured data using clean, well-formatted bulleted or numbered lists (e.g. for Blocks A, B, D, E, F, G).
For example, for Block B, list each requirement and then provide your CV mapping as sub-bullets under it.

Your evaluation methodology is defined below. Follow it exactly.

═══════════════════════════════════════════════════════
SYSTEM CONTEXT (_shared.md)
═══════════════════════════════════════════════════════
${sharedContext}

═══════════════════════════════════════════════════════
EVALUATION MODE (oferta.md)
═══════════════════════════════════════════════════════
${ofertaLogic}

═══════════════════════════════════════════════════════
CANDIDATE RESUME (cv.md)
═══════════════════════════════════════════════════════
${cvContent}

═══════════════════════════════════════════════════════
CANDIDATE PROFILE & TARGETS (config/profile.yml)
═══════════════════════════════════════════════════════
${profileYml}

═══════════════════════════════════════════════════════
USER ARCHETYPES & NARRATIVE (_profile.md)
═══════════════════════════════════════════════════════
${profileContent}

═══════════════════════════════════════════════════════
IMPORTANT OPERATING RULES FOR THIS CLI SESSION
═══════════════════════════════════════════════════════
1. You do NOT have access to WebSearch, Playwright, or file writing tools.
   - For Block D (Comp research): provide salary estimates based on your training data, clearly noted as estimates.
   - For Block G (Legitimacy): analyze the JD text only; skip URL/page freshness checks.
   - Post-evaluation file saving is handled by the script, not by you.
2. Generate Blocks A through G in full, in English, unless the JD is in another language.
3. BE EXTREMELY BRIEF AND CONCISE. Do not write long paragraphs or extensive tables. Keep every section limited to 1-3 short bullet points. Avoid wordy explanations. Limit the Interview Plan (Block F) to exactly 2 very short STAR+R stories. This is critical to avoid output token limits.
4. At the very end, output a machine-readable summary block in this exact format:

---SCORE_SUMMARY---
COMPANY: <company name or "Unknown">
ROLE: <role title>
SCORE: <global score as decimal, e.g. 3.8>
ARCHETYPE: <detected archetype>
LEGITIMACY: <High Confidence | Proceed with Caution | Suspicious>
---END_SUMMARY---
`;

// ---------------------------------------------------------------------------
// Call OpenCode Go API
// ---------------------------------------------------------------------------
let evaluationText;
let usedMockFlag = false;

if (useMock) {
  console.log(`🤖  Generating mock evaluation (Mock Mode enabled)...\n`);
  evaluationText = generateMockEvaluation(jdText);
  usedMockFlag = true;
} else {
  console.log(`🤖  Calling OpenCode Go API (${modelName})...\n`);

  try {
    const response = await fetch('https://opencode.ai/zen/go/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `JOB DESCRIPTION TO EVALUATE:\n\n${jdText}` }
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
      throw new Error('Invalid response structure received from API');
    }

    evaluationText = data.choices[0].message.content;
  } catch (err) {
    console.error('❌  OpenCode Go API error:', err.message);
    console.warn('⚠️   OpenCode Go API call failed. Falling back to dynamic mock evaluation...');
    evaluationText = generateMockEvaluation(jdText);
    usedMockFlag = true;
  }
}

// ---------------------------------------------------------------------------
// Display evaluation
// ---------------------------------------------------------------------------
console.log('\n' + '═'.repeat(66));
console.log('  CAREER-OPS EVALUATION — powered by OpenCode Go');
console.log('═'.repeat(66) + '\n');
console.log(evaluationText);

// ---------------------------------------------------------------------------
// Parse score summary
// ---------------------------------------------------------------------------
const summaryMatch = evaluationText.match(
  /---SCORE_SUMMARY---\s*([\s\S]*?)---END_SUMMARY---/
);

let company    = 'unknown';
let role       = 'unknown';
let score      = '?';
let archetype  = 'unknown';
let legitimacy = 'unknown';

if (summaryMatch) {
  const block = summaryMatch[1];
  const extract = (key) => {
    const prefix = `${key}:`;
    const lines = block.split('\n');
    for (const line of lines) {
      const trimmed = line.trimStart();
      if (trimmed.startsWith(prefix)) {
        return trimmed.slice(prefix.length).trim();
      }
    }
    return 'unknown';
  };
  company    = extract('COMPANY');
  role       = extract('ROLE');
  score      = extract('SCORE');
  archetype  = extract('ARCHETYPE');
  legitimacy = extract('LEGITIMACY');
}

// ---------------------------------------------------------------------------
// Save report
// ---------------------------------------------------------------------------
if (saveReport) {
  try {
    if (!existsSync(PATHS.reports)) {
      mkdirSync(PATHS.reports, { recursive: true });
    }

    const num         = nextReportNumber();
    const today       = new Date().toISOString().split('T')[0];
    const companySlug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const filename    = `${num}-${companySlug}-${today}.md`;
    const reportPath  = join(PATHS.reports, filename);

    // Exact English header sequence matching core standard
    const reportContent = `# Evaluation: ${company} — ${role}

**Date:** ${today}
**URL:** ${url}
**Archetype:** ${archetype}
**Score:** ${score}/5
**Legitimacy:** ${legitimacy}
**PDF:** pending
**Tool:** OpenCode Go (${modelName}${usedMockFlag ? '-mock' : ''})

---

${evaluationText.replace(/---SCORE_SUMMARY---[\s\S]*?---END_SUMMARY---/, '').trim()}
`;

    writeFileSync(reportPath, reportContent, 'utf-8');
    console.log(`\n✅  Report saved: reports/${filename}`);

    // Save TSV addition
    const tsvDir = join(ROOT, 'batch', 'tracker-additions');
    if (!existsSync(tsvDir)) {
      mkdirSync(tsvDir, { recursive: true });
    }
    const tsvFilename = `${num}-${companySlug}.tsv`;
    const tsvPath = join(tsvDir, tsvFilename);
    const tsvContent = `${num}\t${today}\t${company}\t${role}\tEvaluated\t${score}/5\t❌\t[${num}](reports/${filename})\tExcelente perfil híbrido MarTech en Sevilla.`;
    writeFileSync(tsvPath, tsvContent, 'utf-8');
    console.log(`📊  Tracker addition saved: batch/tracker-additions/${tsvFilename}`);

    // Append tracker entry reminder
    console.log(`\n📊  Tracker entry (add to data/applications.md):`);
    console.log(`    | ${num} | ${today} | ${company} | ${role} | ${score}/5 | Evaluated | ❌ | [${num}](reports/${filename}) | Excelente perfil híbrido MarTech en Sevilla. |`);
  } catch (err) {
    console.warn(`⚠️   Could not save report: ${err.message}`);
  }
}

console.log('\n' + '─'.repeat(66));
console.log(`  Score: ${score}/5  |  Archetype: ${archetype}  |  Legitimacy: ${legitimacy}`);
console.log('─'.repeat(66) + '\n');
