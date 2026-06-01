# Modo: oferta — Evaluación Completa A-G

Cuando el candidato pegue una oferta de empleo (texto o URL), entrega SIEMPRE los 7 bloques (evaluación A-F + legitimidad G):

## Paso 0 — Detección de Arquetipo

Clasifica el puesto en uno de los 6 arquetipos (ver `_shared.md`). Si es un híbrido, indica los 2 más cercanos. Esto determina:
- Qué puntos de prueba priorizar en el bloque B.
- Cómo reescribir el resumen en el bloque E.
- Qué historias STAR preparar en el bloque F.

---

## Bloque A — Resumen del Puesto

Generar una tabla o lista estructurada con:
- Arquetipo detectado.
- Dominio (platform/agentic/LLMOps/ML/enterprise).
- Función (build/consult/manage/deploy).
- Seniority (Sénior, Mid, Junior, Staff, etc.).
- Remoto (remoto/híbrido/presencial).
- Tamaño del equipo (si se menciona).
- TL;DR en 1 sola frase.

---

## Bloque B — Coincidencia con el CV

Lee `cv.md` y `article-digest.md`. Genera un análisis estructurado mapeando cada requisito de la oferta de empleo (JD) a las líneas o secciones exactas de tu currículum.

**Priorización adaptada al arquetipo:**
- Si es **FDE** → priorizar velocidad de entrega, despliegue rápido y puntos de prueba de cara al cliente.
- Si es **SA** → priorizar diseño de sistemas, integraciones empresariales y escalabilidad.
- Si es **PM** → priorizar discovery de producto, roadmaps y métricas de negocio.
- Si es **LLMOps** → priorizar sistemas de evaluación, observabilidad y pipelines de datos.
- Si es **Agentic** → priorizar automatización multi-agente, arquitecturas HITL y orquestación.
- Si es **Transformation** → priorizar gestión del cambio, adopción organizativa y habilitación técnica.

### Sección de Brechas (Gaps) y Mitigación
Para cada brecha crítica identificada:
1. ¿Es un bloqueador estricto (hard blocker) o un deseable (nice-to-have)?
2. ¿Puede el candidato demostrar experiencia adyacente o transferible?
3. ¿Existe algún proyecto del portafolio o caso de estudio que cubra esta brecha?
4. Plan de mitigación concreto (redacción de frase para la carta de presentación, proyecto rápido a realizar, etc.).

---

## Bloque C — Nivel y Estrategia

1. **Nivel detectado en la oferta** frente al **nivel natural del candidato para ese arquetipo**.
2. **Estrategia "Vender sénior sin mentir"**: frases específicas adaptadas al arquetipo, logros concretos a destacar y cómo posicionar la experiencia de fundador/desarrollador independiente como una ventaja estratégica.
3. **Estrategia "Si me bajan de nivel (downleveling)"**: plan de negociación para aceptar solo si la compensación total es justa, negociar una revisión contractual a los 6 meses y establecer criterios claros de promoción.

---

## Bloque D — Compensación y Demanda

Usa la herramienta `WebSearch` para investigar:
- Salarios actuales para el rol en la región correspondiente (Glassdoor, Levels.fyi, Tecnoempleo, InfoJobs).
- Reputación de compensación de la empresa.
- Tendencia de la demanda para este puesto en España / LatAm.

**Mecánicas y particularidades de contratación local (España & LatAm):**
- Calcular el Salario Bruto Anual (SBA) y si se ofrece en 12 o 14 pagas.
- Si la vacante es de Autónomo / Freelance, estimar la tarifa diaria/mensual aplicando obligatoriamente una **prima del 40-50%** sobre el salario de empleado asalariado equivalente para cubrir la asunción de cotizaciones de Seguridad Social (RETA), IRPF, IVA, gestoría y la falta de vacaciones remuneradas o bajas por enfermedad.
- Indicar si aplica algún Convenio Colectivo sectorial relevante.
- Listar los beneficios de retribución flexible comunes (tickets restaurante, seguro de salud, transporte, guardería) si se mencionan.

---

## Bloque E — Plan de Personalización

Genera una tabla o lista con los cambios sugeridos para maximizar la conversión ATS:

| # | Sección del CV | Estado Actual | Cambio Propuesto | Razón / Justificación |
|---|----------------|---------------|------------------|-----------------------|
| 1 | Resumen Profesional | ... | ... | ... |

Detalla las 5 principales modificaciones recomendadas para el CV y las 5 para el perfil de LinkedIn.

---

## Bloque F — Plan de Entrevistas

Diseña de 6 a 10 historias STAR+R (Situación, Tarea, Acción, Resultado + **Reflexión**):

| # | Requisito de la Oferta | Historia STAR+R | S | T | A | R | Reflexión |
|---|------------------------|-----------------|---|---|---|---|-----------|

