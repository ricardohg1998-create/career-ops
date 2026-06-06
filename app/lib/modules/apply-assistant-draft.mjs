import { bullets, list, table, text } from './_shared.mjs';

function questionText(question, index) {
  if (typeof question === 'string') return question;
  return text(question?.question || question?.label || question?.name, `Pregunta ${index + 1}`);
}

function answerFor(question, context) {
  if (typeof question === 'object' && question?.answer) return text(question.answer);
  const q = questionText(question, 0).toLowerCase();
  const proof = context.proofPoints[0] || context.reportSummary || context.candidateSummary;
  if (/salary|compensation|expect/i.test(q)) {
    return context.compensation || 'Prefiero calibrarlo contra el alcance del rol y vuestra banda para este nivel antes de dar una cifra final.';
  }
  if (/visa|work authorization|authori[sz]ation/i.test(q)) {
    return context.workAuthorization || 'Puedo confirmar los detalles relevantes de autorización de trabajo durante la llamada con recruiter.';
  }
  if (/why.*(company|role)|motivation|interest/i.test(q)) {
    return [
      `Me interesa ${context.companyRole} porque el rol conecta directamente con el tipo de trabajo que quiero liderar ahora.`,
      context.jobSignal ? `La señal más fuerte para mí es ${context.jobSignal}.` : '',
      proof ? `Aportaría experiencia relevante de ${proof}.` : '',
    ].filter(Boolean).join(' ');
  }
  if (/cover letter/i.test(q)) {
    return [
      `Hi ${context.company} team,`,
      '',
      `Me postulo a ${context.role} porque el rol encaja con el trabajo donde puedo crear más leverage: ${context.jobSignal || 'construir sistemas prácticos que convierten necesidades ambiguas en resultados lanzados'}.`,
      '',
      proof ? `Un proof point relevante: ${proof}.` : `Mi background me da una base sólida para el alcance descrito en la oferta.`,
      '',
      `Me encantará conversar sobre cómo puedo ayudar a ${context.company} a avanzar más rápido con un enfoque pragmático y orientado a producción.`,
    ].join('\n');
  }
  return [
    proof ? `Un ejemplo relevante de mi background es ${proof}.` : `Mi background encaja bien con este requisito.`,
    context.jobSignal ? `Conecta con este rol porque ${context.jobSignal}.` : '',
    'Mantendría la respuesta aterrizada a necesidades concretas del equipo, no como una respuesta genérica de candidatura.',
  ].filter(Boolean).join(' ');
}

function applyPersonalVoice(answer, question, context) {
  if (!context.writingStyle) return answer;
  const q = questionText(question, 0).toLowerCase();
  if (/salary|compensation|expect/i.test(q) || /visa|work authorization|authori[sz]ation/i.test(q)) {
    return answer;
  }
  const clean = answer.replace(/\s+/g, ' ').trim();
  const firstPerson = clean
    .replace(/^A relevant example from my background is/i, 'Un ejemplo muy claro en mi caso es')
    .replace(/^My background is a good match for this requirement\./i, 'Creo que encajo especialmente bien aqui por una razon sencilla.')
    .replace(/I would keep the answer grounded in the specific team needs rather than giving a generic application response\./i, 'Intentaria aterrizarlo siempre a necesidades reales del equipo, no a una respuesta generica de candidatura.');
  if (/why.*(company|role)|motivation|interest/i.test(q)) {
    return [
      `Lo primero: ${context.company} me interesa porque el rol conecta muy bien con el tipo de trabajo donde mas valor puedo aportar.`,
      context.jobSignal ? `La parte que mas me llama es esta: ${context.jobSignal}.` : '',
      context.proofPoints[0] ? `Y no lo digo en abstracto: ya he construido cosas muy parecidas con ${context.proofPoints[0]}.` : '',
      !context.proofPoints[0] && !context.jobSignal ? 'Mi punto fuerte esta justo ahi: unir negocio, marketing y parte tecnica para convertir ideas en sistemas que funcionan de verdad.' : '',
    ].filter(Boolean).join('\n\n');
  }
  return firstPerson;
}

export function draftApplicationResponses(input = {}) {
  const company = text(input.company, 'Empresa');
  const role = text(input.role, 'Rol');
  const questions = list(input.questions);
  const context = {
    company,
    role,
    companyRole: `${role} en ${company}`,
    candidateSummary: text(input.candidateSummary || input.cv),
    reportSummary: text(input.reportSummary || input.report),
    jobSignal: text(input.jobSignal || input.roleSignal || input.jdSignal),
    compensation: text(input.compensation || input.salaryExpectation),
    workAuthorization: text(input.workAuthorization || input.authorization),
    proofPoints: list(input.proofPoints),
    writingStyle: text(input.writingStyle),
  };
  const responses = questions.map((question, index) => ({
    question: questionText(question, index),
    answer: applyPersonalVoice(answerFor(question, context), question, context),
  }));
  const markdown = [
    `## Respuestas para ${company} - ${role}`,
    '',
    context.writingStyle ? 'Estilo personal aplicado desde `modes/_profile.md` / muestras de escritura. Mantén respuestas conversacionales, concretas, en primera persona y poco corporativas.' : '',
    '',
    input.basedOn ? `Basado en: ${text(input.basedOn)}` : '',
    '',
    ...responses.flatMap((item, index) => [
      `### ${index + 1}. ${item.question}`,
      `> ${item.answer.replace(/\n/g, '\n> ')}`,
      '',
    ]),
    '---',
    '',
    'Notas:',
    bullets(input.notes || ['Revisa cada respuesta antes de pegarla en el formulario.', 'No envíes nada hasta dar aprobación final.']),
  ].filter(line => line !== '').join('\n');
  return {
    company,
    role,
    responses,
    markdown,
    summary: table(['Pregunta', 'Borrador listo'], responses.map(item => [item.question, 'Sí'])),
  };
}

export default draftApplicationResponses;
