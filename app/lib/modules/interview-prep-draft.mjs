import { bullets, table, text } from './_shared.mjs';

export function buildInterviewPrepDraft(input = {}) {
  const company = text(input.company, 'Empresa');
  const role = text(input.role, 'Rol');
  const rounds = Array.isArray(input.rounds) ? input.rounds : [];
  const stories = Array.isArray(input.stories) ? input.stories : [];
  const roundRows = rounds.length
    ? rounds.map((round, index) => [
      text(round.name || round.type, `Ronda ${index + 1}`),
      text(round.audience, 'desconocido'),
      text(round.duration, 'desconocido'),
      text(round.focus || round.evaluates, 'desconocido'),
    ])
    : [['Desconocida', 'panel mixto [inferido]', 'desconocido', 'Confirmar con recruiter']];
  const storyRows = stories.length
    ? stories.map(story => [
      text(story.audience, 'cualquiera'),
      text(story.question || story.topic, 'Pregunta probable'),
      text(story.title || story.story, 'Historia a preparar'),
      text(story.fit, 'parcial'),
    ])
    : [['screen recruiter', 'Cuéntame tu CV', 'Preparar narrativa de 60-90 segundos', 'gap']];

  return `# Preparación de entrevista: ${company} - ${role}

## Resumen del proceso
- **Rondas:** ${text(input.roundCount, rounds.length ? String(rounds.length) : 'desconocido - faltan datos')}
- **Formato:** ${text(input.process, 'desconocido - confirmar con recruiter')}
- **Dificultad:** ${text(input.difficulty, 'desconocida - faltan datos')}
- **Particularidades conocidas:** ${text(input.quirks, 'desconocidas - faltan datos')}
- **Fuentes:** ${text(input.sources, 'Añade fuentes de research antes de usarlo como preparación final')}

## Mapa de audiencia
${table(['Ronda', 'Audiencia', 'Duración', 'Evaluación principal'], roundRows)}

## Pack para recruiter screen
- **Narrativa:** ${text(input.narrative, 'Conecta la historia del candidato con este rol en 60-90 segundos.')}
- **Compensación:** ${text(input.compensation, 'Pregunta por la banda del rol si los datos de mercado o leverage no están claros.')}
- **Ubicación / visa / timing:** ${text(input.logistics, 'Confirma restricciones de forma limpia y pronto.')}
- **Por qué esta empresa:** ${text(input.companyMotivation, 'Usa una señal pública del research, no halagos genéricos.')}

## Pack para hiring manager
- **Por qué este rol, por qué ahora:** ${text(input.hmAngle, 'Conecta el background del candidato con un reto concreto del equipo.')}
- **Primeros 90 días:** ${text(input.first90, 'Descubrir restricciones del sistema, lanzar una mejora pequeña útil y escalar lo que funcione.')}
- **Preguntas a hacer:**
${bullets(input.hmQuestions || ['¿Qué problema haría que esta contratación fuera un éxito claro tras 90 días?', '¿Dónde está el equipo invirtiendo menos de lo necesario?'])}

## Pack técnico / peers
- **Temas técnicos probables:**
${bullets(input.technicalThemes || ['Diseño de sistemas y trade-offs ligados a la JD', 'Calidad en producción, testing, observabilidad y operaciones'])}
- **Preguntas inversas:**
${bullets(input.peerQuestions || ['¿Cómo revisa el equipo las decisiones de diseño?', '¿Cómo es el ownership de producción u on-call?'])}

## Mapeo de story bank
${table(['Audiencia', 'Tema probable', 'Mejor historia', 'Encaje'], storyRows)}

## Checklist de preparación
${bullets(input.checklist || ['Confirmar el loop de entrevistas con recruiter', 'Preparar un proof point por requisito core', 'Escribir límites de compensación y logística', 'Preparar 3 preguntas buenas por audiencia'])}

## Riesgos a abordar
${bullets(input.risks || ['Aún no hay riesgos principales capturados. Añade gaps del informe de evaluación antes de la entrevista.'])}`;
}

export default buildInterviewPrepDraft;
