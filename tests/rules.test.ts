import { describe, expect, it } from 'vitest';
import { fnv1a, HONEYTOKEN_REGISTRY, luhnValid, normalise, scanRules, verhoeffCheckDigit, verhoeffValid, type RuleId } from '../src/lib/rules';

const rulesIn = (text: string): RuleId[] => scanRules(text).map((m) => m.rule);
const valuesOf = (text: string, rule: RuleId) => scanRules(text).filter((m) => m.rule === rule).map((m) => m.value);

// A Verhoeff-valid 12-digit Aadhaar-like number built from 11 digits + computed check digit.
const aadhaarBase = '23456789012';
const validAadhaar = aadhaarBase + verhoeffCheckDigit(aadhaarBase);
const invalidAadhaar = aadhaarBase + ((verhoeffCheckDigit(aadhaarBase) + 1) % 10);

describe('checksums', () => {
  it('Verhoeff validates and generates check digits', () => {
    expect(verhoeffValid('2363')).toBe(true); // textbook example: 236 + check digit 3
    expect(verhoeffCheckDigit('236')).toBe(3);
    expect(verhoeffValid(validAadhaar)).toBe(true);
    expect(verhoeffValid(invalidAadhaar)).toBe(false);
  });

  it('Luhn validates card numbers', () => {
    expect(luhnValid('4111 1111 1111 1111')).toBe(true);
    expect(luhnValid('5555-5555-5555-4444')).toBe(true);
    expect(luhnValid('4111 1111 1111 1112')).toBe(false);
    expect(luhnValid('1234')).toBe(false);
  });
});

describe('emails', () => {
  it('detects emails', () => {
    expect(valuesOf('Write to priya.k+ops@example.co.in today', 'EMAIL')).toEqual(['priya.k+ops@example.co.in']);
  });
  it('ignores non-emails', () => {
    expect(rulesIn('user at example dot com, @handle, a@b')).not.toContain('EMAIL');
  });
});

describe('Indian phone numbers', () => {
  it('detects mobile numbers in common formats', () => {
    expect(valuesOf('Call +91 98765 43210', 'INDIAN_PHONE')).toEqual(['+91 98765 43210']);
    expect(valuesOf('Call 9876543210 now', 'INDIAN_PHONE')).toEqual(['9876543210']);
    expect(valuesOf('Call 098765-43210', 'INDIAN_PHONE')).toEqual(['098765-43210']);
  });
  it('rejects numbers that are not Indian mobiles', () => {
    expect(rulesIn('Order 1234567890 and 5876543210')).not.toContain('INDIAN_PHONE');
    expect(rulesIn('pin 98765')).not.toContain('INDIAN_PHONE');
  });
});

describe('API keys and passwords', () => {
  it('detects AWS and live API keys', () => {
    expect(valuesOf('key = "AKIAQ7X3VEILDEMO4K2P"', 'AWS_ACCESS_KEY')).toEqual(['AKIAQ7X3VEILDEMO4K2P']);
    expect(valuesOf('STRIPE=sk_live_4eC39HqLyjWDarjtT1zdp7dc', 'API_KEY')).toEqual(['sk_live_4eC39HqLyjWDarjtT1zdp7dc']);
  });
  it('ignores short or wrong-prefix strings', () => {
    expect(rulesIn('AKIA123 and sk_live_short and AKIAq7x3veildemo4k2p')).toEqual([]);
  });
  it('detects quoted and YAML password assignments, captures only the value', () => {
    expect(valuesOf('DB_PASSWORD = "Tr0ub4dor&Falcon!"', 'PASSWORD')).toEqual(['Tr0ub4dor&Falcon!']);
    expect(valuesOf('db_pass: VeilDemo!Passw0rd', 'PASSWORD')).toEqual(['VeilDemo!Passw0rd']);
  });
  it('ignores variable references and placeholders', () => {
    expect(rulesIn('password=DB_PASSWORD,')).toEqual([]);
    expect(rulesIn('DB_PASSWORD = "⟦SECRET_2⟧"')).toEqual([]);
    expect(rulesIn('db_pass: ⟦SECRET_2⟧')).toEqual([]);
  });
});

describe('Aadhaar-like numbers (Verhoeff)', () => {
  it('detects valid numbers, spaced or not', () => {
    const spaced = `${validAadhaar.slice(0, 4)} ${validAadhaar.slice(4, 8)} ${validAadhaar.slice(8)}`;
    expect(valuesOf(`Aadhaar ${validAadhaar}`, 'AADHAAR')).toEqual([validAadhaar]);
    expect(valuesOf(`Aadhaar ${spaced}`, 'AADHAAR')).toEqual([spaced]);
  });
  it('rejects invalid checksums and numbers starting with 0 or 1', () => {
    expect(rulesIn(`Aadhaar ${invalidAadhaar}`)).not.toContain('AADHAAR');
    expect(rulesIn('Ref 123456789012')).not.toContain('AADHAAR');
  });
});

describe('PAN', () => {
  it('detects PAN format', () => {
    expect(valuesOf('PAN: ABCDE1234F', 'PAN')).toEqual(['ABCDE1234F']);
  });
  it('rejects malformed PANs', () => {
    expect(rulesIn('abcde1234f ABCD1234F ABCDE12345')).not.toContain('PAN');
  });
});

