# Informe de usabilidad y plan macro - Career-Ops Web App

Fecha: 2026-06-03  
Entorno auditado: app local en `http://127.0.0.1:4173`  
Repositorio: `C:\Users\34634\Documents\antigravity\friendly-bell`

## Resumen ejecutivo

La aplicación ya tiene una base sólida: arranca correctamente, las pruebas de humo existentes pasan, la navegación principal funciona, el diseño responsive no presenta overflow horizontal en móvil y la mayoría de módulos devuelven respuestas útiles. El producto se siente cercano a un "centro operativo" real para carrera profesional.

El principal problema no es visual, sino de seguridad funcional y confianza: el flujo "Flujo completo" puede ejecutar una pipeline real con contexto hidratado automáticamente, incluso cuando el usuario no ha pegado una oferta nueva. Durante la auditoría generó un informe `unknown`, PDF, CV y una fila de tracker basura. Esos artefactos de prueba fueron limpiados, pero el bug sigue en el producto.

También hay deuda de UX en estados de progreso, salida técnica en JSON crudo, accesibilidad semántica, textos sin pulir en español y falta de confirmaciones antes de operaciones que escriben en disco.

## Alcance probado

- Home y navegación principal.
- Oportunidades, escáner, panel de vigencia y acciones de integridad.
- Evaluación 360, guardas de entrada, URL privada y flujo completo.
- Dossier y asistentes.
- Seguimiento, filtros y panel de detalle.
- Perfil, tabs de edición y estrategia de escaneo.
- Sistema, doctor, verify, normalize, dedup, merge, updates, provider readiness e idioma.
- Responsive móvil a `390x844`.
- Consola del navegador y errores/warnings.
- Revisión de código en `app/public/app.js`, `app/server.mjs` y tests smoke.

## Pruebas ejecutadas

```bash
node update-system.mjs check
npm run app:check
npm run app:api-smoke
npm run app:browser-smoke
```

Resultado:

- `career-ops` está actualizado: `1.8.1`.
- `app:check`: OK.
- `app:api-smoke`: OK.
- `app:browser-smoke`: OK.
- Navegador integrado: sin errores ni warnings de consola durante navegación normal.
- Responsive móvil: sin overflow horizontal detectado.

## Hallazgos priorizados

## Prueba profunda de herramientas y APIs

Esta segunda ronda se hizo usando ofertas de bajo encaje/descartadas, principalmente `#8 Anthropic - Field Marketing Manager` (`SKIP`, `1.8/5`) y contexto discard. Antes de probar endpoints de escritura se hizo backup temporal de `data/applications.md`, `data/pipeline.md`, `portals.yml`, `config/profile.yml`, `modes/_profile.md` y archivos de eventos/schedule si existían. Los cambios provocados por la auditoría se restauraron después.

### Botones y herramientas probadas en navegador

