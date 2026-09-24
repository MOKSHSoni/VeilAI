// All scenario content lives here. Every value is fictional and every "model" output is simulated.
// sanitised text is NOT stored: masking.ts computes it at runtime from these inputs.

import type { Finding, LayerId, LayerResult, LayerStatus, Scenario } from './types';
import { tableToCsv } from '../lib/masking';

const layer = (l: LayerId, status: LayerStatus, latencyMs: number, findingIds: string[], note: string): LayerResult => ({
  layer: l,
  status,
  latencyMs,
  findingIds,
  note,
});

// ---------------------------------------------------------------- 1 — Debug with secret

const s1Content = `import boto3
import psycopg2

AWS_ACCESS_KEY_ID = "AKIAQ7X3VEILDEMO4K2P"
DB_PASSWORD = "Tr0ub4dor&Falcon!"

conn = psycopg2.connect(
    host="pg-billing-01.corp.internal",
    port=5432,
    user="svc_billing",
    password=DB_PASSWORD,
    connect_timeout=3,
)
s3 = boto3.client("s3", aws_access_key_id=AWS_ACCESS_KEY_ID)

# psycopg2.OperationalError: could not connect to server: Connection timed out
#   Is the server running on host "pg-billing-01.corp.internal"
#   and accepting TCP/IP connections on port 5432?`;

const scenario1: Scenario = {
  id: 1,
  title: 'Debug with secret',
  instruction: 'Why does this connection fail?',
  content: s1Content,
  destinationTool: 'ChatGPT · free tier',
  taskType: 'Debugging',
  normalisationNotes: [],
  layerResults: [
    layer('L0', 'CLEAR', 0.3, [], 'No planted honeytoken hashes matched'),
    layer('L1', 'FLAGGED', 1.1, ['s1-key', 's1-pwd', 's1-host'], 'AWS key pattern, quoted password assignment, *.corp.internal host'),
    layer('L2', 'CLEAR', 38, [], 'No people or organisations in code'),
    layer('L3', 'CLEAR', 4.2, [], 'No Org DNA fingerprint match'),
    layer('L4', 'CLEAR', 12, [], 'Code/config detected; no business cues'),
    layer('L5', 'SKIPPED', 0, [], 'Skipped by gating router: chunk already CRITICAL from L1, action decided'),
  ],
  findings: [
    {
      id: 's1-key',
      spanText: 'AKIAQ7X3VEILDEMO4K2P',
      primaryCategory: 'CREDENTIALS',
      labels: ['CREDENTIALS', 'SECURITY'],
      entityType: 'SECRET',
      layer: 'L1',
      confidence: 0.99,
      severity: 'CRITICAL',
      location: 'Line 4',
    },
    {
      id: 's1-pwd',
      spanText: 'Tr0ub4dor&Falcon!',
      primaryCategory: 'CREDENTIALS',
      labels: ['CREDENTIALS', 'SECURITY'],
      entityType: 'SECRET',
      layer: 'L1',
      confidence: 0.97,
      severity: 'CRITICAL',
      location: 'Line 5',
    },
    {
      id: 's1-host',
      spanText: 'pg-billing-01.corp.internal',
      primaryCategory: 'SECURITY',
      labels: ['SECURITY'],
      entityType: 'INTERNAL_HOST',
      layer: 'L1',
      confidence: 0.93,
      severity: 'HIGH',
      location: 'Lines 8, 17',
    },
  ],
  fusion: {
    fusedConfidence: 0.99,
    labelHierarchyNote: 'CREDENTIALS ⇒ SECURITY: the key and the password carry both labels; primary label CREDENTIALS.',
  },
  riskLevel: 'CRITICAL',
  riskScore: 96,
  explanation: {
    found: 'A live-format AWS access key, a database password and an internal hostname',
    where: 'Lines 4, 5, 8 and 17 of the pasted code',
    evidence: 'AWS_ACCESS_KEY_ID = "AKIA…4K2P" · DB_PASSWORD = "Tr0u…" · host="pg-billing-01.corp…"',
    whyItMatters: 'Anyone who sees these can reach the billing database and the S3 account directly. Keys pasted into public AI tools cannot be recalled.',
    regulation: 'ISO 27001 A.5.17 (authentication information) · internal Secrets Handling Policy §3',
    recommended: 'Send the sanitised code. Secrets are replaced with inert placeholders and are never restored into the prompt. Rotate the key if it was shared anywhere else.',
  },
  minimisation: [
    { item: 'AWS access key', action: 'DROPPED', reason: 'Debugging never needs a real secret; replaced by an inert placeholder', findingId: 's1-key' },
    { item: 'Database password', action: 'DROPPED', reason: 'Secrets are always dropped for Debug tasks', findingId: 's1-pwd' },
    { item: 'Internal hostname', action: 'PSEUDONYMISED', reason: 'The error mentions the host, so its role is kept', findingId: 's1-host' },
    { item: 'Code logic, port, timeout, error trace', action: 'KEPT', reason: 'Required to diagnose the failure' },
  ],
  minimisationSummary: 'Removed 2 credentials and pseudonymised 1 internal host. Code logic and the error trace were kept for debugging.',
  simulatedAIReply: `The error is a network timeout, not an authentication failure: your client never reached ⟦INTERNAL_HOST_1⟧ on port 5432.

1. Check that you are on the VPN or inside the VPC. ⟦INTERNAL_HOST_1⟧ only resolves on the internal network.
2. Confirm the database security group allows inbound 5432 from your subnet.
3. connect_timeout=3 is aggressive for a cross-region hop. Try 10.

Separately, do not hard-code credentials. Load ⟦SECRET_2⟧ and ⟦SECRET_1⟧ from environment variables or a secrets manager.`,
  localAnswer:
    'On-device diagnosis: "Connection timed out" means the TCP handshake to the database host never completed. That usually points to the VPN, a security group or DNS, not the password. Check network reachability to port 5432 first.',
  defaultDecision: 'SEND_SANITISED',
  allowedDecisions: ['SEND_SANITISED', 'ANSWER_LOCALLY', 'EDIT', 'BLOCK'],
  simulatedTotalMs: 64,
};

