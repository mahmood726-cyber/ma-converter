// truth-recovery/test.mjs — node --test. Asserts formula identities against closed form.
import { test } from 'node:test';
import assert from 'node:assert';
import { convertMeasure } from './engine.mjs';

const SQRT3_OVER_PI = Math.sqrt(3) / Math.PI; // 0.5513 — correct Chinn/Hasselblad
const WRONG_VARIANT = Math.sqrt(3 / Math.PI);  // 0.9772 — the common BUG

test('logOR→SMD uses sqrt(3)/pi (0.5513), NOT sqrt(3/pi) (0.9772)', () => {
  const smd = convertMeasure('logOR', 1.0, 0.8, 1.2, {})['SMD'].estimate;
  assert.ok(Math.abs(smd - SQRT3_OVER_PI) < 1e-9, `got ${smd}`);
  assert.ok(Math.abs(smd - WRONG_VARIANT) > 0.4, 'must NOT be the wrong sqrt(3/pi) variant');
});

test('SMD→logOR→SMD round-trip is identity', () => {
  const smd0 = 0.62;
  const lor = convertMeasure('SMD', smd0, 0.4, 0.84, {})['logOR'].estimate;
  const back = convertMeasure('logOR', lor, lor-0.1, lor+0.1, {})['SMD'].estimate;
  assert.ok(Math.abs(back - smd0) < 1e-9, `got ${back}`);
});

test('Fisher z = 0.5*ln((1+r)/(1-r)) and r→z→r round-trip', () => {
  const r0 = 0.5;
  const fz = convertMeasure('r', r0, 0.3, 0.65, {})['fisherz'].estimate;
  assert.ok(Math.abs(fz - 0.5*Math.log((1+r0)/(1-r0))) < 1e-9);
  const rBack = convertMeasure('fisherz', fz, fz-0.1, fz+0.1, {})['r'].estimate;
  assert.ok(Math.abs(rBack - r0) < 1e-9);
});

test('RR→OR closed form with control rate; not fabricated without it', () => {
  const pc = 0.1, pt = 0.2;
  const orExpected = (pt/(1-pt))/(pc/(1-pc)); // 2.25
  const withPC = convertMeasure('RR', 2.0, 1.5, 2.5, { controlRate: pc })['OR'].estimate;
  assert.ok(Math.abs(withPC - orExpected) < 1e-6, `got ${withPC}`);
  const noPC = convertMeasure('RR', 2.0, 1.5, 2.5, {})['OR'];
  assert.ok(noPC === null || noPC.impossible === true, 'OR must not be fabricated without pc');
});

test('HR not derivable from summary stats (engine warns)', () => {
  const hr = convertMeasure('OR', 1.5, 1.1, 2.0, {})['HR'];
  assert.ok(hr && hr.impossible === true);
});

test('NNT = 1/|RD| identity', () => {
  const nnt = convertMeasure('RD', -0.05, -0.08, -0.02, {})['NNT'].estimate;
  assert.ok(Math.abs(nnt - 20) < 1e-9, `got ${nnt}`);
});
