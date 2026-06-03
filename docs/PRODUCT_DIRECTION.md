# Product Direction: Visual Decision Center

Career-Ops should become a visual decision center for a job search, not a prettier wrapper around scripts.

The product goal is to help a candidate choose where to spend attention, prepare high-quality applications, and learn from every signal in the pipeline.

## North Star

The user can answer this in under five minutes:

> What is the best next action for my job search right now?

That action may be evaluating a new role, discarding a weak one, tailoring a CV, preparing for an interview, sending a follow-up, or updating the profile so future decisions improve.

## Product Promise

Career-Ops turns scattered job search inputs into ranked, explainable, human-approved actions.

It should optimize for fewer, better applications. The interface must never encourage bulk application behavior, and every flow should preserve the existing rule: the user reviews and decides before anything is sent.

## Primary User Loop

1. Capture an opportunity from a URL, JD text, scan result, or manual note.
2. Verify whether it is live and legitimate.
3. Score fit against the user's CV, profile, constraints, proof points, and target roles.
4. Recommend a decision: apply, review, wait, follow up, discard, or improve profile context.
5. Generate the needed artifact: report, tailored CV, cover letter, outreach, interview prep, or follow-up draft.
6. Track the outcome.
7. Learn from feedback, rejections, preferences, and missed context.

## Current Implementation Status

Implemented in the local web app:

- Home answers the North Star with ranked `/api/next-actions`.
- Tracking details include an Application Console for the selected application.
- Application Console can launch form reading, answer drafting, deep research, interview prep, and assisted application prep.
- Form Reader can start from the offer URL, discover likely apply links, inspect the final form read-only, and classify detected fields.
- Apply Assistant can also start from the offer URL when a separate form URL is not known.
- Draft answers use the candidate's personal writing style from `modes/_profile.md`.
- Safe Fill Plan separates low-risk profile prefill, narrative drafts for review, sensitive answers, manual choices, and uploads.
- Guided learning proposals capture corrections such as score-too-high, would-not-apply, missed experience, and voice mismatch before writing to user-layer files.
- Opportunities includes a visual discovery panel backed by scan history, with pending/evaluated/closed state, source confidence, and direct actions to evaluate or reimport discovered offers.
- Profile includes a scanner strategy editor for target keywords, blocked keywords, location filters, and enabled companies in `portals.yml`.

Still open:

- Automatic offer discovery now has a visual inbox layer and editable scanner strategy, but recurring scheduling still needs to be exposed in the interface.
- Guided browser filling needs a visible, user-supervised field-by-field flow.
- The UI should persist final application answers and user-confirmed outcomes after submission.
- The profile view should expose recent learning and writing-style calibration more clearly.

## Offer Management And Assisted Applying

The visual interface should let the user manage offers end to end:

- Add, scan, import, deduplicate, and verify offers.
- Evaluate and compare opportunities.
- Move applications through canonical states.
- Generate tailored application material.
- Launch assisted application flows when a form URL exists.
- Record the final outcome after the user confirms what happened.

Applying from the interface is possible, but it must be framed as assisted applying rather than autonomous submission.

### URL And Form Discovery

The user should not have to know the final application form URL in advance.

Career-Ops should support three levels of automation:

1. Offer discovery
   - Scanner and configured portals find new roles automatically.
   - New roles land in Opportunities with dedupe and source metadata.
   - The user can still paste a manual URL when needed.

2. Apply-link discovery
   - Given a job posting URL, Form Reader searches visible links and known ATS patterns such as Greenhouse, Lever, Ashby, Workable, Teamtailor, and company careers pages.
   - It follows likely apply links read-only and reports the discovered form URL.
   - It never clicks submit/send/apply.

3. Form understanding
   - Extract visible questions, required fields, options, upload requirements, and submit-like controls.
   - Classify each field into safe profile prefill, draft for review, sensitive review, manual choice, or manual upload.
   - Let the user move from Form Reader to Apply Assistant without copying the URL or field list by hand.

