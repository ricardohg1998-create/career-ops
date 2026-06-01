#!/usr/bin/env node

/**
 * scrape-job-detail.mjs — Scrapes detailed job description from LinkedIn using auth-state.json
 */

import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const authStatePath = resolve(__dirname, '..', 'output', 'auth-state.json');

if (!existsSync(authStatePath)) {
  console.error('❌ Error: No se encuentra el archivo output/auth-state.json. Ejecuta primero setup-auth.mjs');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Uso: node scratch/scrape-job-detail.mjs <LINKEDIN_JOB_URL> [output_prefix]');
  process.exit(0);
}

const targetUrl = args[0];
const prefix = args[1] || 'generic';

async function scrapeJob() {
  console.log(`\n🚀 Iniciando navegador Chromium para raspar: ${targetUrl}`);
  const browser = await chromium.launch({ headless: true });
  
  const context = await browser.newContext({
    storageState: authStatePath,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  try {
    console.log('⏱️ Cargando página...');
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    console.log('⏱️ Esperando renderizado de la oferta (6s)...');
    await page.waitForTimeout(6000);

    // Intentar extraer detalles
    const jobDetail = await page.evaluate(() => {
      // Intentar selectores de título
      const titleSelectors = [
        '.job-details-jobs-unified-top-card__job-title', 
        '.jobs-unified-top-card__job-title',
        'h1', 
        'h2.t-24'
      ];
      let title = '';
      for (const selector of titleSelectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText.trim()) {
          title = el.innerText.trim();
          break;
        }
      }

      // Intentar selectores de compañía
      const companySelectors = [
        '.job-details-jobs-unified-top-card__company-name',
        '.jobs-unified-top-card__company-name',
        '.topcard__org-name-link',
        '.jobs-unified-top-card__company-name a',
        '.job-details-jobs-unified-top-card__company-name a'
      ];
      let company = '';
      for (const selector of companySelectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText.trim()) {
          company = el.innerText.trim();
          break;
        }
      }

      // Intentar selectores de descripción
      const descSelectors = [
        '.jobs-description__content',
        '.jobs-box__html-content',
        '.jobs-description',
        '#job-details'
      ];
      let description = '';
      for (const selector of descSelectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText.trim()) {
          description = el.innerText.trim();
          break;
        }
      }

      return { title, company, description };
    });

    if (!jobDetail.description) {
      console.log('⚠️ No se pudo extraer la descripción por selectores estándar. Intentando volcado genérico...');
      // Intentar volcar el texto del cuerpo para no fallar por completo
      jobDetail.description = await page.evaluate(() => document.body.innerText);
    }

    console.log(`\n📋 Resultados del raspado:`);
    console.log(`🏢 Empresa: ${jobDetail.company || 'Desconocida'}`);
    console.log(`💼 Puesto: ${jobDetail.title || 'Desconocido'}`);
    console.log(`📝 Longitud de la descripción: ${jobDetail.description.length} caracteres`);

    const outputFilename = `scratch/jd-${prefix}.txt`;
    const outputPath = resolve(__dirname, '..', outputFilename);
    
    // Si la descripción está vacía, lanzar error
    if (!jobDetail.description || jobDetail.description.length < 100) {
      throw new Error('La descripción obtenida es demasiado corta o vacía.');
    }

    const fullFileContent = `COMPANY: ${jobDetail.company || 'Desconocida'}
ROLE: ${jobDetail.title || 'Desconocido'}
URL: ${targetUrl}

DESCRIPTION:
${jobDetail.description}`;

    writeFileSync(outputPath, fullFileContent, 'utf-8');
    console.log(`\n✅ Guardado con éxito en: ${outputFilename}`);

  } catch (err) {
    console.error('❌ Error durante el raspado:', err.message);
  } finally {
    await browser.close();
  }
}

scrapeJob().catch(err => {
  console.error('❌ Error general:', err);
  process.exit(1);
});
