# Compatibility

Visible product copy is **Gajendra** — **One clear focus across your AI tools.** The visible
promise is **One NOW. One short queue. One click back to the exact thread.**

The following are stable compatibility identifiers and must not be renamed with visible copy:

| Surface | Stable value |
| --- | --- |
| Package/plugin and tool namespace | `gajendra` |
| URL route | `gajendra://` |
| macOS bundle identifier | `dev.sid.gajendra` |
| Executable and bundle path | `Gajendra` / `Gajendra.app` |
| Default state path | `~/Library/Application Support/Gajendra/gajendra.v2.json` |
| Context values | `design`, `engineering`, `life` |
| Store behavior | revision/CAS/idempotency, bounded review receipts, optional explicit lifecycle/continuation IDs and NOW-selection enum, bounded recovery metadata |

## Data compatibility

Canonical IDs stay source-namespaced. Unknown IDs and sources fail closed; they are not persisted
as best-effort placeholders. The store accepts only its known version and required shape before
normalization. A corrupt or structurally invalid primary is quarantined; only a structurally valid
private last-known-good copy can restore it. Legacy Aadi/Priority Deck data is copied, never moved.

Setting `GAJENDRA_DATA_DIR` creates an isolated state scope. It does not discover or consume legacy
`~/.codex` data unless a migration was explicitly requested.

Version 0.4.0 retains store version 3 and the existing file path. Optional
`completedThreadIds`, `continuations`, and `nowSelection` fields add bounded IDs/relationships and
an enum; existing source/collapse preferences retain boolean values. Legacy files remain readable.
Finish can clear NOW even when other Focus rows remain. Older clients cannot represent that choice.
Before downgrading, preserve the private store and last-known-good copy: older v3 writers can drop
unknown lifecycle/review fields on their next write. Rollback is not a lossless lifecycle migration.

Snapshots add optional `product`, per-thread lifecycle/continuation metadata, `cachedAt`,
`activityRevision`, and `catalogRevision`. Old entrypoint calls with empty arguments still work.
`gajendra_open` uses the prepared backend view or neutral disk fallback; `refresh: true` forces
live collection. `--read-json` provides the same prepared read to native clients. `gajendra_sync` and
`--sync-json` return the store revision, optional opaque activity token and memory-catalog revision without discovery.
Lifecycle tools retain the existing CAS/idempotency envelope and use exact canonical IDs.

## Source compatibility

Built-in source IDs and the `configured-sources` namespace are reserved. Configured source IDs must
be unique and may not collide with those values. Configured catalogs/process outputs are bounded and
validated; arbitrary directory scans or arbitrary shell discovery are not compatible behavior.

Deep links are compatibility data only when a source-specific safe scheme allows them. Scheme
validation happens both on catalog parse and at open execution, so unsafe forms do not become
portable through an old catalog.

Configured catalog version 1 accepts the optional live-only `review` structure and explicit
`attention: "needs-input"`. Generic waiting statuses do not substitute for the latter. Omitting it remains
fully compatible. Invalid state/kind/timestamp/destination shapes fail the configured source closed;
they are not downgraded to idle work. Live review metadata never enters the priority store. An
explicit acknowledgement adds only bounded identity digests to an optional version-3 field and
creates no new priority level. Older v3 writers can read the file but will drop the unknown field on
their next write, causing handled Ready rows to reappear without changing priority state.

## Optional hook compatibility

The package's default `hooks/hooks.json` targets SessionStart, UserPromptSubmit, Stop, and SessionEnd
using `${PLUGIN_ROOT}`. Hook invalidation ignores host-injected `PLUGIN_DATA` so it reaches the native/MCP shared default directory; `GAJENDRA_DATA_DIR` remains the explicit isolation override. The wrapper uses the configured or installed-app Node runtime, then PATH
Node, and emits harmless JSON when unavailable. Hook trust is a host decision, never granted by
installation. Unsupported, disabled, untrusted, or failed hooks leave ordinary polling intact.
Local-only command hooks do not establish support in cloud-orchestrated sessions. See
[official packaging](https://developers.openai.com/plugins/build/plugins) and
[hook support/trust](https://learn.chatgpt.com/docs/hooks).

## Build versus binary compatibility

Source builds require macOS 13.5+, Xcode/Swift, and Node 20.19+ or 22.12+. A production-style bundle is expected
to carry Node v24.19.0 with a verified checksum and notices. Neither source compatibility, a local
ad-hoc signature, nor the exact-installed automated interaction receipt proves a clean-Mac,
Gatekeeper-accepted, Developer ID-signed, notarized, or distribution-ready binary. Those are
separate pending gates.
