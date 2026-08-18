# Architecture and security plan

**State:** plan_generated

**E0 status:** documentation-only amendment complete on 2026-08-18; no implementation authority.

**Authority:** [master plan](../GAJENDRA_MOBILE_APP_PLAN.md)

## Contract

Enable a phone to view and mutate Gajendra priorities without moving provider credentials,
provider discovery, provider session ownership, command execution, or the authoritative store off
the Mac.

Sid owns approval of the new trust boundary. Stop if it requires a public relay, a second priority
store, mobile provider credentials, raw provider files, shell input from a phone, or weakened
transport security.

## Non-negotiable boundaries

- Keep the existing stdio MCP and inline MCP App operational.
- Add one Gajendra relay, not one MCP server per provider.
- Keep the relay off by default and owned by the foreground Mac application lifecycle.
- Bind only to an explicitly configured same-LAN interface; no public Internet or cloud relay in v1.
- Keep source enablement and provider access Mac-only.
- Accept only typed operations and canonical thread IDs from phones.
- Never return resume commands, executables, arguments, absolute paths, working directories, raw
  provider output, arbitrary URLs, credentials, prompts, transcripts, or session files.
- Do not persist a thread snapshot on the phone in v1.
- Treat MCP authorization as one layer alongside server identity pinning, device binding, secure
  storage, and per-operation authorization.

## Component responsibilities

| Component | Owns | Must not own |
| --- | --- | --- |
| Mobile shared UI | Rendering, navigation, input, accessibility states | Network sockets, credentials, provider adapters, snapshot cache |
| Native Swift/Kotlin plugin | Pinned transport, Keychain/Keystore, pairing, permissions | Provider logic, priority semantics, arbitrary WebView requests |
| Mac relay | MCP transport, auth enforcement, projection, bounds | Provider secrets in responses, public exposure |
| Gajendra service | Snapshot/mutation rules and invariants | Mobile-specific rendering |
| Provider registry | Existing bounded provider discovery | Mobile access or credential export |
| Priority store v2 | Serialized authoritative mutation and revision | Provider content or a second replica |
| Open-on-Mac coordinator | Resolve canonical ID to trusted current destination | Client command, URL, executable, argument, or cwd |

## Transport profile

The relay targets the MCP Streamable-HTTP and authorization revisions selected in the master plan.
The current official `2026-07-28` transport defines one MCP endpoint that accepts POST, one
JSON-RPC request/notification per POST, and JSON or request-scoped SSE responses. It removes the
GET stream endpoint and protocol-level sessions. A long-lived `subscriptions/listen` response stream
is not a v1 mobile dependency. The existing stdio/MCP App path is a separate compatibility surface.

Required controls:

- TLS with certificate or SPKI pinning established by pairing; no cleartext fallback.
- One configured same-LAN interface and one endpoint (recommended `/mcp`); never bind a wildcard
  address or treat an IP, mDNS name, or `.local` name as trust.
- Validate exact Host, allowed Origin, TLS, `Content-Type: application/json`,
  `Accept: application/json, text/event-stream`, `MCP-Protocol-Version: 2026-07-28`,
  `_meta.io.modelcontextprotocol/protocolVersion`, `Mcp-Method`, and method-appropriate
  `Mcp-Name`. Header/body mismatch is a 400 `HeaderMismatch`; unauthorized/insufficient scope is
  401/403; unsupported method is 404. GET, DELETE, `Mcp-Session-Id`, and `Last-Event-ID` are not
  modern mobile protocol dependencies.
- Resource-bound and device-bound credentials with per-tool scope checks. Send access tokens only
  in `Authorization: Bearer`; never in query strings, QR data, logs, screenshots, or provider
  requests. Do not assume refresh-token issuance.
- Native transport owns the authorization flow, PKCE/state/issuer/resource validation, callback
  allow-list, secure storage, pinning, and device proof-of-possession. WebView code cannot call the
  relay directly.
- Bounded body size, request rate, connection count, source count, and operation timeout. Values are
  configurable/pending until the approved spike supplies dependency or measured limits.
- Fail closed on wrong pin, expired/replayed pairing material, invalid authorization data, lost
  device key, unsupported protocol version, invalid Host/Origin, or stale relay writer.

## E0 ten-area freeze

