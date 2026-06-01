# career-ops — Modos en Español (`modes/es/`)

Este directorio contiene la localización completa de los modos principales de career-ops para candidatos que buscan empleo en España y Latinoamérica, o que interactúan con ofertas de empleo redactadas en español.

## ¿Cuándo utilizar estos modos?

Debes utilizar `modes/es/` si se cumple alguna de las siguientes condiciones:
1. Te postulas principalmente a **ofertas de empleo en español** (InfoJobs, Tecnoempleo, LinkedIn en español, páginas de empleo locales).
2. Tu **CV principal (`cv.md`)** está en español, o adaptas tu CV y cartas de presentación al mercado hispanohablante.
3. Deseas que la IA genere respuestas a formularios, correos de seguimiento e interacciones en un **español técnico profesional y natural**, evitando traducciones literales o artificiales.
4. Necesitas gestionar **conceptos de contratación y compensación específicos de España y LatAm**: Salario Bruto Anual (SBA), 14 pagas, contrato indefinido vs. autónomo (freelance), convenio colectivo, retribución flexible (tickets restaurante, seguro médico), período de prueba y preaviso.

## Cómo activarlo

Puedes activar e indicar a career-ops que utilice la localización en español de dos formas:

### Método 1: Configuración permanente en el Perfil (Recomendado)

Añade o actualiza la sección `language` en tu archivo de configuración `config/profile.yml`:

```yaml
language:
  modes_dir: "modes/es"
```

Al especificar esto, la IA cargará de forma automática y por defecto los archivos de instrucciones en español ubicados bajo `modes/es/`.

### Método 2: Por sesión de chat

Puedes indicarle explícitamente a la IA al inicio de la conversación:
> "Utiliza los modos en español bajo `modes/es/` para esta sesión."

## Archivos localizados

La localización en español incluye los siguientes cinco archivos críticos:

| Archivo | Archivo Origen (EN) | Propósito y Contenido |
|---------|---------------------|-----------------------|
| `_shared.md` | `modes/_shared.md` | Contexto global del sistema, arquetipos adaptados, reglas de negocio, calibración de estilo, pautas de optimización ATS, mecánicas de compensación (SBA, 14 pagas, autónomo vs. indefinido) y scripts de negociación. |
| `oferta.md` | `modes/oferta.md` | Instrucciones detalladas de evaluación de ofertas de empleo (Bloques A-G) y generación de respuestas borrador (Bloque H). Preserva estrictamente las claves del encabezado en inglés para asegurar compatibilidad de herramientas automatizadas. |
| `postular.md` | `modes/apply.md` | Asistente en vivo para rellenar formularios de postulación, adaptando el idioma de salida según el idioma de la oferta de empleo (Regla R3). |
| `pipeline.md` | `modes/pipeline.md` | Flujo de procesamiento de la bandeja de entrada de URLs (`data/pipeline.md`) con extracción de JDs y sincronización. |
| `README.md` | N/A | Este documento explicativo de referencia y glosario de términos. |

## Glosario y Vocabulario Técnico de Referencia

Para mantener la consistencia en todas las plantillas y en el contenido generado por la IA, se establece el siguiente vocabulario estándar de referencia:

| Inglés | Español (Estándar en esta Codebase) | Definición / Contexto |
|--------|------------------------------------|-----------------------|
| Job posting / Offer | Oferta de empleo / Vacante | El anuncio del puesto de trabajo a evaluar. |
| Cover letter | Carta de presentación | Documento que acompaña al CV adaptado a la vacante. |
| Resume / CV | Currículum / CV | El historial profesional del candidato (`cv.md`). |
| Compensation | Compensación / Retribución | Total de beneficios y salario percibido. |
| Target comp | Pretensión salarial | Rango de salario objetivo definido por el candidato. |
| Base salary | Salario base (SBA) | Salario Bruto Anual excluyendo variables. |
| 13th/14th month pay | 14 pagas | Distribución del salario anual en 14 cuotas (típico en España). |
| Permanent contract | Contrato indefinido | Relación laboral estable y directa con la empresa. |
| Freelancer / Contractor | Autónomo / Freelance | Trabajador por cuenta propia. Requiere prima del 40-50% sobre tasa asalariada. |
| Collective agreement | Convenio colectivo | Marco regulador de las condiciones de trabajo por sector. |
| Flexible retribution | Retribución flexible | Beneficios exentos de IRPF (tickets restaurante, guardería, transporte). |
| Notice period | Preaviso | Plazo de notificación previo a la baja voluntaria o despido (ej. 15 días). |
| Probation period | Período de prueba | Intervalo inicial donde se puede rescindir la relación sin preaviso. |
| ATS (Applicant Tracking) | ATS / Gestor de candidaturas | Software de filtrado automático de currículums. |

## Contribuciones y Modificaciones

Si deseas expandir o mejorar las traducciones y reglas en español:
1. Asegúrate de respetar la **Regla R3 (Adaptabilidad de Idioma)**: las evaluaciones internas y reportes se generan en español técnico, pero los materiales de cara a la empresa (cartas de presentación, correos, respuestas a formularios) se adaptan dinámicamente al idioma de la oferta original (inglés o español).
2. Conserva estrictamente las **claves en inglés** de los encabezados de los reportes (`**Date:**`, `**URL:**`, `**Archetype:**`, `**Score:**`, `**Legitimacy:**`, `**PDF:**`) para evitar romper scripts de validación (`verify-pipeline.mjs`, `merge-tracker.mjs`).
