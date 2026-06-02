import { bullets, table, text } from './_shared.mjs';

export function buildInterviewPrepDraft(input = {}) {
  const company = text(input.company, 'Company');
  const role = text(input.role, 'Role');
  const rounds = Array.isArray(input.rounds) ? input.rounds : [];
  const stories = Array.isArray(input.stories) ? input.stories : [];
  const roundRows = rounds.length
    ? rounds.map((round, index) => [
      text(round.name || round.type, `Round ${index + 1}`),
      text(round.audience, 'unknown'),
      text(round.duration, 'unknown'),
      text(round.focus || round.evaluates, 'unknown'),
    ])
    : [['Unknown', 'panel-mixed [inferred]', 'unknown', 'Confirm with recruiter']];
  const storyRows = stories.length
    ? stories.map(story => [
      text(story.audience, 'any'),
      text(story.question || story.topic, 'Likely prompt'),
      text(story.title || story.story, 'Story to prepare'),
      text(story.fit, 'partial'),
    ])
    : [['recruiter-screen', 'Walk me through your CV', 'Prepare a 60-90s narrative', 'gap']];

  return `# Interview Prep: ${company} - ${role}

## Process Overview
- **Rounds:** ${text(input.roundCount, rounds.length ? String(rounds.length) : 'unknown - not enough data')}
- **Format:** ${text(input.process, 'unknown - confirm with recruiter')}
- **Difficulty:** ${text(input.difficulty, 'unknown - not enough data')}
- **Known quirks:** ${text(input.quirks, 'unknown - not enough data')}
- **Sources:** ${text(input.sources, 'Add research sources before using as final prep')}

## Audience Map
${table(['Round', 'Audience', 'Duration', 'Primary evaluation'], roundRows)}

## Recruiter Screen Pack
- **Narrative:** ${text(input.narrative, 'Connect the candidate story to this role in 60-90 seconds.')}
- **Comp:** ${text(input.compensation, 'Ask for the role band if market data or leverage is unclear.')}
- **Location / visa / timing:** ${text(input.logistics, 'Confirm constraints cleanly and early.')}
- **Why this company:** ${text(input.companyMotivation, 'Use one public signal from research, not generic praise.')}

## Hiring Manager Pack
- **Why this role, why now:** ${text(input.hmAngle, 'Tie the candidate background to a named team challenge.')}
- **First 90 days:** ${text(input.first90, 'Discover system constraints, ship a small useful win, then scale what works.')}
- **Questions to ask:** 
${bullets(input.hmQuestions || ['What problem would make this hire a clear success after 90 days?', 'Where is the team currently underinvested?'])}

## Peer / Technical Pack
- **Likely technical themes:**
${bullets(input.technicalThemes || ['System design and trade-offs tied to the JD', 'Production quality, testing, observability, and operations'])}
- **Reverse questions:**
${bullets(input.peerQuestions || ['How does the team review design decisions?', 'What does on-call or production ownership look like?'])}

## Story Bank Mapping
${table(['Audience', 'Likely topic', 'Best story', 'Fit'], storyRows)}

## Prep Checklist
${bullets(input.checklist || ['Confirm interview loop with recruiter', 'Prepare one proof point per core requirement', 'Write down comp and logistics boundaries', 'Prepare 3 sharp questions for each audience'])}

## Risks To Address
${bullets(input.risks || ['No major risks captured yet. Add gaps from the evaluation report before the interview.'])}`;
}

export default buildInterviewPrepDraft;
