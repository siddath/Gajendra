import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";

import { fixtureSnapshot } from "../../src/ui/fixtures.js";
import {
  MUTATION_PROTOCOL_VERSION,
  type DeckMutation,
  type DeckMutationRequest,
  type DeckMutationResult,
  type DeckSnapshot,
} from "../../src/shared/contracts.js";
import { createGajendraServer, RESOURCE_URI, runCompanionCommand } from "../../src/server/index.js";

const closeCallbacks: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closeCallbacks.splice(0).map((close) => close()));
});

describe("Gajendra MCP contract", () => {
  it("advertises sidebar and conversation entrypoints with a standard inline-capable MCP App resource", async () => {
    const { client } = await connect();
    const tools = await client.listTools();
    const open = tools.tools.find((tool) => tool.name === "gajendra_open");

    expect(open?._meta?.ui).toEqual({ resourceUri: RESOURCE_URI, visibility: ["app", "model"] });
    expect(open?._meta?.["openai/ui"]).toEqual({ entrypoints: [{ type: "global" }, { type: "thread" }] });
    expect(tools.tools.filter((tool) => tool._meta?.["openai/ui"])).toHaveLength(1);
    expect(tools.tools).toHaveLength(12);
    expect(tools.tools.find((tool) => tool.name === "gajendra_move")?.annotations?.idempotentHint).toBe(false);

    const resource = await client.readResource({ uri: RESOURCE_URI });
    expect(resource.contents[0]?.mimeType).toBe("text/html;profile=mcp-app");
    expect(resource.contents[0]?._meta?.["openai/ui"]).toEqual({
      preferredDisplayMode: "fullscreen", availableDisplayModes: ["inline", "fullscreen"],
    });
    const firstContent = resource.contents[0];
    expect(firstContent && "text" in firstContent ? firstContent.text : "").toContain("One clear focus across your AI tools.");
  });

  it("exposes requested focus and review actions to the model while preserving the app", async () => {
    const { client } = await connect();
    const tools = await client.listTools();
    expect(tools.tools.every((tool) => (tool._meta?.ui as { visibility?: string[] })?.visibility?.includes("app"))).toBe(true);
    expect(tools.tools.filter((tool) =>
      (tool._meta?.ui as { visibility?: string[] })?.visibility?.includes("model"),
    ).map((tool) => tool.name).sort()).toEqual([
      "gajendra_link_continuation", "gajendra_open", "gajendra_set_current", "gajendra_set_level", "gajendra_set_review_acknowledged", "gajendra_set_work_completed",
    ]);


    const result = await client.callTool({ name: "gajendra_open", arguments: {} });
    expect(result.structuredContent).toMatchObject({ focusGuide: 5, source: "fixture" });
    expect(result.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "text", text: expect.stringContaining("focus threads") })]),
    );
  });

  it("uses cached launch metadata, explicit live refresh and scan-free revision invalidation", async () => {
    let liveReads = 0;
    const { client } = await connect([], {
      snapshot: async () => { liveReads += 1; return structuredClone(fixtureSnapshot); },
      cachedSnapshot: async () => ({ ...structuredClone(fixtureSnapshot), cachedAt: "2026-10-03T00:00:00.000Z" }),
      sync: async () => ({ revision: 42 }),
    });
    expect((await client.callTool({ name: "gajendra_open", arguments: {} })).structuredContent).toMatchObject({ cachedAt: "2026-10-03T00:00:00.000Z" });
    expect(liveReads).toBe(0);
    expect((await client.callTool({ name: "gajendra_sync", arguments: {} })).structuredContent).toEqual({ revision: 42 });
    expect(liveReads).toBe(0);
    const refreshed = await client.callTool({ name: "gajendra_open", arguments: { refresh: true } });
    expect(refreshed.structuredContent).not.toHaveProperty("cachedAt"); expect(liveReads).toBe(1);
  });

  it("carries exact lifecycle and continuity IDs through model-visible tools with CAS and replay keys", async () => {
    const mutations: DeckMutationRequest[] = []; const { client } = await connect(mutations);
    await client.callTool({ name: "gajendra_set_work_completed", arguments: {
      threadId: "codex:old", completed: false, currentThreadId: "codex:old", expectedRevision: 7, idempotencyKey: "reopen",
    } });
    await client.callTool({ name: "gajendra_link_continuation", arguments: {
      threadId: "codex:old", currentThreadId: "claude:new", expectedRevision: 8, idempotencyKey: "continue",
    } });
    expect(mutations).toEqual([
      { protocolVersion: 1, mutation: { type: "set-work-completed", threadId: "codex:old", completed: false, currentThreadId: "codex:old" }, expectedRevision: 7, idempotencyKey: "reopen" },
      { protocolVersion: 1, mutation: { type: "link-continuation", threadId: "codex:old", currentThreadId: "claude:new" }, expectedRevision: 8, idempotencyKey: "continue" },
    ]);
  });

  it("passes a typed mutation to the local service", async () => {
    const mutations: DeckMutationRequest[] = [];
    const { client } = await connect(mutations);
    await client.callTool({
      name: "gajendra_set_current",
      arguments: { threadId: "claude:focus-2" },
    });
    expect(mutations).toEqual([expect.objectContaining({
      protocolVersion: MUTATION_PROTOCOL_VERSION,
      mutation: { type: "set-current", threadId: "claude:focus-2" },
    })]);

    await client.callTool({
      name: "gajendra_set_context",
      arguments: { threadId: "claude:focus-2", context: "design" },
    });
    expect(mutations.at(-1)).toEqual(expect.objectContaining({
      mutation: { type: "set-context", threadId: "claude:focus-2", context: "design" },
    }));
    await client.callTool({
      name: "gajendra_set_review_acknowledged",
      arguments: { threadId: "codex:review-1", reviewUpdatedAt: 1_787_630_400, reviewIdentity: "a".repeat(64), acknowledged: true },
    });
    expect(mutations.at(-1)).toEqual(expect.objectContaining({
      mutation: {
        type: "set-review-acknowledged",
        threadId: "codex:review-1",
        reviewUpdatedAt: 1_787_630_400,
        reviewIdentity: "a".repeat(64),
        acknowledged: true,
      },
    }));
    await client.callTool({
      name: "gajendra_move_before",
      arguments: {
        threadId: "claude:focus-2",
        level: "focus",
        beforeThreadId: null,
        currentThreadId: "claude:focus-2",
      },
    });
    expect(mutations.at(-1)).toEqual(expect.objectContaining({
      mutation: expect.objectContaining({ type: "move-before", currentThreadId: "claude:focus-2" }),
    }));
    const invalid = await client.callTool({
      name: "gajendra_set_context",
      arguments: { threadId: "claude:focus-2", context: "strategy" },
    });
    expect(invalid.isError).toBe(true);
    const invalidReview = await client.callTool({
      name: "gajendra_set_review_acknowledged",
      arguments: { threadId: "codex:review-1", reviewUpdatedAt: -1, reviewIdentity: "a".repeat(64), acknowledged: true },
    });
    expect(invalidReview.isError).toBe(true);
  });

  it("exposes the same service through the companion JSON command", async () => {
    const mutations: DeckMutationRequest[] = [];
    const service = {
      snapshot: async (): Promise<DeckSnapshot> => structuredClone(fixtureSnapshot),
      mutate: async (mutation: DeckMutation | DeckMutationRequest): Promise<DeckMutationResult> => {
        const request = "mutation" in mutation ? mutation : { mutation };
        mutations.push(request);
        return mutationResult();
      },
    };

    await expect(runCompanionCommand("snapshot", "", service)).resolves.toMatchObject({ source: "fixture" });
    await expect(
      runCompanionCommand(
        "mutate",
        JSON.stringify({ type: "set-level", threadId: "recent-1", level: "important" }),
        service,
      ),
    ).resolves.toMatchObject({ source: "fixture" });
    expect(mutations).toEqual([{ mutation: { type: "set-level", threadId: "recent-1", level: "important" } }]);
    await expect(
      runCompanionCommand(
        "mutate",
        JSON.stringify({ protocolVersion: 1, mutation: { type: "set-current", threadId: "recent-1" }, expectedRevision: 0, idempotencyKey: "envelope" }),
        service,
      ),
    ).resolves.toMatchObject({ outcome: "applied", snapshot: { source: "fixture" } });
    await expect(runCompanionCommand("mutate", JSON.stringify({ type: "set-current", threadId: "" }), service))
      .rejects.toThrow();
    await expect(runCompanionCommand("mutate", JSON.stringify({ type: "set-context", threadId: "recent-1", context: "strategy" }), service))
      .rejects.toThrow();
  });
});

async function connect(mutations: DeckMutationRequest[] = [], overrides: { snapshot?: () => Promise<DeckSnapshot>; cachedSnapshot?: () => Promise<DeckSnapshot | null>; sync?: () => Promise<{ revision: number }> } = {}) {
  const service = {
    snapshot: async (): Promise<DeckSnapshot> => structuredClone(fixtureSnapshot),
    mutate: async (mutation: DeckMutation | DeckMutationRequest): Promise<DeckMutationResult> => {
      mutations.push("mutation" in mutation ? mutation : { mutation });
      return mutationResult();
    },
  };
  const server = createGajendraServer({ ...service, ...overrides });
  const client = new Client({ name: "gajendra-test", version: "0.3.1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  closeCallbacks.push(async () => {
    await client.close();
    await server.close();
  });
  return { client };
}

function mutationResult(): DeckMutationResult {
  return {
    protocolVersion: MUTATION_PROTOCOL_VERSION,
    outcome: "applied",
    revision: fixtureSnapshot.revision,
    snapshot: structuredClone(fixtureSnapshot),
  };
}
