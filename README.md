# VeilAI: offline privacy firewall prototype

A clickable demo of VeilAI, a **local AI privacy firewall** that sits between an employee and an external AI service:

> A local AI privacy firewall that understands sensitive organisational context, removes only what the task does not need, pseudonymises the rest while preserving context, verifies the transformed content locally, and sends only the privacy-preserving version to external AI.

**This prototype simulates model outputs. It does not perform real ML inference.** The deterministic parts (rules, masking, verification, rehydration) run for real; see [What is simulated vs real](#what-is-simulated-vs-what-runs-for-real).

The product design is in [`docs/veilai_final_solution.md`](docs/veilai_final_solution.md) and the build spec in [`docs/build_spec.md`](docs/build_spec.md).

---

## 1. Requirements and installation

- **Node.js 20+** (tested on Node 22) and npm
- Windows, macOS or Linux. All scripts are cross-platform.

```bash
npm install
```

After `npm install`, nothing else is downloaded. The app uses system fonts only and makes no network requests.

## 2. Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload (http://localhost:5173) |
| `npm run build` | Type-checks, then builds to `dist/` |
| `npm run preview` | Serves the built `dist/` (http://localhost:4173) |
| `npm test` | Runs the Vitest suite (rules, masking, verification, rehydration, scenarios) |
| `npm run typecheck` | `tsc --noEmit` in strict mode |
| `npm run lint` | ESLint |

## 3. Editing scenarios

All scenario content is in **`src/data/scenarios.ts`**. Components contain no scenario-specific text. Each scenario follows the `Scenario` type in `src/data/types.ts`.

- **Inputs only.** `sanitisedText` is never stored. `masking.ts` computes it at runtime from `findings` + `minimisation`.
- **`findings[].spanText`** must appear verbatim in `content` (a test enforces this). Every occurrence is masked.
- **`minimisation[].findingId`**: an item marked `KEPT` is *not* masked (Scenario 5 keeps the salary). `DROPPED`, `PSEUDONYMISED` and `GENERALISED` findings become placeholders.
- **`structuredData`** + `minimisation[].column` drives column-level minimisation (Scenario 4).
- **`simulatedAIReply`** is written with placeholders such as `⟦EMP_01⟧`. For tables, `{{COUNT}}`, `{{SUM:col}}` and `{{AVG:col}}` are computed from the data at runtime.
- **`simulatedTotalMs`** is the displayed on-device total. Per-step latencies are derived from `layerResults`; the Decision step absorbs the remainder (a test checks it never goes negative).
- **`stateVariants.whenAllowlisted`** replaces fields once a finding's term is on the analyst allowlist (Scenario 10).

Placeholder prefixes come from `entityType` (`PERSON → EMP_01`, `CLIENT → CLIENT_A`, `SECRET → SECRET_1`, `INTERNAL_HOST → INTERNAL_HOST_1`, `DEAL_VALUE → DEAL_VALUE_1`, `PROJECT → PROJECT_01`; anything else uses its own name). Run `npm test` after editing: `tests/scenarios.test.ts` validates every scenario end to end.

Other simulated data: `src/data/dashboard.ts`, `feedback.ts`, `documentScan.ts` and `policy.ts`.

## 4. Editing benchmark numbers

**`src/data/benchmark.ts`** holds the only real measured data in the app (192 documents, Intel Core Ultra 5 125H, 16 GB RAM, CPU only).

- `OVERALL`, `BY_CATEGORY` and `LONG_DOCUMENT` hold the measured Qwen3 1.7B vs 4B results.
- `ABLATION`: steps 0–4 are measured (Qwen3 4B; scripts and raw results in `../model testing/privacy-benchmark/ablation/`). Steps 5–6 are `null` and render as **"To be measured"**. When a step is measured, replace `null` with a string such as `'61.2%'`. Do not add ensemble numbers that have not been measured.

## 5. Architecture overview

**Core principle: LLM for understanding. Deterministic code for masking. Deterministic verification for checking.**

```text
Understand → Identify sensitive information → Assess risk → Minimise unnecessary data
→ Mask what remains → Fast local verification → Send only the safe version to external AI
```

The Scan screen animates the 12-step pipeline:

1. **Capture**: instruction, content and destination tool are separated.
2. **Normalise**: zero-width characters, homoglyphs, spaced-out characters and base64 are decoded (`rules.ts`).
3. **Task Analysis**: the task picks a necessity-matrix row.
4. **Detection Ensemble**: L0 Honeytokens · L1 Rules · L2 NER · L3 Org DNA · L4 Context signals, plus **L5 local Qwen** behind a gating router.
5. **Fusion**: flag on any, clear on all, multi-label findings (CREDENTIALS ⇒ SECURITY), noisy-OR confidence.
6. **Policy + Risk**: risk level, risk score and detection confidence are kept separate.
7. **Exposure Explainer**: found · where · evidence · why it matters · regulation · recommended.
8. **Data Minimisation Engine**: KEPT / DROPPED / PSEUDONYMISED / GENERALISED.
9. **Context-preserving masking** (`masking.ts`): relationship-preserving placeholders, with the vault kept on the device.
10. **Fast local verification** (`verification.ts`): vault leaks, variants, rule re-scan, placeholder validity and mapping consistency; auto-repair once, otherwise REVIEW.
11. **Decision**: Send sanitised · Answer locally · Edit · Override with justification · Block, as policy allows.
12. **External AI / Local Answer / Block**, with **rehydration** (`rehydrate.ts`) of the reply on the device.

Engineering separation (these are deliberately not one LLM call):

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

### Code map

```text
src/
├── data/        types, scenarios (1–10), benchmark (real), dashboard, feedback, documentScan, policy
├── lib/
│   ├── rules.ts         L0 honeytokens (FNV-1a hash match) + L1 regex, Luhn, Verhoeff, normaliser
│   ├── masking.ts       deterministic placeholder replacement + table minimisation
│   ├── verification.ts  5 checks + one auto-repair round
│   ├── rehydrate.ts     tolerant placeholder restoration; secrets never restored
│   ├── pipeline.ts      runs one scenario through the real code and lays out step timings
│   ├── store.ts         in-memory allowlist, honeytoken alert, feedback state
│   └── demo.ts          Demo mode sequencer
├── components/  RiskBadge, LayerCard, PipelineStepper, DiffView (the "veil"), VaultPanel, ExplainerCard,
│                MinimisationView, VerificationChecks, DecisionBar, RehydrationView, Heatmap, KpiCard, …
└── screens/     Scan, DocumentScan, Dashboard, Feedback, Benchmark
```

## 6. What is simulated vs what runs for real

| Simulated (hardcoded scenario data, tagged `SIMULATED` in the UI) | Runs for real (deterministic code) |
|---|---|
| All model outputs: layer results, findings, confidence, fused scores, risk levels | `rules.ts`: regex detectors, Luhn, Verhoeff, honeytoken hash match, normaliser |
| Explanations, task types, AI replies, local answers | `masking.ts`: builds the sanitised text from findings and minimisation |
| Step latencies and totals | `verification.ts`: leak/variant/pattern checks and auto-repair |
| Dashboard metrics, feedback queue, regression gate, document pages | `rehydrate.ts`: restores placeholders in the reply |
| | `store.ts`: in-memory allowlist and alerts |

Scan screen steps show a **RUNS FOR REAL · file.ts** tag or a **SIMULATED** tag. The **Benchmark screen is the only screen with real measured numbers.**

Example of the real code at work: in Scenario 5 the finding lists only `"Rahul Mehta"`. `masking.ts` replaces that exact span, so `"Rahul's"` survives the first pass. `verification.ts` detects the first-name + possessive variant, adds `"Rahul"` to the vault under `⟦EMP_01⟧`, re-masks and passes. None of this is scripted.

## 7. The 3-minute demo path

Turn on **Demo mode** (top right of the Scan screen). It plays the path below with no typing (about 2m40s). The controls in the top bar pause, skip or stop it.

```text
Scenario 6 (SAFE, fast) → Scenario 1 (secret masked) → Scenario 2 (honeytoken blocked)
→ Scenario 3 (Org DNA, answer locally) → Scenario 4 (minimisation) → Scenario 5 (verification repair + rehydration)
→ Dashboard (honeytoken alert) → Feedback (approve Project Atlas) → Scenario 10 (now SAFE) → Benchmark
```

To present it manually:

1. **Scan → 06 Safe request → Send.** All layers are clear, L5 is skipped, and the total is under 100 ms.
2. **01 Debug with secret.** Secrets and the internal host veil into placeholders. The reply restores the host but keeps secrets masked.
3. **02 Honeytoken.** L0 hash match → CRITICAL → blocked. Only Block is enabled.
4. **03 Board acquisition.** 78% Org DNA match, L5 evidence quote. The default is **Answer locally**.
5. **04 Average customer spending.** Four columns are dropped and only `total_spend` leaves. The average is computed from the data.
6. **05 HR email.** Watch Verification: **fail → repair → pass**, then rehydration, including a mangled `⟦ emp_01 ⟧`.
7. **Admin Dashboard.** The honeytoken alert card and metadata-only events.
8. **Analyst Feedback → Project Atlas → False positive → gate PASS → Request approval → Approve.** Then **Re-run Scenario 10**, which is now SAFE.
9. **Benchmark.** Real measured results; the ablation is still "To be measured".

**Document Scan** shows the simulated board pack, and **Add file** (or drag and drop) scans your own text files (`.txt`, `.md`, `.csv`, `.json`, `.log`, `.yaml`, code, up to 1 MB) with the real `rules.ts`, page by page, in the browser. **Export report** downloads an HTML or JSON report with redacted evidence. PDF and Word files are not supported in the prototype.

The other scenarios: **07** mosaic session (three LOW messages add up to HIGH), **08** evasion (spaced-out key + base64 password, decoded), **09** REVIEW (escalated Qwen review; send sanitised, edit with live re-verification, or override with justification). The **Try your own text** tab runs the real rules on anything you paste.

## 8. Offline guarantee

- No backend, no external APIs, no CDN assets, no web fonts, no analytics. Everything is bundled into `dist/`.
- `npm run build && npm run preview` works with Wi-Fi disabled.
- Verified with request interception across all five screens: **zero requests leave `localhost`**.
- Searching `dist/` for `http` finds only inert strings: XML namespace identifiers (`http://www.w3.org/2000/svg`, required by SVG), URLs inside React's minified error messages, and Tailwind's licence comment. None is ever fetched.
- State lives in memory only (plus the theme choice in `localStorage`). Reloading resets the demo.

## 9. Prototype limitations

- **No real inference.** L2–L5 outputs, risk scores, explanations and AI replies are hardcoded per scenario. Free text in "Try your own text" gets only the real L0/L1 rules.
- Added files are scanned by L0/L1 rules only (no contextual layers); PDF/DOCX need a parser the prototype does not include.
- Rules are a representative subset (AWS/Stripe/GitHub/Google/Slack-style keys, passwords, emails, Indian mobiles, Aadhaar, PAN, cards, internal hosts), not a full gitleaks ruleset.
- Honeytoken hashing uses FNV-1a for the demo. The design calls for HMAC with an organisation secret.
- Dashboard numbers, the feedback regression gate and the document pages are illustrative.
- Ensemble performance is **not measured yet**. The ablation rows say so on purpose.
- No browser extension, persistence or authentication. Everything resets on reload.
- No AI-based privacy system can guarantee 100% detection; VeilAI's design relies on multiple layers, verification before release and REVIEW for uncertainty.
