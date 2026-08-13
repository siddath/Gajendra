# Status

**Candidate:** Gaja, Elephant Focus for AI Power Users 0.3.1
**Reconciled:** 2026-08-13
**Publication state:** local source-release candidate; not published

**Repository/compatibility identity:** Gajendra (`gajendra` packages, plugin ID, URL scheme, bundle identifier, executable, and state paths)

## Implemented

- One global NOW plus ordered Focus/Important tiers across canonical `source:thread` IDs.
- Codex app-server source, opt-in Claude Code metadata source, Cursor Agent CLI source, and configured JSON-catalog sources.
- Source enablement and health display in the native organizer and MCP App.
- Safe return paths: Codex deep links and short-lived, shell-quoted Terminal resume scripts for CLI-owned sessions.
- Bottom-right icon-only native utility, hover card, resizable organizer, Dock/menu-bar recovery, and reversible login item.
- macOS 26 Liquid Glass with semantic material fallback on macOS 13–15; light/dark and Reduce Motion support.
- Original seven-stroke thin-line lotus with identical Bézier geometry across native, menu-bar, app-icon, and web surfaces.
- Private v2 metadata store with atomic writes and copy-only Aadi/Priority Deck migration.
- MIT license, contribution/security guidance, source schema, Apple design rationale, and release checklist.

## Local verification

- Release gauntlet: passed from `2026-08-12T18:52:39.700Z` to `2026-08-12T18:54:15.936Z`, 18/18 receipts; report SHA-256 `b49f7930061ef80ac56324fceda838d71f20cfa5b8d0956ede7932bb02d6c6e6`.
- Tests: 19 unit/integration tests, 7 browser journeys, 35 repeated browser journeys, and five repeated unit suites all passed.
- Supply chain: `npm audit --omit=dev --audit-level=high` found 0 vulnerabilities.
- Post-UI artifact gate: passed; `dist/server.mjs` remained present after 35 repeated UI journeys and matched the installed plugin cache.
- Installed plugin: `gajendra@gajendra` 0.3.1 enabled; all nine checked runtime, artwork, and skill cache artifacts match source; six tools and one MCP App resource registered.
- Installed app: visible name `Gaja`, compatibility executable `Gajendra`, version 0.3.1, ad-hoc signature valid; binary SHA-256 `02865e04d0cb2bd2ed1a47a24f231ee40bb89d87505c72890f6fbc6bfb9d504b`; icon SHA-256 `0e44c3fa05a98925aac3e8e1f52ffaeda9ef61c2f3be01c052f5a7e230db444c`.
- Artwork: canonical SVG SHA-256 `9b37a08596c0c6c03d345da34703aed549f93dfb7791955ffd8672847d04bef9`; generated 1024px PNG SHA-256 `ef1e549403186e8c020ac2c5587bdb1020811c3968e6721164b22aaaf2189546`.
- Running installed UI: 60×60 lotus at `(1434, 904)`, the exact 18-point bottom-right margin on the active 1512×982 display; a temporary cursor probe revealed the 404×310 card at `(1090, 584)` and restored the pointer.
- State: v2 store valid with one NOW, `0600` file, `0700` directory, and no persisted live thread content.

## Provider proof levels

- Codex: live and `ready`, 123 bounded threads observed.
- Claude Code: explicitly enabled and `ready`, 200 bounded metadata records observed; prompts/transcripts were not emitted or persisted.
- Cursor: adapter and official CLI contract are fixture/unit tested; `cursor-agent` is not installed on this machine, so live discovery/resume is unverified here.
- Configured agents: schema/fixture tested; each third-party catalog and resume target remains operator-owned.

## Still external or unproven

- No public GitHub URL, release, tag, or hosted CI receipt is claimed.
- The app is ad-hoc signed, not Developer ID signed or notarized.
- Codex’s experimental global MCP App destination remains host/account gated; the native utility and inline MCP App do not depend on it.
- The 14-day adoption trial has not yet produced three real reuse receipts.
- A WidgetKit extension is an evaluated future surface, not part of 0.3.1.
- The running Codex process predates the 0.3.1 plugin refresh. No forced restart was performed; native Gaja is already independent, installed, and running.

Follow [the release checklist](docs/RELEASE_CHECKLIST.md) before publication.
