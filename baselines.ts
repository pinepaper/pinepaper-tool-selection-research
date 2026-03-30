/**
 * Pine Paper LLM v0 — Tool Selection Baselines
 *
 * Six baseline retrieval methods for comparison against KGQueryEngine.findTools().
 * Shared document corpus built from taxonomy methods. Evaluation via
 * ToolSelectionBenchmark IR metrics (Recall@K, NDCG@K, MRR).
 *
 * Baselines:
 *   1. Random        — deterministic seeded shuffle
 *   2. Keyword       — substring term matching
 *   3. BM25          — Okapi BM25 (k1=1.2, b=0.75)
 *   4. TF-IDF        — log-TF × IDF cosine similarity
 *   5. KG-Text-Only  — substring matching (ablation label)
 *   6. KG-ToolRank   — full KGQueryEngine.findTools() adapter
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { methodsByMcpTool } from '../../src/taxonomy/methods.js';
import type { DesignMethod } from '../../src/taxonomy/schema.js';
import {
  ToolSelectionBenchmark,
  type RankedTool,
  type ToolSelectionResult,
  type ToolSelectionTestCase,
  type Tier,
} from './benchmark.js';
import { KGQueryEngine } from '../../src/cognitive/kg-query-engine.js';
import { buildKnowledgeGraph } from '../../src/knowledge-graph/builder.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TOOL_MANIFEST = resolve(__dirname, '../../data/tool-manifest.json');

// ============================================================================
// Document Corpus
// ============================================================================

export interface ToolDocument {
  toolName: string;
  text: string;
  terms: string[];
  termFrequencies: Map<string, number>;
  docLength: number;
}

/**
 * Tokenize text the same way KGQueryEngine does: lowercase, strip
 * punctuation, split whitespace, filter tokens with length > 2.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Build a document corpus from the taxonomy. Each document represents one
 * unique MCP tool, aggregating text from all methods that map to it.
 */
export function buildCorpus(): ToolDocument[] {
  const docs: ToolDocument[] = [];

  for (const [toolName, methods] of Object.entries(methodsByMcpTool)) {
    const parts: string[] = [toolName.replace(/_/g, ' ')];

    for (const m of methods as DesignMethod[]) {
      parts.push(m.name);
      parts.push(m.description);
      parts.push(m.tags.join(' '));
      parts.push(m.category);
      if (m.subcategory) parts.push(m.subcategory);
      for (const ex of m.examples) {
        parts.push(ex.instruction);
      }
    }

    const text = parts.join(' ');
    const terms = tokenize(text);
    const termFrequencies = new Map<string, number>();
    for (const t of terms) {
      termFrequencies.set(t, (termFrequencies.get(t) || 0) + 1);
    }

    docs.push({
      toolName,
      text,
      terms,
      termFrequencies,
      docLength: terms.length,
    });
  }

  return docs;
}

// ============================================================================
// Baseline Interface
// ============================================================================

export interface BaselineConfig {
  name: string;
  shortName: string;
  findTools: (instruction: string) => RankedTool[];
}

export interface BaselineResult {
  name: string;
  shortName: string;
  overall: ToolSelectionResult;
  byTier: Record<string, ToolSelectionResult>;
  latencyMs: number;
}

export interface ComparisonSummary {
  results: BaselineResult[];
  aggregateLatex: string;
  perTierLatex: string;
}

// ============================================================================
// 1. Random Baseline
// ============================================================================

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return hash;
}

/**
 * Seeded pseudo-random number generator (simple LCG).
 */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

export function createRandomBaseline(corpus: ToolDocument[]): BaselineConfig {
  const toolNames = corpus.map((d) => d.toolName);

  return {
    name: 'Random',
    shortName: 'Random',
    findTools(instruction: string): RankedTool[] {
      const seed = hashCode(instruction);
      const rng = seededRandom(seed);

      // Fisher-Yates shuffle with seeded RNG
      const shuffled = [...toolNames];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      return shuffled.slice(0, 10).map((tool, idx) => ({
        tool,
        score: 1 - idx * 0.1,
      }));
    },
  };
}

// ============================================================================
// 2. Keyword Match Baseline
// ============================================================================

export function createKeywordBaseline(corpus: ToolDocument[]): BaselineConfig {
  return {
    name: 'Keyword Match',
    shortName: 'Keyword',
    findTools(instruction: string): RankedTool[] {
      const queryTerms = tokenize(instruction);
      if (queryTerms.length === 0) return [];

      const scored: Array<{ tool: string; score: number }> = [];

      for (const doc of corpus) {
        let matches = 0;
        const docTextLower = doc.text.toLowerCase();
        for (const term of queryTerms) {
          if (docTextLower.includes(term)) {
            matches++;
          }
        }
        const score = matches / queryTerms.length;
        if (score > 0) {
          scored.push({ tool: doc.toolName, score });
        }
      }

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, 10);
    },
  };
}