The master plan is authoritative for the complete amendment. This section records the architecture
ownership and proof boundary so implementation cannot silently fill the gaps:

1. **Authorization server and lifecycle.** The foreground Gajendra Mac component owns the local
   protected resource and authorization boundary. It starts only after explicit Mobile Relay
   enablement and stops with the app; no cloud/public authorization server, daemon, LaunchAgent,
   background service, or second writer is in scope. The OAuth library, metadata paths, signing-key
   store, and token lifetimes remain pending implementation evidence.
2. **Registration/bootstrap/pairing.** QR/manual bootstrap carries only endpoint/resource URI,
   relay instance, certificate/SPKI fingerprint, authorization metadata location, and a single-use
   nonce. The device key is generated in Keychain/Keystore; the user sees a matching code and must
   approve the device on the Mac. First-party pre-registration is the default; Client ID Metadata
   Documents and DCR remain compatibility options, with exact registration material pending the
   spike.
3. **Redirect/callback/PoP.** The native plugin owns the callback through a claimed platform
   callback or explicitly approved private-use callback; WebView navigation and arbitrary deep links
   are rejected. It validates state, PKCE verifier, recorded issuer, and canonical resource before
   exchanging a code. The paired public key is bound to authorization and required for a
   per-request proof-of-possession; exact signature/mTLS envelope is pending the security spike.
4. **Credential lifecycle.** Access tokens are audience/resource-bound and header-only. Refresh
   tokens, if issued, remain in secure storage and rotate when supported; reuse revokes the token
   family/device. Mac revoke blocks the device; lost-device recovery requires revoke and fresh
   pairing. No offline access/background refresh is assumed. Lifetimes and replay windows are
   configurable/pending, never invented.
5. **Certificate/SPKI rotation.** A changed pin fails closed. Planned rotation requires an
   authenticated Mac action and fresh QR/matching-code re-pair; no silent trust on a new key or IP.
   v1 does not assume an overlap window.
6. **Network transitions.** QR is the trust bootstrap; mDNS is optional discovery only. Do not
   hard-code `en0`, bind `0.0.0.0`, or infer trust from a name. IP/Wi-Fi/interface change produces
   a disconnected state and foreground re-resolution/manual re-pair. Sleep, app termination, or
   interface loss closes the relay writer; wake re-reads the authoritative store. Retry/backoff and
   service TTLs are configurable/pending.
7. **Listener contract.** One configured HTTPS POST endpoint; no modern GET/session dependency.
   Validate Host, Origin, protocol-version/header/body agreement, request metadata, content type,
   body, auth, connection count, rate, and timeout. The MCP revision's request-scoped SSE is
   optional; `subscriptions/listen` is later scope.
8. **Single authority.** All writers use the serialized store, monotonic revision, expectedRevision
   CAS, idempotency, invariant checks, and atomic replacement. Mobile uses the shared mutation
   envelope (`protocolVersion` 1, `expectedRevision`, and `idempotencyKey`); legacy callers may
   remain optional only for compatibility. Only the current foreground relay instance may write;
   stale generations reject requests and shutdown prevents post-close writes.
9. **WebView boundary.** Use a same-origin asset CSP with no arbitrary relay `connect-src`, no
   `fetch`/XHR/WebSocket/EventSource/iframe/eval path to the relay, an app-origin navigation
   allow-list, and system-browser external links only from explicit user actions. Native-plugin
   network calls are the only relay path; architecture scans enforce this.
10. **Sanitized operations.** Typed errors and logs contain only bounded event type, local
    correlation ID, outcome, and sanitized timing. No titles, IDs, paths, commands, URLs, tokens,
    headers, bodies, provider output, or credentials persist. Snapshots are in memory only, secure
    storage is backup-excluded where supported, app-switcher/background surfaces are neutral, and
    evidence uses synthetic fixtures. Retention and crash-report settings remain pending platform
    proof.

Platform gates are explicit: Apple requires `NSLocalNetworkUsageDescription` for local-network
operations, `NSBonjourServices` for declared Bonjour browsing/registration, and a real device for
local-network privacy proof; do not hard-code `en0`. Android local-network permission covers TCP,
UDP, raw sockets, mDNS, and WebView traffic. Android 17 target SDK 37+ blocks local-network access
by default and requires declared/runtime `ACCESS_LOCAL_NETWORK` (or a qualifying system picker);
D05 must select the target before implementation. Capacitor v8 supplies the web/native shell and
plugin API, not these security controls.

