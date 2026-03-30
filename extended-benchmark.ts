/**
 * Pine Paper LLM v0 — Extended Benchmark (1000+ test cases)
 *
 * Combines the original 486 PinePaper-ToolBench cases with:
 *   - Paraphrased variants of existing queries
 *   - New test cases for synthetic tools
 *   - Complex multi-step T3/T4/T6 templates modeling real workflow chains
 *   - Target distribution: ~200 T1, ~250 T2, ~200 T3, ~180 T4, ~80 T5, ~150 T6
 */

import {
  ToolSelectionBenchmark,
  type ToolSelectionTestCase,
  type ToolSelectionMetadata,
  type Tier,
  type Difficulty,
  type RankedTool,
  type ToolSelectionResult,
} from './benchmark.js';
import {
  generateSyntheticTools,
  NOUN_ALIASES,
  type SyntheticToolDefinition,
  type SyntheticToolWithMethods,
} from './synthetic-tools.js';

// ============================================================================
// Paraphrase Templates
// ============================================================================

const VERB_SYNONYMS: Record<string, string[]> = {
  create: ['make', 'build', 'generate', 'produce', 'construct', 'design'],
  draw: ['sketch', 'render', 'trace', 'illustrate', 'depict'],
  apply: ['add', 'use', 'put', 'set', 'enable', 'activate'],
  change: ['modify', 'update', 'alter', 'adjust', 'transform'],
  remove: ['delete', 'clear', 'erase', 'strip', 'drop'],
  animate: ['move', 'transition', 'morph', 'transform'],
  export: ['save', 'download', 'output', 'convert'],
  connect: ['link', 'join', 'attach', 'wire', 'bind'],
};

const POSITION_PHRASES: Record<string, string[]> = {
  'at the center': ['in the middle', 'centered on the canvas', 'at the midpoint'],
  'at position': ['at coordinates', 'at location', 'placed at'],
  'on the left': ['on the left side', 'to the left', 'left-aligned'],
  'on the right': ['on the right side', 'to the right', 'right-aligned'],
  'at the top': ['at the upper area', 'near the top', 'in the top section'],
  'at the bottom': ['at the lower area', 'near the bottom', 'in the bottom section'],
};

// ============================================================================
// Paraphrase Generator
// ============================================================================

function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Generate a paraphrased variant of a prompt.
 */
function paraphrasePrompt(prompt: string, rng: () => number): string {
  let result = prompt;

  // Replace verbs
  for (const [verb, synonyms] of Object.entries(VERB_SYNONYMS)) {
    const regex = new RegExp(`\\b${verb}\\b`, 'i');
    if (regex.test(result)) {
      const synonym = pick(synonyms, rng);
      result = result.replace(regex, (match) =>
        match[0] === match[0].toUpperCase()
          ? synonym.charAt(0).toUpperCase() + synonym.slice(1)
          : synonym,
      );
      break; // Only replace one verb per paraphrase
    }
  }

  // Replace position phrases
  for (const [phrase, alternatives] of Object.entries(POSITION_PHRASES)) {
    if (result.toLowerCase().includes(phrase)) {
      const alt = pick(alternatives, rng);
      result = result.replace(new RegExp(phrase, 'i'), alt);
      break;
    }
  }

  return result;
}

// ============================================================================
// Synthetic Tool Test Case Generator
// ============================================================================

/**
 * Intent-based query templates using noun aliases to break vocabulary leakage.
 *
 * Distribution of direct noun vs aliased/intent-based queries:
 *   T1: 30% direct, 70% aliased
 *   T2: 10% direct, 90% intent-based
 *   T3/T4: 20% direct, 80% aliased/intent
 *   T6: 0% direct, 100% intent-based
 *
 * Templates use {user_alias} for aliased noun and {noun} for direct references.
 * The generator picks between them based on the tier's distribution.
 */
