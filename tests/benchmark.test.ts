/**
 * Pine Paper LLM v0 — Tool Selection Benchmark Tests
 *
 * Validates dataset integrity, ground-truth validity, category coverage,
 * evaluator metrics, and BenchmarkSuite shape.
 */

import { describe, it, expect } from 'vitest';
import {
  ToolSelectionBenchmark,
  type ToolSelectionTestCase,
  type RankedTool,
  type Tier,
} from '../benchmark.js';
import { allMethods, methodsById } from '../../../src/taxonomy/methods.js';

const dataset = ToolSelectionBenchmark.getDataset();
const allCases = ToolSelectionBenchmark.getAllTestCases();
const tierCounts = ToolSelectionBenchmark.getTierCounts();

// All unique MCP tools in the taxonomy
const taxonomyToolSet = new Set(allMethods.map((m) => m.mcpTool));
// All valid method IDs
const methodIdSet = new Set(allMethods.map((m) => m.id));

describe('Tool Selection Benchmark — Dataset Integrity', () => {
  it('should have at least 480 total test cases', () => {
    expect(allCases.length).toBeGreaterThanOrEqual(480);
  });

  it('should have all 6 tiers present with minimum counts', () => {
    expect(tierCounts.T1).toBeGreaterThanOrEqual(70);
    expect(tierCounts.T2).toBeGreaterThanOrEqual(90);
    expect(tierCounts.T3).toBeGreaterThanOrEqual(90);
    expect(tierCounts.T4).toBeGreaterThanOrEqual(60);
    expect(tierCounts.T5).toBeGreaterThanOrEqual(50);
    expect(tierCounts.T6).toBeGreaterThanOrEqual(70);
  });

  it('every test case should have non-empty id, prompt, category', () => {
    for (const tc of allCases) {
      expect(tc.id).toBeTruthy();
      expect(tc.prompt).toBeTruthy();
      expect(tc.category).toBeTruthy();
    }
  });

  it('every test case should have metadata.tier matching T1-T6', () => {
    const validTiers = new Set<string>(['T1', 'T2', 'T3', 'T4', 'T5', 'T6']);
    for (const tc of allCases) {
      expect(validTiers.has(tc.metadata.tier)).toBe(true);
    }
  });

  it('every test case should have metadata.expectedTools with >= 1 entry', () => {
    for (const tc of allCases) {
      expect(tc.metadata.expectedTools.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should have no duplicate IDs', () => {
    const ids = allCases.map((tc) => tc.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('Tool Selection Benchmark — Ground-Truth Validity', () => {
  it('all expectedTools entries should be valid MCP tool names', () => {
    for (const tc of allCases) {
      for (const tool of tc.metadata.expectedTools) {
        expect(taxonomyToolSet.has(tool)).toBe(true);
      }
    }
  });

  it('all taxonomyMethods entries should be valid method IDs', () => {
    for (const tc of allCases) {
      for (const methodId of tc.metadata.taxonomyMethods) {
        expect(methodIdSet.has(methodId)).toBe(true);
      }
    }
  });

  it('T1 cases should have exactly 1 expected tool', () => {
    const t1 = ToolSelectionBenchmark.getTestCasesByTier('T1');
    for (const tc of t1) {
      expect(tc.metadata.expectedTools.length).toBe(1);
    }
  });

  it('T3 cases should have exactly 2 expected tools', () => {
    const t3 = ToolSelectionBenchmark.getTestCasesByTier('T3');
    for (const tc of t3) {
      expect(tc.metadata.expectedTools.length).toBe(2);
    }
  });

  it('T4 cases should have >= 3 expected tools', () => {
    const t4 = ToolSelectionBenchmark.getTestCasesByTier('T4');
    for (const tc of t4) {
      expect(tc.metadata.expectedTools.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('T5 cases should include pinepaper_execute_generator or pinepaper_create_grid', () => {
    const t5 = ToolSelectionBenchmark.getTestCasesByTier('T5');
    const generatorTools = new Set(['pinepaper_execute_generator', 'pinepaper_create_grid']);
    for (const tc of t5) {
      const hasGenerator = tc.metadata.expectedTools.some((t) => generatorTools.has(t));
      expect(hasGenerator).toBe(true);
    }
  });
});

describe('Tool Selection Benchmark — Category Coverage', () => {
  it('all 17 taxonomy categories should be represented', () => {
    const categories = new Set(allCases.map((tc) => tc.category));
    const expected = [
      'shapes', 'styling', 'animations', 'relations', 'generators',
      'filters', 'effects', 'diagrams', 'composition', 'export',
      'acoustic', 'rigging', 'blending', 'masking', 'camera',
      'path_operations', '3d',
    ];
    for (const cat of expected) {
      expect(categories.has(cat)).toBe(true);
    }
  });

  it('all unique MCP tools should appear in at least one test case', () => {
    const benchmarkTools = new Set<string>();
    for (const tc of allCases) {
      for (const t of tc.metadata.expectedTools) benchmarkTools.add(t);
    }
    for (const tool of taxonomyToolSet) {
      expect(benchmarkTools.has(tool)).toBe(true);
    }
  });

  it('pinepaper_create_item should appear in >= 20 cases', () => {
    const count = allCases.filter((tc) =>
      tc.metadata.expectedTools.includes('pinepaper_create_item'),
    ).length;
    expect(count).toBeGreaterThanOrEqual(20);
  });

  it('pinepaper_add_relation should appear in >= 20 cases', () => {
    const count = allCases.filter((tc) =>
      tc.metadata.expectedTools.includes('pinepaper_add_relation'),
    ).length;
    expect(count).toBeGreaterThanOrEqual(20);
  });

  it('pinepaper_add_filter should appear in >= 20 cases', () => {
    const count = allCases.filter((tc) =>
      tc.metadata.expectedTools.includes('pinepaper_add_filter'),
    ).length;
    expect(count).toBeGreaterThanOrEqual(20);
  });
});

describe('Tool Selection Benchmark — Evaluator Metrics', () => {
  describe('recallAtK', () => {
    it('should return 1.0 when predicted contains all ground-truth', () => {
      expect(ToolSelectionBenchmark.recallAtK(['a', 'b', 'c'], ['a', 'b'], 3)).toBe(1);
    });

    it('should return 0.0 when predicted is empty', () => {
      expect(ToolSelectionBenchmark.recallAtK([], ['a', 'b'], 3)).toBe(0);
    });

    it('should return 0.5 when only half of ground-truth is in top-K', () => {
      expect(ToolSelectionBenchmark.recallAtK(['a', 'c', 'd'], ['a', 'b'], 3)).toBe(0.5);
    });

    it('should respect K limit', () => {
      expect(ToolSelectionBenchmark.recallAtK(['x', 'a', 'b'], ['a', 'b'], 1)).toBe(0);
      expect(ToolSelectionBenchmark.recallAtK(['x', 'a', 'b'], ['a', 'b'], 3)).toBe(1);
    });
  });

  describe('ndcgAtK', () => {
    it('should return 1.0 for perfect ranking', () => {
      expect(ToolSelectionBenchmark.ndcgAtK(['a', 'b'], ['a', 'b'], 5)).toBeCloseTo(1);
    });

    it('should penalize late-ranked correct tools', () => {
      const earlyRank = ToolSelectionBenchmark.ndcgAtK(['a', 'x', 'y'], ['a'], 5);
      const lateRank = ToolSelectionBenchmark.ndcgAtK(['x', 'y', 'a'], ['a'], 5);
      expect(earlyRank).toBeGreaterThan(lateRank);
    });

    it('should return 0.0 when no correct tools are predicted', () => {
      expect(ToolSelectionBenchmark.ndcgAtK(['x', 'y', 'z'], ['a', 'b'], 5)).toBe(0);
    });
  });

  describe('mrr', () => {
    it('should return 1.0 when first prediction is correct', () => {
      expect(ToolSelectionBenchmark.mrr(['a', 'b', 'c'], ['a'])).toBe(1);
    });

    it('should return 0.5 when correct answer is second', () => {
      expect(ToolSelectionBenchmark.mrr(['x', 'a', 'c'], ['a'])).toBe(0.5);
    });

    it('should return 0 when no correct answer is found', () => {
      expect(ToolSelectionBenchmark.mrr(['x', 'y', 'z'], ['a'])).toBe(0);
    });
  });

  describe('evaluate', () => {
    it('perfect predictor should score 1.0 on all metrics', () => {
      const bench = new ToolSelectionBenchmark();
      const perfectFinder = (instruction: string): RankedTool[] => {
        const tc = allCases.find((c) => c.prompt === instruction);
        if (!tc) return [];
        return tc.metadata.expectedTools.map((t, i) => ({ tool: t, score: 1 - i * 0.1 }));
      };
      const result = bench.evaluate(perfectFinder);
      // recall@1 < 1.0 for multi-tool cases (T3/T4 have 2-5 expected tools)
      expect(result.recall_at_1).toBeGreaterThan(0.5);
      expect(result.recall_at_5).toBe(1);
      expect(result.mrr).toBe(1);
      expect(result.ndcg_at_5).toBeGreaterThan(0.9);
    });

    it('empty predictor should score 0.0 on all metrics', () => {
      const bench = new ToolSelectionBenchmark();
      const emptyFinder = (): RankedTool[] => [];
      const result = bench.evaluate(emptyFinder);
      expect(result.recall_at_1).toBe(0);
      expect(result.recall_at_5).toBe(0);
      expect(result.mrr).toBe(0);
      expect(result.ndcg_at_5).toBe(0);
    });
  });
});

describe('Tool Selection Benchmark — BenchmarkSuite Shape', () => {
  it('getDataset() should return a valid BenchmarkSuite', () => {
    expect(dataset.name).toBe('PinePaper-ToolBench');
    expect(dataset.version).toBe('1.0.0');
    expect(dataset.description).toBeTruthy();
    expect(dataset.testCases.length).toBeGreaterThan(0);
    expect(dataset.categories.length).toBe(16);
  });

  it('getTestCasesByTier() should filter correctly', () => {
    for (const tier of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'] as Tier[]) {
      const cases = ToolSelectionBenchmark.getTestCasesByTier(tier);
      expect(cases.length).toBeGreaterThan(0);
      for (const tc of cases) {
        expect(tc.metadata.tier).toBe(tier);
      }
    }
  });

  it('evaluateByTier should return results for all 6 tiers', () => {
    const bench = new ToolSelectionBenchmark();
    const trivialFinder = (): RankedTool[] => [{ tool: 'pinepaper_create_item', score: 1 }];
    const byTier = bench.evaluateByTier(trivialFinder);
    expect(Object.keys(byTier).length).toBe(6);
    for (const tier of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']) {
      expect(byTier[tier]).toBeDefined();
      expect(byTier[tier].totalCases).toBeGreaterThan(0);
    }
  });

  it('toLatexTable should produce valid LaTeX', () => {
    const bench = new ToolSelectionBenchmark();
    const dummyResults: Record<string, any> = {};
    for (const tier of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']) {
      dummyResults[tier] = { recall_at_1: 0.5, recall_at_3: 0.7, recall_at_5: 0.9, ndcg_at_5: 0.8, mrr: 0.6, totalCases: 10, byDifficulty: {} };
    }
    const latex = bench.toLatexTable(dummyResults);
    expect(latex).toContain('\\begin{table}');
    expect(latex).toContain('\\end{table}');
    expect(latex).toContain('R@1');
    expect(latex).toContain('T1');
    expect(latex).toContain('T6');
  });
});
