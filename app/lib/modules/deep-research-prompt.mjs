import { bullets, text } from './_shared.mjs';

export function buildDeepResearchPrompt(input = {}) {
  const company = text(input.company, 'Empresa');
  const role = text(input.role, 'Rol');
  const candidateContext = text(input.candidateContext || input.profile || input.cv, 'Usa el perfil de candidato incluido en este prompt.');
  const extraQuestions = bullets(input.extraQuestions, '- Ninguna');
  return `## Investigación profunda: ${company} - ${role}

Contexto: estoy evaluando una candidatura para ${role} en ${company}. Necesito información accionable para entrevistas y estrategia de candidatura.

Contexto del candidato:
${candidateContext}

### 1. Estrategia de IA
- ¿Qué productos o funciones usan IA/ML?
- ¿Cuál es su stack de IA: modelos, infraestructura, evals, observabilidad, plataforma de datos y tooling?
- ¿Tienen blog técnico, papers, charlas o trabajo open source?
- ¿Qué iniciativas de IA parecen más relevantes para este rol?

### 2. Movimientos recientes
- Fichajes relevantes en IA, ML, datos, producto o liderazgo técnico en los últimos 6-12 meses.
- Adquisiciones, partnerships, lanzamientos, pivotes, rondas, despidos o cambios de liderazgo.
- Señales que expliquen por qué este rol existe ahora.

### 3. Cultura técnica
- Cómo lanzan: cadencia de despliegue, ownership, CI/CD, listón de calidad y gestión de incidentes.
- Monorepo o multirepo, lenguajes, frameworks, cloud, datos e infraestructura de IA.
- Expectativas remoto/oficina, rituales de equipo, estilo de decisión y señales de empleados.

### 4. Retos probables
- Escalado, fiabilidad, coste, latencia, calidad de datos, gobernanza, migración o adopción.
- Pain points en reviews, ofertas, incidentes, blogs o feedback de clientes.
- Qué tendría que resolver probablemente en los primeros 90 días.

### 5. Competidores y diferenciación
- Competidores y sustitutos principales.
- Moat, posicionamiento, pricing, segmentos de cliente y diferenciales de producto.
- Dónde ${company} parece fuerte o vulnerable.

### 6. Ángulo del candidato
- Qué valor único podría aportar este candidato a ${company} en ${role}.
- Qué proof points del contexto del candidato son más relevantes.
- Qué historia debería contar en entrevistas.
- Qué riesgos o gaps debería preparar.

Preguntas extra:
${extraQuestions}

Devuelve hallazgos estructurados con fuentes para cada afirmación externa. Marca lo incierto como incierto en vez de adivinar.`;
}

export default buildDeepResearchPrompt;
