# Release gauntlet

The current 0.4.0 source-release run is recorded in
[`evidence/gauntlet/report.json`](../evidence/gauntlet/report.json). It uses `--non-native-ui` and
reports **partial**: the three AX-driver native UI/fullscreen/performance gates are not run in
this restricted UI-control environment. Product evals are now a separate required gate. Narrow
CUA interaction checks are recorded separately and do not replace those three gates.

The September 5 all-gates pass is historical evidence for the earlier sizing/settings build,
linked from [PR #33](https://github.com/siddath/Gajendra/pull/33) and the
[widget-sizing notes](WIDGET-SIZING-2026-09-06.md). It is not a pass for the current code.

Source checks, hosted CI, installed behavior, signing/notarization, clean-Mac acceptance and
publication are distinct receipts. The procedure below is the required rerun sequence when a
change invalidates a gate.

## Required sequence

1. Freeze all writers; capture the exact worktree/commit boundary.
2. Run focused server/store/source tests, `npm run check`, `npm run evals`, and `npm run test:e2e`.
3. Freeze native source, then run companion self-tests, build, isolated real-window launcher UI,
   the synthetic full-screen launcher and Dock/reopen journey (`npm run companion:ui-fullscreen-test`),
   measured widget-performance journey, companion validator, and local bundle-readiness.
4. Verify Gajendra visible copy, stable compatibility IDs, state privacy/recovery, A4 hostile-tail
   boundary/kill switch, A5 navigation blocks, and source bounds.
5. Produce only synthetic, privacy-reviewed images and a local, evidence-bounded post draft after
   the earlier gates pass.
6. For binary distribution, separately require explicit Developer ID/team, strict signature,
   Gatekeeper, notarization/staple, archive, and checksum receipts. Do not run those actions without
   authorization and inputs.

## Claim rules

A local source check does not prove an installed app. An ad-hoc signature does not prove Developer
ID/notarization. Historical hosted CI does not prove the current branch. A preview does not prove
interaction; the real-window pointer automation proves its isolated scripted journey, not physical
VoiceOver, login-item, or manual human drag. A mobile plan does not authorize a listener or mobile
product.

The execution worksheet holds the gate matrix and marks local evidence separately from external
gates:
[release, brand, and mobile execution](../worksheets/2026-08-18-gajendra-release-brand-mobile-execution.md).

## Restricted native automation environments

`npm run gauntlet -- --non-native-ui` runs the data/build/browser/reliability/audit gates while
recording the three AX-driver native gates as `not-run`. Its report is always `partial`, never a
full gauntlet pass. Use the permitted native UI driver for separate visible interaction receipts;
do not treat those narrower journeys as proof of fullscreen, physical drag/accessibility or strict
widget latency. Release candidate notes must preserve these limits. The default command retains
all existing gates.
