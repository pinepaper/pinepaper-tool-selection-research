/**
 * Pine Paper LLM v0 — Ablation Study Framework
 *
 * Ablation variants of KG-Hybrid using KGQueryEngineOptions.
 * Each variant disables one component to measure its contribution.
 */

import {
  buildCorpus,
  createKGHybridBaseline,
  type BaselineConfig,
  type ToolDocument,
} from './baselines.js';

// ============================================================================
// Ablation Variant Definitions
// ============================================================================

export interface AblationVariant {
  name: string;
  shortName: string;
  description: string;
  config: {
    alpha?: number;
    dampingFactor?: number;
  };
  /** If true, this is actually a completely separate baseline */
  separateBaseline?: (corpus: ToolDocument[]) => BaselineConfig;
}

/**
 * Standard ablation variants for the KG-Hybrid method.
 */
export const ABLATION_VARIANTS: AblationVariant[] = [
  {
    name: 'KG-Hybrid (Full)',
    shortName: 'Full',
    description: 'Complete KG-Hybrid with BM25 + method linking + PPR + concept bridging',
    config: { alpha: 0.6, dampingFactor: 0.3 },
  },
  {
    name: 'KG-NoPPR',
    shortName: 'NoPPR',
    description: 'KG-Hybrid without PPR propagation through similar methods',
    config: { alpha: 0.6, dampingFactor: 0.0 }, // dampingFactor=0 effectively disables PPR
  },
  {
    name: 'KG-TextOnly-BM25',
    shortName: 'BM25Only',
    description: 'Pure BM25 with no KG features (alpha=1.0)',
    config: { alpha: 1.0, dampingFactor: 0.3 },
  },
  {
    name: 'KG-HighAlpha',
    shortName: 'α=0.8',
    description: 'KG-Hybrid with higher BM25 weight (alpha=0.8)',
    config: { alpha: 0.8, dampingFactor: 0.3 },
  },
  {
    name: 'KG-LowAlpha',
    shortName: 'α=0.4',
    description: 'KG-Hybrid with lower BM25 weight (alpha=0.4)',
    config: { alpha: 0.4, dampingFactor: 0.3 },
  },
  {
    name: 'KG-EqualWeight',
    shortName: 'α=0.5',
    description: 'KG-Hybrid with equal BM25/KG weight (alpha=0.5)',
    config: { alpha: 0.5, dampingFactor: 0.3 },
  },
];

/**
 * Damping factor sweep values for the hyperparameter study.
 */
export const DAMPING_SWEEP_VALUES = [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5];

/**
 * Alpha sweep values for the fusion weight study.
 */
export const ALPHA_SWEEP_VALUES = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

// ============================================================================
// Ablation Baseline Creation
// ============================================================================

/**
 * Create baselines for all ablation variants.
 */
export function createAblationBaselines(corpus?: ToolDocument[]): BaselineConfig[] {
  const c = corpus ?? buildCorpus();
  return ABLATION_VARIANTS.map(variant => {
    if (variant.separateBaseline) {
      return variant.separateBaseline(c);
    }
    const baseline = createKGHybridBaseline(c, variant.config);
    return {
      ...baseline,
      name: variant.name,
      shortName: variant.shortName,
    };
  });
}

/**
 * Create baselines for damping factor sweep.
 */
export function createDampingSweepBaselines(corpus?: ToolDocument[]): BaselineConfig[] {
  const c = corpus ?? buildCorpus();
  return DAMPING_SWEEP_VALUES.map(d => {
    const baseline = createKGHybridBaseline(c, { alpha: 0.6, dampingFactor: d });
    return {
      ...baseline,
      name: `KG-Damping-${d}`,
      shortName: `d=${d}`,
    };
  });
}

/**
 * Create baselines for alpha sweep.
 */
