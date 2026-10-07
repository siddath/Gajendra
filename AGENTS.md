# Gajendra agent contract

Read `README.md`, `docs/ARCHITECTURE.md`, `docs/COMPATIBILITY.md`, `docs/THREAD_SOURCES.md`, `docs/GAUNTLET.md`, and `SECURITY.md` before implementation changes.

Preserve these hard boundaries:

- at most one global NOW, and any selected NOW must belong to open Focus work; explicit Finish may clear NOW without promoting another task;
- canonical thread IDs are namespaced by source;
- no direct provider database, signed-app, feature-rollout, prompt, or transcript mutation;
- persist only Gajendra priority/source preferences, bounded Design/Engineering/Life context, explicit completion IDs, exact continuation relationships, and the bounded NOW-selection enum in the authoritative store; the user-authorized disposable metadata cache is governed by SECURITY.md and docs/DAILY-WIDGET.md; never cache prompts, transcripts, commands, raw responses, or free-text labels;
- opening is read-only; provider completion, inactivity, age, Stop, and SessionEnd never imply explicit user work completion;
- optional lifecycle hooks only invalidate disposable metadata, require host trust, and must never steer a conversation or mutate priorities; polling remains the fallback;
- Claude metadata scanning stays opt-in;
- generic sources are explicit bounded catalogs, not arbitrary directory or command discovery;
- migrate Aadi/Priority Deck state by copy, never destructive move;
- the standard inline MCP App must survive removal of the experimental global entry point;
- the floating utility must not be described as a WidgetKit extension;
- do not claim native behavior, provider resume, publication, signing, or notarization without matching proof;
- run `npm run check` for ordinary changes and `npm run gauntlet` before release claims.
