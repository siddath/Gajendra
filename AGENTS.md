# Gajendra agent contract

Read `README.md`, `docs/ARCHITECTURE.md`, `docs/COMPATIBILITY.md`, `docs/THREAD_SOURCES.md`, `docs/GAUNTLET.md`, and `SECURITY.md` before implementation changes.

Preserve these hard boundaries:

- one global NOW, and it must belong to Focus;
- canonical thread IDs are namespaced by source;
- no direct provider database, signed-app, feature-rollout, prompt, or transcript mutation;
- persist only Gajendra priority/source preferences, never live thread content;
- Claude metadata scanning stays opt-in;
- generic sources are explicit bounded catalogs, not arbitrary directory or command discovery;
- migrate Aadi/Priority Deck state by copy, never destructive move;
- the standard inline MCP App must survive removal of the experimental global entry point;
- the floating utility must not be described as a WidgetKit extension;
- do not claim native behavior, provider resume, publication, signing, or notarization without matching proof;
- run `npm run check` for ordinary changes and `npm run gauntlet` before release claims.
