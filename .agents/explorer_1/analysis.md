# Comprehensive Technical Analysis: Spanish Language Modes Implementation

## Executive Summary
This report provides a comprehensive technical analysis for the implementation of the Spanish language modes (`modes/es/`) in **Career-Ops**. The objective is to establish a robust, culturally and legally aligned local implementation for Spanish-speaking tech professionals (primarily in Spain and Latin America) while maintaining complete architectural compatibility and data integrity with the core systems.

---

## 1. Deep Dive: Structure and Mechanics of Default English Templates
The core behavior of Career-Ops is defined by four fundamental English templates located in `modes/`. Understanding their exact metadata keys, variables, and execution rules is essential for a precise localization.

### A. `modes/_shared.md` (System Context)
This is the auto-updatable core framework. It contains the scoring rules, candidate archetypes, global instructions, and tools definition.
*   **Sources of Truth**: Evaluates offers against four primary user files:
    1.  `cv.md` (Project root) — Standard candidate CV in Markdown.
    2.  `article-digest.md` (Optional) — Detailed proof points with precedence for project/article metrics.
    3.  `config/profile.yml` — Personal metadata, targets, and salary ranges.
    4.  `modes/_profile.md` — Active user-specific targeting archetypes and transitions.
*   **Scoring System (Blocks A-F)**: Standard 1-5 scale based on CV Match, North Star Alignment, Comp, Culture, and Red Flags.
*   **Posting Legitimacy (Block G)**: Qualifies opening status as *High Confidence*, *Proceed with Caution*, or *Suspicious* based on posting age, description specifics, layoff trends, and repost history.
*   **Archetype Detection**: Classifies the JD into six predefined roles:
    *   *AI Platform / LLMOps Engineer*
    *   *Agentic Workflows / Automation*
    *   *Technical AI Product Manager*
    *   *AI Solutions Architect*
    *   *AI Forward Deployed Engineer*
    *   *AI Transformation Lead*
*   **Global Rules**: Sets boundary constraints (e.g., "NEVER invent metrics," "ALWAYS prepare a cover letter if possible," "Run `cv-sync-check.mjs` at the start of each session").
*   **Writing Style Calibration**: Abstract tone and voice extraction engine (`## Writing Style` keys: `Tone`, `Sentence length`, `Openings`, `Punctuation`, `Vocabulary`, `Structure`, `Voice`, `Avoid`) to align generated materials with the user's natural voice.

### B. `modes/oferta.md` (Evaluation Mode)
Invoked when a candidate pastes a Job Description (JD) text or URL. It instructs the agent on how to execute a 7-block analysis:
*   **Block A (Role Summary)**: Prepares a metadata matrix (Archetype, Domain, Function, Seniority, Remote structure, Team size, TL;DR).
*   **Block B (CV Match)**: Maps requirements to exact CV lines, identifying technical and experience gaps and formulating a 4-question mitigation strategy.
*   **Block C (Level and Strategy)**: Assesses candidate seniority against requirements, proposing a transition plan and downlevel contingencies.
*   **Block D (Comp and Demand)**: Guides market rate research via WebSearch (Levels.fyi, Glassdoor, etc.) and analyzes role demand.
*   **Block E (Customization Plan)**: Outlines 5 CV edits and 5 LinkedIn edits to optimize matching.
*   **Block F (Interview Plan)**: Designs 6-10 STAR+R stories with a **Reflection** column for seniority signaling, cross-referencing `story-bank.md`.
*   **Block G (Posting Legitimacy)**: Executes qualitative analysis on hiring freshness, description contradictions, and company layoffs.
*   **Post-Evaluation**:
    *   Instructs to save report as `reports/{###}-{company-slug}-{YYYY-MM-DD}.md`.
    *   Defines the mandatory header variables: `**Date:**`, `**URL:**`, `**Archetype:**`, `**Score:**`, `**Legitimacy:**`, `**PDF:**`.
    *   Enforces registering the entry in `data/applications.md` by writing a single-line TSV to `batch/tracker-additions/` (to be merged via `merge-tracker.mjs`).

