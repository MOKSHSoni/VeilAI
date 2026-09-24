// Simulated Document Scan: Q3_Board_Pack.pdf (10 pages). All fictional.

import type { Category, LayerId, RiskLevel } from './types';

export interface PageFinding {
  category: Category;
  entityType: string;
  evidence: string;
  layer: LayerId;
  confidence: number;
}

export interface DocPage {
  page: number;
  title: string;
  level: RiskLevel;
  l5Ran: boolean;
  latencyMs: number;
  findings: PageFinding[];
}

export const DOCUMENT = {
  fileName: 'Q3_Board_Pack.pdf',
  pages: 10,
  sizeKb: 842,
  gatingNote: 'L5 ran on only 3 of 10 pages because of the gating router.',
  minimisationNote: 'For "summarise the financial highlights", pages 7–8 (HR appendix) and page 10 would be dropped entirely.',
};

export const DOC_PAGES: DocPage[] = [
  { page: 1, title: 'Cover & agenda', level: 'SAFE', l5Ran: false, latencyMs: 41, findings: [] },
  {
    page: 2,
    title: 'Q3 financial summary',
    level: 'HIGH',
    l5Ran: false,
    latencyMs: 58,
    findings: [
      { category: 'FINANCIAL', entityType: 'REVENUE', evidence: '"Q3 revenue ₹1,2██ Cr, up 1█% YoY…"', layer: 'L4', confidence: 0.91 },
      { category: 'FINANCIAL', entityType: 'MARGIN', evidence: '"EBITDA margin █.█%…"', layer: 'L4', confidence: 0.86 },
    ],
  },
  {
    page: 3,
    title: 'Segment performance',
    level: 'MEDIUM',
    l5Ran: false,
    latencyMs: 52,
    findings: [{ category: 'FINANCIAL', entityType: 'SEGMENT_FIGURES', evidence: '"Logistics segment ₹3██ Cr…"', layer: 'L4', confidence: 0.74 }],
  },
  {
    page: 4,
    title: 'Strategic transactions',
    level: 'CRITICAL',
    l5Ran: true,
    latencyMs: 4120,
    findings: [
      { category: 'CONFIDENTIAL_BUSINESS', entityType: 'DEAL_EVENT', evidence: '"The board has approved negotiations with A███ C███…"', layer: 'L5', confidence: 0.84 },
      { category: 'FINANCIAL', entityType: 'DEAL_VALUE', evidence: '"…valuation near ₹4██ Cr"', layer: 'L4', confidence: 0.88 },
      { category: 'CONFIDENTIAL_BUSINESS', entityType: 'ORG_DNA', evidence: 'Fingerprint: "Q3 Board Pack (Restricted)", 100%', layer: 'L3', confidence: 0.99 },
    ],
  },
  {
    page: 5,
    title: 'Product roadmap',
    level: 'HIGH',
    l5Ran: true,
    latencyMs: 3870,
    findings: [
      { category: 'INTELLECTUAL_PROPERTY', entityType: 'PROJECT', evidence: '"Project F█████ enters pilot in…"', layer: 'L3', confidence: 0.92 },
      { category: 'INTELLECTUAL_PROPERTY', entityType: 'UNRELEASED', evidence: '"unreleased routing algorithm…"', layer: 'L5', confidence: 0.77 },
    ],
  },
  {
    page: 6,
    title: 'Market overview',
    level: 'LOW',
    l5Ran: true,
    latencyMs: 3650,
    findings: [{ category: 'CONFIDENTIAL_BUSINESS', entityType: 'COMPETITOR', evidence: '"competitor pricing (public sources)…"', layer: 'L5', confidence: 0.38 }],
  },
  {
    page: 7,
    title: 'HR appendix: leadership changes',
    level: 'HIGH',
    l5Ran: false,
    latencyMs: 49,
    findings: [
      { category: 'PERSONAL_INFORMATION', entityType: 'PERSON', evidence: '"R████ M████ to step down as…"', layer: 'L2', confidence: 0.95 },
      { category: 'PERSONAL_INFORMATION', entityType: 'SALARY', evidence: '"…compensation ₹█.█ Cr"', layer: 'L4', confidence: 0.9 },
    ],
  },
  {
    page: 8,
    title: 'HR appendix: headcount',
    level: 'MEDIUM',
    l5Ran: false,
    latencyMs: 44,
    findings: [{ category: 'PERSONAL_INFORMATION', entityType: 'EMAIL', evidence: '"p█████@company.example"', layer: 'L1', confidence: 0.99 }],
  },
  { page: 9, title: 'Risk register', level: 'LOW', l5Ran: false, latencyMs: 46, findings: [{ category: 'SECURITY', entityType: 'INTERNAL_HOST', evidence: '"db-█████.corp.internal"', layer: 'L1', confidence: 0.93 }] },
  { page: 10, title: 'Glossary', level: 'SAFE', l5Ran: false, latencyMs: 38, findings: [] },
];