// ---------------------------------------------------------------- 2 — Honeytoken

const scenario2: Scenario = {
  id: 2,
  title: 'Honeytoken tripwire',
  instruction: 'Can you tidy up this export config?',
  content: `# finance-reports/config/export.yaml
service: quarterly-export
region: ap-south-1
storage:
  bucket: fin-reports-archive
  access_token: HT-0042-7QX9VL3MZK81
schedule: "0 2 * * 1"
notify: finance-ops`,
  destinationTool: 'Gemini · personal account',
  taskType: 'Technical Explanation',
  normalisationNotes: [],
  layerResults: [
    layer('L0', 'FLAGGED', 0.3, ['s2-ht'], 'Hash match: honeytoken HT-0042 (planted in finance-reports repository config)'),
    layer('L1', 'FLAGGED', 1.1, ['s2-ht'], 'Token assignment pattern (access_token: …)'),
    layer('L2', 'CLEAR', 36, [], 'No people or organisations'),
    layer('L3', 'CLEAR', 4, [], 'No fingerprint match'),
    layer('L4', 'CLEAR', 14, [], 'Config file; no business cues'),
    layer('L5', 'SKIPPED', 0, [], 'Skipped by gating router: honeytoken is CRITICAL, action decided'),
  ],
  findings: [
    {
      id: 's2-ht',
      spanText: 'HT-0042-7QX9VL3MZK81',
      primaryCategory: 'CREDENTIALS',
      labels: ['CREDENTIALS', 'SECURITY'],
      entityType: 'HONEYTOKEN',
      layer: 'L0',
      confidence: 1,
      severity: 'CRITICAL',
      location: 'Line 6',
    },
  ],
  fusion: { fusedConfidence: 1, labelHierarchyNote: 'CREDENTIALS ⇒ SECURITY applied.' },
  riskLevel: 'CRITICAL',
  riskScore: 100,
  explanation: {
    found: 'Honeytoken HT-0042, a planted tripwire credential',
    where: 'Line 6: storage.access_token',
    evidence: 'access_token: HT-0042-••••••••',
    whyItMatters: 'This token exists only inside the finance-reports repository. Seeing it here means content was copied from a protected system. This is a security incident, not ordinary sensitive data.',
    regulation: 'Incident Response Policy §2 (tripwire alerts) · DPDP Act 2023 §8(5) reasonable security safeguards',
    recommended: 'Request blocked. The security team has been alerted with the token source. Override is not available.',
  },
  minimisation: [],
  minimisationSummary: 'Not applicable: honeytoken requests are blocked before minimisation.',
  defaultDecision: 'BLOCK',
  allowedDecisions: ['BLOCK'],
  blocked: true,
  simulatedTotalMs: 49,
};

// ---------------------------------------------------------------- 3 — Board acquisition

