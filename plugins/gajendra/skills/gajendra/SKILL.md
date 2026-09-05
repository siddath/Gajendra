---
name: gajendra
description: Use when the user wants to choose, review, or reorganize AI-agent threads that deserve immediate focus.
---

# Gajendra

One clear focus across your AI tools.

Use the Gajendra MCP App as the visual source of truth for the user's extra priority layer.

## Operating rules

- Treat `NOW` as singular. If several tasks seem equally urgent, help the user choose one.
- Treat Focus as a deliberately short queue and Important as the next tier; do not invent deadlines or urgency.
- Open or resume the original provider thread for the work itself. Gajendra is an organizer, not a transcript clone.
- Never claim that Gajendra changes a provider's native pinned state. It stores only canonical source/thread IDs, order, current focus, source preferences, collapse preferences, and an optional bounded Design/Engineering/Life context.
- Treat context as user-assigned Gajendra metadata. Do not infer it from prompts, transcripts, titles, or provider content, and do not invent free-text labels.
- Do not copy task prompts or transcripts into Gajendra storage.

## Apply an explicit request from a conversation

- For “make this my focus now”, call `gajendra_open`, resolve the canonical task ID, then call
  `gajendra_set_current`. For “add this to Focus” or “mark this important”, use
  `gajendra_set_level` with `focus` or `important` respectively.
- Resolve “this task” using the host's reliable current task ID matched to the live snapshot. A
  similar title alone is insufficient. If identity is unavailable or several tasks match, ask which
  task; never silently select the most recent task.
- Use the snapshot revision as `expectedRevision`. On conflict, reread and revalidate the target.
  Report success only after an applied result and its returned snapshot agree with the request.
- “Reviewed” acknowledges the exact current response via `gajendra_set_review_acknowledged`, using
  the snapshot's review timestamp and identity. It does not finish or archive the provider task.
- Apply explicit user intent without asking for the same permission again. Do not passively infer
  importance, read other conversations for commands, or run a background monitor.
- These actions require this plugin's MCP server in the current AI host. After updating the plugin,
  reload the host to refresh its tool list. Do not claim a host without these tools is connected.
