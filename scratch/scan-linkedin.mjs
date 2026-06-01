#!/usr/bin/env node

/**
 * scan-linkedin.mjs - Rastrea ofertas en LinkedIn usando la sesion de auth-state.json.
 *
 * LinkedIn cambia clases CSS con frecuencia. El extractor usa varios selectores
 * y, si fallan, infiere empresa desde el texto visible de cada tarjeta.
 */

import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, appendFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const authStatePath = resolve(__dirname, '..', 'output', 'auth-state.json');
const pipelinePath = resolve(__dirname, '..', 'data', 'pipeline.md');

if (!existsSync(authStatePath)) {
  console.error('Error: No se encuentra output/auth-state.json. Ejecuta primero: node scratch/setup-auth.mjs');
  process.exit(1);
}

const existingUrls = new Set();
if (existsSync(pipelinePath)) {
  const content = readFileSync(pipelinePath, 'utf-8');
  const matches = content.match(/https:\/\/www\.linkedin\.com\/jobs\/view\/\d+/g) || [];
  matches.forEach(url => existingUrls.add(url));
}

const SEARCH_QUERIES = [
  {
    name: 'Marketing Automation en Espana',
    url: 'https://www.linkedin.com/jobs/search/?keywords=Marketing%20Automation&location=Spain&refresh=true',
  },
  {
    name: 'CRM en Sevilla',
    url: 'https://www.linkedin.com/jobs/search/?keywords=CRM&location=Sevilla%2C%20Andalusia%2C%20Spain&refresh=true',
  },
  {
    name: 'Growth Engineer en Espana',
    url: 'https://www.linkedin.com/jobs/search/?keywords=Growth%20Engineer&location=Spain&refresh=true',
  },
];

async function scanLinkedIn() {
  console.log('\n================================================================');
  console.log('       Rastreador de LinkedIn Autenticado - career-ops');
  console.log('================================================================\n');

  console.log('Iniciando navegador Chromium con sesion guardada...');
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    storageState: authStatePath,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  const newJobs = [];

  for (const query of SEARCH_QUERIES) {
    console.log(`\nBuscando: "${query.name}"...`);

    try {
      await page.goto(query.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(6000);

      await page.evaluate(() => {
        const list = document.querySelector('.jobs-search-results-list');
        if (list) list.scrollTop = 1000;
      });
      await page.waitForTimeout(2000);

      const jobs = await page.evaluate(() => {
        const items = [];
        const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const firstText = (root, selectors) => {
          for (const selector of selectors) {
            const el = root.querySelector(selector);
            const text = clean(el?.innerText || el?.textContent || el?.getAttribute?.('aria-label'));
            if (text) return text;
          }
          return '';
        };
        const inferFromCardText = (card, title) => {
          const lines = String(card.innerText || '').split(/\r?\n/).map(clean).filter(Boolean);
          const titleIndex = lines.findIndex(line => line === title || line.includes(title));
          return titleIndex >= 0 ? clean(lines[titleIndex + 1]) : '';
        };

        const cards = document.querySelectorAll('[data-occludable-job-id], .jobs-search-results-list__list-item, .job-card-container');

        cards.forEach(card => {
          const title = firstText(card, [
            '.job-card-list__title strong',
            '.job-card-list__title',
            '.job-card-container__link strong',
            '.job-card-container__link',
            '[class*="job-title"]',
            'a[href*="/jobs/view/"]',
          ]);
          const company = firstText(card, [
            '.artdeco-entity-lockup__subtitle',
            '.job-card-container__primary-description',
            '.job-card-list__company-name',
            '[class*="company-name"]',
            'a[href*="/company/"]',
          ]) || inferFromCardText(card, title);
          const location = firstText(card, [
            '.job-card-container__metadata-item',
            '[class*="location"]',
          ]) || 'Espana';
          const linkElem = card.querySelector('a[href*="/jobs/view/"]');

          if (linkElem && title) {
            let url = linkElem.getAttribute('href');
            if (url) {
              const match = url.match(/\/jobs\/view\/\d+/);
              url = match ? 'https://www.linkedin.com' + match[0] : url;
            }

            if (title && url) {
              items.push({ title, company: company || 'LinkedIn sin empresa extraida', location, url });
            }
          }
        });
        return items;
      });

      console.log(`Encontradas ${jobs.length} ofertas en la pagina.`);

      for (const job of jobs) {
        if (!existingUrls.has(job.url)) {
          newJobs.push(job);
          existingUrls.add(job.url);
        }
      }
    } catch (err) {
      console.error(`Error al escanear "${query.name}":`, err.message);
    }
  }

  console.log('\n================================================================');
  console.log(`Resumen del rastreo: ${newJobs.length} ofertas nuevas`);
  console.log('================================================================\n');

  if (newJobs.length > 0) {
    console.log('Anadiendo nuevas ofertas a data/pipeline.md...');
    for (const job of newJobs) {
      const line = `- [ ] ${job.url} | ${job.company} | ${job.title} (${job.location})\n`;
      appendFileSync(pipelinePath, line, 'utf-8');
      console.log(`  + [Anadido] ${job.company} - ${job.title}`);
    }
    console.log('\nPipeline actualizado.');
  } else {
    console.log('No se han encontrado ofertas nuevas que no estuvieran ya registradas.');
  }

  await browser.close();
}

scanLinkedIn().catch((err) => {
  console.error('Error general de rastreo:', err.message);
  process.exit(1);
});
