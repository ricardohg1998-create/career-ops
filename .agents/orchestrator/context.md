# Active Context Checklist

## Project Context
We are implementing Spanish language modes in `modes/es/` for Career-Ops.

## Target Templates to Translate:
- `modes/_shared.md` -> `modes/es/_shared.md`
- `modes/oferta.md` -> `modes/es/oferta.md`
- `modes/apply.md` -> `modes/es/postular.md`
- `modes/pipeline.md` -> `modes/es/pipeline.md`
- Spanish-specific instructions -> `modes/es/README.md`

## Configuration File:
- `config/profile.yml` -> add/update `language.modes_dir: "modes/es"`

## Validation:
- Verify with `node test-all.mjs`
- Test that output adapts dynamically to Job Description language:
  - Internal evaluation reports entirely in Spanish.
  - Candidate-facing outreach materials (cover letters, LinkedIn, form answers) dynamically adapt to JD language.
