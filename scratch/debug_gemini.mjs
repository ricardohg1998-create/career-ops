import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("No API key");
  process.exit(1);
}

const ROOT = "C:\\Users\\34634\\Documents\\antigravity\\friendly-bell";
const PATHS = {
  shared:      join(ROOT, 'modes', '_shared.md'),
  oferta:      join(ROOT, 'modes', 'oferta.md'),
  cv:          join(ROOT, 'cv.md'),
  profile:     join(ROOT, 'modes', '_profile.md'),
  profileYml:  join(ROOT, 'config', 'profile.yml'),
};

const sharedContext  = readFileSync(PATHS.shared, 'utf-8');
const ofertaLogic    = readFileSync(PATHS.oferta, 'utf-8');
const cvContent      = readFileSync(PATHS.cv, 'utf-8');
const profileContent = readFileSync(PATHS.profile, 'utf-8');
const profileYml     = readFileSync(PATHS.profileYml, 'utf-8');

const jdText = readFileSync("C:\\Users\\34634\\Documents\\antigravity\\friendly-bell\\scratch\\jd-glean.txt", 'utf-8');

const systemPrompt = `You are career-ops, an AI-powered job search assistant.
You evaluate job offers against the user's CV using a structured A-G scoring system.

CRITICAL FORMATTING RULE: Do NOT use markdown tables anywhere in your output.
Gemini models have a known bug that causes infinite loops when generating markdown tables.
Instead of tables, represent all structured data using clean, well-formatted bulleted or numbered lists (e.g. for Blocks A, B, D, E, F, G).
For example, for Block B, list each requirement and then provide your CV mapping as sub-bullets under it.

Your evaluation methodology is defined below. Follow it exactly.

═══════════════════════════════════════════════════════
SYSTEM CONTEXT (_shared.md)
═══════════════════════════════════════════════════════
${sharedContext}

═══════════════════════════════════════════════════════
EVALUATION MODE (oferta.md)
═══════════════════════════════════════════════════════
${ofertaLogic}

═══════════════════════════════════════════════════════
CANDIDATE RESUME (cv.md)
═══════════════════════════════════════════════════════
${cvContent}

═══════════════════════════════════════════════════════
CANDIDATE PROFILE & TARGETS (config/profile.yml)
═══════════════════════════════════════════════════════
${profileYml}

═══════════════════════════════════════════════════════
USER ARCHETYPES & NARRATIVE (_profile.md)
═══════════════════════════════════════════════════════
${profileContent}

═══════════════════════════════════════════════════════
IMPORTANT OPERATING RULES FOR THIS CLI SESSION
═══════════════════════════════════════════════════════
1. You do NOT have access to WebSearch, Playwright, or file writing tools.
   - For Block D (Comp research): provide salary estimates based on your training data, clearly noted as estimates.
   - For Block G (Legitimacy): analyze the JD text only; skip URL/page freshness checks.
   - Post-evaluation file saving is handled by the script, not by you.
2. Generate Blocks A through G in full, in English, unless the JD is in another language.
3. At the very end, output a machine-readable summary block in this exact format:

---SCORE_SUMMARY---
COMPANY: <company name or "Unknown">
ROLE: <role title>
SCORE: <global score as decimal, e.g. 3.8>
ARCHETYPE: <detected archetype>
LEGITIMACY: <High Confidence | Proceed with Caution | Suspicious>
---END_SUMMARY---
`;

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash'
});

console.log("Calling Gemini...");
try {
  const result = await model.generateContent({
    contents: [
      { role: 'user', parts: [{ text: systemPrompt + `\n\nJOB DESCRIPTION TO EVALUATE:\n\n${jdText}` }] }
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 8192,
    }
  });
  
  console.log("=== API RESPONSE DETAILS ===");
  console.log("Prompt feedback:", JSON.stringify(result.response.promptFeedback, null, 2));
  console.log("Candidates:", JSON.stringify(result.response.candidates, null, 2));
  console.log("Finish Reason:", result.response.candidates?.[0]?.finishReason);
  console.log("=== TEXT OUTPUT ===");
  console.log(result.response.text());
} catch (e) {
  console.error("Error:", e);
}
