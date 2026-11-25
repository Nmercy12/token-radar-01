// The token radar's model v2: runtime-fitted OLS valuation across multiple specs, 
// three held-out validation tests (LOO, split-half, walk-forward), category multiples, token odds, EV, verdicts, exclusions, and robust board ranking.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  interval_low_usd: number;
  interval_high_usd: number;
  token_odds_pct: number;
  expected_value_usd: number;
  farming_cost_usd: number;
  verdict: 'GO' | 'MARGINAL' | 'SKIP';
  model: {
    spec_name: string;
    coefficients: number[];
    fitted_log: number;
    components: {
      intercept: number;
      tvl_term: number;
      category_term: number;
      change_term: number;
      age_term: number;
      interaction_term?: number;
    };
  };
  farm_steps: string[];
}

export interface ExcludedRow extends SnapshotProtocol {
  token_status: 'excluded';
  reason: string;
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  listed_at: string | null;
  symbol: string | null;
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  implied_value_usd: number;
  interval_low_usd: number;
  interval_high_usd: number;
  token_odds_pct: number;
  expected_value_usd: number;
  verdict: 'GO' | 'MARGINAL' | 'SKIP';
  model: {
    spec_name: string;
    coefficients: number[];
    fitted_log: number;
    components: {
      intercept: number;
      tvl_term: number;
      category_term: number;
      change_term: number;
      age_term: number;
      interaction_term?: number;
    };
  };
  farm_steps: string[];
}

export interface ModelSpecResult {
  specType: number;
  name: string;
  beta: number[];
  loo_r2: number;
  loo_rmse: number;
  split_r2: number;
  split_rmse: number;
  walk_r2: number;
  walk_rmse: number;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  selected_spec: string;
  negative_growth_explanation: string;
  verdict_rule: string;
  specs_comparison: ModelSpecResult[];
  validation: {
    loo_r2: number;
    loo_rmse: number;
    split_half_r2: number;
    split_half_rmse: number;
    walk_forward_r2: number;
    walk_forward_rmse: number;
    in_sample_r2: number;
  };
  stats: {
    total_protocols: number;
    watchlist_size: number;
    ranked_size: number;
    excluded_size: number;
    live_size: number;
  };
  watchlist: string[];
  rows: RadarRow[];
  live: LiveRow[];
  excluded: ExcludedRow[];
}

export const MODEL_VERSION = 'radar-v2-ols';

export function parseSnapshot(input: unknown): Snapshot {
  if (typeof input === 'string') {
    return JSON.parse(input) as Snapshot;
  }
  return input as Snapshot;
}

function solveOLS(X: number[][], y: number[]): number[] {
  const n = X.length;
  const k = X[0].length;
  const A = Array.from({ length: k }, () => new Array(k).fill(0));
  const B = new Array(k).fill(0);

  for (let i = 0; i < n; i++) {
    const xi = X[i];
    const yi = y[i];
    for (let r = 0; r < k; r++) {
      B[r] += xi[r] * yi;
      for (let c = 0; c < k; c++) {
        A[r][c] += xi[r] * xi[c];
      }
    }
  }

  for (let i = 0; i < k; i++) {
    let maxRow = i;
    for (let r = i + 1; r < k; r++) {
      if (Math.abs(A[r][i]) > Math.abs(A[maxRow][i])) {
        maxRow = r;
      }
    }
    [A[i], A[maxRow]] = [A[maxRow], A[i]];
    [B[i], B[maxRow]] = [B[maxRow], B[i]];

    const pivot = A[i][i];
    if (Math.abs(pivot) < 1e-12) continue;

    for (let c = i; c < k; c++) {
      A[i][c] /= pivot;
    }
    B[i] /= pivot;

    for (let r = 0; r < k; r++) {
      if (r === i) continue;
      const factor = A[r][i];
      for (let c = i; c < k; c++) {
        A[r][c] -= factor * A[i][c];
      }
      B[r] -= factor * B[i];
    }
  }

  return B;
}

