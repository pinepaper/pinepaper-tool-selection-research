# arXiv submission — what is ready and what you have to do

**Prepared 2026-09-07.** The package builds; the posting itself needs your account.

## The package

`arxiv-submission.tar.gz` (18 KB, 5 files):

```
main.tex
main.bbl                        # arXiv does NOT run bibtex — the .bbl is the bibliography
tables/track-comparison.tex
tables/extended-per-tier.tex
tables/extended-source.tex
```

`references.bib`, the unused `figures/*.dat`, and the six tables `main.tex` never `\input`s were
**excluded on purpose**: shipping a `.bib` invites arXiv to attempt a bibtex pass it does not run,
and unused files draw processing warnings.

**Verified the way arXiv builds it** — `pdflatex` twice, no bibtex, from the package directory
alone: exit 0, **15 pages**, zero undefined citations, zero undefined references.

## What changed in this revision

A new Discussion subsection, **"Does retrieval quality transfer to the end task?"**, plus a
Limitations bullet and a qualifier on the Conclusion's "default starting point" sentence.

It reports that on a companion generation study over the same MCP server — 200 held-out prompts,
stock `gemini-2.5-flash`, emitted tool calls **executed in the design engine** rather than ranked —
**no retrieval configuration separates from dumping the full 112-tool catalog**, KG-Hybrid included:

| configuration | pass rate | Δ vs. no retrieval (95% CI) |
|---|---|---|
| full 112-tool schema | 106/200 (53.0%) | — |
| BM25 router | 102/200 (51.0%) | −0.020 [−0.070, +0.025] |
| BM25 top-K (K=10) | 108/200 (54.0%) | +0.010 [−0.050, +0.070] |
| KG-Hybrid | 104/200 (52.0%) | −0.010 [−0.075, +0.055] |

KG-Hybrid vs BM25 router: +0.010, CI [−0.050, +0.070] — not separated. Intervals are paired bootstrap
over the 200 items, B=20,000, **seed 20260907**; all four configurations scored in one run against one
version of the harness.

**Why include a result that qualifies our own headline.** Because we measured it, and because the
paper's retrieval claims are untouched by it: Recall@5 = 0.868 at p = 0.045 remains exactly what it
was. What the addition does is bound the reading. The honest practitioner takeaway becomes *cost*
rather than *quality* — a 94% token reduction at no measurable loss in end-task performance is still
a strong reason to deploy retrieval, and it is a claim that will survive contact with a reader who
tries it. A reviewer who ran this experiment themselves and found it missing would be entitled to
ask why.

The section also names the mechanism instead of only reporting a null: in the generation setting
most `implements` edges promote tools that are **already** in the prompt, because an agent cannot
function without the core create/modify/animate surface, and several capabilities that look like
distinct retrieval targets are arguments to one tool (generators are parameters of
`execute_generator`). The structural signal is real; it has little left to add once the core set is
present regardless.

**Provenance of the added numbers.** `pinepaper-llm-v0/data/eval/scores-L26fix/` — all four
configurations, one run, one harness version. An earlier draft of this file and of the paper carried
the BM25 router at **101 / −0.025**; that value came from a run in which one item (`t2-042`) failed a
colour assertion because the scorer took the **top-left pixel as the background**, and that
completion draws into the corner — its canvas is 99.8% the requested colour. The defect was fixed
(consensus of the four corners) rather than the item hand-corrected, the four configurations were
re-scored, and the router reads **102 / −0.020**. The fix moves exactly that one item and leaves the
gallery reference set at 40 pass / 2 fail of 42. The
previously circulated figures — "retrieval lifts 44% → 50%" and "KG-Hybrid 49 vs BM25 50" —
were measured under a scorer defect that under-counted the no-retrieval baseline far more than the
routers, and **must not be quoted**; they are what this revision replaces.

## What you have to do

I cannot post to arXiv — it needs your account and an interactive submission.

1. Log in at <https://arxiv.org/submit>.
2. **Primary category:** `cs.IR` (Information Retrieval). **Cross-list:** `cs.AI`, `cs.CL`.
3. Upload `arxiv-submission.tar.gz`.
4. Title, authors and abstract come from `main.tex`. **Decided 2026-09-26:** credited publicly as
   "PinePaper Research" everywhere (paper and `CITATION.cff`); the paper is posted as a PDF on
   pinepaper.studio rather than arXiv, because arXiv shows the submitting account's name.
5. **License:** the repo is MIT. Pick a CC license deliberately — arXiv's default (non-exclusive
   perpetual) is fine for a preprint; CC BY 4.0 if you want reuse. This choice is not reversible
   after announcement.
6. Confirm the generated PDF is 15 pages and the new Discussion subsection is present before
   submitting.
7. After it announces, put the arXiv ID in `README.md` (line 21, currently `arXiv: *(pending)*`) and
   add `identifiers:` to `CITATION.cff`.

## One thing to decide before you post

The paper's GitHub URL is `github.com/pinepaper/pinepaper-tool-selection-research`, cited in the
Reproducibility paragraph as publicly available. **Confirm that repository is actually public**
before submitting — arXiv listings are permanent and a dead link in the reproducibility section is
the kind of thing that gets noticed.