// ============================================================================
// 3. BM25 Baseline
// ============================================================================

export function createBM25Baseline(
  corpus: ToolDocument[],
  k1: number = 1.2,
  b: number = 0.75,
): BaselineConfig {
  const N = corpus.length;

  // Pre-compute document frequencies
  const df = new Map<string, number>();
  for (const doc of corpus) {
    const uniqueTerms = new Set(doc.terms);
    for (const term of uniqueTerms) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }

  // Average document length
  const avgdl = corpus.reduce((sum, d) => sum + d.docLength, 0) / (N || 1);

  return {
    name: 'BM25',
    shortName: 'BM25',
    findTools(instruction: string): RankedTool[] {
      const queryTerms = tokenize(instruction);
      if (queryTerms.length === 0) return [];

      const scored: Array<{ tool: string; score: number }> = [];

      for (const doc of corpus) {
        let score = 0;

        for (const term of queryTerms) {
          const tf = doc.termFrequencies.get(term) || 0;
          if (tf === 0) continue;

          const docFreq = df.get(term) || 0;
          const idf = Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1);

          const numerator = tf * (k1 + 1);
          const denominator = tf + k1 * (1 - b + b * (doc.docLength / avgdl));

          score += idf * (numerator / denominator);
        }

        if (score > 0) {
          scored.push({ tool: doc.toolName, score });
        }
      }

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, 10);
    },
  };
}

// ============================================================================
// 4. TF-IDF + Cosine Baseline
// ============================================================================

export function createTFIDFBaseline(corpus: ToolDocument[]): BaselineConfig {
  const N = corpus.length;

  // Pre-compute document frequencies
  const df = new Map<string, number>();
  for (const doc of corpus) {
    const uniqueTerms = new Set(doc.terms);
    for (const term of uniqueTerms) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }

  // Pre-compute doc TF-IDF vectors and magnitudes
  const docVectors: Array<{ tool: string; vec: Map<string, number>; magnitude: number }> = [];

  for (const doc of corpus) {
    const vec = new Map<string, number>();

    for (const [term, count] of doc.termFrequencies) {
      const tf = 1 + Math.log(count);
      const docFreq = df.get(term) || 1;
      const idf = Math.log(N / docFreq);
      vec.set(term, tf * idf);
    }

    let mag = 0;
    for (const v of vec.values()) {
      mag += v * v;
    }
    mag = Math.sqrt(mag);

    docVectors.push({ tool: doc.toolName, vec, magnitude: mag });
  }

  return {
    name: 'TF-IDF + Cosine',
    shortName: 'TF-IDF',
    findTools(instruction: string): RankedTool[] {
      const queryTerms = tokenize(instruction);
      if (queryTerms.length === 0) return [];

      // Build query TF-IDF vector
      const queryTF = new Map<string, number>();
      for (const t of queryTerms) {
        queryTF.set(t, (queryTF.get(t) || 0) + 1);
      }

      const queryVec = new Map<string, number>();
      let queryMag = 0;
      for (const [term, count] of queryTF) {
        const tf = 1 + Math.log(count);
        const docFreq = df.get(term) || 1;
        const idf = Math.log(N / docFreq);
        const val = tf * idf;
        queryVec.set(term, val);
        queryMag += val * val;
      }
      queryMag = Math.sqrt(queryMag);

      if (queryMag === 0) return [];

      const scored: Array<{ tool: string; score: number }> = [];

      for (const { tool, vec, magnitude } of docVectors) {
        if (magnitude === 0) continue;

        // Dot product over shared terms only
        let dot = 0;
        for (const [term, qVal] of queryVec) {
          const dVal = vec.get(term);
          if (dVal !== undefined) {
            dot += qVal * dVal;
          }
        }

        const cosine = dot / (queryMag * magnitude);
        if (cosine > 0) {
          scored.push({ tool, score: cosine });
        }
      }

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, 10);
    },
  };
}

// ============================================================================
// 5. KG-Text-Only Baseline (ablation — same as Keyword)
// ============================================================================

export function createKGTextOnlyBaseline(corpus: ToolDocument[]): BaselineConfig {
  const keyword = createKeywordBaseline(corpus);
  return {
    name: 'KG-Text-Only',
    shortName: 'KG-Text',
    findTools: keyword.findTools,
  };
}

