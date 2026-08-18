# Gajendra

<p align="center">
  <img src="plugins/gajendra/assets/gajendra.svg" alt="Gajendra elephant holding a lotus" width="112" />
</p>

<p align="center"><strong>One clear focus across your AI tools.</strong><br />
One NOW. One short queue. One click back to the exact thread.</p>

Gajendra is a local-first macOS focus utility for AI-agent threads. It keeps one global NOW and
short Focus and Important queues across supported sources; the source product continues to own the
thread, its content, and its credentials.

`Gajendra` is the visible product name. The lower-case compatibility identifiers remain unchanged:
`gajendra` packages and plugin IDs, `gajendra://` URLs, `dev.sid.gajendra`, the executable name,
and the `Application Support/Gajendra` state path.

## Current candidate boundary

This branch is a **source-review candidate** based on `53e9855`, not a binary release. Source
publication on GitHub does not imply that an app bundle is Developer ID signed, notarized,
Gatekeeper-approved, or safe to distribute. Exact commit, pull-request, and hosted-CI receipts are
recorded in [STATUS.md](STATUS.md) after they exist.

The release evidence ledger and the remaining gates are in [STATUS.md](STATUS.md) and
[the execution worksheet](worksheets/2026-08-18-gajendra-release-brand-mobile-execution.md).

The current local receipts recorded on 2026-08-18 are `npm run check` (**83/83** tests),
`npm run test:e2e` (**17/17**), `npm run companion:test`, `npm run companion:build`,
`npm run companion:ui-test`, `npm run companion:validate`, and
`npm run companion:bundle-readiness`. The real-window UI journey uses an isolated empty store and
source catalog; it covers stationary and 2 px taps, recovery from move/hide mode, an actual macOS
accessibility press, and the launcher edge target. The exact ad-hoc build also passed that launcher
journey after local installation without changing the private state-file hash or modes. This is not
a clean-Mac, physical VoiceOver, login-item, drag, Developer ID, notarization, or distribution
receipt.

The current [local gauntlet receipt](evidence/gauntlet/report.json) passed on 2026-08-18 with 19
passing result records. It covers repository/static/behavior/build/plugin/live MCP, companion,
real-window launcher UI, browser UI, reliability, final-artifact, and dependency-audit checks; it
is not a clean-Mac or external-release receipt.

## Product and privacy contract

- **NOW** is global and is always a member of **Focus**. **Focus** and **Important** retain their
  full ordered queues; compact surfaces show at most five entries per lane and link to Organizer
  for the remainder. **Running** is a provider-reported status, not a persisted priority tier or a
  recency guess. **Ready for Review** is a second derived disclosure populated only by an explicit
  provider signal; Running takes precedence when a stale source reports both.
- Canonical IDs are `source-id:provider-thread-id`. Gajendra stores only IDs, priority order, the
  bounded Design/Engineering/Life context enum, preferences, a monotonic revision, and bounded
  hashed idempotency receipts. It never persists titles, prompts, transcript bodies, source files,
  credentials, tokens, or arbitrary provider responses.
- Sources are explicit and bounded. Claude Code metadata remains opt-in; configured sources are
  bounded catalogs with validated unique source IDs, not arbitrary directory or command discovery.
  A configured catalog may declare a validated live-only `review` signal as shown in
  [the synthetic example](examples/review-catalog.json); Gajendra never infers review readiness from
  `idle`, `resumable`, or recency.
- Gajendra opens an allowed source destination only after source-specific URL validation. Unsafe
  `javascript:`, `data:`, and `file:` destinations fail both when catalog data is read and when an
  open is attempted.

Read [Architecture](docs/ARCHITECTURE.md), [thread-source boundaries](docs/THREAD_SOURCES.md),
[security](SECURITY.md), and [compatibility](docs/COMPATIBILITY.md) before changing these rules.

## A1–A6 source contract

