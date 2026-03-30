/**
 * Pine Paper LLM v0 — Tool Selection Baselines Tests
 *
 * Validates corpus construction, all 6 baselines, comparison runner,
 * and LaTeX table generation.
 */

import { describe, it, expect } from 'vitest';
import {
  buildCorpus,
  tokenize,
  createRandomBaseline,
  createKeywordBaseline,
  createBM25Baseline,
  createTFIDFBaseline,
  createKGTextOnlyBaseline,
  createKGToolRankBaseline,
  runBaselineComparison,
  generateAggregateTable,
  generatePerTierTable,
  type ToolDocument,
} from '../baselines.js';
import { methodsByMcpTool } from '../../../src/taxonomy/methods.js';

// ============================================================================
// Shared fixtures
// ============================================================================

const corpus = buildCorpus();

// ============================================================================
// Corpus Tests (4)
// ============================================================================

describe('Corpus', () => {
  it('should have one document per unique MCP tool', () => {
    const expectedCount = Object.keys(methodsByMcpTool).length;
    expect(corpus.length).toBe(expectedCount);
    expect(corpus.length).toBeGreaterThan(0);
  });

  it('every document should have non-empty text', () => {
    for (const doc of corpus) {
      expect(doc.text.length).toBeGreaterThan(0);
    }
  });

  it('every document should have a valid tool name', () => {
    const toolNames = new Set(Object.keys(methodsByMcpTool));
    for (const doc of corpus) {
      expect(toolNames.has(doc.toolName)).toBe(true);
    }
  });

  it('term frequency sums should equal term count', () => {
    for (const doc of corpus) {
      let sum = 0;
      for (const count of doc.termFrequencies.values()) {
        sum += count;
      }
      expect(sum).toBe(doc.terms.length);
    }
  });
});

// ============================================================================
// Random Baseline (4)
// ============================================================================

