# Status

**Product:** Gajendra — One clear focus across your AI tools.

**Promise:** One NOW. One short queue. One click back to the exact thread.

**Reconciled:** 2026-08-19

**Public state:** source is public on `main`; no binary release is claimed.

**Prior implementation/CI-hardening baseline:** `9e989e91bcdb28b298db20ad2ab01b6e610febb2`

**Latest public source change:** [PR #21](https://github.com/siddath/Gajendra/pull/21) adds the
explicit Running **All priority lanes** control and public-contribution reconciliation. Its checks
page is the commit-scoped hosted receipt.

**Prior hosted baseline receipt:** [CI run 32233868042](https://github.com/siddath/Gajendra/actions/runs/32233868042)
passed the Linux plugin/browser/audit job and macOS companion job.

PRs [#12](https://github.com/siddath/Gajendra/pull/12) through
[#20](https://github.com/siddath/Gajendra/pull/20) are the preceding merged history. PR #17 added
the compact interaction and Ready-for-Review implementation; PR #18 added portable process proof;
PRs #19 and #20 reconciled public launch evidence. PR #21 carries the latest user-facing and
open-source-readiness delta. Hosted proof remains commit-scoped.

## Current user-facing state

| Area | Current source/local state | Boundary that remains open |
| --- | --- | --- |
| Focus surface | The floating launcher, Dock reopen, and menu-bar item now lead to the compact focus card; Organizer is explicit. Compact rows show thread metadata without a permanent menu/drag handle. A quick task click remains Open; a stationary hold selects the row, and continuing the same press lifts its visible preview for full-row drag. Each successful drop remains one atomic `move-before` mutation. | The exact installed ad-hoc build passed the isolated pointer journey; physical human-pointer and VoiceOver journeys remain separate evidence. |
| Running | Explicit provider-reported activity appears across every priority lane without changing priority. The count uses a high-visibility badge; the explicit **All priority lanes** control and a dock-header double-click both shrink or expand the list. | Do not infer activity from age or resumability. |
| Ready for Review | A validated configured catalog or the current local Codex app-server's zero-message newest-turn metadata can provide a live-only review signal with exact Review/Task destinations and Running precedence. Opening does not clear it; visible compact surfaces recheck while idle. The count uses a high-visibility badge and the dock shrinks or expands on double-click. | Claude Code, Cursor, and Grok are not guessed ready from recency, idle, or resumability; remote credentials/network adapters do not exist. |
| Launcher reopen | The real 60×60 macOS launcher handles clicks directly in AppKit, prewarms the card, and refreshes after reveal. Stationary click, 2-pixel click, move/edit recovery, accessibility press, and outer-edge automation pass. Five consecutive fresh-process journeys measured 81–93 ms cold/warm and 25–62 ms prewarmed against a 200 ms budget, versus the reproduced 454–552 ms pre-fix baseline. | This is isolated local automation on the current host, not every physical pointer, machine-load profile, or VoiceOver journey. |
| Sources and privacy | Codex, Claude Code, Cursor, and Grok adapters are explicit and bounded. Gajendra persists its own priority metadata, not titles, prompts, transcripts, credentials, review content, or provider databases. | Installed-provider and clean-account proof remain separate. |
| Native app | macOS 13.5 source build, bundled Node v24.19.0, notices, service parity, and strict ad-hoc codesign verification pass locally. | Developer ID, notarization, stapling, Gatekeeper, clean-Mac, and distribution are not complete. |
| Mobile | A documentation-only transport/security plan exists. | No listener, relay, mobile app, credential, signing, or store submission exists. |

## Public launch package

- The README now leads with the product problem, real features, a short source-build setup, daily
  usability, privacy boundaries, and a [detailed user guide](docs/USER_GUIDE.md).
- Five high-resolution product screenshots are rendered from the real SwiftUI views with a dedicated
  six-task synthetic Codex/Claude-style fixture.
- The primary [hero image](evidence/launch/gajendra-hero.png) uses the real overview screenshot over
  a text-free generated backdrop and visibly labels the data synthetic.
- The [launch media receipt](evidence/launch/README.md) records dimensions, hashes, generation
  boundaries, reproduction commands, and privacy validation.
- The [concise LinkedIn draft](worksheets/GAJENDRA_LINKEDIN_POST_DRAFT.md) recommends Wednesday,
  2026-08-19 at 16:00 IST as a first timing experiment. It is not published.

## Current implementation receipts

The source candidate in PR #21 passed locally on 2026-08-19:

- `npm run launch:assets` — real SwiftUI screenshot suite and screenshot-led hero regenerated.
- `npm run validate:launch-assets` — **7/7** expected privacy-safe assets validated.
- `npm run check` — scripts, release-readiness regressions, TypeScript, **98/98** Vitest tests,
  plugin build, and plugin validation passed.
- `npm run test:e2e` — **17/17** browser journeys passed.
- `npm run companion:test` — native self-test passed.
- `npm run companion:build` — ad-hoc app with bundled runtime built and strict verification passed.
- `npm run companion:ui-test` — stationary reopen, 2-pixel reopen, move/edit recovery, real macOS
  accessibility press, outer-edge target, selected/lifted compact full-row drag, and Organizer
  cross-lane pointer drags with exact persisted order passed. The current source build also proves
  pointer collapse/expand through the explicit Running **All priority lanes** control in both the
  compact card and Organizer, single-click header guards, and Running/Ready double-click routes.
  The earlier PR #17 exact installed ad-hoc build retains its separate full interaction receipt.
  The journey also enters and clears Search through real key events and proves filtered/default
  content. The visible-only refresh lifecycle is covered by source wiring review and the native
  lifecycle-policy self-test, not by runtime timer instrumentation in the installed journey.
- `npm run companion:ui-performance-test` — the widget-only real-window journey passed its 200 ms
  popup budget and emitted no SwiftUI dependency-cycle warning. In the final gauntlet, the widget
  journey measured 59 ms prewarmed, 83 ms cold, and 91 ms warm; the full source journey measured
  64/84/82 ms. The earlier PR #17 installed journey remains a separate receipt.
- `npm run companion:validate` and `npm run companion:bundle-readiness` passed; readiness reported
  `distributionReady:false` and ad-hoc signing.
- The earlier PR #17 installed executable matched its verified build, preserved a rollback, and
  left the private state hashes plus `0700`/`0600` modes unchanged after relaunch. PR #21 does not
  reuse that receipt as installed proof.
- `npm run gauntlet` — **20** gate receipts passed, including the measured widget-performance gate,
  **85/85** repeated browser journeys, five repeated unit runs, live MCP, native, bundle,
  final-artifact, and dependency-audit gates.

These are local receipts and do not substitute for commit-scoped GitHub checks. A public green claim
belongs only to a revision whose pull-request and merged-main CI are both green. The receipts do not
close clean-Mac, physical accessibility, signed distribution, or publication gates.

## Open gates

- Clean-Mac installation and independent offline-path proof.
- Physical VoiceOver, manual drag, keyboard/system-toggle, and login-item receipts.
- Developer ID signing, notarization, stapling, Gatekeeper, archive parity, and distribution proof.
- Manual owner approval and publication of the LinkedIn post and image.
- Mobile D01–D07 and D11 approvals before any relay or application implementation.

See the [execution worksheet](worksheets/2026-08-18-gajendra-release-brand-mobile-execution.md) and
[release checklist](docs/RELEASE_CHECKLIST.md) for the complete gate structure.
