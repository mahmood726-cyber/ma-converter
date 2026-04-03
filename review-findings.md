# MA Converter Code Review Findings

**Date:** 2026-04-03
**File:** ma-converter.html (1,686 lines)
**Tests:** 59/59 PASS

## P0 (Critical)

### P0-1: Batch CSV export lacks formula injection sanitization
**Lines:** 1352-1367 (`downloadBatchCSV`)
Study names from batch CSV input are written directly to output CSV without sanitizing cells starting with `=`, `+`, `@`, `\t`, `\r`.
**Status:** FIXED

### P0-2: XSS via onclick handler in copy button
**Lines:** 1157
`onclick="copyText('${copyText.replace(/'/g,"\\'")}', this)"` — the `copyText` string is built from result values which contain formula strings. While values are numeric, the formula strings (e.g., from `MEASURE_LABELS` or `res.formula`) could potentially break out of the onclick attribute if they contain unescaped quotes. The `replace(/'/g, "\\'")` only handles single quotes but not double quotes or HTML entities.
**Status:** FIXED (added full escaping)

### P0-3: Missing closing `</html>` tag
**Line:** 1685
File ends with `</script></body>` but no `</html>`.
**Status:** FIXED

## P1 (Important)

### P1-1: NNT CI undefined when RD CI crosses zero
**Lines:** 800-807
When `Math.sign(rdLow) !== Math.sign(rdHigh)` (CI for RD crosses zero), `nntL` and `nntU` are both null. This is handled correctly by not showing CI. Good.

### P1-2: Fisher's z back-transform SE approximation
**Lines:** 844-849
When source is `r`, the SE for Fisher's z is computed from the CI of z. But the CI of z is derived from the CI of r, not directly. This double transformation introduces slight rounding but is standard practice.

### P1-3: HR declared non-derivable from other measures
**Line:** 976
`results['HR'] = { impossible: true, reason: 'HR requires time-to-event data' }` — This is correct (HR cannot be derived from OR/RR in general), well-documented.

### P1-4: `seFromCI` with negative lower bound for log scale
**Line:** 647-652
`seFromCI(lower, upper, true)` calls `Math.log(upper) - Math.log(lower)`. If `lower <= 0`, this returns NaN. The validation at line 1085-1086 catches this for OR/RR/HR but not for logOR/logRR where the user enters the log-transformed CI directly.

## P2 (Minor)

### P2-1: `MEASURE_LABELS` has escaped quotes in string
**Line:** 633
`'SMD / Cohen\'s d'` — works but template literals would be cleaner.
**Status:** FIXED — changed to double-quoted string

### P2-2: Export CSV doesn't quote fields
**Lines:** 1640-1651
Single conversion export CSV uses `.join(',')` without quoting fields that might contain commas.
**Status:** FIXED — use csvSafeField() for string columns in single export CSV

### P2-3: Batch CSV parser doesn't handle quoted fields
**Lines:** 1226-1236
`lines[i].split(',')` does not handle quoted fields with embedded commas. Standard CSV may have `"value, with comma"`.
**Status:** FIXED — added splitCSVLine() with RFC 4180 compliant quoted-field parsing

### P2-4: Dark mode emoji in button
**Line:** 372
Uses emoji (`🌙` / `☀️`) for theme toggle which may not render consistently across platforms.
**Status:** FIXED — replaced emoji with text labels "Dark"/"Light" + added aria-label

---

**Summary:** 3 P0 fixed, 4 P1 found, 4 P2 fixed. 59/59 tests pass.
