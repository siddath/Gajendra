# Decisions, risks, and approvals

**State:** plan_generated

**Authority:** [master plan](../GAJENDRA_MOBILE_APP_PLAN.md)

**E0 amendment status:** complete as documentation-only on 2026-08-18. This records protocol and
security invariants; it does not approve a listener, mobile app, OAuth server, dependency, target,
credential, build, install, signing, distribution, merge, or publication.

This is the human gate for future work. Recommendations are not approvals. The repository owner owns product,
trust, and distribution choices unless a later record explicitly delegates them.

## Decision register

| ID | Decision | Recommendation | State | Needed before |
| --- | --- | --- | --- | --- |
| D01 | Same-LAN Mac-hosted opt-in relay and privacy/security amendment | Approve bounded v1 spike | Pending the repository owner | Listener code/enablement |
| D02 | Open on Mac as only v1 resume behavior | Approve | Pending the repository owner | Resume integration |
| D03 | Capacitor v8 plus native transport-plugin spike | Approve with kill gate | Pending the repository owner | Mobile shell/dependencies |
| D04 | SwiftUI plus Compose fallback | Defer unless D03 fails; re-estimate/reapprove | Conditional | Native fallback |
| D05 | Minimum/current iOS and Android targets | Select from current evidence | Pending the repository owner | Project generation/CI |
| D06 | v1 distribution scope | Local/internal physical proof first | Pending the repository owner | Signing/distribution |
| D07 | Physical devices and approved LAN | Confirm iPhone, Android, safe LAN | Pending the repository owner | Physical gate |
| D08 | Cloud/out-of-home access | Reject for v1; separate plan | Rejected for proposed v1 | Public/cloud path |
| D09 | Mobile source enablement/provider credentials | Reject for v1 | Rejected for proposed v1 | Provider config |
| D10 | Offline snapshot/notifications/background/widgets | Defer; separate decision | Deferred | Related work |
| D11 | Merge/release/publication/app stores | Exact later approval | Out of scope | Consequential action |

## Approval receipt template

Append for every approved decision:

- decision ID and exact approved option;
- approver and timestamp;
- baseline commit/branch;
- allowed phase, files/systems, providers, hosts/devices, and test data;
- explicitly excluded actions;
- expiry or reconsideration trigger;
- named stop/kill criteria;
- evidence reviewed.

Do not infer one approval from another. D01-D03 approval permits only the bounded spike unless the
receipt explicitly says more.

## E0 amendment receipt (not an approval)

The retained planning pack now names all ten handoff areas against the official MCP `2026-07-28`,
Apple local-network privacy, Android local-network permission, Android 17 target-SDK 37 behavior,
and Capacitor v8 documentation:

1. Mac foreground component owns the protected relay and local authorization lifecycle; no cloud,
   public authorization server, daemon, or background writer.
2. QR/manual bootstrap carries only endpoint/resource URI, instance, fingerprint, auth-metadata
   location, and one-use nonce; device key is generated in Keychain/Keystore; Mac matching-code
   approval is required.
3. Native plugin owns registration, claimed callback/private-use callback policy, PKCE/state/issuer/
   resource validation, and device proof-of-possession; WebView navigation cannot complete auth.
4. Access/refresh credentials are resource/audience-bound, header-only, securely stored, rotated
   when supported, reuse-revoked, and immediately revocable; lifetimes remain configurable/pending.
5. Certificate/SPKI changes fail closed and require authenticated Mac rotation plus fresh re-pair;
   no silent trust or invented overlap window.
6. mDNS is discovery-only; IP/Wi-Fi/interface/sleep/wake transitions produce explicit disconnected
   and foreground-reconnect/re-pair behavior; no hard-coded `en0`, wildcard bind, or trust by name.
7. One HTTPS POST MCP endpoint validates Host, Origin, protocol-version/header/body metadata,
   content type, body, auth, rate, connection, and timeout; modern GET/session dependency is absent.
8. One serialized store remains authoritative; monotonic revision/CAS/idempotency and a current
   relay generation reject stale writers.