const scenario3: Scenario = {
  id: 3,
  title: 'Board acquisition',
  instruction: 'Summarise this update in two bullet points for my manager.',
  content: 'The board has approved negotiations with Acme Corp, expected to close in Q4 at a valuation near ₹420 Cr.',
  destinationTool: 'ChatGPT · free tier',
  taskType: 'Summarisation',
  normalisationNotes: [],
  layerResults: [
    layer('L0', 'CLEAR', 0.2, [], 'No honeytoken match'),
    layer('L1', 'CLEAR', 0.9, [], 'No keys, IDs or contact details'),
    layer('L2', 'FLAGGED', 42, ['s3-client'], 'Organisation entity: Acme Corp'),
    layer('L3', 'FLAGGED', 5.1, ['s3-deal'], 'Org DNA: 78% MinHash match with "Q3 Board Pack (Restricted)"'),
    layer('L4', 'FLAGGED', 18, ['s3-value'], 'Cue rules: "board has approved", currency near "valuation"'),
    layer('L5', 'FLAGGED', 3900, ['s3-deal'], 'Qwen: non-public acquisition. Verbatim evidence quote verified in chunk'),
  ],
  findings: [
    {
      id: 's3-deal',
      spanText: 'The board has approved negotiations with Acme Corp',
      primaryCategory: 'CONFIDENTIAL_BUSINESS',
      labels: ['CONFIDENTIAL_BUSINESS'],
      entityType: 'DEAL_EVENT',
      layer: 'L5',
      confidence: 0.84,
      severity: 'HIGH',
      location: 'Sentence 1',
    },
    {
      id: 's3-client',
      spanText: 'Acme Corp',
      primaryCategory: 'CONFIDENTIAL_BUSINESS',
      labels: ['CONFIDENTIAL_BUSINESS'],
      entityType: 'CLIENT',
      layer: 'L2',
      confidence: 0.91,
      severity: 'HIGH',
      location: 'Sentence 1',
    },
    {
      id: 's3-value',
      spanText: '₹420 Cr',
      primaryCategory: 'FINANCIAL',
      labels: ['FINANCIAL', 'CONFIDENTIAL_BUSINESS'],
      entityType: 'DEAL_VALUE',
      layer: 'L4',
      confidence: 0.88,
      severity: 'HIGH',
      location: 'Sentence 1',
    },
  ],
  fusion: { fusedConfidence: 0.97, labelHierarchyNote: 'Valuation carries FINANCIAL + CONFIDENTIAL_BUSINESS.' },
  riskLevel: 'HIGH',
  riskScore: 82,
  explanation: {
    found: 'A non-public acquisition: counterparty, timeline and valuation',
    where: 'Sentence 1. Also matches page 4 of "Q3 Board Pack (Restricted)"',
    evidence: '"The board has approved negotiations with Acme Corp…"',
    whyItMatters: 'Non-public transaction information. A leak could move deal terms or share price, and it counts as unpublished price-sensitive information.',
    regulation: 'SEBI (Prohibition of Insider Trading) Regulations 2015 · NDA with counterparty',
    recommended: 'Answer locally: a two-line summary does not need an external model. Sending the pseudonymised version is also allowed.',
  },
  minimisation: [
    { item: 'Counterparty name', action: 'PSEUDONYMISED', reason: 'The summary needs "a counterparty", not which one', findingId: 's3-client' },
    { item: 'Valuation', action: 'PSEUDONYMISED', reason: 'An exact figure is not needed for a two-line summary', findingId: 's3-value' },
    { item: 'Deal event and timeline (Q4)', action: 'KEPT', reason: 'This is what the summary is about', findingId: 's3-deal' },
  ],
  minimisationSummary: 'Pseudonymised the counterparty and the valuation. The event and timeline were kept for the summary.',
  simulatedAIReply: `• The board has approved negotiations with ⟦CLIENT_A⟧.
• Closing is expected in Q4, at a valuation of about ⟦DEAL_VALUE_1⟧.`,
  localAnswer: `• Leadership has approved acquisition talks with Acme Corp.
• Target close is Q4, at a valuation of roughly ₹420 Cr.`,
  defaultDecision: 'ANSWER_LOCALLY',
  allowedDecisions: ['ANSWER_LOCALLY', 'SEND_SANITISED', 'EDIT', 'OVERRIDE', 'BLOCK'],
  simulatedTotalMs: 3968,
};

// ---------------------------------------------------------------- 4 — Average customer spending

const s4Table = {
  columns: ['name', 'email', 'phone', 'city', 'total_spend'],
  rows: [
    { name: 'Aarav Sharma', email: 'aarav.sharma@example.com', phone: '9876543210', city: 'Pune', total_spend: 12400 },
    { name: 'Diya Patel', email: 'diya.patel@example.com', phone: '9123456780', city: 'Ahmedabad', total_spend: 8650 },
    { name: 'Kabir Rao', email: 'kabir.rao@example.com', phone: '9988776655', city: 'Bengaluru', total_spend: 15320 },
    { name: 'Ananya Iyer', email: 'ananya.iyer@example.com', phone: '9090909090', city: 'Chennai', total_spend: 6780 },
    { name: 'Vihaan Gupta', email: 'vihaan.gupta@example.com', phone: '8899001122', city: 'Delhi', total_spend: 21050 },
    { name: 'Isha Nair', email: 'isha.nair@example.com', phone: '7766554433', city: 'Kochi', total_spend: 9940 },
    { name: 'Arjun Menon', email: 'arjun.menon@example.com', phone: '9345678120', city: 'Hyderabad', total_spend: 13275 },
    { name: 'Meera Joshi', email: 'meera.joshi@example.com', phone: '8123456709', city: 'Jaipur', total_spend: 7185 },
  ],
};

const s4Findings: Finding[] = s4Table.rows.flatMap((r, i) => [
  {
    id: `s4-name-${i + 1}`,
    spanText: r.name,
    primaryCategory: 'CUSTOMER_INFORMATION' as const,
    labels: ['CUSTOMER_INFORMATION' as const, 'PERSONAL_INFORMATION' as const],
    entityType: 'CUSTOMER',
    layer: 'L2' as const,
    confidence: 0.94,
    severity: 'HIGH' as const,
    location: `Row ${i + 1}`,
  },
  {
    id: `s4-email-${i + 1}`,
    spanText: r.email,
    primaryCategory: 'CUSTOMER_INFORMATION' as const,
    labels: ['CUSTOMER_INFORMATION' as const, 'PERSONAL_INFORMATION' as const],
    entityType: 'EMAIL',
    layer: 'L1' as const,
    confidence: 0.99,
    severity: 'MEDIUM' as const,
    location: `Row ${i + 1}`,
  },
  {
    id: `s4-phone-${i + 1}`,
    spanText: r.phone,
    primaryCategory: 'CUSTOMER_INFORMATION' as const,
    labels: ['CUSTOMER_INFORMATION' as const, 'PERSONAL_INFORMATION' as const],
    entityType: 'PHONE',
    layer: 'L1' as const,
    confidence: 0.98,
    severity: 'MEDIUM' as const,
    location: `Row ${i + 1}`,
  },
]);