### Assisted Applying Modes

| Mode | What It Does | Safety Boundary |
| --- | --- | --- |
| Draft Only | Generates answers, cover letter text, and upload checklist from the selected role. | User copies, edits, and submits manually. |
| Form Reader | Opens or fetches the form URL, extracts visible questions and required fields, and drafts answers. | Read-only. It must not click submit/send/apply. |
| Guided Browser | Uses a visible browser session so the user can watch fields being filled. | The agent can fill fields only after approval and stops at the final submit step. |
| Subagent Prep | Launches a worker/subagent to gather context, draft answers, inspect form structure, and return a checklist. | No final submission. It returns control to the user for review. |

### Application Console Target State

For each evaluated opportunity, the interface should expose an application console:

1. Readiness
   - Posting verified as live.
   - Score and recommendation complete.
   - CV generated.
   - Cover letter or answers drafted.
   - Form URL known.
   - Human review pending.

2. Form Plan
   - Required fields.
   - Upload requirements.
   - Dropdowns and yes/no questions.
   - Missing data the user must provide.
   - Safe Fill Plan with explicit risk class per field.

3. Draft Answers
   - One answer per detected question.
   - Source proof point for each answer when available.
   - Warnings for salary, visa, relocation, or sensitive claims.

4. Guided Action
   - Open form.
   - Fill safe fields.
   - Pause for user review.
   - Let the user click submit.

5. Post-Apply
   - If the user confirms submission, update the tracker to `Applied`.
   - Save final answers or notes.
   - Suggest outreach or follow-up cadence.

## UX Principles

### Decisions Before Data

Metrics are useful only when they clarify action. The home view should lead with decisions:

- Best opportunities ready for review.
- Low-fit opportunities recommended for discard.
- Pending URLs that need evaluation.
- Follow-ups that are overdue or strategically useful.
- Setup or profile gaps that weaken future evaluations.

### Explainability Over Magic

Every recommendation should expose the reasons behind it:

- Score and score tier.
- Key fit drivers.
- Key risks or gaps.
- Legitimacy status.
- Salary or location concerns.
- Relevant proof points from `cv.md`, `article-digest.md`, and `config/profile.yml`.

### Human-In-The-Loop As A Feature

The interface should make the review step visible and calm. It can draft, generate, evaluate, and prepare, but it should not submit applications or messages.

### Personalization Compounds

The system should get better as the user corrects it. Feedback such as "this score is too high", "I would never apply here", or "you missed my experience in X" should turn into updates in user-layer files:

- `config/profile.yml`
- `modes/_profile.md`
- `article-digest.md`

Application answers should also follow the user's own writing style. The writing style lives in `modes/_profile.md` under `## Writing Style`; generated form answers should use it by default and expose a feedback path when the result does not sound like the candidate.

### Local Trust

The app is local-first. The interface should clearly show what files it reads and writes, what job is currently running, and whether generated artifacts are ready.

## Information Architecture

The current web app already has the right broad sections. Their product jobs should be:

| View | Product Job |
| --- | --- |
| Home | Decision inbox: the next best actions across the whole search. |
| Opportunities | Intake and triage for URLs, scan results, duplicates, and liveness checks. |
| Evaluation 360 | Deep assessment for one opportunity, with progress and generated artifacts. |
| Dossier | Application material generator: outreach, research, interview prep, project/training analysis. |
| Tracking | Source of truth for application states, notes, history, and follow-ups. |
| Profile | Candidate memory: targets, constraints, proof points, salary, location, preferences. |
| System | Health, integrity checks, updates, and local file status. |

Application management should be available from both Tracking and the selected opportunity detail. The user should not have to remember which script or mode handles applying.

## Home View Target State

The home view should feel like a recruiter briefing the candidate.

Recommended sections:

1. Next Best Actions
   - 3 to 7 ranked actions.
   - Each action has a reason, urgency, and one primary button.

