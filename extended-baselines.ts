/**
 * Pine Paper LLM v0 — Extended Baselines
 *
 * All baselines adapted to work on the extended corpus (real + synthetic tools).
 * Uses the same scoring algorithms as baselines.ts but over the combined pool.
 *
 * Key addition: buildSyntheticKG() injects synthetic method/tool/parameter nodes
 * and edges into a real KG, enabling KG-Hybrid to leverage structural features
 * for synthetic tools (not just flat text matching).
 */

import {
  tokenize,
  type ToolDocument,
  type BaselineConfig,
  buildCorpus,
  createRandomBaseline,
  createKeywordBaseline,
  createBM25Baseline,
  createTFIDFBaseline,
} from './baselines.js';
import {
  generateSyntheticToolsWithMethods,
  type SyntheticToolDefinition,
  type SyntheticToolWithMethods,
  type SyntheticMethod,
  type SimilarEdge,
  type SyntheticShell,
} from './synthetic-tools.js';
import type { RankedTool } from './benchmark.js';
import { allMethods } from '../../src/taxonomy/methods.js';
import { KGQueryEngine } from '../../src/cognitive/kg-query-engine.js';
import { KnowledgeGraphBuilder, buildKnowledgeGraph } from '../../src/knowledge-graph/builder.js';
import type {
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  KnowledgeGraph,
  SearchIndex,
} from '../../src/knowledge-graph/schema.js';

// ============================================================================
// Extended Corpus Builder
// ============================================================================

/**
 * Build a document corpus that includes both real taxonomy tools
 * and synthetic tool definitions. For synthetic tools with methods,
 * we aggregate method text (names, descriptions, tags, examples)
 * to match how real tools are indexed.
 */
export function buildExtendedCorpus(
  syntheticTools: SyntheticToolDefinition[] | SyntheticToolWithMethods[],
): ToolDocument[] {
  // Start with the real taxonomy corpus
  const realCorpus = buildCorpus();

  // Add synthetic tool documents
  for (const tool of syntheticTools) {
    const parts = [
      tool.name.replace(/_/g, ' '),
      tool.description,
      tool.tags.join(' '),
      tool.category.replace(/_/g, ' '),
    ];

    // Add param descriptions from schema
    for (const [paramName, paramDef] of Object.entries(tool.inputSchema.properties)) {
      parts.push(paramName.replace(/_/g, ' '));
      parts.push(paramDef.description);
    }

    // If tool has methods, aggregate method text (mirrors how buildCorpus works for real tools)
    if ('methods' in tool && tool.methods) {
      for (const m of tool.methods) {
        parts.push(m.name);
        parts.push(m.description);
        parts.push(m.tags.join(' '));
        // Add example instructions
        for (const ex of m.examples) {
          parts.push(ex.instruction);
        }
        // Add parameter names and descriptions
        for (const p of m.parameters) {
          parts.push(p.name.replace(/_/g, ' '));
          parts.push(p.description);
          if (p.enumValues) {
            parts.push(p.enumValues.join(' '));
          }
        }
      }
    }

    const text = parts.join(' ');
    const terms = tokenize(text);
    const termFrequencies = new Map<string, number>();
    for (const t of terms) {
      termFrequencies.set(t, (termFrequencies.get(t) || 0) + 1);
    }

    realCorpus.push({
      toolName: tool.name,
      text,
      terms,
      termFrequencies,
      docLength: terms.length,
    });
  }

  return realCorpus;
}

// ============================================================================
// Synthetic KG Builder
// ============================================================================

/**
 * Build a knowledge graph that includes both real taxonomy nodes
 * and synthetic method/tool/parameter/example nodes with edges.
 *
 * Returns the augmented KG + SearchIndex ready for KGQueryEngine.load().
 */
