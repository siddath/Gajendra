# Compatibility contract

| Capability | Supported contract | Local evidence | Degradation |
| --- | --- | --- | --- |
| macOS daily access | AppKit/SwiftUI snap-anchored nonactivating utility | Swift tests, bundle validator, installed-window proof | Dock, normal window, menu bar |
| Liquid Glass | `glassEffect` on macOS 26+ | SDK compile and source gate | Semantic `.ultraThinMaterial` on macOS 13–15 |
| Light/dark and motion | System appearance and Reduce Motion; the trailing Settings gear offers Auto, Light, and Dark without a click side effect | Native settings self-test, previews, and browser journeys | Functional layout without blur/motion |
| Adaptive focus card | Active-display visible-frame sizing plus Compact/Comfortable/Expanded preference; primary-click toggle with outside-click/Escape dismissal; hover never opens it; card opens above, below, or beside its anchor without covering the lotus | Swift presentation/sizing/non-overlap self-tests across all anchors, native preview matrix, and installed interaction proof | Card dimensions contract to preserve the lotus on smaller displays |
| Lotus hotspots | Top Left, Top Right, Center, Bottom Left, Bottom Center, and Bottom Right in the trailing Settings and app menus; selected display and anchor persist | Six-anchor geometry/persistence self-tests, source validator, full native compile, and installed runtime proof | A disconnected stored display falls back to the currently preferred display |
| Codex discovery | `codex app-server` `thread/list` | Live local probe | Source health error; other sources continue |
| Claude Code discovery | Documented local session JSONL metadata | Unit/fixture plus local layout validation | Disabled by default or source health error |
| Cursor discovery | `cursor-agent ls` | Parser/fixture test | `not-installed` when CLI is absent |
| Grok Build discovery | Documented local `summary.json` metadata | Unit/fixture test | Disabled by default or `not-installed` when CLI is absent |
| Generic agents | Explicit v1 JSON catalog | Schema/fixture tests | Per-source error; no arbitrary directory scan |
| Codex resume | Registered `codex://threads/...` URL | Native open contract | Visible error if handler is absent |
| CLI resume | Structured executable/args/cwd | Native quoting/build test | Visible error; catalog remains readable |
| Grok Build resume | `grok --resume <session-id>` | Exact-command unit/fixture test | Visible error if Grok Build is absent |
| MCP App | Standard resource/tool metadata | MCP integration and live probe | Meaningful text tool result |
| Global Codex destination | Experimental `openai/ui` hint | Metadata test only | Native utility and inline MCP App |
| State migration | Copy-only Aadi/Priority Deck normalization | Unit migration tests | Legacy files remain recoverable |
| Context labels | Optional Gaja-owned Design/Engineering/Life enum on prioritized entries | Domain/store/native/browser tests | Missing or unknown values render as no context |
| Running view | Explicit provider `active`/running-equivalent statuses across NOW, Focus, Important, and unprioritized threads, exposed through an expanded/collapsed disclosure inside the owning scroll surface | Domain/source normalization, Codex lifecycle-tail tests, Swift self-test, five-active-thread native previews, browser disclosure journeys, and live local probe | Resumable/idle/unknown metadata stays Recent; unavailable Codex runtime enrichment preserves app-server status |
| Search in both views | Deduplicated, multi-term metadata search across all loaded threads, in a persistent non-overlapping footer whose entire capsule focuses input, selects an existing query on entry, and provides hover/focus feedback in a keyboard-capable native detail panel | Swift self-test/search preview, browser footer-position/hover/focus/selection journeys, full native app compile, and installed bundle verification | Five card results plus Organizer continuation; full Organizer remains available |
| Compact overflow | One vertical scroll owner contains NOW, queues, Running, and results while search remains a sibling footer | Native Compact/Comfortable/Expanded previews, source validator, browser bounded-shell journey, and accessibility checks | System scroll indicators and clipped continuation reveal additional content without reducing the loaded set |
| NOW selection | The canonical `current.id` is the only selected collection row, regardless of malformed incoming `isCurrent` flags | TypeScript normalization test, Swift decode/init self-tests, sequential cross-provider browser journey, and installed metadata-only snapshot | Standalone NOW card and its matching collection row represent the same task |
| Launcher edit, move, and remove | Double-click enters or exits edit mode; only the elephant-and-lotus artwork and close control jiggle; movement below six points is ignored; intentional drag snaps to the nearest hotspot without reopening the card; contextual and app menus expose confirmed uninstall with metadata retention | Swift gesture/threshold/snap validator, motion/presentation self-test, source uninstall guard, native preview matrix, and installed app compile | Settings, Dock, menu-bar, and application-menu recovery remain available |

## Version support

- macOS 13 is the native minimum.
- macOS 26 is required for the Liquid Glass API; earlier supported versions use system materials.
- Node.js 20 or later is required for the bundled TypeScript service.
- Codex plugin support varies by desktop/CLI release and account rollout.
- Claude Code, Cursor Agent, and Grok Build versions must support the official resume contracts documented by their vendors.

No compatibility claim authorizes patching a signed host app or reading a provider’s private database.
