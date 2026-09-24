import { describe, expect, it } from 'vitest';
import { mask } from '../src/lib/masking';
import { maskAndVerify, variantsOf, verify } from '../src/lib/verification';
import { getScenario } from '../src/data/scenarios';
import { runScenario } from '../src/lib/pipeline';

describe('verify', () => {
  it('passes a clean masked text', () => {
    const m = mask('Rahul Mehta joined Acme Corp.', [
      { original: 'Rahul Mehta', entityType: 'PERSON' },
      { original: 'Acme Corp', entityType: 'CLIENT' },
    ]);
    const r = verify(m.text, m.vault);
    expect(r.passed).toBe(true);
    expect(r.checks.map((c) => c.id)).toEqual(['vault', 'variants', 'patterns', 'placeholders', 'consistency']);
  });

  it('detects a vault value left in the text', () => {
    const m = mask('Rahul Mehta', [{ original: 'Rahul Mehta', entityType: 'PERSON' }]);
    const r = verify(`${m.text} and RAHUL MEHTA`, m.vault);
    expect(r.checks.find((c) => c.id === 'vault')!.passed).toBe(false);
  });

  it('detects first name, surname, possessive and spacing variants', () => {
    const m = mask('Rahul Mehta', [{ original: 'Rahul Mehta', entityType: 'PERSON' }]);
    const kinds = (t: string) => verify(t, m.vault).leaks.map((l) => l.kind);
    expect(kinds('Ask Rahul today')).toEqual(['first name']);
    expect(kinds('Ask Mehta today')).toEqual(['surname']);
    expect(kinds("Rahul's review")).toEqual(['possessive']);
    expect(kinds('user Rahul-Mehta')).toEqual(['spacing variant']);
  });

  it('detects email local parts and host short forms', () => {
    expect(variantsOf({ original: 'priya.k@example.com', entityType: 'EMAIL' }).map((v) => v.value)).toContain('priya.k');
    const m = mask('pg-billing-01.corp.internal', [{ original: 'pg-billing-01.corp.internal', entityType: 'INTERNAL_HOST' }]);
    expect(verify('ssh pg-billing-01', m.vault).passed).toBe(false);
  });

  it('flags residual secret patterns and bad placeholders', () => {
    const m = mask('x', []);
    const r = verify('key AKIAQ7X3VEILDEMO4K2P and ⟦EMP_09⟧ and ⟦bad⟧', m.vault);
    expect(r.checks.find((c) => c.id === 'patterns')!.passed).toBe(false);
    expect(r.checks.find((c) => c.id === 'placeholders')!.passed).toBe(false);
  });

  it('flags dropped values that reappear', () => {
    const r = verify('total 120 for Pune', [], { droppedValues: ['Pune'] });
    expect(r.passed).toBe(false);
  });
});

describe('maskAndVerify auto-repair', () => {
  it('repairs a variant leak by adding it to the vault under the same placeholder', () => {
    const out = maskAndVerify('Rahul Mehta said Rahul was late.', [{ original: 'Rahul Mehta', entityType: 'PERSON' }]);
    expect(out.status).toBe('REPAIRED');
    expect(out.final.text).toBe('⟦EMP_01⟧ said ⟦EMP_01⟧ was late.');
    expect(out.final.vault[0].aliases).toEqual(['Rahul']);
  });

  it('repairs residual secret patterns found on re-scan', () => {
    const out = maskAndVerify('key = "AKIAQ7X3VEILDEMO4K2P"', []);
    expect(out.status).toBe('REPAIRED');
    expect(out.final.text).toBe('key = "⟦SECRET_1⟧"');
  });

  it('passes first time when nothing leaks', () => {
    const out = maskAndVerify('Acme Corp only.', [{ original: 'Acme Corp', entityType: 'CLIENT' }]);
    expect(out.status).toBe('PASS');
    expect(out.attempts).toHaveLength(1);
  });
});

describe('Scenario 5: fail → repair → pass', () => {
  it('first pass leaks "Rahul\'s", repair adds "Rahul" under ⟦EMP_01⟧, second pass passes', () => {
    const run = runScenario(getScenario(5));
    const v = run.verification!;
    expect(v.status).toBe('REPAIRED');
    expect(v.attempts).toHaveLength(2);

    const [first, second] = v.attempts;
    expect(first.mask.text).toContain("Rahul's");
    expect(first.result.passed).toBe(false);
    expect(first.result.leaks).toEqual([expect.objectContaining({ found: "Rahul's", alias: 'Rahul', placeholder: '⟦EMP_01⟧', kind: 'possessive' })]);

    expect(second.result.passed).toBe(true);
    expect(run.sanitisedText).toBe("Draft an email telling ⟦EMP_01⟧ his salary goes to ₹18.5 LPA. Mention that ⟦EMP_01⟧'s performance review was the reason.");
    expect(v.repairs).toEqual([expect.objectContaining({ alias: 'Rahul', placeholder: '⟦EMP_01⟧' })]);
  });
});
