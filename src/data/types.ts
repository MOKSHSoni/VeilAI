// Scenario data contract (build spec §5).
// `sanitisedText` is intentionally absent: it is computed at runtime by masking.ts.

export type RiskLevel = 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'REVIEW';

export type Category =
  | 'CREDENTIALS'
  | 'SECURITY'
  | 'PERSONAL_INFORMATION'
  | 'CUSTOMER_INFORMATION'
  | 'FINANCIAL'
  | 'CONFIDENTIAL_BUSINESS'
  | 'INTELLECTUAL_PROPERTY';

export type LayerId = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
export type LayerStatus = 'CLEAR' | 'FLAGGED' | 'SKIPPED';
export type Decision = 'SEND_SANITISED' | 'ANSWER_LOCALLY' | 'EDIT' | 'OVERRIDE' | 'BLOCK';
export type MinAction = 'KEPT' | 'DROPPED' | 'PSEUDONYMISED' | 'GENERALISED';

export const RISK_LEVELS: RiskLevel[] = ['SAFE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'REVIEW'];
export const CATEGORIES: Category[] = [
  'CREDENTIALS',
  'SECURITY',
  'PERSONAL_INFORMATION',
  'CUSTOMER_INFORMATION',
  'FINANCIAL',
  'CONFIDENTIAL_BUSINESS',
  'INTELLECTUAL_PROPERTY',
];
export const LAYER_IDS: LayerId[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
export const DECISIONS: Decision[] = ['SEND_SANITISED', 'ANSWER_LOCALLY', 'EDIT', 'OVERRIDE', 'BLOCK'];

export const LAYER_NAMES: Record<LayerId, string> = {
  L0: 'Honeytokens',
  L1: 'Deterministic rules',
  L2: 'Entity NER',
  L3: 'Org DNA',
  L4: 'Context signals',
  L5: 'Local Qwen',
};

export interface Finding {
  id: string;
  spanText: string; // exact text as it appears in content
  primaryCategory: Category;
  labels: Category[]; // multi-label, e.g. ['CREDENTIALS', 'SECURITY']
  entityType: string; // PERSON, CLIENT, SECRET, INTERNAL_HOST, DEAL_VALUE, PROJECT, ...
  layer: LayerId;
  confidence: number; // 0–1, detection confidence
  severity: RiskLevel; // impact, separate from confidence
  location?: string;
}

export interface LayerResult {
  layer: LayerId;
  status: LayerStatus;
  latencyMs: number; // simulated
  findingIds: string[];
  note: string;
}

export interface MinimisationItem {
  item: string;
  action: MinAction;
  reason: string;
  /** Links the action to a finding. KEPT findings are not masked. */
  findingId?: string;
  /** Structured data: the column this action applies to. */
  column?: string;
}

export interface SessionMessage {
  instruction: string;
  content: string;
  riskLevel: RiskLevel;
}

export interface Scenario {
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
  riskScore: number; // 0–100
  explanation: {
    found: string;
    where: string;
    evidence: string;
    whyItMatters: string;
    regulation: string;
    recommended: string;
  };
  minimisation: MinimisationItem[];
  minimisationSummary: string;
  simulatedAIReply?: string; // written with placeholders
  localAnswer?: string;
  defaultDecision: Decision;
  allowedDecisions: Decision[];
  blocked?: boolean;
  escalateToQwenReview?: boolean;
  qwenReviewNote?: string;
  structuredData?: { columns: string[]; rows: Record<string, string | number>[] };
  messages?: SessionMessage[];
  mosaicWarning?: string;
  stateVariants?: { whenAllowlisted: Partial<Scenario> };
  simulatedTotalMs: number;
}
