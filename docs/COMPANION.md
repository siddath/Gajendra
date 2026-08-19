# macOS companion

Gajendra is intended to provide a quiet native macOS focus surface: one NOW, a short Focus queue,
Important, provider-reported Running, and an explicit Ready for Review disclosure, with source
opening retained in the source product.

For a short build, first-launch, daily-use, and troubleshooting path, start with the
[user guide](USER_GUIDE.md). This page retains the deeper source/build and evidence contract.

This page records the **source/build contract** and the exact-installed automated interaction receipt. On
2026-08-19, the implementation merged through PR #17 passed the real-window `npm run companion:ui-test` and
`npm run companion:ui-performance-test` journeys, `npm run companion:test`,
`npm run companion:build`, `npm run companion:validate`, and
`npm run companion:bundle-readiness`; the aggregate source check passed 98/98 and E2E passed
17/17. The same exact ad-hoc build also passed the complete isolated pointer journey after local
installation; the exact source build separately passed the cycle-sensitive performance journey.
Those receipts do not establish a
clean-Mac run, physical VoiceOver, login-item, or a manual human drag,
Developer ID signing, notarization, or distribution readiness.

## Source contract

- The visible name is **Gajendra**. The descriptor is **One clear focus across your AI tools.** and
  the longer promise is **One NOW. One short queue. One click back to the exact thread.**
- The compatibility executable, bundle/path naming, state path, and URL route remain `Gajendra`,
  `dev.sid.gajendra`, `Application Support/Gajendra`, and `gajendra://`.
- The native target floor is macOS **13.5**. Source builds use Node >=20; a bundle must include the
  pinned Node **v24.19.0** runtime, checksum verification, and notices.
- Launch at Login must change only after an explicit user action. Current local source/self-test and
  bundle receipts do not make this an installed-app claim; physical login-item proof remains gated.
- The native client consumes the same revision/CAS/idempotency mutation contract as the MCP app.
  Queue reorder is one `move-before` operation, never a sequence of partially applied moves.
- The floating launcher, Dock reopen, and menu-bar item present the compact focus card by default;
  Organizer remains an explicit management surface from the app menu and queue overflow routes.
- A quick card-row click remains the Open route. A stationary 280 ms hold selects and visually
  lifts the task; continuing the same local gesture drags the visible row to reorder or change
  lanes. Compact rows do not expose a permanent drag/menu handle. Organizer retains explicit move
  controls. Drag geometry stays inside the app, so no pasteboard payload or canonical thread ID is
  exported.
- Open actions must revalidate the source-specific destination scheme immediately before launch.
- A primary launcher action always exits move/hide mode before toggling the card. The drag
  recognizer begins at the same 6-point movement threshold used by placement logic, so a natural
  2 px tap is not consumed as a drag. The AppKit host exposes one real accessibility button with
  the same recovery action.
- The pill panel handles the single click directly instead of waiting for a double-click gesture to
  fail. The card is constructed and laid out during launch; metadata refresh starts after reveal and
  is skipped when another load is already active. The isolated pre-fix launcher-to-visible-card
  baseline was 454–552 ms; the current focused runs are 80–94 ms against a 200 ms regression budget.
- Running and Ready metadata refresh immediately on reveal and at a conservative cadence only while
  a compact surface is visible. Refresh pauses during search focus, queue editing, drag, loading, or
  mutation and stops when the card/popover closes; Gajendra does not install a hidden always-on
  watcher.
- Ready for Review sits below Running in the same single scroll body. Orange is paired with the
  `checkmark.bubble` glyph, label, count, ready time, destination label, and accessibility copy.
  The main review row opens the declared Review or Task destination; its provider badge separately
  opens the owning task. Review metadata remains live-only and Running has overlap precedence.
- Running and Ready for Review use high-visibility numeric badges. A pointer double-click on either
  dock header shrinks or expands its rows; a single click is intentionally inert, while the
  accessibility press action provides the equivalent toggle.

## Local source build procedure

```sh
npm run check
npm run companion:test
npm run companion:build
npm run companion:ui-test
npm run companion:ui-performance-test
npm run companion:validate
npm run companion:bundle-readiness
npm run launch:assets
npm run validate:launch-assets
```

The UI command launches the built app with a temporary isolated store, disabled built-in sources,
and a bounded synthetic catalog. It drives the real 60×60 window with stationary, 2 px,
edit-recovery, AX-press, and edge taps; distinguishes quick task clicks from stationary holds;
drags the lifted full task row and verifies compact/Organizer cross-lane pointer changes against the
exact persisted queue order; then exercises the Running/Ready single-click and double-click
contract. The performance command runs the widget-only portion, enforces the measured
200 ms popup budget, and rejects any SwiftUI dependency cycle in that journey. Both require a
logged-in Mac whose invoking test host may post pointer and
accessibility events; hosted CI compiles the target but does not claim a manual physical journey.
Bundle readiness is an inspection, not a release authorization: it checks source-controlled bundle
requirements and reports ad-hoc signing honestly. Developer ID, notarization, Gatekeeper, archive,
and distribution receipts are separate, fail-closed steps.

The last two commands render and validate the public screenshot package using a dedicated synthetic
fixture. The app surfaces are actual SwiftUI output; no private provider thread is used.

See [Host validation](HOST_VALIDATION.md), [release checklist](RELEASE_CHECKLIST.md), and
[STATUS.md](../STATUS.md) for the pending proof sequence.