const QUERY_TEMPLATES: Record<Tier, string[]> = {
  T1: [
    // Direct (30%)
    '{verb} a {noun}',
    'Use the {tool_name} tool',
    // Aliased (70%)
    'Use {user_alias} to display the data',
    '{verb} a {user_alias} element',
    'Set up a {user_alias} with default settings',
    'I need a {user_alias}',
  ],
  T2: [
    // Aliased intent (90%)
    'Help me set up a {user_alias}',
    'Can you {verb} a {adjective} {user_alias}?',
    'I want to {verb} a {user_alias} for my project',
    'I need a {user_alias} for this {category} work',
    'Set up a {user_alias} with {adjective} styling',
    'Help me build a {user_alias} that looks {adjective}',
    'I want to add a {user_alias} to the {category} area',
    'Can you make a {user_alias} for the design?',
    // Direct (10%)
    'I need something like a {noun}',
  ],
  T3: [
    // Aliased cross-category (80%)
    'Show a {user_alias1} and add smooth {user_alias2} to it',
    'Set up a {user_alias1} then enhance it with {user_alias2}',
    'Start with a {user_alias1} and layer on {user_alias2}',
    'Combine a {user_alias1} with {user_alias2} for a polished result',
    // Direct (20%)
    '{verb} a {noun1} and then {verb2} a {noun2}',
    'Create a {noun1} element then apply a {noun2} to it',
  ],
  T4: [
    // Aliased/intent pipeline (80%)
    'Build a complete {category} setup with {user_alias1}, {user_alias2}, and {user_alias3}',
    'Create a {user_alias1}, enhance it with {user_alias2}, and finish with {user_alias3}',
    'Set up a {user_alias1}, configure {user_alias2}, then add {user_alias3}',
    'Design a workflow using {user_alias1}, {user_alias2}, and {user_alias3}',
    'Build a dashboard with charts, animated transitions, and responsive layout',
    // Direct (20%)
    '{verb} a {noun1}, {verb2} a {noun2}, and {verb3} a {noun3}',
  ],
  T5: [
    'Generate a {user_alias} pattern automatically',
    'Auto-create a {user_alias} with procedural generation',
  ],
  T6: [
    // 100% intent-based / sensory language with category context
    'Create something {adjective} that combines {category1} and {category2}',
    'Design a {adjective} experience blending {category1} elements with {category2} features',
    'I want a {adjective} {category1} setup with {category2} enhancements',
    'Build a {category1} piece that also uses {category2} techniques',
    'Make the {category1} part feel alive with {category2} touches',
    'I need a polished {category1} and {category2} combination',
  ],
};

const ADJECTIVES = ['beautiful', 'modern', 'clean', 'dynamic', 'interactive', 'responsive', 'elegant', 'minimal'];

/**
 * Get a user-facing alias for a tool noun. Falls back to the raw noun
 * if no alias exists. Uses rng for deterministic selection.
 */
function getUserAlias(toolName: string, rng: () => number): string {
  const rawNoun = toolName.split('_').slice(2).join('_');
  const aliases = NOUN_ALIASES[rawNoun];
  if (aliases && aliases.length > 0) {
    return pick(aliases, rng);
  }
  return rawNoun.replace(/_/g, ' ');
}

export interface ExtendedTestCase extends ToolSelectionTestCase {
  source: 'original' | 'paraphrase' | 'synthetic';
}

/** Category-friendly names for readable multi-step prompts */
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  data_visualization: 'data visualization',
  '3d_rendering': '3D rendering',
  collaboration: 'collaboration',
  accessibility: 'accessibility',
  typography: 'typography',
  image_processing: 'image processing',
  layout: 'layout',
  motion_design: 'motion design',
  vector_operations: 'vector operations',
  prototyping: 'prototyping',
};

