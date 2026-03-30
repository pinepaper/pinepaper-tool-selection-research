# PinePaper Tool Selection Research

**PinePaper-ToolBench: Benchmarking Tool Selection for MCP-Based Design Agents**

This repository contains the benchmark data, experiment code, and paper source for our tool selection research.

## Paper

We introduce **PinePaper-ToolBench**, the first public benchmark for tool selection in MCP-based LLM agents (559 test cases, 124 MCP tools, 6 complexity tiers, 17 categories).

**Key findings:**
- **BM25 over taxonomy-enriched documents is a surprisingly strong baseline** (R@5=0.855)
- KG-Hybrid achieves the highest R@5 of **0.868**, but the aggregate improvement over BM25 is **not statistically significant** (p=0.095)
- Gains concentrate on **compositional** (T4: +3.7) and **cross-domain** (T6: +3.1) queries
- KG slightly **hurts** implicit single-tool queries (T2: -1.9) — structural signal adds noise when one tool suffices
- All methods run in **sub-millisecond** time (BM25: <0.1ms, KG-Hybrid: 0.2ms)
- T6 tier covers all **17 categories** with mixed difficulty (medium + hard) for unbiased cross-domain evaluation

**Links:**
- Paper source: [`paper/main.tex`](paper/main.tex)
- Compiled PDF: [`paper/main.pdf`](paper/main.pdf)
- arXiv: *(pending)*

## Results (559 test cases)

| Method | R@1 | R@3 | R@5 | NDCG@5 | MRR | Latency |
|--------|-----|-----|-----|--------|-----|---------|
| Random | 0.025 | 0.074 | 0.108 | 0.072 | 0.089 | <0.1 ms |
| Keyword | 0.533 | 0.747 | 0.817 | 0.704 | 0.741 | 0.14 ms |
| TF-IDF | 0.503 | 0.763 | 0.841 | 0.716 | 0.731 | <0.1 ms |
| BM25 | 0.578 | 0.786 | 0.855 | 0.753 | 0.778 | <0.1 ms |
| KG-ToolRank | 0.364 | 0.579 | 0.634 | 0.525 | 0.551 | 0.42 ms |
| **KG-Hybrid** | **0.579** | **0.821** | **0.868** | **0.767** | **0.786** | 0.20 ms |

### Per-Tier Recall@5

| Method | T1 | T2 | T3 | T4 | T5 | T6 |
|--------|------|------|------|------|------|------|
| BM25 | 0.991 | **0.914** | 0.908 | 0.896 | 0.900 | 0.580 |
| **KG-Hybrid** | 0.991 | 0.895 | **0.939** | **0.933** | 0.900 | **0.611** |

## Reproducing Results

```bash
# Prerequisites: Bun runtime (https://bun.sh)
# No API keys, no external models, no GPU required

# Quick validation (526 cases, 7 baselines)
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

results/                 # Experiment outputs
  track-a-results.json   # Track A: 526 cases, 7 baselines, all metrics
  extended-results.json  # Track B: 1000+ cases, 500+ tools
  summary.md             # Human-readable aggregate results

benchmark.ts             # PinePaper-ToolBench: 559 test cases across 6 tiers
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
| T1 | Single-tool, explicit | 108 | "Create a circle at (200, 300)" |
| T2 | Single-tool, implicit | 105 | "I need a pulsing glow effect" |
| T3 | Multi-tool sequential (2) | 98 | "Draw a star and animate it" |
| T4 | Multi-tool compositional (3+) | 72 | "Build a flowchart with transitions" |
| T5 | Generator-requiring | 60 | "Generate a sunburst background" |
| T6 | Cross-domain ambiguous | 116 | "Make it look cinematic" |

**Track B — Scale Evaluation (500+ tools):**
- 400 synthetic MCP tools with **vocabulary-separated** descriptions (~7% Jaccard overlap vs ~24% in real taxonomy)
- **Shell composite nodes**: surface vocabulary (user-facing) → interior vocabulary (technical schemas) via `uses` edges
- Full KG integration: method nodes, parameter schemas, `implements`/`similar` edges

## Citation

```bibtex
@article{kulshrestha2026toolbench,
  title={PinePaper-ToolBench: Benchmarking Tool Selection for {MCP}-Based Design Agents},
  author={Kulshrestha, Arpit},
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
