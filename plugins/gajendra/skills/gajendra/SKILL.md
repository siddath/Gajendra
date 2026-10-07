---
name: gajendra
description: Use when the user wants to choose, review, finish, reopen, or explicitly continue AI-agent work in an exact chat.
---

# Gajendra

One clear focus across your AI tools.

Use the Gajendra MCP App as the visual source of truth for the user's extra priority layer.

## Getting started

Open `gajendra_open` to inspect the available sources and current priorities. This repository
plugin runs a local Node.js MCP server and needs locally installed providers; the macOS companion
is optional. Report missing prerequisites or source errors honestly. Never enable Claude discovery
or trust hooks without the user's choice. Reopen the panel/reload the host after installing updates.
A repository installation is not evidence of OpenAI directory approval.

## Operating rules

- Treat `NOW` as at most one selected open Focus task. Explicit Finish may clear NOW without choosing a replacement.
- Treat Focus as a deliberately short queue and Important as the next tier; do not invent deadlines or urgency.
- Open or resume the original provider thread for the work itself. Gajendra is an organizer, not a transcript clone.
- Never claim that Gajendra changes a provider's native pinned state. It stores only canonical source/thread IDs, order, current focus, source preferences, collapse preferences, explicit completion IDs, exact continuation relationships, a bounded NOW-selection enum, and optional bounded Design/Engineering/Life context.
- Treat context as user-assigned Gajendra metadata. Do not infer it from prompts, transcripts, titles, or provider content, and do not invent free-text labels.
- Opening is read-only. Age, inactivity, provider response completion, Stop, and SessionEnd never mean the user finished work.
- Do not copy task prompts or transcripts into Gajendra storage. The disposable local cache may retain bounded display titles, project labels and validated links; it is not authoritative user state.

## Apply an explicit request from a conversation

- For “make this my focus now”, call `gajendra_open` with `refresh: true`, resolve the canonical task ID, then call
  `gajendra_set_current`. For “add this to Focus” or “mark this important”, use
  `gajendra_set_level` with `focus` or `important` respectively.
- Resolve “this task” using the host's reliable current task ID matched to the live snapshot. A
  similar title alone is insufficient. If identity is unavailable or several tasks match, ask which
  task; never silently select the most recent task.
- Use the snapshot revision as `expectedRevision`. On conflict, reread and revalidate the target.
  Report success only after an applied result and its returned snapshot agree with the request.
- “Reviewed” acknowledges the exact current response via `gajendra_set_review_acknowledged`, using
  the snapshot's review timestamp and identity. It does not finish or archive the provider task.
- For explicit “finish this work” or “reopen this work”, use `gajendra_set_work_completed` with
  `completed: true` or `false`. Finish preserves priority metadata, History, and pending review;
  it clears NOW if this is NOW. Reopen restores Continue eligibility without inventing a new NOW.
- For an explicit continuation choice, call `gajendra_link_continuation` with the predecessor's
  exact `threadId` and successor's exact `currentThreadId`. Explain that priority/order/context/NOW
  move together and older chats remain in History. Never derive the relationship from titles.
- A cached snapshot is labeled neutral metadata. Refresh live before resolving a mutation target;
  never describe cached provider activity as current. Use a replay key for a retry of the same change.
- Optional lifecycle hooks only invalidate caches. Never trust hooks automatically, treat a hook
  event as work completion, or claim host support/trust without host evidence. Polling is the fallback.
- Apply explicit user intent without asking for the same permission again. Do not passively infer
  importance, read other conversations for commands, or run a background monitor.
- These actions require this plugin's MCP server in the current AI host. After updating the plugin,
  reload the host to refresh its tool list. Do not claim a host without these tools is connected.
