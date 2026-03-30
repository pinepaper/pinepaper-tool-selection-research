#!/usr/bin/env bun
/**
 * Pine Paper LLM v0 — Experiment Runner
 *
 * Single entry point for all paper experiments.
 *
 * Usage:
 *   bun run papers/tool-selection/run-experiments.ts [--quick|--full|--extended]
 *
 * Modes:
 *   --quick     Original 486 cases, 7 baselines, no stats (fast validation)
 *   --full      Original 486 cases, all baselines + ablations + statistics
 *   --extended  Extended 1000+ cases, all baselines + synthetic KG + two-track comparison
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildCorpus,
  createAllBaselines,
  runBaselineComparison,
  generateAggregateTable,
  generatePerTierTable,
  type BaselineConfig,
  type BaselineResult,
} from './baselines.js';
import {
  ToolSelectionBenchmark,
  type ToolSelectionTestCase,
  type Tier,
} from './benchmark.js';
import {
  collectPerQueryResults,
  allPairwiseComparisons,
  bootstrapCI,
  generateCITable,
  generateSignificanceTable,
  generateEffectSizeTable,
  type PerQueryComparison,
} from './statistics.js';
import {
  createAblationBaselines,
  createDampingSweepBaselines,
  createAlphaSweepBaselines,
  generateAblationTable,
  generateSweepTable,
  DAMPING_SWEEP_VALUES,
  ALPHA_SWEEP_VALUES,
} from './ablations.js';
import {
  buildExtendedBenchmark,
  evaluateExtended,
  evaluateExtendedByTier,
  evaluateExtendedBySource,
  getExtendedTierCounts,
  getSourceCounts,
  type ExtendedTestCase,
} from './extended-benchmark.js';
import {
  buildExtendedCorpus,
  createExtendedBaselines,
  buildSyntheticKG,
  createExtendedKGHybridBaseline,
} from './extended-baselines.js';
import {
  generateSyntheticToolsWithMethods,
  measureVocabularyOverlap,
} from './synthetic-tools.js';
import { allMethods } from '../../src/taxonomy/methods.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = resolve(__dirname, 'results');
const TABLES_DIR = resolve(__dirname, 'paper', 'tables');
const FIGURES_DIR = resolve(__dirname, 'paper', 'figures');

// ============================================================================
// Utilities
// ============================================================================

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function saveFile(dir: string, name: string, content: string): void {
  ensureDir(dir);
  writeFileSync(resolve(dir, name), content, 'utf-8');
  console.log(`  Saved: ${name}`);
}

function printSection(title: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function printResults(results: BaselineResult[]): void {
  console.log('\n  Method               R@1    R@3    R@5    NDCG@5 MRR    Time(ms)');
  console.log('  ' + '-'.repeat(70));
  for (const r of results) {
    console.log(
      `  ${r.name.padEnd(20)} ${r.overall.recall_at_1.toFixed(3).padStart(6)} ${r.overall.recall_at_3.toFixed(3).padStart(6)} ${r.overall.recall_at_5.toFixed(3).padStart(6)} ${r.overall.ndcg_at_5.toFixed(3).padStart(6)} ${r.overall.mrr.toFixed(3).padStart(6)} ${r.latencyMs.toFixed(1).padStart(8)}`,
    );
  }
}

function printTierResults(results: BaselineResult[]): void {
  const tiers: Tier[] = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
  console.log('\n  Per-Tier R@5:');
  console.log('  ' + 'Method'.padEnd(20) + tiers.map(t => t.padStart(7)).join(''));
  console.log('  ' + '-'.repeat(62));
  for (const r of results) {
    const vals = tiers.map(t => (r.byTier[t]?.recall_at_5 || 0).toFixed(3).padStart(7)).join('');
    console.log('  ' + r.name.padEnd(20) + vals);
  }
}

function fmt(value: number, decimals: number = 3): string {
  if (!Number.isFinite(value)) return '--';
  return value.toFixed(decimals);
}

function escapeLatex(text: string): string {
  return text
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/#/g, '\\#');
}

// ============================================================================
// Quick Mode
// ============================================================================

async function runQuick(): Promise<void> {
  printSection('Quick Benchmark (486 cases, 7 baselines)');

  const baselines = createAllBaselines();
  const summary = runBaselineComparison(baselines);

  printResults(summary.results);
  printTierResults(summary.results);

  saveFile(RESULTS_DIR, 'aggregate.tex', summary.aggregateLatex);
  saveFile(RESULTS_DIR, 'per-tier.tex', summary.perTierLatex);

  // Save markdown summary
  const md = formatMarkdownSummary(summary.results);
  saveFile(RESULTS_DIR, 'summary.md', md);
}

// ============================================================================
// Full Mode (Track A: original 486 cases)
// ============================================================================

async function runFull(): Promise<void> {
  const corpus = buildCorpus();

  // 1. Main baselines
  printSection('Phase 1: Main Baselines (486 cases)');
  const baselines = createAllBaselines();
  const summary = runBaselineComparison(baselines);
  printResults(summary.results);
  printTierResults(summary.results);

  saveFile(RESULTS_DIR, 'aggregate.tex', summary.aggregateLatex);
  saveFile(RESULTS_DIR, 'per-tier.tex', summary.perTierLatex);

  // 2. Per-query statistics
  printSection('Phase 2: Statistical Analysis');
  console.log('  Collecting per-query results...');
  const perQuery = collectPerQueryResults(baselines);

  console.log('  Computing pairwise comparisons vs KG-Hybrid...');
  const pairwise = allPairwiseComparisons(perQuery, 'KG-Hybrid', 'recall_at_5');

  for (const c of pairwise.comparisons) {
    const sig = c.ttest.significant_at_005 ? '*' : '';
    console.log(
      `    KG-Hybrid vs ${c.method_b.padEnd(20)} Δ=${c.ttest.mean_diff >= 0 ? '+' : ''}${c.ttest.mean_diff.toFixed(3)} p=${c.ttest.p_value.toFixed(4)}${sig} d=${c.cohens_d.d.toFixed(2)} (${c.cohens_d.interpretation})`,
    );
  }

  // Generate CI table
  const ciTable = generateCITable(perQuery);
  saveFile(TABLES_DIR, 'results-ci.tex', ciTable);

  // Generate significance table
  const sigTable = generateSignificanceTable(pairwise, 'KG-Hybrid');
  saveFile(TABLES_DIR, 'significance.tex', sigTable);

  // 3. Ablation study
  printSection('Phase 3: Ablation Study');
  const ablationBaselines = createAblationBaselines(corpus);
  const ablationSummary = runBaselineComparison(ablationBaselines);
  printResults(ablationSummary.results);

  const ablationTable = generateAblationTable(
    ablationSummary.results.map(r => ({
      name: r.name,
      recall_at_1: r.overall.recall_at_1,
      recall_at_5: r.overall.recall_at_5,
      ndcg_at_5: r.overall.ndcg_at_5,
      mrr: r.overall.mrr,
    })),
  );
  saveFile(TABLES_DIR, 'ablation.tex', ablationTable);

  // Ablation statistics
  console.log('  Computing ablation pairwise stats...');
  const ablationPerQuery = collectPerQueryResults(ablationBaselines);
  const ablationPairwise = allPairwiseComparisons(ablationPerQuery, 'KG-Hybrid (Full)', 'recall_at_5');
  const effectTable = generateEffectSizeTable(ablationPairwise, 'KG-Hybrid (Full)');
  saveFile(TABLES_DIR, 'effect-sizes.tex', effectTable);

  // 4. Damping sweep
  printSection('Phase 4: Hyperparameter Sweeps');
  console.log('  Damping factor sweep...');
  const dampingBaselines = createDampingSweepBaselines(corpus);
  const dampingSummary = runBaselineComparison(dampingBaselines);

  const dampingResults = dampingSummary.results.map(r => ({
    recall_at_5: r.overall.recall_at_5,
    ndcg_at_5: r.overall.ndcg_at_5,
    mrr: r.overall.mrr,
  }));
  const dampingTable = generateSweepTable('Damping $\\lambda$', DAMPING_SWEEP_VALUES, dampingResults);
  saveFile(TABLES_DIR, 'sweep-damping.tex', dampingTable);

  // Save damping data for pgfplots
  const dampingData = DAMPING_SWEEP_VALUES.map((v, i) =>
    `${v} ${dampingResults[i].recall_at_5.toFixed(4)} ${dampingResults[i].ndcg_at_5.toFixed(4)} ${dampingResults[i].mrr.toFixed(4)}`,
  ).join('\n');
  saveFile(FIGURES_DIR, 'damping-sweep.dat', `# damping recall_at_5 ndcg_at_5 mrr\n${dampingData}`);

  // 5. Alpha sweep
  console.log('  Alpha fusion weight sweep...');
  const alphaBaselines = createAlphaSweepBaselines(corpus);
  const alphaSummary = runBaselineComparison(alphaBaselines);

  const alphaResults = alphaSummary.results.map(r => ({
    recall_at_5: r.overall.recall_at_5,
    ndcg_at_5: r.overall.ndcg_at_5,
    mrr: r.overall.mrr,
  }));
  const alphaTable = generateSweepTable('Fusion $\\alpha$', ALPHA_SWEEP_VALUES, alphaResults);
  saveFile(TABLES_DIR, 'sweep-alpha.tex', alphaTable);

  // Save alpha data for pgfplots
  const alphaData = ALPHA_SWEEP_VALUES.map((v, i) =>
    `${v} ${alphaResults[i].recall_at_5.toFixed(4)} ${alphaResults[i].ndcg_at_5.toFixed(4)} ${alphaResults[i].mrr.toFixed(4)}`,
  ).join('\n');
  saveFile(FIGURES_DIR, 'alpha-sweep.dat', `# alpha recall_at_5 ndcg_at_5 mrr\n${alphaData}`);

  // 6. Per-tier bar chart data
  printSection('Phase 5: Figure Data');
  const tiers: Tier[] = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
  const barData: string[] = ['# tier method recall_at_5'];
  for (const r of summary.results) {
    for (const t of tiers) {
      barData.push(`${t} ${r.shortName} ${(r.byTier[t]?.recall_at_5 || 0).toFixed(4)}`);
    }
  }
  saveFile(FIGURES_DIR, 'per-tier-bar.dat', barData.join('\n'));

  // R@K curve data
  const ks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const rkData: string[] = [`# k ${baselines.map(b => b.shortName).join(' ')}`];
  const testCases = ToolSelectionBenchmark.getAllTestCases();
  for (const k of ks) {
    const row: number[] = [k];
    for (const b of baselines) {
      let sum = 0;
      for (const tc of testCases) {
        const ranked = b.findTools(tc.prompt);
        const predicted = ranked.map(r => r.tool);
        sum += ToolSelectionBenchmark.recallAtK(predicted, tc.metadata.expectedTools, k);
      }
      row.push(sum / testCases.length);
    }
    rkData.push(row.map(v => v.toFixed(4)).join(' '));
  }
  saveFile(FIGURES_DIR, 'recall-at-k.dat', rkData.join('\n'));

  // Save markdown summary
  const md = formatMarkdownSummary(summary.results);
  saveFile(RESULTS_DIR, 'summary.md', md);

  // Save JSON results for reproducibility
  const testCasesAll = ToolSelectionBenchmark.getAllTestCases();
  const uniqueTools = new Set(testCasesAll.flatMap(tc => tc.metadata.expectedTools));
  const tierCounts: Record<string, number> = {};
  for (const tc of testCasesAll) {
    tierCounts[tc.metadata.tier] = (tierCounts[tc.metadata.tier] || 0) + 1;
  }
  const trackAJson = JSON.stringify({
    trackA: {
      testCaseCount: testCasesAll.length,
      toolCount: uniqueTools.size,
      tierCounts,
      results: summary.results.map(r => ({
        name: r.name,
        shortName: r.shortName,
        overall: r.overall,
        byTier: r.byTier,
        latencyMs: r.latencyMs,
      })),
      ablation: ablationSummary.results.map(r => ({
        name: r.name,
        shortName: r.shortName,
        overall: r.overall,
      })),
      statistics: {
        pairwiseComparisons: pairwise.comparisons.map(c => ({
          method: c.method_b,
          meanDiff: c.ttest.mean_diff,
          pValue: c.ttest.p_value,
          significant: c.ttest.significant_at_005,
          cohensD: c.cohens_d.d,
          effectSize: c.cohens_d.interpretation,
        })),
      },
    },
  }, null, 2);
  saveFile(RESULTS_DIR, 'track-a-results.json', trackAJson);

  printSection('Done');
  console.log(`  Results saved to: ${RESULTS_DIR}`);
  console.log(`  Tables saved to: ${TABLES_DIR}`);
  console.log(`  Figure data saved to: ${FIGURES_DIR}`);
}

// ============================================================================
// Extended Mode (Track A + Track B two-track comparison)
// ============================================================================

interface TrackBResult {
  name: string;
  shortName: string;
  overall: {
    recall_at_1: number;
    recall_at_3: number;
    recall_at_5: number;
    ndcg_at_5: number;
    mrr: number;
  };
  byTier: Record<string, { recall_at_5: number; ndcg_at_5: number; mrr: number }>;
  bySource: Record<string, { recall_at_5: number; ndcg_at_5: number; mrr: number }>;
}

async function runExtended(): Promise<void> {
  // Run Track A first (full mode)
  await runFull();

  // =========================================================================
  // Track B: Extended Benchmark with KG-Integrated Synthetic Tools
  // =========================================================================
  printSection('Track B: Extended Benchmark (1000+ cases, KG-integrated)');

  // 1. Generate synthetic tools with method layer
  console.log('  Generating synthetic tools with method layer...');
  const realMethodInfo = allMethods.map(m => ({
    id: m.id,
    parameters: m.parameters.map(p => ({ name: p.name, type: p.type })),
  }));

  const {
    tools: syntheticToolsWithMethods,
    methods: syntheticMethods,
    similarEdges,
    crossDomainBridges,
    shells,
  } = generateSyntheticToolsWithMethods(400, 12345, realMethodInfo);

  console.log(`  Synthetic tools: ${syntheticToolsWithMethods.length}`);
  console.log(`  Synthetic methods: ${syntheticMethods.length}`);
  console.log(`  Similar edges: ${similarEdges.length}`);
  console.log(`  Cross-domain bridges: ${crossDomainBridges.length}`);
  console.log(`  Shell composites: ${shells.length}`);

  // 2. Build augmented KG
  console.log('  Building augmented knowledge graph...');
  const augmentedKG = buildSyntheticKG(
    syntheticToolsWithMethods,
    syntheticMethods,
    similarEdges,
    crossDomainBridges,
    shells,
  );
  console.log(`  KG nodes: ${augmentedKG.graph.stats.totalNodes}`);
  console.log(`  KG edges: ${augmentedKG.graph.stats.totalEdges}`);

  // 3. Build extended benchmark
  console.log('  Building extended benchmark...');
  const { testCases, allToolNames } = buildExtendedBenchmark({
    syntheticTools: syntheticToolsWithMethods,
  });
  const tierCounts = getExtendedTierCounts(testCases);
  const sourceCounts = getSourceCounts(testCases);

  console.log(`  Total cases: ${testCases.length}`);
  console.log(`  Sources: original=${sourceCounts.original}, paraphrase=${sourceCounts.paraphrase}, synthetic=${sourceCounts.synthetic}`);
  console.log(`  Tiers: ${Object.entries(tierCounts).map(([t, c]) => `${t}=${c}`).join(', ')}`);
  console.log(`  Total tool pool: ${allToolNames.length}`);

  // 3b. Measure vocabulary overlap (diagnostic)
  console.log('  Measuring vocabulary overlap...');
  // Measure against tool description + name + tags (surface text, comparable to real taxonomy measurement)
  const toolSurfaceMap = new Map<string, string>();
  const toolFullMap = new Map<string, string>();
  for (const tool of syntheticToolsWithMethods) {
    // Surface text (for Jaccard comparison with real taxonomy's 24.4%)
    toolSurfaceMap.set(tool.name, [
      tool.name.replace(/_/g, ' '),
      tool.description,
      tool.tags.join(' '),
      tool.category.replace(/_/g, ' '),
    ].join(' '));
    // Full document text (what BM25 actually indexes)
    const fullParts = [
      tool.name.replace(/_/g, ' '),
      tool.description,
      tool.tags.join(' '),
      tool.category.replace(/_/g, ' '),
    ];
    for (const [pName, pDef] of Object.entries(tool.inputSchema.properties)) {
      fullParts.push(pName.replace(/_/g, ' '), pDef.description);
    }
    if (tool.methods) {
      for (const m of tool.methods) {
        fullParts.push(m.name, m.description, m.tags.join(' '));
        for (const ex of m.examples) fullParts.push(ex.instruction);
        for (const p of m.parameters) fullParts.push(p.name.replace(/_/g, ' '), p.description);
      }
    }
    toolFullMap.set(tool.name, fullParts.join(' '));
  }
  const syntheticTestCases = testCases.filter(tc => tc.source === 'synthetic');
  const overlapQueries = syntheticTestCases.map(tc => ({
    prompt: tc.prompt,
    expectedToolName: tc.metadata.expectedTools[0],
  }));
  const { averageOverlap: surfaceOverlap } = measureVocabularyOverlap(overlapQueries, toolSurfaceMap);
  const { averageOverlap: fullOverlap } = measureVocabularyOverlap(overlapQueries, toolFullMap);
  console.log(`  Vocabulary overlap (query → tool surface): ${surfaceOverlap.toFixed(3)} (cf. real taxonomy: 0.244)`);
  console.log(`  Vocabulary overlap (query → tool document): ${fullOverlap.toFixed(3)}`);

  // 4. Create extended baselines (with augmented KG for KG-Hybrid)
  console.log('  Creating extended baselines with augmented KG...');
  const extBaselines = createExtendedBaselines(syntheticToolsWithMethods, augmentedKG);

  // 5. Run Track B evaluation
  console.log('  Running Track B evaluation...');
  const trackBResults: TrackBResult[] = [];

  for (const b of extBaselines) {
    const start = performance.now();
    const overall = evaluateExtended(testCases, b.findTools);
    const byTier = evaluateExtendedByTier(testCases, b.findTools);
    const bySource = evaluateExtendedBySource(testCases, b.findTools);
    const latencyMs = performance.now() - start;

    const tierMetrics: Record<string, { recall_at_5: number; ndcg_at_5: number; mrr: number }> = {};
    for (const [tier, result] of Object.entries(byTier)) {
      tierMetrics[tier] = {
        recall_at_5: result.recall_at_5,
        ndcg_at_5: result.ndcg_at_5,
        mrr: result.mrr,
      };
    }

    const sourceMetrics: Record<string, { recall_at_5: number; ndcg_at_5: number; mrr: number }> = {};
    for (const [source, result] of Object.entries(bySource)) {
      sourceMetrics[source] = {
        recall_at_5: result.recall_at_5,
        ndcg_at_5: result.ndcg_at_5,
        mrr: result.mrr,
      };
    }

    trackBResults.push({
      name: b.name,
      shortName: b.shortName,
      overall: {
        recall_at_1: overall.recall_at_1,
        recall_at_3: overall.recall_at_3,
        recall_at_5: overall.recall_at_5,
        ndcg_at_5: overall.ndcg_at_5,
        mrr: overall.mrr,
      },
      byTier: tierMetrics,
      bySource: sourceMetrics,
    });

    console.log(
      `    ${b.name.padEnd(20)} R@1=${overall.recall_at_1.toFixed(3)} R@5=${overall.recall_at_5.toFixed(3)} NDCG@5=${overall.ndcg_at_5.toFixed(3)} MRR=${overall.mrr.toFixed(3)} (${overall.totalCases} cases, ${latencyMs.toFixed(0)}ms)`,
    );
  }

  // 6. Print per-tier Track B results
  const tiers: Tier[] = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
  console.log('\n  Track B Per-Tier R@5:');
  console.log('  ' + 'Method'.padEnd(20) + tiers.map(t => t.padStart(7)).join(''));
  console.log('  ' + '-'.repeat(62));
  for (const r of trackBResults) {
    const vals = tiers.map(t => (r.byTier[t]?.recall_at_5 || 0).toFixed(3).padStart(7)).join('');
    console.log('  ' + r.name.padEnd(20) + vals);
  }

  // 7. Print source breakdown
  console.log('\n  Track B R@5 by Source:');
  console.log('  ' + 'Method'.padEnd(20) + 'Original  Paraphrase  Synthetic');
  console.log('  ' + '-'.repeat(60));
  for (const r of trackBResults) {
    console.log(
      `  ${r.name.padEnd(20)} ${(r.bySource.original?.recall_at_5 || 0).toFixed(3).padStart(8)} ${(r.bySource.paraphrase?.recall_at_5 || 0).toFixed(3).padStart(10)} ${(r.bySource.synthetic?.recall_at_5 || 0).toFixed(3).padStart(10)}`,
    );
  }

  // 8. Generate LaTeX tables

  // Track comparison table (side-by-side Track A vs Track B)
  const trackComparisonTable = generateTrackComparisonTable(trackBResults);
  saveFile(TABLES_DIR, 'track-comparison.tex', trackComparisonTable);

  // Extended per-tier table
  const extPerTierTable = generateExtendedPerTierTable(trackBResults, tiers);
  saveFile(TABLES_DIR, 'extended-per-tier.tex', extPerTierTable);

  // Extended source breakdown table
  const extSourceTable = generateSourceBreakdownTable(trackBResults);
  saveFile(TABLES_DIR, 'extended-source.tex', extSourceTable);

  // Save JSON results for further analysis
  const jsonResults = JSON.stringify({
    trackB: {
      testCaseCount: testCases.length,
      toolCount: allToolNames.length,
      syntheticToolCount: syntheticToolsWithMethods.length,
      syntheticMethodCount: syntheticMethods.length,
      similarEdgeCount: similarEdges.length,
      crossDomainBridgeCount: crossDomainBridges.length,
      shellCount: shells.length,
      kgNodeCount: augmentedKG.graph.stats.totalNodes,
      kgEdgeCount: augmentedKG.graph.stats.totalEdges,
      vocabularyOverlap: { surface: surfaceOverlap, fullDocument: fullOverlap },
      tierCounts,
      sourceCounts,
      results: trackBResults,
    },
  }, null, 2);
  saveFile(RESULTS_DIR, 'extended-results.json', jsonResults);

  printSection('Extended Benchmark Complete');
}

// ============================================================================
// LaTeX Table Generators (Extended)
// ============================================================================

/**
 * Generate Track A vs Track B comparison table.
 * Shows how each method's metrics change at scale.
 */
