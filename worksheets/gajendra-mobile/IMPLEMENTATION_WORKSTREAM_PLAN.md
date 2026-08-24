# Implementation workstream plan

**State:** plan_generated

**Authority:** [master plan](../GAJENDRA_MOBILE_APP_PLAN.md)

## Governance

No product work begins until the repository owner records approval in
[the decision register](DECISIONS_RISKS_APPROVALS.md). Spike approval does not approve later
phases, signing, distribution, publication, merge, provider-account changes, or public exposure.

Each phase is a separate typed lifecycle instance with one writer per artifact, focused review,
current evidence, and a stop/go decision. Later changes reopen proof they can invalidate.

## State flow

| State | Entry | Exit |
| --- | --- | --- |
| plan_generated | This pack exists and checks pass | Repository owner approves a bounded next phase |
| approved_for_spike | Scope, trust boundary, hosts, and kill criteria recorded | Spike passes or returns to plan_generated |
| implementation_in_progress | Prior evidence accepted | Phase exit criteria pass |
| gauntlet_candidate | All implementation phases complete | Full desktop/mobile/device proof |
| verified | Named build/evidence pass | Reversible adoption trial separately approved |
| mobile_ready | All required proof remains current | No publication implication |

## Phase 0 — approval and host readiness

- Reconcile current repo truth and dependency standards.
- Review the completed E0 documentation-only amendment and record any changed evidence before
  implementation. E0 completion does not enable a listener or grant D01/D03/D05/D07 authority.
- Approve same-LAN scope, Open on Mac, Capacitor spike, OS floors, distribution target, device/LAN
  access, and security amendment.
- Install/select approved build hosts only after approval.
- Capture tool versions and sanitized readiness receipt.

Exit: required decisions have recorded owners/answers and platform build paths fail closed when
prerequisites are missing.

## Phase 1 — contract and concurrency

- Add versioned mobile-safe schemas and allow-list projection.
- Add canonical cross-language fixtures.
- Add owner-private serialized store mutation, monotonic revision, CAS, and idempotency.
- Route all existing writers through the same mutation implementation.
- Add redaction, invariant, concurrency, and migration tests before relay access.

Exit: independent-writer stress shows no lost update; stdio/MCP App/macOS stay green; no prohibited
field crosses the projection.

## Phase 2 — relay/auth/native-transport spike

- Add opt-in app-owned Streamable-HTTP relay and strict request validation. Modern
  `2026-07-28` uses one POST endpoint, per-request metadata, no GET stream dependency, and no
  protocol session ID; request-scoped SSE is optional and `subscriptions/listen` is outside v1.
- Implement exact Host/Origin, `MCP-Protocol-Version`, `_meta` agreement, `Mcp-Method`,
  method-appropriate `Mcp-Name`, content type, body, auth, connection, rate, timeout, and
  cancellation checks. Tokens are Authorization-header-only and resource/audience-bound.
- Add pairing, device-bound credentials, scopes, revoke, rotation, and key-loss behavior.
- Add registration/bootstrap, native callback/PKCE/issuer/resource validation, device
  proof-of-possession, token reuse detection, and lost-device behavior. TTLs, callback form, PoP
  envelope, and bounds must be selected from spike evidence rather than invented.
- Implement minimum Swift/Kotlin native transport plugins.
- Prove no direct WebView networking, insecure storage, or metadata persistence.
- Run the Capacitor pass/kill matrix.

Exit: full spike gate passes on both platforms, or work stops with evidence and a separately
estimated native fallback.

## Phase 3 — Mac lifecycle and Open on Mac

- Add explicit relay enable/disable and paired-device management to the Mac app.
- Tie relay termination to the owning app lifecycle.
- Add canonical-ID-only Open-on-Mac coordinator.
- Cover revoke, sleep/wake, relay restart, and provider capability UX.

Exit: unauthorized/client-controlled execution fails closed; each provider has a truthful proof
label.

## Phase 4 — portable shared UI

- Extract a DeckGateway boundary so MCP-host and mobile paths share view behavior without sharing
  trust.
- Build Pairing, Focus, Organizer, Search, Connection, Settings, and failure states.
- Implement touch/accessibility ordering, themes, source health, and Open-on-Mac copy.
- Preserve existing web/MCP behavior and tests.