### C. `modes/apply.md` (Application Assistant)
Provides an interactive live form filler.
*   **Workflow**: Detects Chrome form → extracts company/role → searches context in `reports/` → compares for changes → generates pre-filled answers (Block H/G inputs) using CV and report context.
*   **Integration**: Modifies the applications tracker from `Evaluated` to `Applied` upon submission, prompting the user to begin LinkedIn outreach (`/contacto`).

### D. `modes/pipeline.md` (URL Inbox / Second Brain)
Automates batch URL evaluations recorded as unchecked items (`- [ ]`) in `data/pipeline.md`.
*   **Workflow**: Iterates over pending items, automatically numbers reports based on `reports/` prefixes, scrapes text using Playwright/WebFetch/WebSearch, triggers evaluations, compiles PDFs if score $\geq 3.0$, and moves lines to "Processed".

---

## 2. Organization of Localized Templates & Tech-Market Mappings
Localized templates are organized under separate subdirectories within `modes/` (e.g., `modes/pt/`, `modes/de/`, `modes/fr/`, `modes/ja/`, `modes/tr/`, `modes/ru/`). They contain localized core files (`_shared.md`, `oferta.md`, `aplicar.md` or equivalent, `pipeline.md`) and a README.

### Mappings in Portuguese BR (`modes/pt/`)
The Portuguese templates translate system prompts into professional technical Portuguese ("Português Tech BR")—avoiding literal machine-translation of standard developer vocabulary (retaining English terms like *pipeline, stack, deployment, embeddings, scope*)—and map specific Brazilian employment concepts:
*   **CLT (Consolidação das Leis do Trabalho)**: Formal salaried contract. Mapped to assess full employer costs and legal benefits (FGTS, INSS, paid vacation).
*   **PJ (Pessoa Jurídica)**: Contractor contract. Prompts the agent to calculate a CLT-equivalent rate (factoring in that PJ has no legal benefits and requires freelancer premiums, typically +30-60% hourly rate).
*   **13º Salário (13th Month Salary)**: Factored into overall compensation checks ($SBA = \text{monthly salary} \times 13$ or $13.33$).
*   **FGTS (Severance Fund)**: Accounted for as an 8% hidden employee benefit.
*   **VR/VA (Meal Vouchers)**: Mapped to add up to R$ 1,500/month to the comp total.
*   **PLR (Profit Sharing)**: Factored as variable annual compensation (1-3 extra salaries).
*   **Aviso Prévio (Notice Period)**: Integrated to calculate realistic start dates (30 days + 3 days per year worked).
*   **MEI/Cooperativa**: Flagged for caution due to structural precarity.

### Mappings in German (`modes/de/`)
The German templates map critical legal and structural DACH market mechanics:
*   **Festanstellung vs. Freelance**: Evaluates social security, tax liabilities, and freelance risk (Scheinselbstständigkeit).
*   **13. Monatsgehalt / Weihnachtsgeld**: Factored into the gross annual salary check.
*   **AGG (Allgemeines Gleichbehandlungsgesetz)**: Warns if standard DACH compliance tags like "(m/w/d)" are absent.
*   **Probezeit (Probation)**: Evaluates typical 6-month probation windows.
*   **Kündigungsfrist (Notice Period)**: Configured for standard 1-3 month transition cycles.
*   **Urlaub (Vacation Days)**: Evaluates tech standards (25-30 days; $<28$ is flagged as subpar).
*   **Betriebsrat & Tarifvertrag**: Factors in works councils and collective bargaining scales (TVöD, IG Metall) which limit personal negotiation bounds but improve job security.
*   **Arbeitszeugnis & Bewerbungsmappe**: Instructs the agent to evaluate and write in the coded language of formal German work references and structural job dossiers (Anschreiben, Lebenslauf).

---

## 3. System Constraints: Data Contract and Validation Tests
To prevent breaking existing automated pipelines and CI/CD checks, the new Spanish files in `modes/es/` must adhere strictly to the rules declared in `DATA_CONTRACT.md` and verified by `test-all.mjs` and `verify-pipeline.mjs`.

