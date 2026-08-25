# Thread sources

Gajendra uses explicit, bounded, local adapters. It does not scrape provider databases or mutate
provider state. The source registry returns normalized metadata and never turns content into
priority state.

## Built-ins and configured catalogs

Codex, Claude Code, Cursor, and Grok Build are built-in adapters. Claude Code scanning remains
opt-in. Configured sources use an explicit JSON catalog or bounded process capture; they are not an
arbitrary filesystem or shell-discovery mechanism.

Configured IDs must be unique and cannot be `codex`, `claude`, `cursor`, `grok`, or
`configured-sources`. Catalogs, summaries, process output, row counts, and source selection all
have hard bounds. Process collection stops retaining stdout after its cap/timeout and uses bounded
TERM-to-KILL/close settlement for an uncooperative child. A provider failure leaves the safe base
status instead of exposing partial/private data.

Source adapters run with a four-worker floor and an eight-worker hard cap, so a lower
`GAJENDRA_SOURCE_COLLECTION_CONCURRENCY` value cannot serialize the default-enabled Cursor pass
after Codex and invalidate the derived generation envelope.

Source preference generation is part of a collection result. The service verifies that generation
before returning or mutating a snapshot; under sustained change it uses a bounded retry/deadline
and returns a typed safe busy/error response instead of a stale success.

The outer source-generation budget defaults to a derived 70-second provider/store envelope, not the
store's 30-second stale-lock recovery window or its 5-second lock-acquisition timeout. Accepted
Codex bounds cover experimental initialize, bounded fallback teardown, baseline initialize, listing,
and the hard-capped runtime enrichment; the initial store read is included before provider work.
This remains an overall safe-fallback budget, not a hard end-to-end snapshot ceiling: lock
acquisition for a later store operation is capped at five seconds, while the filesystem operation
itself remains under the native process watchdog. Provider-specific row, byte, worker, and deadline
bounds continue to apply inside the generation budget. Explicit `generationDeadlineMs` callers may
choose a tighter bound.

The macOS client gives the local service an 85-second subprocess watchdog over the 70-second
source-generation budget and later store/process work. At the threshold it initiates TERM/KILL;
process-group and pipe-drain cleanup follows. Treat 85 seconds as a termination threshold, not a
strict response-by SLO.

## Running

Running is an explicit provider status. It is shown across NOW, Focus, Important, and unprioritized
work without creating a new persisted tier. `resumable` does not mean Running. The registry retains
explicit active rows when applying background/result caps. When a provider later supplies valid
completion evidence, the next refresh removes that thread from Running and presents it as Ready for
Review; this is a provider-status transition, not an unread-state transition.

## Ready for Review

Ready for Review is also derived live metadata, not a priority tier or unread marker. A thread
appears only when an enabled adapter supplies the bounded `review.state = "ready"` structure, a
supported kind, a valid timestamp, a single-line provider status, and a structured Task or Review
destination. Running takes precedence if a stale source reports both states. The projection is
ordered by the review timestamp and retained outside the ordinary 200-row background cap.

An explicitly configured catalog remains a supported path; see
[the synthetic catalog](../examples/review-catalog.json). The configured source's declared safe
schemes are checked when the catalog is read and again when the destination opens. A URL destination
is labeled **Review**; a thread fallback is labeled **Task**, while the provider badge continues to
open the owning task.

The current local Codex app-server is the only built-in review path. Gajendra opts into its guarded
experimental API and asks `thread/turns/list` for at most the newest turn with
`itemsView: "notLoaded"`. A candidate is ready only when the response is structurally exact, returns
zero items, reports terminal `completed` with no error and a valid completion time, and the thread
is not Running. An otherwise exact safe response with `completedAt: null` is candidate-local omitted
evidence: it contributes no Ready signal for that one candidate but does not expose content or
discard another independently valid candidate. Up to the existing 200 newest background candidates
are checked by a four-worker, five-second bounded pass. An unsupported method, deadline, malformed
or private-content response, returned item, error on a purported completed turn, or invalid/future
timestamp suppresses the whole built-in review batch fail-closed. A structurally valid empty,
active, failed, or interrupted newest turn contributes no Ready signal without exposing its error
detail or being treated as a private/protocol-error batch failure.

Claude Code, Cursor, and Grok do not currently emit built-in review readiness. Gajendra does not
translate `idle`, `resumable`, recency, waiting flags, or inactivity into a review signal. Remote
provider APIs, tokens, and network access remain outside this local implementation. Opening a
thread does not clear review readiness. The green **Mark reviewed** action stores a bounded digest
for the exact current response and removes only that Ready projection; Undo restores it, while newer
timestamps or corrected kinds/destinations reappear. Review signals, raw timestamps, provider
statuses, destinations, results, diffs, and PR content are never written to `gajendra.v2.json`.
At 1,024 distinct acknowledged threads, Gajendra leaves additional rows visible and reports capacity
instead of evicting an older receipt.

The acknowledgement identity is as precise as the guarded provider metadata: thread, Unix-second
completion timestamp, kind, and destination. If two distinct completions for one thread occur in the
same second with the same kind and destination, the current Codex response does not expose an
allow-listed opaque generation ID with which Gajendra can distinguish them. That collision remains a
documented provider-boundary limitation; a changed timestamp, kind, or destination creates a new
review generation.

## Codex activity enrichment

The app-server may report a desktop-owned thread as not loaded. On macOS only, Gajendra can perform
optional, best-effort, metadata-only enrichment:

1. Find a held writer lock beneath `~/.codex/thread-writer-locks`.
2. Realpath-confine its rollout beneath `~/.codex/sessions`, reject symlink escape, and open the
   same handle without following links.
3. Read no more than the final 256 KiB from that opened handle.
4. Examine only allow-listed lifecycle markers after the last `task_complete` marker.

Raw rollout content, messages, response items, and coordination payloads are not returned or
persisted. Set `GAJENDRA_CODEX_ACTIVITY_ENRICHMENT=off` to disable the feature. If any condition
cannot be safely established, Gajendra preserves the app-server status.

App-server page count, total rows, activity-enrichment workers, each operation, and the overall
enrichment pass have source-defined bounds. A slow/unavailable provider preserves base status rather
than blocking the entire snapshot.

Codex app-server JSON-RPC stdout is bounded at a **512 KiB default** per response line. That default
was selected after a measured `thread/list limit=100` response of 383,665 bytes; configuration may
reduce or raise it only to the fixed **1 MiB hard maximum**. An oversized or unterminated line fails
generically, triggers bounded child cleanup, and never returns or persists response content.

## Safe destinations

Every source has an allow-listed scheme set. Gajendra rejects unknown, malformed, encoded,
whitespace-padded, `javascript:`, `data:`, and `file:` destinations at catalog parse and again when
the host/native client opens a link. A source catalog cannot bypass this execution check.

These are source contracts for the current local candidate. Final installed-provider, clean-account,
and clean-Mac proof remains governed by [Status](../STATUS.md) and [Gauntlet](GAUNTLET.md).
