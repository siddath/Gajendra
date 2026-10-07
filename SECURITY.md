# Security policy

Gajendra is local-first. This document describes the local 0.4.0 **source candidate contract**, not an
installed-app or binary-distribution claim.

## Data boundary

The private state contains canonical thread IDs, NOW/Focus/Important order, the bounded
`design`/`engineering`/`life` context enum, preferences, monotonic revision, and bounded SHA-256
idempotency and review-acknowledgement receipts. Optional v3 fields retain explicit completed chat
IDs, exact predecessor/successor IDs, and `nowSelection` (`automatic` or `cleared`). Completion is a
user mutation, not a stored provider inference; source/collapse preferences remain booleans. No
free-text work description is introduced. Review receipts hash the canonical thread ID,
timestamp, kind, and destination; they minimize stored data but are not claimed to be secret against
dictionary testing. The state does not contain titles, prompts, transcript bodies, previews, source
files, raw review signals/timestamps/destinations, tokens, credentials, free-text labels, or arbitrary provider responses.

The default state directory and recovery material are owner-private (`0700` directory, `0600`
files). Writes use a private cross-process lock and atomic replacement. Store validation precedes
normalization: corrupt, oversized, unknown-version, or structurally invalid primary state is
quarantined. Recovery may resume only from a structurally valid private primary or last-known-good
copy; otherwise it fails closed. `GAJENDRA_DATA_DIR` isolates a test/custom store from legacy
`~/.codex` candidates unless migration is explicitly requested.

## Sources and execution

### Disposable widget metadata cache

At the owner's explicit request on 2026-10-01, a separate `metadata-cache/` directory may retain
the rendered thread catalog (IDs, display titles, project labels, update time, status, validated
links/schemes, and bounded source descriptors). It never contains priorities, commands, reviews,
source diagnostics, raw provider responses, prompts, or transcript bodies. Display titles and
project labels can themselves be private; these files stay local, owner-private, and outside Git.
The native and embedded launch projection is usable for at most one day and is visibly labeled saved/stale.
Its priorities, completion/continuity, and acknowledgement state are always rebuilt from the current authoritative store.
Cached Running, Needs input, and review evidence are suppressed. Source-preference or environment-scope mismatch rejects it.

A second cache contains up to 200 hashed Codex thread IDs and metadata fingerprints, check times,
and validated completion timestamps (or null for a validated non-completed result). It contains
no titles, links, turn items, or raw responses. Changed listing metadata invalidates each entry;
unchanged entries are rechecked after five minutes by default. Explicit review acknowledgement
always requests fresh completion metadata. These timestamps mean provider response completion,
never user task completion. Active threads cannot inherit an old completion signal.

Both disposable files use bounded reads (4 MiB), strict projections, private modes, and atomic
replacement; malformed or unavailable cache data becomes a miss, not a state reset.
`GAJENDRA_METADATA_CACHE=off` disables both caches. This is a local adoption trial; see
[Daily widget](docs/DAILY-WIDGET.md) for acceptance and rollback criteria.

### Optional lifecycle hooks

`SessionStart`, `UserPromptSubmit`, `Stop`, and `SessionEnd` commands accept at most 64 KiB of stdin
within one second. They validate only event name and bounded opaque `session_id`/optional `turn_id`;
other fields are ignored. Prompts, `last_assistant_message`, `transcript_path`, and raw payloads are
never logged, retained, or used as paths or commands. Even the validated IDs are discarded.

Hook ingestion uses the shared app data directory, ignoring hook-only host `PLUGIN_DATA`; an explicit `GAJENDRA_DATA_DIR` still isolates it. Hooks never migrate or alter authoritative state.

