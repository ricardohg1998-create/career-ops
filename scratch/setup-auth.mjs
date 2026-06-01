#!/usr/bin/env node

/**
 * setup-auth.mjs — Captura la sesión de LinkedIn e InfoJobs y guarda las cookies en output/auth-state.json
 */

import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '..', 'output', 'auth-state.json');

// Asegurar que la carpeta output existe
mkdirSync(resolve(__dirname, '..', 'output'), { recursive: true });

async function setupAuth() {
  console.log('\n================================================================');
  console.log('       Configurando Sesión Persistente (LinkedIn & InfoJobs)');
  console.log('================================================================\n');

  console.log('🚀 Iniciando navegador Chromium en modo visual...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('\n👉 Pasos a seguir:');
  console.log('1. En la ventana del navegador que se acaba de abrir, inicia sesión en LinkedIn.');
  console.log('2. Abre una pestaña nueva o navega a InfoJobs.net e inicia sesión también allí.');
  console.log('3. Asegúrate de que las sesiones están activas y ves tu feed de inicio.');
  console.log('4. Vuelve a esta consola y presiona ENTER cuando hayas terminado.');

  // Abrir la primera pestaña en LinkedIn
  await page.goto('https://www.linkedin.com/login');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolvePromise) => {
    rl.question('\n📝 Presiona ENTER aquí cuando hayas iniciado sesión en ambas webs para guardar las credenciales...', async () => {
      rl.close();
      
      console.log('\n💾 Guardando estado de las cookies y almacenamiento local...');
      try {
        await context.storageState({ path: outputPath });
        console.log(`\n✅ ¡Sesión guardada con éxito!`);
        console.log(`📂 Archivo generado en: ${outputPath}\n`);
      } catch (err) {
        console.error(`\n❌ Error al guardar el estado:`, err.message);
      } finally {
        await browser.close();
        resolvePromise();
      }
    });
  });
}

setupAuth().catch((err) => {
  console.error('❌ Error en la configuración:', err.message);
  process.exit(1);
});
