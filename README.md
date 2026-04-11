# PinePaper Tool Selection Research

**PinePaper-ToolBench: Benchmarking Tool Selection for MCP-Based Design Agents**

This repository contains the benchmark data, experiment code, and paper source for our tool selection research.

## Paper

We introduce **PinePaper-ToolBench**, the first public benchmark for tool selection in MCP-based LLM agents (582 test cases, 212 MCP tools, 6 complexity tiers, 18 categories).

**Key findings:**
- **BM25 over taxonomy-enriched documents is a surprisingly strong baseline** (R@5=0.854)
- KG-Hybrid achieves the highest R@5 of **0.868**, with the aggregate improvement over BM25 **statistically significant** (p=0.045)
- Gains concentrate on **compositional** (T4: +4.0) and **cross-domain** (T6: +3.0) queries
- KG slightly **hurts** implicit single-tool queries (T2: -1.8) — structural signal adds noise when one tool suffices
- All methods run in **sub-millisecond** time (BM25: <0.1ms, KG-Hybrid: 0.1ms)

**Links:**
- Paper source: [`paper/main.tex`](paper/main.tex)
- Compiled PDF: [`paper/main.pdf`](paper/main.pdf)
- arXiv: *(pending)*

## Results (582 test cases)

| Method | R@1 | R@3 | R@5 | NDCG@5 | MRR | Latency |
|--------|-----|-----|-----|--------|-----|---------|
| Random | 0.022 | 0.061 | 0.107 | 0.066 | 0.083 | <0.1 ms |
| Keyword | 0.512 | 0.732 | 0.814 | 0.702 | 0.738 | 0.2 ms |
| TF-IDF | 0.493 | 0.749 | 0.840 | 0.716 | 0.732 | <0.1 ms |
| BM25 | 0.567 | 0.775 | 0.854 | 0.757 | 0.783 | <0.1 ms |
| KG-ToolRank | 0.452 | 0.642 | 0.702 | 0.617 | 0.646 | 0.5 ms |
| **KG-Hybrid** | **0.568** | **0.806** | **0.868** | **0.769** | **0.788** | 0.2 ms |

### Per-Tier Recall@5

| Method | T1 | T2 | T3 | T4 | T5 | T6 |
|--------|------|------|------|------|------|------|
| BM25 | 0.983 | **0.910** | 0.911 | 0.892 | 0.900 | 0.578 |
| **KG-Hybrid** | 0.991 | 0.892 | **0.941** | **0.932** | 0.900 | **0.608** |

## Verifiable Data

The [`data/`](data/) directory contains machine-readable manifests for independent verification:

| File | Description |
|------|-------------|
| [`data/benchmark-cases.json`](data/benchmark-cases.json) | All 582 test cases with prompts, expected tools, tiers, and difficulty |
| [`data/taxonomy-manifest.json`](data/taxonomy-manifest.json) | 178 design methods across 18 categories mapped to 51 canonical tools |
| [`data/mcp-tool-manifest.json`](data/mcp-tool-manifest.json) | Full 212-tool MCP manifest with taxonomy coverage analysis |

### Tool Inventory Summary

| Metric | Count |
|--------|-------|
| MCP tools (full catalog) | 212 |
| Taxonomy-mapped tools (benchmark scope) | 51 |
| Design methods | 178 |
| Categories | 18 |
| Generators | 51 |
| Test cases | 582 |

**Categories:** 3d, acoustic, animations, blending, camera, composition, data_visualization, diagrams, effects, export, filters, generators, masking, path_operations, relations, rigging, shapes, styling

## Reproducing Results

```bash
# Prerequisites: Bun runtime (https://bun.sh)
# No API keys, no external models, no GPU required

# Quick validation (582 cases, 7 baselines)
bun run run-experiments.ts

# Full evaluation with statistics, ablations, and hyperparameter sweeps
bun run run-experiments.ts --full

# Extended benchmark (1,000+ cases, 500+ tools with synthetic KG)
bun run run-experiments.ts --extended

# Run tests
bun test
```

All experiments are **deterministic** — seeded RNG, no stochastic components. Re-runs produce bit-identical results.

## Repository Structure

```
paper/                    # LaTeX source, tables, figures, bibliography
  main.tex               # Paper source (14 pages)
  main.pdf               # Compiled PDF
  references.bib         # Bibliography (22 entries)
  tables/                # Generated LaTeX tables (ablation, significance, sweeps)
  figures/               # pgfplots data files

data/                    # Verifiable tool and benchmark manifests
  benchmark-cases.json   # All 582 test cases (prompts, tools, tiers, difficulty)
  taxonomy-manifest.json # 178 methods → 18 categories → 51 tools mapping
  mcp-tool-manifest.json # Full 212-tool MCP catalog with coverage analysis

results/                 # Experiment outputs
  track-a-results.json   # Track A: 582 cases, 7 baselines, all metrics
  extended-results.json  # Track B: 1000+ cases, 500+ tools
  summary.md             # Human-readable aggregate results

benchmark.ts             # PinePaper-ToolBench: 582 test cases across 6 tiers
baselines.ts             # 7 baselines: Random, Keyword, BM25, TF-IDF, KG variants
statistics.ts            # Paired t-test, Wilcoxon, bootstrap CI, Cohen's d, McNemar's
ablations.ts             # 6 ablation variants + alpha/damping sweeps
synthetic-tools.ts       # 400 synthetic tools for Track B (vocabulary-separated)
extended-benchmark.ts    # Extended benchmark builder (1000+ cases)
extended-baselines.ts    # Extended baselines with synthetic KG + shell composites
run-experiments.ts       # Experiment runner (quick / full / extended modes)
tests/                   # Test suites (63 tests)
```

## Benchmark Design

**6 Complexity Tiers:**

| Tier | Description | Cases | Example |
|------|-------------|-------|---------|
| T1 | Single-tool, explicit | 117 | "Create a circle at (200, 300)" |
| T2 | Single-tool, implicit | 111 | "I need a pulsing glow effect" |
| T3 | Multi-tool sequential (2) | 101 | "Draw a star and animate it" |
| T4 | Multi-tool compositional (3+) | 74 | "Build a flowchart with transitions" |
| T5 | Generator-requiring | 60 | "Generate a sunburst background" |
| T6 | Cross-domain ambiguous | 119 | "Make it look cinematic" |

**Difficulty distribution:** 157 easy (27.0%), 201 medium (34.5%), 224 hard (38.5%)

**Track B — Scale Evaluation (500+ tools):**
- 400 synthetic MCP tools with **vocabulary-separated** descriptions (~7% Jaccard overlap vs ~24% in real taxonomy)
- **Shell composite nodes**: surface vocabulary (user-facing) → interior vocabulary (technical schemas) via `uses` edges
- Full KG integration: method nodes, parameter schemas, `implements`/`similar` edges

## Citation

```bibtex
@article{elysium2026toolbench,
  title={PinePaper-ToolBench: Benchmarking Tool Selection for {MCP}-Based Design Agents},
  author={Elysium, Nova},
  year={2026},
  url={https://github.com/pinepaper/pinepaper-tool-selection-research}
}
```

## Related

- [PinePaper Studio](https://pinepaper.studio) — Main application
- [PinePaper MCP Server](https://npmjs.com/package/@pinepaper.studio/mcp-server) — MCP tools
- [Model Context Protocol](https://modelcontextprotocol.io) — MCP specification

## License

MIT
