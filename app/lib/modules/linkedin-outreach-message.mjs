import { text, truncate } from './_shared.mjs';

const TYPE_COPY = {
  recruiter: input => [
    `Hi ${input.name}, I saw ${input.company} is hiring for ${input.role}.`,
    input.proof || 'My background maps closely to the role requirements.',
    'Happy to share my CV if this aligns.',
  ],
  'hiring-manager': input => [
    `Hi ${input.name}, I noticed your team is working on ${input.challenge || input.role}.`,
    input.proof || 'I have solved similar problems in production settings.',
    `Would love to hear how ${input.company} is approaching this.`,
  ],
  peer: input => [
    `Hi ${input.name}, I saw your work on ${input.topic || input.challenge || input.role}.`,
    input.proof || 'I have been working on adjacent problems.',
    `Would love your take on ${input.topic || 'the space'}.`,
  ],
  interviewer: input => [
    `Hi ${input.name}, I read about your work on ${input.topic || input.challenge || input.role}.`,
    input.proof || 'It connects with work I have done recently.',
    input.date ? `Looking forward to our conversation on ${input.date}.` : 'Looking forward to our conversation.',
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
    name: text(input.contactName || input.name, 'there'),
    company: text(input.company, 'the company'),
    role: text(input.role, 'the role'),
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
