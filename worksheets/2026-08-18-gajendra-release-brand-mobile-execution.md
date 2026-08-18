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
| A2 | One atomic move-before operation handles same-lane reorder, cross-lane move, append, current-thread repair, and context retention | Domain/service tests plus native planner tests | Current candidate local gauntlet and source check proven; physical queue-mutation proof pending |
| A3 | Launch at Login changes only after an explicit user action | Native self-test and source validator | Current local gauntlet plus native source/self-test/validator/bundle receipt proven; physical installed proof pending |
| A4 | Codex runtime enrichment is bounded, metadata-only, kill-switchable, and disclosed exactly | Adapter tests, persistence scan, docs | Current candidate local gauntlet, source check, copy scan, and validator boundary proof; installed-provider proof pending |
| A5 | Each source declares allowed deep-link schemes; unsafe or unknown schemes fail at parse and again at execution | Mixed-case, whitespace, encoded, and unknown-scheme tests in TS and Swift/web boundaries | Current local gauntlet plus source/E2E/validator proof; installed proof pending |
| A6 | Unknown thread/source IDs fail closed; store/config reads are bounded; corrupt state is quarantined; last-known-good recovery is private and deterministic | Negative-path and recovery tests | Current candidate local gauntlet and source check proven; external proof pending |
| B1 | Hold-to-edit cancels after movement beyond threshold and never fires after cancellation | Deterministic Swift gesture-state tests | Frozen local native source/self-test proof recorded; physical installed interaction proof pending |
| B2 | Drag payload is process-private and opaque; canonical IDs are never exported | Source validator and Swift tests | Frozen local native source/self-test and validator proof recorded; physical installed drag proof pending |
| B3 | Undo/redo registers only after success and restores exact order, tier, context, and NOW | Swift success/failure/redo tests | Frozen local native source/self-test proof recorded; physical installed interaction proof pending |
| B4 | Busy and disabled states are visually distinct and announced without trapping controls | Swift state/accessibility tests and preview proof | Frozen local native source/self-test and generated-preview proof recorded; physical accessibility proof pending |
| B5 | Source UI uses Choose/Manage terminology; Done completes onboarding; Not now/close defer it | Native self-tests and docs | Frozen local native source/self-test and companion-validator proof recorded; physical installed proof pending |
| B6 | Keyboard, VoiceOver labels/order, hit targets, contrast, Reduce Motion, and light/dark states have automated proof; installed physical proof is separately gated | Self-test, validator, generated previews; process-level launcher UI; gate list for installed proof | Native source/self-test, validator, previews, three isolated UI runs, and an exact-installed tap/AX/edge receipt recorded; physical VoiceOver screen-reader/system-toggle proof pending |
| C1 | App bundle carries a pinned, checksum-verified Node LTS runtime and required license notices; the client prefers it while retaining a development override | Build, offline PATH test, bundle inspection, codesign verification | Current local gauntlet/build/validator/readiness receipt proven; independent offline-path and distribution evidence pending |
| C2 | Developer ID/notarization requirements are explicit and mechanically checkable without using credentials | Release script/checklist dry checks; external gate remains open | Local fail-closed tooling syntax proven; Developer ID/notarization/distribution pending |
| C3 | Visible surfaces use Gajendra and the approved descriptor/promise while compatibility identifiers remain stable | Copy matrix validator and bundle/plugin checks | Local documentation/native validator/plugin validation copy proof; distribution aggregate pending |
| D1 | Provider discovery is correct under large catalogs and has measured, bounded behavior | Synthetic-catalog correctness/performance test | Current candidate local gauntlet and source check proven; installed/provider and later external measurement pending |
| D2 | User-visible diagnostics redact paths/content; temporary launch artifacts are owner-private and cleaned on startup/exit | Error-sanitization and file-lifecycle tests | Current local gauntlet and source error-sanitization/file-lifecycle proof recorded; installed/provider and external receipts pending |
| D3 | Status, release, security, compatibility, architecture, and mobile docs describe current source truth without implementation claims for gated work | Documentation reconciliation review | Current documentation/link/copy reconciliation proven; future source changes reopen it |
| D4 | CI runs behavior-level server/native/release validators and rejects missing privacy, identity, or bundle artifacts | Local CI-equivalent command set | Current local gauntlet/check/companion validator/bundle-readiness proven; hosted-CI receipt pending |
| D5 | Product language uses Focus consistently and removes retired product/queue copy except explicitly documented compatibility/history | Narrow copy audit | Current narrow copy scan proven; validator retains the sole intentional retired-copy detector |
| E0 | Mobile plan covers transport, auth, pairing, discovery, lifecycle, connectivity, deep-link policy, app-store/privacy, architecture, and test matrix against the current MCP transport/auth contract | Protocol review against primary sources; no listener/client code | Documentation-only amendment proven; D01–D07 and D11 remain pending |
| IMG | Synthetic launch image contains no private data, is labeled synthetic, and is generated only after brand/UX gates pass | Image inspection and exact-path artifact | Local artifact and [generation/privacy receipt](../evidence/launch/README.md) proven; publication approval pending |
| POST | LinkedIn draft is human, specific, evidence-bounded, labels prototype/gated states, and is not published | Local draft review | [Local draft](GAJENDRA_LINKEDIN_POST_DRAFT.md) reviewed for claim, privacy, brand, spelling, and synthetic-image disclosure; Sid approval/publication pending |

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

