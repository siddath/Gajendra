import type { AgentThread, ThreadSourceStatus } from "../../src/shared/contracts.js";
import { GajendraService } from "../../src/server/service.js";
import { GajendraStoreRepository } from "../../src/server/store.js";

if (!process.env.GAJENDRA_DATA_DIR) throw new Error("Fault worker requires GAJENDRA_DATA_DIR.");

const ids = ["codex:thread-0", "codex:thread-1", "claude:thread-a"];
const threads: AgentThread[] = ids.map((id) => ({
  id,
  sourceId: id.split(":")[0] ?? "codex",
  sourceName: id.startsWith("claude:") ? "Claude Code" : "Codex",
  title: id,
  project: "fault-proof",
  updatedAt: 1,
  status: "idle",
  deepLink: `gajendra://thread/${id}`,
  allowedDeepLinkSchemes: ["gajendra"],
}));
const sources: ThreadSourceStatus[] = [
  { id: "codex", name: "Codex", kind: "builtin", state: "ready", enabled: true, threadCount: 2, detail: null },
  { id: "claude", name: "Claude Code", kind: "builtin", state: "ready", enabled: true, threadCount: 1, detail: null },
];

const repository = new GajendraStoreRepository(undefined, undefined, {
  lockTimeoutMs: 50,
  staleLockMs: 50,
  onPrimaryWritten: () => process.exit(86),
});
const service = new GajendraService(repository, {
  collect: async () => ({ threads, sources, error: null }),
  close: async () => undefined,
});

await service.mutate({ mutation: {
  type: "move-before",
  threadId: "claude:thread-a",
  level: "focus",
  beforeThreadId: "codex:thread-0",
  context: "design",
  currentThreadId: "claude:thread-a",
} });

throw new Error("The primary-write fault hook did not terminate the worker.");
