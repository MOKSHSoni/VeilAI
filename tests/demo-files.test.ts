// Keeps demo-files/ in sync with the rules: each file must produce the result documented in demo-files/README.md.
import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { RiskLevel } from '../src/data/types';
import { scanFile } from '../src/lib/documents';

const DIR = join(__dirname, '..', 'demo-files');

// file -> expected level per page (null = no rule match)
const EXPECTED: Record<string, (RiskLevel | null)[]> = {
  '01_clean_meeting_notes.txt': [null],
  '02_hr_employee_records.csv': ['HIGH'],
  '03_payment_card_log.log': ['CRITICAL'],
  '04_app_config.env': ['CRITICAL'],
  '05_evasion_tricks.txt': ['CRITICAL'],
  '06_honeytoken_export.yaml': ['CRITICAL'],
  '07_long_report_hidden_secret.md': [null, null, null, null, null, 'CRITICAL', null, null, null],
  '08_lookalikes_should_not_match.txt': [null],
  '09_contextual_secret_rules_miss.txt': [null],
  '10_mixed_vendor_pack.txt': [null, 'MEDIUM', null, 'HIGH', 'CRITICAL', null],
};

const scan = (f: string) => scanFile(f, readFileSync(join(DIR, f), 'utf8'), statSync(join(DIR, f)).size);
const rules = (f: string) => scan(f).pages.flatMap((p) => p.findings.map((x) => x.rule));

describe('demo-files', () => {
  it.each(Object.entries(EXPECTED))('%s gives the documented page levels', (file, levels) => {
    expect(scan(file).pages.map((p) => p.level)).toEqual(levels);
  });

  it('02 finds 4 of each personal identifier', () => {
    const r = rules('02_hr_employee_records.csv');
    for (const label of ['Email address', 'Indian mobile number', 'PAN', 'Aadhaar-like number (Verhoeff)']) {
      expect(r.filter((x) => x === label)).toHaveLength(4);
    }
  });

  it('03 matches the 3 Luhn-valid cards and skips the typo', () => {
    expect(rules('03_payment_card_log.log')).toEqual(['Payment card (Luhn)', 'Payment card (Luhn)', 'Payment card (Luhn)']);
  });

  it('04 finds every secret type in the config', () => {
    expect(rules('04_app_config.env')).toEqual(['AWS access key', 'API key', 'Password / secret assignment', 'Internal hostname', 'Private IP address']);
  });

  it('05 catches all four evasion tricks after normalisation', () => {
    expect(rules('05_evasion_tricks.txt')).toEqual(['API key', 'Password / secret assignment', 'AWS access key', 'AWS access key']);
  });

  it('06 is a honeytoken hit (L0)', () => {
    const f = scan('06_honeytoken_export.yaml').pages[0].findings;
    expect(f.map((x) => [x.layer, x.rule])).toEqual([['L0', 'Honeytoken HT-0042']]);
  });
});
