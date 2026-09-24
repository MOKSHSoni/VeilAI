// Simulated admin dashboard metadata. No prompt content: category, level, tool, time, department only.

import type { Category, RiskLevel } from './types';

export const KPIS = {
  scansToday: 1284,
  blocked: 17,
  minimisedAndSent: 342,
  localAnswers: 58,
  reviewRate: 4.1, // %
  honeytokenAlerts: 0, // incremented live when Scenario 2 runs
};

export const EVENTS_BY_CATEGORY: { category: Category; short: string; events: number }[] = [
  { category: 'PERSONAL_INFORMATION', short: 'Personal', events: 142 },
  { category: 'CUSTOMER_INFORMATION', short: 'Customer', events: 118 },
  { category: 'CREDENTIALS', short: 'Credentials', events: 64 },
  { category: 'CONFIDENTIAL_BUSINESS', short: 'Business', events: 57 },
  { category: 'FINANCIAL', short: 'Financial', events: 49 },
  { category: 'SECURITY', short: 'Security', events: 41 },
  { category: 'INTELLECTUAL_PROPERTY', short: 'IP', events: 22 },
];

export const EVENTS_BY_TOOL: { tool: string; events: number }[] = [
  { tool: 'ChatGPT', events: 221 },
  { tool: 'Copilot', events: 126 },
  { tool: 'Gemini', events: 84 },
  { tool: 'Claude', events: 42 },
  { tool: 'Other', events: 20 },
];

export const RISK_WEEK: { day: string; LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number; REVIEW: number }[] = [
  { day: 'Mon', LOW: 58, MEDIUM: 31, HIGH: 14, CRITICAL: 3, REVIEW: 5 },
  { day: 'Tue', LOW: 64, MEDIUM: 36, HIGH: 17, CRITICAL: 4, REVIEW: 6 },
  { day: 'Wed', LOW: 61, MEDIUM: 29, HIGH: 21, CRITICAL: 2, REVIEW: 4 },
  { day: 'Thu', LOW: 70, MEDIUM: 38, HIGH: 16, CRITICAL: 5, REVIEW: 7 },
  { day: 'Fri', LOW: 66, MEDIUM: 33, HIGH: 19, CRITICAL: 3, REVIEW: 5 },
  { day: 'Sat', LOW: 21, MEDIUM: 9, HIGH: 4, CRITICAL: 1, REVIEW: 1 },
  { day: 'Sun', LOW: 17, MEDIUM: 7, HIGH: 3, CRITICAL: 0, REVIEW: 1 },
];

export interface DashboardEvent {
  time: string;
  department: string;
  tool: string;
  category: Category | '—';
  risk: RiskLevel;
  action: string;
  userHash: string;
}

export const RECENT_EVENTS: DashboardEvent[] = [
  { time: '10:42', department: 'Engineering', tool: 'ChatGPT', category: 'CREDENTIALS', risk: 'CRITICAL', action: 'Masked + sent', userHash: 'u_7f3a91c2' },
  { time: '10:39', department: 'Finance', tool: 'Copilot', category: 'CUSTOMER_INFORMATION', risk: 'HIGH', action: 'Minimised + sent', userHash: 'u_02be4d7f' },
  { time: '10:31', department: 'Strategy', tool: 'ChatGPT', category: 'CONFIDENTIAL_BUSINESS', risk: 'HIGH', action: 'Answered locally', userHash: 'u_c19e0a55' },
  { time: '10:27', department: 'HR', tool: 'ChatGPT', category: 'PERSONAL_INFORMATION', risk: 'HIGH', action: 'Masked + sent', userHash: 'u_5d8c3b10' },
  { time: '10:18', department: 'Sales', tool: 'Gemini', category: 'CONFIDENTIAL_BUSINESS', risk: 'REVIEW', action: 'Sent sanitised', userHash: 'u_9a47ee02' },
  { time: '10:11', department: 'Engineering', tool: 'Claude', category: '—', risk: 'SAFE', action: 'Sent unchanged', userHash: 'u_7f3a91c2' },
  { time: '10:04', department: 'Marketing', tool: 'Gemini', category: 'INTELLECTUAL_PROPERTY', risk: 'MEDIUM', action: 'Masked + sent', userHash: 'u_31fd6c84' },
  { time: '09:58', department: 'Legal', tool: 'Copilot', category: 'FINANCIAL', risk: 'MEDIUM', action: 'Masked + sent', userHash: 'u_e6b2079d' },
];

export const HONEYTOKEN_EVENT: DashboardEvent = {
  time: 'now',
  department: 'Finance',
  tool: 'Gemini',
  category: 'CREDENTIALS',
  risk: 'CRITICAL',
  action: 'Blocked · honeytoken',
  userHash: 'u_4c0f8e3b',
};