| Área | Acción probada | Resultado | Hallazgo |
|---|---|---:|---|
| Seguimiento | Seleccionar `#8 Anthropic` desde tracker | OK | El panel de detalle carga score, estado, informe, PDF y consola de acciones. |
| Seguimiento | Cambiar estado `SKIP -> Discarded -> SKIP` desde select | OK | Escribe inmediatamente sin confirmación; usable, pero riesgoso si se cambia por error. |
| Seguimiento | Abrir aprendizaje `No aplicaria` | OK | Abre diálogo con propuesta útil. El copy generado tiene textos sin acentos: `tecnico`, `aplicaria`, `senales`. |
| Seguimiento | Cancelar diálogo de aprendizaje | OK | No escribe. El textarea queda con contenido aunque el diálogo se cierre; no es grave, pero puede confundir al reabrir. |
| Dossier | Botón contextual `Dossier empresa` desde app discard | OK | Cambia a Dossier e hidrata contexto Anthropic. |
| Dossier | `apply-assistant` | OK | Genera borrador y mantiene la advertencia de revisar antes de enviar. |
| Dossier | `form-reader` desde UI | Parcial | El job tarda y puede no actualizar el output inmediatamente. En una secuencia rápida, un resultado tardío de form-reader sobrescribió la salida de otro módulo. |
| Dossier | `deep-research` | OK | Genera investigación, pero incluye CV completo/datos personales en pantalla; esperado localmente, aunque debería indicarse como contenido sensible. |
| Dossier | `interview-prep` | Mal | En la prueba visual, después de lanzar interview-prep apareció un `SAFE FILL PLAN` de form-reader. Señal clara de race condition o salida stale entre módulos. |
| Dossier | `outreach` | OK | Genera mensaje breve. Sigue en inglés aunque la app esté en español. |
| Dossier | `offer-comparison` | OK | Para Anthropic descarta correctamente: `Recommend against applying`. Sigue en inglés. |
| Dossier | `training` | OK | Genera veredicto `DO NOT DO`. Sigue en inglés. |
| Dossier | `project` | OK | Genera veredicto `SKIP`. Sigue en inglés. |

Nota sobre la prueba: el navegador integrado falló al escribir manualmente en inputs con un error de clipboard virtual. No lo cuento como bug de la app porque los selects, clicks y submits funcionaron, y las APIs directas permitieron cubrir payloads.

### APIs directas probadas

| Endpoint / acción | Resultado | Observaciones |
|---|---:|---|
| `GET /api/health` | OK | Devuelve setup listo. |
| `GET /api/applications` | OK | Devuelve aplicaciones, métricas, estados y eventos. |
| `GET /api/reports` y `GET /api/reports/033-anthropic-2026-06-02` | OK | Report lookup correcto. |
| `GET /api/pipeline` | OK | Lista cola. |
| `POST /api/pipeline` con oferta temporal | OK | Añade entrada. |
| `PATCH /api/pipeline/{id}` | OK | Marca entrada temporal como hecha. |
| `DELETE /api/pipeline/{id}` | OK | Borra entrada temporal. Falta confirmación/undo en UI. |
| `GET /api/scanner/discovery` | OK | Discovery disponible. |
| `GET /api/scanner/strategy` | OK | Estrategia legible por API. |
| `PUT /api/scanner/schedule` | OK | Crea/modifica `data/scan-schedule.json`; no hay confirmación previa en UI. |
| `POST /api/jobs/scan` con `dryRun=true`, `company=Anthropic` | OK | Job completado. Escaneó 1 compañía, encontró 365 jobs, filtró 282 por título, 80 por ubicación, 3 duplicados, 0 añadidos. Correctamente no escribió ofertas. |
| `POST /api/jobs/liveness` con URL local privada | OK esperado como error | Rechaza con `400`; correcto por seguridad. |
| `POST /api/jobs/liveness-bulk` con URLs inválidas | Parcial | Devuelve `jobId` y luego el job falla rápido. Sería mejor devolver 400 síncrono si ninguna URL es válida. |
| `PATCH /api/applications/8/status` con `Discarded` | OK | Cambia estado. |
| `PATCH /api/applications/8/status` con `SKIP` | OK | Restaura estado. |
| `PATCH /api/applications/8/status` con `BogusStatus` | Mal | No devuelve 400; lo normaliza/silencia como `Evaluated`. Riesgo de corrupción silenciosa. |
| `POST /api/applications/8/outcome` | OK | Escribe en `data/application-events.md`. Funciona, pero sin confirmación en UI. |
| `POST /api/modules/apply-assistant` | OK | Devuelve borrador. |
| `POST /api/modules/form-reader` | OK | Lee formulario Greenhouse de Anthropic, detecta `Apply` y `Submit application`, clasifica 6 campos safe prefill, 19 draft review, 3 sensitive, 1 upload manual. No envía nada. |
| `POST /api/modules/deep-research` | OK | Genera prompt/research pack. |
| `POST /api/modules/interview-prep` | OK por API | El problema está en la UI/race, no necesariamente en el endpoint. |
| `POST /api/modules/outreach` | OK | Genera mensaje. |
| `POST /api/modules/offer-comparison` | OK | Recomienda no aplicar a Anthropic. |
| `POST /api/modules/training` | OK | Veredicto negativo. |
| `POST /api/modules/project` | OK | Veredicto `SKIP`. |
| `POST /api/learning/proposal` | OK | Genera propuesta de aprendizaje sin escribir. |

