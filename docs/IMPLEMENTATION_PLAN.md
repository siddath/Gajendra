# Implementation and adoption plan

## Decision enabled

The project decides whether one local focus layer across AI-agent sessions changes what the user opens next.

- Product/adoption owner: the user.
- Implementation owner: repository maintainers.
- Publication owner: the user.
- Deadline: none supplied.
- Local stop condition: the 0.3 gauntlet, installation, provider status, installed UI, and documentation reconciliation pass.
- Adoption stop condition: three deliberate uses during a reversible 14-day trial, including one NOW change that changes the next opened thread.

## Delivery phases

| Phase | Outcome | State |
| --- | --- | --- |
| Contract | One global NOW, metadata-only state, source-owned sessions | Complete |
| Registry | Codex, Claude, Cursor, and configured catalog adapters | Complete locally |
| Native UX | Bottom-right hover utility and resizable organizer | Complete locally |
| Apple alignment | Liquid Glass gate, material fallback, standard controls, accessibility | Complete locally |
| Portable UI | Inline MCP App plus experimental global metadata hint | Complete locally |
| Gauntlet/install | Fail-fast verification and installed-build proof | Final run pending |
| Source publication | Public remote, hosted CI, release/tag | Owner action pending |
| Binary publication | Developer ID, notarization, Gatekeeper proof | Separate future gate |

## Adoption experiment

Success requires:

1. three deliberate returns through the lotus;
2. one NOW change that alters the next resumed session;
3. at least two source apps used without duplicating priorities elsewhere.

Kill the trial if the utility becomes visual noise, hover reveals accidentally, source metadata is materially stale, resume repeatedly fails, or queue upkeep duplicates work.

## Deferred WidgetKit surface

A WidgetKit extension becomes eligible only when users identify a passive desktop/Notification Center moment that the floating utility does not serve. It must open `gajendra://thread/...`, use an explicitly designed shared container, and never create a second priority store.
