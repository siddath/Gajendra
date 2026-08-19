# Security policy

Gajendra is local-first. This document describes the current **source contract** for the dirty,
local candidate, not installed-app or distribution proof.

## Data boundary

The private state contains canonical thread IDs, NOW/Focus/Important order, the bounded
`design`/`engineering`/`life` context enum, preferences, monotonic revision, and bounded SHA-256
idempotency receipts. It does not contain titles, prompts, transcript bodies, previews, source
files, review signals or destinations, tokens, credentials, free-text labels, or arbitrary provider responses.

The default state directory and recovery material are owner-private (`0700` directory, `0600`
files). Writes use a private cross-process lock and atomic replacement. Store validation precedes
normalization: corrupt, oversized, unknown-version, or structurally invalid primary state is
quarantined. Recovery may resume only from a structurally valid private primary or last-known-good
copy; otherwise it fails closed. `GAJENDRA_DATA_DIR` isolates a test/custom store from legacy
`~/.codex` candidates unless migration is explicitly requested.

## Sources and execution

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
  access, credential storage, provider-content capture, or persistence; no provider is inferred
  ready from idle, age, or resumability.
- Codex app-server activity enrichment is disabled by
  `GAJENDRA_CODEX_ACTIVITY_ENRICHMENT=off`. When enabled on macOS it is the A4 bounded
  metadata-only tail inspection described in [README.md](README.md#codex-rollout-tail-boundary-a4),
  not transcript inspection.

## Host and native boundaries

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
