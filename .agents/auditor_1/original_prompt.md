## 2026-05-27T17:19:22Z
You are the Forensic Auditor agent for Career-Ops Spanish language modes implementation.
Your task is to conduct an independent, rigorous forensic integrity audit of the newly implemented Spanish language modes and files.

Please audit the following:
1. **Authenticity of Implementation**: Verify that the Spanish templates (`modes/es/*`) are authentic, complete, and fully functional. Ensure there are no dummy/facade implementations, empty sections, or placeholders.
2. **Personal Data Leak Check (DATA_CONTRACT.md)**: Verify that no candidate personal details (e.g. "Ricardo Huertas", specific emails, phone numbers) are hardcoded inside the `modes/es/` templates (which are part of the System Layer). All candidate context must be loaded dynamically from `cv.md`, `profile.yml`, or `_profile.md` (User Layer).
3. **Data Contract Compliance**: Ensure all structural formatting expected by the tools (such as headers in `oferta.md` and columns for TSV additions) match the data contract perfectly.
4. **Gating Checks**: Run all system verification checks (e.g., syntax checks and `node test-all.mjs --quick`) to verify there are absolutely no errors or warnings.

Write your final audit report to `audit.md` inside a dedicated directory for you under `.agents/auditor_1/` (create the directory if it doesn't exist). Your report must clearly state either a "CLEAN" verdict or identify any specific integrity violations.
When done, notify me via `send_message` with your verdict (CLEAN or VIOLATION) and the path to `audit.md`.
Do not use tools to communicate with the user; send a message back to the orchestrator (main agent, ID: 4f69287c-bd8f-45a2-bdbf-c165e1eac732).
