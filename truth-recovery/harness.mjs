// truth-recovery/harness.mjs — exercises the repo's OWN convertMeasure against closed-form identities
import { convertMeasure } from './engine.mjs';

const SQRT3_OVER_PI = Math.sqrt(3) / Math.PI; // ≈ 0.5513 (Chinn/Hasselblad) — the CORRECT constant
const PI_OVER_SQRT3 = Math.PI / Math.sqrt(3);  // ≈ 1.8138

function approx(a, b, tol = 1e-6) { return Math.abs(a - b) < tol; }

const report = {};

// --- (a) logOR → SMD constant check ---
// Inject logOR = 1.0; expect SMD = 1.0 * sqrt(3)/pi
{
  const r = convertMeasure('logOR', 1.0, 0.8, 1.2, {});
  const smd = r['SMD'].estimate;
  report.logOR_to_SMD = {
    got: smd, expected: SQRT3_OVER_PI,
    impliedConstant: smd / 1.0,
    correct: approx(smd, SQRT3_OVER_PI, 1e-9),
    isWrongSqrt3PiVariant: approx(smd / 1.0, Math.sqrt(3 / Math.PI), 1e-4) // the BUG variant 0.9772
  };
}

// --- (a') SMD → logOR constant check ---
{
  const r = convertMeasure('SMD', 1.0, 0.8, 1.2, {});
  const lor = r['logOR'].estimate;
  report.SMD_to_logOR = { got: lor, expected: PI_OVER_SQRT3, correct: approx(lor, PI_OVER_SQRT3, 1e-9) };
}

// --- (d) round-trip logOR → SMD → logOR ---
{
  const lor0 = 0.7;
  const r1 = convertMeasure('logOR', lor0, 0.5, 0.9, {});
  const smd = r1['SMD'].estimate;
  const r2 = convertMeasure('SMD', smd, smd-0.1, smd+0.1, {});
  const lorBack = r2['logOR'].estimate;
  report.roundtrip_logOR_SMD = { start: lor0, back: lorBack, correct: approx(lor0, lorBack, 1e-9) };
}

// --- (b) Fisher z: r → z → r round-trip + closed form ---
{
  const r0 = 0.5;
  const fz_expected = 0.5 * Math.log((1 + r0)/(1 - r0)); // 0.5493
  const res = convertMeasure('r', r0, 0.3, 0.65, {});
  const fz = res['fisherz'].estimate;
  const rBack = convertMeasure('fisherz', fz, fz-0.1, fz+0.1, {})['r'].estimate;
  report.fisherz = { got: fz, expected: fz_expected, correctZ: approx(fz, fz_expected, 1e-9),
                     roundtrip_r: rBack, correctRoundtrip: approx(rBack, r0, 1e-9) };
}

// --- (e) RR↔OR requires baseline risk (pc) ---
// Without pc: OR from RR should be impossible. With pc: closed form.
{
  const noPC = convertMeasure('RR', 2.0, 1.5, 2.5, {});
  const withPC = convertMeasure('RR', 2.0, 1.5, 2.5, { controlRate: 0.1 });
  // closed form: OR = (pt/(1-pt))/(pc/(1-pc)), pt = pc*RR = 0.2
  const pc = 0.1, pt = 0.2;
  const orExpected = (pt/(1-pt))/(pc/(1-pc));
  report.RR_to_OR = {
    impossibleWithoutPC: noPC['OR'] && noPC['OR'].impossible === true,
    gotWithPC: withPC['OR'] ? withPC['OR'].estimate : null,
    expectedWithPC: orExpected,
    correctWithPC: withPC['OR'] && !withPC['OR'].impossible && approx(withPC['OR'].estimate, orExpected, 1e-6)
  };
}

// --- (f) HR↔OR/RR NOT valid without survival assumptions -> should warn/impossible ---
{
  const r = convertMeasure('OR', 1.5, 1.1, 2.0, {});
  report.HR_guard = { OR_to_HR_impossible: r['HR'] && r['HR'].impossible === true, reason: r['HR'] ? r['HR'].reason : null };
}

// --- NNT = 1/|RD| identity ---
{
  const r = convertMeasure('RD', -0.05, -0.08, -0.02, {});
  report.NNT = { rd: -0.05, nnt: r['NNT'].estimate, expected: 20, correct: approx(r['NNT'].estimate, 20, 1e-9) };
}

console.log(JSON.stringify(report, null, 2));