function generateTrackComparisonTable(trackBResults: TrackBResult[]): string {
  const lines: string[] = [
    '\\begin{table}[t]',
    '\\centering',
    '\\caption{Track B: Extended benchmark results (500+ tools, 1000+ cases). Best values in bold.}',
    '\\label{tab:track-comparison}',
    '\\begin{tabular}{lrrrrr}',
    '\\toprule',
    'Method & R@1 & R@3 & R@5 & NDCG@5 & MRR \\\\',
    '\\midrule',
  ];

  // Find best per column
  type MetricKey = 'recall_at_1' | 'recall_at_3' | 'recall_at_5' | 'ndcg_at_5' | 'mrr';
  const metricKeys: MetricKey[] = ['recall_at_1', 'recall_at_3', 'recall_at_5', 'ndcg_at_5', 'mrr'];

  const bestIdx = metricKeys.map(key =>
    trackBResults.reduce((best, r, i) =>
      r.overall[key] > trackBResults[best].overall[key] ? i : best, 0),
  );

  for (let i = 0; i < trackBResults.length; i++) {
    const r = trackBResults[i];
    const cells = metricKeys.map((key, ki) => {
      const val = fmt(r.overall[key]);
      return i === bestIdx[ki] ? `\\textbf{${val}}` : val;
    });
    lines.push(`${escapeLatex(r.name)} & ${cells.join(' & ')} \\\\`);
  }

  lines.push('\\bottomrule', '\\end{tabular}', '\\end{table}');
  return lines.join('\n');
}

