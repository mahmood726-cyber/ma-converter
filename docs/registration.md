# MA Converter — Protocol Registration

**Registration ID:** MAC-2026-001
**Tool:** MA Converter: A Universal Effect Size Translation Tool for Meta-Analysis
**Version:** v1.0.0
**Registration Date:** 2026-03-31
**Type:** Prospective Protocol Registration
**License:** CC BY 4.0

## Registered Objectives

1. Implement all pairwise conversions among: OR, RR, RD, NNT, HR, SMD, MD, r, Fisher's z (11 source measures).
2. Propagate 95% confidence intervals using the delta method throughout.
3. Provide explicit accuracy grades (Exact / Good / Approximate / Rough) per conversion path.
4. Support batch mode (CSV upload, up to 500 rows).
5. Embed a formula reference panel covering all implemented formulas.
6. Ship as a single self-contained HTML file suitable for offline use.

## Repository

- GitHub: https://github.com/mahmood726-cyber/ma-converter
- GitHub Pages: https://mahmood726-cyber.github.io/ma-converter/

## Authors

- Mahmood Alhusseini (Independent Researcher, Meta-Methods Group)

## Protocol Document

See `docs/protocol.html` for full protocol.

## Results Document

See `docs/results.html` for results paper.

## Status

- [x] Protocol registered (MAC-2026-001)
- [x] Tool implemented (ma-converter.html, 1,687 lines)
- [x] Safety checks passed (7/7)
- [x] Round-trip verification passed (OR<->SMD, Fisher's z<->r)
- [x] Deployed via GitHub Pages
