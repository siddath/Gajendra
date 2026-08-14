# Security and privacy

## Supported versions

Security fixes are provided for the latest published `0.3.x` source release. Older development identities and untagged commits are not supported release channels.

## Data boundary

Gaja is local-first and declares `openWorldHint: false`. Its own services make no third-party network request.

The v2 state file contains only canonical thread IDs, Focus/Important order, one NOW ID, an optional `design`/`engineering`/`life` context enum, collapse preferences, and source enablement. Context is assigned by the user inside Gaja; providers cannot inject it. Live titles, project basenames, and free-text labels are never persisted. The state directory is owner-only (`0700`), the file is owner-only (`0600`), and writes use an atomic temporary-file rename.

Gaja does not persist prompts, previews, transcript bodies, source files, tokens, credentials, or arbitrary provider responses. Compatible Aadi and Priority Deck metadata is copied only when no v2 state exists; legacy files remain intact.

## Source trust boundaries

- **Codex:** invokes `codex app-server --stdio` and uses `thread/list`; it does not inspect Codex SQLite, rollout JSONL, Electron storage, or the signed app bundle.
- **Claude Code:** disabled by default. When enabled, reads at most the newest 200 documented session JSONL files and at most 512 KiB from each, extracting only `sessionId`, `cwd`, `timestamp`, `aiTitle`, and `slug`. Conversation bodies are neither used nor stored.
- **Cursor:** invokes the resolved `cursor-agent ls` process with a 10-second timeout and 2 MiB output cap. Resume uses the official session ID argument.
- **Grok Build:** disabled by default. When enabled, reads at most the newest 200 documented `summary.json` metadata files and at most 128 KiB from each, extracting only the session ID, working directory, generated title, and activity timestamps. It does not read `updates.jsonl`, `chat_history.jsonl`, plans, prompts, responses, tool calls, or file snapshots. Resume uses the official session ID argument.
- **Configured agents:** reads only catalogs explicitly named in `sources.json`, capped at 2 MiB and 2,000 entries. A configured resume command is user-authored executable authority; review it like a local script.

Executable overrides are explicit: `GAJENDRA_CODEX_BIN`, `GAJENDRA_CLAUDE_BIN`, `GAJENDRA_CURSOR_BIN`, `GAJENDRA_GROK_BIN`, and `GAJENDRA_NODE_BIN`. Legacy Aadi/Priority Deck environment names are accepted only for migration compatibility.

## Resume boundary

Codex uses its registered URL scheme. CLI-owned sessions use a temporary `.command` file in the system temporary directory. Every executable, argument, and working directory is single-quoted before launch; the file and directory use `0700`; the file is removed after a bounded delay. Gaja never runs catalog-provided shell text through `eval`.

## Native and web boundaries

- Native panels request no Accessibility automation, screen recording, App Group, listener, or local network server.
- The MCP UI runs in the host sandbox and can call only the declared Gaja tools and open declared links.
- Native `UserDefaults` persists only validated visual-theme, appearance, bounded hover-card-size, pill-visibility, and pill-position values. MCP browser storage persists only the validated visual-theme and appearance enum strings; storage failures are non-fatal. No thread IDs, titles, projects, source results, or content enter either visual-preference store.
- The native app and plugin bundle the byte-identical service artifact.
- No updater daemon, LaunchAgent, or Codex-process monitor is installed. Launch at Login is an `SMAppService` main-app registration that the user can disable.

## Distribution and artwork

Local bundles are ad-hoc signed. A downloadable public binary requires Developer ID signing, notarization, stapling, and clean-machine Gatekeeper verification. Signing credentials must never enter the repository.

Runtime artwork is original SVG/SwiftUI geometry. External reference images are not bundled or redistributed.

## Reporting a vulnerability

Use synthetic thread metadata and omit tokens, prompts, transcripts, and absolute private paths. Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/siddath/Gajendra/security/advisories/new); do not open a public issue for an undisclosed vulnerability.
