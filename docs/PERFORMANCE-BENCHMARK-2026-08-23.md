# Gajendra performance benchmark — 2026-08-23

Historical receipt. The [September audit](PERFORMANCE-AUDIT-2026-09-05.md) records the fresh
comparison, retained discovery optimization, and rejected concurrent Codex projection.

Status: branch-local on `codex/gajendra-performance`. The measurements were
established from `185f9f3769cc26571cf0ad554ab5ab3e586b38af`; the implementation
is now commit `40b5d57` on current base `df47594`. This work is not merged or
installed.

Upstream reconciliation note, 2026-08-24: the implementation was committed as
`40b5d57` and rebased onto current `origin/main` `df47594`, which includes PRs
#25 and #26. Those commits changed the same Codex review/source paths measured
here. `npm run check` passes on the rebased branch, but the numbers below were
captured before that reconciliation and must not be described as current-main
or merge-ready evidence until the rebased comparison is remeasured.

## Contract

Reduce measured snapshot latency without changing thread selection, private
storage, fail-closed provider handling, the 200-candidate review ceiling, or the
four-worker Codex review cap. Keep benchmark output aggregate-only.

Environment: macOS arm64, Node `v26.3.0`, npm `11.16.0`.

## Bottlenecks

- Claude and Grok discovery issued one filesystem `stat` at a time while
  ranking up to 1,000 candidates.
- Codex runtime activity discovery and experimental review-summary discovery
  ran sequentially. A source-isolated baseline attributed nearly all live
  snapshot time to Codex: `2,491.62 ms` median versus `130.91 ms` with no
  sources; activity enrichment added about `197 ms` to the Codex path.

## Changes

- Bound Claude and Grok metadata reads to the existing eight-worker source
  collection ceiling.
- Run the independent Codex activity and review projections concurrently, then
  merge only review signals whose final runtime state remains eligible. Running
  status keeps precedence.
- Add a deterministic, aggregate-only source-discovery benchmark and a merge
  regression test.

## Before and after

The discovery benchmark creates 1,000 synthetic candidates across 20 projects,
selects and reads 200 per source, warms once, and reports seven measured runs.

| Benchmark | Before median | After median | Change | Before p95 | After p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Claude discovery | 18.24 ms | 11.97 ms | -34.4% | 19.48 ms | 13.44 ms |
| Grok discovery | 20.85 ms | 15.36 ms | -26.3% | 23.41 ms | 16.94 ms |
| Live Codex + Cursor snapshot | 2,388.40 ms | 2,257.15 ms | -5.5% | 2,821.82 ms | 2,718.81 ms |

The live benchmark used seven fresh child processes, an isolated temporary data
directory, current local provider state, and printed only focus/important/source
counts. It is diagnostic rather than deterministic because local thread state
and app-server load can drift. One initial post-change discovery run also saw a
single `508.60 ms` Claude outlier under concurrent workstation load; the table
uses the immediately repeated same-configuration run, while retaining this
variance note rather than hiding it.

## Verification

- Original measured tree: `npm run check` passed with 99 unit/integration tests.
- Rebased `40b5d57`: `npm run check` passed again on 2026-08-24 with 107
  unit/integration tests.
- TypeScript, UI/server builds, launch-asset validation, and plugin validation:
  passed.
- `npm --workspace gajendra run benchmark:sources`: passed with the same 1,000
  candidates, 20 directories, and 1,000 metadata reads per adapter before and
  after.

The dominant remaining cost is the privacy-bounded experimental Codex
`thread/turns/list` review projection. Raising its four-worker cap or dropping
candidates would buy more speed by weakening an existing safety or behavior
contract, so this change does neither.

## Next performance round

**Decision enabled:** determine whether the discovery/enrichment changes still
provide an independent benefit on the post-PR-#26 codebase, and whether one
further safe reduction is available in the `thread/turns/list` path.

**Owner:** next Codex performance session. **Approval owner:** repository owner.
**Due:** next scheduled Gajendra performance round.

1. Re-check `origin/main` and record the exact base and branch SHAs. If upstream
   moved beyond `df47594`, reconcile in a fresh worktree rather than rebasing a
   dirty evidence tree in place.
2. Run the same seven-run synthetic discovery benchmark and aggregate-only live
   snapshot protocol on both clean current main and the rebased performance
   commit. Compare candidate counts, selected thread IDs in private test memory,
   and Ready/Running classifications; do not print or persist thread content.
3. Review the semantic diff between current main and `40b5d57`, especially the
   interaction with PR #25/#26 changes in `codex-app-server.ts`,
   `thread-sources.ts`, and their tests. Keep the existing change only if the
   remeasurement still demonstrates an independent benefit.
4. If the review projection remains dominant, add temporary aggregate timing
   around list, activity, and review phases and identify whether latency is
   local scheduling or provider response time. Do not raise the four-worker
   cap, reduce the 200-candidate ceiling, skip eligible candidates, persist
   review state, or inspect turn content.
5. Keep a change only when repeated median and p95 improve outside the observed
   run-to-run noise while thread selection, fail-closed behavior, privacy
   boundaries, and `npm run check` remain unchanged.

**Stop rule:** close the round with a no-change receipt if current main already
contains the benefit, the remaining delay is provider-bound, or no improvement
survives repeat measurement without weakening the contract. Merge, install,
and release remain separate owner-approved steps.
