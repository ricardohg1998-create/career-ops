## 2026-05-27T17:17:44Z

You are the Worker subagent for Career-Ops Spanish language modes implementation.
Your task is to create fully localized Spanish templates under `modes/es/`, configure `config/profile.yml` to use them, and verify that the system integrity is maintained.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Scope of Work:

1. **Create Spanish Language Modes under `modes/es/`**:
   Populate the following five files inside `modes/es/`:
   
   - **`modes/es/README.md`**:
     Short instructions in Spanish outlining how to use and customize the Spanish modes. Explain the permanent configuration (`language.modes_dir: "modes/es"`) in `config/profile.yml` and outline the reference tech vocabulary (e.g. Vacante/Oferta, Carta de presentación, SBA (Salario Bruto Anual), Autónomo vs. Indefinido, etc.).
   
   - **`modes/es/_shared.md`** (translated from `modes/_shared.md`):
     - Localized instructions, candidate target archetypes (Platform/LLMOps, Agentic, PM, SA, FDE, Transformation), global rules (NEVER/ALWAYS blocks), writing style calibration keys, and ATS optimization guidelines.
     - Integrate Spanish & LatAm specific employment/compensation mechanics: "SBA (Salario Bruto Anual)", "14 pagas", "Contrato indefinido", "Autónomo (Freelance)" (with custom prompts instructing the agent to calculate an autonomo/PJ equivalent rate adding a 40-50% premium over equivalent hourly employee rates to cover social security quotas, VAT/IVA, IRPF, and lack of paid leave/vacations), "Convenio colectivo", "Seguridad Social (coste de empresa)", "Retribución flexible", "Tickets restaurante", "Preaviso", and "Período de prueba".
     - Include localized negotiation scripts (pretensión salarial, autónomo vs indefinido equivalent, pushback against geographical discount).
     - **CRITICAL R3 Rule (Output Language Adaptability)**: You must include a section in the prompts that strictly enforces:
       1. **Internal Evaluation Reports (`reports/`)**: Generated entirely in technical Spanish to help the candidate assess the fit.
       2. **Candidate-Facing outreach and materials** (cover letters, LinkedIn outreach, draft answers for application forms): Adapt dynamically to the language of the Job Description (e.g. if the JD is in English, write in high-quality professional tech English; if the JD is in Spanish, write in professional Spanish).
     - Standard tracker status aliases MUST be configured/referred to: `Evaluada`, `Aplicada`, `Entrevista`, `Oferta`, `Rechazada`, `Descartada`, `SKIP` (which map correctly to canonical statuses in `verify-pipeline.mjs`).
   
   - **`modes/es/oferta.md`** (translated from `modes/oferta.md`):
     - Spanish evaluation report layout directing the A-G blocks analysis and Block H draft answers in fluent technical Spanish.
     - **CRITICAL**: The report output format header MUST preserve the EXACT English keys: `**Date:**`, `**URL:**`, `**Archetype:**`, `**Score:**`, `**Legitimacy:**`, `**PDF:**` in that exact order to avoid breaking automated parser/verification tools like `verify-pipeline.mjs`.
     - Direct the creation of reports under `reports/{###}-{company-slug}-{YYYY-MM-DD}.md`.
     - Direct tracking entry writing to `batch/tracker-additions/` as a single-line 9-column TSV matching the data contract.
   
   - **`modes/es/postular.md`** (translated from `modes/apply.md`):
     - Spanish live form filler assistant instructions (Detect, Identify, Search, Load, Compare, Analyze, Generate, Present, Post-apply).
     - Question analysis and answers draft generation adapting to the JD's original language per R3.
   
   - **`modes/es/pipeline.md`** (translated from `modes/pipeline.md`):
     - Spanish URL inbox intake prompts and processing loops. Maintain complete syntax compatibility with automated scripts.
   
2. **Configure `config/profile.yml`**:
   Add or update the `language.modes_dir` setting to point to `modes/es`:
   ```yaml
   language:
     modes_dir: "modes/es"
   ```

3. **Verify Integrity**:
   - Run system tests using `node test-all.mjs --quick` to make sure all syntax checks, data contracts, and verification scripts pass without errors.
   - Run any other necessary validation or run script to verify formatting compatibility.

Your working directory is C:\Users\34634\Documents\antigravity\friendly-bell\.agents\worker_1.
Initialize your progress.md and BRIEFING.md in your working directory and update them frequently.
Upon completion, write a detailed handoff report in your folder and send a message back to me (main agent, ID: 4f69287c-bd8f-45a2-bdbf-c165e1eac732).