const scenario4: Scenario = {
  id: 4,
  title: 'Average customer spending',
  instruction: 'Calculate the average customer spending.',
  content: tableToCsv(s4Table),
  destinationTool: 'Copilot Chat',
  taskType: 'Data Analysis',
  normalisationNotes: [],
  layerResults: [
    layer('L0', 'CLEAR', 0.4, [], 'No honeytoken match'),
    layer('L1', 'FLAGGED', 2.3, s4Findings.filter((f) => f.layer === 'L1').map((f) => f.id), '8 emails and 8 Indian mobile numbers'),
    layer('L2', 'FLAGGED', 64, s4Findings.filter((f) => f.layer === 'L2').map((f) => f.id), '8 person names in the "name" column'),
    layer('L3', 'CLEAR', 6, [], 'Customer list hash: no exact match with CRM export'),
    layer('L4', 'CLEAR', 21, [], 'Tabular data; spend column is not a business secret'),
    layer('L5', 'SKIPPED', 0, [], 'Skipped by gating router: structured PII is fully covered by L1 + L2'),
  ],
  findings: s4Findings,
  fusion: { fusedConfidence: 0.99, labelHierarchyNote: 'CUSTOMER_INFORMATION ⇒ PERSONAL_INFORMATION applied to 24 values.' },
  riskLevel: 'HIGH',
  riskScore: 71,
  explanation: {
    found: 'A customer table with 8 names, 8 emails and 8 mobile numbers',
    where: 'Columns name, email, phone (rows 1–8)',
    evidence: 'name,email,phone,city,total_spend · "Aarav S…", "aarav.s…@example.com"',
    whyItMatters: 'Customer personal data sent to an external processor without a lawful purpose. The task only needs the spend figures.',
    regulation: 'DPDP Act 2023 §4 (lawful purpose) and §8 (data minimisation duties) · GDPR Art. 5(1)(c)',
    recommended: 'Send only the total_spend column. Everything else stays on this device.',
  },
  minimisation: [
    { item: 'name', column: 'name', action: 'DROPPED', reason: 'Not needed to compute an average' },
    { item: 'email', column: 'email', action: 'DROPPED', reason: 'Contact detail, not needed for the calculation' },
    { item: 'phone', column: 'phone', action: 'DROPPED', reason: 'Contact detail, not needed for the calculation' },
    { item: 'city', column: 'city', action: 'DROPPED', reason: 'Not requested. Quasi-identifier when combined with spend' },
    { item: 'total_spend', column: 'total_spend', action: 'KEPT', reason: '"spending" matches this column; it is the only data the task needs' },
  ],
  minimisationSummary: 'Removed 4 columns (32 values, including 16 contact details) not needed for this task. Only total_spend is sent.',
  structuredData: s4Table,
  simulatedAIReply: 'Across the {{COUNT}} rows, the total spend is ₹{{SUM:total_spend}}, so the average customer spending is ₹{{AVG:total_spend}}.',
  localAnswer: 'Average of total_spend over {{COUNT}} rows: ₹{{AVG:total_spend}}.',
  defaultDecision: 'SEND_SANITISED',
  allowedDecisions: ['SEND_SANITISED', 'ANSWER_LOCALLY', 'EDIT', 'OVERRIDE', 'BLOCK'],
  simulatedTotalMs: 95,
};

// ---------------------------------------------------------------- 5 — HR email (verification repair)