/**
 * Generate per-tier table for extended benchmark.
 */
function generateExtendedPerTierTable(trackBResults: TrackBResult[], tiers: Tier[]): string {
  const lines: string[] = [
    '\\begin{table}[t]',
    '\\centering',
    '\\caption{Track B: Recall@5 by complexity tier (extended benchmark).}',
    '\\label{tab:extended-per-tier}',
    '\\begin{tabular}{lrrrrrr}',
    '\\toprule',
    'Method & T1 & T2 & T3 & T4 & T5 & T6 \\\\',
    '\\midrule',
  ];

  // Find best per tier
  const bestIdx = tiers.map(tier =>
    trackBResults.reduce((best, r, i) =>
      (r.byTier[tier]?.recall_at_5 || 0) > (trackBResults[best].byTier[tier]?.recall_at_5 || 0) ? i : best, 0),
  );

  for (let i = 0; i < trackBResults.length; i++) {
    const r = trackBResults[i];
    const cells = tiers.map((tier, ti) => {
      const val = fmt(r.byTier[tier]?.recall_at_5 || 0);
      return i === bestIdx[ti] ? `\\textbf{${val}}` : val;
    });
    lines.push(`${escapeLatex(r.name)} & ${cells.join(' & ')} \\\\`);
  }

  lines.push('\\bottomrule', '\\end{tabular}', '\\end{table}');
  return lines.join('\n');
}

