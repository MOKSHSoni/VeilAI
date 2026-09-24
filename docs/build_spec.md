# Build Spec: "VeilAI" — Offline, Clickable Privacy Firewall Prototype

## 0. Precedence and Reading Order

1. Read `@docs/veilai_final_solution.md` fully. It is the product design.
2. Then read this file. **If this specification and the design doc disagree, THIS specification wins.** In particular, the decision philosophy in §17 replaces the design doc's default action table.

Use the design doc's terminology exactly: layers L0–L5, detection ensemble, fusion, SAFE / LOW / MEDIUM / HIGH / CRITICAL / REVIEW, Data Minimisation Engine, Honeytokens, Adaptive Detection, Local Answer Mode, Exposure Explainer, Verification, Rehydration.

Use the benchmark category names exactly, everywhere: `CREDENTIALS`, `SECURITY`, `PERSONAL_INFORMATION`, `CUSTOMER_INFORMATION`, `FINANCIAL`, `CONFIDENTIAL_BUSINESS`, `INTELLECTUAL_PROPERTY`.

This is a **hackathon demonstration prototype**, not a production security system. Do not replace the architecture with a simpler generic PII scanner.

---

## 1. Product Concept

VeilAI is a **local-first AI privacy firewall** that sits between an employee and an external AI service.

```text
Understand → Identify sensitive information → Assess risk → Minimise unnecessary data
→ Mask what remains → Fast local verification → Send only the safe version to external AI
```

**Core principle:** *LLM for understanding. Deterministic code for masking. Deterministic verification for checking.*

- The (simulated) Qwen layer identifies and classifies sensitive information.
- Qwen does **not** rewrite documents to mask them.
- `masking.ts` performs all replacements deterministically, from structured findings.
- A second full Qwen scan is **not** part of the normal path.

---

## 2. What Is Hardcoded vs What Runs for Real

**Hardcoded (scenario data):** all "model" outputs: layer results, findings, confidence, fused scores, risk levels, explanations, task types, simulated AI replies, local answers, dashboard data, feedback queue.

**Real deterministic code running on that data:**
- `rules.ts`: regex detectors, Luhn, Verhoeff
- `masking.ts`: builds the sanitised text from findings and minimisation actions
- `verification.ts`: checks the sanitised text for leaks and repairs them
- `rehydrate.ts`: restores placeholders in the simulated AI reply
- `store.ts`: in-memory state such as the allowlist

There must be no real ML, no real LLM calls, no backend, no external APIs, no cloud services and no runtime network dependency. **The app must work with Wi-Fi fully disabled.**

Every simulated value or model output carries a small visible "simulated" tag. The Benchmark screen is the only place showing real measured numbers.

---

## 3. Technology Stack and Environment

- **Stack:** Vite, React 18, TypeScript (strict), Tailwind CSS, React Router, Recharts, Vitest, ESLint. Install via npm. No other UI framework.
- **Offline assets:** system font stack only. No Google Fonts, CDN assets, external images, analytics or external APIs.
- **Windows:** the environment is Windows. All npm scripts must be cross-platform: no `rm -rf`, no `export VAR=...`, no bash-only syntax.
- **Scripts:** `dev`, `build`, `preview`, `test`, `typecheck`, `lint`.

---

## 4. Project Structure

```text
src/
├── data/
│   ├── types.ts
│   ├── scenarios.ts
│   ├── benchmark.ts
│   ├── dashboard.ts
│   └── feedback.ts
├── lib/
│   ├── rules.ts
│   ├── pipeline.ts
│   ├── masking.ts
│   ├── verification.ts
│   ├── rehydrate.ts
│   └── store.ts
├── components/
│   ├── RiskBadge, LayerCard, PipelineStepper, DiffView, ExplainerCard,
│   ├── MinimisationView, VerificationChecks, DecisionBar, AttestationStrip,
│   └── Heatmap, KpiCard, ...
├── screens/
│   ├── Scan, DocumentScan, Dashboard, Feedback, Benchmark
├── App.tsx
└── main.tsx
tests/
├── rules.test.ts
├── scenarios.test.ts
├── masking.test.ts
├── verification.test.ts
└── rehydrate.test.ts
README.md
```