function createSyntheticTestCase(
  tier: Tier,
  difficulty: Difficulty,
  tool: SyntheticToolDefinition,
  allTools: SyntheticToolDefinition[],
  rng: () => number,
  idCounter: { value: number },
): ExtendedTestCase {
  idCounter.value++;
  const id = `TSB-EXT-${tier}-${String(idCounter.value).padStart(4, '0')}`;

  const verb = tool.name.split('_')[1] || 'create';
  const noun = tool.name.split('_').slice(2).join(' ');
  const adjective = pick(ADJECTIVES, rng);

  let prompt: string;
  let expectedTools: string[];
  let taxonomyMethods: string[] = [];

  switch (tier) {
    case 'T1': {
      const template = pick(QUERY_TEMPLATES.T1, rng);
      const userAlias = getUserAlias(tool.name, rng);
      prompt = template
        .replace('{verb}', verb.charAt(0).toUpperCase() + verb.slice(1))
        .replace('{noun}', noun)
        .replace('{user_alias}', userAlias)
        .replace('{tool_name}', tool.name);
      expectedTools = [tool.name];
      break;
    }
    case 'T2': {
      const template = pick(QUERY_TEMPLATES.T2, rng);
      const userAlias = getUserAlias(tool.name, rng);
      const catDisplay = CATEGORY_DISPLAY_NAMES[tool.category] || tool.category.replace(/_/g, ' ');
      prompt = template
        .replace('{verb}', verb)
        .replace('{noun}', noun)
        .replace('{user_alias}', userAlias)
        .replace('{adjective}', adjective)
        .replace('{category}', catDisplay);
      expectedTools = [tool.name];
      break;
    }
    case 'T3': {
      // Cross-category 2-step: pick tool2 from a DIFFERENT category
      const otherCatTools = allTools.filter(t => t.category !== tool.category);
      const sameCatTools = allTools.filter(t => t.category === tool.category && t.name !== tool.name);
      // 60% cross-category, 40% same-category
      const crossCategory = otherCatTools.length > 0 && rng() < 0.6;
      const tool2 = crossCategory
        ? pick(otherCatTools, rng)
        : (sameCatTools.length > 0 ? pick(sameCatTools, rng) : tool);
      const verb2 = tool2.name.split('_')[1] || 'apply';
      const noun2 = tool2.name.split('_').slice(2).join(' ');
      const userAlias1 = getUserAlias(tool.name, rng);
      const userAlias2 = getUserAlias(tool2.name, rng);
      const template = pick(QUERY_TEMPLATES.T3, rng);
      prompt = template
        .replace('{verb}', verb.charAt(0).toUpperCase() + verb.slice(1))
        .replace('{noun1}', noun)
        .replace('{verb2}', verb2)
        .replace('{noun2}', noun2)
        .replace('{user_alias1}', userAlias1)
        .replace('{user_alias2}', userAlias2);
      expectedTools = [tool.name, tool2.name];
      break;
    }
    case 'T4': {
      // 3+ step pipeline: pick tools from different categories when possible
      const otherTools = allTools.filter(t => t.name !== tool.name);
      const usedCategories = new Set([tool.category]);
      let tool2: SyntheticToolDefinition;
      let tool3: SyntheticToolDefinition;

      // Try to pick from different categories for richer pipelines
      const diffCatTools2 = otherTools.filter(t => !usedCategories.has(t.category));
      if (diffCatTools2.length > 0) {
        tool2 = pick(diffCatTools2, rng);
        usedCategories.add(tool2.category);
      } else {
        tool2 = pick(otherTools, rng);
      }

      const diffCatTools3 = otherTools.filter(t => t.name !== tool2.name && !usedCategories.has(t.category));
      if (diffCatTools3.length > 0) {
        tool3 = pick(diffCatTools3, rng);
      } else {
        tool3 = pick(otherTools.filter(t => t.name !== tool2.name), rng);
      }

      const verb2 = tool2.name.split('_')[1] || 'apply';
      const verb3 = tool3.name.split('_')[1] || 'set';
      const noun2 = tool2.name.split('_').slice(2).join(' ');
      const noun3 = tool3.name.split('_').slice(2).join(' ');
      const userAlias1 = getUserAlias(tool.name, rng);
      const userAlias2 = getUserAlias(tool2.name, rng);
      const userAlias3 = getUserAlias(tool3.name, rng);
      const template = pick(QUERY_TEMPLATES.T4, rng);
      prompt = template
        .replace('{verb}', verb.charAt(0).toUpperCase() + verb.slice(1))
        .replace('{noun1}', noun)
        .replace('{verb2}', verb2)
        .replace('{noun2}', noun2)
        .replace('{verb3}', verb3)
        .replace('{noun3}', noun3)
        .replace('{user_alias1}', userAlias1)
        .replace('{user_alias2}', userAlias2)
        .replace('{user_alias3}', userAlias3)
        .replace('{category}', CATEGORY_DISPLAY_NAMES[tool.category] || tool.category.replace(/_/g, ' '));
      expectedTools = [tool.name, tool2.name, tool3.name];
      break;
    }
    case 'T5': {
      const template = pick(QUERY_TEMPLATES.T5, rng);
      const userAlias = getUserAlias(tool.name, rng);
      prompt = template
        .replace('{noun}', noun)
        .replace('{user_alias}', userAlias);
      // T5 should include a generator tool
      expectedTools = [tool.name, 'pinepaper_execute_generator'];
      break;
    }
    case 'T6': {
      // Cross-domain ambiguous: pick from different category
      const otherCatTools = allTools.filter(t => t.category !== tool.category);
      const tool2 = otherCatTools.length > 0 ? pick(otherCatTools, rng) : tool;
      const cat1Display = CATEGORY_DISPLAY_NAMES[tool.category] || tool.category.replace(/_/g, ' ');
      const cat2Display = CATEGORY_DISPLAY_NAMES[tool2.category] || tool2.category.replace(/_/g, ' ');
      const template = pick(QUERY_TEMPLATES.T6, rng);
      prompt = template
        .replace('{adjective}', adjective)
        .replace('{category1}', cat1Display)
        .replace('{category2}', cat2Display);
      expectedTools = [tool.name, tool2.name];
      break;
    }
  }

  return {
    id,
    category: tool.category,
    prompt,
    expectedTool: expectedTools[0],
    source: 'synthetic',
    metadata: {
      tier,
      expectedTools,
      acceptableToolSets: [],
      taxonomyMethods,
      difficulty,
      requiresMultiHop: tier === 'T4' || tier === 'T6',
      domain: tool.category,
      crossDomain: tier === 'T6' ? [tool.category] : undefined,
    },
  };
}