// ============================================================================
// 6. KG-ToolRank Baseline (full KGQueryEngine adapter)
// ============================================================================

/**
 * Mapping from MCP manifest tool names → taxonomy/benchmark tool names.
 * The KG stores tools under the manifest's actual names, but the benchmark
 * uses the taxonomy's mcpTool names. These diverge for some tools.
 */
const KG_TO_BENCHMARK_TOOL_MAP: Record<string, string> = {
  pinepaper_apply_effect: 'pinepaper_add_effect',
  pinepaper_create_scene: 'pinepaper_scene',
  pinepaper_export_scene: 'pinepaper_export',
  pinepaper_export_svg: 'pinepaper_export',
  pinepaper_keyframe_animate: 'pinepaper_animate_keyframe',
  pinepaper_play_timeline: 'pinepaper_timeline',
  pinepaper_camera_animate: 'pinepaper_animate_camera',
  pinepaper_camera_move_to: 'pinepaper_set_camera',
  pinepaper_camera_zoom: 'pinepaper_set_camera',
  pinepaper_camera_pan: 'pinepaper_set_camera',
  pinepaper_camera_state: 'pinepaper_set_camera',
};

export function createKGToolRankBaseline(toolManifestPath?: string): BaselineConfig {
  const manifest = toolManifestPath ?? DEFAULT_TOOL_MANIFEST;
  const { graph, index } = buildKnowledgeGraph({ toolManifestPath: manifest });
  const engine = new KGQueryEngine();
  engine.load(graph, index);

  // Build the set of taxonomy tool names (same pool as other baselines)
  const taxonomyToolSet = new Set(Object.keys(methodsByMcpTool));

  return {
    name: 'KG-ToolRank',
    shortName: 'KG-Full',
    findTools(instruction: string): RankedTool[] {
      // Request more results to compensate for filtering
      const kgResults = engine.findTools(instruction, { limit: 30 });

      // Map KG tool names to benchmark names, filter to taxonomy tools, deduplicate
      const seen = new Set<string>();
      const mapped: RankedTool[] = [];

      for (const r of kgResults) {
        const benchName = KG_TO_BENCHMARK_TOOL_MAP[r.name] ?? r.name;
        if (!taxonomyToolSet.has(benchName)) continue;
        if (seen.has(benchName)) continue;
        seen.add(benchName);
        mapped.push({ tool: benchName, score: r.score });
        if (mapped.length >= 10) break;
      }

      return mapped;
    },
  };
}

// ============================================================================
// 7. KG-Hybrid Baseline (BM25 retrieval + KG structural re-ranking)
// ============================================================================

/**
 * KG-Hybrid combines BM25 retrieval from the taxonomy corpus with KG
 * structural features for re-ranking. This is the main proposed method:
 *
 * Phase 1: BM25 over taxonomy corpus → top-30 candidates
 * Phase 2: KG structural scoring per candidate:
 *   - Method linking: matched KG methods' mcpTool → boost linked tools
 *   - PPR propagation: similar methods → their mcpTools
 * Fusion: alpha * bm25_norm + (1-alpha) * kg_structural_norm
 */
