# Gajendra release, brand, and mobile execution

- **Date:** 2026-08-18
- **Owner:** repository maintainer
- **Source handoff:** `worksheets/GAJENDRA_RELEASE_BRAND_MOBILE_HANDOFF.md`
- **Baseline:** `53e9855e8d19f90bb1d35e7432d5bc514e418f67` plus the preserved pre-existing dirty tree

## Contract

Implement every reversible local item authorized by the current request, preserve unrelated and
pre-existing work, and prove observable behavior. The work enables the maintainer to decide whether
the source is ready for a separately approved installed-build, signing, notarization, distribution,
and publication pass.

No deadline was supplied. Stop when every local gate below passes or a concrete external-approval or
environment blocker is recorded with its evidence. This worksheet does not authorize commits,
pushes, merges, installation or relaunch, signing credentials, notarization, distribution, a LAN
listener, mobile application code, or LinkedIn publication.

### Later authorization amendment

The later publication request authorizes the exact current app to be installed/relaunched with a
rollback, the coordinated source to be privacy-reviewed, committed, pushed to a public GitHub
branch, and opened as a pull request, and a LinkedIn series to be drafted for approval. It does not
authorize merging the pull request, Developer ID signing, notarization, binary distribution,
changing repository visibility, or publishing/automating LinkedIn activity.

## Material interpretations

- Focus and Important keep their full queues; each card lane renders at most five rows and routes
  overflow to Organizer.
- Codex rollout-tail enrichment remains metadata-only, bounded, documented, and controlled by an
  explicit kill switch.
- Gajendra remains the compatibility identity. Visible product copy uses **Gajendra** with the
  descriptor **One clear focus across your AI tools.**
- The longer product promise is **One NOW. One short queue. One click back to the exact thread.**
- Mobile work is protocol/security/product planning only. No listener or mobile client is built in
  this batch.
- Existing dirty changes are inputs, not disposable scaffolding.

## One-writer lanes

| Lane | Writer | Exclusive scope | Integration dependency |
| --- | --- | --- | --- |
| Server and store | Terra Max | TypeScript contracts, state/store/service/source adapters, server tests, bundled runtime scripts | Lands first |
| Native and release UX | Luna Max | Swift client and views, native tests/previews, validator/CI/docs/mobile plan | Uses landed server contract |
| Integration and release proof | Sol XHigh orchestrator | Cross-lane review, final fixes, evidence, launch image, post draft, full gauntlet | Runs last |

No two agents edit one artifact concurrently. The orchestrator reviews each lane before the next
writer begins.

## Acceptance and evidence matrix

