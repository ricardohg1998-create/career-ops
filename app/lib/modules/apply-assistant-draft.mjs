import { bullets, list, table, text } from './_shared.mjs';

function questionText(question, index) {
  if (typeof question === 'string') return question;
  return text(question?.question || question?.label || question?.name, `Question ${index + 1}`);
}

function answerFor(question, context) {
  if (typeof question === 'object' && question?.answer) return text(question.answer);
  const q = questionText(question, 0).toLowerCase();
  const proof = context.proofPoints[0] || context.reportSummary || context.candidateSummary;
  if (/salary|compensation|expect/i.test(q)) {
    return context.compensation || 'I would like to calibrate against the role scope and your band for this level before naming a final number.';
  }
  if (/visa|work authorization|authori[sz]ation/i.test(q)) {
    return context.workAuthorization || 'I can confirm the relevant work authorization details during the recruiter screen.';
  }
  if (/why.*(company|role)|motivation|interest/i.test(q)) {
    return [
      `I am interested in ${context.companyRole} because the role maps directly to the kind of work I want to own next.`,
      context.jobSignal ? `The strongest signal for me is ${context.jobSignal}.` : '',
      proof ? `I would bring relevant experience from ${proof}.` : '',
    ].filter(Boolean).join(' ');
  }
  if (/cover letter/i.test(q)) {
    return [
      `Hi ${context.company} team,`,
      '',
      `I am applying for ${context.role} because the role matches the work where I can create the most leverage: ${context.jobSignal || 'building practical systems that turn ambiguous needs into shipped outcomes'}.`,
      '',
      proof ? `A relevant proof point: ${proof}.` : `My background gives me a strong base for the scope described in the posting.`,
      '',
      `I would be glad to discuss how I can help ${context.company} move faster with a pragmatic, production-minded approach.`,
    ].join('\n');
  }
  return [
    proof ? `A relevant example from my background is ${proof}.` : `My background is a good match for this requirement.`,
    context.jobSignal ? `That connects to this role because ${context.jobSignal}.` : '',
    'I would keep the answer grounded in the specific team needs rather than giving a generic application response.',
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
  const company = text(input.company, 'Company');
  const role = text(input.role, 'Role');
  const questions = list(input.questions);
  const context = {
    company,
    role,
    companyRole: `${role} at ${company}`,
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
    `## Responses for ${company} - ${role}`,
    '',
    context.writingStyle ? 'Writing style applied: personal voice from `modes/_profile.md` / writing samples. Keep answers conversational, concrete, first-person, and non-corporate.' : '',
    '',
    input.basedOn ? `Based on: ${text(input.basedOn)}` : '',
    '',
    ...responses.flatMap((item, index) => [
      `### ${index + 1}. ${item.question}`,
      `> ${item.answer.replace(/\n/g, '\n> ')}`,
      '',
    ]),
    '---',
    '',
    'Notes:',
    bullets(input.notes || ['Review every answer before pasting it into the form.', 'Do not submit until the candidate gives final approval.']),
  ].filter(line => line !== '').join('\n');
  return {
    company,
    role,
    responses,
    markdown,
    summary: table(['Question', 'Draft ready'], responses.map(item => [item.question, 'Yes'])),
  };
}

export default draftApplicationResponses;
