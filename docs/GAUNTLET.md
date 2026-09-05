# Release gauntlet

The initial widget-sizing implementation has a **passing local gauntlet receipt**:
[`evidence/gauntlet/report.json`](../evidence/gauntlet/report.json) records all 21 gates passing on
2026-09-05 (19:17–19:25 UTC; September 6 locally) for implementation/test commit
`13d8fa14d100a3efc695c6e779a10bcdf9d550ca`. It covers 115 source tests plus five complete repeats,
17 primary browser journeys plus 85 repeated journeys, live MCP, native self-test/build, real-window
interaction including independent layout/size controls, synthetic full-screen reopen, widget
performance, final artifacts, and zero production vulnerabilities.

The [widget-sizing notes](WIDGET-SIZING-2026-09-06.md) record the earlier failed timing sample,
unchanged-code recheck, final timings, installed verification, and publication boundary. The owner has since authorized publication and requested dropdown alignment and motion polish;
those additions require a fresh final gauntlet and current-head hosted CI before merge.
The previous dependency gauntlet remains available in
[the merged PR #23 receipt](https://github.com/siddath/Gajendra/blob/fbb9e608eaaec53a15054c537439528ceef94376/evidence/gauntlet/report.json).

This is local candidate evidence, not a clean-Mac, physical VoiceOver/login/manual-drag,
Developer ID, notarization, distribution, publication, or mobile receipt. The procedure below is
the required rerun sequence if the candidate changes.

After the earlier August run, a [privacy-reviewed synthetic image](../evidence/launch/README.md) and an
evidence-bounded [local post draft](../worksheets/GAJENDRA_LINKEDIN_POST_DRAFT.md) were created.
They remain unapproved and unpublished, and do not extend the gauntlet's proof boundary.

## Required sequence

1. Freeze all writers; capture the exact worktree/commit boundary.
2. Run focused server/store/source tests, npm run check, and npm run test:e2e.
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
