# macOS companion

Gajendra is intended to provide a quiet native macOS focus surface: one NOW, a short Focus queue,
Important, provider-reported Running, and an explicit Ready for Review disclosure, with source
opening retained in the source product.

For a short build, first-launch, daily-use, and troubleshooting path, start with the
[user guide](USER_GUIDE.md). This page retains the deeper source/build and evidence contract.

This page records the **source/build contract** and keeps local, hosted, and installed proof
separate. The 2026-08-24 [PR #25](https://github.com/siddath/Gajendra/pull/25) release passed source,
native self-test/build, real-window `npm run companion:ui-test`, measured
`npm run companion:ui-performance-test`, validation, bundle-readiness, and synthetic launch-asset
checks. Its exact PR-head and merged-main hosted jobs passed; the exact merged plugin/app install
also passed artifact parity and isolated UI checks without changing private state bytes or
permissions. None of those receipts establishes a clean-Mac run, physical VoiceOver, login-item or
manual human-drag proof, Developer ID signing, notarization, or distribution readiness.

## Source contract

- The visible name is **Gajendra**. The descriptor is **One clear focus across your AI tools.** and
  the longer promise is **One NOW. One short queue. One click back to the exact thread.**
- The compatibility executable, bundle/path naming, state path, and URL route remain `Gajendra`,
  `dev.sid.gajendra`, `Application Support/Gajendra`, and `gajendra://`.
- The native target floor is macOS **13.5**. Source builds use Node >=20; a bundle must include the
  pinned Node **v24.19.0** runtime, checksum verification, and notices.
- Launch at Login must change only after an explicit user action. Exact local installation does not
  establish physical login-item behavior; that proof remains gated.
- The native client consumes the same revision/CAS/idempotency mutation contract as the MCP app.
  Queue reorder is one `move-before` operation, never a sequence of partially applied moves.
- The floating launcher, Dock reopen, and menu-bar item present the compact focus card by default;
  Organizer remains an explicit management surface from the app menu and queue overflow routes.
- A quick card-row click remains the Open route. A stationary 280 ms hold selects and visually
  lifts the task; continuing the same local gesture drags the visible row to reorder or change
  lanes. The approved compact priority route keeps the primary Open/Review and provider actions
  separate from priority controls: an unprioritized Running or Ready row offers **Add to Focus** and
  **Add to Important** through `plus.circle`; a non-NOW Focus or Important row offers the opposite
  lane through `arrow.left.arrow.right`. NOW exposes no lane-changing action. The queue
  affordance is hover-emphasized in a reserved slot, so its row does not shift. Organizer retains
  explicit move controls. Drag geometry stays inside the app, so no pasteboard payload or canonical
  thread ID is exported.
- Open actions must revalidate the source-specific destination scheme immediately before launch.
- A primary launcher action always exits move/hide mode before toggling the card. The drag
  recognizer begins at the same 6-point movement threshold used by placement logic, so a natural
  2 px tap is not consumed as a drag. The AppKit host exposes one real accessibility button with
  the same recovery action.
- The pill panel handles the single click directly instead of waiting for a double-click gesture to
  fail. It remains nonactivating and becomes key on demand for the click that targets it, so an
  inactive app does not consume a priming click. The card is constructed and laid out during launch,
  becomes the key nonactivating panel on reveal, and accepts mouse movement plus the first pointer
  sequence immediately. Its reveal refresh coalesces behind an active launch read instead of being dropped. The isolated pre-fix
  launcher-to-visible-card baseline was 454–552 ms; the current focused runs remain below the 200 ms
  regression budget.
- Snapshot reads keep the last valid Focus/Important rows interactive. A priority intent made during
  that read is queued against the resulting authoritative snapshot; only an in-flight mutation
  blocks another priority action. Double-click Open is scoped to the NOW card rather than the entire
  widget background.
- Running and Ready metadata refresh immediately on reveal and at a conservative cadence only while
  a compact surface is visible. Refresh pauses during search focus, queue editing, drag, loading, or
  mutation and stops when the card/popover closes; Gajendra does not install a hidden always-on
  watcher. The overall source collection uses a derived 70-second provider/store envelope by
  default rather than the shorter stale-lock recovery marker: accepted Codex bounds include
  experimental and baseline initialization, bounded fallback teardown, listing, and the hard-capped
  runtime enrichment. At 85 seconds the native process watchdog initiates TERM/KILL; bounded
  process-group and pipe-drain cleanup follows. This is a termination threshold over the
  source-generation and later store/process work, not a strict response-by-85s SLO.
  A provider completion changes from
  Running to Ready for Review on refresh only when it has valid Ready evidence; Ready is not an
  unread marker.
- Ready for Review sits below Running in the same single scroll body. Orange is paired with the
  `checkmark.bubble` glyph, label, count, ready time, destination label, and accessibility copy.
  The main review row opens the declared Review or Task destination; its provider badge separately
  opens the owning task. Review metadata remains live-only and Running has overlap precedence. An
  expanded compact preview renders at most five Ready rows and routes the exact remainder to
  Organizer.
- Running and Ready for Review use high-visibility numeric badges. Running also exposes an explicit
  **All priority lanes** control that shrinks or expands its rows on one click. A pointer double-click
  on either dock header remains available; a single click on the header is intentionally inert,
  while the accessibility press action provides the equivalent header toggle.

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
exact persisted queue order; then exercises the explicit Running control plus the Running/Ready
single-click guards and double-click contract. It also opens the card while another app is active,
proves that the first hold is accepted without a priming click, and verifies that a NOW-card
double-click opens the exact synthetic destination. The performance command runs the widget-only
portion, enforces the measured 200 ms popup budget, and rejects any SwiftUI dependency cycle in
that journey. Both require a
logged-in Mac whose invoking test host may post pointer and
accessibility events; hosted CI compiles the target but does not claim a manual physical journey.
The focused compact-priority journey uses an isolated synthetic state file. It verifies action
visibility, NOW suppression, sibling primary-action separation, add/move persistence, absence of an
accidental Open side effect, and the five-row Ready overflow source contract. The widget-only
performance comparison is recorded in
[`evidence/verification/2026-08-24-priority-actions-performance.md`](../evidence/verification/2026-08-24-priority-actions-performance.md).
Bundle readiness is an inspection, not a release authorization: it checks source-controlled bundle
requirements and reports ad-hoc signing honestly. Developer ID, notarization, Gatekeeper, archive,
and distribution receipts are separate, fail-closed steps.

The last two commands render and validate the public screenshot package using a dedicated synthetic
fixture. The app surfaces are actual SwiftUI output; no private provider thread is used.

See [Host validation](HOST_VALIDATION.md), [release checklist](RELEASE_CHECKLIST.md), and
[STATUS.md](../STATUS.md) for the pending proof sequence.