export function createKGHybridBaseline(
  corpus: ToolDocument[],
  options?: { alpha?: number; dampingFactor?: number },
): BaselineConfig {
  const alpha = options?.alpha ?? 0.6;
  const dampingFactor = options?.dampingFactor ?? 0.3;

  // --- Pre-compute BM25 index (once at init) ---
  const N = corpus.length;
  const df = new Map<string, number>();
  for (const doc of corpus) {
    const uniqueTerms = new Set(doc.terms);
    for (const term of uniqueTerms) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }
  const avgdl = corpus.reduce((sum, d) => sum + d.docLength, 0) / (N || 1);
  const k1 = 1.2;
  const b = 0.75;

  // --- Pre-compute IDF values (once at init) ---
  const idfCache = new Map<string, number>();
  for (const [term, docFreq] of df) {
    idfCache.set(term, Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1));
  }

  // --- Build KG engine (once at init) ---
  const { graph, index } = buildKnowledgeGraph();
  const engine = new KGQueryEngine();
  engine.load(graph, index);

  // --- Pre-compute related methods for all method nodes (once at init) ---
  // This eliminates repeated graph traversals during query evaluation
  const relatedCache = new Map<string, Array<{ tool: string; weight: number }>>();
  for (const node of graph.nodes) {
    if (node.type === 'method') {
      const related = engine.getRelated(node.id, ['similar', 'enhances']);
      const tools: Array<{ tool: string; weight: number }> = [];
      for (const relNode of related) {
        const relTool = relNode.properties.mcpTool as string | undefined;
        if (relTool) {
          // Use edge weight if available, default to 1.0
          tools.push({ tool: relTool, weight: 1.0 });
        }
      }
      if (tools.length > 0) {
        relatedCache.set(node.id, tools);
      }
    }
  }

  const methodsByMcpToolSet = new Set(corpus.map(d => d.toolName));

  return {
    name: 'KG-Hybrid',
    shortName: 'KG-Hyb',
    findTools(instruction: string): RankedTool[] {
      const queryTerms = tokenize(instruction);
      if (queryTerms.length === 0) return [];

      // Phase 1: BM25 retrieval (uses pre-computed IDF cache)
      const bm25Scores = new Map<string, number>();
      let maxBM25 = 0;
      for (const doc of corpus) {
        let score = 0;
        for (const term of queryTerms) {
          const tf = doc.termFrequencies.get(term) || 0;
          if (tf === 0) continue;
          const idf = idfCache.get(term) ?? 0;
          const numerator = tf * (k1 + 1);
          const denominator = tf + k1 * (1 - b + b * (doc.docLength / avgdl));
          score += idf * (numerator / denominator);
        }
        if (score > 0) {
          bm25Scores.set(doc.toolName, score);
          if (score > maxBM25) maxBM25 = score;
        }
      }

      // Phase 2: KG structural scoring (uses pre-computed related cache)
      const kgScores = new Map<string, number>();
      let maxKG = 0;

      const methods = engine.findMethods(instruction, 10);
      for (const method of methods) {
        // 2a. Direct method → tool linking
        if (method.mcpTool && methodsByMcpToolSet.has(method.mcpTool)) {
          const newScore = (kgScores.get(method.mcpTool) || 0) + method.score * 0.6;
          kgScores.set(method.mcpTool, newScore);
          if (newScore > maxKG) maxKG = newScore;
        }

        // 2b. PPR: related methods → their tools (from pre-computed cache)
        const related = relatedCache.get(method.methodId);
        if (related) {
          for (const { tool: relTool } of related) {
            if (methodsByMcpToolSet.has(relTool)) {
              const newScore = (kgScores.get(relTool) || 0) + method.score * dampingFactor * 0.4;
              kgScores.set(relTool, newScore);
              if (newScore > maxKG) maxKG = newScore;
            }
          }
        }
      }

      // Fuse (single pass — max values tracked during accumulation)
      const scored: Array<{ tool: string; score: number }> = [];
      const allTools = new Set<string>();
      bm25Scores.forEach((_, tool) => allTools.add(tool));
      kgScores.forEach((_, tool) => allTools.add(tool));

      for (const tool of allTools) {
        const normBM25 = maxBM25 > 0 ? (bm25Scores.get(tool) || 0) / maxBM25 : 0;
        const normKG = maxKG > 0 ? (kgScores.get(tool) || 0) / maxKG : 0;
        const fused = alpha * normBM25 + (1 - alpha) * normKG;
        if (fused > 0) {
          scored.push({ tool, score: fused });
        }
      }

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, 10);
    },
  };
}

// ============================================================================
// Comparison Runner
// ============================================================================

/**
 * Run all baselines through the ToolSelectionBenchmark evaluator and
 * produce aggregate + per-tier results with wall-clock timing.
 */
export function runBaselineComparison(configs: BaselineConfig[]): ComparisonSummary {
  const benchmark = new ToolSelectionBenchmark();
  const allCases = benchmark.suite.testCases as ToolSelectionTestCase[];
  const tiers: Tier[] = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
  const results: BaselineResult[] = [];

  for (const cfg of configs) {
    // Cache findTools results per instruction to avoid redundant calls
    const resultCache = new Map<string, RankedTool[]>();
    const cachedFindTools = (instruction: string): RankedTool[] => {
      let cached = resultCache.get(instruction);
      if (!cached) {
        cached = cfg.findTools(instruction);
        resultCache.set(instruction, cached);
      }
      return cached;
    };

    // Single pass over all cases (populates cache)
    const start = performance.now();
    const overall = benchmark.evaluateCases(allCases, cachedFindTools);
    const latencyMs = performance.now() - start;

    // Per-tier evaluation reuses cached results (zero additional findTools calls)
    const byTier: Record<string, ToolSelectionResult> = {};
    for (const tier of tiers) {
      const tierCases = allCases.filter(c => c.metadata.tier === tier);
      byTier[tier] = benchmark.evaluateCases(tierCases, cachedFindTools);
    }

    // Compute per-query latency (total / cases, since cache was cold during overall)
    const perQueryMs = latencyMs / allCases.length;

    results.push({
      name: cfg.name,
      shortName: cfg.shortName,
      overall,
      byTier,
      latencyMs: perQueryMs,
    });
  }

  return {
    results,
    aggregateLatex: generateAggregateTable(results),
    perTierLatex: generatePerTierTable(results, 'recall_at_5'),
  };
}