// ============================================================================
// Extended Benchmark Builder
// ============================================================================

/**
 * Build the extended benchmark with 1000+ test cases.
 * Accepts either flat SyntheticToolDefinition[] or SyntheticToolWithMethods[].
 */
export function buildExtendedBenchmark(options?: {
  syntheticToolCount?: number;
  targetTotal?: number;
  seed?: number;
  syntheticTools?: SyntheticToolDefinition[];
}): {
  testCases: ExtendedTestCase[];
  syntheticTools: SyntheticToolDefinition[];
  allToolNames: string[];
} {
  const syntheticToolCount = options?.syntheticToolCount ?? 400;
  const targetTotal = options?.targetTotal ?? 1050;
  const seed = options?.seed ?? 42;
  const rng = seededRandom(seed);

  // 1. Start with original 486 cases
  const originalCases: ExtendedTestCase[] = ToolSelectionBenchmark.getAllTestCases().map(tc => ({
    ...tc,
    source: 'original' as const,
  }));

  // 2. Generate paraphrased variants (~200 cases from originals)
  const paraphrasedCases: ExtendedTestCase[] = [];
  const paraphraseTarget = 200;
  const casesToParaphrase = [...originalCases];

  // Shuffle deterministically
  for (let i = casesToParaphrase.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [casesToParaphrase[i], casesToParaphrase[j]] = [casesToParaphrase[j], casesToParaphrase[i]];
  }

  let paraIdCounter = 0;
  for (const tc of casesToParaphrase.slice(0, paraphraseTarget)) {
    paraIdCounter++;
    const paraphrased = paraphrasePrompt(tc.prompt, rng);
    if (paraphrased !== tc.prompt) {
      paraphrasedCases.push({
        ...tc,
        id: `TSB-PARA-${String(paraIdCounter).padStart(4, '0')}`,
        prompt: paraphrased,
        source: 'paraphrase',
      });
    }
  }

  // 3. Generate synthetic tool test cases
  const syntheticTools = options?.syntheticTools ?? generateSyntheticTools(syntheticToolCount, seed);
  const syntheticCases: ExtendedTestCase[] = [];
  const idCounter = { value: 0 };

  // Adjusted tier distribution: increase multi-step cases
  const remaining = targetTotal - originalCases.length - paraphrasedCases.length;
  const tierTargets: Record<Tier, number> = {
    T1: Math.floor(remaining * 0.22),
    T2: Math.floor(remaining * 0.20),
    T3: Math.floor(remaining * 0.22),
    T4: Math.floor(remaining * 0.16),
    T5: Math.floor(remaining * 0.06),
    T6: Math.floor(remaining * 0.14),
  };

  const difficultyByTier: Record<Tier, Difficulty[]> = {
    T1: ['easy', 'easy', 'medium'],
    T2: ['easy', 'medium', 'medium'],
    T3: ['medium', 'medium', 'hard'],
    T4: ['medium', 'hard', 'hard'],
    T5: ['medium', 'hard', 'hard'],
    T6: ['hard', 'hard', 'hard'],
  };

  for (const tier of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'] as Tier[]) {
    const target = tierTargets[tier];
    for (let i = 0; i < target && syntheticCases.length < remaining; i++) {
      const tool = pick(syntheticTools, rng);
      const difficulty = pick(difficultyByTier[tier], rng);
      syntheticCases.push(
        createSyntheticTestCase(tier, difficulty, tool, syntheticTools, rng, idCounter),
      );
    }
  }

  // Combine all cases
  const allCases = [...originalCases, ...paraphrasedCases, ...syntheticCases];

  // Collect all tool names
  const toolNameSet = new Set<string>();
  for (const tc of allCases) {
    for (const t of tc.metadata.expectedTools) {
      toolNameSet.add(t);
    }
  }

  return {
    testCases: allCases,
    syntheticTools,
    allToolNames: [...toolNameSet],
  };
}