Exit: parity matrix and responsive/accessibility journeys pass with synthetic fixtures.

## Phase 5 — iOS and Android integration

- Complete iOS `NSLocalNetworkUsageDescription`/Bonjour declarations as applicable, Keychain,
  lifecycle, safe-area, VoiceOver, Dynamic Type, reduced-motion, simulator, and physical-device
  journeys. Simulator rendering cannot stand in for local-network privacy proof.
- Complete Android local-network permission for the approved target, Keystore, lifecycle, Back,
  edge-to-edge, TalkBack, font scaling, emulator, and physical-device journeys. If D05 selects
  target SDK 37+ (Android 17), declare/request `ACCESS_LOCAL_NETWORK` and prove denial/revocation;
  do not add/request it for a target SDK 36 or lower.
- Prove foreground reconnect, permission revoke, credential loss, and re-pair.

Exit: both physical devices pass same-LAN UAT; simulator/emulator evidence is not substituted.

## Phase 6 — full Gauntlet, docs, adoption handoff

- Run additive mobile gates, then unchanged desktop Gauntlet.
- Run adversarial security, reliability repetition, evidence sanitization, dependency, and
  architecture checks.
- Reconcile README, architecture, security, compatibility, Gauntlet, release checklist, status,
  and pre-existing drift only to proven truth.
- Prepare reversible adoption-trial decision; do not distribute without separate authority.

Exit: named build is verified, receipts sanitized, blockers explicit, and the repository owner decides on trial.

## Single-writer ownership

| Lane | Planned owner | Primary artifacts |
| --- | --- | --- |
| Security/server | Terra max | Contracts/projection, relay/auth/credentials, store/service concurrency, server tests, security docs |
| Mobile UI/platform | Luna max | DeckGateway, Capacitor shell, Swift/Kotlin plugins, iOS/Android UI/tests, mobile docs |
| Integration/review | Sol high | Mac lifecycle/pairing, Open on Mac, manifests/locks, CI, Gauntlet scripts, final docs/evidence |
| E0 planning amendment | Luna max, sole writer for this pack | Master E0 contract and the linked planning-pack protocol/security, decision, workstream, test, readiness, and index updates; no runtime files |
| Approval | Repository owner | Trust boundary, scope, OS targets, distribution, devices, fallback, merge/publication |

These assignments record the requested harness method and verified model usability. Reconfirm them
when implementation resumes. Exact file ownership is frozen before writers start; no file has
concurrent writers.

## Dependency order

1. Current canon and human approval.
2. Contract/projection and serialized store.
3. Relay/auth and native transport spike.
4. Mac lifecycle and Open on Mac.
5. Shared UI over frozen contract.
6. Platform integration and physical devices.
7. Full Gauntlet, docs, and adoption decision.

UI may build fixture-backed components in parallel, but cannot bind to an unfrozen live contract or
claim integration. Security/shared contracts land before live mobile consumers.

## Planned ownership by artifact

Server/security proposes mobile contracts/projection/auth/credentials/relay/resume routing plus
store/service changes and their tests. Mobile proposes the UI gateway, Capacitor shell, native
transport plugins, platform projects, mobile tests, and mobile compatibility docs. Integration
proposes the Mac relay controller/pairing UI, workspace manifests, CI, validation/Gauntlet scripts,
sanitized evidence schema, and final status/release docs. The phase task must replace these
categories with exact paths after current repo reconciliation.

## Handoff receipt

Each phase records baseline/final commit, changed files, decisions applied, commands/exit codes,
tests/repetitions, evidence paths, sanitized tool versions, fixture/live proof limits, reopened
risks, and exact next approval. A reviewer can reproduce it without private metadata.

## Branch/change discipline

- Refresh current main and use a codex-prefixed branch after approval.
- Preserve unrelated/dirty work and inspect generated changes.
- Keep contract/security, UI, and integration ownership disjoint.
- Use focused lifecycle PRs, not one unverifiable mobile mega-pass.
- Do not merge, sign, distribute, publish, enable a listener, or change providers without exact
  authority.

## Program stop conditions

Return to planning if a phase requires a second store, public/cloud relay, phone provider
credential, raw provider file, untyped command execution, weakened accessibility, skipped physical
device, unsanitized evidence, unapproved OS/distribution target, or failed Capacitor kill criterion.
