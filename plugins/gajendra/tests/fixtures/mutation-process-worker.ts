import type { AgentThread, ThreadSourceStatus } from "../../src/shared/contracts.js";
import { GajendraService } from "../../src/server/service.js";
import { GajendraStoreRepository } from "../../src/server/store.js";

const index = Number.parseInt(process.env.GAJENDRA_PROCESS_INDEX ?? "", 10);
if (!Number.isSafeInteger(index) || index < 0) throw new Error("Mutation process worker requires a non-negative index.");

const threadId = `codex:thread-${index}`;
const thread: AgentThread = {
  id: threadId,
  sourceId: "codex",
  sourceName: "Codex",
  title: threadId,
  project: "process-proof",
  updatedAt: index,
  status: "idle",
  deepLink: `gajendra://thread/${threadId}`,
  allowedDeepLinkSchemes: ["gajendra"],
};
const source: ThreadSourceStatus = {
  id: "codex",
  name: "Codex",
  kind: "builtin",
  state: "ready",
  enabled: true,
  threadCount: 1,
  detail: null,
};
const service = new GajendraService(new GajendraStoreRepository(), {
  collect: async () => ({ threads: [thread], sources: [source], error: null }),
  close: async () => undefined,
});

const result = await service.mutate({
  protocolVersion: 1,
  idempotencyKey: `process-proof-${index}`,
  mutation: { type: "set-level", threadId, level: "focus" },
});

process.stdout.write(`${JSON.stringify({ outcome: result.outcome, revision: result.revision })}\n`);