/**
 * Generate source breakdown table (original vs paraphrase vs synthetic).
 */
function generateSourceBreakdownTable(trackBResults: TrackBResult[]): string {
  const sources = ['original', 'paraphrase', 'synthetic'];
  const lines: string[] = [
    '\\begin{table}[t]',
    '\\centering',
    '\\caption{Track B: Recall@5 by test case source.}',
    '\\label{tab:extended-source}',
    '\\begin{tabular}{lrrr}',
    '\\toprule',
    'Method & Original & Paraphrase & Synthetic \\\\',
    '\\midrule',
  ];

  // Find best per source
  const bestIdx = sources.map(src =>
    trackBResults.reduce((best, r, i) =>
      (r.bySource[src]?.recall_at_5 || 0) > (trackBResults[best].bySource[src]?.recall_at_5 || 0) ? i : best, 0),
  );

  for (let i = 0; i < trackBResults.length; i++) {
    const r = trackBResults[i];
    const cells = sources.map((src, si) => {
      const val = fmt(r.bySource[src]?.recall_at_5 || 0);
      return i === bestIdx[si] ? `\\textbf{${val}}` : val;
    });
    lines.push(`${escapeLatex(r.name)} & ${cells.join(' & ')} \\\\`);
  }

  lines.push('\\bottomrule', '\\end{tabular}', '\\end{table}');
  return lines.join('\n');
}

