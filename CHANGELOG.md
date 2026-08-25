# Changelog

## Unreleased

- Kept Ready for Review independent of NOW, Focus, and Important; added a separate green,
  exact-response review acknowledgement with Undo, bounded SHA-256 receipts, Running precedence,
  and side-effect-free Open behavior. Removed duplicate compact lane arrows and Ready glyphs from
  priority rows, and refreshed the matching native/browser proof, docs, and launch media.
- Restored the visible **Gajendra** identity with the descriptor **One clear focus across your AI
  tools.** and promise **One NOW. One short queue. One click back to the exact thread.**, while
  retaining the established package, URL, bundle, executable, and state compatibility identifiers.
- Added the compact floating focus card, explicit Organizer, one global NOW, ordered Focus and
  Important queues, app-owned Undo/Redo, native Search, bounded context labels, and full-row
  hold/select/drag interaction without persisting provider content.
- Added provider-reported Running across all priority lanes and guarded Ready for Review metadata.
  The explicit **All priority lanes** control and the Running dock header independently
  collapse/expand the list in both native surfaces.
- Added bounded local adapters for Codex, opt-in Claude Code, Cursor, Grok, and explicit configured
  catalogs, with generation-safe collection, strict destination validation, private atomic state,
  process-group cleanup, and fail-closed recovery.
- Added a source-build guide, user/support/security/contribution documentation, synthetic product
  screenshots, deterministic browser/native interaction tests, and local release-readiness checks.
- Made the compact card pointer-ready on reveal, retained queue interaction during snapshot reads,
  made the nonactivating launcher become key on demand for its first click, coalesced a reveal
  refresh behind in-flight launch loading, scoped double-click Open to the NOW card, and removed
  the clipped launcher blur that could resemble a rectangular shadow.
- Added compact, purpose-specific priority actions: unprioritized Running and Ready rows open a
  two-choice **Add to Focus / Add to Important** menu, while non-NOW Focus and Important rows move
  to the opposite lane in one click. NOW has no lane-changing route. The expanded Ready preview is
  capped at five rows with an exact Organizer overflow route.
- Added isolated persistence and real-window interaction coverage for those actions, including
  primary Open-target separation, NOW immobility, drag/drop coexistence, and a same-host performance
  comparison against the pre-change revision.
- Enforced the NOW guard below every native surface, the standalone MCP web surface, and the public
  mutation service: a direct lane change cannot demote or remove NOW, while an atomic Make-NOW/Undo
  operation may name a valid replacement. Updated host preflight to validate the current private
  store schema version.
- Clarified the Ready evidence boundary: an otherwise exact `completedAt: null` response is
  candidate-local omitted evidence, while malformed, private-content, unsupported, ambiguous, or
  purported-completed responses with an error fail the built-in review batch closed. Valid active,
  failed, and interrupted turns remain candidate-local non-Ready evidence. Ready is provider
  completion rather than unread state, and a valid provider completion moves from Running to Ready
  on refresh.
- Fixed an outer refresh-budget race that could return an empty safe fallback while a bounded Codex
  collection was still completing. The accepted provider envelope is 60.75 seconds, with tighter-only
  RPC overrides and a four-worker source-collection floor; the source-generation budget rounds to
  70 seconds instead of inheriting the store's stale-lock marker. At 85 seconds the native
  subprocess watchdog starts TERM/KILL; bounded process-group and pipe cleanup follows, so this is
  not a response-by-85s SLO.
- Mitigated browser automation collisions with stale local previews by selecting a bounded OS-assigned
  loopback port when no explicit `GAJENDRA_E2E_PORT` is supplied; valid explicit ports remain exact.
- Published source remains separate from binary distribution: Developer ID signing, notarization,
  stapling, Gatekeeper, clean-Mac proof, and mobile implementation are still open gates.

## 0.3.1 - 2026-08-13

- Renamed the visible product to **Gaja, Elephant Focus for AI Power Users** while retaining Gajendra as the repository and compatibility identity.
- Rebuilt the lotus as one original seven-stroke thin-line Bézier system shared by the adaptive SVG, menu-bar mark, app icon, MCP App, and native SwiftUI renderer.
- Added cross-surface vector parity, line-weight, visible-name, version, and bundle-executable validation.
- Expanded installed-cache verification to include all logo assets and the bundled Gaja skill.
- Regenerated light/dark native previews and web gauntlet screenshots from the release candidate.

## 0.3.0 - 2026-08-12

- Renamed the public product to **Gajendra Widget for Focus** and the repository/plugin identity to `gajendra`.
- Added one source registry for Codex, opt-in Claude Code metadata, Cursor Agent CLI sessions, and configured JSON catalogs.
- Added canonical `source:thread` IDs, source health/enablement, and one global NOW across providers.
- Added secure CLI resume handoff through short-lived, quoted `.command` files and the `gajendra://thread/...` route.
- Moved the organizer to a resizable macOS window while retaining the icon-only bottom-right hover utility.
- Added macOS 26 Liquid Glass with system-material fallback, standard system controls, keyboard commands, and adaptive light/dark design.
- Refined the original seven-part lotus into a minimal outline-only mark on every surface.
- Moved state to `~/Library/Application Support/Gajendra/gajendra.v2.json` with source preferences and copy-only migration from Aadi and Priority Deck.
- Added provider configuration, Apple design, architecture, security, engineering audit, and release documentation.

## 0.2.0 - 2026-08-12 — Aadi

- Replaced the always-open floating card with a persistent bottom-right icon and hover details card.
- Added the Aadi identity, native app icon, login-item trial, queued mutation fix, placement tests, CI scaffold, and engineering audit.

## 0.1.0 - 2026-08-11 — Priority Deck

- Added the first Codex MCP App, one NOW/Focus/Important policy, private metadata store, Codex deep links, native macOS organizer, GSAP web motion, and deterministic verification.
