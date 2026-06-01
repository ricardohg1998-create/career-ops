#!/usr/bin/env node

/**
 * scan-linkedin.mjs — Rastrea ofertas en LinkedIn usando la sesión de auth-state.json
 */

import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, appendFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const authStatePath = resolve(__dirname, '..', 'output', 'auth-state.json');
const pipelinePath = resolve(__dirname, '..', 'data', 'pipeline.md');

if (!existsSync(authStatePath)) {
  console.error('❌ Error: No se encuentra el archivo output/auth-state.json. Ejecuta primero: node scratch/setup-auth.mjs');
  process.exit(1);
}

// Cargar URLs ya procesadas o tracker para dedup
const existingUrls = new Set();
if (existsSync(pipelinePath)) {
  const content = readFileSync(pipelinePath, 'utf-8');
  const matches = content.match(/https:\/\/www\.linkedin\.com\/jobs\/view\/\d+/g) || [];
  matches.forEach(url => existingUrls.add(url));
}

const SEARCH_QUERIES = [
  {
    name: 'Marketing Automation en España',
    url: 'https://www.linkedin.com/jobs/search/?keywords=Marketing%20Automation&location=Spain&refresh=true'
  },
  {
    name: 'CRM en Sevilla',
    url: 'https://www.linkedin.com/jobs/search/?keywords=CRM&location=Sevilla%2C%20Andalusia%2C%20Spain&refresh=true'
  },
  {
    name: 'Growth Engineer en España',
    url: 'https://www.linkedin.com/jobs/search/?keywords=Growth%20Engineer&location=Spain&refresh=true'
  }
];

async function scanLinkedIn() {
  console.log('\n================================================================');
  console.log('       Rastreador de LinkedIn Autenticado — career-ops');
  console.log('================================================================\n');

  console.log('🚀 Iniciando navegador Chromium con tu sesión guardada...');
  const browser = await chromium.launch({ headless: true }); // headless para velocidad
  
  const context = await browser.newContext({
    storageState: authStatePath,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();

  const newJobs = [];

  for (const query of SEARCH_QUERIES) {
    console.log(`\n🔍 Buscando: "${query.name}"...`);
    
    try {
      await page.goto(query.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(6000); // Dar tiempo para que renderice el feed dinámico

      // Hacer scroll para cargar más jobs
      await page.evaluate(() => {
        const list = document.querySelector('.jobs-search-results-list');
        if (list) list.scrollTop = 1000;
      });
      await page.waitForTimeout(2000);

      // Extraer información de las ofertas de forma resiliente
      const jobs = await page.evaluate(() => {
        const items = [];
        // Intentar varios selectores comunes de LinkedIn
        const cards = document.querySelectorAll('[data-occludable-job-id], .jobs-search-results-list__list-item, .job-card-container');
        
        cards.forEach(card => {
          const titleElem = card.querySelector('.job-card-list__title, [class*="job-title"], a.job-card-container__link');
          const companyElem = card.querySelector('.job-card-container__primary-description, [class*="company-name"], .job-card-list__company-name');
          const locationElem = card.querySelector('[class*="location"], .job-card-container__metadata-item');
          const linkElem = card.querySelector('a[href*="/jobs/view/"]');

          if (linkElem && titleElem) {
            const title = titleElem.innerText.trim();
            const company = companyElem ? companyElem.innerText.trim() : 'Empresa Desconocida';
            const location = locationElem ? locationElem.innerText.trim().replace(/\n+/g, ' ') : 'España';
            let url = linkElem.getAttribute('href');
            
            // Limpiar URL del job
            if (url) {
              const match = url.match(/\/jobs\/view\/\d+/);
              url = match ? 'https://www.linkedin.com' + match[0] : url;
            }

            if (title && url) {
              items.push({ title, company, location, url });
            }
          }
        });
        return items;
      });

      console.log(`📊 Encontradas ${jobs.length} ofertas en la página.`);

      for (const job of jobs) {
        if (!existingUrls.has(job.url)) {
          newJobs.push(job);
          existingUrls.add(job.url);
        }
      }

    } catch (err) {
      console.error(`⚠️ Error al escanear "${query.name}":`, err.message);
    }
  }

  console.log('\n================================================================');
  console.log(`🎉 Resumen del Rastreo:`);
  console.log(`👉 Nuevas ofertas exclusivas encontradas: ${newJobs.length}`);
  console.log('================================================================\n');

  if (newJobs.length > 0) {
    console.log('💾 Añadiendo nuevas ofertas a data/pipeline.md...');
    for (const job of newJobs) {
      const line = `- [ ] ${job.url} | ${job.company} | ${job.title} (${job.location})\n`;
      appendFileSync(pipelinePath, line, 'utf-8');
      console.log(`  + [Añadido] ${job.company} — ${job.title}`);
    }
    console.log('\n✅ ¡Bandeja de entrada pipeline.md actualizada!');
  } else {
    console.log('🟢 No se han encontrado ofertas nuevas que no estuvieran ya registradas.');
  }

  await browser.close();
}

scanLinkedIn().catch((err) => {
  console.error('❌ Error general de rastreo:', err.message);
  process.exit(1);
});
