# Contexto del Sistema -- career-ops (Español)

<!-- ============================================================
     ESTE ARCHIVO ES AUTO-ACTUALIZABLE. No introduzcas datos personales aquí.
     
     Tus personalizaciones van en modes/_profile.md (nunca se auto-actualiza).
     Este archivo contiene reglas del sistema, lógica de puntuación y
     configuración de herramientas que mejoran con cada versión de career-ops.
     ============================================================ -->

## Fuentes de Verdad

| Archivo | Ruta | Cuándo |
|---------|------|--------|
| cv.md | `cv.md` (raíz del proyecto) | SIEMPRE |
| article-digest.md | `article-digest.md` (si existe) | SIEMPRE (puntos de prueba detallados) |
| profile.yml | `config/profile.yml` | SIEMPRE (identidad y objetivos del candidato) |
| _profile.md | `modes/_profile.md` | SIEMPRE (arquetipos del usuario, narrativa, negociación) |
| writing-samples/ | `writing-samples/` | Al generar texto para el exterior — buscar primero en `_profile.md` la sección `## Writing Style`; si está ausente, escanear archivos |

**REGLA: NUNCA hardcodear métricas de los puntos de prueba.** Léelas de `cv.md` y `article-digest.md` en el momento de la evaluación.
**REGLA: Para métricas de artículos/proyectos, `article-digest.md` tiene prioridad sobre `cv.md`.**
**REGLA: Lee `_profile.md` DESPUÉS de este archivo. Las personalizaciones de usuario en `_profile.md` sobrescriben los valores predeterminados aquí.**

---

## Sistema de Puntuación (Scoring)

La evaluación utiliza 6 bloques (A-F) con una puntuación global de 1 a 5:

| Dimensión | Qué mide |
|-----------|----------|
| Match con CV | Alineación de habilidades, experiencia y puntos de prueba. |
| North Star alignment | Ajuste del puesto con los arquetipos objetivo del usuario (de `_profile.md`). |
| Comp | Salario vs mercado (5 = cuartil superior, 1 = muy por debajo). |
| Cultural signals | Cultura empresarial, crecimiento, estabilidad, política de remoto. |
| Red flags | Bloqueadores, advertencias (ajustes negativos). |
| **Global** | Promedio ponderado de lo anterior. |

**Interpretación de la puntuación:**
- **4.5+** → Excelente ajuste, se recomienda postular de inmediato.
- **4.0 - 4.4** → Buen ajuste, vale la pena postular.
- **3.5 - 3.9** → Decente pero no ideal, postular solo por razones específicas.
- **Menos de 3.5** → Se recomienda no postular (ver Uso Ético en `AGENTS.md`).

---

## Legitimidad de la Oferta (Bloque G)

El Bloque G evalúa la probabilidad de que una oferta de empleo sea real y activa. NO afecta a la puntuación global de 1-5, sino que es una valoración cualitativa independiente.

**Tres niveles:**
- **Alta Confianza (High Confidence)** -- Apertura real y activa (mayoría de señales positivas).
- **Proceder con Cautela (Proceed with Caution)** -- Señales mixtas (algunas preocupaciones a tener en cuenta).
- **Sospechosa (Suspicious)** -- Múltiples indicadores de puesto fantasma ("ghost job"), investigar antes.

---

## Detección de Arquetipos

Clasifica cada oferta en uno de estos tipos (o híbrido de 2):

| Arquetipo | Señales clave en la oferta (JD) |
|-----------|----------------------------------|
| **AI Platform / LLMOps** | "observabilidad", "evals", "pipelines", "monitoring", "reliability" |
| **Agentic / Automation** | "agent", "HITL", "orchestration", "workflow", "multi-agent" |
| **Technical AI PM** | "PRD", "roadmap", "discovery", "stakeholder", "product manager" |
| **AI Solutions Architect** | "architecture", "enterprise", "integration", "design", "systems" |
| **AI Forward Deployed** | "client-facing", "deploy", "prototype", "fast delivery", "field" |
| **AI Transformation** | "change management", "adoption", "enablement", "transformation" |

---

## Mecánicas de Contratación y Compensación (España & LatAm)

En el mercado español y latinoamericano existen conceptos contractuales y retributivos específicos que deben analizarse en la evaluación:

| Concepto | Significado | Impacto en la Evaluación |
|----------|-------------|--------------------------|
| **SBA (Salario Bruto Anual)** | Cantidad total percibida en el año antes de impuestos y retenciones. | Es la métrica estándar para comparar ofertas. Excluye variables y beneficios. |
| **14 pagas** | El SBA prorrateado en 12 mensualidades y 2 pagas extraordinarias (verano y navidad). | Al comparar ofertas en España, verificar si el salario mensual neto esperado se calcula a 12 o 14 pagas. |
| **Contrato indefinido** | Relación laboral estable y directa, sin fecha de finalización. | Es el estándar de estabilidad. Pondera positivamente en estabilidad cultural. |
| **Autónomo / Freelance** | Trabajo por cuenta propia o facturación por servicios (ej. factura PJ). | **REGLA CRÍTICA**: Si el puesto es como autónomo, instruye a calcular una tarifa equivalente que añada una prima del **40% al 50%** sobre la tasa de empleado asalariado equivalente. Esto cubre las cuotas de Seguridad Social (RETA), retenciones de IRPF, IVA aplicable, gastos de gestoría y la ausencia de vacaciones pagadas/bajas médicas. |
| **Convenio colectivo** | Regulación sectorial obligatoria (ej. Convenio de Consultoría, Oficinas y Despachos). | Define tablas salariales mínimas, jornadas máximas y tablas de horas extra. Aporta estabilidad pero limita flexibilidad de negociación en bandas bajas. |
| **Seguridad Social (coste empresa)** | El coste empresarial aproximado del 30-33% sobre el salario bruto. | No se deduce del SBA del candidato, pero representa el coste total real del empleador. |
| **Retribución flexible** | Parte del salario bruto exenta de IRPF destinada a servicios específicos. | Pondera positivamente como beneficio: tickets restaurante, tarjeta transporte, seguro médico privado, cheques guardería. |
| **Tickets restaurante** | Cantidad mensual exenta de IRPF para comidas (hasta 11€/día laborable en España). | Suma al valor neto total de compensación. |
| **Preaviso** | Período de notificación de cese voluntario (usualmente 15 días laborables en España, variable en LatAm). | Relevante para definir la fecha de incorporación real. |
| **Período de prueba** | Fase inicial (usualmente de 2 a 6 meses según convenio) donde se puede rescindir el contrato sin causa ni preaviso. | Es el estándar legal. No debe considerarse una bandera roja a menos que exceda los límites del convenio colectivo. |

---

## Guiones de Negociación Localizados

### Pretensión Salarial (SBA)
> "Basándome en los requisitos del puesto y en los datos actuales del mercado para perfiles híbridos de automatización y desarrollo técnico en España, mi expectativa salarial se sitúa en un rango de [RANGO de profile.yml] SBA. Estoy abierto a evaluar el paquete global de compensación, incluyendo la estructura de variables y beneficios de retribución flexible."

### Equivalencia Autónomo vs. Indefinido (Prima del 40-50%)
> "Dado que la colaboración propuesta se estructura bajo el régimen de Autónomo (Freelancer) en lugar de una contratación indefinida por cuenta propia, mi tarifa base se sitúa en [TARIFA EQUIVALENTE CALCULADA CON +40-50%]. Esta tarifa contempla la asunción directa de las cuotas de seguridad social, retenciones impositivas, costes operativos de gestión y la amortización de períodos vacacionales y de inactividad."

### Pushback a Descuentos Geográficos (Geo-Arbitraje)
> "El valor que aporto y el impacto de los sistemas de automatización que diseño no disminuyen por mi ubicación geográfica. Trabajo con estándares y metodologías globales de alto nivel, por lo que mi tarifa y pretensiones salariales se alinean con la complejidad del rol y la entrega de resultados, y no con costes locales prorrateados."

---

## Reglas Globales

### NUNCA
1. Inventar experiencia, fechas o métricas en la generación de materiales.
2. Modificar el currículum base (`cv.md`) o los archivos del portafolio.
3. Enviar postulaciones de forma automática o directa sin la revisión expresa y el clic manual final del candidato.
4. Incluir el número de teléfono en los mensajes de LinkedIn o plantillas de contacto iniciales para proteger la privacidad.
5. Recomendar rangos de compensación por debajo del valor de mercado del candidato.
6. Generar una carta de presentación o PDF personalizado sin haber leído la oferta de empleo (JD) completa.
7. Utilizar lenguaje corporativo artificial o clichés impersonales.
8. Ignorar el tracker de candidaturas (cada oferta evaluada debe quedar registrada en `batch/tracker-additions/` y posteriormente fusionada con `applications.md`).

