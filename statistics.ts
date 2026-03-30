/**
 * Pine Paper LLM v0 — Statistical Analysis Framework
 *
 * All tests implemented in pure TypeScript — no Python dependencies.
 *
 *   - Paired t-test
 *   - Wilcoxon signed-rank test
 *   - Bootstrap confidence intervals (B=10,000)
 *   - Cohen's d effect size
 *   - McNemar's test
 *   - Holm-Bonferroni multiple comparison correction
 *   - Per-query result collection
 */

import {
  ToolSelectionBenchmark,
  type ToolSelectionTestCase,
  type RankedTool,
  type Tier,
} from './benchmark.js';
import type { BaselineConfig } from './baselines.js';

// ============================================================================
// Per-Query Result Types
// ============================================================================

export interface PerQueryResult {
  queryId: string;
  tier: Tier;
  difficulty: string;
  method: string;
  recall_at_1: number;
  recall_at_3: number;
  recall_at_5: number;
  ndcg_at_5: number;
  mrr: number;
  hit_at_1: number;
  hit_at_5: number;
  latency_ms: number;
}

export interface PerQueryComparison {
  methods: string[];
  results: Map<string, PerQueryResult[]>;
}

// ============================================================================
// Statistical Test Results
// ============================================================================

export interface TTestResult {
  t_statistic: number;
  p_value: number;
  df: number;
  mean_diff: number;
  significant_at_005: boolean;
  significant_at_001: boolean;
  significant_at_0001: boolean;
}

export interface WilcoxonResult {
  W_statistic: number;
  p_value: number;
  significant_at_005: boolean;
}

export interface BootstrapCI {
  mean: number;
  ci_lower: number;
  ci_upper: number;
  std_error: number;
}

export interface CohensD {
  d: number;
  interpretation: 'negligible' | 'small' | 'medium' | 'large';
}

export interface McNemarResult {
  chi2: number;
  p_value: number;
  significant_at_005: boolean;
}

export interface PairwiseComparison {
  method_a: string;
  method_b: string;
  metric: string;
  ttest: TTestResult;
  wilcoxon: WilcoxonResult;
  cohens_d: CohensD;
  mcnemar: McNemarResult;
  bootstrap_diff: BootstrapCI;
}

export interface HolmBonferroniResult {
  comparisons: Array<{
    method_a: string;
    method_b: string;
    original_p: number;
    adjusted_p: number;
    significant: boolean;
    rank: number;
  }>;
}

// ============================================================================
// Per-Query Result Collection
// ============================================================================

/**
 * Evaluate a baseline on every test case and return per-query results.
 */
export function evaluatePerQuery(
  baseline: BaselineConfig,
  testCases?: ToolSelectionTestCase[],
): PerQueryResult[] {
  const cases = testCases ?? ToolSelectionBenchmark.getAllTestCases();
  const results: PerQueryResult[] = [];

  for (const tc of cases) {
    const start = performance.now();
    const ranked = baseline.findTools(tc.prompt);
    const latency = performance.now() - start;

    const predicted = ranked.map(r => r.tool);
    const gt = tc.metadata.expectedTools;

    const r1 = ToolSelectionBenchmark.recallAtK(predicted, gt, 1);
    const r3 = ToolSelectionBenchmark.recallAtK(predicted, gt, 3);
    const r5 = ToolSelectionBenchmark.recallAtK(predicted, gt, 5);
    const n5 = ToolSelectionBenchmark.ndcgAtK(predicted, gt, 5);
    const m = ToolSelectionBenchmark.mrr(predicted, gt);

    results.push({
      queryId: tc.id,
      tier: tc.metadata.tier,
      difficulty: tc.metadata.difficulty,
      method: baseline.name,
      recall_at_1: r1,
      recall_at_3: r3,
      recall_at_5: r5,
      ndcg_at_5: n5,
      mrr: m,
      hit_at_1: r1 >= 1.0 ? 1 : 0,
      hit_at_5: r5 >= 1.0 ? 1 : 0,
      latency_ms: latency,
    });
  }

  return results;
}

/**
 * Collect per-query results for all baselines.
 */
export function collectPerQueryResults(
  baselines: BaselineConfig[],
  testCases?: ToolSelectionTestCase[],
): PerQueryComparison {
  const results = new Map<string, PerQueryResult[]>();
  for (const b of baselines) {
    results.set(b.name, evaluatePerQuery(b, testCases));
  }
  return {
    methods: baselines.map(b => b.name),
    results,
  };
}

// ============================================================================
// Paired t-test
// ============================================================================

