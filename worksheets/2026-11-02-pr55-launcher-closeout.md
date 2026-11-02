# PR #55 launcher closeout — 2026-11-02

## Contract and scope

Sid explicitly requested the existing PR cleaned, updated, merged and closed.
The source merge is the downstream action; Sid owns the decision and supplied
no deadline. Stop after current-head review/CI, verified merge/closure and
recoverable local cleanup. Installed-app rollout and a native release are separate.

The branch was current with main `982483802b9a6cd8e0bedbd4489131b6fecd224d`.
The production diff is limited to near-clear launcher backing and a stable
32-point edit bar. Private state, provider content and source-owned destinations
remain protected. No fixture data or private preference exports are committed.

## Focused regression

Source `183bd1f833ce3344b96fd925d401f44815ba49cd` adds `launcher-priority`
to the existing native driver. It reuses every launcher/priority assertion in
the default journey and returns before Search/Running/Organizer checks. Its JSON
reports only those exercised claims. The complete default path is retained.

Independent review found a gap in the previous intent checks: remaining out of
edit mode did not prove an exact Open, and an unintended successful Open during
a hold would not show an error. The driver now checks the synchronous synthetic
Open marker is absent after stationary hold, continuous drag and edit-mode drag;
quick tap must produce exactly `ui-agent://threads/important-a`. The row is
resolved by stable hit target and Ready value. No tolerance, pointer ownership,
interference guard or acceptance assertion was weakened.

The fresh candidate used the current dependency lock. Its executable SHA-256 is
`5257392f8a5651c1da9c1119780a6464c79a0daa5e713c88020cc4420ada8f3b`.
Build-generated tracked plugin output was restored to its base after the native
bundle was assembled, keeping unrelated vendored rebuild noise out of this PR.

## Verification

| Check | Actual result |
| --- | --- |
| `npm run check` | Passed: 172 tests, typecheck, build and plugin validation |
| `npm run evals` | Seven product evals passed |
| Native self-test, release driver compile and fresh app build | Passed |
| Focused launcher/priority native scope | Passed: inactive first interaction, rapid close/reopen, micro-movement, edge target, accessibility recovery, stationary row, continuous/edit-mode drag, persisted order and exact click/hold intent |
| Prewarmed / cold / warm opening | 46 / 84 / 88 ms; each below the existing 200 ms budget |
| Independent fullscreen scope | Passed: launcher hit, card on same Space, fullscreen host stays visible, dismissal and Dock reopen |
| Real store / original preferences | Hashes unchanged and preferences restored after each driver scope; no held buttons remained |

The test source uses copied synthetic fixtures, a private TMPDIR, intercepted
Open destinations and unique visual defaults. No provider discovery or live
resume was authorized. Actual driver Accessibility/event preflights passed.

## Review and proof boundaries

Independent code/adversarial review of `9be2935..183bd1f` found no blocking
finding. The focused surface is appropriate proof for the two production edits.
Appearance review checks the launcher backing and selected-row/edit-bar geometry
in light and dark. Its final verdict is recorded in the PR before merge.
Final-head CI records the integrated source checks; these native proofs bind the
unchanged production sources and the frozen test implementation above.

The prior full default/performance attempt failed its later
`verifySearch` / `waitForStableDockHeader` lookup for `Running, 2 active threads`.
This remains **P2, owner: Gajendra engineering**. Next action: reproduce that
complete synthetic journey and diagnose the lazy/offscreen header before
claiming a complete native or release-gauntlet pass. Its earlier failed receipt
is retained. Neither this focused pass nor the fullscreen pass clears that
finding. The system AX tree did not expose the status item in the focused run;
status-item presentation remains separately unverified. Physical VoiceOver,
clean-Mac, signing/notarization and installed-app rollout are outside this source
merge. No installed bundle is overwritten.

## Cleanup and final state

The source and evidence are committed to the existing PR branch. Its exact final
head is preserved remotely before merged local branch cleanup. The synthetic
visual fixture is stopped, original preferences restored and the original app
reopened before completion. GitHub records the final merge SHA and closed state.
Private test receipts remain local; generated fixtures may be retired only after
their source and recovery references are verified.
