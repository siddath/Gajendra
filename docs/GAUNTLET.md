# Release gauntlet

The current Gajendra source-review candidate has a **passing local gauntlet receipt**:
[`evidence/gauntlet/report.json`](../evidence/gauntlet/report.json) records 19 passing result
records on 2026-08-18. The run covers repository scripts, static/behavior/build/plugin checks, live
MCP, companion self-test/build/real-window launcher/live checks, browser UI, repeated reliability
checks, final artifacts, and dependency audit.

This is local candidate evidence, not a clean-Mac, physical VoiceOver/login/drag,
Developer ID, notarization, distribution, publication, or mobile receipt. The procedure below is
the required rerun sequence if the candidate changes.

After the passing run, a [privacy-reviewed synthetic image](../evidence/launch/README.md) and an
evidence-bounded [local post draft](../worksheets/GAJENDRA_LINKEDIN_POST_DRAFT.md) were created.
They remain unapproved and unpublished, and do not extend the gauntlet's proof boundary.

## Required sequence

1. Freeze all writers; capture the exact worktree/commit boundary.
2. Run focused server/store/source tests, npm run check, and npm run test:e2e.
3. Freeze native source, then run companion self-tests, build, isolated real-window launcher UI,
   companion validator, and local bundle-readiness.
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
physical VoiceOver, login-item, or drag interaction. A mobile plan does not authorize a listener or
mobile product.

The execution worksheet holds the gate matrix and marks local evidence separately from external
gates:
[release, brand, and mobile execution](../worksheets/2026-08-18-gajendra-release-brand-mobile-execution.md).