describe('cards (Luhn)', () => {
  it('detects Luhn-valid cards', () => {
    expect(valuesOf('Card 4111 1111 1111 1111 exp 12/29', 'CARD')).toEqual(['4111 1111 1111 1111']);
  });
  it('rejects Luhn-invalid numbers and does not mistake part of a card for Aadhaar', () => {
    expect(rulesIn('Card 4111 1111 1111 1112')).not.toContain('CARD');
    expect(rulesIn('Card 4111 1111 1111 1111')).not.toContain('AADHAAR');
  });
});

describe('internal hosts and honeytokens', () => {
  it('detects internal hostnames and private IPs', () => {
    expect(valuesOf('host="pg-billing-01.corp.internal"', 'INTERNAL_HOST')).toEqual(['pg-billing-01.corp.internal']);
    expect(valuesOf('ssh 10.24.3.17', 'PRIVATE_IP')).toEqual(['10.24.3.17']);
    expect(rulesIn('see example.com or 8.8.8.8')).toEqual([]);
  });
  it('matches honeytokens by hash only', () => {
    expect(HONEYTOKEN_REGISTRY[0].hash).toBe(fnv1a('HT-0042-7QX9VL3MZK81'));
    const m = scanRules('access_token: HT-0042-7QX9VL3MZK81');
    expect(m).toHaveLength(1);
    expect(m[0].rule).toBe('HONEYTOKEN');
    expect(m[0].honeytokenId).toBe('HT-0042');
    expect(rulesIn('ticket HT-0042-XXXXXXXXXXXX')).not.toContain('HONEYTOKEN');
  });
});

describe('normalise', () => {
  it('collapses spaced-out keys and decodes base64 so rules fire', () => {
    const raw = 'KEY = s k _ l i v e _ 4 e C 3 9 H q L y j W D a r j t T 1 z d p 7 d c\ndb_pass_b64: VmVpbERlbW8hUGFzc3cwcmQ=';
    expect(rulesIn(raw)).not.toContain('API_KEY'); // the YAML rule already catches the encoded value itself
    const { text, notes } = normalise(raw);
    expect(notes.map((n) => n.method)).toEqual(['Collapse spaced-out characters', 'Decode base64']);
    expect(text).toContain('sk_live_4eC39HqLyjWDarjtT1zdp7dc');
    expect(text).toContain('VeilDemo!Passw0rd');
    expect(rulesIn(text)).toEqual(['API_KEY', 'PASSWORD']);
  });
  it('strips zero-width characters and folds homoglyphs', () => {
    const { text } = normalise('AKIA\u200BQ7X3VEILDEMO4K2P раss');
    expect(text).toBe('AKIAQ7X3VEILDEMO4K2P pass');
  });
  describe('spaced-out run next to a one-letter word ("a", "I")', () => {
    const KEY = 'sk_live_4eC39HqLyjWDarjtT1zdp7dc';
    const spaced = (s: string) => s.split('').join(' ');
    const apiValues = (t: string) => valuesOf(normalise(t).text, 'API_KEY');

    it('"a" before the key no longer hides it', () => {
      expect(apiValues(`Here is a ${spaced(KEY)} for staging.`)).toEqual([KEY]);
      expect(normalise(`Here is a ${spaced(KEY)} for staging.`).text).toBe(`Here is a ${KEY} for staging.`);
    });

    it('"a" or "I" after the key is not glued onto it', () => {
      expect(apiValues(`The key ${spaced(KEY)} a new one was issued.`)).toEqual([KEY]);
      expect(apiValues(`Key ${spaced(KEY)} I think it leaked.`)).toEqual([KEY]);
      expect(apiValues(`So a ${spaced(KEY)} I guess.`)).toEqual([KEY]);
    });

    it('keys that really start with "A" still work (AKIA…)', () => {
      expect(valuesOf(normalise(`key ${spaced('AKIAQ7X3VEILDEMO4K2P')} rotated`).text, 'AWS_ACCESS_KEY')).toEqual(['AKIAQ7X3VEILDEMO4K2P']);
    });

    it('a registered honeytoken is matched exactly even with a one-letter word beside it', () => {
      const m = scanRules(normalise(`token ${spaced('HT-0042-7QX9VL3MZK81')} a copy`).text);
      expect(m.map((x) => x.honeytokenId)).toEqual(['HT-0042']);
    });

    it('keeps both readings when no rule can decide, so exact hash checks see each', () => {
      const t = normalise(`id ${spaced('QZ-9981-XKCDPLMN')} a spare`).text;
      expect(t).toContain('QZ-9981-XKCDPLMNa');
      expect(t).toContain('QZ-9981-XKCDPLMN a');
    });

    it('does not change runs without a one-letter neighbour', () => {
      expect(normalise(`KEY = ${spaced(KEY)} was rotated`).text).toBe(`KEY = ${KEY} was rotated`);
    });
  });

  it('leaves ordinary prose alone', () => {
    const prose = 'The board has approved negotiations with Acme Corp in Q4.';
    expect(normalise(prose)).toEqual({ text: prose, notes: [] });
  });
});
