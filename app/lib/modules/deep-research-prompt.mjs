import { bullets, text } from './_shared.mjs';

export function buildDeepResearchPrompt(input = {}) {
  const company = text(input.company, 'Company');
  const role = text(input.role, 'Role');
  const candidateContext = text(input.candidateContext || input.profile || input.cv, 'Use the candidate profile supplied with this prompt.');
  const extraQuestions = bullets(input.extraQuestions, '- None');
  return `## Deep Research: ${company} - ${role}

Context: I am evaluating a candidacy for ${role} at ${company}. I need actionable information for interviews and application strategy.

Candidate context:
${candidateContext}

### 1. AI Strategy
- What products or features use AI/ML?
- What is their AI stack: models, infrastructure, evals, observability, data platform, and tooling?
- Do they have an engineering blog, papers, talks, or open-source work?
- Which AI initiatives look most relevant to this role?

### 2. Recent Moves
- Relevant hires in AI, ML, data, product, or engineering leadership in the last 6-12 months.
- Acquisitions, partnerships, launches, pivots, funding rounds, layoffs, or leadership changes.
- Signals that explain why this role exists now.

### 3. Engineering Culture
- How do they ship: deployment cadence, ownership model, CI/CD, quality bar, incident practices?
- Monorepo or multirepo, languages, frameworks, cloud, data, and AI infrastructure.
- Remote or office expectations, team rituals, decision style, and review signals from employees.

### 4. Likely Challenges
- Scaling, reliability, cost, latency, data quality, governance, migration, or adoption problems.
- Pain points mentioned in reviews, job posts, incident reports, blogs, or customer feedback.
- What the first 90 days would probably need to solve.

### 5. Competitors and Differentiation
- Main competitors and substitutes.
- Moat, positioning, pricing, customer segments, and product differentiators.
- Where ${company} appears strong or vulnerable.

### 6. Candidate Angle
- What unique value could this candidate bring to ${company} in ${role}?
- Which proof points from the candidate context are most relevant?
- What story should the candidate tell in interviews?
- What risks or gaps should the candidate prepare to address?

Extra questions:
${extraQuestions}

Return structured findings with sources for every external claim. Mark uncertain claims as uncertain instead of guessing.`;
}

export default buildDeepResearchPrompt;
