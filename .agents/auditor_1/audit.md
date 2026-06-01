## Forensic Audit Report

**Work Product**: Career-Ops Spanish Language Modes (`modes/es/*`)
**Profile**: General Project
**Verdict**: CLEAN

### Phase Results
- **Source Code Analysis & Authenticity**: PASS — The Spanish templates (`modes/es/*`) are highly authentic, fully functional, and complete translations of the system layer instructions. Localized compensation mechanics (such as SBA, 14 pagas, 40-50% autónomo premium, collective agreements) are fully detailed with no dummy/facade implementations.
- **Personal Data Leak Check**: PASS — Conducted a comprehensive search in the `modes/es/` directory for any hardcoded candidate personal details (including "Ricardo", "Huertas", email addresses, phone numbers, and directory paths). No personal data leaks were found; all candidate context is loaded dynamically from the User Layer files.
- **Data Contract Compliance**: PASS — The headers in `modes/es/oferta.md` match the required English-key format exactly to prevent pipeline breaking. The TSV column format specified matches the data contract exactly (9 columns, status preceding score).
- **Gating Checks**: PASS — Executed `node test-all.mjs --quick` successfully, passing all 89 test cases with 0 errors and 0 warnings. The pipeline verification check (`node verify-pipeline.mjs`) also completed successfully with 0 errors and 0 warnings.

---

### Evidence

#### 1. System Verification Gating Checks (`node test-all.mjs --quick`):
```text
🧪 career-ops test suite

1. Syntax checks
  ✅ analyze-patterns.mjs syntax OK
  ✅ check-liveness.mjs syntax OK
  ✅ cv-sync-check.mjs syntax OK
  ✅ dedup-tracker.mjs syntax OK
  ✅ doctor.mjs syntax OK
  ✅ followup-cadence.mjs syntax OK
  ✅ gemini-eval.mjs syntax OK
  ✅ generate-latex.mjs syntax OK
  ✅ generate-pdf.mjs syntax OK
  ✅ liveness-browser.mjs syntax OK
  ✅ liveness-core.mjs syntax OK
  ✅ merge-tracker.mjs syntax OK
  ✅ normalize-statuses.mjs syntax OK
  ✅ scan.mjs syntax OK
  ✅ test-all.mjs syntax OK
  ✅ update-system.mjs syntax OK
  ✅ verify-pipeline.mjs syntax OK

2. Script execution (graceful on empty data)
  ✅ cv-sync-check.mjs runs OK
  ✅ verify-pipeline.mjs runs OK
  ✅ normalize-statuses.mjs runs OK
  ✅ dedup-tracker.mjs runs OK
  ✅ merge-tracker.mjs runs OK
  ✅ analyze-patterns.mjs --self-test runs OK
  ✅ update-system.mjs check runs OK

3. Liveness classification
  ✅ Expired pages are not revived by nav/footer "Apply" text
  ✅ Visible apply controls still keep real job pages active
  ✅ Closed postings with "Applications have closed" banner are detected

4. Dashboard build (skipped --quick)

5. Data contract validation
  ✅ System file exists: CLAUDE.md
  ✅ System file exists: VERSION
  ✅ System file exists: DATA_CONTRACT.md
  ✅ System file exists: modes/_shared.md
  ✅ System file exists: modes/_profile.template.md
  ✅ System file exists: modes/oferta.md
  ✅ System file exists: modes/pdf.md
  ✅ System file exists: modes/scan.md
  ✅ System file exists: templates/states.yml
  ✅ System file exists: templates/cv-template.html
  ✅ System file exists: .claude/skills/career-ops/SKILL.md
  ✅ User file gitignored: config/profile.yml
  ✅ User file gitignored: modes/_profile.md
  ✅ User file gitignored: portals.yml

6. Personal data leak check
  ✅ No personal data leaks outside allowed files

7. Absolute path check
  ✅ No absolute paths in code files

8. Mode file integrity
  ✅ Mode exists: _shared.md
  ✅ Mode exists: _profile.template.md
  ✅ Mode exists: oferta.md
  ✅ Mode exists: pdf.md
  ✅ Mode exists: scan.md
  ✅ Mode exists: batch.md
  ✅ Mode exists: apply.md
  ✅ Mode exists: auto-pipeline.md
  ✅ Mode exists: contacto.md
  ✅ Mode exists: deep.md
  ✅ Mode exists: ofertas.md
  ✅ Mode exists: pipeline.md
  ✅ Mode exists: project.md
  ✅ Mode exists: tracker.md
  ✅ Mode exists: training.md
  ✅ _shared.md references _profile.md

9. Local parser contract
  ✅ scan.mjs guards company names before filtering
  ✅ scan.mjs falls back to ATS API when local parser fails
  ✅ local-parser provider module exists
  ✅ scan.md skips expensive levels after successful local parser
  ✅ Cohere parser example is not bundled as a runtime script
  ✅ portals example documents a generic local parser contract

10. AGENTS.md integrity
  ✅ AGENTS.md has section: Data Contract
  ✅ AGENTS.md has section: Update Check
  ✅ AGENTS.md has section: Ethical Use
  ✅ AGENTS.md has section: Offer Verification
  ✅ AGENTS.md has section: Canonical States
  ✅ AGENTS.md has section: TSV Format
  ✅ AGENTS.md has section: First Run
  ✅ AGENTS.md has section: Onboarding

11. Version file
  ✅ VERSION is valid semver: 1.8.1

11. Location filter — always_allow tier
  ✅ Brussels, Belgium passes (always_allow hit)
  ✅ Remote, Belgium or France passes (always_allow beats block)
  ✅ Paris, France is rejected (block still applies)
  ✅ empty location passes (unchanged semantics)
  ✅ case-insensitive match works
  ✅ without always_allow, block still wins (backward compatible)
  ✅ null locationFilter returns a pass-all filter (early-return path)
  ✅ always_allow as a bare string is wrapped to a single-item list
  ✅ non-string entries (null, numbers, undefined) are filtered out without crashing
  ✅ a block list with only non-string entries normalizes to [] (no false rejects)
  ✅ empty/whitespace always_allow entries are dropped (no pass-all via includes(""))
  ✅ whitespace-padded keywords still match after trim
  ✅ whitespace-only location passes (treated as missing)
  ✅ non-string location values (number, object, null, undefined) pass without throwing
  ✅ non-string locations are passed through to downstream evaluation, not silently dropped

==================================================
📊 Results: 89 passed, 0 failed, 0 warnings
🟢 All tests passed — safe to push/merge
```