const scenario5: Scenario = {
  id: 5,
  title: 'HR email',
  instruction: 'Help me write this HR email.',
  content: "Draft an email telling Rahul Mehta his salary goes to ₹18.5 LPA. Mention that Rahul's performance review was the reason.",
  destinationTool: 'ChatGPT · free tier',
  taskType: 'Email Drafting',
  normalisationNotes: [],
  layerResults: [
    layer('L0', 'CLEAR', 0.2, [], 'No honeytoken match'),
    layer('L1', 'CLEAR', 0.8, [], 'No keys, IDs or contact details'),
    layer('L2', 'FLAGGED', 35, ['s5-name'], 'Person entity: Rahul Mehta'),
    layer('L3', 'CLEAR', 3.8, [], 'Not in Org DNA dictionaries'),
    layer('L4', 'FLAGGED', 11, ['s5-salary'], 'Cue rule: currency near "salary"; name + salary combination'),
    layer('L5', 'FLAGGED', 3100, ['s5-salary'], 'Qwen: individual compensation change. Evidence quote verified'),
  ],
  findings: [
    {
      id: 's5-name',
      spanText: 'Rahul Mehta',
      primaryCategory: 'PERSONAL_INFORMATION',
      labels: ['PERSONAL_INFORMATION'],
      entityType: 'PERSON',
      layer: 'L2',
      confidence: 0.95,
      severity: 'MEDIUM',
      location: 'Sentence 1',
    },
    {
      id: 's5-salary',
      spanText: '₹18.5 LPA',
      primaryCategory: 'PERSONAL_INFORMATION',
      labels: ['PERSONAL_INFORMATION', 'FINANCIAL'],
      entityType: 'SALARY',
      layer: 'L4',
      confidence: 0.9,
      severity: 'MEDIUM',
      location: 'Sentence 1',
    },
  ],
  fusion: { fusedConfidence: 0.98, labelHierarchyNote: 'Combination bonus: name + salary scores higher than either alone (MEDIUM + MEDIUM → HIGH).' },
  riskLevel: 'HIGH',
  riskScore: 74,
  explanation: {
    found: "A named employee's salary and performance outcome",
    where: 'Sentences 1 and 2',
    evidence: '"…telling Rahul M… his salary goes to ₹18.5 LPA"',
    whyItMatters: 'Compensation linked to a named person is personal data. Performance reviews are confidential HR records.',
    regulation: 'DPDP Act 2023 §8 · Internal HR Confidentiality Policy §4.2',
    recommended: 'Send with the name pseudonymised. The salary is kept because the email exists to state it.',
  },
  minimisation: [
    { item: 'Employee name', action: 'PSEUDONYMISED', reason: 'The AI only needs to know it is addressing one employee', findingId: 's5-name' },
    { item: 'New salary (₹18.5 LPA)', action: 'KEPT', reason: 'The purpose of the email is to state the new salary', findingId: 's5-salary' },
    { item: 'Performance review reference', action: 'KEPT', reason: 'Needed for the reason sentence; no detail included' },
  ],
  minimisationSummary: 'Pseudonymised 1 person. The salary was kept because the task needs it.',
  simulatedAIReply: `Subject: Your revised compensation

Dear ⟦EMP_01⟧,

I'm pleased to let you know that your annual salary will be revised to ₹18.5 LPA, effective from the next payroll cycle.

This change reflects ⟦EMP_01⟧'s excellent performance review this year. Thank you for the impact you have made on the team.

Congratulations, ⟦ emp_01 ⟧. Please reach out if you have any questions.

Warm regards,
HR Team`,
  defaultDecision: 'SEND_SANITISED',
  allowedDecisions: ['SEND_SANITISED', 'ANSWER_LOCALLY', 'EDIT', 'OVERRIDE', 'BLOCK'],
  localAnswer: 'Draft (on device): "Dear Rahul Mehta, your salary will be revised to ₹18.5 LPA, reflecting your strong performance review. Congratulations."',
  simulatedTotalMs: 3170,
};

// ---------------------------------------------------------------- 6 — Safe request

const scenario6: Scenario = {
  id: 6,
  title: 'Safe request',
  instruction: 'Explain the difference between TCP and UDP.',
  content: '',
  destinationTool: 'ChatGPT · free tier',
  taskType: 'Technical Explanation',
  normalisationNotes: [],
  layerResults: [
    layer('L0', 'CLEAR', 0.2, [], 'No honeytoken match'),
    layer('L1', 'CLEAR', 0.8, [], 'No patterns'),
    layer('L2', 'CLEAR', 31, [], 'No entities'),
    layer('L3', 'CLEAR', 3, [], 'No Org DNA match'),
    layer('L4', 'CLEAR', 12, [], 'No context cues'),
    layer('L5', 'SKIPPED', 0, [], 'Skipped by gating router: no cues, no uncertainty'),
  ],
  findings: [],
  fusion: { fusedConfidence: 0.02 },
  riskLevel: 'SAFE',
  riskScore: 2,
  explanation: {
    found: 'Nothing sensitive',
    where: 'n/a',
    evidence: 'All six layers clear',
    whyItMatters: 'General technical question with no organisational data.',
    regulation: 'None applicable',
    recommended: 'Send unchanged.',
  },
  minimisation: [],
  minimisationSummary: 'Nothing to minimise. Sent unchanged.',
  simulatedAIReply: `TCP is connection-oriented: it sets up a session with a handshake, guarantees ordered delivery, retransmits lost packets and controls congestion. Good for web pages, email and file transfer.

UDP is connectionless: it sends independent datagrams with no delivery or ordering guarantees and very little overhead. Good for video calls, gaming, DNS and streaming, where low latency matters more than perfect delivery.`,
  defaultDecision: 'SEND_SANITISED',
  allowedDecisions: ['SEND_SANITISED', 'ANSWER_LOCALLY', 'EDIT'],
  simulatedTotalMs: 58,
};

// ---------------------------------------------------------------- 7 — Mosaic session

const s7Messages = [
  { instruction: 'Draft a polite follow-up email.', content: 'Follow up with Northwind Traders about the renewal.', riskLevel: 'LOW' as const },
  { instruction: 'Is this a big deal for a mid-size firm?', content: 'The renewal is worth about ₹12 Cr.', riskLevel: 'LOW' as const },
  { instruction: 'Help me plan the timeline.', content: 'We expect to sign by 15 November.', riskLevel: 'LOW' as const },
];

