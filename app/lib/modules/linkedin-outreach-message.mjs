import { text, truncate } from './_shared.mjs';

const TYPE_COPY = {
  recruiter: input => [
    `Hola ${input.name}, he visto que ${input.company} está contratando para ${input.role}.`,
    input.proof || 'Mi experiencia encaja bastante con los requisitos del rol.',
    'Encantado de compartir mi CV si tiene sentido.',
  ],
  'hiring-manager': input => [
    `Hola ${input.name}, he visto que tu equipo está trabajando en ${input.challenge || input.role}.`,
    input.proof || 'He resuelto problemas parecidos en contextos de producción.',
    `Me encantaría saber cómo lo está abordando ${input.company}.`,
  ],
  peer: input => [
    `Hola ${input.name}, vi tu trabajo sobre ${input.topic || input.challenge || input.role}.`,
    input.proof || 'He estado trabajando en problemas cercanos.',
    `Me encantaría conocer tu visión sobre ${input.topic || 'ese espacio'}.`,
  ],
  interviewer: input => [
    `Hola ${input.name}, leí sobre tu trabajo en ${input.topic || input.challenge || input.role}.`,
    input.proof || 'Conecta con trabajo que he hecho recientemente.',
    input.date ? `Con ganas de hablar el ${input.date}.` : 'Con ganas de nuestra conversación.',
  ],
};

function normalizeType(value) {
  const clean = text(value, 'recruiter').toLowerCase();
  if (clean.includes('manager')) return 'hiring-manager';
  if (clean.includes('peer')) return 'peer';
  if (clean.includes('interview')) return 'interviewer';
  return 'recruiter';
}

export function createLinkedInOutreachMessage(input = {}) {
  const type = normalizeType(input.contactType || input.type);
  const data = {
    name: text(input.contactName || input.name, 'ahí'),
    company: text(input.company, 'la empresa'),
    role: text(input.role, 'el rol'),
    challenge: text(input.challenge),
    proof: text(input.proof || input.proofPoint),
    topic: text(input.topic),
    date: text(input.date),
  };
  const draft = TYPE_COPY[type](data).filter(Boolean).join(' ');
  const message = truncate(draft, Number(input.maxLength) || 300);
  return {
    type,
    message,
    characterCount: message.length,
    withinLimit: message.length <= (Number(input.maxLength) || 300),
  };
}

export default createLinkedInOutreachMessage;