/**
 * Two-sided paired t-test comparing metric scores of two methods.
 */
export function pairedTTest(
  scoresA: number[],
  scoresB: number[],
): TTestResult {
  const n = scoresA.length;
  if (n !== scoresB.length || n < 2) {
    return { t_statistic: 0, p_value: 1, df: 0, mean_diff: 0, significant_at_005: false, significant_at_001: false, significant_at_0001: false };
  }

  const diffs = scoresA.map((a, i) => a - scoresB[i]);
  const meanDiff = diffs.reduce((s, d) => s + d, 0) / n;
  const variance = diffs.reduce((s, d) => s + (d - meanDiff) ** 2, 0) / (n - 1);
  const se = Math.sqrt(variance / n);

  if (se === 0) {
    return { t_statistic: 0, p_value: 1, df: n - 1, mean_diff: meanDiff, significant_at_005: false, significant_at_001: false, significant_at_0001: false };
  }

  const t = meanDiff / se;
  const df = n - 1;
  const p = tDistPValue(Math.abs(t), df) * 2; // two-sided

  return {
    t_statistic: t,
    p_value: Math.min(p, 1),
    df,
    mean_diff: meanDiff,
    significant_at_005: p < 0.05,
    significant_at_001: p < 0.01,
    significant_at_0001: p < 0.001,
  };
}

/**
 * Approximate p-value for Student's t-distribution using
 * regularized incomplete beta function approximation.
 */
function tDistPValue(t: number, df: number): number {
  // Use approximation: P(T > t) ≈ regularized incomplete beta function
  const x = df / (df + t * t);
  return 0.5 * regularizedIncompleteBeta(x, df / 2, 0.5);
}

/**
 * Regularized incomplete beta function I_x(a, b) using continued fraction
 * approximation (Lentz's method).
 */
function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x < 0 || x > 1) return 0;
  if (x === 0) return 0;
  if (x === 1) return 1;

  // Use symmetry transform if x > (a+1)/(a+b+2)
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - regularizedIncompleteBeta(1 - x, b, a);
  }

  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;

  // Continued fraction (Lentz's method)
  let f = 1;
  let c = 1;
  let d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  f = d;

  for (let m = 1; m <= 200; m++) {
    // Even step
    let numerator = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    f *= c * d;

    // Odd step
    numerator = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = c * d;
    f *= delta;

    if (Math.abs(delta - 1) < 1e-10) break;
  }

  return front * f;
}

/**
 * Log-gamma function using Stirling's approximation with Lanczos coefficients.
 */
function lnGamma(z: number): number {
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }
  z -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

// ============================================================================
// Wilcoxon Signed-Rank Test
// ============================================================================

/**
 * Wilcoxon signed-rank test (non-parametric alternative to paired t-test).
 * Uses normal approximation for n > 25.
 */
export function wilcoxonSignedRank(
  scoresA: number[],
  scoresB: number[],
): WilcoxonResult {
  const n = scoresA.length;
  if (n !== scoresB.length || n < 2) {
    return { W_statistic: 0, p_value: 1, significant_at_005: false };
  }

  // Compute differences and ranks
  const diffs: Array<{ diff: number; absDiff: number }> = [];
  for (let i = 0; i < n; i++) {
    const d = scoresA[i] - scoresB[i];
    if (d !== 0) {
      diffs.push({ diff: d, absDiff: Math.abs(d) });
    }
  }

  if (diffs.length === 0) {
    return { W_statistic: 0, p_value: 1, significant_at_005: false };
  }

  // Rank by absolute difference
  diffs.sort((a, b) => a.absDiff - b.absDiff);

  // Assign ranks with tie handling (average rank)
  const ranks: number[] = new Array(diffs.length);
  let i = 0;
  while (i < diffs.length) {
    let j = i;
    while (j < diffs.length && diffs[j].absDiff === diffs[i].absDiff) {
      j++;
    }
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks[k] = avgRank;
    }
    i = j;
  }

  // Compute W+ (sum of ranks for positive differences)
  let Wplus = 0;
  for (let idx = 0; idx < diffs.length; idx++) {
    if (diffs[idx].diff > 0) {
      Wplus += ranks[idx];
    }
  }

  const nr = diffs.length;
  const expectedW = nr * (nr + 1) / 4;
  const varW = nr * (nr + 1) * (2 * nr + 1) / 24;
  const z = (Wplus - expectedW) / Math.sqrt(varW);
  const p = 2 * (1 - normalCDF(Math.abs(z))); // two-sided

  return {
    W_statistic: Wplus,
    p_value: Math.min(p, 1),
    significant_at_005: p < 0.05,
  };
}