const scenario7: Scenario = {
  id: 7,
  title: 'Mosaic session',
  instruction: 'Help me plan the timeline.',
  content: s7Messages.map((m) => m.content).join('\n'),
  destinationTool: 'ChatGPT · free tier',
  taskType: 'Email Drafting',
  normalisationNotes: [],
  layerResults: [
    layer('L0', 'CLEAR', 0.2, [], 'No honeytoken match'),
    layer('L1', 'CLEAR', 0.7, [], 'No patterns'),
    layer('L2', 'FLAGGED', 33, ['s7-client'], 'Organisation entity: Northwind Traders'),
    layer('L3', 'FLAGGED', 3.4, ['s7-client'], 'Client dictionary hit: Northwind Traders (active account)'),
    layer('L4', 'FLAGGED', 13, ['s7-value', 's7-date'], 'Session cues: deal value + closing date for the same client'),
    layer('L5', 'SKIPPED', 0, [], 'Skipped by gating router: session mosaic rule already decides'),
  ],
  findings: [
    {
      id: 's7-client',
      spanText: 'Northwind Traders',
      primaryCategory: 'CONFIDENTIAL_BUSINESS',
      labels: ['CONFIDENTIAL_BUSINESS', 'CUSTOMER_INFORMATION'],
      entityType: 'CLIENT',
      layer: 'L3',
      confidence: 0.9,
      severity: 'LOW',
      location: 'Message 1',
    },
    {
      id: 's7-value',
      spanText: '₹12 Cr',
      primaryCategory: 'FINANCIAL',
      labels: ['FINANCIAL', 'CONFIDENTIAL_BUSINESS'],
      entityType: 'DEAL_VALUE',
      layer: 'L4',
      confidence: 0.82,
      severity: 'LOW',
      location: 'Message 2',
    },
    {
      id: 's7-date',
      spanText: '15 November',
      primaryCategory: 'CONFIDENTIAL_BUSINESS',
      labels: ['CONFIDENTIAL_BUSINESS'],
      entityType: 'CLOSING_DATE',
      layer: 'L4',
      confidence: 0.71,
      severity: 'LOW',
      location: 'Message 3',
    },
  ],
  fusion: { fusedConfidence: 0.93, labelHierarchyNote: 'Mosaic budget exceeded: client + value + date across one session.' },
  riskLevel: 'HIGH',
  riskScore: 78,
  explanation: {
    found: 'Client, deal size and closing date, spread across three messages',
    where: 'Messages 1, 2 and 3 of this session',
    evidence: '"Northwind Traders" · "₹12 Cr" · "15 November"',
    whyItMatters: 'Each message is harmless alone. Together they reveal a confidential renewal: who, how much and when.',
    regulation: 'Customer NDA · Internal Sales Confidentiality Policy §2',
    recommended: 'Send the third message sanitised, and pseudonymise the client for the rest of this session.',
  },
  minimisation: [
    { item: 'Client name', action: 'PSEUDONYMISED', reason: 'The timeline does not depend on which client', findingId: 's7-client' },
    { item: 'Deal value', action: 'GENERALISED', reason: 'Scale matters, the exact figure does not', findingId: 's7-value' },
    { item: 'Closing date', action: 'KEPT', reason: 'The timeline task needs the target date', findingId: 's7-date' },
  ],
  minimisationSummary: 'Pseudonymised the client and generalised the deal value across the session. The date was kept for planning.',
  messages: s7Messages,
  mosaicWarning: "Across this session you've shared the client, deal size and closing date.",
  simulatedAIReply: `Working back from 15 November for ⟦CLIENT_A⟧:
• 1 Nov: final commercial terms agreed (⟦DEAL_VALUE_1⟧)
• 6 Nov: legal redlines closed
• 11 Nov: internal approvals
• 15 Nov: signature`,
  defaultDecision: 'SEND_SANITISED',
  allowedDecisions: ['SEND_SANITISED', 'ANSWER_LOCALLY', 'EDIT', 'OVERRIDE', 'BLOCK'],
  simulatedTotalMs: 70,
};

// ---------------------------------------------------------------- 8 — Evasion attempt

const s8Spaced = 's k _ l i v e _ 4 e C 3 9 H q L y j W D a r j t T 1 z d p 7 d c';
const s8B64 = 'VmVpbERlbW8hUGFzc3cwcmQ=';

