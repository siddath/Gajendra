# Status

**Candidate:** Gaja, Elephant Focus for AI Power Users 0.3.1
**Reconciled:** 2026-08-16
**Publication state:** public source repository at [siddath/Gajendra](https://github.com/siddath/Gajendra); macOS binary distribution remains separate

**Repository/compatibility identity:** Gajendra (`gajendra` packages, plugin ID, URL scheme, bundle identifier, executable, and state paths)

## Implemented

- One global NOW plus ordered Focus/Important tiers across canonical `source:thread` IDs.
- Provider-derived Running surfaces for every explicit active status across NOW, Focus, Important, and unprioritized work, with placement labels, deduplication, and no new persisted tier or recency inference.
- Codex app-server source, opt-in Claude Code metadata source, Cursor Agent CLI source, and configured JSON-catalog sources.
- Skippable first-launch source discovery with live local health, opt-in toggles, Rescan, silent existing-user migration, and replay from native Settings or the application menu; the organizer and MCP App retain their source controls.
- Safe return paths: Codex deep links and short-lived, shell-quoted Terminal resume scripts for CLI-owned sessions.
- Snap-anchored icon-only native utility with Top Left, Top Right, Center, Bottom Left, Bottom Center, and Bottom Right positions in the trailing Settings and app menus; selected display and position persistence; click-to-open/card-pinned interaction with outside-click and Escape dismissal; hover-only launcher feedback; and inward card geometry that does not cover the launcher.
- Compact, single-owner card scrolling; expandable provider-wide Running rows; fixed search footers in both the focus card and full organizer; bottom-edge queue overflow shortcuts; whole-surface hover feedback; aligned Open → Running/Ready → Provider NOW actions; and keyboard-capable multi-term search whose entire capsule focuses on the first cross-app click, preserves normal multi-character input, selects an existing query once per new focus entry, and supports native ⌘A/⌘C/⌘V/⌘X editing through a standard Edit menu. The organizer remains resizable, with Dock/menu-bar recovery and a reversible login item.
- Double-click launcher edit mode with icon-and-close-control-only jiggle, stable card materials, movement below six points ignored, intentional drag snapping to the nearest hotspot, and card suppression while editing. Native card and organizer headers keep the elephant-and-lotus mark on the left, hold the two-line Gaja identity on the true centerline, and place Organizer, Refresh, then Settings on the right. The trailing gear owns source setup, theme, appearance, card size, and position without mutating a choice when opened. A secondary-click/Control-click context menu and matching app-menu command offer confirmed self-uninstall while retaining local priority metadata.
- Canonical NOW normalization across native and MCP App snapshots, so malformed provider payloads cannot render multiple selected collection rows.
- macOS 26 Liquid Glass with semantic material fallback on macOS 13–15; light/dark and Reduce Motion support.
- Official approved elephant-and-lotus mark: seventeen deterministic contours plus one attentive pupil form an Indian-elephant profile with a listening ear, calm eye, short tusk, raised two-edge trunk, two-lobe grip around one curved stem, and a softly asymmetric layered lotus. Structural, detail, and petal strokes are optically weighted and shared across native, menu-bar, app-icon, and web surfaces.
- Private v2 metadata store with atomic writes and copy-only Aadi/Priority Deck migration.
- MIT license, contribution/security guidance, source schema, Apple design rationale, and release checklist.

## Local verification

- Hosted GitHub Actions: initial public `main` commit `8f9360c` passed both `plugin` and `macos-companion` jobs in [run 31662304586](https://github.com/siddath/Gajendra/actions/runs/31662304586).
- Official icon/header iteration: `npm run check` passed with 30 unit/integration tests, TypeScript, deterministic web/server builds, one-pupil plus exact seventeen-contour cross-surface geometry validation, and all 13 Playwright journeys. Swift self-test, release build, companion validator, and the full native preview matrix passed. The mark was reviewed at 512, 64, 34, 24, and 18 pixels, then inspected in light, dark, Compact, Expanded, Native Popover, and Focus Deck renders before installation.
- The current full release gauntlet passed all 18 gates, including the live Codex probe, 13 browser journeys, five repeated unit suites, 65 repeated browser journeys, native build/signature/bundle parity, final artifact validation, and dependency audit.
- Native search repair: the installed card accepted `gajendra` character-by-character at human typing cadence, refocusing replaced it once with `focus`, `focus thread` reduced the result set through multi-term matching, seven Backspaces restored `focus`, Clear retained keyboard focus, a no-match query rendered the explicit empty state, clicking the magnifier side of the capsule focused the field, and Organizer accepted the same multi-character query. A pre-fix native probe confirmed ⌘A/⌘C/⌘V/⌘X all failed; the installed repaired binary passed all four commands in both the floating card and Organizer while preserving and restoring every clipboard item and type around the probe. The fixed field is first-click capable across applications and cancels deferred selection as soon as user input arrives.
- Source-onboarding proof: isolated Swift self-tests passed clean-first-launch, completion, repeat-launch, existing-user-upgrade, configured-agent, and registry-error cases. Native 640 × 620 light/dark renders passed the design detector. A forced clean launch opened **Connect AI Tools** automatically; a normal existing-user launch opened only the pill. The installed screen reported Codex ready, Claude Code ready and opt-in, Cursor not installed, and Grok Build off; exposed stable Rescan/toggle/Skip/Finish accessibility identifiers; persisted an isolated Claude toggle only in the `0600` v2 metadata file; closed on Finish; and reopened from both the application menu and trailing Settings gear.
- Supply chain: the current production dependency audit found 0 vulnerabilities.
- Artifact parity: the generated `dist/server.mjs` remained present, the installed app bundles that exact service, and all nine installed plugin runtime/artwork/skill artifacts match source.
- Installed plugin: `gajendra@gajendra` 0.3.1 enabled; all nine checked runtime, artwork, and skill cache artifacts match source; seven tools and one MCP App resource registered.
- Installed app: visible name `Gaja`, compatibility executable `Gajendra`, version 0.3.1, ad-hoc signature valid; installed and source-built binary SHA-256 `fb88dcb49a4b5e36b7f4307f8a5577039f2a7dfe8341a0ec4ffdaba532f50dd9`; installed ICNS SHA-256 `ce14ad09bdc2dd48a48fa9a39c9407b356571ae207bdfa0bbaba8ec040b8faff`; bundled service SHA-256 `e37e1714d5912db9992a54573d0475398622e093337573eace2fb067476ef2d1`.
- Artwork: canonical SVG SHA-256 `6353e527436dec8daa8b4f36ccf3b45efa4ce9da53c2a8a7ce2696be83e1136e`; generated 1024px PNG SHA-256 `2df9143748b8719bd9f7e870049eec7edebcc8660a1c3690d8f6434df61f41b0`.
- Running installed runtime: relaunched as PID `14000`, with the persisted launcher at Bottom Right and no unsolicited onboarding window for the existing installation. Installed Accessibility proof covered the live 640 × 637 setup window, all four source states/toggles, Rescan, Skip, Finish, application-menu replay, and Settings-gear replay. The pre-onboarding app is recoverable at `~/Applications/Gajendra.app.rollback-source-onboarding-20260816-114922`.
- State: v2 store valid with one NOW, `0600` file, `0700` directory, and no persisted live thread content.

## Provider proof levels

- Codex: live and `ready`, 129 threads observed during the release gauntlet and 131 in the later installed setup refresh; a desktop-owned active task can be recovered from held writer-lock plus lifecycle metadata after the separate app-server reports it as unloaded.
- Claude Code: explicitly enabled and `ready`, 200 bounded metadata records observed; prompts/transcripts were not emitted or persisted.
- Cursor: adapter and official CLI contract are fixture/unit tested; `cursor-agent` is not installed on this machine, so live discovery/resume is unverified here.
- Configured agents: schema/fixture tested; each third-party catalog and resume target remains operator-owned.

## Still external or unproven

- The app is ad-hoc signed, not Developer ID signed or notarized.
- Codex’s experimental global MCP App destination remains host/account gated; the native utility and inline MCP App do not depend on it.
- The 14-day adoption trial has not yet produced three real reuse receipts.
- A WidgetKit extension is an evaluated future surface, not part of 0.3.1.
- The running Codex process predates the 0.3.1 plugin refresh. No forced restart was performed; native Gaja is already independent, installed, and running.
- No Developer ID binary, notarized download, or new version tag is claimed by this source iteration.

Follow [the release checklist](docs/RELEASE_CHECKLIST.md) before publication.
