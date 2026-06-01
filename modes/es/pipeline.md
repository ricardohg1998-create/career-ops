# Modo: pipeline — Bandeja de Entrada de URLs (Segundo Cerebro)

Procesa las URLs de ofertas de empleo almacenadas en `data/pipeline.md`. El usuario añade URLs en cualquier momento y luego ejecuta el comando de pipeline para procesarlas todas secuencialmente en lote.

---

## Flujo de Trabajo (Workflow)

1. **Leer** `data/pipeline.md` → buscar tareas pendientes marcadas con `- [ ]` bajo la sección "Pending" (o "Pendientes").
2. **Para cada URL pendiente**:
   a. Calcular el siguiente número secuencial `REPORT_NUM` de los reportes (listar `reports/`, tomar el número más alto + 1).
   b. **Extraer la descripción del puesto (JD)** utilizando Playwright (navegación y captura de pantalla de la página) → con fallback a `WebFetch` si es estático, o `WebSearch` en portales secundarios.
   c. Si la URL no es accesible → marcar la línea con `- [!]`, añadir una nota explicativa y continuar con la siguiente.
   d. **Ejecutar el auto-pipeline completo**: Realizar la evaluación A-F en español técnico → Guardar el reporte `.md` en la carpeta `reports/` (con cabecera con claves en inglés) → Generar el currículum PDF personalizado (si la puntuación global es >= 3.0) → Registrar en el tracker.
   e. **Mover de la sección "Pending" a "Processed"** en el archivo `data/pipeline.md`, utilizando el siguiente formato:
      `- [x] #NNN | URL | Empresa | Puesto | Puntuación/5 | PDF ✅/❌`
3. **Si hay más de 3 URLs pendientes**, lanzar agentes secundarios en segundo plano (`run_in_background` a través del gestor de tareas) para procesar en paralelo y maximizar la eficiencia temporal.
4. **Al finalizar**, presentar una tabla resumen al usuario con los resultados del lote:

```text
| # | Empresa | Puesto | Puntuación | PDF | Acción Recomendada |
```

---

## Formato del Archivo `pipeline.md`

El archivo `data/pipeline.md` debe respetar estrictamente la siguiente estructura para que los scripts automáticos puedan parsearlo correctamente:

```markdown
## Pending
- [ ] https://jobs.example.com/posting/123
- [ ] https://boards.greenhouse.io/company/jobs/456 | Company Inc | Senior PM
- [!] https://private.url/job — Error: login required

## Processed
- [x] #143 | https://jobs.example.com/posting/789 | Acme Corp | AI PM | 4.2/5 | PDF ✅
- [x] #144 | https://boards.greenhouse.io/xyz/jobs/012 | BigCo | SA | 2.1/5 | PDF ❌
```

---

## Detección Inteligente de la JD desde una URL

1. **Playwright (Método preferido)**: Realizar navegación con navegador en vivo (`browser_navigate` + `browser_snapshot`). Esencial para Single Page Applications (SPAs) y portales dinámicos (Workday, Greenhouse, Ashby, Lever).
2. **WebFetch (Primer fallback)**: Útil para páginas HTML estáticas sencillas o cuando el renderizado dinámico no es necesario.
3. **WebSearch (Último recurso)**: Buscar en portales secundarios que indexen de forma pública el texto de la oferta.

**Casos especiales:**
- **LinkedIn**: Suele requerir inicio de sesión. Si falla, marcar con `- [!]` e indicar al usuario que copie y pegue el texto de la oferta directamente.
- **PDF**: Si la URL apunta a un documento PDF, descargar y leer su contenido directamente.
- **Prefijo `local:`**: Permite leer descripciones almacenadas localmente. Ejemplo: `local:jds/marketing-automation.md` leerá el contenido del archivo local en esa ruta.

---

## Numeración Automática de Reportes

1. Listar todos los archivos dentro de la carpeta `reports/`.
2. Extraer el prefijo numérico de tres dígitos de cada archivo (ej. `142-company-slug-2026-01-01.md` → 142).
3. Asignar al nuevo reporte el valor máximo encontrado + 1.

---

## Sincronización del Perfil y CV

Antes de iniciar el procesamiento de cualquier URL de la bandeja de entrada, se debe verificar la sincronización ejecutando:

```bash
node cv-sync-check.mjs
```

Si el script detecta alguna desincronización en los archivos fuentes (por ejemplo, cambios recientes en `cv.md` que afecten los compilados de PDF), advertirá al candidato para que resuelva la incoherencia antes de continuar.
