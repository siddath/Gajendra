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
| Store behavior | revision/CAS/idempotency and bounded recovery metadata |

## Data compatibility

Canonical IDs stay source-namespaced. Unknown IDs and sources fail closed; they are not persisted
as best-effort placeholders. The store accepts only its known version and required shape before
normalization. A corrupt or structurally invalid primary is quarantined; only a structurally valid
private last-known-good copy can restore it. Legacy Aadi/Priority Deck data is copied, never moved.

Setting `GAJENDRA_DATA_DIR` creates an isolated state scope. It does not discover or consume legacy
`~/.codex` data unless a migration was explicitly requested.

## Source compatibility

Built-in source IDs and the `configured-sources` namespace are reserved. Configured source IDs must
be unique and may not collide with those values. Configured catalogs/process outputs are bounded and
validated; arbitrary directory scans or arbitrary shell discovery are not compatible behavior.

Deep links are compatibility data only when a source-specific safe scheme allows them. Scheme
validation happens both on catalog parse and at open execution, so unsafe forms do not become
portable through an old catalog.

Configured catalog version 1 accepts the optional live-only `review` structure. Omitting it remains
fully compatible. Invalid state/kind/timestamp/destination shapes fail the configured source closed;
they are not downgraded to idle work. Review metadata never changes the version-3 priority store,
and therefore creates no persisted migration or new priority level.

## Build versus binary compatibility

Source builds require macOS 13.5+, Xcode/Swift, and Node >=20. A production-style bundle is expected
to carry Node v24.19.0 with a verified checksum and notices. Neither source compatibility, a local
ad-hoc signature, nor the exact-installed automated interaction receipt proves a clean-Mac,
Gatekeeper-accepted, Developer ID-signed, notarized, or distribution-ready binary. Those are
separate pending gates.
