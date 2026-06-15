// truth-recovery/engine.mjs — pure conversion functions extracted VERBATIM from ma-converter.html
// No DOM dependencies in these functions.

function seFromCI(lower, upper, logScale) {
  if (logScale) {
    return (Math.log(upper) - Math.log(lower)) / 3.919928;
  }
  return (upper - lower) / 3.919928;
}

function clamp01(x) { return Math.max(1e-8, Math.min(1 - 1e-8, x)); }

function convertMeasure(srcMeasure, srcEst, srcLower, srcUpper, opts) {
  opts = opts || {};
  const pc = (opts.controlRate !== undefined && opts.controlRate !== null && opts.controlRate !== '') ? parseFloat(opts.controlRate) : null;
  const sd = (opts.pooledSD !== undefined && opts.pooledSD !== null && opts.pooledSD !== '') ? parseFloat(opts.pooledSD) : null;
  const p0 = (opts.baselineRisk !== undefined && opts.baselineRisk !== null && opts.baselineRisk !== '') ? parseFloat(opts.baselineRisk) : null;
  const tH = (opts.timeHorizon !== undefined && opts.timeHorizon !== null && opts.timeHorizon !== '') ? parseFloat(opts.timeHorizon) : null;

  const results = {};

  // --- Normalize input to canonical intermediates ---
  // We work with: logOR, logRR, RD, NNT, logHR, SMD, MD, fisher_z

  // Compute SE on appropriate scale
  let logOR_est = null, seLogOR = null;
  let logRR_est = null, seLogRR = null;
  let RD_est = null, seRD = null;
  let logHR_est = null, seLogHR = null;
  let SMD_est = null, seSMD = null;
  let MD_est = null, seMD = null;
  let r_est = null;
  let fz_est = null, seFZ = null;

  switch (srcMeasure) {
    case 'OR':
      logOR_est = Math.log(srcEst);
      seLogOR = seFromCI(srcLower, srcUpper, true);
      break;
    case 'logOR':
      logOR_est = srcEst;
      seLogOR = seFromCI(srcLower, srcUpper, false);
      break;
    case 'RR':
      logRR_est = Math.log(srcEst);
      seLogRR = seFromCI(srcLower, srcUpper, true);
      break;
    case 'logRR':
      logRR_est = srcEst;
      seLogRR = seFromCI(srcLower, srcUpper, false);
      break;
    case 'RD':
      RD_est = srcEst;
      seRD = seFromCI(srcLower, srcUpper, false);
      break;
    case 'NNT': {
      const rdFromNNT = srcEst !== 0 ? 1 / srcEst : null;
      if (rdFromNNT !== null) {
        RD_est = rdFromNNT;
        // CI inverts: 1/upper to 1/lower (but only if same sign)
        const rdL = srcUpper !== 0 ? 1 / srcUpper : null;
        const rdU = srcLower !== 0 ? 1 / srcLower : null;
        if (rdL !== null && rdU !== null) {
          seRD = seFromCI(rdL, rdU, false);
        }
      }
      break;
    }
    case 'HR':
      logHR_est = Math.log(srcEst);
      seLogHR = seFromCI(srcLower, srcUpper, true);
      break;
    case 'SMD':
      SMD_est = srcEst;
      seSMD = seFromCI(srcLower, srcUpper, false);
      break;
    case 'MD':
      MD_est = srcEst;
      seMD = seFromCI(srcLower, srcUpper, false);
      break;
    case 'r':
      r_est = srcEst;
      fz_est = 0.5 * Math.log((1 + srcEst) / (1 - srcEst));
      seFZ = seFromCI(
        0.5 * Math.log((1 + srcLower) / (1 - srcLower)),
        0.5 * Math.log((1 + srcUpper) / (1 - srcUpper)),
        false
      );
      break;
    case 'fisherz':
      fz_est = srcEst;
      seFZ = seFromCI(srcLower, srcUpper, false);
      r_est = (Math.exp(2 * srcEst) - 1) / (Math.exp(2 * srcEst) + 1);
      break;
  }

  // Derive cross-conversions where possible
  // logOR ↔ logRR (needs pc)
  if (logOR_est !== null && logRR_est === null && pc !== null) {
    const OR = Math.exp(logOR_est);
    const RR_val = OR / (1 - pc + pc * OR);
    logRR_est = Math.log(RR_val);
    // delta method: dRR/dOR = (1-pc)/(1-pc+pc*OR)^2; via log: d(logRR)/d(logOR) = (1-pc)/(1-pc+pc*OR)
    const denom = 1 - pc + pc * OR;
    const dLogRR_dLogOR = (1 - pc) * OR / (denom * denom) * (1 / RR_val);
    seLogRR = seLogOR * Math.abs(dLogRR_dLogOR);
  }
  if (logRR_est !== null && logOR_est === null && pc !== null) {
    const RR = Math.exp(logRR_est);
    const pt = clamp01(pc * RR);
    const OR_val = (pt / (1 - pt)) / (pc / (1 - pc));
    logOR_est = Math.log(OR_val);
    // delta method
    const dLogOR_dLogRR = 1 / (1 - pt) * pt + 1; // d(logOR)/d(logRR) approx
    // exact: logOR = log(p_t) - log(1-p_t) - log(pc) + log(1-pc)
    // p_t = pc*RR, d(p_t)/d(logRR) = pc*RR = p_t
    // d(logOR)/d(logRR) = dp_t/(p_t*(1-p_t)) * p_t = 1/(1-p_t)
    seLogOR = seLogRR * (1 / (1 - pt));
  }

  // logRR → RD (needs pc)
  if (logRR_est !== null && RD_est === null && pc !== null) {
    const RR = Math.exp(logRR_est);
    RD_est = pc * (RR - 1);
    // SE_RD via delta method: d(RD)/d(logRR) = pc * RR
    seRD = seLogRR * pc * Math.exp(logRR_est);
  }
  if (RD_est !== null && logRR_est === null && pc !== null) {
    const pt = clamp01(pc + RD_est);
    const RR_calc = pt / pc;
    if (RR_calc > 0) {
      logRR_est = Math.log(RR_calc);
      // SE: d(logRR)/d(RD) = 1/pt = 1/(pc+RD)
      seLogRR = seRD !== null ? seRD * (1 / Math.abs(pt)) : null;
    }
  }

  // logOR → logRR already handled above; ensure logOR also derived from RD path
  if (RD_est !== null && logOR_est === null && pc !== null) {
    const pt = clamp01(pc + RD_est);
    if (pc > 0 && pc < 1 && pt > 0 && pt < 1) {
      logOR_est = Math.log((pt / (1 - pt)) / (pc / (1 - pc)));
      const dLogOR_dRD = 1 / (pt * (1 - pt));
      seLogOR = seRD !== null ? seRD * Math.abs(dLogOR_dRD) : null;
    }
  }

  // RD → NNT
  if (RD_est !== null) {
    const nnt = RD_est !== 0 ? 1 / Math.abs(RD_est) : null;
    // NNT CI: if RD_est is negative (treatment reduces events), NNT is positive benefit
    // CI for NNT = 1/|RD_lower| to 1/|RD_upper|
    let nntL = null, nntU = null;
    if (seRD !== null) {
      const rdLow = RD_est - 1.959964 * seRD;
      const rdHigh = RD_est + 1.959964 * seRD;
      if (rdLow !== 0 && rdHigh !== 0 && Math.sign(rdLow) === Math.sign(rdHigh)) {
        nntL = Math.min(1 / Math.abs(rdLow), 1 / Math.abs(rdHigh));
        nntU = Math.max(1 / Math.abs(rdLow), 1 / Math.abs(rdHigh));
      }
    }
    results['NNT'] = nnt !== null ? {
      estimate: nnt,
      lower: nntL,
      upper: nntU,
      quality: pc !== null ? 'exact' : (srcMeasure === 'RD' ? 'exact' : 'exact'),
      formula: 'NNT = 1 / |RD|',
      note: RD_est < 0 ? 'Benefit (NNT to treat)' : 'Harm (NNH)'
    } : { impossible: true, reason: 'RD = 0' };
  }

  // SMD ↔ logOR (Hasselblad-Hedges)
  if (SMD_est !== null && logOR_est === null) {
    logOR_est = SMD_est * Math.PI / Math.sqrt(3);
    seLogOR = seSMD !== null ? seSMD * Math.PI / Math.sqrt(3) : null;
  }
  if (logOR_est !== null && SMD_est === null) {
    SMD_est = logOR_est * Math.sqrt(3) / Math.PI;
    seSMD = seLogOR !== null ? seLogOR * Math.sqrt(3) / Math.PI : null;
  }

  // MD ↔ SMD (needs SD)
  if (MD_est !== null && SMD_est === null && sd !== null) {
    SMD_est = MD_est / sd;
    seSMD = seMD !== null ? seMD / sd : null;
  }
  if (SMD_est !== null && MD_est === null && sd !== null) {
    MD_est = SMD_est * sd;
    seMD = seSMD !== null ? seSMD * sd : null;
  }

  // Fisher's z ↔ r
  if (fz_est !== null && r_est === null) {
    r_est = (Math.exp(2 * fz_est) - 1) / (Math.exp(2 * fz_est) + 1);
  }
  if (r_est !== null && fz_est === null) {
    fz_est = 0.5 * Math.log((1 + r_est) / (1 - r_est));
    // Approx SE
    const dr_low = (Math.exp(2 * (srcLower)) - 1) / (Math.exp(2 * (srcLower)) + 1);
    const dr_high = (Math.exp(2 * (srcUpper)) - 1) / (Math.exp(2 * (srcUpper)) + 1);
    if (!isNaN(dr_low) && !isNaN(dr_high)) {
      seFZ = (srcUpper - srcLower) / 3.919928;
    }
  }

  // --- Build result objects ---
  function makeCI(est, se, logScale) {
    if (se === null || se === undefined || isNaN(se)) return { lower: null, upper: null };
    if (logScale) {
      return {
        lower: Math.exp(est - 1.959964 * se),
        upper: Math.exp(est + 1.959964 * se)
      };
    }
    return {
      lower: est - 1.959964 * se,
      upper: est + 1.959964 * se
    };
  }

  function ratioResult(logEst, seLog, measure, formula, note, quality) {
    if (logEst === null) return null;
    const est = Math.exp(logEst);
    const ci = makeCI(logEst, seLog, true);
    return { estimate: est, lower: ci.lower, upper: ci.upper, quality: quality || 'exact', formula, note };
  }

  function naturalResult(est, se, formula, note, quality) {
    if (est === null) return null;
    const ci = makeCI(est, se, false);
    return { estimate: est, lower: ci.lower, upper: ci.upper, quality: quality || 'exact', formula, note };
  }

  // Build each measure
  results['OR'] = ratioResult(logOR_est, seLogOR, 'OR',
    srcMeasure === 'OR' ? 'Source' :
    (srcMeasure === 'SMD' ? 'OR = exp(SMD × π/√3)' : 'From logOR or logRR conversion'),
    null,
    ['OR', 'logOR'].includes(srcMeasure) ? 'exact' : (['RR', 'logRR', 'RD', 'NNT'].includes(srcMeasure) && pc !== null) ? 'exact' : (['SMD', 'MD'].includes(srcMeasure) ? 'approx' : null)
  );

  results['logOR'] = logOR_est !== null ? {
    estimate: logOR_est,
    lower: seLogOR !== null ? logOR_est - 1.959964 * seLogOR : null,
    upper: seLogOR !== null ? logOR_est + 1.959964 * seLogOR : null,
    quality: results['OR'] ? results['OR'].quality : 'exact',
    formula: 'logOR = ln(OR)',
    note: null
  } : null;

  results['RR'] = ratioResult(logRR_est, seLogRR, 'RR',
    srcMeasure === 'RR' ? 'Source' :
    (srcMeasure === 'OR' && pc !== null ? 'RR = OR / (1 − p_c + p_c × OR)' : 'Derived via RD or logOR'),
    null,
    ['RR', 'logRR'].includes(srcMeasure) ? 'exact' : (pc !== null ? 'exact' : null)
  );

  results['logRR'] = logRR_est !== null ? {
    estimate: logRR_est,
    lower: seLogRR !== null ? logRR_est - 1.959964 * seLogRR : null,
    upper: seLogRR !== null ? logRR_est + 1.959964 * seLogRR : null,
    quality: results['RR'] ? results['RR'].quality : 'exact',
    formula: 'logRR = ln(RR)',
    note: null
  } : null;

  results['RD'] = naturalResult(RD_est, seRD,
    srcMeasure === 'RD' ? 'Source' : 'RD = p_c × (RR − 1)',
    null,
    ['RD', 'NNT'].includes(srcMeasure) ? 'exact' : (pc !== null ? 'exact' : null)
  );

  results['SMD'] = naturalResult(SMD_est, seSMD,
    srcMeasure === 'SMD' ? 'Source' :
    (srcMeasure === 'MD' ? 'SMD = MD / SD_pooled' : 'SMD = ln(OR) × √3 / π'),
    null,
    srcMeasure === 'SMD' ? 'exact' : (srcMeasure === 'MD' && sd !== null ? 'exact' : 'approx')
  );

  results['MD'] = naturalResult(MD_est, seMD,
    srcMeasure === 'MD' ? 'Source' : 'MD = SMD × SD_pooled',
    null,
    srcMeasure === 'MD' ? 'exact' : (sd !== null ? 'exact' : null)
  );

  // HR as source — pass through, no cross-conversion to OR/RR (HR≠RR in general)
  if (srcMeasure === 'HR') {
    results['HR'] = ratioResult(logHR_est, seLogHR, 'HR', 'Source', null, 'exact');
    // HR → cumulative incidence (needs baseline risk and time)
    if (p0 !== null && tH !== null && tH > 0) {
      const HR_val = Math.exp(logHR_est);
      const lambda0 = -Math.log(1 - clamp01(p0)) / tH;
      const riskT = 1 - Math.exp(-HR_val * lambda0 * tH);
      const riskT_lower = 1 - Math.exp(-Math.exp(logHR_est - 1.959964 * seLogHR) * lambda0 * tH);
      const riskT_upper = 1 - Math.exp(-Math.exp(logHR_est + 1.959964 * seLogHR) * lambda0 * tH);
      results['HR_absrisk'] = {
        estimate: riskT,
        lower: Math.min(riskT_lower, riskT_upper),
        upper: Math.max(riskT_lower, riskT_upper),
        quality: 'exact',
        formula: 'Risk(t) = 1 − exp(−HR × λ₀ × t)',
        note: `Cumulative risk at ${tH}yr (baseline ${(p0*100).toFixed(1)}%/yr)`
      };
      const rd_hr = riskT - p0;
      const rd_hr_l = Math.min(riskT_lower - p0, riskT_upper - p0);
      const rd_hr_u = Math.max(riskT_lower - p0, riskT_upper - p0);
      results['HR_rd'] = {
        estimate: rd_hr,
        lower: rd_hr_l,
        upper: rd_hr_u,
        quality: 'exact',
        formula: 'RD = Risk(t) − p₀',
        note: `Absolute risk reduction at ${tH}yr`
      };
      const nnt_hr = rd_hr !== 0 ? 1 / Math.abs(rd_hr) : null;
      if (nnt_hr !== null) {
        const nnt_hr_l = Math.min(1 / Math.abs(rd_hr_l || 1e9), 1 / Math.abs(rd_hr_u || 1e9));
        const nnt_hr_u = Math.max(1 / Math.abs(rd_hr_l || 1e-9), 1 / Math.abs(rd_hr_u || 1e-9));
        results['HR_nnt'] = {
          estimate: nnt_hr,
          lower: isFinite(nnt_hr_l) ? nnt_hr_l : null,
          upper: isFinite(nnt_hr_u) ? nnt_hr_u : null,
          quality: 'exact',
          formula: 'NNT = 1/|RD|',
          note: `NNT based on ${tH}yr absolute risk`
        };
      }
    }
  } else {
    results['HR'] = { impossible: true, reason: 'HR requires time-to-event data; not derivable from summary stats' };
  }

  results['r'] = r_est !== null ? {
    estimate: r_est,
    lower: seFZ !== null ? (Math.exp(2*(fz_est-1.959964*seFZ))-1)/(Math.exp(2*(fz_est-1.959964*seFZ))+1) : null,
    upper: seFZ !== null ? (Math.exp(2*(fz_est+1.959964*seFZ))-1)/(Math.exp(2*(fz_est+1.959964*seFZ))+1) : null,
    quality: ['r','fisherz'].includes(srcMeasure) ? 'exact' : null,
    formula: "r = (e^{2z}-1)/(e^{2z}+1)",
    note: null
  } : null;

  results['fisherz'] = fz_est !== null ? {
    estimate: fz_est,
    lower: seFZ !== null ? fz_est - 1.959964 * seFZ : null,
    upper: seFZ !== null ? fz_est + 1.959964 * seFZ : null,
    quality: ['r','fisherz'].includes(srcMeasure) ? 'exact' : null,
    formula: "z = 0.5 × ln((1+r)/(1-r))",
    note: null
  } : null;

  // Null out impossible conversions (missing info)
  const needsPC = ['OR','RR','RD','NNT','logOR','logRR'];
  for (const m of needsPC) {
    if (results[m] && results[m].quality === null) {
      results[m] = { impossible: true, reason: 'Needs control rate (p_c)' };
    }
    if (results[m] && !results[m].impossible && results[m].estimate === undefined) {
      results[m] = { impossible: true, reason: 'Cannot derive from source without additional info' };
    }
  }
  if (results['SMD'] && results['SMD'].quality === null) {
    results['SMD'] = { impossible: true, reason: 'Needs SD or OR/logOR for Hasselblad-Hedges' };
  }
  if (results['MD'] && results['MD'].quality === null) {
    results['MD'] = { impossible: true, reason: 'Needs pooled SD' };
  }
  if (results['r'] && results['r'].quality === null) {
    results['r'] = { impossible: true, reason: 'Cannot derive r without raw correlation' };
  }
  if (results['fisherz'] && results['fisherz'].quality === null) {
    results['fisherz'] = { impossible: true, reason: 'Cannot derive z without raw correlation' };
  }

  return results;
}

export { seFromCI, clamp01, convertMeasure };
