# Thread source configuration

Current Gaja source includes four built-in adapters and a conservative JSON-catalog adapter for other AI agents. Gajendra names remain in configuration paths and environment variables for compatibility.

The Running view is deliberately conservative and inclusive. A thread enters it only when its source emits an explicit active/running-equivalent status, and it remains visible there even when it is also NOW, Focus, or Important. The current Claude Code and Grok Build metadata adapters emit `resumable`, so Gaja does not claim those sessions are running. Cursor JSON and configured catalogs can participate when they supply an explicit status.

Codex app-server reports desktop-owned threads as `notLoaded` to a separate client. On macOS, Gaja therefore performs a best-effort metadata-only enrichment: it finds held files in `~/.codex/thread-writer-locks`, validates the matching rollout path remains under `~/.codex/sessions`, reads at most the final 256 KiB, and treats a lifecycle tail after the last `task_complete` marker as active. It never emits or persists rollout content. If the lock, path, lifecycle marker, or `/usr/sbin/lsof` probe is unavailable, Gaja keeps the app-server status rather than guessing from recency.

## Built-in sources

- Codex is enabled by default and uses the local app-server.
- Cursor is enabled by default; an absent `cursor-agent` is reported as `not-installed`.
- Claude Code is disabled by default because enabling it reads local session metadata. Enable or disable any source during clean first-launch setup, from **Settings → Connect AI Tools…**, or from the organizer’s source chips.
- Grok Build is disabled by default because enabling it reads only the documented local `summary.json` metadata under `~/.grok/sessions`; it never reads Grok prompts, responses, tool calls, or file snapshots. An absent `grok` CLI is reported as `not-installed`.

The setup screen and its **Rescan** action use this same local registry. They do not create provider accounts, transmit credentials, or broaden discovery beyond these built-ins and explicitly configured catalogs. A valid entry added to `sources.json` appears automatically as another setup row.

Executable overrides are optional:

```bash
export GAJENDRA_CODEX_BIN="/absolute/path/to/codex"
export GAJENDRA_CLAUDE_BIN="/absolute/path/to/claude"
export GAJENDRA_CURSOR_BIN="/absolute/path/to/cursor-agent"
export GAJENDRA_GROK_BIN="/absolute/path/to/grok"
```

Grok discovery and resume follow xAI’s official [session storage](https://docs.x.ai/build/features/sessions) and [CLI resume](https://docs.x.ai/build/cli/reference) contracts. `GAJENDRA_GROK_CONFIG_DIR` may point at an isolated Grok configuration directory for testing.

## Configure another agent

Create `~/Library/Application Support/Gajendra/sources.json`:

```json
{
  "version": 1,
  "sources": [
    {
      "id": "my-agent",
      "name": "My Agent",
      "catalog": "~/Library/Application Support/My Agent/gajendra-threads.json",
      "enabled": true
    }
  ]
}
```

The referenced catalog is versioned and size-bounded:

```json
{
  "version": 1,
  "threads": [
    {
      "id": "thread-123",
      "title": "Finish release audit",
      "project": "gajendra",
      "updatedAt": "2026-08-12T12:00:00Z",
      "status": "idle",
      "deepLink": "my-agent://threads/thread-123"
    }
  ]
}
```

Every catalog thread must declare at least one resumable destination. Instead of a deep link, it may declare a structured resume command:

```json
{
  "executable": "/absolute/path/to/my-agent",
  "args": ["resume", "thread-123"],
  "cwd": "/absolute/project/path"
}
```

Use `resumeCommand` as that field name inside the thread object. There is no shell-string or `eval` field. Review catalog commands before enabling the source: the user who configures them is granting execution authority to that executable and argument list.

Set `GAJENDRA_SOURCES_CONFIG` to test a different configuration file. Catalogs are capped at 2 MiB and 2,000 threads. A snapshot retains the 200 most recent non-running threads per source plus every thread with an explicit running status.
