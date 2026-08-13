import type { DeckSnapshot } from "../shared/contracts.js";

export const fixtureSnapshot: DeckSnapshot = {
  generatedAt: "2026-08-12T12:00:00.000Z",
  current: null,
  focus: [
    {
      id: "codex:00000000-0000-7000-8000-000000000001",
      sourceId: "codex", sourceName: "Codex",
      title: "Ship the Gaja source release", project: "gajendra",
      updatedAt: 1786545400, status: "active", level: "focus", isCurrent: true,
      deepLink: "codex://threads/00000000-0000-7000-8000-000000000001",
    },
    {
      id: "claude:11111111-1111-4111-8111-111111111111",
      sourceId: "claude", sourceName: "Claude Code",
      title: "Review the multi-agent adapter contract", project: "agent-platform",
      updatedAt: 1786541800, status: "resumable", level: "focus", isCurrent: false,
      deepLink: "gajendra://thread/claude%3A11111111-1111-4111-8111-111111111111",
    },
  ],
  important: [{
    id: "cursor:22222222-2222-4222-8222-222222222222",
    sourceId: "cursor", sourceName: "Cursor",
    title: "Prepare the release readiness checklist", project: "desktop-client",
    updatedAt: 1786538200, status: "resumable", level: "important", isCurrent: false,
    deepLink: "gajendra://thread/cursor%3A22222222-2222-4222-8222-222222222222",
  }],
  available: [
    {
      id: "codex:available-1", sourceId: "codex", sourceName: "Codex",
      title: "Plan this week across projects", project: "workspace",
      updatedAt: 1786534600, status: "notLoaded", level: null, isCurrent: false,
      deepLink: "codex://threads/available-1",
    },
    {
      id: "windsurf:available-2", sourceId: "windsurf", sourceName: "Windsurf",
      title: "Investigate the CI performance regression", project: "build-tools",
      updatedAt: 1786531000, status: "active", level: null, isCurrent: false,
      deepLink: "https://example.invalid/thread/available-2",
    },
  ],
  collapsed: { focus: false, important: false },
  focusGuide: 5,
  focusOverGuide: false,
  staleEntryCount: 0,
  source: "fixture",
  sources: [
    { id: "codex", name: "Codex", kind: "builtin", state: "ready", enabled: true, threadCount: 2, detail: null },
    { id: "claude", name: "Claude Code", kind: "builtin", state: "ready", enabled: true, threadCount: 1, detail: null },
    { id: "cursor", name: "Cursor", kind: "builtin", state: "ready", enabled: true, threadCount: 1, detail: null },
    { id: "windsurf", name: "Windsurf", kind: "configured", state: "ready", enabled: true, threadCount: 1, detail: null },
  ],
  error: null,
};
fixtureSnapshot.current = fixtureSnapshot.focus[0] ?? null;
