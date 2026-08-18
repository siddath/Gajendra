# Gajendra mobile planning pack

**State:** plan_generated

**Product language:** **Gajendra** — **One clear focus across your AI tools.** Its portable
promise is **One NOW. One short queue. One click back to the exact thread.** Queue labels remain
NOW, Focus, Important, and Running.

**E0:** documentation-only protocol/security amendment complete on 2026-08-18; implementation
approval remains absent.

**Prepared:** 2026-08-17

**Repository baseline:** 53e9855e8d19f90bb1d35e7432d5bc514e418f67 on main

**Approval owner:** Sid

This directory is the durable handoff for a future Gajendra mobile implementation. It records the
architecture, evidence requirements, and gates that remain closed until Sid authorizes product
work.

The E0 amendment freezes ownership, pairing/authentication, modern Streamable HTTP request
validation, single-authority store behavior, WebView/native boundaries, platform local-network
permission gates, and sanitized evidence rules. It does not create or authorize any of those
runtime components.

No mobile application, relay, listener, credential, provider setting, dependency, toolchain,
branch, distribution artifact, or user state was created by this planning pass.

## Authority and truth labels

The [master plan](../GAJENDRA_MOBILE_APP_PLAN.md) is the primary decision record. The files here
decompose it without changing its scope.

- plan_generated: written and reviewable, but not approved for implementation.
- approved_for_spike: Sid has approved only the bounded phase-zero spike.
- implementation_in_progress: an approved phase has product changes and current evidence.
- verified: the named gate passed on the named host, device, and build.
- mobile_ready: every required desktop, simulator/emulator, physical-device, security, and
  sanitization gate passed. No earlier state may use this label.

Repository canon and live checks override this snapshot if the repository changes.

## Planning index

| Plan | Decision it enables |
| --- | --- |
| [Master plan](../GAJENDRA_MOBILE_APP_PLAN.md) | Conditional feasibility verdict and full product contract |
| [Architecture and security](ARCHITECTURE_SECURITY_PLAN.md) | Whether a same-LAN relay can preserve the local-first trust boundary |
| [Product and UX parity](PRODUCT_UX_PARITY_PLAN.md) | What portable widget means on phones and what is intentional non-parity |
| [Provider contract](PROVIDER_CONTRACT_PLAN.md) | How each provider remains Mac-owned and what mobile may display or request |
| [Implementation workstreams](IMPLEMENTATION_WORKSTREAM_PLAN.md) | Phase order, dependencies, owners, files, handoffs, and stop conditions |
| [Test and Gauntlet](TEST_GAUNTLET_PLAN.md) | Evidence required before any mobile-ready claim |
| [Toolchain and device readiness](TOOLCHAIN_DEVICE_READINESS_PLAN.md) | Missing/proven build hosts, targets, and physical devices |
| [Decisions, risks, and approvals](DECISIONS_RISKS_APPROVALS.md) | Pending choices, risk owners, approval receipts, and plan amendments |

## Stable recommendation

Use one opt-in, Mac-hosted, same-LAN Gajendra Streamable-HTTP MCP relay. Existing provider adapters,
provider credentials, provider session ownership, and the authoritative priority store stay on the
Mac. The mobile app is a paired projection and mutation client, not another provider integration or
priority authority.

For MCP `2026-07-28`, the plan uses one POST endpoint and per-request metadata with no modern GET
stream or protocol-session dependency. Request-scoped JSON/SSE responses remain a protocol option;
`subscriptions/listen` is not a v1 mobile dependency. HTTP OAuth applies only to the opt-in relay;
the existing stdio path keeps its own credential boundary. Access tokens are header-only and never
appear in query strings.

Run a bounded Capacitor v8 plus native transport-plugin spike first. Stop and return to planning if
the plugin cannot exclusively own pinned networking, device credentials, permissions, secure
storage, accessibility, and native testability. The predeclared fallback is SwiftUI plus Jetpack
Compose over the same mobile-safe contract.

## Resume protocol

When work resumes:

1. Check the current branch, HEAD, worktree, package locks, status documents, and installed
   toolchains. Do not assume this baseline is still current.
2. Read the master plan, the decisions register, and the plan for the next intended phase.
3. Re-run the Sid Harness preparation route. If Gajendra is still absent from its registry, record
   that boundary and use live Gajendra repo canon plus governing standards.
4. Reconfirm requested model/agent availability only if delegation is still requested.
5. Record Sid's exact approval and scope in the decisions register.
6. Create a fresh codex-prefixed implementation branch only after approval.
7. Execute one phase at a time, attach its evidence receipt, and reopen proof invalidated by later
   work.

## Current hard blockers

- No approval exists for a local-network listener; the E0 privacy/protocol amendment is documented
  but D01 remains pending.
- Full Xcode, CoreSimulator, Android Studio, Android SDK, adb, emulator, and Gradle are absent.
- No minimum iOS/Android versions or distribution scope are approved.
- No physical iPhone or Android paired-LAN proof exists.
- The desktop store has source-level revision/CAS/idempotency controls, but no mobile relay writer,
  generation, or physical paired-device proof exists. That remains a D01/D03 spike gate, not a
  mobile write authorization.

Platform interpretation is explicit: Apple local-network access requires the appropriate usage
description and real-device proof; Bonjour service declarations apply when browsing/registering;
Android 17 target SDK 37+ requires the declared/runtime `ACCESS_LOCAL_NETWORK` path while lower
targets must not claim that permission behavior. D05 selects the target; no target is claimed here.

## Planning-pack completion

This planning pack is complete when all linked files exist, link to the same master contract, carry
the plan_generated truth label, name owners and stop conditions, and pass repository documentation
checks. That completion does not authorize implementation.
