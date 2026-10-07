# Daily workflow trial — local 0.4.0 candidate

Owner: Sid. Decision enabled: whether the existing floating widget is useful throughout a day
with many active and finished chats. Local implementation and verification are due in this task;
adoption is a one-week trial through 2026-10-08, not a claim already proven by developer tests.

## Contract

- Populate the first opening from a disposable local metadata cache while live discovery runs.
- Reuse unchanged Codex completion checks across the short-lived native backend processes.
- Share Ready for Review, Needs input, Running, Continue, and History between native and embedded views.
- Keep age as secondary history grouping; never move pending review out of attention because it is old.
- Support explicit Finish/Reopen and exact continuation selection while preserving earlier chats.
- Never interpret idle, age, leaving a chat, or one completed response as the user's completed task.
- Preserve private priority state and validate behavior in the native interface.

The owner authorized a disposable cache on October 1 and explicit completion/continuation on
October 3. These narrow additions amend the prior metadata-persistence restriction as documented
in SECURITY.md. No automatic completion, title-based merging, provider archiving, or deletion is added.

## Behavior

Ready for Review remains visible regardless of response age. Needs input requires explicit source
evidence; generic waiting is insufficient. Running is provider-reported. Continue contains open
Focus/Important work and the selected NOW. History retains finished work, predecessor chats, and
other inactive chats; age is only secondary organization. Unprioritized chats remain searchable.

Finish work is a durable user choice, separate from Mark reviewed. It preserves priority metadata,
chat history, and any pending review. Finishing NOW clears it without promoting another chat.
Reopen restores Continue eligibility; select NOW explicitly or use the exact inverse action.
Choosing an existing successor by exact ID transfers priority/order/context/NOW atomically.
Predecessors keep their own destinations. Similar titles never establish a relationship.

The launch cache contains the display catalog but omits commands and review signals. The cached
view has a visible timestamp, neutral activity status, and current saved priorities. Codex links
can open immediately. CLI resume routes wait for fresh metadata instead of caching executable
commands. A wholly failed source refresh retains a clearly stale cached view with a connection
warning; a partial failure retains only the affected source's saved rows alongside healthy live
rows. A source preference change invalidates the projection.

Both surfaces show the neutral cache first and then request a live view. While visible they check
local store/activity revisions about every five seconds and request source refreshes about every
thirty seconds. These are polling intervals, not an instant-update guarantee; provider latency and
existing deadlines still apply. Each refresh lists provider metadata and inspects runtime activity. Unchanged Codex completion
metadata can be reused for five minutes, controlled by `GAJENDRA_REVIEW_CACHE_MAX_AGE_MS` (0 means
recheck every time; maximum one day). This fallback expiry covers providers whose listing timestamp
may lag a turn update. Active, changed, expired, or missing-timestamp entries are checked afresh;
malformed completion batches remain fail-closed. The cache never marks a task done. Explicit review
acknowledgement bypasses completion reuse.

Optional trusted plugin hooks invalidate completion reuse on SessionStart, UserPromptSubmit, Stop,
and SessionEnd. The hook stores one opaque token and never handles a response, finishes work, or
steers Codex. Its session metadata does not prove an exact local adapter mapping, so it invalidates
the bounded completion cache globally while preserving launch metadata. Polling remains available
when hooks are untrusted, unsupported, disabled, or fail. Installation never grants hook trust.

## Trial acceptance and stop criteria

Technical acceptance: tests show zero completion RPCs for an unchanged warm catalog, only changed
threads checked, cached launch rendering while the live read is pending, and no restored removed
priorities. Compare live cold/warm/cache-only timings and inspect the installed card.

Adoption acceptance belongs to Sid: across actual daily use, newer chats should be reachable without
manually placing each one in Focus, and old pending review should remain reachable while completed work moves out of Continue.
Keep the previous app bundle as rollback. Disable caching with `GAJENDRA_METADATA_CACHE=off` or
restore the previous app if private state changes unexpectedly, stale data appears as live, or
the trial does not reduce the daily friction. The cache directory is disposable; private priorities
are in a separate file and must not be removed as cache cleanup. Preserve that file and its backup
before downgrade: an older v3 writer may drop new lifecycle/continuation/cleared-NOW fields.

Developer checks are recorded below when run. They do not prove user adoption, task completion,
Codex first-party status, or public release.

## Current candidate acceptance

October 5 backend follow-up separates prepared reads/local writes from provider collection. A shared
private session backend retains the normalized live catalog for 30 seconds and exits after five idle
minutes. Visible clients can render/rebase saved state while the backend refreshes; `catalogRevision`
announces the completed refresh. Routine Codex listing uses the supported metadata-only API with
five-minute full reconciliation and compatibility fallback. The fresh review path, exact receipts,
CAS/idempotency and authoritative store remain intact. No executable command enters the read cache;
CLI resume requests fresh metadata. See the
[performance worksheet](../worksheets/2026-10-05-backend-cache-performance.md) for measured results.

This remains a reversible local trial. `GAJENDRA_SHARED_BACKEND=off` restores separate service
processes; `GAJENDRA_CODEX_FAST_LIST=off` restores full listing. `GAJENDRA_METADATA_CACHE=off`
also disables the memory catalog. Reopen clients after changing environment overrides. Stop the
trial on stale-as-live evidence, lost state or inconsistent client revisions; preserve the durable
store on rollback. No permanent system service or new database was installed.

Source regressions cover explicit lifecycle persistence, shared CAS/replay, continuation transfer and
rejection, old review retention, neutral cached state, revision invalidation, and hook privacy/races.
Native self-tests, 28 browser journeys, cross-process sync, real native UI and installed 0.4.0
bundle/plugin parity passed; see STATUS.md and the October 3 worksheet. The October 5 host reload
activated the new tools and rendered panel, and a live refresh returned current Codex metadata.
Embedded interaction inspection then timed out. On October 5 the owner confirmed the requested
Open thread and return/NOW-preservation journey, closing local host navigation acceptance. Final
artifact and unchanged-private-state checks passed. Hook trust remains optional and ungranted;
this local implementation acceptance does not claim the one-week adoption trial is complete.

## Historical October 1 cache receipt

- `npm run check`: 121 tests passed, production bundles built, plugin validation passed.
- Native self-test: passed, including cached-before-live rendering, local-day grouping, and an
  unpinned continuation appearing automatically. Native app and updated UI harness compile.
- Native source/bundle validation and local bundle readiness passed (ad-hoc signing only).
- Installed card was inspected through native UI: saved priorities appeared during refresh, then
  live Running and Today replaced cached status. Earlier activity expanded/collapsed, and search
  found the latest continuation alongside its predecessors without changing priorities.
- One actual cache-only backend read took 265 ms including authoritative state loading. This is
  not an end-to-end popup timing or a live provider-refresh speed claim. Synthetic regression
  evidence proves no turn-summary RPCs for unchanged warm entries and only changed entries read.
- Live Codex `thread/list` intermittently exceeded its 15-second RPC deadline; a healthy read was
  subsequently confirmed in the installed card. The cache preserves usability through this
  provider failure but does not claim to fix Codex's underlying listing latency.
- Installed bundle matched the built bundle, signature verification passed, and private priority
  state remained unchanged at revision 218. The previous app is retained as a local rollback.

Private receipts are under ignored `.artifacts/widget-daily-20261001/`. No public release,
full gauntlet rerun, automatic task-completion inference, or continuation priority transfer was
claimed by that October 1 receipt. The process-level UI harness was updated and compiled; its full
automated journey had not been rerun for that daily-card change. Native evidence above was direct
inspection.