One atomically replaced private `metadata-cache/lifecycle.v1.json` contains only a version and
random `activityRevision` token. It never grows into an event log. Because hook IDs do not establish
an independently verified local adapter mapping, a changed token invalidates the bounded 200-entry
Codex completion cache globally; the rendered cache and authoritative store are preserved. A token
captured before a provider read prevents a racing hook from making its later cache write reusable.
Hook storage/runtime failure emits harmless `{}` or leaves polling in control. Hooks do not scan
providers, invoke payload-selected commands, steer the model, or infer completion from Stop/SessionEnd.
`GAJENDRA_METADATA_CACHE=off` also disables hook ingestion. The host must explicitly trust each
current hook definition; installation is not trust. See [official hook rules](https://learn.chatgpt.com/docs/hooks).

Preserve the private store and backup before rolling back: older v3 writers can drop unknown
completion, continuation, cleared-NOW, and review-receipt fields on their next write. An older UI
cannot represent cleared NOW or explicit completion reliably.

- Gajendra does not mutate provider databases, signed applications, rollouts, prompts, or
  transcripts. Claude Code discovery is opt-in.
- Configured sources are explicit, bounded catalogs. IDs must be unique and cannot use built-in or
  reserved namespaces. Configured process capture has byte, deadline, process-group termination,
  and close-settlement bounds.
- Source URLs use per-source safe schemes. `javascript:`, `data:`, `file:`, malformed, encoded,
  whitespace-padded, and unallowlisted destinations are rejected at input and execution boundaries.
- Review readiness is an optional validated live signal with a structured Task or URL destination.
  Configured sources may supply it explicitly. The current local Codex adapter may derive it only
  from a bounded newest-turn response requested with `itemsView: notLoaded`, and requires zero
  returned message items plus an unambiguous successful completion. It does not authorize remote
  access, credential storage, or provider-content capture; only the bounded completion cache above
  may persist its validated timestamp. No provider is inferred
  ready from idle, age, or resumability.
- Codex app-server activity enrichment is disabled by
  `GAJENDRA_CODEX_ACTIVITY_ENRICHMENT=off`. When enabled on macOS it is the A4 bounded
  metadata-only tail inspection described in
  [Thread sources](docs/THREAD_SOURCES.md#codex-activity-enrichment), not transcript inspection.

## Host and native boundaries

The session backend uses only an owner-private Unix socket under a short `/tmp/gajendra-UID-scope/`
directory (0700; socket 0600). Build bytes, data directory and provider environment scope separate
owners. Requests are restricted to existing snapshot/sync/mutation operations, capped at 64 KiB;
responses retain the native 4 MiB cap and bounded deadlines. Startup is elected under a private
lock; stale startup recovery requires a dead owner and a grace interval. Requests are never
automatically replayed after dispatch or silently sent to another writer following uncertain failure.
There is no TCP port, login item or launch-agent installation. The process exits after five idle
minutes; `GAJENDRA_SHARED_BACKEND=off` disables this reversible session-service trial.

Its 30-second memory catalog contains normalized metadata and validated live review signals, not
raw provider responses. Commands are stripped before retention. Disk caches still use the narrower
allow-list above and never persist review destinations/signals or commands. Configuration-file
identity/version fingerprints now invalidate disk launch projections too; an older projection
without that fingerprint is a miss. Authoritative priorities and recovery files are unchanged.

The MCP app runs in its declared host sandbox and calls only declared Gajendra tools/links. The
standard inline MCP app remains supported independently of any experimental global host entry.
Native source code is expected to use the registered `gajendra://` route and temporary,
owner-private, shell-quoted CLI resume artifacts; it never evaluates catalog-provided shell text.

The source/build contract targets macOS 13.5 and a bundled, pinned Node v24.19.0 runtime. That is
not a statement about an installed app, Developer ID signing, notarization, Gatekeeper acceptance,
or public binary availability. Those require separate evidence.

## Reporting

Use synthetic identifiers and omit prompts, transcripts, tokens, and private paths from reports.
Report undisclosed vulnerabilities through
[GitHub Security Advisories](https://github.com/siddath/Gajendra/security/advisories/new), not a
public issue. See [SUPPORT.md](SUPPORT.md) for non-security help.
