// Policy-as-code shown in the UI (design doc §11.5, §11.7). Simulated organisation policy.

export const NECESSITY_COLUMNS = ['Names', 'Contacts', 'Figures', 'Secrets', 'Internal hosts', 'Strategy text'] as const;

export const NECESSITY_MATRIX: Record<string, string[]> = {
  Summarise: ['Pseudonymise', 'Drop', 'Generalise', 'Drop', 'Drop', 'Keep, pseudonymised'],
  'Analyse data': ['Drop', 'Drop', 'Keep', 'Drop', 'Drop', 'Drop'],
  'Debug code': ['Drop', 'Drop', 'Keep', 'Always drop', 'Pseudonymise', 'Drop'],
  'Draft / rewrite': ['Pseudonymise', 'Drop', 'Generalise', 'Drop', 'Drop', 'Keep, pseudonymised'],
  Translate: ['Pseudonymise', 'Pseudonymise', 'Keep', 'Drop', 'Pseudonymise', 'Keep, pseudonymised'],
};

/** Maps the task analyser's label to a necessity-matrix row. */
export const TASK_TO_ROW: Record<string, string | null> = {
  Debugging: 'Debug code',
  'Data Analysis': 'Analyse data',
  Summarisation: 'Summarise',
  'Email Drafting': 'Draft / rewrite',
  'Document Analysis': 'Summarise',
  'Technical Explanation': null,
};

export const DESTINATION_MULTIPLIER: { match: RegExp; label: string; multiplier: number }[] = [
  { match: /enterprise/i, label: 'enterprise_ai', multiplier: 0.8 },
  { match: /free tier/i, label: 'free_tier_ai', multiplier: 1.3 },
  { match: /personal/i, label: 'unknown_ai (personal account)', multiplier: 1.5 },
  { match: /./, label: 'enterprise_ai', multiplier: 0.8 },
];

export const destinationOf = (tool: string) => DESTINATION_MULTIPLIER.find((d) => d.match.test(tool))!;

export const POLICY_YAML = `categories:
  CREDENTIALS:            {severity: CRITICAL, action: mask_never_restore}
  SECURITY:               {severity: HIGH,     action: pseudonymise}
  PERSONAL_INFORMATION:   {severity: MEDIUM,   action: minimise}
  CUSTOMER_INFORMATION:   {severity: HIGH,     action: minimise}
  CONFIDENTIAL_BUSINESS:  {severity: HIGH,     action: minimise}
  FINANCIAL:              {severity: HIGH,     action: minimise}
  INTELLECTUAL_PROPERTY:  {severity: MEDIUM,   action: pseudonymise}
honeytokens:              {severity: CRITICAL, action: block_alert, override: never}
combination_bonus:        [name+salary, customer+contract_value]
destinations:
  enterprise_ai:  {multiplier: 0.8}
  free_tier_ai:   {multiplier: 1.3}
  unknown_ai:     {multiplier: 1.5}`;
