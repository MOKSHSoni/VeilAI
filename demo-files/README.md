# Demo files for Document Scan

Test files for **Document Scan → Add file**. Every value is fictional: public test card numbers, made-up keys, and Aadhaar-like numbers generated with valid Verhoeff checksums. `tests/demo-files.test.ts` checks that each file still gives the result below.

Added files are scanned with **rules only** (normaliser + L0 honeytokens + L1 rules). "No match" means no known pattern was found. It is **not** a SAFE verdict.

| File | What it tests | Expected result |
|---|---|---|
| `01_clean_meeting_notes.txt` | Ordinary text | 1 page, **no match** |
| `02_hr_employee_records.csv` | Personal data: 4 emails, 4 Indian mobiles (3 formats), 4 PANs, 4 Aadhaar numbers | **HIGH** (16 findings) |
| `03_payment_card_log.log` | Card numbers with the Luhn check (Visa, Mastercard, Amex) plus one typo that fails Luhn | **CRITICAL**: 3 cards; the typo is **not** flagged |
| `04_app_config.env` | Secrets in a config: AWS key, live API key, password, internal hostname, private IP | **CRITICAL** (5 findings) |
| `05_evasion_tricks.txt` | Hidden secrets: spaced-out key, base64 password, zero-width space inside a key, Cyrillic look-alike letters | **CRITICAL**: all 4 caught after normalisation |
| `06_honeytoken_export.yaml` | Planted tripwire token HT-0042 | **CRITICAL**, layer **L0** honeytoken |
| `07_long_report_hidden_secret.md` | A 9-page document with one AWS key buried on page 6 | Only **page 6 CRITICAL**, the other 8 pages no match (shows chunking) |
| `08_lookalikes_should_not_match.txt` | Look-alikes: order numbers, Aadhaar with a wrong check digit, card failing Luhn, short key, lowercase PAN, public site/DNS, pin code | **No match** (checks for false positives) |
| `09_contextual_secret_rules_miss.txt` | A confidential acquisition with no pattern in it | **No match**: a known limit of rules only; L3–L5 catch this in the full product |
| `10_mixed_vendor_pack.txt` | 6 pages split by page breaks, mixed content | Pages 2 **MEDIUM** (email + phone), 4 **HIGH** (PAN + Aadhaar), 5 **CRITICAL** (API key), others no match |

**Suggested demo order:** 01 (clean) → 04 (secrets) → 05 (evasion) → 07 (long document, page 6) → 08 (no false alarms) → 09 (why the contextual layers matter) → export the report for 10.

**Not supported:** PDF / Word / Excel. The app shows a clear message instead of scanning them.

**Known limit:** template placeholders written as quoted values, such as `API_KEY="<your-key>"`, are flagged by the password rule. That's a known false-positive pattern of rules-only scanning.
