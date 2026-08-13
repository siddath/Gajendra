# Developer experience review

Reconciled for the Gajendra repository's Gaja 0.3.1 local publication candidate on 2026-08-13.

## Contributor loop

`npm run check` produces type validation, 18 unit/integration tests, a single-file MCP UI, a bundled server, and plugin validation. Native work adds `npm run companion:test`, `companion:build`, and `companion:preview`.

## Current friction

1. The canonical public clone URL is `https://github.com/siddath/Gajendra.git`; release state is tracked separately in `STATUS.md`.
2. The full gauntlet requires macOS, Codex CLI, Node 20+, Swift tooling, and browser dependencies.
3. Cursor live integration cannot be exercised without `cursor-agent`; parser fixtures remain the honest fallback.
4. Claude’s local session catalog is sensitive even though Gaja extracts metadata only, so it stays opt-in.
5. Public app downloads require signing/notarization infrastructure that source contributors do not need.
6. Same-version local marketplace refreshes can cache stale output; `npm run install:local` verifies hashes and performs one bounded retry.

## Recovery quality

- One source failure leaves other ready sources usable and visible.
- Refresh and mutations queue rather than silently drop.
- The normal window, Dock, and menu bar recover from hidden overlays.
- The standard inline MCP App remains when Codex’s global route is absent.
- Uninstall and retained-state behavior are explicit.

## Verdict

The local contributor path is ready after the final 0.3 gauntlet. Public onboarding remains gated by the actual remote and first hosted clean-clone CI receipt; binary distribution remains a separate Apple signing task.