export function createAlphaSweepBaselines(corpus?: ToolDocument[]): BaselineConfig[] {
  const c = corpus ?? buildCorpus();
  return ALPHA_SWEEP_VALUES.map(a => {
    const baseline = createKGHybridBaseline(c, { alpha: a, dampingFactor: 0.3 });
    return {
      ...baseline,
      name: `KG-Alpha-${a}`,
      shortName: `α=${a}`,
    };
  });
}

// ============================================================================
// LaTeX Ablation Table Generator
// ============================================================================

/**
 * Generate LaTeX table for ablation results.
 */
export function generateAblationTable(
  results: Array<{ name: string; recall_at_1: number; recall_at_5: number; ndcg_at_5: number; mrr: number }>,
  fullMethodName: string = 'KG-Hybrid (Full)',
): string {
  const lines: string[] = [
    '\\begin{table}[t]',
    '\\centering',
    '\\caption{Ablation study: contribution of each component.}',
    '\\label{tab:ablation}',
    '\\begin{tabular}{lrrrr}',
    '\\toprule',
    'Variant & R@1 & R@5 & NDCG@5 & MRR \\\\',
    '\\midrule',
  ];

  // Find full method results for delta computation
  const fullResult = results.find(r => r.name === fullMethodName);

  for (const r of results) {
    const name = r.name.replace(/_/g, '\\_').replace(/-/g, '-');
    const r1 = r.recall_at_1.toFixed(3);
    const r5 = r.recall_at_5.toFixed(3);
    const ndcg = r.ndcg_at_5.toFixed(3);
    const mrr = r.mrr.toFixed(3);

    if (r.name === fullMethodName) {
      lines.push(`\\textbf{${name}} & \\textbf{${r1}} & \\textbf{${r5}} & \\textbf{${ndcg}} & \\textbf{${mrr}} \\\\`);
    } else {
      // Show delta from full method
      const deltaR5 = fullResult ? (r.recall_at_5 - fullResult.recall_at_5) : 0;
      const deltaStr = deltaR5 < 0 ? `\\textcolor{red}{${deltaR5.toFixed(3)}}` : `+${deltaR5.toFixed(3)}`;
      lines.push(`${name} & ${r1} & ${r5} (${deltaStr}) & ${ndcg} & ${mrr} \\\\`);
    }
  }

  lines.push('\\bottomrule', '\\end{tabular}', '\\end{table}');
  return lines.join('\n');
}

/**
 * Generate LaTeX table for hyperparameter sweep.
 */
export function generateSweepTable(
  paramName: string,
  values: number[],
  results: Array<{ recall_at_5: number; ndcg_at_5: number; mrr: number }>,
): string {
  const lines: string[] = [
    '\\begin{table}[t]',
    '\\centering',
    `\\caption{Hyperparameter sweep: ${paramName}.}`,
    `\\label{tab:sweep-${paramName.toLowerCase().replace(/\s/g, '-')}}`,
    '\\begin{tabular}{rrrr}',
    '\\toprule',
    `${paramName} & R@5 & NDCG@5 & MRR \\\\`,
    '\\midrule',
  ];

  // Find best R@5
  let bestIdx = 0;
  for (let i = 1; i < results.length; i++) {
    if (results[i].recall_at_5 > results[bestIdx].recall_at_5) bestIdx = i;
  }

  for (let i = 0; i < values.length; i++) {
    const r = results[i];
    const v = values[i].toFixed(2);
    const r5 = r.recall_at_5.toFixed(3);
    const ndcg = r.ndcg_at_5.toFixed(3);
    const mrr = r.mrr.toFixed(3);

    if (i === bestIdx) {
      lines.push(`\\textbf{${v}} & \\textbf{${r5}} & \\textbf{${ndcg}} & \\textbf{${mrr}} \\\\`);
    } else {
      lines.push(`${v} & ${r5} & ${ndcg} & ${mrr} \\\\`);
    }
  }

  lines.push('\\bottomrule', '\\end{tabular}', '\\end{table}');
  return lines.join('\n');
}
