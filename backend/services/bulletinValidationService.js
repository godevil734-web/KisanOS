/**
 * KisanOS Six-Gate Bulletin Completeness Validation Service (Milestone F.1.2)
 * 
 * Implements the multi-dimensional quality and completeness gates established in F.0.1:
 *   Gate 1: Stream integrity and API-reported total parity
 *   Gate 2: Geographic breadth (distinct states/UTs)
 *   Gate 3: Market diversity (distinct APMC markets)
 *   Gate 4: Commodity diversity & minimum volume floor
 *   Gate 5: Invalid-row rejection and intra-feed duplicate budgets
 *   Gate 6: Day-over-day volume continuity (investigation trigger on >45% drop)
 * 
 * NOTE: Thresholds below are provisional pilot defaults calibrated from empirical
 * OGD snapshots, not permanent national constants. All thresholds can be overridden
 * via configuration or test parameters.
 */

const PILOT_THRESHOLDS = {
  WEEKDAY: {
    minRecords: 3000,
    minStates: 12,
    minMarkets: 350,
    minCommodities: 60,
    maxRejectionPct: 3.0,
    maxDuplicatePct: 5.0,
    parityTolerancePct: 1.0,
    maxVolumeDropPct: 45.0
  },
  SATURDAY: {
    minRecords: 2000,
    minStates: 10,
    minMarkets: 250,
    minCommodities: 40,
    maxRejectionPct: 3.0,
    maxDuplicatePct: 5.0,
    parityTolerancePct: 1.0,
    maxVolumeDropPct: 50.0
  },
  SUNDAY: {
    minRecords: 300,
    minStates: 5,
    minMarkets: 50,
    minCommodities: 20,
    maxRejectionPct: 3.0,
    maxDuplicatePct: 5.0,
    parityTolerancePct: 1.0,
    maxVolumeDropPct: 85.0
  },
  HOLIDAY: {
    minRecords: 300,
    minStates: 5,
    minMarkets: 50,
    minCommodities: 20,
    maxRejectionPct: 3.0,
    maxDuplicatePct: 5.0,
    parityTolerancePct: 1.0,
    maxVolumeDropPct: 85.0
  }
};

/**
 * Resolve schedule category ('WEEKDAY', 'SATURDAY', 'SUNDAY', 'HOLIDAY') in IST.
 */
function getDayScheduleType(dateInput = new Date(), { isHoliday = false } = {}) {
  if (isHoliday) return 'HOLIDAY';

  const d = dateInput instanceof Date ? dateInput : new Date(`${dateInput}T00:00:00+05:30`);
  // Convert to IST weekday (UTC + 5h30m)
  const istMs = d.getTime() + 5.5 * 60 * 60 * 1000;
  const istDay = new Date(istMs).getUTCDay(); // 0 = Sun, 6 = Sat

  if (istDay === 0) return 'SUNDAY';
  if (istDay === 6) return 'SATURDAY';
  return 'WEEKDAY';
}

/**
 * Deduplicate intra-bulletin observations matching the 6-dimension canonical ID.
 * Preserves first valid occurrence and returns deduplicated array + duplicate count.
 */
function deduplicateValidRecords(validRecords) {
  const seenIds = new Set();
  const deduplicated = [];
  let duplicateCount = 0;

  for (const rec of validRecords) {
    if (seenIds.has(rec.id)) {
      duplicateCount++;
      continue;
    }
    seenIds.add(rec.id);
    deduplicated.push(rec);
  }

  return {
    deduplicated,
    duplicateCount
  };
}

/**
 * Execute all 6 validation gates against a parsed daily bulletin.
 * Never fabricates missing metadata totals.
 */