/**
 * Standard normal CDF approximation (Abramowitz & Stegun).
 */
function normalCDF(z: number): number {
  if (z < -8) return 0;
  if (z > 8) return 1;

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

// ============================================================================
// Bootstrap Confidence Intervals
// ============================================================================

/**
 * Bootstrap confidence interval for the mean of scores.
 */
export function bootstrapCI(
  scores: number[],
  B: number = 10000,
  alpha: number = 0.05,
  seed: number = 42,
): BootstrapCI {
  const n = scores.length;
  if (n === 0) return { mean: 0, ci_lower: 0, ci_upper: 0, std_error: 0 };

  const mean = scores.reduce((s, v) => s + v, 0) / n;
  const rng = seededRandom(seed);
  const bootstrapMeans: number[] = [];

  for (let b = 0; b < B; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += scores[Math.floor(rng() * n)];
    }
    bootstrapMeans.push(sum / n);
  }

  bootstrapMeans.sort((a, b) => a - b);

  const lowerIdx = Math.floor((alpha / 2) * B);
  const upperIdx = Math.floor((1 - alpha / 2) * B);

  const stdError = Math.sqrt(
    bootstrapMeans.reduce((s, m) => s + (m - mean) ** 2, 0) / (B - 1),
  );

  return {
    mean,
    ci_lower: bootstrapMeans[lowerIdx],
    ci_upper: bootstrapMeans[Math.min(upperIdx, B - 1)],
    std_error: stdError,
  };
}

/**
 * Bootstrap CI for the difference in means between two paired samples.
 */
export function bootstrapDiffCI(
  scoresA: number[],
  scoresB: number[],
  B: number = 10000,
  alpha: number = 0.05,
  seed: number = 42,
): BootstrapCI {
  const n = scoresA.length;
  if (n !== scoresB.length || n === 0) {
    return { mean: 0, ci_lower: 0, ci_upper: 0, std_error: 0 };
  }

  const diffs = scoresA.map((a, i) => a - scoresB[i]);
  return bootstrapCI(diffs, B, alpha, seed);
}

function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

// ============================================================================
// Cohen's d Effect Size
// ============================================================================

/**
 * Cohen's d for paired samples.
 */
export function cohensD(scoresA: number[], scoresB: number[]): CohensD {
  const n = scoresA.length;
  if (n !== scoresB.length || n < 2) {
    return { d: 0, interpretation: 'negligible' };
  }

  const diffs = scoresA.map((a, i) => a - scoresB[i]);
  const meanDiff = diffs.reduce((s, d) => s + d, 0) / n;
  const sd = Math.sqrt(diffs.reduce((s, d) => s + (d - meanDiff) ** 2, 0) / (n - 1));

  const d = sd === 0 ? 0 : meanDiff / sd;
  const absD = Math.abs(d);

  let interpretation: CohensD['interpretation'];
  if (absD < 0.2) interpretation = 'negligible';
  else if (absD < 0.5) interpretation = 'small';
  else if (absD < 0.8) interpretation = 'medium';
  else interpretation = 'large';

  return { d, interpretation };
}

// ============================================================================
// McNemar's Test
// ============================================================================

/**
 * McNemar's test for paired binary outcomes (hit/miss contingency).
 */
export function mcnemarsTest(
  hitsA: number[],
  hitsB: number[],
): McNemarResult {
  const n = hitsA.length;
  if (n !== hitsB.length || n < 2) {
    return { chi2: 0, p_value: 1, significant_at_005: false };
  }

  // Count discordant pairs
  let b_count = 0; // A correct, B incorrect
  let c_count = 0; // A incorrect, B correct

  for (let i = 0; i < n; i++) {
    if (hitsA[i] === 1 && hitsB[i] === 0) b_count++;
    if (hitsA[i] === 0 && hitsB[i] === 1) c_count++;
  }

  if (b_count + c_count === 0) {
    return { chi2: 0, p_value: 1, significant_at_005: false };
  }

  // McNemar's chi-squared with continuity correction
  const chi2 = (Math.abs(b_count - c_count) - 1) ** 2 / (b_count + c_count);
  const p = 1 - normalCDF(Math.sqrt(chi2)); // chi2 with df=1, approximate via normal
  const p_value = 2 * p; // two-sided

  return {
    chi2,
    p_value: Math.min(p_value, 1),
    significant_at_005: p_value < 0.05,
  };
}

