# Test and Gauntlet plan

**State:** plan_generated

**Authority:** [master plan](../GAJENDRA_MOBILE_APP_PLAN.md)

## Proof contract

The mobile Gauntlet is additive. It does not replace, weaken, or silently skip existing desktop
checks. Missing Xcode, SDKs, emulators, devices, provider tooling, permissions, or evidence fails or
blocks the applicable gate.

Receipts distinguish fixture, simulator/emulator, installed-provider, live discovery, Open-on-Mac,
resume, and physical-device proof.

## Gate matrix

| Gate | Required evidence | Failure means |
| --- | --- | --- |
| M01 Contract/projection | Schema, cross-language fixtures, forbidden-field/forward tests | No relay/UI integration |
| M02 Store concurrency | Multi-process stress, revision/CAS/idempotency, invariant properties | No mobile write scope |
| M03 MCP relay | One POST endpoint; 2026-07-28 metadata/header/body agreement; Host/Origin/content-type; no GET/session dependency; request-scoped response handling; body/rate/connection/timeout/cancellation bounds | Relay disabled |
| M04 Pairing/auth/security | Registration/bootstrap, PKCE/state/issuer/resource validation, native callback, device PoP, pinning, expiry, refresh rotation/reuse, replay, device, scope, revoke, certificate rotation, key loss | Spike fails |
| M05 Desktop regression | Existing unit/MCP/build/macOS/web checks | No mobile claim |
| M06 Shared mobile UI | Components, states, search, reorder, theme, accessibility | No platform candidate |
| M07 iOS | Build, unit/UI, `NSLocalNetworkUsageDescription`/Bonjour behavior as applicable, physical-device permission/lifecycle/accessibility; simulator rendering only | iOS blocked |
| M08 Android | Build, lint, unit/instrumented, approved-target local-network permission/lifecycle/accessibility; target SDK 37+ must cover `ACCESS_LOCAL_NETWORK` denial/revocation on a physical device | Android blocked |
| M09 Reliability | Repeated conflict/reconnect/pair/revoke/UI journeys | No candidate |
| M10 Physical devices | One iPhone and Android on approved LAN | No mobile-ready |
| M11 Evidence privacy | Logs/storage/backups/screenshots/reports scan/review | Evidence rejected |
| M12 Final Gauntlet | Additive mobile suite then desktop Gauntlet/dependency audit | No verified label |

## Seven levels

1. Static/architecture: types/schemas, dependencies, no provider/process/filesystem imports in
   mobile, no WebView relay network.
2. Unit/property: projection, auth, pairing, mutation invariants, monotonic revision, idempotency,
   resume resolution, text normalization.
3. Contract: identical fixtures across TypeScript, Swift, Kotlin, stdio MCP, Streamable HTTP.
4. Integration/security: independent processes, pairing/revoke, scopes, restart/reconnect, hostile
   requests.
5. UI/accessibility: desktop web plus mobile screens/states/navigation/reorder/search/themes/fonts,
   motion, keyboard, Back, and overflow.
6. Simulator/emulator and physical devices: platform permission/lifecycle plus real paired LAN.
7. Full-system Gauntlet/human review: repetitions, sanitized receipts, provider labels, dependency
   audit, desktop regression, visual/accessibility review.

## Adversarial matrix

- Malformed current/isCurrent cannot produce two NOW items.
- Duplicate provider IDs cannot collide after namespacing.
- Stale revisions and simultaneous writers cannot silently overwrite.
- Replayed requests cannot apply a second mutation.
- Wrong pin, stolen/replayed/expired QR, wrong device/scope, revoked device, and lost key fail
  closed.
- Missing/mismatched `MCP-Protocol-Version`, `_meta` protocol version, `Mcp-Method`, or
  method-appropriate `Mcp-Name`; invalid Host/Origin; GET/DELETE/session attempts; query-string
  tokens; unsupported method; and malformed request body fail closed.
- Unknown status/context/provider/protocol fields reject or normalize per versioned contract.
- Oversized bodies/sources/titles, markup, bidi/control chars, and floods remain bounded/safe.
- Mobile command, executable, arguments, cwd, URL, or deep link fields reject and never execute.
- Disabled/failing providers produce honest errors and never fabricated Running.
- Mac sleep, parent death, stale relay generation, relay restart, background/foreground, IP/Wi-Fi
  change, permission revoke, and process death preserve store validity and require explicit
  recovery.
- Logs, reports, screenshots, backups, app switcher, and storage reveal no prohibited data.

## Journey matrix

Automate registration/bootstrap, first pairing, pairing denial, expired/replayed QR, callback
state/PKCE/issuer mismatch, proof-of-possession failure, initial snapshot, no/singular NOW,
five-plus queues with Show more, touch/accessible reorder, context change, multi-term search,
source error, disconnect/reconnect, stale conflict refresh, duplicate idempotency, Open-on-Mac
accepted/unsupported/unauthorized, revoke, permission denied/revoked, key loss/re-pair, hostile
text, themes, rotation, compact/standard/tablet, reduced motion, large fonts, and screen reader.

## Planned command interfaces

- npm ci
- npm run check
- npm run mobile:contract
- npm run mobile:security
- npm run companion:test
- npm run companion:build
- npm run companion:validate
- npm run mobile:sync
- platform-native iOS build, unit, and UI tests against a named simulator
- Android unit, lint, assemble, and connected instrumented tests
- npm run mobile:e2e:ios
- npm run mobile:e2e:android
- npm run mobile:gauntlet
- npm run gauntlet
- git diff --check

These are planned interfaces, not current repo capabilities. Actual scripts, target selectors, OS
versions, retries, and timeouts must be pinned from approved current toolchains.

## Reliability

- Repeat core contract, mutation-conflict, pair/revoke, reconnect, and UI smoke enough to expose
  intermittence; record the evidence-based count instead of inventing a universal limit.
- Never retry authorization, redaction, invariant, or evidence-leak failures into a pass.
- A flaky gate fails until its cause and deterministic proof are recorded.
- Dependency, contract, or security changes reopen affected repetition evidence.

## Evidence schema

Sanitized reports include build/commit, platform/tool versions, gate ID, command/journey, timing,
exit status, repetitions, hashes where useful, proof label, and reviewer result.

They exclude thread IDs, titles, prompts, transcripts, provider output, credentials/tokens, device
secrets, private paths, commands, URLs, and private screenshots. Use synthetic fixtures for
shareable evidence.

## Primary protocol/platform references

- [MCP Streamable HTTP 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP authorization 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [Apple TN3179 local-network privacy](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)
- [Apple local-network usage description](https://developer.apple.com/documentation/BundleResources/Information-Property-List/NSLocalNetworkUsageDescription)
- [Android local-network permission](https://developer.android.com/privacy-and-security/local-network-permission)
- [Android 17 behavior changes](https://developer.android.com/about/versions/17/behavior-changes-17)
- [Capacitor v8 documentation](https://capacitorjs.com/docs)

These references establish protocol/platform requirements only. They do not prove that Gajendra's
future relay, callback, permission declarations, device targets, or native plugins exist.

## Claim boundaries

- Responsive browser is not native proof.
- Simulator/emulator is not physical local-network/permission proof.
- Provider fixture is not installed/live proof.
- Open-on-Mac accepted is not provider resume proof.
- Green mobile tests do not replace desktop Gauntlet.
- A verified local build is not merged, distributed, published, or store-ready.
