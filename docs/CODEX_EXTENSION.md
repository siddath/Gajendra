# Local Codex extension

The local Gajendra 0.4.0 candidate advertises MCP App extension metadata for a sidebar entry and a
conversation panel, with inline and fullscreen display support. OpenAI's extension guide
currently describes these surfaces for ChatGPT; availability in a particular Codex build
must be checked in that host. Both entrypoints accept empty
arguments and share `gajendra_open`, the same service, and the existing private revisioned store.
The `.codex-plugin/plugin.json` package format remains a supported compatibility manifest.
No remote endpoint, new account, transcript mirror, or background agent is required.

References: [OpenAI extensions](https://developers.openai.com/plugins/build/extensions),
[packaging](https://developers.openai.com/plugins/build/plugins),
[protocol](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md).

## Install and use

1. Run `npm run check`, then `npm run install:local` from this repository.
2. Reopen Codex to refresh the installed plugin and its extension entrypoint metadata.
3. Open **Gajendra priorities** from a supported extension menu, or ask Codex to open Gajendra.
4. Search for an exact task, choose Focus/Important/NOW, and use the provider link to return to it.

The host's initial tool result renders directly. A fresh result does not trigger a second scan on
mount. A labeled neutral cached result triggers one live refresh; `gajendra_open` accepts optional
`refresh: true` to force collection. An interrupted connection can be retried; **Retry loading** requests a snapshot if a host
connected without delivering the initial result. Invalid data and rejected host navigation produce
visible recovery messages. Embedded navigation uses the host's `openLink` bridge; a host refusal
does not trigger a silent attempt to navigate the sandboxed frame.

The extension and native utility share the authoritative product sections and explicit lifecycle.
Finish/Reopen never follows from opening, idle time, or provider completion. Choosing an exact
successor transfers priority/NOW while retaining predecessor chats. Use the current revision and
exact IDs for `gajendra_set_work_completed` and `gajendra_link_continuation`; no title matching.

While visible, clients check `gajendra_sync`/`--sync-json` about every five seconds and request source
refreshes about every thirty seconds. Sync reads only revision plus optional `activityRevision`.
Source refresh still takes provider time; this is not an always-instant synchronization promise.
Optional bundled hooks can invalidate completion reuse sooner. The owner must review and trust
the current definitions in the host; installing/updating does not authorize or automatically trust
them. Unsupported, skipped, or failed hooks leave polling in control. Hook events never finish work,
acknowledge review, or steer a conversation. See [official hooks](https://learn.chatgpt.com/docs/hooks).

With **Native** theme and **Auto** appearance, Gajendra uses the host's supplied surface, text,
border and font variables and follows subsequent host changes. Explicit appearance choices and
the Focus Deck theme retain their own styles. Hosts without style variables keep the existing
native palette. No remote font stylesheet is loaded.

Search stays in memory across refreshes and priority changes, including its keyboard focus and
caret during host updates. While focus is inside Gajendra, Command/Control+K opens search; `/`
does the same when not typing in a field. Escape clears the search. The host may reserve its own
shortcuts before they reach an embedded app, so the visible search field remains available.

Provider chips report connection status. **Manage sources** opens explicit On/Off switches in
settings; clicking a provider label no longer silently disables its source. Individual task
provider links continue to open that exact task.

Opening an extension does not constitute provider-thread navigation proof. Host metadata,
synthetic bridge tests, installed artifact parity, and actual host clicks are separate checks.
Gajendra is a custom plugin, not an OpenAI first-party component. It cannot add controls to
Codex's own chat rows or infer the currently viewed chat from a matching title. Conversational
commands such as “make this my focus now” still require a reliable host-provided task identity.

## Blank views and preserved data

The authoritative file persists source/task IDs, ordering, preferences, explicit completion IDs,
continuation relationships, and cleared-NOW state. Provider status is resolved live; a separate
private display cache can supply labeled neutral titles/project labels during refresh. When a source fails, unresolved priorities used to disappear
from the view with little explanation. The web surface now displays source diagnostics and the
unresolved saved count; the Mac card also shows a safe warning. Neither surface resets storage.

Claude discovery separately budgets session candidates and filesystem entries. The entry budget
is three times the existing 2,000-candidate bound, accounting for a session file, its sidecar
directory, and an enclosing project directory. Explicit `directoryEntryLimit` callers can choose
a smaller or larger budget; metadata reads still select at most 200 recent session files, each
under the existing byte bound. Exceeding a bound fails visibly rather than discarding saved state.

Codex executable resolution prefers its current desktop bundle location
(`Resources/codex-cli/bin/codex`), then the legacy location and local CLI installations. Explicit
`GAJENDRA_CODEX_BIN`, `AADI_CODEX_BIN`, or `PRIORITY_DECK_CODEX_BIN` overrides retain precedence.
The companion and host preflight recognize the current bundle layout.

Before rolling back, preserve the store and its last-known-good backup. Older v3 writers can drop
unknown lifecycle, continuation, cleared-NOW, and review-receipt fields on their next write.

## Local acceptance

Run `npm run check`, `npm run test:e2e`, `npm run companion:test`, and
`npm run companion:build`. Use `npm run probe:live` for the local MCP contract and
`npm run host:preflight` for installation parity. Neither command proves the user's host UI.
Inspect the real extension and native app, confirm exact-thread navigation, and compare private
state before and after read-only verification. The release gauntlet must be run and its exact status disclosed; a partial candidate receipt
does not establish full native release acceptance; Developer ID, notarization, public distribution, and mobile remain separate.

## Public repository package and directory status

The 0.4.0 candidate includes the shared backend, workflow controls and motion feedback in the
Codex plugin. Plugin-only users need Node.js matching `plugins/gajendra/package.json` and locally
installed providers. Reopen panels and reload the host after an update.

This is a community repository package, not an OpenAI-approved directory plugin. See
[submission readiness](CODEX_PLUGIN_PUBLICATION.md) and [release changes](releases/0.4.0.md).