#### 2. Pipeline Integrity Check (`node verify-pipeline.mjs`):
```text
📊 Checking 13 entries in applications.md

✅ All statuses are canonical
✅ No exact duplicates found
✅ All report links valid
✅ All scores valid
✅ All rows properly formatted
✅ No pending TSVs
✅ No bold in scores

==================================================
📊 Pipeline Health: 0 errors, 0 warnings
🟢 Pipeline is clean!
```

#### 3. Manual Personal Data Leak Scan:
Using exact ripgrep search in the `modes/es/` directory:
- Search for "Ricardo": `No results found`
- Search for "Huertas": `No results found`
- Search for "Santiago": `No results found`
- Search for "santifer": `No results found`
- Search for "34634": `No results found`
- Search for email patterns (`@`): `No results found`
- Search for phone patterns: Only reference is to standard global rules in `_shared.md` ("4. Incluir el número de teléfono en los mensajes de LinkedIn...").

#### 4. Header Key & TSV Contract Comparison:
- `modes/es/oferta.md` header keys matching English modes precisely:
  ```markdown
  # Evaluation: {Company} — {Role}

  **Date:** {YYYY-MM-DD}
  **URL:** {URL de la oferta}
  **Archetype:** {arquetipo detectado}
  **Score:** {X.X/5}
  **Legitimacy:** {High Confidence | Proceed with Caution | Suspicious}
  **PDF:** {ruta del PDF generado o pending}
  ```
- `modes/es/oferta.md` TSV definition:
  ```text
  {num}\t{date}\t{company}\t{role}\t{status}\t{score}/5\t{pdf_emoji}\t[{num}](reports/{num}-{slug}-{date}.md)\t{note}
  ```
  Status precedes the score column, matching the contract perfectly.
