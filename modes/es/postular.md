# Modo: postular — Asistente de Postulación en Vivo

Modo interactivo para cuando el candidato está completando un formulario de inscripción (postulación) en su navegador. Lee lo que hay en la pantalla, carga el contexto de la evaluación previa del puesto y genera respuestas personalizadas para cada pregunta del formulario.

## Requisitos

- **Recomendado con Playwright en modo visible**: el candidato ve el navegador y la IA puede interactuar con el DOM de la página para rellenar o extraer.
- **Sin Playwright**: el candidato comparte una captura de pantalla del formulario (la herramienta Read puede procesar imágenes) o copia y pega las preguntas manualmente.

---

## Flujo de Trabajo (Workflow)

```text
1. DETECTAR     → Leer la pestaña activa (captura/URL/título)
2. IDENTIFICAR  → Extraer la empresa y el puesto de la página
3. BUSCAR       → Mapear contra reportes existentes en reports/
4. CARGAR       → Leer el reporte completo + Bloque G (respuestas borrador)
5. COMPARAR     → ¿Coincide el puesto en pantalla con el evaluado? Si cambió → notificar
6. ANALIZAR     → Identificar TODAS las preguntas visibles del formulario
7. GENERAR      → Para cada pregunta, generar una respuesta personalizada adaptando el idioma (R3)
8. PRESENTAR    → Mostrar las respuestas formateadas listas para copiar y pegar
```

---

## Paso 1 — Detectar la oferta de empleo

- **Con Playwright**: Tomar una captura de pantalla de la página activa y extraer el título, la URL y el contenido de texto visible.
- **Sin Playwright**: Solicitar al candidato que realice una de las siguientes acciones:
  - Compartir una captura de pantalla del formulario de postulación.
  - Copiar y pegar las preguntas del formulario como texto.
  - Indicar el nombre de la empresa y el puesto para buscarlo en la base de datos local.

---

## Paso 2 — Identificar y cargar el contexto

1. Extraer el nombre de la empresa y el título del puesto.
2. Buscar en la carpeta `reports/` utilizando una búsqueda insensible a mayúsculas/minúsculas.
3. Si existe una coincidencia → cargar el reporte de evaluación completo.
4. Si existe un Bloque H en el reporte previo → cargar las respuestas borrador como base inicial de personalización.
5. Si NO existe coincidencia → notificar al candidato y ofrecer ejecutar un análisis rápido automático (`auto-pipeline`).

---

## Paso 3 — Detectar cambios en la oferta

Si el puesto en pantalla difiere del evaluado previamente:
- **Notificar al candidato**: "El título del puesto ha cambiado de [X] a [Y]. ¿Prefieres que vuelva a evaluar la vacante o que adapte las respuestas al nuevo título directamente?"
- **Si se adapta**: Ajustar las respuestas al nuevo rol sin realizar una re-evaluación formal.
- **Si se re-evalúa**: Ejecutar una evaluación completa A-F, actualizar el reporte y regenerar el Bloque H.
- **Actualizar el tracker**: Modificar el título del puesto en `applications.md` si es necesario.

---

## Paso 4 — Analizar las preguntas del formulario

Identificar TODAS las preguntas visibles en el formulario de inscripción:
- Campos de texto libre (carta de presentación, "¿por qué quieres trabajar con nosotros?", motivación, etc.).
- Desplegables (cómo te enteraste, autorización para trabajar, etc.).
- Opciones Sí/No (necesidad de patrocinio de visa, disposición para reubicación, etc.).
- Campos de compensación (expectativa salarial, rango).
- Subida de archivos (currículum, carta de presentación en PDF).

Clasificar cada pregunta:
- **Ya respondida en el Bloque H del reporte** → adaptar y refinar la respuesta existente.
- **Pregunta nueva** → generar una respuesta personalizada utilizando la información del reporte y de `cv.md` / `article-digest.md`.

---

## Paso 5 — Generar respuestas personalizadas

Para cada pregunta identificada, construir la respuesta óptima siguiendo estas directrices:

1. **Contexto de la evaluación**: Utilizar los puntos de prueba (Bloque B) y las historias STAR+R (Bloque F) como sustento factual.
2. **Respuesta base del Bloque H**: Si ya existe un borrador, usarlo como punto de partida y refinarlo en función de los requisitos visibles en pantalla.
3. **Tono asertivo y directo**: Mostrar confianza y alineación de objetivos, evitando sonar suplicante o corporativo genérico.
4. **Especificidad**: Hacer referencia a un elemento técnico o desafío concreto que se mencione específicamente en la JD del formulario.
5. **Idioma de salida adaptativo (REGLA CRÍTICA R3)**:
   - Las respuestas a las preguntas del formulario y los textos dirigidos a la empresa (como cartas de presentación y correos) **deben redactarse estrictamente en el idioma original de la oferta de empleo (JD)**.
   - Si la oferta de empleo está en inglés, genera las respuestas en un inglés técnico profesional impecable.
   - Si la oferta de empleo está en español, genera las respuestas en español técnico natural de alta calidad.

### Campos y preguntas comunes en España y LatAm:

- **Pretensión salarial (SBA)**: Proporcionar la banda salarial configurada en `profile.yml` indicando que es verutable en función del paquete global ("SBA, flexible según el paquete global de compensación").
- **Fecha de incorporación / Disponibilidad**: Calcular la fecha real considerando el período de preaviso obligatorio (normalmente 15 días laborables en España) desde el momento actual.
- **Autorización de trabajo / Visa**: Responder con claridad y brevedad. Para ciudadanos de la UE en puestos de España, indicar explícitamente: "Ciudadano de la Unión Europea, con plena autorización de trabajo y número de N.I.E. activo, sin requerimiento de patrocinio de visado".
- **Nivel de idiomas**: Declarar los idiomas dominantes (español nativo/bilingüe, inglés profesional) utilizando el marco común europeo de referencia para las lenguas (CEFR: B2, C1, C2) si es pertinente.

**Formato de salida del Asistente:**

```text
## Respuestas de Postulación para [Empresa] — [Puesto]

Basado en: Reporte #NNN | Puntuación: X.X/5 | Arquetipo: [tipo]
Idioma de redacción: [Inglés / Español] (por Regla R3)

---

### 1. [Pregunta exacta detectada en el formulario]
> [Respuesta personalizada e impecable lista para copiar y pegar]

### 2. [Siguiente pregunta detectada]
> [Respuesta redactada en el idioma de la oferta]

...

---

Notas adicionales:
- [Observaciones del puesto, cambios en el formulario o alertas técnicas]
- [Recomendaciones para que el candidato revise o modifique ciertos datos antes de enviar]
```

---

## Paso 6 — Post-postulación (Post-apply)

Cuando el candidato confirme que ha completado y enviado formalmente la solicitud de empleo:
1. Actualizar de inmediato el estado en `applications.md` de "Evaluada" a "Aplicada" (o `Applied`).
2. Actualizar el Bloque H del reporte de evaluación con las respuestas definitivas enviadas para mantener el historial.
3. Sugerir el siguiente paso táctico: ejecutar `/career-ops contacto` para redactar una propuesta de contacto personalizado en LinkedIn dirigida al Director de Selección o Hiring Manager del puesto.
