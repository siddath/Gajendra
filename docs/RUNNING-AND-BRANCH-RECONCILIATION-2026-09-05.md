# Running and branch reconciliation — 2026-09-05

## Contract

Owner: Sid. Complete the reported Running-count investigation and reconcile the old feature and
performance work in this session. Preserve saved priorities/review receipts, provider privacy,
existing worker/deadline/row bounds, and recoverable unfinished material. Merge the fix only after
required checks pass. Stop cleanup at genuinely active work; do not delete unrelated projects or
new dependency proposals merely because their branches exist.

## Verified Running gap

The live Codex task API reported an active user-owned task that the installed Codex app-server's
ordinary `thread/list` omitted. A held writer lock existed; `thread/read` with `includeTurns: false`
returned its metadata, with no turns, and its bounded lifecycle tail contained activity markers. A later lifecycle check established
that `turn_aborted` ended that turn; the existing parser incorrectly ignored that terminal marker. It was a
non-ephemeral interactive root, not an internal subagent. Its exact identity was checked privately;
no task titles, IDs, paths, prompts, or provider responses are published here.

Gajendra previously enriched only rows already returned by `thread/list`, so this valid active task
could not reach Running. A fresh snapshot also corrected the initial displayed count as other tasks
started/finished; those changing totals alone were not used as proof. Provider filtering probes did
not establish why its list index omitted the task. No provider database or configuration was edited.

## Fix and bounds

After enriching listed tasks, recover missing held-lock IDs through metadata-only `thread/read`.
Require an exact requested ID, an interactive source, non-ephemeral root, no explicit direct-input
prohibition, empty turns, a confined rollout path, and the existing allow-listed active lifecycle
markers. A held lock alone is insufficient. Copy only established listing metadata into the live
result; never retain hydrated turns or additional provider fields.

Recovery shares the existing activity deadline and worker cap, inspects at most 200 missing IDs,
and keeps the combined list below 2,000 rows. Its failure discards optional recovery while preserving
the completed ordinary runtime pass. Existing listed-task deadline fallback and the kill switch
remain unchanged. Recovered rows are active only: they do not enter the Ready-candidate window or
alter review acknowledgement semantics. If the provider continues omitting a task after it stops,
this fallback does not invent history or Ready evidence for it.

The initial live recovery probe found the omitted task, but its Running classification was invalid
because the parser ignored an intervening `turn_aborted`. That probe is not claimed as active-task
proof. The fix now treats `turn_aborted` as terminal and recognizes a subsequent explicit
`task_started`; synthetic tests prove omitted active-task recovery and abort/restart transitions. Synthetic regressions cover empty/all-active listings, metadata-only
requests, exact identity, internal/ephemeral/child/direct-input exclusion, content rejection,
completed tails, worker/deadline/row limits, and preserving known Running evidence when optional
recovery stalls. Path containment uses the existing tested no-follow bounded reader.

This is a correctness repair, not a new end-to-end speedup claim. The discovery improvements and
provider-bound refresh measurements in the [performance audit](PERFORMANCE-AUDIT-2026-09-05.md)
remain the accepted performance outcome; concurrent Codex runtime/review work is still rejected.

## Retired branches and worktree

| Retired branch | Previous head | Reconciliation evidence |
| --- | --- | --- |
| `codex/fullscreen-and-ai-focus` | `57b6c36` | Exact tree equals merged PR #31 (`72742c6`). |
| `codex/native-priority-deck` | `68b469a` | Exact tree equals initial public release `8f9360c`, already in main history. |
| `codex/gajendra-performance` | `40b5d57` | Measured discovery/benchmark work retained in PR #31; unsafe concurrent review proposal rejected with reasons. Dirty historical notes preserved in main. |
| `codex/gajendra-performance-pre-rebase` | `266f7a5` | Same Codex proposal patch identity as `40b5d57`; superseded by the same reconciliation. |

The old `gajendra-performance` worktree was removed without force after its sole tracked edit was
verified in both main and backup. Before cleanup, a complete Git bundle and a complete worktree
archive were verified, including all 5,209 files and ignored dependencies. Recovery material remains
local and ignored under `.artifacts/reconciliation-2026-09-05/`: `retired-branches.bundle`,
`performance-worktree-complete.tar.gz`, the original notes/patch, and a manifest. Archive files are
mode 0600; they are not committed or uploaded. The initial cleanup proposal was rejected by approval
review; the subsequent non-force cleanup passed after complete preservation and exact tree/patch
reconciliation evidence were supplied.

Remote feature refs already deleted after merge were pruned. At cleanup completion, only the current fix branch and main
remained locally; the fix branch is eligible for removal after its merged tree is verified. Open dependency PRs #23 (major development-toolchain updates) and #29 (Zod update)
are active proposals, not completed/stale feature branches; they are retained.

## Validation record

The first sandboxed source run hit an OS loopback-bind denial. The permitted source check passed
114 tests. An initial gauntlet stopped on the unchanged native launcher move-mode precondition;
that failed run is not passing evidence. Review then tightened optional-recovery timeout isolation.
The initial implementation `e46e40e` passed 114 source tests, all 21 local gauntlet gates, and both
hosted jobs. Live parity then exposed the ignored interruption marker, so those receipts do not
prove the final correction. [PR #32](https://github.com/siddath/Gajendra/pull/32) remains gated on
renewed source, gauntlet, hosted, and installed checks recorded below.


### Final correction receipts

- Final `npm run check`: 115/115 source tests, typecheck, build, script and plugin validation passed.
- Native full journey: 32/81/82 ms prewarmed/cold/warm; dedicated widget: 56/86/89 ms. Both passed
  under the existing 200 ms budget. Full-screen launcher/reopen passed; no UI assertion was weakened.
- [Private-identity-free parity receipt](../evidence/performance/2026-09-05-running-parity.json):
  the final source active IDs matched the host, which was stable before and after the snapshot.
- The installed final app/server/runtime match the tested build; the card opens in the real interface.
  Saved priority/review state is byte-identical to the pre-install backup. The verified original app
  rollback is preserved; the known superseded interim generated bundle was removed.
- Final [gauntlet](../evidence/gauntlet/report.json): all 21 gates passed, including five repeated
  115-test source runs, 17 primary browser journeys, 85 repeated browser journeys, accessibility,
  native/live/build checks, and zero production dependency vulnerabilities.
- Hosted checks for the final correction must pass before merge; final PR and merged-main results
  are attached to PR #32. Older green checks are not substituted for this final revision.
- Final local plugin installation verified all nine deployed artifacts; its server, the installed
  app server, and the tested source build match by SHA-256.