### Nuevos hallazgos de esta ronda

#### P0 - `PATCH /api/applications/:id/status` acepta estados inválidos

Severidad: crítica  
Evidencia: `PATCH /api/applications/8/status` con `{ "status": "BogusStatus" }` respondió OK y devolvió estado `Evaluated`.

Impacto:

- Un cliente con bug, una extensión o una llamada manual puede cambiar estados a un fallback inesperado.
- Puede convertir silenciosamente un `SKIP` en `Evaluated`, reabriendo ofertas que el usuario descartó.

Recomendación:

- Validar contra `templates/states.yml`.
- Si el estado no existe, devolver `400 { error: "Estado no válido" }`.
- Añadir test API para estado inválido.

#### P0 - Race condition en salida de módulos del Dossier

Severidad: crítica  
Evidencia: en una secuencia real de botones, `form-reader` tardó más y su `SAFE FILL PLAN` apareció después de lanzar otro módulo. `interview-prep` mostró salida propia de form-reader en la UI.

Impacto:

- El usuario puede creer que está viendo preparación de entrevista cuando en realidad ve lectura de formulario.
- Puede copiar/usar un output equivocado para una candidatura.

Recomendación:

- Asociar cada salida a `requestId`/`jobId` y descartar resultados stale si ya cambió el módulo.
- Limpiar `#module-output` con estado "Generando X..." antes de cada submit.
- Mostrar cabecera fija con módulo, empresa, rol y timestamp.
- Añadir bloqueo o cola si un módulo sigue running.

#### P1 - Acciones de escritura funcionan, pero sin suficiente fricción

Severidad: alta  
Evidencia: cambio de estado, outcome journal, schedule, pipeline delete y strategy/profile saves escriben directamente.

Impacto:

- El producto es potente, pero un clic accidental modifica archivos de usuario.

Recomendación:

- Confirmación para acciones destructivas o persistentes.
- Undo para cambios simples de pipeline/status.
- Mensaje post-acción con archivo tocado y diff/resumen.

#### P1 - `form-reader` es funcional y seguro, pero necesita mejor UX

Severidad: alta  
Evidencia: API detectó formulario real Greenhouse de Anthropic, submit controls y campos sensibles sin enviar nada.

Lo bueno:

- Cumple la regla ética: lectura read-only, no submit.
- Clasifica campos por riesgo.

Problemas:

- La UI mezcla inglés/español.
- En secuencias rápidas su resultado puede sobrescribir otro módulo.
- El output es largo y difícil de escanear.

Recomendación:

- Convertir safe fill plan en tabla interactiva con filtros: safe, draft, sensitive, upload.
- Mostrar `Submit-like controls detected` como alerta destacada.
- No renderizar todo el markdown plano como primera capa.

#### P2 - Los módulos no aplican la localización de la app

Severidad: media  
Evidencia: outputs visibles con `Offer Comparison`, `Recommend against applying`, `Training Evaluation`, `Verdict`, `DO NOT DO`, `Project Evaluation`, `SAFE FILL PLAN`.

Impacto:

- La app está en español, pero los resultados cambian de idioma.

Recomendación:

- Pasar `language`/`modesDir` a todos los módulos.
- Traducir renderizadores de módulos o plantillas.
- Añadir tests de idioma para outputs principales.