const scenario8: Scenario = {
  id: 8,
  title: 'Evasion attempt',
  instruction: 'Why does the deploy script reject this key?',
  content: `# staging deploy notes
PAYMENTS_KEY = ${s8Spaced}
db_pass_b64: ${s8B64}
endpoint: api.payments.example/v1/charges`,
  destinationTool: 'Claude · free tier',
  taskType: 'Debugging',
  normalisationNotes: [
    { before: s8Spaced, after: 'sk_live_4eC39HqLyjWDarjtT1zdp7dc', method: 'Collapse spaced-out characters' },
    { before: s8B64, after: 'VeilDemo!Passw0rd', method: 'Decode base64' },
  ],
  layerResults: [
    layer('L0', 'CLEAR', 0.3, [], 'No honeytoken match (checked after normalisation)'),
    layer('L1', 'FLAGGED', 1.4, ['s8-key', 's8-pwd'], 'After normalisation: live API key pattern + password assignment'),
    layer('L2', 'CLEAR', 29, [], 'No entities'),
    layer('L3', 'CLEAR', 3.1, [], 'No Org DNA match'),
    layer('L4', 'CLEAR', 10, [], 'Config text; instruction-like evasion noted'),
    layer('L5', 'SKIPPED', 0, [], 'Skipped by gating router: already CRITICAL from L1'),
  ],
  findings: [
    {
      id: 's8-key',
      spanText: s8Spaced,
      primaryCategory: 'CREDENTIALS',
      labels: ['CREDENTIALS', 'SECURITY'],
      entityType: 'SECRET',
      layer: 'L1',
      confidence: 0.98,
      severity: 'CRITICAL',
      location: 'Line 2',
    },
    {
      id: 's8-pwd',
      spanText: s8B64,
      primaryCategory: 'CREDENTIALS',
      labels: ['CREDENTIALS', 'SECURITY'],
      entityType: 'SECRET',
      layer: 'L1',
      confidence: 0.95,
      severity: 'CRITICAL',
      location: 'Line 3',
    },
  ],
  fusion: { fusedConfidence: 0.99, labelHierarchyNote: 'CREDENTIALS ⇒ SECURITY applied to both secrets.' },
  riskLevel: 'CRITICAL',
  riskScore: 95,
  explanation: {
    found: 'A live payments API key hidden with spaces, and a base64-encoded password',
    where: 'Lines 2 and 3',
    evidence: 'Normalised: sk_live_4eC3… · base64 → "Veil…"',
    whyItMatters: 'Obfuscation does not make a secret safe. A spaced-out key is trivially reassembled by anyone who reads it. The evasion attempt is itself a signal.',
    regulation: 'PCI-DSS v4.0 Req. 8.3 · internal Secrets Handling Policy §3',
    recommended: 'Send the sanitised version. Both secrets become inert placeholders.',
  },
  minimisation: [
    { item: 'Payments API key (obfuscated)', action: 'DROPPED', reason: 'Secrets are always dropped for Debug tasks', findingId: 's8-key' },
    { item: 'Database password (base64)', action: 'DROPPED', reason: 'Secrets are always dropped for Debug tasks', findingId: 's8-pwd' },
    { item: 'Public API endpoint', action: 'KEPT', reason: 'Needed to reason about live vs test mode' },
  ],
  minimisationSummary: 'Removed 2 obfuscated credentials. The endpoint and structure were kept for debugging.',
  simulatedAIReply: `⟦SECRET_1⟧ has a live-mode prefix, but the script targets a staging environment. Most payment gateways reject live keys on test endpoints. Use the matching test-mode key for staging.

Also, base64 is encoding, not encryption. ⟦SECRET_2⟧ should come from a secrets manager.`,
  defaultDecision: 'SEND_SANITISED',
  allowedDecisions: ['SEND_SANITISED', 'ANSWER_LOCALLY', 'EDIT', 'BLOCK'],
  simulatedTotalMs: 66,
};

// ---------------------------------------------------------------- 9 — Uncertain → REVIEW

const scenario9: Scenario = {
  id: 9,
  title: 'Uncertain → Review',
  instruction: 'Turn this into a short slide outline.',
  content:
    "Heads-up for the team: we're moving to the new pricing approach for next year, with tiered bundles instead of per-seat and a floor for smaller accounts. Please keep this within the team for now.",
  destinationTool: 'ChatGPT · free tier',
  taskType: 'Summarisation',
  normalisationNotes: [],
  layerResults: [
    layer('L0', 'CLEAR', 0.2, [], 'No honeytoken match'),
    layer('L1', 'CLEAR', 0.8, [], 'No patterns'),
    layer('L2', 'CLEAR', 34, [], 'No entities'),
    layer('L3', 'CLEAR', 3.6, [], 'No fingerprint match (possibly a new document)'),
    layer('L4', 'FLAGGED', 15, ['s9-plan'], 'Weak cues: "pricing", "keep this within the team" (p = 0.46)'),
    layer('L5', 'FLAGGED', 4600, ['s9-detail'], 'Qwen uncertain (0.52): could be announced strategy or internal plan'),
  ],
  findings: [
    {
      id: 's9-plan',
      spanText: 'the new pricing approach for next year',
      primaryCategory: 'CONFIDENTIAL_BUSINESS',
      labels: ['CONFIDENTIAL_BUSINESS'],
      entityType: 'PLAN',
      layer: 'L4',
      confidence: 0.46,
      severity: 'MEDIUM',
      location: 'Sentence 1',
    },
    {
      id: 's9-detail',
      spanText: 'tiered bundles instead of per-seat',
      primaryCategory: 'CONFIDENTIAL_BUSINESS',
      labels: ['CONFIDENTIAL_BUSINESS', 'FINANCIAL'],
      entityType: 'PRICING_DETAIL',
      layer: 'L5',
      confidence: 0.52,
      severity: 'MEDIUM',
      location: 'Sentence 1',
    },
  ],
  fusion: { fusedConfidence: 0.55, labelHierarchyNote: 'Layers disagree (L4 weak, L5 uncertain, L3 clear). Asymmetric consensus: uncertain is never SAFE.' },
  riskLevel: 'REVIEW',
  riskScore: 52,
  explanation: {
    found: 'Possibly unannounced pricing strategy',
    where: 'Sentence 1',
    evidence: '"…moving to the new pricing approach for next year, with tiered bundles…"',
    whyItMatters: 'If this is unannounced, competitors could use it. If it is already public, sending it is fine. The layers cannot tell which.',
    regulation: 'Internal Information Classification Policy (Confidential tier)',
    recommended: 'Send the sanitised version, edit the text, or override with a written justification.',
  },
  minimisation: [
    { item: 'Pricing mechanics', action: 'GENERALISED', reason: 'The slide outline works with "a new pricing model"', findingId: 's9-detail' },
    { item: 'Timing (next year)', action: 'KEPT', reason: 'General and needed for the outline', findingId: 's9-plan' },
  ],
  minimisationSummary: 'Generalised the specific pricing mechanics. The overall message was kept.',
  escalateToQwenReview: true,
  qwenReviewNote: 'Escalated Qwen review (exception path, ambiguous cases only): still inconclusive (0.51). No public source in Org DNA to confirm the plan is announced.',
  simulatedAIReply: `Slide: Pricing changes for next year
• What: moving to a new pricing approach (⟦PRICING_DETAIL_1⟧)
• Why: simpler buying for growing accounts
• Protection: a floor for smaller accounts
• Status: internal, not yet announced`,
  defaultDecision: 'SEND_SANITISED',
  allowedDecisions: ['SEND_SANITISED', 'EDIT', 'OVERRIDE'],
  simulatedTotalMs: 8880,
};