| ID | Acceptance gate | Required proof | State |
| --- | --- | --- | --- |
| A1 | Cross-process updates serialize; revisions are monotonic; stale writes return a typed conflict and fresh snapshot; retries are idempotent; legacy state migrates | Concurrent-process and migration tests | Current candidate local gauntlet and source check proven; external proof pending |
| A2 | One atomic move-before operation handles same-lane reorder, cross-lane move, append, current-thread repair, and context retention | Domain/service and native planner tests plus persisted-state pointer journey | Current candidate local gauntlet/source checks and isolated compact/Organizer pointer mutation proof recorded; manual physical proof pending |
| A3 | Launch at Login changes only after an explicit user action | Native self-test and source validator | Current local gauntlet plus native source/self-test/validator/bundle receipt proven; physical installed proof pending |
| A4 | Codex runtime enrichment is bounded, metadata-only, kill-switchable, and disclosed exactly | Adapter tests, persistence scan, docs | Current candidate local gauntlet, source check, copy scan, and validator boundary proof; installed-provider proof pending |
| A5 | Each source declares allowed deep-link schemes; unsafe or unknown schemes fail at parse and again at execution | Mixed-case, whitespace, encoded, and unknown-scheme tests in TS and Swift/web boundaries | Current local gauntlet plus source/E2E/validator proof; installed proof pending |
| A6 | Unknown thread/source IDs fail closed; store/config reads are bounded; corrupt state is quarantined; last-known-good recovery is private and deterministic | Negative-path and recovery tests | Current candidate local gauntlet and source check proven; external proof pending |
| B1 | Queue Open and edit/move are distinct: a quick row tap remains Open; a stationary hold selects/lifts the task and enables continued full-row drag; compact rows expose no permanent menu/drag handle | Native source/self-test plus real-window click/hold/lift/full-row journey | Current source/build, repeated isolated widget/Organizer pointer proof, and exact-installed automated interaction proof recorded; physical human interaction proof pending |
| B2 | Queue drag remains app-local; no pasteboard payload or canonical thread ID is exported | Source validator, Swift source review, and persisted-state pointer journey | Local no-payload source boundary and isolated cross-lane drag/order proof recorded; manual physical drag proof pending |
| B3 | Undo/redo registers only after success and restores exact order, tier, context, and NOW | Swift success/failure/redo tests | Frozen local native source/self-test proof recorded; physical installed interaction proof pending |
| B4 | Busy and disabled states are visually distinct and announced without trapping controls | Swift state/accessibility tests and preview proof | Frozen local native source/self-test and generated-preview proof recorded; physical accessibility proof pending |
| B5 | Source UI uses Choose/Manage terminology; Done completes onboarding; Not now/close defer it | Native self-tests and docs | Frozen local native source/self-test and companion-validator proof recorded; physical installed proof pending |
| B6 | Keyboard, VoiceOver labels/order, hit targets, contrast, Reduce Motion, light/dark states, and dock expand/shrink have automated proof; installed physical proof is separately gated | Self-test, validator, generated previews; process-level launcher/drag/dock UI; gate list for installed proof | Native source/self-test, validator, previews, repeated isolated tap/drag/dock UI runs, and an exact-installed tap/AX/edge receipt recorded; physical VoiceOver screen-reader/system-toggle/manual-drag proof pending |
| C1 | App bundle carries a pinned, checksum-verified Node LTS runtime and required license notices; the client prefers it while retaining a development override | Build, offline PATH test, bundle inspection, codesign verification | Current local gauntlet/build/validator/readiness receipt proven; independent offline-path and distribution evidence pending |
| C2 | Developer ID/notarization requirements are explicit and mechanically checkable without using credentials | Release script/checklist dry checks; external gate remains open | Local fail-closed tooling syntax proven; Developer ID/notarization/distribution pending |
| C3 | Visible surfaces use Gajendra and the approved descriptor/promise while compatibility identifiers remain stable | Copy matrix validator and bundle/plugin checks | Local documentation/native validator/plugin validation copy proof; distribution aggregate pending |
| D1 | Provider discovery is correct under large catalogs and bounded; native launcher presentation has a measured regression budget | Synthetic-catalog correctness/performance test plus real-window popup metric | Provider bounds, a 200 ms widget popup gate, five repeat runs, and an exact-installed local metric are recorded; provider-scale and cross-machine measurement remain pending |
| D2 | User-visible diagnostics redact paths/content; temporary launch artifacts are owner-private and cleaned on startup/exit | Error-sanitization and file-lifecycle tests | Current local gauntlet and source error-sanitization/file-lifecycle proof recorded; installed/provider and external receipts pending |
| D3 | Status, release, security, compatibility, architecture, and mobile docs describe current source truth without implementation claims for gated work | Documentation reconciliation review | Current documentation/link/copy reconciliation proven; future source changes reopen it |
| D4 | CI runs behavior-level server/native/release validators and rejects missing privacy, identity, or bundle artifacts | Local CI-equivalent command set | Current local gates proven; verified implementation/CI baseline `9e989e9` passed both hosted jobs in [run 32233868042](https://github.com/siddath/Gajendra/actions/runs/32233868042); later implementation revisions require their own hosted receipt |
| D5 | Product language uses Focus consistently and removes retired product/queue copy except explicitly documented compatibility/history | Narrow copy audit | Current narrow copy scan proven; validator retains the sole intentional retired-copy detector |
| E0 | Mobile plan covers transport, auth, pairing, discovery, lifecycle, connectivity, deep-link policy, app-store/privacy, architecture, and test matrix against the current MCP transport/auth contract | Protocol review against primary sources; no listener/client code | Documentation-only amendment proven; D01–D07 and D11 remain pending |
| IMG | Launch media contains no private data, is labeled synthetic, and is generated only after brand/UX gates pass | Actual SwiftUI rendering, deterministic hero composition, image inspection, and exact-path validation | Five real-view screenshots, a screenshot-led hero, and their [generation/privacy receipt](../evidence/launch/README.md) are present; publication approval remains pending |
| POST | LinkedIn drafts are human, specific, evidence-bounded, label gated states, and are not published | Current guidance review and local draft review | [Concise launch draft](GAJENDRA_LINKEDIN_POST_DRAFT.md) names Wednesday 2026-08-19 at 16:00 IST as the first timing experiment; [ten-post series](GAJENDRA_LINKEDIN_SERIES.md) remains optional; owner approval/publication remains pending |

## Verification sequence

1. Run targeted unit and behavior tests after each writer lane.
2. Review the combined diff against this matrix and the repository invariants.
3. Run `npm run check`, `npm run companion:test`, the self-contained companion build, isolated
   real-window launcher UI, and validator, the relevant end-to-end checks, and `npm run gauntlet`.
4. Inspect bundle identity, bundled runtime/license, state privacy, copy matrix, generated previews,
   synthetic launch image, and publication draft.
5. Record separately gated installed-device, signing/notarization, distribution, and publication
   actions without claiming them complete.

## Live evidence boundary

- [PR #12](https://github.com/siddath/Gajendra/pull/12) remains the historical first public-review
  baseline. [PR #16](https://github.com/siddath/Gajendra/pull/16) added the current launch media and
  user guide; [PR #17](https://github.com/siddath/Gajendra/pull/17) merged the compact interactions,
  Ready-for-Review path, and final publication package; [PR #18](https://github.com/siddath/Gajendra/pull/18)
  added portable process-proof and hosted-CI reliability corrections. That verified implementation
  and CI-hardening baseline, `9e989e9`,
  passed both hosted jobs in [run 32233868042](https://github.com/siddath/Gajendra/actions/runs/32233868042).
  PRs #19 and #20 reconciled the public launch evidence; [PR #21](https://github.com/siddath/Gajendra/pull/21)
  merged the explicit Running **All priority lanes** control and public-contribution reconciliation.
  Its pull-request checks and merged-main
  [run 32244790765](https://github.com/siddath/Gajendra/actions/runs/32244790765) passed both jobs.
  This is public source, not a signed or notarized binary release.
- The final server/web source lane recorded focused tests, `npm run check` (**98/98**), and E2E
  (**17/17**) after the Ready-for-Review and exact-open corrections. Those source-lane receipts were
  subsequently incorporated into the passed local gauntlet below.
- The native lane froze with a green build, self-test, preview, and five consecutive fresh-process
  full UI journeys. This lane then ran
  `npm run companion:build`, `node scripts/validate-companion.mjs`, and
  `npm run companion:bundle-readiness` successfully against the frozen source. The validator
  inspected Gajendra identity, macOS 13.5, bundled Node v24.19.0/notices, strict codesign, service
  parity, and an isolated configured-source mutation persisting only `context: design` at revision 1.
- This lane reran `npm run check` successfully (**98 tests**) and ran `npm run test:e2e`
  successfully (**17 tests**). The
  focused suite proves the measured 383,665-byte Codex `thread/list limit=100` response fits the
  new 512 KiB default, while default-plus-one and over-1 MiB frames fail generically without a
  content leak. `npm run probe:live` then observed 8 tools, a reachable Codex app-server, 139
  available threads at that run, and 4 sources without emitting thread content. One earlier aggregate attempt
  timed out a frame-overflow assertion under load; the subsequent focused and full success is
  current local evidence, not a reason to weaken the bound.
- `npm run gauntlet` then produced a passing current-candidate
  [report](../evidence/gauntlet/report.json) on 2026-08-19: all 20 result records passed across
  repository/static/behavior/build/plugin/live-MCP, companion, real-window launcher UI, measured
  widget performance, browser UI, reliability, final-artifact, and dependency-audit checks. This is
  not clean-Mac, physical
  VoiceOver, Developer-ID, notarization, binary distribution, LinkedIn-publication, or mobile proof.
- The exact ad-hoc PR #17 build was installed with the prior app retained as a rollback. Its
  isolated process-level journey passed stationary reopen, 2 px reopen, move/hide recovery, AX
  press, edge target, quick task click, stationary hold, full-row movement, compact and Organizer
  cross-lane drops with exact persisted order, Search filter/clear, and Running/Ready dock controls.
  Its full installed journey
  measured 56 ms prewarmed, 90 ms cold, and 89 ms warm against the 200 ms budget. That build's
  cycle-sensitive performance journey measured 50/86/87 ms with a cycle-free log. The installed
  executable matches the verified build, and the private state hashes plus `0700`/`0600` modes
  stayed unchanged after relaunch. This is still not clean-Mac, manual human drag, physical
  VoiceOver, Developer-ID, notarization, distribution, or publication proof.
- The later PR #21 source candidate passed a fresh 20-receipt gauntlet, including the explicit
  Running control in both native surfaces. Its full source journey measured 64/84/82 ms and the
  widget performance journey measured 59/83/91 ms; it does not reuse the PR #17 installed receipt.
- Earlier historical installed records are not reused as proof for this candidate. The synthetic
  image and post drafts remain creative artifacts, not binary-distribution or LinkedIn-publication
  proof.
- This machine has Swift 6.3.2 and Node 26.3.0; it has no `simctl`, Android SDK, or `adb`. Mobile
  platform execution is not a proof surface for this documentation-only amendment.