### A. Data Contract Constraints
*   **Layer Separation**: All newly introduced Spanish files (`modes/es/_shared.md`, `modes/es/oferta.md`, `modes/es/aplicar.md`, `modes/es/pipeline.md`) must belong to the **System Layer**. They must not contain any personal candidate data (names, phone numbers, localized credentials, or custom metrics). Customization must be loaded dynamically from `modes/_profile.md` and `config/profile.yml` (User Layer).

### B. Validation & Pipeline Health Constraints (`verify-pipeline.mjs` & `test-all.mjs`)
*   **Tracker Status Aliasing**: Career-Ops runs `verify-pipeline.mjs` to check the integrity of `data/applications.md`.
    *   The pipeline script strictly verifies that all status entries are either canonical (`evaluated`, `applied`, `responded`, `interview`, `offer`, `rejected`, `discarded`, `skip`) or pre-approved `ALIASES` (which maps specific Spanish verbs to canonical equivalents):
        *   `evaluada`, `condicional`, `hold`, `evaluar`, `verificar` $\rightarrow$ `evaluated`
        *   `aplicado`, `enviada`, `aplicada`, `applied`, `sent` $\rightarrow$ `applied`
        *   `respondido` $\rightarrow$ `responded`
        *   `entrevista` $\rightarrow$ `interview`
        *   `oferta` $\rightarrow$ `offer`
        *   `rechazado`, `rechazada` $\rightarrow$ `rejected`
        *   `descartado`, `descartada`, `cerrada`, `cancelada` $\rightarrow$ `discarded`
        *   `no aplicar`, `no_aplicar`, `monitor`, `geo blocker` $\rightarrow$ `skip`
    *   **Rule**: The Spanish modes MUST output tracker statuses matching these pre-approved Spanish aliases (e.g. `Evaluada`, `Aplicada`, `Entrevista`, etc.) or stick to the capital-letter canonical versions (`Evaluated`, `Applied`, etc.) to avoid breaking health checks.
*   **Strict Header Requirements**:
    *   All evaluation reports created under Spanish mode must follow the exact 3-digit zero-padded sequential naming prefix (`reports/###-...md`).
    *   The report header must contain the exact markdown keys between dashes:
        ```markdown
        # Evaluation: {Company} — {Role}
        
        **Date:** {YYYY-MM-DD}
        **URL:** {URL}
        **Archetype:** {Archetype}
        **Score:** {Score}/5
        **Legitimacy:** {Tier}
        **PDF:** {PDF Path}
        ```
    *   `**URL:**` is mandatory and must reside between `Score` (or `Archetype`) and `PDF`/`Legitimacy` keys. A missing `URL` or mismatched format will trigger warnings or errors in pipeline checkers.
*   **Strict TSV Column Alignment for Tracker Additions**:
    *   When writing new entries, the agent must write a single-line TSV to `batch/tracker-additions/` with exactly **9 columns** in this precise order:
        1. `num`
        2. `date`
        3. `company`
        4. `role`
        5. `status` (canonical or pre-mapped alias)
        6. `score` (formatted as `X.X/5` or `N/A`)
        7. `pdf` (`✅` or `❌`)
        8. `report` (markdown link `[###](reports/...)`)
        9. `notes`
    *   Note: In `applications.md`, the score column comes *before* status, but `merge-tracker.mjs` automatically handles this column swap as long as the TSV adheres to the 9-column contract.

---

## 4. Output Language Adaptability (Requirement R3)
A crucial user requirement is **R3 (Output Language Adaptability)**. When a candidate uses Spanish modes, they want their internal files in Spanish but their external outreach in the recruiter's language.