export function buildSyntheticKG(
  tools: SyntheticToolWithMethods[],
  methods: SyntheticMethod[],
  similarEdges: SimilarEdge[],
  crossDomainBridges: SimilarEdge[],
  shells?: SyntheticShell[],
): { graph: KnowledgeGraph; index: SearchIndex } {
  // 1. Start with the real KG (taxonomy only, no tool manifest)
  const { graph: baseGraph, index: baseIndex } = buildKnowledgeGraph();

  // 2. Build synthetic nodes
  const newNodes: KnowledgeGraphNode[] = [];
  const newEdges: KnowledgeGraphEdge[] = [];

  // Category nodes
  const syntheticCategories = new Set(tools.map(t => t.category));
  for (const cat of syntheticCategories) {
    newNodes.push({
      id: `category.synth_${cat}`,
      type: 'category',
      label: { en: cat.replace(/_/g, ' ') },
      description: `Synthetic category: ${cat.replace(/_/g, ' ')}`,
      properties: { synthetic: true },
    });
  }

  // Tool nodes
  for (const tool of tools) {
    newNodes.push({
      id: `tool.${tool.name}`,
      type: 'tool',
      label: { en: tool.name.replace(/_/g, ' ') },
      description: tool.description,
      properties: {
        synthetic: true,
        category: tool.category,
        tags: tool.tags,
        inputSchema: tool.inputSchema,
      },
    });

    // Tool → category edge
    newEdges.push({
      source: `category.synth_${tool.category}`,
      target: `tool.${tool.name}`,
      type: 'has_method',
      weight: 1.0,
    });
  }

  // Method nodes + edges
  for (const method of methods) {
    newNodes.push({
      id: method.id,
      type: 'method',
      label: { en: method.name },
      description: method.description,
      properties: {
        synthetic: true,
        mcpTool: method.mcpTool,
        category: method.category,
        tags: method.tags,
        complexity: 'moderate',
      },
    });

    // Method → tool (implements) edge
    newEdges.push({
      source: method.id,
      target: `tool.${method.mcpTool}`,
      type: 'implements',
      weight: 1.0,
    });

    // Method → category edge
    newEdges.push({
      source: `category.synth_${method.category}`,
      target: method.id,
      type: 'has_method',
      weight: 1.0,
    });

    // Parameter nodes + edges
    for (const param of method.parameters) {
      const paramId = `${method.id}.param.${param.name}`;
      newNodes.push({
        id: paramId,
        type: 'parameter',
        label: { en: param.name },
        description: param.description,
        properties: {
          paramType: param.type,
          required: param.required,
          default: param.default,
          min: param.min,
          max: param.max,
          enumValues: param.enumValues,
        },
      });

      newEdges.push({
        source: method.id,
        target: paramId,
        type: 'has_parameter',
        weight: 1.0,
      });
    }

    // Example nodes + edges
    for (let ei = 0; ei < method.examples.length; ei++) {
      const exId = `${method.id}.example.${ei}`;
      newNodes.push({
        id: exId,
        type: 'example',
        label: { en: method.examples[ei].instruction },
        description: method.examples[ei].instruction,
        properties: {
          code: method.examples[ei].code,
          rewardScore: 0.8,
        },
      });

      newEdges.push({
        source: method.id,
        target: exId,
        type: 'has_example',
        weight: 1.0,
      });
    }
  }

  // Similar edges between synthetic methods
  for (const edge of similarEdges) {
    newEdges.push({
      source: edge.source,
      target: edge.target,
      type: 'similar',
      weight: edge.weight,
      metadata: { reason: edge.reason },
    });
  }

  // Cross-domain bridges (synthetic → real methods)
  for (const bridge of crossDomainBridges) {
    newEdges.push({
      source: bridge.source,
      target: bridge.target,
      type: 'similar',
      weight: bridge.weight,
      metadata: { reason: 'cross_domain' },
    });
  }

  // Shell composite nodes (surface vocabulary layer)
  if (shells && shells.length > 0) {
    for (const shell of shells) {
      newNodes.push({
        id: shell.id,
        type: 'template',
        label: { en: shell.surfaceLabel },
        description: shell.surfaceDescription,
        properties: {
          synthetic: true,
          category: shell.category,
          tags: shell.tags,
          technicalTags: shell.technicalTags,
          interiorDescription: shell.interiorDescription,
        },
      });

      // Shell → tool edges (uses = shell uses tool)
      for (const toolId of shell.toolIds) {
        newEdges.push({
          source: shell.id,
          target: `tool.${toolId}`,
          type: 'uses',
          weight: 1.0,
        });

        // Tool → shell edges (part_of)
        newEdges.push({
          source: `tool.${toolId}`,
          target: shell.id,
          type: 'part_of',
          weight: 0.9,
        });
      }

      // Shell → category edge
      newEdges.push({
        source: `category.synth_${shell.category}`,
        target: shell.id,
        type: 'has_method',
        weight: 1.0,
      });
    }
  }

  // 3. Merge into base graph
  const augmentedGraph: KnowledgeGraph = {
    ...baseGraph,
    nodes: [...baseGraph.nodes, ...newNodes],
    edges: [...baseGraph.edges, ...newEdges],
    stats: {
      ...baseGraph.stats,
      totalNodes: baseGraph.stats.totalNodes + newNodes.length,
      totalEdges: baseGraph.stats.totalEdges + newEdges.length,
      methodCount: baseGraph.stats.methodCount + methods.length,
      toolCount: (baseGraph.stats.toolCount || 0) + tools.length,
    },
  };

  // 4. Build augmented search index
  const newEntries = methods.map(m => ({
    nodeId: m.id,
    text: [
      m.name,
      m.description,
      m.tags.join(' '),
      m.parameters.map(p => `${p.name} ${p.description}`).join(' '),
      m.examples.map(e => e.instruction).join(' '),
    ].join(' ').toLowerCase(),
    type: 'method' as const,
    category: m.category,
  }));

  // Also index tool nodes for findTools (interior/technical vocabulary)
  const toolEntries = tools.map(t => ({
    nodeId: `tool.${t.name}`,
    text: [
      t.name.replace(/_/g, ' '),
      t.description,
      t.tags.join(' '),
    ].join(' ').toLowerCase(),
    type: 'tool' as const,
    category: t.category,
  }));

  // Index shell nodes (surface/user vocabulary layer)
  const shellEntries = (shells || []).map(s => ({
    nodeId: s.id,
    text: [
      s.surfaceLabel,
      s.surfaceDescription,
      s.tags.join(' '),
    ].join(' ').toLowerCase(),
    type: 'template' as const,
    category: s.category,
  }));

  const augmentedIndex: SearchIndex = {
    ...baseIndex,
    entries: [...baseIndex.entries, ...newEntries, ...toolEntries, ...shellEntries],
  };

  return { graph: augmentedGraph, index: augmentedIndex };
}