Scenario content lives only in `src/data/`. Components consume typed data; no scenario-specific text inside components.

---

## 5. Scenario Data Contract

`sanitisedText` is **not** stored in scenario data. It is computed at runtime by `masking.ts` from findings, minimisation actions and policy. Scenario data stores only inputs; tests assert the computed outputs.

```ts
type RiskLevel = 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'REVIEW';
type Category =
  | 'CREDENTIALS' | 'SECURITY' | 'PERSONAL_INFORMATION' | 'CUSTOMER_INFORMATION'
  | 'FINANCIAL' | 'CONFIDENTIAL_BUSINESS' | 'INTELLECTUAL_PROPERTY';
type LayerId = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
type LayerStatus = 'CLEAR' | 'FLAGGED' | 'SKIPPED';
type Decision = 'SEND_SANITISED' | 'ANSWER_LOCALLY' | 'EDIT' | 'OVERRIDE' | 'BLOCK';
type MinAction = 'KEPT' | 'DROPPED' | 'PSEUDONYMISED' | 'GENERALISED';

interface Finding {
  id: string;
  spanText: string;            // exact text as it appears in content
  primaryCategory: Category;
  labels: Category[];          // multi-label, e.g. ['CREDENTIALS', 'SECURITY']
  entityType: string;          // PERSON, CLIENT, SECRET, INTERNAL_HOST, DEAL_VALUE, PROJECT, ...
  layer: LayerId;
  confidence: number;          // 0–1, detection confidence
  severity: RiskLevel;         // impact, separate from confidence
  location?: string;           // e.g. "Page 4", "Line 3"
}

interface LayerResult {
  layer: LayerId;
  status: LayerStatus;
  latencyMs: number;           // simulated
  findingIds: string[];
  note: string;                // short explanation, incl. "skipped by gating router"
}

interface Scenario {
  id: number;
  title: string;
  instruction: string;
  content: string;
  destinationTool: string;
  taskType: string;
  normalisationNotes: { before: string; after: string; method: string }[];
  layerResults: LayerResult[];
  findings: Finding[];
  fusion: { fusedConfidence: number; labelHierarchyNote?: string };
  riskLevel: RiskLevel;
  riskScore: number;           // 0–100
  explanation: {
    found: string; where: string; evidence: string;
    whyItMatters: string; regulation: string; recommended: string;
  };
  minimisation: { item: string; action: MinAction; reason: string }[];
  minimisationSummary: string;
  simulatedAIReply?: string;   // written with placeholders
  localAnswer?: string;
  defaultDecision: Decision;
  allowedDecisions: Decision[];
  blocked?: boolean;           // no sanitised text is produced (Scenario 2)
  escalateToQwenReview?: boolean;
  structuredData?: { columns: string[]; rows: Record<string, string | number>[] }; // Scenario 4
  messages?: { instruction: string; content: string; riskLevel: RiskLevel }[];     // Scenario 7
  stateVariants?: { whenAllowlisted: Partial<Scenario> };                           // Scenario 10
  simulatedTotalMs: number;
}
```

---

## 6. Scan Screen Pipeline

Animate these steps in a vertical stepper (300–600 ms per step):

```text
1 Capture → 2 Normalise → 3 Task Analysis → 4 Detection Ensemble → 5 Fusion
→ 6 Policy + Risk → 7 Exposure Explanation → 8 Data Minimisation
→ 9 Context-Preserving Masking → 10 Fast Local Verification → 11 Decision
→ 12 External AI / Local Answer / Block
```

**Animation speed is only for presentation.** Each step displays its own *simulated* latency, and the displayed total comes from `simulatedTotalMs`. Scenario 6 must display a total under 100 ms even though the animation is slower.