### A. R3 Design & Prompts Integration
We must design the prompts in `modes/es/` such that the LLM is explicitly trained to separate **Internal Evaluation Language** from **External Communication Language**:
1.  **Internal Evaluation Report (`reports/`)**: All commentary, reasoning, SWOT matrices, salary evaluations, customization plans, and interview strategies (Blocks A to F, and legitimacy Block G) must be written in **fluent technical Spanish** ("Español Técnico").
2.  **External Communication (Form Drafts, Cover Letters, Outreach)**: The candidate-facing text (Cover Letters, LinkedIn outreach templates, and Draft Application Answers) must **adapt dynamically to the Job Description's original language**:
    *   *If the JD is written in English*: Cover Letters, form answers, and LinkedIn templates must be output in high-level, professional English (avoiding cliches, utilizing action verbs, and matching writing style calibration).
    *   *If the JD is written in Spanish*: These outreach materials must be generated in professional, persuasive Spanish.

### B. Prompt Specimen for `modes/es/_shared.md` and `modes/es/oferta.md`
To enforce this, we should include the following rule block in the Spanish system prompts:
```markdown
### 🌐 Regla de Adaptabilidad de Idioma (R3) -- OBLIGATORIO
1. **Reporte de Evaluación Interno (Espacio del Candidato)**: Todos los bloques de análisis (A al G), explicaciones, tablas de match, valoraciones de nivel, mitigación de brechas y reflexiones de entrevistas se redactarán siempre en **ESPAÑOL** (con terminología técnica nativa).
2. **Entregables de Cara al Reclutador (Outreach y Formularios)**: El contenido destinado a ser enviado a la empresa (Borradores de Respuestas a Preguntas de Formularios del Bloque H, Cartas de Presentación, y Mensajes de Contacto en LinkedIn) se adaptará automáticamente al **idioma en el que esté redactada la descripción de la vacante (Job Description)**:
   - **JD en Inglés**: Los borradores de respuestas, cartas y mensajes se generarán en **inglés técnico nativo** de alta calidad (aplicando las reglas de oraciones directas, verbos de acción y calibración de estilo de escritura).
   - **JD en Español**: Se generarán en **español profesional y persuasivo**, manteniendo los términos técnicos estándar del sector en inglés donde corresponda.
```

---

## 5. Mappings for the Spanish and LatAm Tech Markets
The implementation of the Spanish language modes requires mapping specific employment and compensation concepts relevant to Spain and Latin America (with particular emphasis on Spain, given the local context of the workspace and timezone).

### A. Key Technical & Legal Mappings (Spain & LatAm)

| Term / Practice | Meaning | Impact on Evaluation & Strategy |
| :--- | :--- | :--- |
| **SBA (Salario Bruto Anual)** | Annual Gross Salary. Standard way to express salary in Spain. | The primary metric for salary targets. Comp comparisons must translate monthly expectations to SBA ($SBA = \text{monthly gross} \times 12 \text{ or } 14$). |
| **14 Pagas** | 12 monthly payments + 2 extra payments (usually in July and December). | Emphasize that SBA is identical, but monthly liquid cash-flow differs. Never confuse monthly net base under 12 vs 14 payment schedules. |
| **Contrato Indefinido** | Permanent employment contract. Highly protected by Spanish labor law. | Represents high stability. Standard for assessing "Cultural & Stability signals". |
| **Autónomo (Freelance)** | Independent contractor. Pays progressive social security fees and handles VAT/IRPF. | Spanish equivalent of the PJ model. Prompts the agent to recommend billing **at least 40-50% more** than the equivalent employee hourly rate to cover social security quotas (cuota de autónomos), quarterly VAT (IVA), income tax (IRPF), and lack of paid vacation/sick leave. |
| **Convenio Colectivo** | Sector-specific collective bargaining agreement (e.g., *Convenio de Consultoría*). | Defines legal minimums, maximum working hours, and categorization levels. The agent should verify if the company adheres to a restrictive or favorable convenio. |
| **Seguridad Social (Coste de Empresa)** | Employer-paid Social Security contribution (approx. 30-33% on top of SBA). | Crucial when comparing an employee contract to an Autónomo (freelance) proposal; it represents the real budget the employer allocates. |
| **Retribución Flexible** | Tax-free compensation benefits (Meal vouchers, nursery, transport, health insurance). | These benefits reduce the taxable base for personal income tax (IRPF). The agent should calculate the net tax savings when these are offered. |
| **Período de Prueba** | Probationary period (typically 2 to 6 months depending on seniority/convenio). | Evaluated as a standard market practice. Not a red flag unless exceeding 6 months. |
| **Baja Voluntaria y Preaviso** | Resignation notice period. 15 days standard, but often 1-2 months for senior/lead roles. | Crucial for setting realistic availability dates in form drafts and outreach. |
| **Tickets Restaurante** | Meal vouchers (exempt from tax up to €11/day). | Evaluated as a highly positive benefit in local packages. |