| Gate | Current source contract | Evidence boundary |
| --- | --- | --- |
| A1 | One private store authority serializes cross-process mutations with revision/CAS, SHA-256 idempotency receipts, and typed stale conflicts. `GAJENDRA_DATA_DIR` does not inherit legacy `~/.codex` state unless migration is explicitly requested. | Current source coverage and the local gauntlet are recorded; external proof remains open. |
| A2 | `move-before` is one atomic mutation for reorder, lane move, append, NOW repair, and context retention. Duplicate keys replay exactly once; an absent target rejects before mutation. | Current domain/service fault and replay coverage plus the local gauntlet are recorded; physical/installed proof remains open. |
| A3 | Launch at Login is source-controlled only after explicit user action. | Native source, self-test, companion validator, build, and local bundle-readiness are recorded; no installed login-item claim is made. |
| A4 | Codex activity enrichment is optional, bounded, metadata-only, and never persists rollout content. | Current adapter/persistence coverage, companion-validator boundary checks, and the local gauntlet are recorded; installed-provider proof remains open. |
| A5 | Per-source safe schemes are enforced at catalog parsing and again at web/native opening. | Current local TypeScript/web coverage is a source receipt; installed/native interaction proof remains open. |
| A6 | Unknown IDs fail closed; store/catalog reads are bounded; corrupt state is quarantined and only a structurally valid private last-known-good copy can recover it. | Current recovery coverage and the local gauntlet are recorded; external/installed proof remains open. |

### Codex rollout-tail boundary (A4)

On macOS only, Gajendra may enrich an app-server status by inspecting a held Codex writer-lock path
under `~/.codex/thread-writer-locks`. It realpath-confines the matching rollout under
`~/.codex/sessions`, opens it without following links, reads no more than the final **256 KiB**, and
considers only allow-listed lifecycle markers after the last `task_complete` marker. Response items,
messages, coordination payloads, and raw rollout content are neither returned nor persisted.

Set `GAJENDRA_CODEX_ACTIVITY_ENRICHMENT=off` to disable this optional enrichment. If a lock, path,
open, bounded read, lifecycle marker, or local probe fails, the app-server status is retained rather
than inferred from file age or content.

Codex app-server JSON-RPC stdout accepts one response line up to a **512 KiB default**, selected
after a measured `thread/list limit=100` response of 383,665 bytes. An environment override can
lower or raise that value only to a fixed **1 MiB hard maximum**. Oversized or unterminated output
fails generically, is cleaned up, and is neither exposed nor persisted.

## Build from source

The source-build contract is macOS **13.5 or later**, Xcode/Swift, and Node **20 or later** for
development. It is distinct from a binary distribution: a built app is expected to contain the
pinned Node **v24.19.0** runtime, checksum-verified during extraction, with its notices. One exact
ad-hoc local build has an installed launcher-interaction receipt; no downloadable or
distribution-ready binary is claimed.

```sh
git clone https://github.com/siddath/Gajendra.git gajendra
cd gajendra
npm ci
npm run check
npm run companion:build
npm run companion:ui-test
```

`npm run companion:bundle-readiness` is a local, fail-closed inspection of an existing bundle. It
reports ad-hoc signing honestly; it does not sign, notarize, publish, or make an artifact
distribution-ready. The separate distribution-readiness mode requires explicit Developer ID,
Gatekeeper, notarization/staple, archive, and checksum inputs and intentionally fails closed when
they are absent.

## State and support

The default macOS state location is:

```text
~/Library/Application Support/Gajendra/gajendra.v2.json
```

State is private (`0700` directory and `0600` files), bounded, atomically replaced, and backed by
a private last-known-good copy. Aadi/Priority Deck migration is copy-only; legacy files are never
moved or deleted by migration.

Use [GitHub Discussions](https://github.com/siddath/Gajendra/discussions) for support and
[private security reporting](https://github.com/siddath/Gajendra/security/advisories/new) for
vulnerabilities. See [SUPPORT.md](SUPPORT.md) and [SECURITY.md](SECURITY.md).

## Mobile planning boundary

The retained mobile pack is an **E0 documentation-only protocol and security amendment**. It does
not create a listener, relay, mobile app, credentials, dependency, branch, signing, or app-store
claim. D01–D07 and D11 remain explicit approvals; see
[the mobile plan](worksheets/GAJENDRA_MOBILE_APP_PLAN.md).