## Mobile-safe contract

The relay returns a versioned MobileSafeDeckSnapshot containing only:

- monotonic store revision and generated-at timestamp;
- current canonical ID plus ordered Focus and Important canonical IDs;
- sanitized thread ID, display title, provider enum, explicit status enum, context enum, priority
  tier, current flag, source-health summary, and safe capability flags;
- typed conflict, permission, pairing, disconnected, and source-error responses.

Forbidden fields are enforced at type, projection, runtime-schema, log-scan, and adversarial-test
levels. Unknown internal fields are not forwarded by default.

## Authoritative mutation flow

Every write:

1. Authenticates the paired device and authorizes the MCP tool.
2. Validates request version, expectedRevision, and idempotency key.
3. Acquires an owner-private cross-process lock.
4. Re-reads the latest store while holding the lock.
5. Rejects stale expectedRevision with a typed conflict and fresh safe snapshot.
6. Applies the existing domain mutation and checks singular NOW, tier uniqueness, ordering, and
   bounded-context invariants.
7. Increments revision and atomically replaces the store.
8. Records only sanitized operational telemetry and returns the new revision.

The macOS subprocess, stdio MCP, and relay must all use this path before mobile writes are enabled.
Last-writer-wins without conflict detection is a release blocker.

## Pairing and revocation

1. User explicitly enables Mobile Relay on the Mac; this starts the app-owned relay and local auth
   boundary only for the current foreground lifecycle.
2. Mac creates a single-use QR/manual bootstrap with endpoint/resource URI, instance ID, server
   fingerprint, authorization metadata location, and nonce. It contains no token or private data.
3. Phone generates its device key inside Keychain or Android Keystore and validates the pinned
   server identity before authorization.
4. Native plugin completes the selected registration path, PKCE/state/issuer/resource checks, and
   claimed callback; WebView is not an OAuth principal.
5. Both devices show a matching code; the Mac user approves the device and its scopes.
6. Mac stores only device identity, public-key/certificate hash, platform, scopes, timestamps,
   token-family/revocation state, and current relay generation in an owner-private credential store
   separate from priorities.
7. Per-request proof-of-possession binds the device key to the authorization record. Revocation
   immediately blocks new operations. Key/certificate loss requires explicit re-pairing and never
   downgrades trust.

Proposed scopes are gajendra.read, gajendra.priority.write, and separately approved
gajendra.resume.mac. There is no mobile source-write scope.

## Threat and control register

| Threat | Required control and proof |
| --- | --- |
| Passive LAN observation | Encrypted transport; packet inspection shows no plaintext metadata |
| MITM or DNS rebinding | Pinned identity, strict binding/headers, wrong-pin test |
| Stolen/replayed QR | Single use, expiry, matching-code approval, replay test |
| Stolen phone/token | Device-bound key, OS protection, per-device revocation, inspection |
| Request replay | Idempotency, pairing nonce/device-proof checks, duplicate mutation test |
| Concurrent writers | Lock, revision/CAS, property and stress tests |
| Command/URL injection | Canonical ID only, server lookup, forbidden-field fuzzing |
| Malicious provider metadata | Size, control, bidi, markup, and overflow tests |
| LAN denial of service | Connection/body/rate/time bounds and recovery |
| Parent crash or Mac sleep | Listener closes or resumes safely; store stays valid |
| Scope escalation | Authorization at every MCP tool; negative scope matrix |
| Log/backup/app-switcher leak | Automated scans plus manual device inspection |

## Delivery gates

1. Contract/redaction tests fail before implementation and pass after it.
2. Concurrency tests prove no silent lost update across independent processes.
3. Pairing, revoke, rotation, expiry, replay, and key-loss pass with synthetic metadata.
4. Relay is off by default and terminates with its owner.
5. Existing stdio/MCP App/macOS checks remain green.
6. Security review finds no client-controlled execution or mobile snapshot persistence.
7. One physical iPhone and Android pass same-LAN privacy and reconnect tests.

Implementation remains blocked until Sid records approval in
[the decision register](DECISIONS_RISKS_APPROVALS.md).