### B. Negotiation Scripts Framework (Spanish)
The Spanish shared context should provide concrete negotiation templates:
*   **Salary Expectation**:
    > "Con base en los datos de mercado actuales para un rol de este nivel, mi expectativa de Salario Bruto Anual (SBA) se sitúa en el rango de [RANGO de profile.yml]. No obstante, tengo total flexibilidad en la estructura del paquete en función del resto de beneficios, retribución flexible y perspectivas de crecimiento a largo plazo."
*   **CLT vs. PJ equivalent (Employee vs. Autónomo)**:
    > "Para realizar una valoración justa entre ambas opciones, es necesario comparar el coste total del paquete. Si contemplamos la opción de Autónomo (freelancer), la tarifa mensual equivalente recomendada es de [VALOR] para compensar la ausencia de cotizaciones patronales a la Seguridad Social, el 13º/14º salario, las vacaciones pagadas y las responsabilidades fiscales de IVA e IRPF."
*   **Pushback against geographical discount**:
    > "Los roles para los que estoy aplicando están orientados a resultados y a la entrega de valor a nivel global, no a la ubicación geográfica del profesional. Mi impacto y trayectoria técnica se mantienen idénticos independientemente de la geografía."

---

## 6. Implementation Blueprint for Spanish Language Modes (`modes/es/`)
When the implementation phase begins, the following files should be created inside `modes/es/`:

### 1. `modes/es/README.md`
Onboarding documentation explaining when to use Spanish modes, permanent profile configuration (`language.modes_dir: modes/es`), and translation guidelines (using "Español Técnico").

### 2. `modes/es/_shared.md`
Translates global instructions, scoring definitions, and archetype detection. Incorporates:
*   **Language Adaptability (R3)** guidelines.
*   **Spanish/LatAm market specs** (Autónomo vs. Indefinido, 14 pagas, Retribución Flexible, IRPF, etc.).
*   Pre-approved **status aliases** to keep alignment with `verify-pipeline.mjs`.

### 3. `modes/es/oferta.md`
Localized evaluation template. Directs the creation of Reports containing blocks A to G (in Spanish) and block H (form drafts, in the JD's original language). Ensures that the header variables strictly respect the `verify-pipeline.mjs` checks:
*   `**Date:**`
*   `**URL:**` (correctly located between Score/Archetype and PDF/Legitimacy)
*   `**Archetype:**`
*   `**Score:**`
*   `**Legitimacy:**`
*   `**PDF:**`

### 4. `modes/es/aplicar.md`
Localized application form filler, including local compliance fields (salary expectations in SBA, regime preferences, notice periods).

### 5. `modes/es/pipeline.md`
Localized URL inbox processing prompt, allowing flexible section reading ("Pendientes", "Procesadas") while maintaining complete syntax compatibility with automated scripts.

---

## Conclusion & Verification Plan
The implementation of the Spanish language modes according to this blueprint is completely safe and backwards-compatible. 

### Invalidation Conditions
If a user implements Spanish modes, the system must not trigger errors during the `test-all.mjs` test run. The validation can be successfully executed by:
1. Running `node test-all.mjs --quick` to confirm no JS syntax issues.
2. Generating a sample evaluation report in Spanish, ensuring that its header matches the exact format and that its status is correctly mapped in `verify-pipeline.mjs`.
3. Running `node verify-pipeline.mjs` to ensure the applications tracker remains perfectly clean and healthy.
