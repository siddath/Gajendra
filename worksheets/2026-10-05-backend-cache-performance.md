# Shared backend and refresh performance

Owner: Sid. Requested implementation and performance verification on October 5; no external deadline.
Acceptance: fast prepared reads and local changes; faster provider refresh where measured; shared
native/MCP authority; unchanged durable review/CAS/retry/Undo semantics; isolated tests and real
interface inspection; preserve private priorities and unrelated dirty work. Stop once the measured
bottlenecks are addressed and the final local installation is verified. No publication or provider
conversation mutation is authorized or claimed.

## Retained changes

- Native and MCP requests use one private, scoped local session backend. It retains normalized
  metadata in memory, shares the provider connection and coalesces overlapping refreshes. It exits
  after five idle minutes and does not install a launch agent or network listener.
- Prepared reads join the latest authoritative user state to the current catalog. They do not
  rescan providers. A neutral restart cache can render while the backend refreshes; catalog revisions
  tell clients when new data is ready. Local state changes no longer force provider discovery.
- Local priority/order/context/collapse/workflow writes retain exact-ID validation, CAS, atomic
  persistence and replay keys. Known neutral metadata also permits local changes when sources are
  offline. Review acknowledgement still forces new evidence and cannot join a pre-click collection.
- Account/source preferences, source configuration identity/version, activity epochs and expiry
  invalidate catalog reuse. An old collection cannot publish into a newer epoch. Source config
  fingerprints also protect disk cache load/save against configuration replacement races.
- Commands are removed from the retained memory catalog. Safe CLI resume obtains fresh source
  metadata before execution. Prompts, transcript bodies and raw provider responses are never cached.
- Routine Codex listing requests `useStateDbOnly: true`, a supported parameter verified against
  the installed CLI's generated `ThreadListParams` schema. This avoids repeated rollout scans and
  repair work. Full listing remains available via `GAJENDRA_CODEX_FAST_LIST=off` and periodic
  five-minute reconciliation; invalid-params on older providers falls back to the original API.

## Bottleneck and parity proof

Three pre-change Codex profiles took 16,801 / 15,157 / 15,714 ms. Listing consumed
15,819 / 14,718 / 15,274 ms respectively. Initial provider initialization was 186 ms, and warm
completion reuse made zero newest-turn requests. The slow component was repeated `thread/list`
scan/repair, not JSON state loading or a lack of review caching.

A same-session normal/fast listing comparison returned identical sets of **249 indexed threads**,
with zero differences in name, cwd, path, creation/update/recency times or status. Normal listing
took **17,970 ms**, fast listing **32 ms**. An earlier normal parity attempt timed out at the
existing 15-second per-RPC limit; no timeout was enlarged or coverage reduced to make it pass.
The effective index can still lag unindexed provider metadata; periodic reconciliation is retained
for that reason. The bounded runtime-activity pass still recovers eligible omitted active roots.

## Repeat before/after measurements

Protocol: bundled Node v24.19.0; same Mac and enabled sources; old pre-change server bundle versus
the new backend; sequential CLI requests; separate owner-private copies of the same real priority
store and metadata cache. Writes were **synthetic collapse toggles in those isolated copies**.
No real task was reviewed, completed, reprioritized or modified. Times include process startup,
backend work, serialization and shutdown of the requesting CLI. They are not UI-render latency.

| Flow | Before, ms (3 samples) | After, ms (3 samples) | Median change |
| --- | --- | --- | --- |
| Full provider refresh | 18,648.7 / 15,050.1 / 14,882.4 | 1,028.1 / 796.9 / 649.4 | 15,050.1 → 796.9 ms; 94.7% lower |
| Cached catalog | 125.5 / 106.6 / 109.9 | 110.4 / 106.0 / 109.2 | Essentially unchanged; process startup remains included |
| Local write | 16,029.3 / 15,917.7 / 14,738.2 | 108.4 / 112.8 / 117.9 | 15,917.7 → 112.8 ms; 99.3% lower |
| Prepared read | New endpoint | 116.1 / 103.6 / 127.2 | 116.1 ms median |

Every measured post-change full refresh succeeded without a source error. The live discovered
catalog varied between 449 and 450 during the run; no fixed dataset/count claim is made. The
separate same-session parity comparison above checks coverage. Three samples establish a local
repeatable improvement, not a production percentile or universal latency guarantee.

