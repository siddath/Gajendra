# macOS companion

Gajendra is intended to provide a quiet native macOS focus surface: one NOW, a short Focus queue,
Important, provider-reported Running, and an explicit Ready for Review disclosure, with source
opening retained in the source product.

For a short build, first-launch, daily-use, and troubleshooting path, start with the
[user guide](USER_GUIDE.md). This page retains the deeper source/build and evidence contract.

This page records the **source/build contract** and the narrow installed launcher receipt. On
2026-08-18, `npm run companion:test`, `npm run companion:build`,
`npm run companion:ui-test`, `npm run companion:validate`, and
`npm run companion:bundle-readiness` passed; the aggregate source check passed 83/83 and E2E passed
17/17. The exact ad-hoc build also passed the launcher UI journey after local installation. Those
receipts do not establish a clean-Mac run, physical VoiceOver, login-item or drag behavior,
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
- Open actions must revalidate the source-specific destination scheme immediately before launch.
- A primary launcher action always exits move/hide mode before toggling the card. The drag
  recognizer begins at the same 6-point movement threshold used by placement logic, so a natural
  2 px tap is not consumed as a drag. The AppKit host exposes one real accessibility button with
  the same recovery action.
- Ready for Review sits below Running in the same single scroll body. Orange is paired with the
  `checkmark.bubble` glyph, label, count, ready time, destination label, and accessibility copy.
  The main review row opens the declared Review or Task destination; its provider badge separately
  opens the owning task. Review metadata remains live-only and Running has overlap precedence.

## Local source build procedure

```sh
npm run check
npm run companion:test
npm run companion:build
npm run companion:ui-test
npm run companion:validate
npm run companion:bundle-readiness
npm run launch:assets
npm run validate:launch-assets
```

The UI command launches the built app with a temporary empty store and disabled built-in sources;
it drives the real 60×60 window with stationary, 2 px, edit-recovery, AX-press, and edge taps. It
requires a logged-in Mac whose invoking test host may post pointer and accessibility events; hosted
CI compiles the target but does not claim that physical journey. The last command is an
inspection, not a release authorization: it checks source-controlled bundle requirements and reports
ad-hoc signing honestly. Developer ID, notarization, Gatekeeper, archive, and distribution receipts
are separate, fail-closed steps.

The last two commands render and validate the public screenshot package using a dedicated synthetic
fixture. The app surfaces are actual SwiftUI output; no private provider thread is used.

See [Host validation](HOST_VALIDATION.md), [release checklist](RELEASE_CHECKLIST.md), and
[STATUS.md](../STATUS.md) for the pending proof sequence.
