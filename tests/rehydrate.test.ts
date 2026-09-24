import { describe, expect, it } from 'vitest';
import { mask } from '../src/lib/masking';
import { rehydrate } from '../src/lib/rehydrate';
import { getScenario } from '../src/data/scenarios';
import { runScenario } from '../src/lib/pipeline';

const vault = mask('Rahul Mehta met Priya Nair at Acme Corp. Key AKIAQ7X3VEILDEMO4K2P.', [
  { original: 'Rahul Mehta', entityType: 'PERSON' },
  { original: 'Priya Nair', entityType: 'PERSON' },
  { original: 'Acme Corp', entityType: 'CLIENT' },
  { original: 'AKIAQ7X3VEILDEMO4K2P', entityType: 'SECRET' },
]).vault;

describe('rehydrate', () => {
  it('restores a single placeholder', () => {
    expect(rehydrate('Hello ⟦EMP_01⟧!', vault).text).toBe('Hello Rahul Mehta!');
  });

  it('restores multiple placeholders', () => {
    const r = rehydrate('⟦EMP_01⟧ reports to ⟦EMP_02⟧ at ⟦CLIENT_A⟧.', vault);
    expect(r.text).toBe('Rahul Mehta reports to Priya Nair at Acme Corp.');
    expect(r.restoredCount).toBe(3);
  });

  it('tolerates case, spacing and bracket changes', () => {
    expect(rehydrate('Hi ⟦emp_01⟧, ⟦ EMP_02 ⟧, ⟦Client A⟧, [[EMP_01]].', vault).text).toBe('Hi Rahul Mehta, Priya Nair, Acme Corp, Rahul Mehta.');
  });

  it('never restores secrets by default', () => {
    const r = rehydrate('Rotate ⟦SECRET_1⟧ now.', vault);
    expect(r.text).toBe('Rotate ⟦SECRET_1⟧ now.');
    expect(r.text).not.toContain('AKIA');
    expect(r.secretsKept).toBe(1);
    expect(rehydrate('Rotate ⟦SECRET_1⟧', vault, { restoreSecrets: true }).text).toBe('Rotate AKIAQ7X3VEILDEMO4K2P');
  });

  it('reports unresolved placeholders', () => {
    const r = rehydrate('Who is ⟦EMP_07⟧?', vault);
    expect(r.unresolved).toEqual(['⟦EMP_07⟧']);
    expect(r.text).toBe('Who is ⟦EMP_07⟧?');
  });

  it('Scenario 5 reply rehydrates every placeholder including the mangled one', () => {
    const run = runScenario(getScenario(5));
    expect(run.rehydrated!.unresolved).toEqual([]);
    expect(run.rehydrated!.text).toContain('Dear Rahul Mehta,');
    expect(run.rehydrated!.text).toContain('Congratulations, Rahul Mehta.');
  });

  it('Scenario 1 reply restores the host but keeps secrets masked', () => {
    const run = runScenario(getScenario(1));
    expect(run.rehydrated!.text).toContain('pg-billing-01.corp.internal');
    expect(run.rehydrated!.text).toContain('⟦SECRET_1⟧');
    expect(run.rehydrated!.text).not.toContain('AKIAQ7X3VEILDEMO4K2P');
    expect(run.rehydrated!.text).not.toContain('Tr0ub4dor');
  });
});
