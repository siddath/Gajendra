# Status

**Candidate:** Gajendra — One clear focus across your AI tools.
**Promise:** One NOW. One short queue. One click back to the exact thread.
**Reconciled:** 2026-08-18
**Baseline:** `53e9855e8d19f90bb1d35e7432d5bc514e418f67`
**Branch:** `codex/gajendra-public-release`
**State:** public source-review candidate; not a binary release declaration.

## Evidence boundary

- Commit, push, pull-request, and hosted-CI state is recorded only after the corresponding receipt
  exists. A public branch is reviewable source, not a merged tag or binary release.
- The exact ad-hoc local build passed a fresh-launch launcher journey after installation: stationary
  reopen, 2 px reopen, move/hide recovery, accessibility press, and edge target. The private state
  hash and `0700`/`0600` modes were unchanged. This narrow receipt does not prove a clean Mac,
  physical VoiceOver, login-item behavior, drag behavior, or every installed journey.
- No Developer ID signature, notarization, stapled ticket, Gatekeeper result, downloadable binary,
  or LinkedIn publication is claimed. The source repository itself is public.

## Source contracts in the candidate

| Area | Current source-level state | Still required before release language |
| --- | --- | --- |
| State integrity (A1/A6) | Revision/CAS/idempotency, lock ownership, bounded reads, quarantine/LKG recovery, and `GAJENDRA_DATA_DIR` isolation have current local TypeScript and local-gauntlet coverage. | External/installed receipts. |
| Atomic queue move (A2) | `move-before` is a single idempotent, all-or-nothing store mutation with current local fault/replay and local-gauntlet coverage. | Physical/installed receipts. |
| Login choice (A3) | The frozen native source is explicit-user-action only; self-test, build, validator, and local bundle-readiness receipts exist. | Physical installed/login-item proof. |
| Codex enrichment (A4) | Bounded, kill-switchable, metadata-only source behavior has hostile-tail/persistence coverage, validator boundary proof, and local-gauntlet coverage. | Installed-provider receipts. |
| Safe navigation (A5) | Source-specific scheme validation occurs on ingest and opening; hostile URL cases have local source/web coverage. | Physical installed/native interaction proof. |
| Bounded discovery (D1) | Source collection and app-server enrichment have row/page/byte/concurrency/deadline bounds with local focused and local-gauntlet coverage. | Installed/provider receipts and any later external measurement. |
| Ready for Review | The configured-catalog path now validates a live-only explicit review signal; native/web disclosures, Running precedence, Task/Review routes, priority overlap, search, previews, and non-persistence have local coverage. | Any remote-provider credential/network adapter and physical installed interaction/accessibility proof. |
| Native interaction and accessibility (B1–B6) | Native source, self-test, generated previews, companion validator, isolated real-window UI automation, and an exact-installed launcher receipt cover the tap/AX/edge route. | Physical drag, keyboard, VoiceOver screen-reader, contrast/system-toggle, and login-item receipts. |
| Diagnostics (D2) | Local error-sanitization and temporary-artifact lifecycle coverage is recorded. | Installed/provider and external receipts. |
| Bundle contract (C1) | A local bundle was built and inspected for macOS 13.5, checksum-verified Node v24.19.0, notices, service parity, and strict code signature verification. | Independent offline-path, Developer ID, and distribution receipts. |
| Distribution (C2) | Local readiness tooling is fail-closed and distinguishes ad-hoc signing. | Explicit Developer ID/team, Gatekeeper, notarization/staple, archive, and checksum receipts. |

## Current open gates

- Preserve the TypeScript/E2E, native self-test, process-level launcher UI, companion
  build/validator, and local bundle-readiness receipts; rerun them if their inputs change.
- Preserve the passed integrated local gauntlet receipt and rerun it if its inputs change.
  The privacy-reviewed synthetic launch image and evidence-bounded local post draft now exist;
  Sid's image/text approval, timing decision, and publication authorization remain pending.
- Keep mobile at documentation-only E0. D01–D07 and D11 remain pending; no relay, listener,
  mobile app, credential, dependency, branch, signing, distribution, or app-store action exists.
- Obtain separate authorization and proof for the remaining clean-Mac, physical accessibility,
  Developer ID, notarization, binary distribution, merge, LinkedIn publication, or external gates.

See [the execution worksheet](worksheets/2026-08-18-gajendra-release-brand-mobile-execution.md)
for gate-by-gate evidence and [the release checklist](docs/RELEASE_CHECKLIST.md) for the pending
procedure.

## Current local receipts

On 2026-08-18, `npm run check` passed **83/83** tests, `npm run test:e2e` passed **17/17**, and
`npm run companion:test`, `npm run companion:build`, `npm run companion:ui-test`,
`npm run companion:validate`, and `npm run companion:bundle-readiness` passed. The UI journey
passed three consecutive isolated runs and once against the freshly launched installed candidate.
The isolated `npm run probe:live` observed 8 tools, a
reachable Codex app-server, 137 available threads at that run, and 4 source records without
outputting thread content. The [local gauntlet report](evidence/gauntlet/report.json) passed with 19 result records.
These receipts are candidate evidence only and do not close any external gate above.
