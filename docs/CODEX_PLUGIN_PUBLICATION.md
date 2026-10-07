# Codex plugin publication readiness

Checked against OpenAI documentation on 2026-10-07. This is a community repository package,
not an official/approved directory listing. The current Codex compatibility manifest is supported;
a format migration would not resolve the local-execution constraint.

## Included in 0.4.0

- Versioned runnable MCP server/UI, skill, optional hooks, icons and bundled license notices.
- Directory-length subtitle, product description with local prerequisites/limits, repository and
  support links, and a listing color meeting the stated 2:1 contrast threshold against white.
- Onboarding points to the existing Gajendra skill. Five positive and three negative reviewer
  cases and release notes are included in `extensions.com.openai`.
- Current synthetic screenshots and six automated product evals accompany the separate manual host reviewer cases.
- Source install/update instructions and factual [privacy information](../PRIVACY.md).
- Exact-ID actions, expected revisions, explicit mutation intent, source opt-in, guarded links,
  no prompt/transcript storage, bounded metadata discovery and independent inline MCP App support.

## Remaining submission decisions

| Requirement | Current status / next action |
| --- | --- |
| MCP availability | Local stdio. OpenAI documents public HTTPS for With MCP; contact OpenAI for local MCP support if a public endpoint is unsuitable. No remote bridge is authorized or implemented. |
| Publisher | Owner must select/verify the developer identity and obtain dashboard access. No identity or approval is inferred from GitHub ownership. |
| Public URLs | Repository, support and [privacy information](https://github.com/siddath/Gajendra/blob/main/PRIVACY.md) are public. Enter those stable URLs during an authorized submission; owner-approved terms and any required domain verification remain. MIT is the code license, not an invented hosted-service agreement. |
| Reviewer access | Provide an approved local-MCP test route and synthetic walkthrough once the submission route is confirmed. No personal catalog or provider credentials should be supplied. |
| Images/demo | Use synthetic current product data. A local screenshot is not a hosted reviewer recording or approved store asset. |
| Platform verification | macOS local workflow is the tested target; cloud-only, mobile and other native platforms are not claimed. |
| Review and publish | Upload/validation, OpenAI review and publication are separate steps. None is claimed complete here. |

Do not submit a skills-only placeholder: the current submission guide says MCP cannot later be
added to an existing skills-only plugin. Do not put a fabricated HTTPS endpoint into this package.
The local repository marketplace remains the useful distribution route meanwhile.

Sources: [Package your plugin](https://developers.openai.com/plugins/build/plugins),
[Upload and submit](https://developers.openai.com/plugins/deploy/submission),
[Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines).
