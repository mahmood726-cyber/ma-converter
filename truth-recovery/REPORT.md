# Truth-Recovery Report — ma-converter

**Verdict: STRONG-VALIDATION**

## What was tested
`ma-converter` converts between effect measures (OR/RR/RD/NNT/HR/SMD/MD/logOR/logRR/r/Fisher's z).
The pure function `convertMeasure` (plus helpers `seFromCI`, `clamp01`) was extracted VERBATIM
from `ma-converter.html` (lines 647-1021) into `engine.mjs` with no DOM dependency, then exercised
through the repo's OWN code against the known closed-form constants and round-trip identities.

## Results (engine output vs closed form)

| Check | Engine constant | Correct constant | Status |
|---|---|---|---|
| logOR -> SMD | 0.5513288954 (= sqrt3/pi) | sqrt3/pi ~= 0.5513 (Chinn/Hasselblad) | CORRECT - NOT buggy sqrt(3/pi)~=0.9772 |
| SMD -> logOR | 1.8137993642 (= pi/sqrt3) | pi/sqrt3 ~= 1.8138 | CORRECT |
| SMD<->logOR round-trip | exact (0.7 -> 0.7) | identity | CORRECT |
| Fisher z | 0.5*ln((1+r)/(1-r)) | same | CORRECT |
| r->z->r round-trip | exact (0.5 -> 0.5) | identity | CORRECT |
| RR -> OR (with p_c) | 2.25 | (pt/(1-pt))/(pc/(1-pc)) = 2.25 | CORRECT |
| RR -> OR (no p_c) | returns null (not fabricated) | requires baseline risk | CORRECT - handled |
| HR <-> OR/RR | impossible: "HR requires time-to-event data" | invalid without survival assumptions | CORRECT - warns |
| NNT = 1/|RD| | 20 (RD = -0.05) | 20 | CORRECT |

All 6 node --test assertions PASS.

## Findings
- The most common bug in this class of tool -- using sqrt(3/pi)~=0.9772 instead of sqrt3/pi~=0.5513
  for the logOR<->SMD (Hasselblad-Hedges) conversion -- is NOT present. Engine computes
  SMD = logOR * sqrt3/pi (line 824) and logOR = SMD * pi/sqrt3 (line 820): exact.
- RR<->OR correctly requires a control rate p_c; without it the OR/RR cells return null rather than a
  fabricated number. No silent wrong output.
- HR cross-conversions to OR/RR are explicitly flagged impossible (correct). An optional
  HR->cumulative-risk path is offered only when baseline risk + time horizon are supplied, using the
  proper Risk(t)=1-exp(-HR*lambda0*t).
- Fisher's z is exact; round-trips exact to 1e-9.

## Not covered
- A direct SMD<->r (Borenstein) path is not implemented. Absence, not an error -- no wrong constant.

## Recommendation
Ship as-is. Conversion constants and identities are correct. STRONG-VALIDATION.
