import { describe, expect, it } from 'vitest';
import { mask, minimiseTable, tableToCsv } from '../src/lib/masking';

describe('mask', () => {
  it('replaces exact spans with role-preserving placeholders', () => {
    const r = mask('Rahul Mehta approved the ₹85 crore deal with ABC Corporation.', [
      { original: 'Rahul Mehta', entityType: 'PERSON' },
      { original: 'ABC Corporation', entityType: 'CLIENT' },
      { original: '₹85 crore', entityType: 'DEAL_VALUE' },
    ]);
    expect(r.text).toBe('⟦EMP_01⟧ approved the ⟦DEAL_VALUE_1⟧ deal with ⟦CLIENT_A⟧.');
    expect(r.vault.map((v) => [v.placeholder, v.original])).toEqual([
      ['⟦EMP_01⟧', 'Rahul Mehta'],
      ['⟦DEAL_VALUE_1⟧', '₹85 crore'],
      ['⟦CLIENT_A⟧', 'ABC Corporation'],
    ]);
  });

  it('replaces all occurrences with the same placeholder', () => {
    const r = mask('Project Falcon starts. Project Falcon ends.', [{ original: 'Project Falcon', entityType: 'PROJECT' }]);
    expect(r.text).toBe('⟦PROJECT_01⟧ starts. ⟦PROJECT_01⟧ ends.');
    expect(r.vault).toHaveLength(1);
    expect(r.replacements).toHaveLength(2);
  });

  it('preserves relationships (build spec §7.9 example)', () => {
    const r = mask('Rahul reports to Priya. Rahul manages ABC Corporation. Priya approved the transaction.', [
      { original: 'Rahul', entityType: 'PERSON' },
      { original: 'Priya', entityType: 'PERSON' },
      { original: 'ABC Corporation', entityType: 'CLIENT' },
    ]);
    expect(r.text).toBe('⟦EMP_01⟧ reports to ⟦EMP_02⟧. ⟦EMP_01⟧ manages ⟦CLIENT_A⟧. ⟦EMP_02⟧ approved the transaction.');
  });

  it('numbers placeholders per prefix by first appearance, not finding order', () => {
    const r = mask('Priya met Rahul. Key1 AKIA, key2 sk_x. Beta Ltd and Alpha Inc.', [
      { original: 'Rahul', entityType: 'PERSON' },
      { original: 'Priya', entityType: 'PERSON' },
      { original: 'sk_x', entityType: 'SECRET' },
      { original: 'AKIA', entityType: 'SECRET' },
      { original: 'Alpha Inc', entityType: 'CLIENT' },
      { original: 'Beta Ltd', entityType: 'CLIENT' },
    ]);
    expect(r.text).toBe('⟦EMP_01⟧ met ⟦EMP_02⟧. Key1 ⟦SECRET_1⟧, key2 ⟦SECRET_2⟧. ⟦CLIENT_A⟧ and ⟦CLIENT_B⟧.');
    expect(r.vault.find((v) => v.original === 'AKIA')?.secret).toBe(true);
    expect(r.vault.find((v) => v.original === 'Priya')?.secret).toBe(false);
  });

  it('resolves overlapping findings: longest span wins', () => {
    const r = mask('ABC Corporation signed. ABC later renewed.', [
      { original: 'ABC', entityType: 'CLIENT' },
      { original: 'ABC Corporation', entityType: 'CLIENT' },
    ]);
    expect(r.text).toBe('⟦CLIENT_A⟧ signed. ⟦CLIENT_B⟧ later renewed.');
    expect(r.vault.map((v) => v.original)).toEqual(['ABC Corporation', 'ABC']);
  });

  it('skips findings whose only occurrence is inside a longer span (no gaps in numbering)', () => {
    const r = mask('Project Falcon and Rahul.', [
      { original: 'Falcon', entityType: 'PROJECT' },
      { original: 'Project Falcon', entityType: 'PROJECT' },
      { original: 'Rahul', entityType: 'PERSON' },
    ]);
    expect(r.text).toBe('⟦PROJECT_01⟧ and ⟦EMP_01⟧.');
    expect(r.vault).toHaveLength(2);
  });

  it('respects word boundaries', () => {
    const r = mask('Ravi and Ravindra met.', [{ original: 'Ravi', entityType: 'PERSON' }]);
    expect(r.text).toBe('⟦EMP_01⟧ and Ravindra met.');
  });

  it('maps aliases to the original placeholder', () => {
    const r = mask("Rahul Mehta said Rahul's plan works.", [{ original: 'Rahul Mehta', entityType: 'PERSON', aliases: ['Rahul'] }]);
    expect(r.text).toBe("⟦EMP_01⟧ said ⟦EMP_01⟧'s plan works.");
    expect(r.vault).toHaveLength(1);
  });

  it('is deterministic', () => {
    const t = [{ original: 'Acme Corp', entityType: 'CLIENT' }];
    expect(mask('Acme Corp x Acme Corp', t)).toEqual(mask('Acme Corp x Acme Corp', t));
  });
});

describe('minimiseTable', () => {
  it('keeps only requested columns and reports dropped values', () => {
    const t = { columns: ['name', 'spend'], rows: [{ name: 'A B', spend: 10 }, { name: 'C D', spend: 20 }] };
    const { table, droppedValues } = minimiseTable(t, ['spend']);
    expect(tableToCsv(table)).toBe('spend\n10\n20');
    expect(droppedValues).toEqual(['A B', 'C D']);
  });
});