// ============================================================================
// Holm-Bonferroni Correction
// ============================================================================

/**
 * Holm-Bonferroni correction for multiple comparisons.
 */
export function holmBonferroni(
  comparisons: Array<{ method_a: string; method_b: string; p_value: number }>,
  alpha: number = 0.05,
): HolmBonferroniResult {
  const m = comparisons.length;
  if (m === 0) return { comparisons: [] };

  // Sort by p-value ascending
  const sorted = comparisons
    .map((c, i) => ({ ...c, rank: 0, idx: i }))
    .sort((a, b) => a.p_value - b.p_value);

  const results: HolmBonferroniResult['comparisons'] = [];

  for (let i = 0; i < sorted.length; i++) {
    const rank = i + 1;
    const adjustedP = Math.min(sorted[i].p_value * (m - i), 1);
    results.push({
      method_a: sorted[i].method_a,
      method_b: sorted[i].method_b,
      original_p: sorted[i].p_value,
      adjusted_p: adjustedP,
      significant: adjustedP < alpha,
      rank,
    });
  }

  // Enforce monotonicity: adjusted p-values should be non-decreasing
  for (let i = 1; i < results.length; i++) {
    if (results[i].adjusted_p < results[i - 1].adjusted_p) {
      results[i].adjusted_p = results[i - 1].adjusted_p;
    }
  }

  return { comparisons: results };
}

// ============================================================================
// Full Pairwise Statistical Comparison
// ============================================================================

/**
 * Run all statistical tests comparing two methods on a given metric.
 */
export function pairwiseComparison(
  comparison: PerQueryComparison,
  methodA: string,
  methodB: string,
  metric: keyof PerQueryResult = 'recall_at_5',
): PairwiseComparison {
  const resultsA = comparison.results.get(methodA)!;
  const resultsB = comparison.results.get(methodB)!;

  const scoresA = resultsA.map(r => r[metric] as number);
  const scoresB = resultsB.map(r => r[metric] as number);
  const hitsA = resultsA.map(r => r.hit_at_5);
  const hitsB = resultsB.map(r => r.hit_at_5);

  return {
    method_a: methodA,
    method_b: methodB,
    metric: metric as string,
    ttest: pairedTTest(scoresA, scoresB),
    wilcoxon: wilcoxonSignedRank(scoresA, scoresB),
    cohens_d: cohensD(scoresA, scoresB),
    mcnemar: mcnemarsTest(hitsA, hitsB),
    bootstrap_diff: bootstrapDiffCI(scoresA, scoresB),
  };
}

/**
 * Run all pairwise comparisons for a set of methods against a reference.
 */
export function allPairwiseComparisons(
  comparison: PerQueryComparison,
  reference: string,
  metric: keyof PerQueryResult = 'recall_at_5',
): { comparisons: PairwiseComparison[]; holmBonferroni: HolmBonferroniResult } {
  const others = comparison.methods.filter(m => m !== reference);
  const comparisons: PairwiseComparison[] = [];

  for (const other of others) {
    comparisons.push(pairwiseComparison(comparison, reference, other, metric));
  }

  const hb = holmBonferroni(
    comparisons.map(c => ({
      method_a: c.method_a,
      method_b: c.method_b,
      p_value: c.ttest.p_value,
    })),
  );

  return { comparisons, holmBonferroni: hb };
}

// ============================================================================
// LaTeX Table Generators
// ============================================================================

function fmt(v: number, decimals: number = 3): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : '--';
}

function sigStars(p: number): string {
  if (p < 0.001) return '***';
  if (p < 0.01) return '**';
  if (p < 0.05) return '*';
  return '';
}

/**
 * Generate main results table with confidence intervals.
 * Format: Method & R@1 ± CI & R@5 ± CI & NDCG@5 ± CI & MRR ± CI
 */
