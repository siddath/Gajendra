# Gajendra privacy information

Gajendra is an open-source local organizer. The project does not operate a hosted account,
analytics service, advertising service or transcript store for this package.

## Local data

The authoritative private state retains namespaced thread IDs, priority/order/NOW, source and
collapse preferences, optional Design/Engineering/Life labels, explicit completion/continuation
relationships, revisions and bounded hashed review/retry receipts. A disposable cache can contain
thread display titles, project labels, IDs, validated destinations and timestamps. These can be
private. Separate bounded completion metadata supports review detection. Prompts, transcript
bodies, credentials, executable resume commands and raw provider responses are not cached.

The local adapters read bounded metadata from enabled providers. Claude Code discovery is opt-in.
Gajendra does not change provider databases, conversations or transcripts. Opening a task hands
its validated destination to the configured provider. The native and MCP clients share an
owner-private local backend; it exposes no public network listener.

## AI host and external destinations

When used through Codex, returned thread metadata and user requests are available to that host
and may enter its model context under your host/account settings. This document does not replace
OpenAI or another provider's privacy policy. A GitHub support report is also public unless you use
a private security advisory. Do not include private titles, IDs, logs or credentials in public issues.

## Control and removal

Disable sources in settings to stop their discovery. Optional hooks require host trust. Disable
metadata reuse with `GAJENDRA_METADATA_CACHE=off` and restart clients. Local state and disposable
cache live in the configured Gajendra data directory; uninstall/recovery guidance is in the user
guide. Preserve a backup before removing state if you want to retain priorities. Removing
Gajendra metadata does not delete the provider's conversations.

See [Security](SECURITY.md), [Support](SUPPORT.md) and [MIT license](LICENSE). This describes the
repository package, not a remote service or an approved directory submission.