---

## 7. Pipeline Steps in Detail

### 7.1 Capture
Show the instruction and content separately, plus the destination AI tool.

### 7.2 Normalise
Show before/after for evasion attempts. Scenario 8 demonstrates:
- an API key written with spaces between its characters, collapsed into the real key pattern
- a base64-encoded password, decoded

### 7.3 Task Analysis
Show the detected task type (e.g., Summarisation, Data Analysis, Debugging, Email Drafting, Technical Explanation, Document Analysis). Explain briefly that the task decides what data is actually needed.

### 7.4 Detection Ensemble (L0–L5)
Six layer cards: name, status (CLEAR / FLAGGED / SKIPPED), findings count, simulated latency, short note.

Show the hybrid design visually:

```text
            DETECTION
      ┌─────────┴─────────┐
 Deterministic       Local Qwen (L5)
 L0–L4               via gating router
      └─────────┬─────────┘
              FUSION
```

- **Deterministic (L0–L4):** emails, phones, API keys, passwords, Aadhaar-like numbers, PAN, cards, honeytokens, org dictionaries, Org DNA, context cue rules.
- **Qwen (L5):** contextual categories: confidential business, IP, financial, sensitive business events, internal projects.

Display the message: *"Qwen provides semantic understanding; deterministic rules provide fast, precise pattern detection."*

### 7.5 Fusion
Show fused confidence, final categories, severity, evidence span and the label hierarchy note if applied.
- **Flag on any:** one flagged layer is enough to raise risk.
- **Clear on all:** SAFE only if every layer is clear.
- A critical finding is never averaged away.

**Multi-label findings:** one finding can carry several labels. Example: an AWS-style key → labels `CREDENTIALS` + `SECURITY`, primary `CREDENTIALS`, severity CRITICAL. This is why the benchmark's SECURITY result is a labelling effect, not a detection failure.

### 7.6 Policy + Risk
Show three separate values: **risk level**, **risk score (0–100)** and **detection confidence**. Never merge confidence and severity.

### 7.7 Exposure Explainer
For each important finding: Found · Where · Evidence · Why it matters · Regulation / policy · Recommended action.

### 7.8 Data Minimisation Engine
Show each item as KEPT / DROPPED / PSEUDONYMISED / GENERALISED with a reason, plus a summary line (e.g., "Removed 4 columns and 8 contact details not needed for this task"). Scenario 4 shows a column-by-column table.

### 7.9 Context-Preserving Masking (`masking.ts`)
Deterministic replacement from findings. Never `[REDACTED]` for everything; use role-preserving placeholders:

```text
Rahul Mehta       → ⟦EMP_01⟧
ABC Corporation   → ⟦CLIENT_A⟧
₹85 crore         → ⟦DEAL_VALUE_1⟧
Project Falcon    → ⟦PROJECT_01⟧
API key           → ⟦SECRET_1⟧
internal hostname → ⟦INTERNAL_HOST_1⟧
```

**Relationship-preserving:** the same original always maps to the same placeholder.

```text
Rahul reports to Priya. Rahul manages ABC Corporation. Priya approved the transaction.
→ ⟦EMP_01⟧ reports to ⟦EMP_02⟧. ⟦EMP_01⟧ manages ⟦CLIENT_A⟧. ⟦EMP_02⟧ approved the transaction.
```

`masking.ts` replaces the exact spans listed in findings (all occurrences). The mapping forms the local **vault**, shown in the UI as "Stays on this device." The external AI never receives an original value.

### 7.10 Fast Local Verification (`verification.ts`)
Deterministic, no second Qwen pass by default. Checks:
1. No vault value appears in the sanitised text
2. No **variant** of a vault value appears: first name, surname, possessive (`Rahul's`), spacing/dash variants, email local part
3. No known secret patterns remain (re-run `rules.ts`)
4. Every placeholder is well-formed and exists in the vault
5. Mappings are consistent (one original → one placeholder)