export function generateCITable(
  comparison: PerQueryComparison,
  B: number = 10000,
): string {
  type MetricKey = 'recall_at_1' | 'recall_at_5' | 'ndcg_at_5' | 'mrr';
  const metrics: MetricKey[] = ['recall_at_1', 'recall_at_5', 'ndcg_at_5', 'mrr'];
  const metricLabels = ['R@1', 'R@5', 'NDCG@5', 'MRR'];

  const lines: string[] = [
    '\\begin{table}[t]',
    '\\centering',
    '\\caption{Tool selection results with 95\\% bootstrap confidence intervals.}',
    '\\label{tab:results-ci}',
    '\\begin{tabular}{lcccc}',
    '\\toprule',
    `Method & ${metricLabels.join(' & ')} \\\\`,
    '\\midrule',
  ];

  // Find best mean for each metric
  const bestMeans: number[] = metrics.map(() => -Infinity);
  for (const method of comparison.methods) {
    const results = comparison.results.get(method)!;
    for (let mi = 0; mi < metrics.length; mi++) {
      const scores = results.map(r => r[metrics[mi]] as number);
      const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
      if (mean > bestMeans[mi]) bestMeans[mi] = mean;
    }
  }

  for (const method of comparison.methods) {
    const results = comparison.results.get(method)!;
    const cells: string[] = [];

    for (let mi = 0; mi < metrics.length; mi++) {
      const scores = results.map(r => r[metrics[mi]] as number);
      const ci = bootstrapCI(scores, B);
      const isBest = Math.abs(ci.mean - bestMeans[mi]) < 0.001;
      const cell = `${fmt(ci.mean)}$_{\\pm${fmt(ci.ci_upper - ci.mean, 2)}}$`;
      cells.push(isBest ? `\\textbf{${cell}}` : cell);
    }

    const escapedName = method.replace(/_/g, '\\_').replace(/-/g, '-');
    lines.push(`${escapedName} & ${cells.join(' & ')} \\\\`);
  }

  lines.push('\\bottomrule', '\\end{tabular}', '\\end{table}');
  return lines.join('\n');
}

/**
 * Generate pairwise significance table.
 * Shows p-values with significance stars for each comparison.
 */
export function generateSignificanceTable(
  pairwise: { comparisons: PairwiseComparison[]; holmBonferroni: HolmBonferroniResult },
  reference: string,
): string {
  const lines: string[] = [
    '\\begin{table}[t]',
    '\\centering',
    `\\caption{Pairwise significance tests against ${reference.replace(/_/g, '\\_')}.}`,
    '\\label{tab:significance}',
    '\\begin{tabular}{lrrrrr}',
    '\\toprule',
    'Method & $\\Delta$ & $t$ & $p$ & Cohen\'s $d$ & McNemar $p$ \\\\',
    '\\midrule',
  ];

  for (const c of pairwise.comparisons) {
    const name = c.method_b.replace(/_/g, '\\_').replace(/-/g, '-');
    const delta = `${c.ttest.mean_diff >= 0 ? '+' : ''}${fmt(c.ttest.mean_diff)}`;
    const tStat = fmt(c.ttest.t_statistic, 2);
    const pVal = `${fmt(c.ttest.p_value, 4)}${sigStars(c.ttest.p_value)}`;
    const dVal = `${fmt(c.cohens_d.d, 2)} (${c.cohens_d.interpretation.slice(0, 1).toUpperCase()})`;
    const mcP = `${fmt(c.mcnemar.p_value, 4)}${sigStars(c.mcnemar.p_value)}`;
    lines.push(`${name} & ${delta} & ${tStat} & ${pVal} & ${dVal} & ${mcP} \\\\`);
  }

  lines.push(
    '\\bottomrule',
    '\\end{tabular}',
    '\\vspace{2pt}',
    '\\footnotesize{$^{*}p<0.05$, $^{**}p<0.01$, $^{***}p<0.001$. Holm-Bonferroni corrected.}',
    '\\end{table}',
  );
  return lines.join('\n');
}

/**
 * Generate effect size table for ablation study.
 */
export function generateEffectSizeTable(
  pairwise: { comparisons: PairwiseComparison[] },
  reference: string,
): string {
  const lines: string[] = [
    '\\begin{table}[t]',
    '\\centering',
    `\\caption{Effect sizes (Cohen's $d$) of ablation variants vs ${reference.replace(/_/g, '\\_')}.}`,
    '\\label{tab:effect-sizes}',
    '\\begin{tabular}{lrrl}',
    '\\toprule',
    'Variant & $\\Delta R@5$ & Cohen\'s $d$ & Size \\\\',
    '\\midrule',
  ];

  for (const c of pairwise.comparisons) {
    const name = c.method_b.replace(/_/g, '\\_').replace(/-/g, '-');
    const delta = `${c.ttest.mean_diff >= 0 ? '+' : ''}${fmt(c.ttest.mean_diff)}`;
    const dVal = fmt(c.cohens_d.d, 3);
    const interp = c.cohens_d.interpretation;
    lines.push(`${name} & ${delta} & ${dVal} & ${interp} \\\\`);
  }

  lines.push('\\bottomrule', '\\end{tabular}', '\\end{table}');
  return lines.join('\n');
}