function validateBulletinSixGates({
  metadata = {},
  parsedResult = {},
  streamComplete = true,
  previousSuccessfulRun = null,
  dayType = 'WEEKDAY',
  customThresholds = null,
  failOnVolumeDrop = false
} = {}) {
  const baseThreshold = PILOT_THRESHOLDS[dayType] || PILOT_THRESHOLDS.WEEKDAY;
  const cfg = { ...baseThreshold, ...(customThresholds || {}) };

  const totalRows = parsedResult.totalRows || 0;
  const validCountBeforeDedup = (parsedResult.validRecords || []).length;
  const rejectedCount = (parsedResult.rejectedRecords || []).length;

  const { deduplicated, duplicateCount } = deduplicateValidRecords(parsedResult.validRecords || []);
  const uniqueValidCount = deduplicated.length;

  // Distinct coverage metrics
  const statesSet = new Set();
  const marketsSet = new Set();
  const commoditiesSet = new Set();
  for (const r of deduplicated) {
    statesSet.add(r.state);
    marketsSet.add(r.market);
    commoditiesSet.add(r.commodity);
  }

  const distinctStates = statesSet.size;
  const distinctMarkets = marketsSet.size;
  const distinctCommodities = commoditiesSet.size;

  const gates = {};
  let failureReasonStatus = null;

  // ------------------------------------------------------------------
  // Gate 1: Stream Integrity & API Total Parity
  // ------------------------------------------------------------------
  const apiTotal = metadata.totalRecords !== undefined ? metadata.totalRecords : metadata.apiReportedTotal;
  if (!streamComplete) {
    gates.gate1_stream_parity = {
      passed: false,
      status: 'REJECTED_TRUNCATED',
      detail: `Stream terminated prematurely before clean EOF (parsed ${totalRows} rows)`
    };
    failureReasonStatus = 'REJECTED_TRUNCATED';
  } else if (apiTotal === null || apiTotal === undefined || !Number.isFinite(Number(apiTotal)) || Number(apiTotal) <= 0) {
    gates.gate1_stream_parity = {
      passed: false,
      status: 'METADATA_UNAVAILABLE',
      detail: `API-reported total is missing or invalid (${apiTotal}); cannot certify complete national bulletin`
    };
    failureReasonStatus = 'METADATA_UNAVAILABLE';
  } else {
    const reported = Number(apiTotal);
    const diff = Math.abs(reported - totalRows);
    const mismatchPct = reported > 0 ? (diff / reported) * 100 : 100;
    const parityPassed = mismatchPct <= cfg.parityTolerancePct;

    gates.gate1_stream_parity = {
      passed: parityPassed,
      status: parityPassed ? 'PASS' : 'REJECTED_PARITY_MISMATCH',
      reportedTotal: reported,
      parsedTotal: totalRows,
      mismatchPct: Number(mismatchPct.toFixed(2)),
      detail: parityPassed
        ? `Stream EOF clean; parity within tolerance (${mismatchPct.toFixed(2)}% variance)`
        : `Parsed ${totalRows} rows vs API reported ${reported} (${mismatchPct.toFixed(2)}% > ${cfg.parityTolerancePct}% tolerance)`
    };
    if (!parityPassed && !failureReasonStatus) {
      failureReasonStatus = 'REJECTED_PARITY_MISMATCH';
    }
  }

  // ------------------------------------------------------------------
  // Gate 2: Geographic Breadth
  // ------------------------------------------------------------------
  const geoPassed = distinctStates >= cfg.minStates;
  gates.gate2_geographic_breadth = {
    passed: geoPassed,
    status: geoPassed ? 'PASS' : 'INCOMPLETE_GEOGRAPHY',
    actual: distinctStates,
    threshold: cfg.minStates,
    detail: `${distinctStates} distinct states reported (min required for ${dayType}: ${cfg.minStates})`
  };
  if (!geoPassed && !failureReasonStatus) {
    failureReasonStatus = 'INCOMPLETE_GEOGRAPHY';
  }

  // ------------------------------------------------------------------
  // Gate 3: Market Diversity
  // ------------------------------------------------------------------
  const marketPassed = distinctMarkets >= cfg.minMarkets;
  gates.gate3_market_diversity = {
    passed: marketPassed,
    status: marketPassed ? 'PASS' : 'INCOMPLETE_MARKETS',
    actual: distinctMarkets,
    threshold: cfg.minMarkets,
    detail: `${distinctMarkets} distinct markets reported (min required for ${dayType}: ${cfg.minMarkets})`
  };
  if (!marketPassed && !failureReasonStatus) {
    failureReasonStatus = 'INCOMPLETE_MARKETS';
  }

  // ------------------------------------------------------------------
  // Gate 4: Commodity Diversity & Volume Floor
  // ------------------------------------------------------------------
  const cropPassed = distinctCommodities >= cfg.minCommodities && uniqueValidCount >= cfg.minRecords;
  gates.gate4_commodity_and_volume = {
    passed: cropPassed,
    status: cropPassed ? 'PASS' : (uniqueValidCount < cfg.minRecords ? 'REJECTED_BELOW_MIN_VOLUME' : 'INCOMPLETE_COMMODITIES'),
    distinctCommodities,
    minCommodities: cfg.minCommodities,
    uniqueValidRecords: uniqueValidCount,
    minRecords: cfg.minRecords,
    detail: `${distinctCommodities} commodities & ${uniqueValidCount} valid records (min: ${cfg.minCommodities} crops, ${cfg.minRecords} records)`
  };
  if (!cropPassed && !failureReasonStatus) {
    failureReasonStatus = uniqueValidCount < cfg.minRecords ? 'REJECTED_BELOW_MIN_VOLUME' : 'INCOMPLETE_COMMODITIES';
  }

  // ------------------------------------------------------------------
  // Gate 5: Invalid-Row Rejection & Duplicate Budgets
  // ------------------------------------------------------------------
  const rejectionRatePct = totalRows > 0 ? (rejectedCount / totalRows) * 100 : 100;
  const duplicateRatePct = validCountBeforeDedup > 0 ? (duplicateCount / validCountBeforeDedup) * 100 : 0;

  const rejectionWithinBudget = rejectionRatePct <= cfg.maxRejectionPct;
  const duplicateWithinBudget = duplicateRatePct <= cfg.maxDuplicatePct;
  const qualityPassed = rejectionWithinBudget && duplicateWithinBudget;

  let gate5Status = 'PASS';
  if (!rejectionWithinBudget) gate5Status = 'REJECTED_HIGH_ERROR_RATE';
  else if (!duplicateWithinBudget) gate5Status = 'REJECTED_HIGH_DUPLICATE_RATE';

  gates.gate5_error_and_duplicate_budget = {
    passed: qualityPassed,
    status: gate5Status,
    rejectedCount,
    rejectionRatePct: Number(rejectionRatePct.toFixed(2)),
    maxRejectionPct: cfg.maxRejectionPct,
    duplicateCount,
    duplicateRatePct: Number(duplicateRatePct.toFixed(2)),
    maxDuplicatePct: cfg.maxDuplicatePct,
    detail: `Rejection rate ${rejectionRatePct.toFixed(2)}% (max ${cfg.maxRejectionPct}%), duplicate rate ${duplicateRatePct.toFixed(2)}% (max ${cfg.maxDuplicatePct}%)`
  };
  if (!qualityPassed && !failureReasonStatus) {
    failureReasonStatus = gate5Status;
  }

  // ------------------------------------------------------------------
  // Gate 6: Day-over-Day Volume Continuity
  // Note: A >45% drop triggers INVESTIGATION, not automatic proof of truncation
  // ------------------------------------------------------------------
  let requiresInvestigation = false;
  if (!previousSuccessfulRun || !previousSuccessfulRun.records_parsed || previousSuccessfulRun.records_parsed <= 0) {
    gates.gate6_volume_continuity = {
      passed: true,
      status: 'NO_BASELINE',
      requiresInvestigation: false,
      detail: 'No prior successful run available for day-over-day comparison'
    };
  } else {
    const prevCount = Number(previousSuccessfulRun.records_parsed);
    const dropPct = ((prevCount - uniqueValidCount) / prevCount) * 100;
    const sharpDropDetected = dayType === 'WEEKDAY' && dropPct > cfg.maxVolumeDropPct;

    if (sharpDropDetected) {
      requiresInvestigation = true;
      gates.gate6_volume_continuity = {
        passed: !failOnVolumeDrop,
        status: 'VOLUME_DROP_INVESTIGATION',
        requiresInvestigation: true,
        previousCount: prevCount,
        currentCount: uniqueValidCount,
        dropPct: Number(dropPct.toFixed(2)),
        maxAllowedDropPct: cfg.maxVolumeDropPct,
        detail: `Volume dropped ${dropPct.toFixed(2)}% vs prior run (${prevCount} -> ${uniqueValidCount}); flagged for investigation`
      };
      if (failOnVolumeDrop && !failureReasonStatus) {
        failureReasonStatus = 'VOLUME_DROP_INVESTIGATION';
      }
    } else {
      gates.gate6_volume_continuity = {
        passed: true,
        status: 'PASS',
        requiresInvestigation: false,
        previousCount: prevCount,
        currentCount: uniqueValidCount,
        dropPct: Number(dropPct.toFixed(2)),
        detail: `Volume continuity normal (${dropPct >= 0 ? '-' : '+'}${Math.abs(dropPct).toFixed(2)}% vs prior run)`
      };
    }
  }

  // Determine Final Validation Status
  const hardGatesPassed =
    gates.gate1_stream_parity.passed &&
    gates.gate2_geographic_breadth.passed &&
    gates.gate3_market_diversity.passed &&
    gates.gate4_commodity_and_volume.passed &&
    gates.gate5_error_and_duplicate_budget.passed &&
    gates.gate6_volume_continuity.passed;

  let finalValidationStatus;
  if (!hardGatesPassed) {
    finalValidationStatus = failureReasonStatus || 'REJECTED_INCOMPLETE';
  } else if (requiresInvestigation) {
    finalValidationStatus = dayType === 'SUNDAY' || dayType === 'HOLIDAY'
      ? 'CERTIFIED_HOLIDAY_INVESTIGATION'
      : 'CERTIFIED_WITH_VOLUME_INVESTIGATION';
  } else {
    finalValidationStatus = dayType === 'SUNDAY' || dayType === 'HOLIDAY'
      ? 'CERTIFIED_HOLIDAY_REDUCED'
      : 'CERTIFIED_NATIONAL';
  }

  return {
    passed: hardGatesPassed,
    certifiable: hardGatesPassed && !requiresInvestigation,
    requiresInvestigation,
    dayType,
    finalValidationStatus,
    gates,
    deduplicatedRecords: deduplicated,
    metrics: {
      apiReportedTotal: apiTotal !== undefined ? apiTotal : null,
      totalRowsParsed: totalRows,
      validCountBeforeDedup,
      uniqueValidCount,
      rejectedCount,
      duplicateCount,
      distinctStates,
      distinctMarkets,
      distinctCommodities
    }
  };
}

module.exports = {
  PILOT_THRESHOLDS,
  getDayScheduleType,
  deduplicateValidRecords,
  validateBulletinSixGates
};

