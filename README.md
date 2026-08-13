# Gajendra

<p align="center">
  <img src="plugins/gajendra/assets/gajendra.svg" alt="Gaja thin-line lotus" width="112" />
</p>

<p align="center">
  <a href="https://github.com/siddath/Gajendra/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/siddath/Gajendra/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-blue.svg" /></a>
  <img alt="macOS 13+" src="https://img.shields.io/badge/macOS-13%2B-black.svg" />
</p>

**Gaja, Elephant Focus for AI Power Users** is an open-source, local-first macOS focus utility for AI-agent threads. It gives Codex, Claude Code, Cursor, and explicitly configured agents one shared priority layer: one **NOW**, an ordered Focus queue, and an Important tier.

The repository and compatibility identity is **Gajendra** (`gajendra` in packages, plugin IDs, URLs, bundle identifiers, and state paths). The user-facing product is **Gaja**. Keeping that boundary avoids breaking existing installations and priority state.

The daily surface is an icon-only outlined lotus at the bottom right. Hover or press it to reveal the current thread; choose **Open** or the provider badge to resume that exact thread in the owning agent. Press and hold the lotus to move or hide it; click outside or press Escape to leave edit mode without hiding it. Dragging uses stable global display coordinates and persists the final clamped position. A resizable drag-and-drop organizer is available from the card, Dock, menu bar, or `⇧⌘O`.

> “Widget” describes the compact experience. The current release is a native AppKit/SwiftUI floating utility, not a WidgetKit extension. WidgetKit cannot implement a cross-application, always-on-top hover pill.

![Gaja hover card](evidence/companion/gajendra-hover-card.png)

## Why Gaja

AI tools own their sessions; Gaja owns only the decision about what matters next. It does not replace the source apps, copy conversations into a new task system, or modify their private databases.

- Exactly one global NOW, and it must be in Focus.
- One resume action back to Codex, Claude Code, Cursor, or a configured agent.
- Optional Design, Engineering, or Life context on prioritized threads, visible at a glance and editable without copying provider content.
- Source health and opt-in controls in the organizer.
- Owner-only, metadata-only local persistence.
- Native light/dark appearance, Reduce Motion support, keyboard commands, and VoiceOver labels.

## Thread sources

| Source | Discovery | Resume | Default | Current proof |
| --- | --- | --- | --- | --- |
| Codex | Local `codex app-server` | Native `codex://threads/...` link | On | Live local integration |
| Claude Code | Documented local session JSONL metadata | `claude --resume <session-id>` in Terminal | Off, explicit opt-in | Parser tests and local adapter validation |
| Cursor | Official `cursor-agent ls` | `cursor-agent --resume=<chat-id>` | On | Parser/fixture tested; live CLI proof requires Cursor Agent installed |
| Other agents | Size-bounded JSON catalogs | Declared deep link or explicit resume command | Per configuration | Schema and fixture tested |

Gaja never persists titles, prompts, transcript bodies, previews, source files, tokens, or credentials. Claude Code scanning is disabled until the user enables it.

See [thread source configuration](docs/THREAD_SOURCES.md) for the generic adapter.

## macOS design

On macOS 26 and later, native surfaces use SwiftUI Liquid Glass. macOS 13–15 use semantic system material as a compatible fallback. Glass is limited to the navigation/overlay layer; list rows and controls remain standard SwiftUI components. The minimal lotus stays outline-only and adapts to light and dark appearances.

The visual palette offers two production themes: **Native Popover** (default) and **Focus Deck**. Both support Auto, Light, and Dark across the native companion and portable MCP App. Command Capsule is intentionally excluded.

The native hover card adapts to the active display and offers **Compact**, **Comfortable**, and **Expanded** sizes under Theme & Appearance. Comfortable is tuned for the 1512 × 949-point usable frame of the 14-inch MacBook Pro reference display. Each Focus and Important lane shows up to five queued threads; **More** opens the full Organizer without changing priority state.

The implementation follows Apple’s guidance on [Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/liquid-glass), [materials](https://developer.apple.com/design/human-interface-guidelines/materials), [macOS design](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/), and [widgets](https://developer.apple.com/design/human-interface-guidelines/widgets/). See [Apple design compliance](docs/APPLE_DESIGN_COMPLIANCE.md).

## Install from source

Prerequisites: macOS 13 or later, Node.js 20 or later, and Codex CLI. Claude Code and Cursor Agent are optional source integrations.

```bash
git clone https://github.com/siddath/Gajendra.git gajendra
cd gajendra
npm ci
npm run check
npm run companion:build
npm run install:local
mkdir -p "$HOME/Applications"
ditto "build/Gajendra.app" "$HOME/Applications/Gajendra.app"
open "$HOME/Applications/Gajendra.app"
```

Restart Codex once after installing or updating the plugin. The native bottom-right utility works independently of Codex’s experimental global MCP App route. Any host that ignores the global entry-point hint retains the normal inline MCP App.

## Daily loop

1. Hover the bottom-right lotus.
2. Open the one NOW thread in its owning agent.
3. Open the organizer only when the queue needs to change.
4. Keep Focus short; five is guidance, not a hard limit.

The menu-bar control is a fallback and may be hidden by a notch or crowded menu bar. Launch at Login is reversible from the Gaja application menu.

## Privacy, state, and migration

The canonical macOS state is:

```text
~/Library/Application Support/Gajendra/gajendra.v2.json
```

It stores canonical source/thread IDs, tier/order, the NOW ID, an optional bounded Design/Engineering/Life context enum, collapse preferences, and source enablement. It never stores free-text labels or provider content. The directory is `0700`, the file is `0600`, and writes are atomic. Compatible Aadi and Priority Deck state is copied only when no v2 state exists; legacy files are retained for recovery.

## Development and validation

```bash
npm run check
npm run companion:test
npm run companion:build
npm run companion:validate
npm run companion:preview
npm run gauntlet
npm run --silent host:preflight
```

The fail-fast gauntlet covers domain/store invariants, source adapters, MCP contracts, the live Codex catalog, browser journeys, accessibility, themes, reduced motion, reliability repetitions, dependency audit, Swift behavior, bundle signing, and bundled-service integrity. See [Gauntlet](docs/GAUNTLET.md) and [Engineering audit](docs/ENGINEERING_AUDIT.md).

## Distribution status

The public repository is [siddath/Gajendra](https://github.com/siddath/Gajendra). Source tags and hosted CI are distinct from downloadable macOS binaries: local app builds are ad-hoc signed, and public binary distribution still requires Developer ID signing and notarization.

## Uninstall

```bash
codex plugin remove gajendra
codex plugin marketplace remove gajendra
```

Turn off **Launch Gaja at Login**, quit the app, and move `~/Applications/Gajendra.app` to Trash. State is intentionally retained unless the user explicitly deletes it.

## Artwork and license

The shipped lotus is original project artwork implemented as deterministic SVG and SwiftUI paths. External visual references informed only a general minimal lotus direction; no Pinterest image is bundled, traced, or redistributed.

The Gajendra repository is licensed under the [MIT License](LICENSE). Dependency notices are in [THIRD_PARTY_NOTICES.md](plugins/gajendra/THIRD_PARTY_NOTICES.md).

See [Contributing](CONTRIBUTING.md), [Support](SUPPORT.md), the [Code of Conduct](CODE_OF_CONDUCT.md), and the [Security Policy](SECURITY.md) before opening a report or contribution.