// ---------------------------------------------------------------- 10 — Project Atlas

const scenario10: Scenario = {
  id: 10,
  title: 'Project Atlas',
  instruction: 'Summarise the public launch blog for Project Atlas.',
  content:
    "Today we're excited to launch Project Atlas, our open route-planning toolkit for logistics teams. Project Atlas is free for up to 5 users and available now on our website.",
  destinationTool: 'Gemini · personal account',
  taskType: 'Summarisation',
  normalisationNotes: [],
  layerResults: [
    layer('L0', 'CLEAR', 0.2, [], 'No honeytoken match'),
    layer('L1', 'CLEAR', 0.7, [], 'No patterns'),
    layer('L2', 'CLEAR', 30, [], 'No people or organisations'),
    layer('L3', 'FLAGGED', 3.2, ['s10-proj'], 'Codename dictionary hit: "Project Atlas"'),
    layer('L4', 'CLEAR', 11, [], 'Public-launch language; no confidentiality cues'),
    layer('L5', 'SKIPPED', 0, [], 'Skipped by gating router: exact dictionary hit, no ambiguity'),
  ],
  findings: [
    {
      id: 's10-proj',
      spanText: 'Project Atlas',
      primaryCategory: 'INTELLECTUAL_PROPERTY',
      labels: ['INTELLECTUAL_PROPERTY', 'CONFIDENTIAL_BUSINESS'],
      entityType: 'PROJECT',
      layer: 'L3',
      confidence: 0.72,
      severity: 'MEDIUM',
      location: 'Sentences 1–2',
    },
  ],
  fusion: { fusedConfidence: 0.72 },
  riskLevel: 'MEDIUM',
  riskScore: 45,
  explanation: {
    found: 'Internal codename "Project Atlas"',
    where: 'Sentences 1 and 2',
    evidence: '"…launch Project Atlas, our open route-planning toolkit…"',
    whyItMatters: 'Codenames in the Org DNA dictionary are treated as internal until an analyst says otherwise.',
    regulation: 'Internal Information Classification Policy',
    recommended: 'Send with the codename pseudonymised. If this is public, report a false positive.',
  },
  minimisation: [{ item: 'Project codename', action: 'PSEUDONYMISED', reason: 'The summary does not depend on the name', findingId: 's10-proj' }],
  minimisationSummary: 'Pseudonymised 1 project codename.',
  simulatedAIReply: '⟦PROJECT_01⟧ is a newly launched, open route-planning toolkit for logistics teams. It is free for up to 5 users and available now.',
  defaultDecision: 'SEND_SANITISED',
  allowedDecisions: ['SEND_SANITISED', 'ANSWER_LOCALLY', 'EDIT', 'OVERRIDE', 'BLOCK'],
  simulatedTotalMs: 61,
  stateVariants: {
    whenAllowlisted: {
      layerResults: [
        layer('L0', 'CLEAR', 0.2, [], 'No honeytoken match'),
        layer('L1', 'CLEAR', 0.7, [], 'No patterns'),
        layer('L2', 'CLEAR', 30, [], 'No people or organisations'),
        layer('L3', 'CLEAR', 3.2, [], '"Project Atlas" is on the allowlist (analyst-approved, v2)'),
        layer('L4', 'CLEAR', 11, [], 'Public-launch language; no confidentiality cues'),
        layer('L5', 'SKIPPED', 0, [], 'Skipped by gating router: no cues, no uncertainty'),
      ],
      findings: [],
      fusion: { fusedConfidence: 0.03 },
      riskLevel: 'SAFE',
      riskScore: 4,
      explanation: {
        found: 'Nothing sensitive',
        where: 'n/a',
        evidence: '"Project Atlas" allowlisted after analyst review',
        whyItMatters: 'Public product launch. Adaptive Detection learned this from analyst feedback.',
        regulation: 'None applicable',
        recommended: 'Send unchanged.',
      },
      minimisation: [],
      minimisationSummary: 'Nothing to minimise. Sent unchanged.',
      simulatedAIReply: 'Project Atlas is a newly launched, open route-planning toolkit for logistics teams. It is free for up to 5 users and available now.',
      defaultDecision: 'SEND_SANITISED',
      allowedDecisions: ['SEND_SANITISED', 'ANSWER_LOCALLY', 'EDIT'],
      simulatedTotalMs: 57,
    },
  },
};

export const SCENARIOS: Scenario[] = [
  scenario1,
  scenario2,
  scenario3,
  scenario4,
  scenario5,
  scenario6,
  scenario7,
  scenario8,
  scenario9,
  scenario10,
];

export const getScenario = (id: number): Scenario => {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scenario ${id}`);
  return s;
};

/** 3-minute demo path (build spec §15). */
export const DEMO_PATH: number[] = [6, 1, 2, 3, 4, 5];