2. Opportunity Quality
   - Top evaluated roles.
   - Roles below 4.0/5 flagged with "recommend discard".
   - Unverified or stale postings separated from active ones.

3. Pipeline Risk
   - Overdue follow-ups.
   - Applications stuck in one state.
   - Missing reports, PDFs, or broken links.

4. Candidate Memory
   - Profile gaps that reduce evaluation quality.
   - Recent feedback that can be saved as learning.

## Decision Model

Every opportunity should resolve to one of these product recommendations:

| Recommendation | Meaning |
| --- | --- |
| Apply | Strong fit, live posting, enough proof points, no major constraint conflict. |
| Review | Promising but needs human judgment, missing info, or notable trade-off. |
| Improve Context | The system cannot score well because candidate context is missing. |
| Wait | Useful but not urgent, or follow-up cadence says hold. |
| Follow Up | Existing application needs a message or status check. |
| Discard | Low score, closed posting, duplicate, hard constraint mismatch, or weak legitimacy. |
| Apply Assisted | Strong fit and ready to prepare or fill an application form, with human review required. |

## Roadmap

### Phase 1: Decision Inbox

- Make Home the main workflow entry point.
- Convert current priority list into ranked next actions.
- Show action reasons, urgency, and target view.
- Include low-fit discard recommendations, not only attractive opportunities.
- Surface profile/setup gaps that affect decision quality.

### Phase 2: Explainable Opportunity Detail

- Add a decision summary panel for selected opportunities and applications.
- Group evidence into fit, risk, legitimacy, compensation, and next artifact.
- Make "why this recommendation" visible before generating anything.

### Phase 3: Learning Capture

- Add a feedback flow after evaluation and after status changes. `[partly implemented]`
- Turn feedback into safe edits in user-layer files. `[partly implemented]`
- Keep a visible "candidate memory" area in Profile.

### Phase 4: Application Readiness

- Show readiness checklist per opportunity:
  - Live posting verified.
  - Score and decision complete.
  - Report generated.
  - CV generated.
  - Cover letter or answers drafted when relevant.
  - Human review pending.
- Add an application console for the selected opportunity. `[implemented for applications/reports]`
- Support form URL inspection and question extraction. `[implemented with offer-URL apply-link discovery]`
- Let the user launch Draft Only, Form Reader, Guided Browser, or Subagent Prep.
- Stop all assisted flows before final submit/send/apply.

### Phase 6: Automatic Discovery Layer

- Expand portal scanner coverage and make scan results visible as fresh inbox items. `[partly implemented]`
- Add source confidence, dedupe reason, and live/closed signal per imported role. `[partly implemented]`
- Add a scheduled scan path for recurring discovery.
- Let the user approve target keywords and company lists from the visual Profile/System area. `[implemented in Profile]`

### Phase 5: Strategy Insights

- Add pattern analysis to show:
  - Best-fit archetypes.
  - Weak recurring gaps.
  - Companies or role types to stop pursuing.
  - Follow-up and rejection patterns.

## Design Implications

- Prioritize dense, scannable operational layouts over marketing-style screens.
- Use calm visual hierarchy: scores, status, urgency, and action should be easy to compare.
- Avoid treating cards as decoration; use them for real repeated items or focused tools.
- Keep the safety promise visible: Career-Ops recommends and drafts, the user decides and sends.
- Favor action buttons that name the next concrete move: Evaluate, Discard, Generate CV, Prepare Interview, Draft Follow-up, Save Learning.

## Success Metrics

The interface is working if:

- The user spends less time deciding what to do next.
- Low-fit applications decrease.
- High-fit applications have better prepared materials.
- Fewer opportunities become stale or forgotten.
- User feedback improves future recommendations.
- Pipeline integrity checks stay green.

## Non-Goals

- Maximizing application volume.
- Auto-submitting applications.
- Replacing human judgment.
- Hiding the scoring logic.
- Turning the local app into a generic ATS clone.