**Auto-repair:** if a variant leaks, add it to the vault under the same placeholder, re-mask, and re-verify once. If it still fails → REVIEW.

**Escalated Qwen review (exception path only):** when `escalateToQwenReview` is true, show an extra simulated "Qwen review" step with a note that this runs only for ambiguous cases, to avoid unnecessary LLM latency.

### 7.11 Rehydration (`rehydrate.ts`)
The simulated AI reply contains placeholders. Animate them being restored to the real values, with the label **"Restored on this device."** Matching tolerates case and spacing changes (`⟦emp_01⟧`, `⟦ EMP_01 ⟧`). Secrets (`⟦SECRET_n⟧`) are never restored into outbound text; show them restored only in the local view if relevant, or keep them masked.

### 7.12 Local Answer Mode
Show the hardcoded answer with: **"Answered by on-device Qwen — nothing left this device."**

---

## 8. Decision Philosophy

VeilAI is a **privacy-preserving transformation system**, not a blocking system.

- Normal sensitive content: **detect → minimise → mask → verify → send safe version** (default).
- **Answer locally** is recommended when sending externally adds little value (Scenario 3).
- **CRITICAL credentials** are masked and the sanitised version may be sent; the secret is never restored into the outbound prompt (Scenario 1).
- **Honeytokens** are a security incident, not ordinary sensitive data: always **BLOCK**, dashboard alert, no override (Scenario 2).
- **REVIEW:** the user is never stuck. Options: send sanitised, edit, or override with a written justification.
- Override is disabled wherever `allowedDecisions` excludes it.

Decision bar buttons: Send sanitised · Answer locally · Edit · Override with justification · Block, enabled per `allowedDecisions`, with `defaultDecision` highlighted.

---

## 9. Screens