/**
 * Create all 7 default baselines.
 */
export function createAllBaselines(): BaselineConfig[] {
  const corpus = buildCorpus();
  return [
    createRandomBaseline(corpus),
    createKeywordBaseline(corpus),
    createBM25Baseline(corpus),
    createTFIDFBaseline(corpus),
    createKGTextOnlyBaseline(corpus),
    createKGToolRankBaseline(),
    createKGHybridBaseline(corpus),
  ];
}

// ============================================================================
// LaTeX Table Generation
// ============================================================================

function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

function fmt(value: number, decimals: number = 3): string {
  if (!Number.isFinite(value)) return '--';
  return value.toFixed(decimals);
}

/**
 * Find the index of the maximum value in an array of numbers.
 */
function argMax(values: number[]): number {
  let maxIdx = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[maxIdx]) maxIdx = i;
  }
  return maxIdx;
}

/**
 * Bold a LaTeX cell value if it is the best in its column.
 */
function boldIfBest(value: string, isBest: boolean): string {
  return isBest ? `\\textbf{${value}}` : value;
}

/**
 * Aggregate table: one row per baseline, columns: R@1, R@3, R@5, NDCG@5, MRR, Time(ms).
 * Best values in each column are bolded.
 */
export function generateAggregateTable(results: BaselineResult[]): string {
  type MetricKey = 'recall_at_1' | 'recall_at_3' | 'recall_at_5' | 'ndcg_at_5' | 'mrr';
  const metricKeys: MetricKey[] = ['recall_at_1', 'recall_at_3', 'recall_at_5', 'ndcg_at_5', 'mrr'];

  // Find best per column
  const bestIdx: number[] = metricKeys.map((key) =>
    argMax(results.map((r) => r.overall[key])),
  );
  // For time, lower is better
  const bestTimeIdx = results.reduce(
    (best, r, i) => (r.latencyMs < results[best].latencyMs ? i : best),
    0,
  );

  const lines: string[] = [
    '\\begin{table}[t]',
    '\\centering',
    '\\caption{Tool selection baseline comparison (aggregate).}',
    '\\label{tab:baselines-aggregate}',
    '\\begin{tabular}{lrrrrrr}',
    '\\toprule',
    'Method & R@1 & R@3 & R@5 & NDCG@5 & MRR & Time (ms) \\\\',
    '\\midrule',
  ];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const cells = metricKeys.map((key, ki) =>
      boldIfBest(fmt(r.overall[key]), i === bestIdx[ki]),
    );
    const timeCell = boldIfBest(fmt(r.latencyMs, 1), i === bestTimeIdx);
    lines.push(
      `${escapeLatex(r.name)} & ${cells.join(' & ')} & ${timeCell} \\\\`,
    );
  }

  lines.push('\\bottomrule', '\\end{tabular}', '\\end{table}');
  return lines.join('\n');
}

/**
 * Per-tier table: one row per baseline, columns: T1–T6 for a selected metric.
 */
export function generatePerTierTable(
  results: BaselineResult[],
  metric: keyof ToolSelectionResult = 'recall_at_5',
): string {
  const tiers: Tier[] = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];

  // Find best per tier column
  const bestIdx = tiers.map((tier) =>
    argMax(results.map((r) => {
      const tierResult = r.byTier[tier];
      return tierResult ? (tierResult[metric] as number) : 0;
    })),
  );

  const metricLabel = metric.replace(/_/g, '\\_');

  const lines: string[] = [
    '\\begin{table}[t]',
    '\\centering',
    `\\caption{Per-tier ${metricLabel} across baselines.}`,
    '\\label{tab:baselines-per-tier}',
    '\\begin{tabular}{lrrrrrr}',
    '\\toprule',
    'Method & T1 & T2 & T3 & T4 & T5 & T6 \\\\',
    '\\midrule',
  ];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const cells = tiers.map((tier, ti) => {
      const tierResult = r.byTier[tier];
      const val = tierResult ? (tierResult[metric] as number) : 0;
      return boldIfBest(fmt(val), i === bestIdx[ti]);
    });
    lines.push(`${escapeLatex(r.name)} & ${cells.join(' & ')} \\\\`);
  }

  lines.push('\\bottomrule', '\\end{tabular}', '\\end{table}');
  return lines.join('\n');
}