#### P2 - Escaneo dry-run funciona bien, pero el resumen debería ser visual

Severidad: media  
Evidencia: `POST /api/jobs/scan` dry-run Anthropic completó correctamente y no escribió. El log indicó 365 jobs encontrados, filtros aplicados y 0 añadidos.

Recomendación:

- Renderizar resultados de scan como métricas: encontrados, filtrados por título, filtrados por ubicación, duplicados, añadidos.
- Mantener stdout crudo plegado.

### P0 - "Flujo completo" puede crear artefactos reales con input insuficiente

Severidad: crítica  
Área: Evaluación 360, integridad de datos, confianza del usuario  
Evidencia:

- UI: `#auto-pipeline-btn` en `app/public/app.js`.
- Hidratación automática: `hydrateEvaluateFromSelection()` en `app/public/app.js`.
- Pipeline real: `/api/jobs/auto-pipeline` en `app/server.mjs`.
- Durante la auditoría, el flujo creó una evaluación `unknown` a partir de contexto seleccionado, no de una JD completa.

Impacto:

- Puede añadir filas basura al tracker.
- Puede generar informes, PDFs y CVs sin que el usuario entienda que está escribiendo en disco.
- Rompe la promesa de "decisión humana siempre" porque una acción aparentemente exploratoria dispara una cadena de cambios persistentes.

Causa probable:

- Al seleccionar una aplicación o report, `hydrateEvaluateFromSelection()` rellena `evaluate-jd` con notas del informe: `Contexto del informe seleccionado: ...`.
- La guarda del botón solo comprueba si hay `url` o `jdText`.
- El backend acepta cualquier `jdText` no vacío y continúa hasta `merge-tracker.mjs`, PDF y CV.

Recomendación:

- Diferenciar explícitamente `jdText` real de `contexto hidratado`.
- Añadir `sourceKind` o `inputTrust` al formulario.
- Bloquear `auto-pipeline` si el texto procede de contexto y no de una JD pegada o extracción verificada.
- Añadir confirmación previa para cualquier acción que vaya a escribir tracker, report, PDF o CV.
- En backend, validar longitud mínima y estructura básica de JD antes de evaluar. No confiar solo en el frontend.

### P0 - Los estados de progreso quedan incoherentes tras errores tempranos

Severidad: crítica  
Área: Evaluación 360, jobs, feedback de usuario  
Evidencia:

- URL privada rechazada correctamente: `URL no permitida. Usa una URL http(s) publica.`
- Pero el checklist dejó `url-guard` en `running`.
- La cabecera llegó a mostrar trabajos activos aunque el job ya había fallado.

Impacto:

- El usuario no sabe si el proceso terminó, falló o sigue corriendo.
- Puede reintentar y duplicar trabajos.

Recomendación:

- Cuando `requireSafeUrl()` falla, emitir artefacto final con `url-guard: failed` y todos los pasos restantes como `blocked` o `skipped`.
- En `streamReturnedJob()`, procesar eventos `error` y `done` como estados terminales.
- Añadir un resumen final legible: "Falló antes de escribir archivos" o "Falló después de crear X".

### P1 - Faltan confirmaciones para acciones persistentes

Severidad: alta  
Área: Seguridad de producto, ética, prevención de daño  
Evidencia:

- `Integrar TSV`, `Reparar setup`, `Guardar estrategia`, `Guardar cambios`, generación de PDFs y `Flujo completo` pueden escribir archivos.
- La UI informa que no envía candidaturas, pero no separa claramente "vista previa" de "escritura local".

Impacto:

- Un clic accidental puede modificar datos del usuario.
- La app es local, pero sus datos son sensibles y forman parte de la pipeline real.

Recomendación:

- Crear un patrón común `confirmMutation()` para operaciones persistentes.
- Mostrar qué archivos se van a tocar antes de confirmar.
- Añadir modo "dry-run" por defecto en flujo completo, con botón separado "Ejecutar y guardar".
- Registrar en UI la lista de artefactos generados por cada job.