- The current candidate is prepared on `codex/gajendra-public-release` from baseline `53e9855`.
  Commit, push, pull-request, and hosted-CI receipts are added only after they exist; it is not a
  binary release artifact.
- The server/web source lane recorded focused tests, `npm run check` (**80/80**), and E2E
  (**16/16**) after the final cap/canon correction. Those source-lane receipts were subsequently
  incorporated into the passed local gauntlet below.
- Luna reported frozen native source with a green build, self-test, and preview. This lane then ran
  `npm run companion:build`, `node scripts/validate-companion.mjs`, and
  `npm run companion:bundle-readiness` successfully against the frozen source. The validator
  inspected Gajendra identity, macOS 13.5, bundled Node v24.19.0/notices, strict codesign, service
  parity, and an isolated configured-source mutation persisting only `context: design` at revision 1.
- This lane reran `npm run check` successfully (**80 tests**), ran the Codex app-server focused
  suite successfully (**17 tests**), and ran `npm run test:e2e` successfully (**16 tests**). The
  focused suite proves the measured 383,665-byte Codex `thread/list limit=100` response fits the
  new 512 KiB default, while default-plus-one and over-1 MiB frames fail generically without a
  content leak. `npm run probe:live` then observed 8 tools, a reachable Codex app-server, 137
  available threads at that run, and 4 sources without emitting thread content. One earlier aggregate attempt
  timed out a frame-overflow assertion under load; the subsequent focused and full success is
  current local evidence, not a reason to weaken the bound.
- `npm run gauntlet` then produced a passing current-candidate
  [report](../evidence/gauntlet/report.json) on 2026-08-18: all 19 result records passed across
  repository/static/behavior/build/plugin/live-MCP, companion, real-window launcher UI, browser UI,
  reliability, final-artifact, and dependency-audit checks. This is not clean-Mac, physical
  VoiceOver, Developer-ID, notarization, binary distribution, LinkedIn-publication, or mobile proof.
- The exact ad-hoc build was installed with the prior app retained as a rollback. A fresh-launch
  process-level journey passed stationary reopen, 2 px reopen, move/hide recovery, AX press, and
  edge target; executable/service parity passed and the private state hash plus `0700`/`0600` modes
  stayed unchanged. This is a launcher-only installed receipt.
- Earlier hosted-CI and historical installed records are not reused as proof for this candidate.
  The synthetic image and post drafts remain creative artifacts, not binary-distribution or
  LinkedIn-publication proof.
- This machine has Swift 6.3.2 and Node 26.3.0; it has no `simctl`, Android SDK, or `adb`. Mobile
  platform execution is not a proof surface for this documentation-only amendment.
