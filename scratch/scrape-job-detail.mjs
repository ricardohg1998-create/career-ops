#!/usr/bin/env node

/**
 * scrape-job-detail.mjs - Scrapes a detailed LinkedIn job description using auth-state.json.
 */

import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const authStatePath = resolve(__dirname, '..', 'output', 'auth-state.json');

if (!existsSync(authStatePath)) {
  console.error('Error: No se encuentra output/auth-state.json. Ejecuta primero setup-auth.mjs');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Uso: node scratch/scrape-job-detail.mjs <LINKEDIN_JOB_URL> [output_prefix]');
  process.exit(0);
}

const targetUrl = args[0];
const prefix = args[1] || 'generic';

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function inferLinkedInHeader(bodyText) {
  const skip = new Set([
    '0 notificaciones',
    'Ir al contenido principal',
    'Inicio',
    'Mi red',
    'Empleos',
    'Mensajes',
    'Notificaciones',
    'Yo',
    'Para negocios',
    'Reactivar Premium con un -50 %',
  ]);
  const lines = String(bodyText || '').split(/\r?\n/).map(cleanText).filter(Boolean);
  const menuIndex = lines.findIndex(line => line === 'Para negocios');
  const useful = lines.slice(menuIndex === -1 ? 0 : menuIndex + 1).filter(line => !skip.has(line));
  return {
    company: useful[0] || '',
    title: useful[1] || '',
  };
}

async function scrapeJob() {
  console.log(`\nIniciando navegador Chromium para raspar: ${targetUrl}`);
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    storageState: authStatePath,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  try {
    console.log('Cargando pagina...');
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('Esperando renderizado de la oferta (6s)...');
    await page.waitForTimeout(6000);

    const jobDetail = await page.evaluate(() => {
      const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const pick = (selectors) => {
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          const text = clean(el?.innerText || el?.textContent || el?.getAttribute?.('aria-label'));
          if (text) return text;
        }
        return '';
      };

      return {
        title: pick([
          '.job-details-jobs-unified-top-card__job-title h1',
          '.job-details-jobs-unified-top-card__job-title',
          '.jobs-unified-top-card__job-title h1',
          '.jobs-unified-top-card__job-title',
          'h1',
          'h2.t-24',
        ]),
        company: pick([
          '.job-details-jobs-unified-top-card__company-name a',
          '.job-details-jobs-unified-top-card__company-name',
          '.jobs-unified-top-card__company-name a',
          '.jobs-unified-top-card__company-name',
          '.topcard__org-name-link',
          'a[href*="/company/"]',
        ]),
        description: pick([
          '.jobs-description__content',
          '.jobs-box__html-content',
          '.jobs-description',
          '#job-details',
        ]),
        body: document.body.innerText,
      };
    });

    if (!jobDetail.description) {
      console.log('No se pudo extraer la descripcion por selectores estandar. Usando volcado generico...');
      jobDetail.description = jobDetail.body || await page.evaluate(() => document.body.innerText);
    }

    if (!jobDetail.company || !jobDetail.title) {
      const inferred = inferLinkedInHeader(jobDetail.body || jobDetail.description);
      jobDetail.company ||= inferred.company;
      jobDetail.title ||= inferred.title;
    }

    console.log('\nResultados del raspado:');
    console.log(`Empresa: ${jobDetail.company || 'Desconocida'}`);
    console.log(`Puesto: ${jobDetail.title || 'Desconocido'}`);
    console.log(`Longitud de la descripcion: ${jobDetail.description.length} caracteres`);

    const outputFilename = `scratch/jd-${prefix}.txt`;
    const outputPath = resolve(__dirname, '..', outputFilename);

    if (!jobDetail.description || jobDetail.description.length < 100) {
      throw new Error('La descripcion obtenida es demasiado corta o vacia.');
    }

    const fullFileContent = `COMPANY: ${jobDetail.company || 'Desconocida'}
ROLE: ${jobDetail.title || 'Desconocido'}
URL: ${targetUrl}

DESCRIPTION:
${jobDetail.description}`;

    writeFileSync(outputPath, fullFileContent, 'utf-8');
    console.log(`\nGuardado con exito en: ${outputFilename}`);
  } catch (err) {
    console.error('Error durante el raspado:', err.message);
  } finally {
    await browser.close();
  }
}

scrapeJob().catch(err => {
  console.error('Error general:', err);
  process.exit(1);
});
