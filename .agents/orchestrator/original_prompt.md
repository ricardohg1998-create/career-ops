## 2026-05-27T19:15:43+02:00
Spanish language support for Career-Ops pipeline. Translate evaluation, application, and pipeline templates to Spanish and configure the system profile to use them.

Working directory: C:\Users\34634\Documents\antigravity\friendly-bell
Integrity mode: development

## Requirements

### R1. Create Spanish Language Modes
Create a new directory `modes/es/` containing fully translated and Spanish-localized templates based on the default English ones in `modes/`. The translation must focus on the agent prompt layer (system prompts, scoring, and output structure) and include:
- `_shared.md` — Spanish system rules, scoring logic, and tool guidelines. Translate technical terms to native Spanish tech market equivalents (e.g. "contrato indefinido" for full-time, "autónomo" for contract/freelance, "bruto anual" for gross annual, "teletrabajo/remoto" for remote, etc.).
- `oferta.md` — Spanish evaluation report layout (Blocks A-G, including Legitimacy tier, scoring breakdown, etc.).
- `postular.md` (translated from `apply.md`) — Spanish application form instructions and cover letter draft prompts.
- `pipeline.md` — Spanish pipeline intake and processing prompts.
- `README.md` — Short instructions in Spanish outlining how to use and customize the Spanish modes.

### R2. Configure Profile to Use Spanish Modes
Configure the candidate's main profile in `config/profile.yml` by adding or updating the `language.modes_dir` setting to point to `modes/es`.
```yaml
language:
  modes_dir: "modes/es"
```

### R3. Output Language Adaptability
The newly created Spanish modes must enforce that:
- **Internal evaluation reports** (A-G blocks, scoring, analysis) are generated entirely in Spanish to help the candidate assess the fit.
- **Candidate-facing outreach and materials** (cover letters, LinkedIn messages, form answers) adapt dynamically to the language of the Job Description (e.g., if the JD is in English, these materials are written in English; if the JD is in Spanish, they are written in Spanish).

### R4. Integrity and Compatibility Check
Ensure all newly created files in `modes/es/` maintain the precise structures, metadata keys, and block layouts expected by the system (e.g., maintaining data contracts from `DATA_CONTRACT.md`), and ensure `node test-all.mjs` or other system verification scripts run without errors.

## Acceptance Criteria

### Translation & Localization Quality
- [ ] Directory `modes/es/` exists and contains translated `_shared.md`, `oferta.md`, `postular.md`, and `pipeline.md`.
- [ ] No placeholder or English text remains in the core prompts under `modes/es/` (except for tech stack names and system variables).
- [ ] Standard Spanish terms for contract types (indefinido, autónomo), compensation (bruto anual, variable, equidad), and benefits are used.

### Configuration & Functionality
- [ ] `config/profile.yml` includes the setting `language.modes_dir: modes/es`.
- [ ] Running a mock evaluation on a sample job description correctly utilizes the Spanish templates in `modes/es/` and writes a Spanish-language markdown report to `reports/` containing blocks A-G and sequential numbering.
- [ ] All standard system validations in `test-all.mjs` or similar test scripts pass successfully.