// ============================================================================
// Extended Benchmark Evaluator
// ============================================================================

/**
 * Evaluate a findTools function on the extended benchmark.
 */
export function evaluateExtended(
  testCases: ExtendedTestCase[],
  findTools: (instruction: string) => RankedTool[],
): ToolSelectionResult {
  let r1Sum = 0, r3Sum = 0, r5Sum = 0, ndcg5Sum = 0, mrrSum = 0;
  const byDifficulty: Record<string, { r5Sum: number; mrrSum: number; count: number }> = {};

  for (const tc of testCases) {
    const ranked = findTools(tc.prompt);
    const predicted = ranked.map(r => r.tool);
    const gt = tc.metadata.expectedTools;

    const r1 = ToolSelectionBenchmark.recallAtK(predicted, gt, 1);
    const r3 = ToolSelectionBenchmark.recallAtK(predicted, gt, 3);
    const r5 = ToolSelectionBenchmark.recallAtK(predicted, gt, 5);
    const n5 = ToolSelectionBenchmark.ndcgAtK(predicted, gt, 5);
    const m = ToolSelectionBenchmark.mrr(predicted, gt);

    r1Sum += r1; r3Sum += r3; r5Sum += r5; ndcg5Sum += n5; mrrSum += m;

    const d = tc.metadata.difficulty;
    if (!byDifficulty[d]) byDifficulty[d] = { r5Sum: 0, mrrSum: 0, count: 0 };
    byDifficulty[d].r5Sum += r5;
    byDifficulty[d].mrrSum += m;
    byDifficulty[d].count++;
  }

  const n = testCases.length || 1;
  return {
    recall_at_1: r1Sum / n,
    recall_at_3: r3Sum / n,
    recall_at_5: r5Sum / n,
    ndcg_at_5: ndcg5Sum / n,
    mrr: mrrSum / n,
    totalCases: testCases.length,
    byDifficulty: Object.fromEntries(
      Object.entries(byDifficulty).map(([d, v]) => [
        d,
        { recall_at_5: v.r5Sum / (v.count || 1), mrr: v.mrrSum / (v.count || 1) },
      ]),
    ),
  };
}

/**
 * Evaluate by tier for extended benchmark.
 */
export function evaluateExtendedByTier(
  testCases: ExtendedTestCase[],
  findTools: (instruction: string) => RankedTool[],
): Record<string, ToolSelectionResult> {
  const byTier = new Map<string, ExtendedTestCase[]>();
  for (const tc of testCases) {
    const tier = tc.metadata.tier;
    if (!byTier.has(tier)) byTier.set(tier, []);
    byTier.get(tier)!.push(tc);
  }

  const results: Record<string, ToolSelectionResult> = {};
  for (const [tier, cases] of byTier) {
    results[tier] = evaluateExtended(cases, findTools);
  }
  return results;
}

/**
 * Evaluate by source for extended benchmark.
 */
export function evaluateExtendedBySource(
  testCases: ExtendedTestCase[],
  findTools: (instruction: string) => RankedTool[],
): Record<string, ToolSelectionResult> {
  const bySource = new Map<string, ExtendedTestCase[]>();
  for (const tc of testCases) {
    if (!bySource.has(tc.source)) bySource.set(tc.source, []);
    bySource.get(tc.source)!.push(tc);
  }

  const results: Record<string, ToolSelectionResult> = {};
  for (const [source, cases] of bySource) {
    results[source] = evaluateExtended(cases, findTools);
  }
  return results;
}

/**
 * Get tier counts for extended benchmark.
 */
export function getExtendedTierCounts(testCases: ExtendedTestCase[]): Record<Tier, number> {
  const counts: Record<string, number> = {};
  for (const tc of testCases) {
    counts[tc.metadata.tier] = (counts[tc.metadata.tier] || 0) + 1;
  }
  return counts as Record<Tier, number>;
}

/**
 * Get source breakdown for extended benchmark.
 */
export function getSourceCounts(testCases: ExtendedTestCase[]): Record<string, number> {
  const counts: Record<string, number> = { original: 0, paraphrase: 0, synthetic: 0 };
  for (const tc of testCases) {
    counts[tc.source] = (counts[tc.source] || 0) + 1;
  }
  return counts;
}
