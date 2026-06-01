# Implementation Plan: Spanish Language Modes

## Objectives
1. **Analyze existing English templates** (`modes/_shared.md`, `modes/oferta.md`, `modes/apply.md`, `modes/pipeline.md`) and Portuguese/German structures to ensure complete compatibility.
2. **Translate and localize** to Spanish:
   - `modes/es/_shared.md`: Technical tech-market terminology (e.g. "contrato indefinido", "autónomo", "bruto anual", "remoto/teletrabajo").
   - `modes/es/oferta.md`: Spanish evaluation report (Blocks A-G, Legitimacy tier, scoring breakdown).
   - `modes/es/postular.md`: Live form instructions and cover letter draft prompts.
   - `modes/es/pipeline.md`: Pipeline intake prompts.
   - `modes/es/README.md`: Short instructions in Spanish.
3. **Configure profile**: Update `config/profile.yml` to set `language.modes_dir` to `modes/es`.
4. **Implement dynamic output language adaptability**: Enforce that internal evaluation reports are in Spanish, but candidate-facing outreach and materials dynamically adapt to the Job Description's language.
5. **Verify system integrity**: Run `test-all.mjs` and run a mock evaluation using the new Spanish templates to verify correct layout, sequential numbering, and content.

## Steps

### Step 1: Codebase Exploration
- Use an Explorer agent to read the English templates and analyze how they are structured.
- Analyze the test suite requirements in `test-all.mjs` or other verification files to see what validation checks are run against the files.
- Analyze other localized templates (e.g., German `de/`, Portuguese `pt/`) to ensure consistency.

### Step 2: Implementation of Spanish Modes
- Use a Worker agent to create the `modes/es/` directory and populate the 5 files: `_shared.md`, `oferta.md`, `postular.md`, `pipeline.md`, `README.md`.
- Enforce the dynamic language adaptability requirements in the prompts within `modes/es/_shared.md`, `modes/es/oferta.md`, and `modes/es/postular.md`.
- Configure `config/profile.yml` to use `language.modes_dir: "modes/es"`.

### Step 3: Review and Challenge
- Use a Reviewer agent to verify the correctness of the translation, exact matching of metadata fields/blocks from system expectations, and formatting constraints.
- Use a Challenger agent (or worker commands) to run tests and mock evaluation.

### Step 4: Forensic Integrity Audit
- Use a Forensic Auditor agent to verify that the implementation is genuine, has no placeholders or English remnants in core prompts, and strictly adheres to the data contracts in `DATA_CONTRACT.md`.

## Schedule & Milestones
| # | Name | Scope | Dependencies | Status | Agent ID |
|---|------|-------|-------------|--------|----------|
| 1 | Explore | Analyze English/Portuguese templates and verification checks | none | Done | 80f73af9-648a-4018-8a02-c17708640fe9 |
| 2 | Implement | Create modes/es/ files and update profile.yml | M1 | Done | 858928c8-7e84-4849-bd6a-c4ff0d9ccadc |
| 3 | Review | Audit correctness, layouts, dynamic adaptability rules | M2 | Done | fa7c2a87-f321-43e2-81b0-db1e66b33f88 |
| 4 | Verify | Run test-all.mjs and mock evaluation, output checks | M3 | Done | 2d0aa153-93d3-4cca-9ba4-3585fe93d075 |
| 5 | Mock Eval | Update gemini-eval.mjs & run mock evaluation | M4 | Done | 873b7422-16aa-447d-8e4a-04d59772b08d |