Ignored `.artifacts/cache-performance-20261005/` contains the reproducible benchmark/profile scripts,
aggregate JSON timings, baseline bundle, parity counts and check logs. Private titles/IDs/content
are not printed in the timing receipts. The baseline bundle is retained only as local evidence.

## Verification and limits

Regression coverage includes coalesced refresh, source/config/activity invalidation and expiry,
old-result rejection, post-click fresh review evidence, local write/replay/conflict, external
revision rebasing, offline writes, cached-before-live rendering, writing during refresh, command
omission, older-provider compatibility, private socket permissions, simultaneous CLI readers,
native-CLI/MCP synchronization, isolated scopes and backend restart recovery.

The initial aggregate check hit the known sandbox loopback restriction. Authorized execution
passed. A new test initially assumed asynchronous filesystem key checks would finish in call order;
it was corrected to wait for the first provider read to actually start before testing post-click
freshness. This fixes the fixture ordering instead of weakening the product freshness check.

No new database or remote cache was added: measurements identify provider listing as the major
bottleneck. No source/page/row/byte bounds or freshness checks were removed. Higher concurrency,
direct provider-database reads, transcript indexing and unbounded background polling were rejected.
Prepared CLI reads retain roughly 0.1 seconds of process/IPC overhead; this work does not claim to
eliminate all possible overhead. Reconciliation can still take the original slow listing time,
and provider availability remains external to Gajendra.

## Trial and rollback

The shared backend is a reversible session-service trial: set `GAJENDRA_SHARED_BACKEND=off` for
the old process model, `GAJENDRA_CODEX_FAST_LIST=off` for the old listing behavior, or
`GAJENDRA_METADATA_CACHE=off` to disable metadata reuse. Restart clients after environment changes.
The old store format, paths and cross-process locks remain. Keep the private store and recovery
copy during rollback; never restore old user state merely to downgrade application binaries.

Retain the trial only if ordinary use shows fewer blocked refreshes and consistent clients.
Revert on stale-as-live activity, lost state or inconsistent committed revisions. No systemwide
service configuration was made permanent. Physical accessibility and distribution remain outside
this performance pass.

## Final installed verification

Final `VITEST_MAX_WORKERS=1 npm run check` passed **167 tests across 15 files**, TypeScript,
build and package validation. Native self-tests, production build, strict signature validation and
bundle readiness checks passed. This is a locally signed installation; distribution readiness is
false and no public release is claimed. `git diff --check` passed.

The installed backend was measured again in an isolated copy of private state: first full refresh
**2,863.5 ms**, subsequent full refreshes **670.7 / 645.8 ms**; prepared reads
**90.2 / 90.7 / 94.4 ms**; isolated collapse writes **100.6 / 116.7 / 114.3 ms**. Every
refresh had no source errors and every write was applied. Cold startup and warm timings are
reported separately; the controlled three-sample before/after comparison above is the basis of
the percentage claims.

CUA inspection of the final installed native app against a synthetic source verified a Focus to
Important change (counts 2/1 to 1/2), fresh exact-response review acknowledgement, and Undo returning
that response to Ready for Review. An expired catalog can briefly return a visibly marked neutral
saved view after a local write; explicit refresh restored current activity. This preserves the
no-stale-as-live rule. The screenshot receipt is
`.artifacts/cache-performance-20261005/native-review-undo.png`. The synthetic app was quit and the
normal app reopened: its widget rendered 449 threads, real NOW/priorities, Ready and Running.
No real review or priority was changed. The private state remained byte-identical at revision 220.
The pre-existing notice for one saved priority outside source results remains; it was not removed.

All **nine native files and eleven plugin artifacts** matched the final build at installation.
Installed hashes:

- native: `1d7b5ddd544e481d6a684715bc8f3d3dc422a7c6678eadeb47736965d4433df5`
- backend: `bf31425ab98eb2c3af32044295a50de6cfa5201b7601fdfa29f69b0543118caf`
- plugin UI: `0200836d967340c1af0a4ac0db266af6ee92401e14945e52578264cf896c9c2c`

Rollback binaries/plugin and a private state recovery copy are retained privately by the operator.
Existing embedded panels
must be reopened to pick up the newly installed UI; the installed backend and CLI/MCP sharing are
verified, but a previously running host may retain its old plugin process until reload.

This stays within the existing one-week daily-workflow trial. Kill criteria remain stale-as-live
activity, lost state or inconsistent committed revisions; do not make a system service permanent
as part of this trial.