La columna **Reflexión** debe capturar qué se aprendió o qué se haría de manera diferente hoy en día (señal clave de seniority).

**Alineación con el arquetipo:**
- FDE → Enfatizar velocidad de entrega e interacción con el cliente.
- SA → Enfatizar decisiones de diseño de arquitectura y mitigación de riesgos.
- PM → Enfatizar discovery de producto, análisis de compromiso (trade-offs) y métricas.
- LLMOps → Enfatizar observabilidad en producción, evals y robustez de pipelines.
- Agentic → Enfatizar orquestación, manejo de errores robusto e interfaces HITL.
- Transformation → Enfatizar adopción de usuarios, capacitación y gestión de cambio cultural.

También incluye:
- **1 Caso de Estudio recomendado** (qué proyecto de su portafolio presentar y cómo estructurarlo).
- **Preguntas difíciles/red-flag** y cómo responderlas asertivamente (ej. "¿por qué cerraste tu última startup?", "¿has gestionado equipos directos?").

---

## Bloque G — Legitimidad de la Oferta

Evalúa si la oferta representa una vacante real y activa analizando los siguientes factores cualitativos:
1. **Frescura de la publicación**: fecha de publicación (extraída mediante Playwright), estado del botón de postulación.
2. **Calidad de la descripción (JD)**: especificidad técnica, claridad en las responsabilidades del primer año, desglose salarial, presencia de contradictions.
3. **Señales de contratación corporativas**: búsqueda en la web de despidos recientes (`layoffs`), congelación de contrataciones (`hiring freeze`).
4. **Detección de republicación**: historial de escaneos anteriores (`scan-history.tsv`) para ver si la oferta se ha republicado múltiples veces.

**Formato de salida del Bloque G:**
- **Valoración**: Alta Confianza (High Confidence) | Proceder con Cautela (Proceed with Caution) | Sospechosa (Suspicious).
- **Tabla/Lista de señales observadas**: detalle, peso (Positivo, Neutro o Preocupante).
- **Notas de contexto**: matices o justificaciones legítimas (ej. vacantes continuas/evergreen, puestos altamente especializados Staff+, etc.).

---

## Post-evaluación

### 1. Guardar reporte .md

Guarda la evaluación completa obligatoriamente en la ruta `reports/{###}-{company-slug}-{YYYY-MM-DD}.md`.

- `{###}` = siguiente número secuencial de tres dígitos con ceros a la izquierda.
- `{company-slug}` = nombre de la empresa en minúsculas, sin espacios ni caracteres especiales (separado por guiones).
- `{YYYY-MM-DD}` = fecha actual en formato ISO.

**PLANTILLA OBLIGATORIA DEL REPORTE (CRÍTICA):**
El encabezado del reporte MUST conservar estrictamente las claves del formato en inglés en el orden exacto indicado a continuación. Esto es indispensable para no romper las herramientas automáticas de parsing y validación del pipeline:

```markdown
# Evaluation: {Company} — {Role}

**Date:** {YYYY-MM-DD}
**URL:** {URL de la oferta}
**Archetype:** {arquetipo detectado}
**Score:** {X.X/5}
**Legitimacy:** {High Confidence | Proceed with Caution | Suspicious}
**PDF:** {ruta del PDF generado o pending}

---

## A) Role Summary
(contenido completo del bloque A en español técnico)

## B) Match with CV
(contenido completo del bloque B en español técnico)

## C) Level and Strategy
(contenido completo del bloque C en español técnico)

## D) Comp and Demand
(contenido completo del bloque D en español técnico)

## E) Customization Plan
(contenido completo del bloque E en español técnico)

## F) Interview Plan
(contenido completo del bloque F en español técnico)

## G) Posting Legitimacy
(contenido completo del bloque G en español técnico)

## H) Draft Application Answers
(solo si la puntuación >= 4.5; borradores de respuestas para el formulario de inscripción adaptando el idioma de salida según R3)

---

## Keywords extracted
(lista de 15 a 20 palabras clave en inglés/español para optimización ATS extraídas de la JD)
```

### 2. Registrar en el Tracker

Escribe un archivo TSV de una sola línea en `batch/tracker-additions/{###}-{company-slug}.tsv` con 9 columnas separadas estrictamente por tabuladores (`\t`):

```text
{num}\t{date}\t{company}\t{role}\t{status}\t{score}/5\t{pdf_emoji}\t[{num}](reports/{num}-{slug}-{date}.md)\t{note}
```

*Donde el estado (`status`) debe ser un alias en español (ej. `Evaluada`), la puntuación (`score`) debe seguir el formato `X.X/5`, y la columna PDF debe llevar `✅` o `❌`.*
El script automatizado `merge-tracker.mjs` leerá estos archivos de adición y los fusionará limpiamente en `data/applications.md` respetando la integridad de la base de datos de candidaturas.
