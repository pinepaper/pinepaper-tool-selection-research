/**
 * Pine Paper LLM v0 — Paper 4: Tool Selection
 *
 * PinePaper-ToolBench benchmark dataset (486 test cases) and
 * 7 baseline retrieval methods for evaluating KG-based tool selection.
 */

// Benchmark dataset & evaluator
export {
  ToolSelectionBenchmark,
  type ToolSelectionTestCase,
  type ToolSelectionMetadata,
  type ToolSelectionResult,
  type RankedTool,
  type Tier,
  type Difficulty,
} from './benchmark.js';

// Baselines & comparison runner
export {
  buildCorpus,
  tokenize,
  createRandomBaseline,
  createKeywordBaseline,
  createBM25Baseline,
  createTFIDFBaseline,
  createKGTextOnlyBaseline,
  createKGToolRankBaseline,
  createKGHybridBaseline,
  createAllBaselines,
  runBaselineComparison,
  generateAggregateTable,
  generatePerTierTable,
  type ToolDocument,
  type BaselineConfig,
  type BaselineResult,
  type ComparisonSummary,
} from './baselines.js';

// Statistical analysis
export {
  evaluatePerQuery,
  collectPerQueryResults,
  pairedTTest,
  wilcoxonSignedRank,
  bootstrapCI,
  bootstrapDiffCI,
  cohensD,
  mcnemarsTest,
  holmBonferroni,
  pairwiseComparison,
  allPairwiseComparisons,
  generateCITable,
  generateSignificanceTable,
  generateEffectSizeTable,
  type PerQueryResult,
  type PerQueryComparison,
  type TTestResult,
  type WilcoxonResult,
  type BootstrapCI,
  type CohensD,
  type McNemarResult,
  type PairwiseComparison,
  type HolmBonferroniResult,
} from './statistics.js';

// Synthetic tools
export {
  generateSyntheticTools,
  getSyntheticCategories,
  type SyntheticToolDefinition,
} from './synthetic-tools.js';

// Extended benchmark
export {
  buildExtendedBenchmark,
  evaluateExtended,
  getExtendedTierCounts,
  getSourceCounts,
} from './extended-benchmark.js';

// Extended baselines
export {
  buildExtendedCorpus,
  createExtendedBaselines,
} from './extended-baselines.js';

// Ablation studies
export {
  createAblationBaselines,
  createDampingSweepBaselines,
  createAlphaSweepBaselines,
  generateAblationTable,
  generateSweepTable,
  ABLATION_VARIANTS,
  DAMPING_SWEEP_VALUES,
  ALPHA_SWEEP_VALUES,
  type AblationVariant,
} from './ablations.js';