### P1 - Salidas del sistema demasiado técnicas

Severidad: alta  
Área: Sistema, integridad, updates  
Evidencia:

- Doctor, verify, normalize, dedup, merge, provider readiness e idioma se muestran como JSON o stdout crudo.
- El usuario ve estructuras como `{ "ok": true, "code": 0, "stdout": ... }`.

Impacto:

- Es útil para depuración, pero no para un usuario no técnico.
- Dificulta detectar qué acción tomar después.

Recomendación:

- Renderizar cada acción con tarjetas: resultado, cambios previstos, warnings y siguiente acción.
- Mantener el JSON crudo plegable bajo "Detalles técnicos".
- Para comandos dry-run, mostrar explícitamente "No se han escrito cambios".

### P1 - Provider readiness confuso

Severidad: alta  
Área: Sistema, evaluación, configuración  
Evidencia:

- En Sistema, "Proveedores" devuelve `opencode: false`, `gemini: false` y warning de `OPENCODE_API_KEY`.
- A la vez, la evaluación ejecutada durante auditoría sí llamó a `opencode-eval.mjs` e inyectó `.env`.

Impacto:

- El usuario puede pensar que no puede evaluar aunque el script sí funcione.
- O al revés: puede confiar en un proveedor que fallará fuera del contexto de `.env`.

Recomendación:

- Unificar la lógica de readiness con la misma carga de `.env` que usan los scripts.
- Mostrar estado por proveedor: instalado, API key presente, modelo configurado, última prueba.
- Añadir botón "Probar evaluación mock" y "Probar proveedor real".

### P1 - Accesibilidad incompleta en tabs y tablas

Severidad: alta  
Área: Accesibilidad, teclado, lectores de pantalla  
Evidencia:

- El contenedor de Perfil usa `role="tablist"`, pero los botones `.tab` no tienen `role="tab"`, `aria-selected` ni `aria-controls`.
- El tracker se renderiza como `div.table-head` y botones `.table-row`, no como tabla semántica ni grid ARIA.
- Vistas de compatibilidad pueden quedar activas junto a la vista real (`view-inbox`, `view-lab`) al navegar.

Impacto:

- Lectores de pantalla y navegación por teclado tendrán contexto pobre.
- Los datos tabulares no se anuncian como tabla.

Recomendación:

- Implementar tabs ARIA completos.
- Convertir tracker a `<table>` real o `role="grid"` con navegación definida.
- Usar `aria-current="page"` en navegación.
- Evitar que vistas alias queden `.active`; usar alias solo en tests o rutas.

### P2 - Copy/i18n en español incompleto

Severidad: media  
Área: Pulido, confianza, localización  
Evidencia:

- Textos visibles como `senal`, `verificacion`, `aplicacion`, `evaluacion`, `revision`, `Decision`.
- Algunos labels de acción mezclan inglés: `Apply Assisted`, `Review`, `Discard`, `POST-APPLY`, `HIGH`.
- En consola PowerShell aparecen mojibakes, aunque en navegador el render se ve bien.

Impacto:

- La experiencia pierde acabado.
- La mezcla de idiomas puede confundir al usuario en flujos de decisión.

Recomendación:

- Centralizar strings en un diccionario i18n.
- Ejecutar un test de "no mojibake/no texto sin acentos" sobre DOM visible.
- Mantener labels internos en inglés solo en `data-*`, no en UI.

### P2 - Dossier usa contexto seleccionado aunque el formulario parezca vacío

Severidad: media  
Área: Dossier, claridad de contexto  
Evidencia:

- Al entrar en Dossier tras seleccionar una app, el asistente se rellena con contexto.
- Al enviar sin tocar campos, genera output para la app seleccionada.

Impacto:

- Puede ser útil, pero el usuario necesita ver claramente "estás trabajando sobre X".
- Si el contexto seleccionado no es evidente, puede generar material para la oferta equivocada.

Recomendación:

- Añadir una banda fija de contexto: empresa, rol, report id, URL.
- Añadir botón "Limpiar contexto".
- Antes de generar asistente, mostrar el contexto usado.

### P2 - Panel de Oportunidades con acciones destructivas demasiado directas

Severidad: media  
Área: Oportunidades  
Evidencia:

- El detalle de oportunidad expone `Eliminar`, `Marcar hecha`, `Evaluar`, `Verificar activa`.
- No se probó eliminación por seguridad, pero el patrón visual la deja cerca de acciones no destructivas.

Impacto:

- Riesgo de borrar o cerrar oportunidades por error.

Recomendación:

- Confirmar eliminación y mostrar URL/empresa afectada.
- Separar acciones destructivas visualmente.
- Añadir undo local para la última acción de pipeline.

### P2 - Jobs y logs no son suficientemente operativos

Severidad: media  
Área: Jobs, observabilidad  
Evidencia:

- El log muestra eventos crudos, ids y JSON de artifacts.
- No hay una lista persistente visible de jobs recientes con estado final, artefactos y posibilidad de cancelar.

Impacto:

- Difícil auditar qué ha pasado después de una operación larga.
- Difícil recuperar artefactos.

Recomendación:

- Añadir "Trabajos recientes" con estado, duración, archivos creados y errores.
- Añadir botón cancelar en jobs running.
- Convertir logs en timeline visual y dejar raw log plegado.

### P3 - Tests smoke no cubren el caso real más peligroso

Severidad: baja-media  
Área: QA  
Evidencia:

- `app/browser-smoke.mjs` valida que el flujo completo vacío no dispare request.
- No valida el caso con contexto hidratado desde una aplicación o reporte.

Impacto:

- Un bug crítico pasa la suite.

Recomendación:

- Añadir test: seleccionar aplicación, ir a Evaluación, comprobar que el texto hidratado no permite auto-pipeline sin confirmación/JD real.
- Añadir test de URL privada que espere estado terminal `failed`.
- Añadir test de no creación de `unknown` cuando falta JD.

## Plan macro de implementación

### Fase 1 - Guardrails y consistencia de datos

Objetivo: impedir que un clic genere datos basura o modifique tracker sin intención clara.

Tareas:

1. Añadir modelo de input para Evaluación:
   - `sourceKind: manual-jd | extracted-url | hydrated-context | mock-fixture`.
   - `inputTrust: trusted-manual | trusted-playwright | untrusted-context | untrusted-mock`.
2. Bloquear backend `/api/jobs/auto-pipeline` si:
   - no hay URL ni JD real,
   - el texto viene de contexto hidratado,
   - la JD tiene menos de un umbral razonable,
   - no hay confirmación explícita para persistir.
3. Dividir UI:
   - "Previsualizar evaluación" o "Validar input".
   - "Ejecutar flujo completo y guardar".
4. Añadir confirmaciones de escritura con lista de archivos afectados.
5. Corregir estados terminales de jobs en error.

Criterios de aceptación:

- No se puede crear report `unknown` desde contexto o vacío.
- Un fallo de URL privada deja `url-guard: failed` y job terminado.
- La UI informa "no se escribieron archivos" cuando falla antes de persistir.

### Fase 2 - UX de jobs, logs y acciones críticas

Objetivo: que el usuario entienda qué está pasando y qué se ha creado.

Tareas:

1. Crear componente `JobTimeline`.
2. Crear componente `MutationSummary`.
3. Añadir panel "Trabajos recientes".
4. Añadir cancelación visible para jobs running.
5. Renderizar stdout/JSON como resumen humano + detalles técnicos plegables.

Criterios de aceptación:

- Cada job muestra estado, duración, pasos y artefactos.
- Los logs crudos no son la primera capa visible.
- Las acciones persistentes tienen confirmación y resumen posterior.

### Fase 3 - Accesibilidad y semántica

Objetivo: hacer la app usable con teclado y lectores de pantalla.

Tareas:

1. Implementar ARIA tabs en Perfil.
2. Convertir tracker a tabla semántica o grid accesible.
3. Añadir `aria-current` en navegación.
4. Revisar labels de controles dinámicos del escáner y estrategia.
5. Evitar vistas alias activas simultáneas.
6. Añadir pruebas con axe o checks DOM básicos.

Criterios de aceptación:

- Tabs anuncian selección y panel asociado.
- Tracker permite navegación por filas y columnas con semántica clara.
- No hay controles interactivos sin nombre accesible.

### Fase 4 - Pulido i18n y copy

Objetivo: elevar confianza percibida y coherencia lingüística.

Tareas:

1. Centralizar strings visibles en `state.js` o módulo i18n.
2. Sustituir labels ingleses visibles por español.
3. Restaurar acentos en textos hardcodeados.
4. Añadir test de strings visibles:
   - sin mojibake,
   - sin phrases inglesas clave,
   - sin variantes sin acento en textos críticos.
5. Revisar microcopy de riesgo: aplicar, enviar, guardar, borrar.

Criterios de aceptación:

- UI en español consistente.
- Los términos técnicos están explicados o traducidos.
- Los tests bloquean regresiones de copy.

### Fase 5 - QA ampliado y regresión

Objetivo: que los bugs encontrados queden cubiertos por tests permanentes.

Tareas:

1. Ampliar `app/browser-smoke.mjs` con flujos reales:
   - app seleccionada -> Evaluación -> auto-pipeline bloqueado si solo hay contexto,
   - URL privada -> fallo terminal limpio,
   - Dossier muestra contexto activo,
   - Sistema muestra resúmenes humanos,
   - mobile tracker y detalle.
2. Añadir fixtures temporales aisladas para no tocar datos reales.
3. Crear entorno de test con root temporal o fixture workspace.
4. Añadir comprobación de que no se generan archivos inesperados.

Criterios de aceptación:

- La suite falla si se crea un report/tracker sin JD real.
- Los tests no dependen del estado real del usuario.
- QA cubre navegación, persistencia, errores y responsive.

## Backlog sugerido

### Alto impacto

- Añadir modo "sandbox" de app para auditoría y demos.
- Añadir "deshacer último cambio" para pipeline/tracker.
- Añadir diff visual antes de guardar `profile.yml`, `_profile.md`, `portals.yml`.
- Añadir "context chip" global con botón para limpiar selección.

### Medio impacto

- Mejorar tabla de aplicaciones con ordenación por score, fecha y estado.
- Añadir filtros persistentes pero visibles como chips removibles.
- Añadir búsqueda global por empresa, rol, report y oportunidad.
- Añadir "abrir archivo generado" desde jobs.

### Pulido

- Revisar iconografía para sustituir símbolos raros por iconos consistentes.
- Homogeneizar chips de decisión.
- Añadir estados vacíos más específicos por sección.
- Hacer que "API" abra una vista legible en la app, no JSON crudo en pestaña nueva.

## Riesgos si no se corrige

- Contaminación del tracker con evaluaciones inválidas.
- Generación de CVs o PDFs sin intención explícita.
- Pérdida de confianza en el sistema por acciones inesperadas.
- Dificultad para usuarios no técnicos al interpretar errores y salidas.
- Regresiones no detectadas porque los smoke tests actuales cubren la ruta feliz, pero no las combinaciones de contexto real.

## Estado final de la auditoría

- No quedan artefactos `036-unknown` generados por la prueba.
- `verify-pipeline` reportó pipeline limpia tras la limpieza.
- La app es usable, pero antes de uso intensivo conviene abordar la Fase 1.