9. WebView CSP/navigation/external-link rules and a native-only relay bridge are required; direct
   WebView networking is forbidden.
10. Typed sanitized errors/logs, no mobile snapshot persistence, secure-storage backup exclusion,
    neutral app-switcher/background surfaces, and synthetic-only evidence are required.

These are design constraints, not accepted implementation claims. D01-D07 and D11 remain pending
or out of scope exactly as listed above. Exact token lifetimes, endpoint/callback forms, PoP
envelope, bounds, OS floors, devices/LAN, distribution, and fallback remain approval-gated or
implementation-spike questions.

**Primary references refreshed:**

- [MCP Streamable HTTP 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP authorization 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [Apple TN3179 local-network privacy](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)
- [Apple local-network usage description](https://developer.apple.com/documentation/BundleResources/Information-Property-List/NSLocalNetworkUsageDescription)
- [Android local-network permission](https://developer.android.com/privacy-and-security/local-network-permission)
- [Android 17 behavior changes](https://developer.android.com/about/versions/17/behavior-changes-17)
- [Capacitor v8 documentation](https://capacitorjs.com/docs)

## Risk register

| ID | Risk | Severity | Mitigation/gate | Owner |
| --- | --- | --- | --- | --- |
| R01 | Projection leaks command/path/provider data | Critical | Allow-list DTO, schema, redaction, fuzz/evidence scan | Security |
| R02 | Mac/MCP/mobile writes silently overwrite | Critical | Lock, revision/CAS, idempotency before mobile write | Server |
| R03 | LAN listener expands trust boundary | Critical | Off by default, app-owned, approval, pinning/auth review | Owner/security |
| R04 | Client Open route enables execution | Critical | Canonical ID only, trusted resolver, injection tests | Security/integration |
| R05 | WebView bypasses native controls | High | Native-only architecture test; Capacitor kill gate | Mobile |
| R06 | Credentials/snapshots persist on phone | High | Secure credentials only, no cache, inspections | Mobile/security |
| R07 | TypeScript/Swift/Kotlin contract drift | High | One schema/fixture corpus | All/Sol |
| R08 | Provider capability overstated | High | Fixture/live/Open/resume labels per provider | Integration |
| R09 | Simulator substitutes for physical proof | High | Mandatory iPhone/Android UAT | Sol |
| R10 | Capacitor fails accessibility/lifecycle | High | Bounded spike and native fallback | Mobile/owner |
| R11 | SDK migration breaks stdio/MCP App | High | Isolated relay and regression gates | Server/integration |
| R12 | Missing/incompatible toolchains | High | Fail-closed readiness; pin JDK/SDK/Xcode | Integration |
| R13 | Private evidence enters reports | High | Synthetic fixtures and sanitization review | All |
| R14 | Scope grows to cloud/widgets/stores | Medium | Explicit non-goals and separate approvals | Owner/orchestrator |
| R15 | Existing doc drift counts as mobile progress | Medium | Truth-heal only in final docs phase | Docs owner |

## Historical truth-drift record (resolved)

- Earlier `docs/HOST_VALIDATION.md` hover wording and `STATUS.md`/implementation-plan gauntlet
  wording conflicted across historical snapshots.
- The current canon was reconciled as a documentation-only correction. Those snapshots are not
  current behavior, release evidence, or mobile implementation evidence; future source changes
  reopen the relevant documentation review.

## Amendment rules

- Recheck repo and primary protocol/platform docs before acting.
- Record new/contradictory evidence with date, source, affected decisions, and reopened gates.
- Material architecture, security, provider, OS, distribution, or privacy change returns the
  affected phase to plan_generated and requires approval.
- Reject duplicate concerns without new evidence, but never skip a required gate.
- Stop when the approved contract is proven or a named kill criterion is met.

## Current approval status

No implementation approval is recorded. At resumption, refresh repo/toolchain truth and ask the repository owner to
decide D01-D07. Until then, no relay exists, no product dependencies or branches are created, and
this remains a retained planning artifact.