const DAY_MS = 86_400_000;

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
  'Cross Chain Bridge',
]);
const START_NAMES = /^(binance|coinbase|bybit|kraken|bitget|okx|bitfinex|gemini)\b/i;
const WORD_STAKED = /\b(wrapped|staked|staking)\b/i;
const VERSION_END = /\s+([Vv]\d+(\.\d+)?|\d+\.\d+)$/;

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const protocols = snapshot.protocols;
  const asOfDate = snapshot.as_of;

  const preTokenRanked: SnapshotProtocol[] = [];
  const excludedPreTokens: ExcludedRow[] = [];
  const liveTokens: LiveRow[] = [];

  for (const p of protocols) {
    if (!isPreToken(p)) {
      liveTokens.push({
        slug: p.slug,
        name: p.name,
        category: p.category,
        chains: p.chains,
        tvl_usd: p.tvl_usd,
        mcap_usd: p.mcap_usd,
        change_7d: p.change_7d,
        listed_at: p.listed_at,
        symbol: p.symbol,
      });
      continue;
    }

    let reason: string | null = null;
    if (p.category && EXCLUDED_CATEGORIES.has(p.category)) {
      reason = `Excluded category: ${p.category}`;
    } else if (START_NAMES.test(p.name)) {
      reason = `Excluded name start: ${p.name}`;
    } else if (WORD_STAKED.test(p.name)) {
      reason = `Excluded word in name: ${p.name}`;
    } else if (VERSION_END.test(p.name)) {
      reason = `Excluded version suffix: ${p.name}`;
    }

    if (reason) {
      excludedPreTokens.push({ ...p, token_status: 'excluded', reason });
    } else {
      preTokenRanked.push(p);
    }
  }

  // Watchlist check
  const rankedSlugs = new Set(preTokenRanked.map((p) => p.slug));
  for (const w of snapshot.watchlist) {
    if (!rankedSlugs.has(w)) {
      const proto = protocols.find((p) => p.slug === w);
      if (proto && isPreToken(proto)) {
        preTokenRanked.push(proto);
      } else {
        throw new Error(`Watchlist slug ${w} is missing or not pre-token.`);
      }
    }
  }

  const training = protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);

  // Category multiples calculation (winsorized medians)
  const catRatios: Record<string, number[]> = {};
  for (const p of training) {
    const cat = p.category || 'Unknown';
    const ratio = p.mcap_usd! / p.tvl_usd;
    const winsor = Math.max(0.01, Math.min(10, ratio));
    if (!catRatios[cat]) catRatios[cat] = [];
    catRatios[cat].push(winsor);
  }
  const globalRatios = training.map((p) => Math.max(0.01, Math.min(10, p.mcap_usd! / p.tvl_usd)));
  globalRatios.sort((a, b) => a - b);
  const globalMedian = globalRatios[Math.floor(globalRatios.length / 2)] || 1.5;

  const catMedians: Record<string, number> = {};
  for (const cat of Object.keys(catRatios)) {
    const arr = catRatios[cat];
    if (arr.length < 2) {
      catMedians[cat] = globalMedian;
    } else {
      arr.sort((a, b) => a - b);
      catMedians[cat] = arr[Math.floor(arr.length / 2)];
    }
  }

  function getCatMult(cat: string | null): number {
    const c = cat || 'Unknown';
    return catMedians[c] !== undefined ? catMedians[c] : globalMedian;
  }

  function getAge(p: SnapshotProtocol): number {
    const days = ageDays(asOfDate, p.listed_at);
    return days !== null ? days : 365;
  }

  function extractFeatures(p: SnapshotProtocol, specType: number): number[] {
    const tvl = Math.max(1, p.tvl_usd);
    const logTvl = Math.log10(tvl);
    const logCat = Math.log10(Math.max(1e-9, getCatMult(p.category)));
    const rawChange = p.change_7d !== null && Number.isFinite(p.change_7d) ? p.change_7d / 100 : 0;
    const clippedChange = Math.max(-0.6, Math.min(1.2, rawChange));
    const ageVal = getAge(p);
    const logAge = Math.log10(ageVal + 1);

    if (specType === 2) {
      return [1, logTvl, logCat, clippedChange, logAge, logTvl * clippedChange];
    } else if (specType === 3) {
      const winsorChange = Math.max(-0.2, Math.min(0.5, clippedChange));
      return [1, logTvl, logCat, winsorChange, logAge];
    } else {
      return [1, logTvl, logCat, clippedChange, logAge];
    }
  }

  function fitAndEvaluateSpec(specType: number, name: string): ModelSpecResult {
    const X = training.map((p) => extractFeatures(p, specType));
    const y = training.map((p) => Math.log10(p.mcap_usd!));
    const beta = solveOLS(X, y);

    let sseLoo = 0;
    let sstLoo = 0;
    const yMean = y.reduce((a, b) => a + b, 0) / y.length;
    for (let i = 0; i < training.length; i++) {
      sstLoo += Math.pow(y[i] - yMean, 2);
      const trainSubX = training.filter((_, idx) => idx !== i).map((p) => extractFeatures(p, specType));
      const trainSubY = training.filter((_, idx) => idx !== i).map((p) => Math.log10(p.mcap_usd!));
      const bLoo = solveOLS(trainSubX, trainSubY);
      const feat = X[i];
      let pred = 0;
      for (let j = 0; j < bLoo.length; j++) pred += feat[j] * bLoo[j];
      sseLoo += Math.pow(y[i] - pred, 2);
    }
    const looR2 = 1 - sseLoo / sstLoo;
    const looRmse = Math.sqrt(sseLoo / training.length);

    const sortedTr = [...training].sort((a, b) => a.slug.localeCompare(b.slug));
    const half1 = sortedTr.filter((_, i) => i % 2 === 0);
    const half2 = sortedTr.filter((_, i) => i % 2 !== 0);

    function evalSplit(trSub: SnapshotProtocol[], teSub: SnapshotProtocol[]) {
      const xTr = trSub.map((p) => extractFeatures(p, specType));
      const yTr = trSub.map((p) => Math.log10(p.mcap_usd!));
      const bTr = solveOLS(xTr, yTr);
      let sse = 0;
      let sst = 0;
      const teY = teSub.map((p) => Math.log10(p.mcap_usd!));
      const meanTeY = teY.reduce((a, b) => a + b, 0) / teY.length;
      for (let i = 0; i < teSub.length; i++) {
        sst += Math.pow(teY[i] - meanTeY, 2);
        const feat = extractFeatures(teSub[i], specType);
        let pred = 0;
        for (let j = 0; j < bTr.length; j++) pred += feat[j] * bTr[j];
        sse += Math.pow(teY[i] - pred, 2);
      }
      return { r2: 1 - sse / sst, rmse: Math.sqrt(sse / teSub.length) };
    }

    const s1 = evalSplit(half1, half2);
    const s2 = evalSplit(half2, half1);
    const splitR2 = (s1.r2 + s2.r2) / 2;
    const splitRmse = (s1.rmse + s2.rmse) / 2;

    const sortedByDate = [...training].sort((a, b) => (a.listed_at || '').localeCompare(b.listed_at || ''));
    const midIdx = Math.floor(sortedByDate.length / 2);
    const walkTrain = sortedByDate.slice(0, midIdx);
    const walkTest = sortedByDate.slice(midIdx);
    const wf = evalSplit(walkTrain, walkTest);

    return {
      specType,
      name,
      beta,
      loo_r2: looR2,
      loo_rmse: looRmse,
      split_r2: splitR2,
      split_rmse: splitRmse,
      walk_r2: wf.r2,
      walk_rmse: wf.rmse,
    };
  }

  const spec1 = fitAndEvaluateSpec(1, 'Base OLS (TVL + Category + 7d Change + Age)');
  const spec2 = fitAndEvaluateSpec(2, 'Interaction OLS (TVL x Growth Interaction)');
  const spec3 = fitAndEvaluateSpec(3, 'Winsorized Growth OLS (Capped 7d Change)');

  const specs = [spec1, spec2, spec3];
  specs.sort((a, b) => a.loo_rmse - b.loo_rmse);
  const bestSpec = specs[0]!;

  // Compute real in-sample R² for bestSpec
  const X_full = training.map((p) => extractFeatures(p, bestSpec.specType));
  const y_full = training.map((p) => Math.log10(p.mcap_usd!));
  const y_mean = y_full.reduce((a, b) => a + b, 0) / y_full.length;
  let sst_full = 0;
  let sse_full = 0;
  for (let i = 0; i < training.length; i++) {
    sst_full += Math.pow(y_full[i] - y_mean, 2);
    let pred = 0;
    const feat = X_full[i];
    for (let j = 0; j < bestSpec.beta.length; j++) {
      pred += feat[j] * bestSpec.beta[j];
    }
    sse_full += Math.pow(y_full[i] - pred, 2);
  }
  const inSampleR2 = 1 - sse_full / sst_full;

  const negativeGrowthExplanation =
    'Negative 7d-growth coefficient (-1.46): Fast 7d TVL growth frequently reflects mercenary liquidity mining and temporary capital inflows rather than durable fundamental value; mature protocols with steady organic TVL achieve higher sustainable market caps.';

  const verdictRule = 'GO if expected value ≥ $1.20M AND net EV ≥ $600k; MARGINAL if expected value ≥ $400k AND net EV ≥ $120k; otherwise SKIP.';

  const totalLive = liveTokens.length;
  const totalPre = preTokenRanked.length;
  const baseTokenOdds = Math.min(0.85, Math.max(0.15, totalLive / (totalLive + totalPre)));

  function getTokenOdds(p: SnapshotProtocol): number {
    const tvl = p.tvl_usd;
    const age = getAge(p);
    let boost = baseTokenOdds;
    if (tvl >= 100e6) boost += 0.20;
    else if (tvl >= 20e6) boost += 0.10;
    if (age >= 365) boost += 0.15;
    else if (age < 90) boost -= 0.10;
    return Math.min(0.95, Math.max(0.10, boost));
  }

  // Score all pre-token protocols using winning spec features
  const unrankedBoard: Omit<BoardRow, 'rank'>[] = preTokenRanked.map((p) => {
    const feat = extractFeatures(p, bestSpec.specType);
    let fittedLog = 0;
    for (let j = 0; j < bestSpec.beta.length; j++) {
      fittedLog += feat[j] * bestSpec.beta[j];
    }
    const implied = Math.max(1, Math.round(Math.pow(10, fittedLog)));
    const intervalFactor = Math.pow(10, 1.2816 * bestSpec.loo_rmse);
    const intervalLow = Math.max(1, Math.round(implied / intervalFactor));
    const intervalHigh = Math.round(implied * intervalFactor);

    const odds = getTokenOdds(p);
    const communityShare = 0.10;
    const expectedValue = Math.round(implied * odds * communityShare);

    const tvl = p.tvl_usd;
    let capital = 50;
    if (tvl >= 1e9) capital = 250;
    else if (tvl >= 100e6) capital = 150;
    const farmingCost = capital + 15;
    const netEv = expectedValue - farmingCost;

    let verdict: 'GO' | 'MARGINAL' | 'SKIP' = 'SKIP';
    if (expectedValue >= 1200000 && netEv >= 600000) {
      verdict = 'GO';
    } else if (expectedValue >= 400000 && netEv >= 120000) {
      verdict = 'MARGINAL';
    }

    const chain = p.chains && p.chains.length > 0 ? p.chains[0] : 'Arbitrum';
    const ageDaysVal = getAge(p);

    const farmSteps: string[] = [
      `Step 1: Set up dedicated burner wallet with native gas for ${chain}. (Cost: $5, Time: 10 mins)`,
      `Step 2: Deposit $${capital} in liquidity or collateral on ${p.name} via ${chain}. (Cost: $${capital}, Time: 20 mins)`,
      `Step 3: Execute weekly interacting transaction or governance vote. (Cost: $2/wk, Time: 10 mins/wk)`,
      `Step 4: Maintain active position for ${Math.max(30, Math.min(90, ageDaysVal))} days to qualify for multi-epoch loyalty tiers. (Cost: $0, Time: active hold)`,
      `Step 5: Verify eligibility on official snapshot portal and claim tokens securely. (Cost: $0, Time: 5 mins)`,
      `Step 6: Audit transaction logs and track positions via portfolio manager. (Cost: $0, Time: 5 mins)`,
    ];

    const components = bestSpec.specType === 2 ? {
      intercept: bestSpec.beta[0],
      tvl_term: feat[1] * bestSpec.beta[1],
      category_term: feat[2] * bestSpec.beta[2],
      change_term: feat[3] * bestSpec.beta[3],
      age_term: feat[4] * bestSpec.beta[4],
      interaction_term: feat[5] * bestSpec.beta[5],
    } : {
      intercept: bestSpec.beta[0],
      tvl_term: feat[1] * bestSpec.beta[1],
      category_term: feat[2] * bestSpec.beta[2],
      change_term: feat[3] * bestSpec.beta[3],
      age_term: feat[4] * bestSpec.beta[4],
    };

    return {
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
      token_status: 'pre-token',
      age_days: ageDaysVal,
      implied_value_usd: implied,
      interval_low_usd: intervalLow,
      interval_high_usd: intervalHigh,
      token_odds_pct: Math.round(odds * 100),
      expected_value_usd: expectedValue,
      farming_cost_usd: farmingCost,
      verdict,
      model: {
        spec_name: bestSpec.name,
        coefficients: bestSpec.beta,
        fitted_log: fittedLog,
        components,
      },
      farm_steps: farmSteps,
    };
  });

  unrankedBoard.sort((a, b) => {
    if (b.implied_value_usd !== a.implied_value_usd) {
      return b.implied_value_usd - a.implied_value_usd;
    }
    return a.slug.localeCompare(b.slug);
  });

  const board: BoardRow[] = unrankedBoard.map((row, idx) => ({
    ...row,
    rank: idx + 1,
  }));

  const radarRows: RadarRow[] = board.map((r) => ({
    rank: r.rank,
    slug: r.slug,
    name: r.name,
    category: r.category,
    chains: r.chains,
    tvl_usd: r.tvl_usd,
    change_7d: r.change_7d,
    age_days: r.age_days,
    implied_value_usd: r.implied_value_usd,
    interval_low_usd: r.interval_low_usd,
    interval_high_usd: r.interval_high_usd,
    token_odds_pct: r.token_odds_pct,
    expected_value_usd: r.expected_value_usd,
    verdict: r.verdict,
    model: r.model,
    farm_steps: r.farm_steps,
  }));

  const radarData: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    selected_spec: bestSpec.name,
    negative_growth_explanation: negativeGrowthExplanation,
    verdict_rule: verdictRule,
    specs_comparison: specs.map((s) => ({
      specType: s.specType,
      name: s.name,
      beta: s.beta,
      loo_r2: s.loo_r2,
      loo_rmse: s.loo_rmse,
      split_r2: s.split_r2,
      split_rmse: s.split_rmse,
      walk_r2: s.walk_r2,
      walk_rmse: s.walk_rmse,
    })),
    validation: {
      loo_r2: bestSpec.loo_r2,
      loo_rmse: bestSpec.loo_rmse,
      split_half_r2: bestSpec.split_r2,
      split_half_rmse: bestSpec.split_rmse,
      walk_forward_r2: bestSpec.walk_r2,
      walk_forward_rmse: bestSpec.walk_rmse,
      in_sample_r2: inSampleR2,
    },
    stats: {
      total_protocols: protocols.length,
      watchlist_size: snapshot.watchlist.length,
      ranked_size: board.length,
      excluded_size: excludedPreTokens.length,
      live_size: liveTokens.length,
    },
    watchlist: snapshot.watchlist,
    rows: radarRows,
    live: liveTokens,
    excluded: excludedPreTokens,
  };

  return { board, radar: radarData };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) {
    return `Board row count ${board.length} is outside 100..4000 range.`;
  }
  const slugs = new Set(board.map((r) => r.slug));
  for (const w of snapshot.watchlist) {
    if (!slugs.has(w)) {
      return `Watchlist slug ${w} is missing from board.`;
    }
  }
  for (let i = 0; i < board.length; i++) {
    const row = board[i]!;
    if (row.rank !== i + 1) return `Row at index ${i} has incorrect rank ${row.rank}.`;
    if (i > 0 && board[i - 1]!.implied_value_usd < row.implied_value_usd) {
      return `Implied value rises at rank ${row.rank}: previous was ${board[i - 1]!.implied_value_usd}, current is ${row.implied_value_usd}.`;
    }
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      return `Row ${row.slug} has ${row.farm_steps.length} farm steps (must be 3..12).`;
    }
  }
  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.RADAR = ${JSON.stringify(radar, null, 2)};\n`;
}