// ============================================================================
// Extended KG-Hybrid Baseline
// ============================================================================

/**
 * Create a KG-Hybrid baseline operating on the augmented KG
 * (real taxonomy + synthetic method/tool nodes and edges).
 *
 * Same algorithm as baselines.ts:createKGHybridBaseline() but the
 * KG engine now returns both real and synthetic methods, and
 * `implements` edges lead to both real and synthetic tools.
 */
export function createExtendedKGHybridBaseline(
  corpus: ToolDocument[],
  augmentedGraph: KnowledgeGraph,
  augmentedIndex: SearchIndex,
  options?: { alpha?: number; dampingFactor?: number },
): BaselineConfig {
  const alpha = options?.alpha ?? 0.6;
  const dampingFactor = options?.dampingFactor ?? 0.3;

  // Build BM25 index from extended corpus
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

  // Load augmented KG engine
  const engine = new KGQueryEngine();
  engine.load(augmentedGraph, augmentedIndex);

  // Build corpus tool set for filtering
  const corpusToolSet = new Set(corpus.map(d => d.toolName));

  return {
    name: 'KG-Hybrid',
    shortName: 'KG-Hyb',
    findTools(instruction: string): RankedTool[] {
      const queryTerms = tokenize(instruction);
      if (queryTerms.length === 0) return [];

      // Phase 1: BM25 retrieval over extended corpus
      const bm25Scores = new Map<string, number>();
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
          bm25Scores.set(doc.toolName, score);
        }
      }

      // Phase 2: KG structural scoring (now includes synthetic methods + shells)
      const kgScores = new Map<string, number>();

      // 2a. Find matching methods (real + synthetic) and boost their mcpTools
      const methods = engine.findMethods(instruction, 15);
      for (const method of methods) {
        if (method.mcpTool && corpusToolSet.has(method.mcpTool)) {
          kgScores.set(
            method.mcpTool,
            (kgScores.get(method.mcpTool) || 0) + method.score * 0.6,
          );
        }

        // 2b. PPR: get similar/enhances methods and boost their tools
        const related = engine.getRelated(method.methodId, ['similar', 'enhances']);
        for (const relNode of related) {
          const relTool = relNode.properties.mcpTool as string | undefined;
          if (relTool && corpusToolSet.has(relTool)) {
            kgScores.set(
              relTool,
              (kgScores.get(relTool) || 0) + method.score * dampingFactor * 0.4,
            );
          }
        }
      }

      // 2c. Shell traversal: find matching template/shell nodes and follow
      //     'uses' edges to boost interior tools (bridges vocabulary gap)
      const templateNodes = engine.findMethods(instruction, 10);
      for (const tNode of templateNodes) {
        // Follow 'uses' edges from shell to tools
        const contained = engine.getRelated(tNode.methodId, ['uses']);
        for (const child of contained) {
          const childToolName = child.id?.replace('tool.', '') || '';
          if (childToolName && corpusToolSet.has(childToolName)) {
            kgScores.set(
              childToolName,
              (kgScores.get(childToolName) || 0) + tNode.score * 0.5,
            );
          }
        }
      }

      // Collect all candidate tools
      const allTools = new Set<string>([...bm25Scores.keys(), ...kgScores.keys()]);

      // Normalize scores
      let maxBM25 = 0;
      for (const v of bm25Scores.values()) {
        if (v > maxBM25) maxBM25 = v;
      }
      let maxKG = 0;
      for (const v of kgScores.values()) {
        if (v > maxKG) maxKG = v;
      }

      // Fuse
      const scored: Array<{ tool: string; score: number }> = [];
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
// Extended Baseline Factory
// ============================================================================

/**
 * Create all baselines for the extended corpus.
 * Includes KG-Hybrid with augmented KG (synthetic tools have KG structure).
 */
export function createExtendedBaselines(
  syntheticTools: SyntheticToolDefinition[] | SyntheticToolWithMethods[],
  augmentedKG?: { graph: KnowledgeGraph; index: SearchIndex },
): BaselineConfig[] {
  const corpus = buildExtendedCorpus(syntheticTools);
  const baselines: BaselineConfig[] = [
    createRandomBaseline(corpus),
    createKeywordBaseline(corpus),
    createBM25Baseline(corpus),
    createTFIDFBaseline(corpus),
  ];

  // Add KG-Hybrid with augmented KG if provided
  if (augmentedKG) {
    baselines.push(
      createExtendedKGHybridBaseline(corpus, augmentedKG.graph, augmentedKG.index),
    );
  }

  return baselines;
}