### 9.1 Scan (main demo screen)
- **Attestation strip** (always visible): "Analysis: on device · Model: Ollama + Qwen3 4B (simulated) · Network: not used"
- Mock AI chat input (generic look, not any real product's branding), scenario picker, Send button, **Demo mode** toggle (auto-plays with no typing)
- Pipeline stepper (§6–7), original-vs-sanitised diff with highlighted spans, vault panel, decision bar, AI reply + rehydration or local answer
- **Scenario 7:** a session panel where three messages are sent in sequence; the mosaic warning appears after the third
- **Try your own text** tab: runs `rules.ts` only (emails, Indian phone numbers, API-key-like strings, 12-digit Aadhaar-like numbers with Verhoeff check, PAN `ABCDE1234F`, card numbers with Luhn check). Clearly labelled **"Simulated rules only."**
- Key content fits a 1366×768 screen without scrolling.

### 9.2 Document Scan
Hardcoded sample `Q3_Board_Pack.pdf`, 10 pages. Pages fill in one by one on a clickable **risk heatmap**; clicking a page shows its findings and level. Note: "L5 ran on only 3 of 10 pages because of the gating router."

### 9.3 Admin Dashboard (metadata only)
- Banner: **"No prompt content is stored — metadata only."**
- KPI cards: scans today, blocked, minimised & sent, local answers, REVIEW rate, honeytoken alerts
- Recharts: events by category (bar), events by AI tool (bar), risk levels this week (line)
- Recent events table: time, department, AI tool, category, risk, action, hashed user ID. Never show prompt content.
- **Honeytoken alert card** (appears after Scenario 2 runs): "Honeytoken HT-0042 detected · Planted in finance-reports repository config · Request blocked"

### 9.4 Analyst Feedback (Adaptive Detection)
- Queue of 5 findings with **redacted** evidence snippets (never full prompts)
- Buttons: False positive · False negative · Confirm
- **Project Atlas flow:** False positive → proposed update "Add to allowlist" → regression gate "Benchmark recall unchanged — PASS" → "Needs second analyst approval" → Approve → `store.ts` allowlist updated
- CRITICAL categories (secrets, honeytokens) cannot be suppressed; those buttons are disabled with an explanation
- After approval, re-running Scenario 10 returns SAFE

### 9.5 Benchmark (the only screen with real measured data; copy exactly into `benchmark.ts`)

**Setup:** 192 documents (147 sensitive, 45 safe) · Intel Core Ultra 5 125H · 16 GB RAM · CPU only

| Metric | Qwen3 1.7B | Qwen3 4B |
|---|---:|---:|
| Recall | 37.4% | 45.6% |
| Precision | 93.2% | 95.7% |
| False Negative Rate | 62.6% | 54.4% |
| False Positive Rate | 8.9% | 6.7% |
| Hard-case Recall | 18.9% | 24.3% |
| Average Short-Document Time | 6.4 s | 8.0 s |

| Category | Docs | Qwen3 1.7B | Qwen3 4B |
|---|---:|---:|---:|
| CREDENTIALS | 21 | 90.5% | 95.2% |
| CUSTOMER_INFORMATION | 26 | 69.2% | 69.2% |
| PERSONAL_INFORMATION | 29 | 58.6% | 58.6% |
| SECURITY | 35 | 62.9% | 20.0% |
| INTELLECTUAL_PROPERTY | 27 | 11.1% | 25.9% |
| CONFIDENTIAL_BUSINESS | 33 | 24.2% | 24.2% |
| FINANCIAL | 32 | 18.8% | 12.5% |

Footnote: *The SECURITY result is a labelling effect: the 4B model often labels API keys and passwords as CREDENTIALS without also adding SECURITY. VeilAI's multi-label findings prevent this from being misread as a detection failure.*

**Category recall chart** (Recharts, grouped bars). Do not imply the 4B wins every category (it doesn't for SECURITY and FINANCIAL).

**Long-document test** (one hidden sensitive sentence): 1 page: both models detected it. 5, 10 and 15 pages: neither reliably detected it. Conclusion shown: this is why VeilAI uses **chunking, the gating router and multiple detection layers**. Do not invent further numbers.

**Ablation table** (detection layers only):

| Step | Change | Recall | FNR |
|---|---|---:|---:|
| 0 | Qwen3 4B baseline (LLM only) | 45.6% | 54.4% |
| 1 | + Label hierarchy / multi-label scoring | To be measured | To be measured |
| 2 | + L1 deterministic rules + L2 entity NER | To be measured | To be measured |
| 3 | + Chunked, per-category L5 prompts | To be measured | To be measured |
| 4 | + L4 context signals (cue rules + classifier) | To be measured | To be measured |
| 5 | + L3 Org DNA + L0 honeytokens | To be measured | To be measured |
| 6 | Full fusion (flag on any, clear on all) | To be measured | To be measured |

Note under the table: *Minimisation, masking and verification are measured separately (utility retention %, residual leaks after masking), not by detection recall.*

**Never invent ensemble results.** Values come from `benchmark.ts` so they can be filled in later.

---

## 10. Scenarios (all fictional)

**1 — Debug with secret.** Python snippet with a fake AWS-style key, a DB password and an internal hostname. Instruction: "Why does this connection fail?" Task: Debugging. L1 flags → CRITICAL (labels `CREDENTIALS` + `SECURITY`). L5 skipped by gating router. Masking: key and password → `⟦SECRET_n⟧`, hostname → `⟦INTERNAL_HOST_1⟧`; code logic kept. Default: Send sanitised. Secrets never restored into the outbound prompt.

**2 — Honeytoken.** Fake config containing planted token `HT-0042`. L0 match → CRITICAL → **Block**, dashboard alert. `blocked: true`, no sanitised text, no override.

**3 — Board acquisition.** Content: "The board has approved negotiations with Acme Corp, expected to close in Q4 at a valuation near ₹420 Cr." No PII. L3 Org DNA 78% match with "Q3 Board Pack (Restricted)"; L4 cue rules flag; L5 confirms with a verbatim evidence quote. HIGH. Default: **Answer locally**; Send sanitised (Acme Corp → `⟦CLIENT_A⟧`, valuation → `⟦DEAL_VALUE_1⟧`) also allowed.

**4 — Average customer spending.** `structuredData`: 8 fictional rows with `name, email, phone, city, total_spend`. Instruction: "Calculate the average customer spending." Task: Data Analysis. Only `total_spend` KEPT; the other columns DROPPED, shown column by column. The simulated reply's average is **computed in code** from the data, not typed in.

**5 — HR email (verification catches a real masking gap).** Content:
> "Draft an email telling Rahul Mehta his salary goes to ₹18.5 LPA. Mention that Rahul's performance review was the reason."

Findings list only the span "Rahul Mehta". Name + salary combination bonus → HIGH. `masking.ts` replaces exact spans, so "Rahul's" survives the first pass **naturally**. `verification.ts` detects the first-name variant, adds it to the vault under `⟦EMP_01⟧`, re-masks, and passes. The UI visibly shows **fail → repair → pass**. The salary is KEPT (the task needs it). The reply is then rehydrated locally.

**6 — Safe request.** "Explain the difference between TCP and UDP." All layers CLEAR, L5 skipped, SAFE, sent unchanged, `simulatedTotalMs` < 100.

**7 — Mosaic session.** Three messages in sequence: client name → deal size → closing date. Each is LOW alone. After the third: "Across this session you've shared the client, deal size and closing date." Risk escalates to HIGH with a recommendation.

**8 — Evasion attempt.** An API key with spaces between every character, plus a base64-encoded password. Normalise shows both decoded; L1 then flags; masking and verification proceed as in Scenario 1.

**9 — Uncertain → REVIEW.** Content about "the new pricing approach for next year." Layers disagree (L4 flags weakly, L5 uncertain). `escalateToQwenReview: true` → simulated Qwen review remains inconclusive → REVIEW. Show three options (Send sanitised, Edit, Override) and a justification box.

**10 — Project Atlas.** "Summarise the public launch blog for Project Atlas." L3 dictionary flags "Project Atlas" → MEDIUM. After the analyst approves the allowlist update (§9.4), `stateVariants.whenAllowlisted` applies → SAFE.

---

## 11. Tests (Vitest)

- **rules.test.ts:** emails, Indian phone numbers, API-key patterns, Aadhaar-like values with Verhoeff, PAN, cards with Luhn. Positives and negatives for each.
- **masking.test.ts:** exact replacement, all occurrences, consistent pseudonyms, placeholder numbering, overlapping findings, relationship example from §7.9.
- **verification.test.ts:** detects vault values and variants (first name, possessive, spacing); auto-repair works; Scenario 5 goes fail → repair → pass.
- **rehydrate.test.ts:** single and multiple placeholders, case and spacing variants, secrets not restored into outbound text.
- **scenarios.test.ts:**
  - every scenario satisfies the type contract
  - every finding's `spanText` occurs in its content
  - every placeholder in the **final (post-repair)** sanitised text exists in the vault
  - no vault value or variant appears in the final sanitised text
  - blocked scenarios produce no sanitised text
  - scenarios whose `allowedDecisions` exclude OVERRIDE never enable it
  - Scenario 4's displayed average equals the computed average

---

## 12. Design Requirements

- Clean, professional security-product look. Light theme by default, dark mode toggle.
- One accent colour. Risk colours: SAFE green, LOW teal, MEDIUM amber, HIGH orange, CRITICAL red, REVIEW purple. Every badge also shows its text.
- Readable at 1366×768 (projector). No horizontal overflow.
- Keyboard accessible, visible focus states. No emoji, no stock illustrations.

---

## 13. Development Process

Work in phases. After **every** phase run:

```text
npm run typecheck → npm run lint → npm test → npm run build → fix all failures → git commit
```

Do not proceed while anything fails.

| Phase | Build |
|---|---|
| 1 Scaffold | Vite, React, TS strict, Tailwind, Router, ESLint, Vitest, scripts, layout, sidebar, theme toggle |
| 2 Data + core logic | types, scenarios 1–10, benchmark data, rules, masking, verification, rehydrate, store; all tests passing |
| 3 Scan screen | pipeline stepper, layer cards, fusion, risk, explainer, minimisation, diff, vault, verification, decision bar, rehydration, local answer, session panel, demo mode, try-your-own tab |
| 4 Document + Dashboard | heatmap, page findings, KPIs, charts, events table, honeytoken alert |
| 5 Feedback + Benchmark | feedback queue, allowlist flow, regression gate, approval, benchmark tables, chart, long-document results, ablation table |
| 6 Polish | 1366×768 check, dark mode, keyboard navigation, focus states, "simulated" tags, no overflow; search `dist/` for `http://` and `https://` and remove any external references |
| 7 README | see §14 |

---

## 14. README Must Contain

1. Installation and requirements (Node 20+)
2. Development, build, test commands
3. How to edit scenarios (`src/data/scenarios.ts`)
4. How to edit benchmark numbers (`src/data/benchmark.ts`)
5. Architecture overview (§1, §7, §16)
6. What is simulated vs what runs for real (§2)
7. The 3-minute demo path (§15)
8. Offline guarantee
9. Prototype limitations

State explicitly: *"This prototype simulates model outputs. It does not perform real ML inference."*

---

## 15. 3-Minute Demo Path

```text
Scenario 6 (SAFE, fast) → Scenario 1 (secret masked) → Scenario 2 (honeytoken blocked)
→ Scenario 3 (Org DNA, answer locally) → Scenario 4 (minimisation) → Scenario 5 (verification repair + rehydration)
→ Dashboard (honeytoken alert) → Feedback (approve Project Atlas) → Scenario 10 (now SAFE) → Benchmark
```

The demo must communicate: **Detect → Understand → Minimise → Mask → Verify → Preserve context → Send safely.**

Present VeilAI as: *"A local AI privacy firewall that understands sensitive organisational context, removes only what the task does not need, pseudonymises the rest while preserving context, verifies the transformed content locally, and sends only the privacy-preserving version to external AI."*

Not as: *"An AI that blocks sensitive information."*

---

## 16. Engineering Separation (do not collapse into one LLM call)

```text
QWEN (L5)        → UNDERSTAND   "What is sensitive in context?"
RULE ENGINE      → DETECT       "What matches known sensitive formats?"
FUSION           → COMBINE      "What is the final finding?"
POLICY ENGINE    → DECIDE       "What should be protected, and how?"
MINIMISATION     → REDUCE       "What does the task actually need?"
MASKING ENGINE   → TRANSFORM    "How to hide it while preserving context?"
VERIFIER         → CHECK        "Did every sensitive value actually disappear?"
EXTERNAL AI      → RECEIVE      "Only the safe version."
```

This separation improves explainability, control, reproducibility, latency, testing and security.

---

## 17. Definition of Done

- `npm run build` and `npm run preview` work with the network disabled
- Typecheck, lint and all tests pass
- All 10 scenarios work; the demo path runs flawlessly in Demo mode
- Masking is computed deterministically by `masking.ts`
- Verification catches the Scenario 5 variant leak naturally and repairs it
- Rehydration works; secrets are never restored into outbound text
- Honeytoken alert appears; Scenario 2 cannot be overridden
- Feedback approval makes Scenario 10 SAFE
- Benchmark numbers exactly match §9.5; no ensemble performance is invented
- The Benchmark screen is the only screen with real measured data

---

## 18. Start Here

1. Read `@docs/veilai_final_solution.md`, then this file.
2. Inspect the repository.
3. Present a **short implementation plan**: files, components, data structures, pipeline implementation, test strategy, phase order.
4. **Do not write code until the plan is approved.**
5. After approval, build all phases in order, running the §13 checks and committing after each. Don't stop between phases unless genuinely blocked.
