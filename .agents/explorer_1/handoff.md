# Handoff Report: Spanish Language Modes Exploration

This report summarizes the findings, logic, and conclusions of the technical exploration of Career-Ops templates, Portuguese mappings, validation constraints, and language adaptability (R3).

## 1. Observation
*   **English Base Templates**:
    *   `modes/_shared.md` contains the system rules and calibration framework, declaring:
        *   Line 21: `"**RULE: NEVER hardcode metrics from proof points.** Read them from cv.md + article-digest.md at evaluation time."`
        *   Line 111: `"6. Generate content in the language of the JD (EN default)"`
    *   `modes/oferta.md` outlines the Sequential Sequential sequential sequential full job evaluations.
        *   Lines 159-166 outline the sequential sequential sequence format:
            ```markdown
            # Evaluation: {Company} — {Role}
            
            **Date:** {YYYY-MM-DD}
            **URL:**
            **Archetype:** {detected}
            **Score:** {X/5}
            **Legitimacy:** {High Confidence | Proceed with Caution | Suspicious}
            **PDF:** {path or pending}
            ```
*   **Portuguese Localized Templates**:
    *   `modes/pt/README.md` details mappings between PT-BR and EN (e.g., line 95: `"Formal employment (CLT) | CLT / Carteira assinada"`, line 96: `"Contractor (PJ) | PJ (Pessoa Jurídica)"`).
    *   `modes/pt/_shared.md` contains localized compensation checks. Line 131:
        ```markdown
        | **CLT** (Consolidação das Leis do Trabalho) | Contrato formal com carteira assinada | Inclui FGTS, INSS, férias, 13º, aviso prévio. Na comparação, considerar o custo total empregador |
        ```
*   **Validation Constraints**:
    *   `DATA_CONTRACT.md` establishes that `modes/*` is in the **System Layer** (Line 32: `modes/_shared.md | Scoring system, global rules, tools`, Line 51: `modes/pt/* | Portuguese language modes`).
    *   `verify-pipeline.mjs` checks tracking integrity against `applications.md`.
        *   Line 36 defines: `const CANONICAL_STATUSES = ['evaluated', 'applied', 'responded', 'interview', 'offer', 'rejected', 'discarded', 'skip'];`
        *   Lines 41-50 define `ALIASES` supporting Spanish status aliases (e.g., `evaluada`, `aplicado`, `rechazado`, etc.) to align them to canonical versions.
        *   Lines 91-94:
            ```javascript
            if (!CANONICAL_STATUSES.includes(statusOnly) && !ALIASES[statusOnly]) {
              error(`#${e.num}: Non-canonical status "${e.status}"`);
              badStatuses++;
            }
            ```
        *   Line 130 checks links: `const match = e.report.match(/\]\(([^)]+)\)/);`
    *   `test-all.mjs` defines `expectedModes` (Lines 263-267) verifying existing modes and validating tracker formats.

## 2. Logic Chain
1.  **System vs. User Layer**: Localized modes files represent instructions and rules rather than personal candidate details. Therefore, per `DATA_CONTRACT.md` observations, the new directory `modes/es/` and its children must reside strictly within the **System Layer**, making them auto-updatable.
2.  **No Test Invalidation**: Since `test-all.mjs` and `verify-pipeline.mjs` execute strict checks on syntax and tracker formatting, any status written by Spanish modes must map to either the English canonical status or to the pre-approved `ALIASES` in `verify-pipeline.mjs`. For example, writing `Evaluada` or `Aplicada` is fully supported by the alias rules, whereas non-mapped words will break the pipeline health checks.
3.  **Correct Headers**: Any evaluation report `.md` output by the Spanish mode must strictly feature the exact header formatting described in `modes/oferta.md` to pass standard pipeline matches, including the exact `**URL:**` key.
4.  **Language Adaptability (R3)**: To satisfy the R3 requirement of evaluating in Spanish while generating outreach in the target recruiter's language, the prompts in `modes/es/_shared.md` and `modes/es/oferta.md` must clearly instruct the LLM to write internal reports (Blocks A-G) in Spanish, but candidate-facing deliverables (Block H / draft form answers, cover letters, and outreach templates) in the language of the JD.
5.  **Spanish Market Integration**: The Spain/LatAm market uses specific concepts (SBA, 14 pagas, autónomo vs. indefinido, retribución flexible, etc.) that can be mapped exactly in the same structured fashion as CLT/PJ in Portuguese (`modes/pt/_shared.md`) or Festanstellung/Probezeit in German (`modes/de/_shared.md`).

## 3. Caveats
*   This is a read-only investigation. No files have been written to `modes/es/` or anywhere outside the `.agents/explorer_1` directory.
*   Assumed that Spain is the primary target market since the workspace is localized in Europe/Spain timezone (`+02:00`). Latin America variations should be kept in mind for broader support, but Spain's SBA and Autónomo mechanics are heavily prioritized.

## 4. Conclusion
The implementation of the Spanish language modes is technically feasible, fully backwards-compatible, and will not break any integrity tests.
By creating the files `modes/es/README.md`, `modes/es/_shared.md`, `modes/es/oferta.md`, `modes/es/aplicar.md`, and `modes/es/pipeline.md`, we will provide a natural, tech-adapted experience for Spanish candidates. R3 adaptability is fully solved by partitioning internal reports (in Spanish) and candidate-facing templates (in the JD language).

## 5. Verification Method
To verify that the Spanish language modes design is healthy once implemented:
1.  Run the Quick Test suite to check JS/MJS syntax:
    ```bash
    node test-all.mjs --quick
    ```
2.  Run the pipeline health checks to ensure no broken links or invalid statuses are introduced:
    ```bash
    node verify-pipeline.mjs
    ```
3.  Inspect a generated Spanish report to check that:
    *   The filename prefix matches sequentially.
    *   The header contains all key fields (`Date`, `URL`, `Archetype`, `Score`, `Legitimacy`, `PDF`).
    *   The tracker status written is canonical or listed in the `ALIASES` array.
