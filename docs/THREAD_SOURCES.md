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

Source preference generation is part of a collection result. The service verifies that generation
before returning or mutating a snapshot; under sustained change it uses a bounded retry/deadline
and returns a typed safe busy/error response instead of a stale success.

## Running

Running is an explicit provider status. It is shown across NOW, Focus, Important, and unprioritized
work without creating a new persisted tier. `resumable` does not mean Running. The registry retains
explicit active rows when applying background/result caps.

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
is not Running. Up to the existing 200 newest background candidates are checked by a four-worker,
five-second bounded pass. An unsupported method, deadline, malformed response, returned item, or
invalid/future timestamp suppresses the whole built-in review batch. A structurally valid empty,
active, interrupted, or failed newest turn contributes no Ready signal without poisoning other
valid candidates.

Claude Code, Cursor, and Grok do not currently emit built-in review readiness. Gajendra does not
translate `idle`, `resumable`, recency, waiting flags, or inactivity into a review signal. Remote
provider APIs, tokens, and network access remain outside this local implementation. Opening a
thread does not clear review readiness; only newer provider evidence changes it. Review signals,
provider statuses, destinations, results, diffs, and PR content are never written to
`gajendra.v2.json`.

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
