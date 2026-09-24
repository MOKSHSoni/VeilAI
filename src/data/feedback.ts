// Simulated analyst feedback queue. Evidence snippets are redacted: never full prompts.

import type { Category, RiskLevel } from './types';

export interface FeedbackItem {
  id: string;
  term?: string; // term proposed for the allowlist on a false positive
  category: Category;
  severity: RiskLevel;
  layer: string;
  snippet: string; // redacted
  reason: string;
  reportedBy: string;
  department: string;
  /** CRITICAL categories (secrets, honeytokens) can never be suppressed by feedback. */
  suppressible: boolean;
  lockReason?: string;
  proposedUpdate?: string;
  regressionGate?: string;
}

export const FEEDBACK_QUEUE: FeedbackItem[] = [
  {
    id: 'fb-atlas',
    term: 'Project Atlas',
    category: 'INTELLECTUAL_PROPERTY',
    severity: 'MEDIUM',
    layer: 'L3 Org DNA · codename dictionary',
    snippet: '"…excited to launch ███████ █████, our open route-planning toolkit…"',
    reason: 'User reported: "This is our public product, launched last month."',
    reportedBy: 'u_31fd6c84',
    department: 'Marketing',
    suppressible: true,
    proposedUpdate: 'Add "Project Atlas" to the allowlist (dictionary v2)',
    regressionGate: 'Benchmark recall unchanged (45.6% → 45.6%). PASS',
  },
  {
    id: 'fb-secret',
    category: 'CREDENTIALS',
    severity: 'CRITICAL',
    layer: 'L1 Deterministic · AWS key pattern',
    snippet: 'AWS_ACCESS_KEY_ID = "AKIA████████████"',
    reason: 'User reported: "It is only a test key."',
    reportedBy: 'u_7f3a91c2',
    department: 'Engineering',
    suppressible: false,
    lockReason: 'Secrets are a CRITICAL category. Feedback cannot suppress them, so "test" keys are masked like real ones.',
  },
  {
    id: 'fb-honey',
    category: 'CREDENTIALS',
    severity: 'CRITICAL',
    layer: 'L0 Honeytokens',
    snippet: '"access_token: HT-████-████████"',
    reason: 'User reported: "Just a config file."',
    reportedBy: 'u_4c0f8e3b',
    department: 'Finance',
    suppressible: false,
    lockReason: 'Honeytoken matches are security incidents. They cannot be suppressed or allowlisted.',
  },
  {
    id: 'fb-margin',
    category: 'FINANCIAL',
    severity: 'MEDIUM',
    layer: 'L4 Context signals (missed)',
    snippet: '"…gross margin on the ██████ line dipped to ██% this quarter…"',
    reason: 'Analyst spotted a miss: margin figures sent unmasked.',
    reportedBy: 'analyst',
    department: 'Finance',
    suppressible: true,
    proposedUpdate: 'Add cue rule: percentage near "gross margin" → FINANCIAL',
    regressionGate: 'Benchmark recall +0.7 pts, FPR unchanged. PASS',
  },
  {
    id: 'fb-city',
    category: 'PERSONAL_INFORMATION',
    severity: 'LOW',
    layer: 'L2 Entity NER',
    snippet: '"…meet at the ████ office near ███████…"',
    reason: 'Low-severity location mention flagged correctly.',
    reportedBy: 'u_e6b2079d',
    department: 'Legal',
    suppressible: true,
  },
];
