# Thread source configuration

Gaja 0.3.1 includes three built-in adapters and a conservative JSON-catalog adapter for other AI agents. Gajendra names remain in configuration paths and environment variables for compatibility.

## Built-in sources

- Codex is enabled by default and uses the local app-server.
- Cursor is enabled by default; an absent `cursor-agent` is reported as `not-installed`.
- Claude Code is disabled by default because enabling it reads local session metadata. Enable or disable any source from the organizer’s source chips.

Executable overrides are optional:

```bash
export GAJENDRA_CODEX_BIN="/absolute/path/to/codex"
export GAJENDRA_CLAUDE_BIN="/absolute/path/to/claude"
export GAJENDRA_CURSOR_BIN="/absolute/path/to/cursor-agent"
```

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

Set `GAJENDRA_SOURCES_CONFIG` to test a different configuration file. Catalogs are capped at 2 MiB and 2,000 threads; at most 200 normalized threads per source enter a snapshot.