// ============================================================================
// Markdown Summary
// ============================================================================

function formatMarkdownSummary(results: BaselineResult[]): string {
  const tiers: Tier[] = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
  const lines: string[] = [
    '# PinePaper-ToolBench — Benchmark Results',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Aggregate Results',
    '',
    '| Method | R@1 | R@3 | R@5 | NDCG@5 | MRR | Time (ms) |',
    '|--------|-----|-----|-----|--------|-----|-----------|',
  ];

  for (const r of results) {
    lines.push(
      `| ${r.name} | ${r.overall.recall_at_1.toFixed(3)} | ${r.overall.recall_at_3.toFixed(3)} | ${r.overall.recall_at_5.toFixed(3)} | ${r.overall.ndcg_at_5.toFixed(3)} | ${r.overall.mrr.toFixed(3)} | ${r.latencyMs.toFixed(1)} |`,
    );
  }

  lines.push('', '## Per-Tier R@5', '', '| Method | ' + tiers.join(' | ') + ' |');
  lines.push('|--------|' + tiers.map(() => '---').join('|') + '|');

  for (const r of results) {
    const vals = tiers.map(t => (r.byTier[t]?.recall_at_5 || 0).toFixed(3));
    lines.push(`| ${r.name} | ${vals.join(' | ')} |`);
  }

  return lines.join('\n');
}

// ============================================================================
// Main
// ============================================================================

const args = process.argv.slice(2);
const mode = args.includes('--extended') ? 'extended'
  : args.includes('--full') ? 'full'
  : 'quick';

console.log(`PinePaper-ToolBench Experiment Runner (mode: ${mode})`);

switch (mode) {
  case 'quick':
    await runQuick();
    break;
  case 'full':
    await runFull();
    break;
  case 'extended':
    await runExtended();
    break;
}
