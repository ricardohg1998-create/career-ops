## 2026-05-27T19:22:00Z

You are the Worker subagent for Career-Ops Spanish language modes mock evaluation and gemini-eval.mjs integration.
Your task is to modify `gemini-eval.mjs` to dynamically support the `language.modes_dir` setting from `config/profile.yml`, run a mock evaluation on a Spanish Job Description, and verify system integrity.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Detailed Scope:
1. **Modify `gemini-eval.mjs`**:
   - Currently, `gemini-eval.mjs` has hardcoded paths for `modes/_shared.md` and `modes/oferta.md` under `PATHS.shared` and `PATHS.oferta`.
   - Update `gemini-eval.mjs` to load and parse `config/profile.yml` at start.
   - You can parse `config/profile.yml` either using `js-yaml` library (which is already in the project's dependencies and installed) or using a regular expression. Let's use `js-yaml` since it is already imported or available, or a simple robust regex matching.
   - Extract the `language.modes_dir` value (e.g., "modes/es").
   - If `language.modes_dir` is configured and the files exist in that directory, dynamically update `PATHS.shared` to point to `join(ROOT, modesDir, '_shared.md')` and `PATHS.oferta` to point to `join(ROOT, modesDir, 'oferta.md')`.
   - Also check if `_profile.md` is present in `modesDir` and if so update `PATHS.profile` to point to `join(ROOT, modesDir, '_profile.md')`, otherwise default to `join(ROOT, 'modes', '_profile.md')`.
   - Print a helpful log line when starting (e.g. `📂  Using localized templates from modes_dir: "modes/es"`) to prove it was loaded successfully.

2. **Run Mock Evaluation**:
   - Execute `node gemini-eval.mjs --file jds/syrsa.txt`.
   - This Spanish Job Description is in `jds/syrsa.txt` and is a perfect match for the candidate's Sevilla location and automation skills.
   - Verify that the output report is written to the `reports/` folder, e.g. `reports/{###}-syrsa-{date}.md`.
   - Verify that the report's content is in professional technical Spanish (Blocks A-G), but preserves the exact English header keys (`**Date:**`, `**URL:**`, `**Archetype:**`, `**Score:**`, `**Legitimacy:**`, `**PDF:**`) in the correct sequence as required by R4.

3. **Verify Integrity**:
   - Run `node test-all.mjs --quick` to make sure your changes to `gemini-eval.mjs` did not break any syntax or system-wide verification checks.
   - Run `node verify-pipeline.mjs` to ensure the new report link is valid and parses correctly.

Your working directory is C:\Users\34634\Documents\antigravity\friendly-bell\.agents\worker_2.
Initialize your progress.md and BRIEFING.md in your working directory and update them.
Upon completion, write a detailed handoff report in your folder and send a message back to me (main agent, ID: 4f69287c-bd8f-45a2-bdbf-c165e1eac732).