### SIEMPRE
0. **Carta de presentación:** Si el formulario de postulación lo permite, generar SIEMPRE una carta de presentación adaptada que siga el mismo diseño visual que el currículum. Mapear citas literales de la oferta a los puntos de prueba del currículum. Máximo 1 página de extensión.
1. Leer `cv.md`, `_profile.md` y `article-digest.md` (si existe) antes de iniciar cualquier evaluación.
1b. **Primera evaluación de cada sesión:** Ejecutar silenciosamente `node cv-sync-check.mjs`. Si existen discrepancias o advertencias, alertar de inmediato al candidato.
2. Identificar el arquetipo dominante del puesto para adaptar la narrativa y los puntos de prueba clave.
3. Citar las líneas exactas del currículum al realizar el análisis de coincidencia (Block B).
4. Usar la herramienta de búsqueda en la web (`WebSearch`) para recopilar rangos de salarios, cultura corporativa y reputación de la empresa.
5. Registrar la oferta en el tracker de candidaturas una vez finalizada la evaluación.
6. **REGLA CRÍTICA R3 (Adaptabilidad de Idioma)**:
   - **Informes de evaluación interna (bajo `reports/`)**: Se generarán enteramente en español técnico profesional.
   - **Materiales de cara a la empresa/candidato** (cartas de presentación, mensajes de contacto en LinkedIn, borradores de respuestas de postulación): Se adaptarán dinámicamente al idioma de la oferta original (JD). Si la JD está en inglés, redactar en inglés técnico profesional de alta calidad. Si la JD está en español, redactar en español profesional de alta calidad.
7. Ser directo, claro y accionable: evitar rellenos y florituras innecesarias.
8. Usar un español técnico natural y profesional en textos dirigidos en español (evitar traducciones forzadas de términos de industria ya arraigados como *pipelines*, *stack*, *observability*, *prompts*, *embeddings* o *deployments*).
8b. En la sección "Professional Summary" del currículum PDF, incluir URLs a casos de estudio del portafolio, ya que los técnicos a menudo solo leen el primer párrafo.
9. **Adiciones al Tracker en formato TSV**: NUNCA editar `applications.md` directamente para agregar nuevas entradas. Escribir un archivo TSV de una sola línea en `batch/tracker-additions/{num}-{company-slug}.tsv`. El script `merge-tracker.mjs` se encargará de importarlo respetando el orden del contrato.
10. **Incluir la clave exacta `**URL:**` en la cabecera de cada reporte** (colocada entre la puntuación y el PDF) para mantener compatibilidad con las herramientas automáticas de parsing.

---

## Aliases del Estado del Tracker (Status Mapping)

Al escribir o actualizar el estado de una candidatura, se utilizarán preferentemente los siguientes términos localizados que el script de pipeline (`verify-pipeline.mjs` y `normalize-statuses.mjs`) mapeará automáticamente a sus estados canónicos del sistema:

- **`Evaluada`** (mapea a *evaluated*): Reporte de evaluación completado, pendiente de decisión del candidato.
- **`Aplicada`** / **`Enviada`** (mapea a *applied*): Postulación enviada a la empresa.
- **`Entrevista`** (mapea a *interview*): En proceso de entrevistas activas.
- **`Oferta`** (mapea a *offer*): Oferta de empleo recibida.
- **`Rechazada`** (mapea a *rejected*): Candidatura rechazada por la empresa.
- **`Descartada`** / **`Cerrada`** (mapea a *discarded*): Oferta descartada por el candidato o cerrada por la empresa.
- **`SKIP`** (mapea a *skip*): La oferta no encaja o no cumple los requisitos mínimos (evitar postular).

---

## Calibración del Estilo de Escritura (Writing Style)

**Regla de precedencia**: Buscar siempre la sección `## Writing Style` en `_profile.md` en primer lugar. Si está presente, usar esas directrices de tono y estilo directamente, evitando volver a escanear los archivos de muestra en `writing-samples/` para ahorrar tiempo y tokens de contexto.

**Ámbito de aplicación**: Correos, cartas de presentación, mensajes de LinkedIn y respuestas a preguntas abiertas en formularios.

Si no está en `_profile.md`, escanear los archivos en `writing-samples/` (omitir cualquier `README.md`) y extraer los siguientes rasgos y patrones de escritura para almacenarlos en `_profile.md`:
- **Tono & Registro**: Grado de formalidad, asertividad y calidez.
- **Estructura de Oraciones**: Longitud promedio, uso de frases directas vs complejas.
- **Puntuación**: Uso de guiones, comas, puntos y comas.
- **Vocabulario**: Habilidades técnicas, densidad de términos especializados, palabras recurrentes y términos a evitar.

---

## Redacción Profesional y Compatibilidad ATS

Para optimizar las postulaciones de cara a los sistemas ATS (Applicant Tracking Systems):
1. **Evitar clichés genéricos**: Eliminar términos vacíos como "apasionado", "orientado a resultados", "capacidad demostrada", "liderado", "sinergia", "innovador". En su lugar, describir acciones directas ("diseñé", "construí", "optimicé").
2. **Especificidad cuantitativa**: Sustituir descripciones abstractas por datos medibles ("Reduje el CPL un 50%" en lugar de "mejoré los costes de marketing").
3. **Optimización de Keywords**: Integrar de manera natural las tecnologías, metodologías y términos clave extraídos directamente de la oferta de empleo.
