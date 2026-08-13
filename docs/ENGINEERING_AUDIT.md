# Engineering audit

**Date:** 2026-08-13
**Scope:** source registry, policy/store, MCP App, native macOS utility, packaging, and verifiers.

## Findings resolved in 0.3.0

| Finding | Risk | Resolution | Proof |
| --- | --- | --- | --- |
| Product was coupled to one Codex catalog. | No single focus layer across AI agents. | Added bounded adapters behind one normalized source registry and canonical namespaced IDs. | Source/parser/domain/MCP tests. |
| Provider failure could be mistaken for total failure. | One missing optional CLI could hide ready Codex work. | Per-source status; aggregate failure only when every enabled source is unavailable. | Registry behavior and live snapshot. |
| Cross-provider IDs could collide. | Wrong priority or resume destination. | Canonical `source:provider-id` identity and v1-to-v2 normalization. | Domain/store tests. |
| CLI resume could invite shell injection. | Catalog metadata could execute shell syntax. | Structured executable/args/cwd, per-token quoting, no `eval`, `0700` temporary script, bounded cleanup. | Swift compile/self-test and code review. |
| Claude discovery could silently broaden privacy scope. | Conversation bodies could enter Gaja state. | Source disabled by default; bounded reads; allowlisted metadata fields; persistence-content verifier. | Source tests and isolated state inspection. |
| Fixed organizer size did not follow macOS window conventions. | Poor usability for larger queues and accessibility settings. | Resizable standard window with minimum size and keyboard/menu recovery. | Swift build and installed window proof. |
| Custom visual language diverged from system controls. | Weak light/dark behavior and unfamiliar actions. | Standard bordered controls, system typography/colors, semantic source status, Liquid Glass availability gate; removed the unused legacy custom button style. | Native build/previews and design validator. |
| Floating utility was described as a native widget. | Misleading Apple-platform claim. | Public docs distinguish AppKit/SwiftUI utility from future WidgetKit extension. | Documentation review. |
| Earlier updater experimentation could destabilize Codex. | Restart/quit loop and data risk. | No updater, LaunchAgent, app patch, or Codex-process monitor; only reversible main-app login registration. | Bundle/source inspection. |
| Mutation during refresh was dropped in the earlier app. | User action appeared accepted but did not persist. | Queue mutations and drain before a queued refresh. | Swift self-test. |
| Playwright's UI build cleared the separately bundled server from `dist`. | A green gauntlet could leave an incomplete source release directory. | Preserve the server in UI-only Vite builds and revalidate artifacts after all repeated UI journeys. | Final gauntlet artifact gate. |

## Findings resolved in 0.3.1

| Finding | Risk | Resolution | Proof |
| --- | --- | --- | --- |
| The earlier lotus used seven heavy closed contours with dense intersections. | Muddy rendering at the persistent pill and an amateur-looking large app icon. | Replaced it with seven shared thin-line Bézier strokes, more negative space, and round caps/joins. | Exact cross-surface path and stroke validators plus generated light/dark previews. |
| A visible product rename could accidentally rename compatibility surfaces. | Broken executable launch, state, deep links, or plugin upgrades. | Defined Gaja as the visible name and Gajendra as the stable repository/bundle/package/state identity. | Manifest and Info.plist gates; installed-bundle verification. |
| A signed bundle could still point `CFBundleExecutable` at the wrong filename. | Finder would show an app that fails to launch. | Added an explicit executable-name gate alongside the visible-name and version checks. | `companion:validate`. |
| Installed-cache parity covered runtime files but not the visual identity or bundled skill. | A successful update could leave Codex showing stale artwork or instructions. | Expanded installer and host-preflight hashing from four artifacts to nine, including every lotus asset and the skill. | Local install plus host preflight. |

## Deliberate simplifications

- One in-process source registry; no plugin SDK for arbitrary executable discovery.
- One JSON store; no database or sync service.
- Short-lived service processes from the native app; no resident local daemon.
- One generic catalog schema instead of provider-specific reverse engineering.
- SwiftUI system motion on native surfaces; GSAP stays inside the web MCP App.

## Residual risks and gates

- Cursor live behavior is unverified on this machine because `cursor-agent` is absent.
- A configured resume command is explicit local execution authority and requires operator review.
- A public binary still needs Developer ID signing, notarization, and clean-machine verification.
- Hosted CI and clean-clone proof require a published remote.
- Adoption remains a 14-day reversible trial; retain only after three real-use receipts.
- WidgetKit remains deferred until it demonstrates a distinct passive-view use case without a second store.