describe('Random Baseline', () => {
  const baseline = createRandomBaseline(corpus);

  it('should return 10 tools', () => {
    const results = baseline.findTools('Create a circle');
    expect(results.length).toBe(10);
  });

  it('should return valid tool names', () => {
    const toolNames = new Set(corpus.map((d) => d.toolName));
    const results = baseline.findTools('Draw something interesting');
    for (const r of results) {
      expect(toolNames.has(r.tool)).toBe(true);
    }
  });

  it('should have descending scores', () => {
    const results = baseline.findTools('Apply a filter');
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it('should be deterministic for the same instruction', () => {
    const r1 = baseline.findTools('Make a bouncing ball');
    const r2 = baseline.findTools('Make a bouncing ball');
    expect(r1).toEqual(r2);
  });
});

// ============================================================================
// Keyword Baseline (3)
// ============================================================================

describe('Keyword Baseline', () => {
  const baseline = createKeywordBaseline(corpus);

  it('should return results for a shape query', () => {
    const results = baseline.findTools('Create a circle at the center');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should return empty for empty input', () => {
    const results = baseline.findTools('');
    expect(results.length).toBe(0);
  });

  it('should have scores between 0 and 1', () => {
    const results = baseline.findTools('Add a blur filter');
    for (const r of results) {
      expect(r.score).toBeGreaterThan(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================================
// BM25 Baseline (4)
// ============================================================================

describe('BM25 Baseline', () => {
  const baseline = createBM25Baseline(corpus);

  it('should return results for a shape query', () => {
    const results = baseline.findTools('Create a rectangle at center');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should rank a matching tool highly for an explicit query', () => {
    const results = baseline.findTools('Apply a blur filter to the image');
    expect(results.length).toBeGreaterThan(0);
    // pinepaper_add_filter should be in top results
    const filterTool = results.find((r) => r.tool === 'pinepaper_add_filter');
    expect(filterTool).toBeDefined();
  });

  it('should have non-negative scores', () => {
    const results = baseline.findTools('Animate the star with a pulse');
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
    }
  });

  it('should handle unknown terms gracefully', () => {
    const results = baseline.findTools('xyzzyplugh foobarbaz');
    // Should return empty or minimal results for nonsense queries
    expect(results.length).toBeLessThanOrEqual(10);
  });
});

// ============================================================================
// TF-IDF Baseline (3)
// ============================================================================

describe('TF-IDF Baseline', () => {
  const baseline = createTFIDFBaseline(corpus);

  it('should have cosine scores between 0 and 1', () => {
    const results = baseline.findTools('Create a star shape');
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1 + 1e-9); // small epsilon for floating point
    }
  });

  it('should rank filter tool highly for filter queries', () => {
    const results = baseline.findTools('Apply a grayscale filter');
    expect(results.length).toBeGreaterThan(0);
    const filterTool = results.find((r) => r.tool === 'pinepaper_add_filter');
    expect(filterTool).toBeDefined();
  });

  it('should return empty for empty input', () => {
    const results = baseline.findTools('');
    expect(results.length).toBe(0);
  });
});

// ============================================================================
// KG-Text-Only Baseline (2)
// ============================================================================

describe('KG-Text-Only Baseline', () => {
  const baseline = createKGTextOnlyBaseline(corpus);

  it('should return tools for a valid query', () => {
    const results = baseline.findTools('Create a circle');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should return empty for empty input', () => {
    const results = baseline.findTools('');
    expect(results.length).toBe(0);
  });
});

// ============================================================================
// KG-ToolRank Baseline (3)
// ============================================================================

describe('KG-ToolRank Baseline', () => {
  const baseline = createKGToolRankBaseline();

  it('should return results with tool and score fields', () => {
    const results = baseline.findTools('Draw a rectangle');
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(typeof r.tool).toBe('string');
      expect(typeof r.score).toBe('number');
    }
  });

  it('should return valid tool names', () => {
    const results = baseline.findTools('Apply a shadow effect');
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.tool.length).toBeGreaterThan(0);
    }
  });

  it('should return empty for empty input', () => {
    const results = baseline.findTools('');
    expect(results.length).toBe(0);
  });
});

// ============================================================================
// Comparison Runner (4)
// ============================================================================

describe('Comparison Runner', () => {
  // Use only lightweight baselines for runner tests (skip KG-ToolRank for speed)
  const lightBaselines = [
    createRandomBaseline(corpus),
    createKeywordBaseline(corpus),
    createBM25Baseline(corpus),
  ];

  it('all baselines should return results', () => {
    const summary = runBaselineComparison(lightBaselines);
    expect(summary.results.length).toBe(lightBaselines.length);
    for (const r of summary.results) {
      expect(r.overall.totalCases).toBeGreaterThan(0);
    }
  });

  it('metrics should be between 0 and 1', () => {
    const summary = runBaselineComparison(lightBaselines);
    for (const r of summary.results) {
      expect(r.overall.recall_at_1).toBeGreaterThanOrEqual(0);
      expect(r.overall.recall_at_1).toBeLessThanOrEqual(1);
      expect(r.overall.recall_at_5).toBeGreaterThanOrEqual(0);
      expect(r.overall.recall_at_5).toBeLessThanOrEqual(1);
      expect(r.overall.ndcg_at_5).toBeGreaterThanOrEqual(0);
      expect(r.overall.ndcg_at_5).toBeLessThanOrEqual(1);
      expect(r.overall.mrr).toBeGreaterThanOrEqual(0);
      expect(r.overall.mrr).toBeLessThanOrEqual(1);
    }
  });

  it('tier results should cover T1-T6', () => {
    const summary = runBaselineComparison(lightBaselines);
    for (const r of summary.results) {
      for (const tier of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']) {
        expect(r.byTier[tier]).toBeDefined();
      }
    }
  });

  it('latency should be positive', () => {
    const summary = runBaselineComparison(lightBaselines);
    for (const r of summary.results) {
      expect(r.latencyMs).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// LaTeX Tables (3)
// ============================================================================

describe('LaTeX Tables', () => {
  // Create mock results for table generation
  const mockResults = [
    createRandomBaseline(corpus),
    createKeywordBaseline(corpus),
  ];
  const summary = runBaselineComparison(mockResults);

  it('aggregate table should contain valid LaTeX', () => {
    const latex = summary.aggregateLatex;
    expect(latex).toContain('\\begin{table}');
    expect(latex).toContain('\\end{table}');
    expect(latex).toContain('\\toprule');
    expect(latex).toContain('\\bottomrule');
    expect(latex).toContain('R@1');
    expect(latex).toContain('NDCG@5');
  });

  it('aggregate table should contain all baseline names', () => {
    const latex = summary.aggregateLatex;
    expect(latex).toContain('Random');
    expect(latex).toContain('Keyword');
  });

  it('per-tier table should have tier columns', () => {
    const latex = summary.perTierLatex;
    expect(latex).toContain('T1');
    expect(latex).toContain('T2');
    expect(latex).toContain('T3');
    expect(latex).toContain('T4');
    expect(latex).toContain('T5');
    expect(latex).toContain('T6');
  });
});
