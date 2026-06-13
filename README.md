# ma-converter

**MAConverter** — an offline, single-file browser tool that translates between
common meta-analysis effect sizes.

It converts a point estimate (with optional confidence interval and baseline
risk) between these measures:

- OR (odds ratio)
- RR (risk ratio)
- RD (risk difference)
- NNT (number needed to treat)
- HR (hazard ratio)
- SMD (standardised mean difference)
- MD (mean difference)

Confidence intervals are propagated with the delta method. Some conversions are
exact (e.g. OR↔RR given a baseline risk) and some are approximations (e.g.
HR→OR via the proportional-hazards relation, HR→RR via the Shor approximation,
OR↔SMD via the Chinn 2000 factor √3/π); approximate results are flagged in the
output. Conversions that require a baseline risk or SD are marked N/A when that
input is absent.

The tool is a single HTML file with no external dependencies — it runs entirely
in the browser with no network access.

## Usage

Open `index.html` (identical to `maconverter.html`) in any modern browser, or
visit the GitHub Pages deployment. Enter a measure, value, optional CI, and
optional baseline risk, then convert. A batch mode accepts comma-separated rows.

## Tests

A Selenium-based test suite drives the page and checks every conversion against
an independently computed expected value:

```
python -m pytest tests/test_maconverter.py -q
```

Requires Chrome and `selenium`. The suite resolves the HTML under test relative
to the repository, so it runs from a fresh clone.

## Licence

MIT — see `LICENSE`.
