# Provider contract plan

**State:** plan_generated

**Authority:** [master plan](../GAJENDRA_MOBILE_APP_PLAN.md)

## Contract

Supported providers remain Mac-local Gajendra adapters. The Mac aggregates them behind one
Gajendra MCP relay and emits a mobile-safe projection. This plan does not create or imply a
separate MCP endpoint for each provider.

Providers own sessions and credentials. Gajendra owns metadata normalization and priority
selection. The phone owns neither.

## Shared mobile projection

Each projected thread may contain only:

- namespaced canonical ID;
- sanitized display title and project basename when the source contract permits;
- bounded provider, explicit status, context, priority tier, and current flag;
- source-health/error summary;
- safe capabilities such as canRequestOpenOnMac.

It never contains a prompt, transcript, provider response, raw event, session file, provider
credential, resume command, executable, arguments, absolute path/cwd, arbitrary URL, or private
deep link. Projection is allow-list based. The Mac may retain a source-declared
`allowedDeepLinkSchemes` allow-list for its trusted resolver, but that field and the resolved
destination never cross to the phone.

## Provider matrix

| Lane | Mac discovery authority | Mobile presentation | Open-on-Mac behavior | Required proof |
| --- | --- | --- | --- | --- |
| Codex | Bounded Codex app-server adapter and allowed enrichment | Sanitized metadata plus explicit status | Mac resolves canonical ID to trusted Codex destination | Live proof on named installed Mac/build |
| Claude Code | Explicit opt-in bounded metadata adapter | Resumable metadata; not Running without active state | Mac resolves reviewed structured CLI action | Enabling Mac-only; fixture plus authorized live proof |
| Cursor | Bounded Cursor Agent CLI adapter | Sanitized metadata and explicit status | Mac resolves reviewed structured CLI action | Fixture/contract until CLI installed/authorized |
| Grok Build | Explicit opt-in bounded summary adapter | Resumable metadata; not Running without active state | Mac resolves reviewed structured CLI action | Fixture/contract until live CLI proof |
| Configured agents | Explicit bounded operator catalog | Sanitized catalog metadata | Mac resolves reviewed URL or structured action | Operator-owned fixture and approved live example |
| Running | Explicit active-equivalent statuses from enabled lanes | Inclusive disclosure and provider placement | No special execution privilege | Cross-provider fixture; no recency inference |

## Discovery and enablement

- Discovery runs only on the Mac.
- Existing defaults and explicit opt-ins remain unchanged.
- Mobile reads bounded source health through gajendra.read.
- Mobile has no source-enable or provider-configuration operation in v1.
- A failing provider yields a source-specific error while successful lanes remain available.
- Absent provider tooling is labeled fixture-only or unavailable, never live.

## Open-on-Mac contract

The mobile request contains only request version, canonical thread ID, expected paired Mac
instance, expected revision, and idempotency material. It never accepts a client-supplied URL,
scheme, command, executable, argument, cwd, or provider content.

The Mac:

1. authenticates and checks separate gajendra.resume.mac scope;
2. resolves the ID against a fresh normalized snapshot;
3. verifies that the provider exposes a reviewed safe destination;
4. invokes the existing structured Mac-side route;
5. returns accepted, unsupported, not-found, unauthorized, or failed.

The client cannot supply or override command, scheme, executable, arguments, cwd, or URL. Accepted
means the Mac accepted the request, not that the provider restored a session unless
provider-specific evidence proves that.

## Contract fixtures

Canonical synthetic fixtures cover:

- every lane, active/inactive/resumable/unknown states, and source failures;
- duplicate raw IDs across providers to prove namespacing;
- absent/singular NOW, five-plus Focus/Important, and contexts;
- missing, oversized, markup, bidi, control-character, and Unicode titles;
- unavailable/unsupported Open-on-Mac capabilities;
- malformed/unknown enum values and forward-compatible fields;
- stale revisions, duplicate idempotency keys, and concurrent mutations.

The same fixtures are decoded by TypeScript, Swift, Kotlin, legacy stdio, and Streamable HTTP.

## Proof labels

- Fixture proof: deterministic synthetic contract behavior only.
- Installed-provider proof: named tool/version available on named host.
- Live discovery proof: metadata discovery succeeded without private evidence leakage.
- Open-on-Mac proof: Mac resolved and invoked the trusted destination.
- Resume proof: provider restored the intended session; requires provider-specific observation.

Receipts include counts, enums, outcomes, versions, and sanitized hashes where useful. They exclude
IDs, titles, prompts, transcripts, responses, paths, commands, URLs, and credentials.

## Exit criteria

Every lane has fixtures, a truthful proof label, source-error behavior, redaction tests, and safe
Open-on-Mac results. Mobile cannot enable sources or change providers. No lane is called live,
resumable, Running, or supported beyond the evidence collected.
