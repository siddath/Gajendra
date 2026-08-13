# Compatibility contract

| Capability | Supported contract | Local evidence | Degradation |
| --- | --- | --- | --- |
| macOS daily access | AppKit/SwiftUI bottom-right nonactivating utility | Swift tests, bundle validator, installed-window proof | Dock, normal window, menu bar |
| Liquid Glass | `glassEffect` on macOS 26+ | SDK compile and source gate | Semantic `.ultraThinMaterial` on macOS 13–15 |
| Light/dark and motion | System appearance and Reduce Motion | Native previews and browser journeys | Functional layout without blur/motion |
| Codex discovery | `codex app-server` `thread/list` | Live local probe | Source health error; other sources continue |
| Claude Code discovery | Documented local session JSONL metadata | Unit/fixture plus local layout validation | Disabled by default or source health error |
| Cursor discovery | `cursor-agent ls` | Parser/fixture test | `not-installed` when CLI is absent |
| Generic agents | Explicit v1 JSON catalog | Schema/fixture tests | Per-source error; no arbitrary directory scan |
| Codex resume | Registered `codex://threads/...` URL | Native open contract | Visible error if handler is absent |
| CLI resume | Structured executable/args/cwd | Native quoting/build test | Visible error; catalog remains readable |
| MCP App | Standard resource/tool metadata | MCP integration and live probe | Meaningful text tool result |
| Global Codex destination | Experimental `openai/ui` hint | Metadata test only | Native utility and inline MCP App |
| State migration | Copy-only Aadi/Priority Deck normalization | Unit migration tests | Legacy files remain recoverable |
| Context labels | Optional Gaja-owned Design/Engineering/Life enum on prioritized entries | Domain/store/native/browser tests | Missing or unknown values render as no context |

## Version support

- macOS 13 is the native minimum.
- macOS 26 is required for the Liquid Glass API; earlier supported versions use system materials.
- Node.js 20 or later is required for the bundled TypeScript service.
- Codex plugin support varies by desktop/CLI release and account rollout.
- Claude Code and Cursor Agent versions must support the official resume contracts documented by their vendors.

No compatibility claim authorizes patching a signed host app or reading a provider’s private database.
