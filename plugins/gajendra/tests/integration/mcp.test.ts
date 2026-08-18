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
  it("advertises one experimental global entry point with a standard MCP App resource", async () => {
    const { client } = await connect();
    const tools = await client.listTools();
    const open = tools.tools.find((tool) => tool.name === "gajendra_open");

    expect(open?._meta?.ui).toEqual({ resourceUri: RESOURCE_URI, visibility: ["app"] });
    expect(open?._meta?.["openai/ui"]).toEqual({ entrypoints: [{ type: "global" }] });
    expect(tools.tools.filter((tool) => tool._meta?.["openai/ui"])).toHaveLength(1);
    expect(tools.tools).toHaveLength(8);
    expect(tools.tools.find((tool) => tool.name === "gajendra_move")?.annotations?.idempotentHint).toBe(false);

    const resource = await client.readResource({ uri: RESOURCE_URI });
    expect(resource.contents[0]?.mimeType).toBe("text/html;profile=mcp-app");
    const firstContent = resource.contents[0];
    expect(firstContent && "text" in firstContent ? firstContent.text : "").toContain("One clear focus across your AI tools.");
  });

  it("keeps tools app-only and returns a meaningful non-UI fallback", async () => {
    const { client } = await connect();
    const tools = await client.listTools();
    expect(tools.tools.every((tool) => (tool._meta?.ui as { visibility?: string[] })?.visibility?.includes("app"))).toBe(true);

    const result = await client.callTool({ name: "gajendra_open", arguments: {} });
    expect(result.structuredContent).toMatchObject({ focusGuide: 5, source: "fixture" });
    expect(result.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "text", text: expect.stringContaining("focus threads") })]),
    );
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

async function connect(mutations: DeckMutationRequest[] = []) {
  const service = {
    snapshot: async (): Promise<DeckSnapshot> => structuredClone(fixtureSnapshot),
    mutate: async (mutation: DeckMutation | DeckMutationRequest): Promise<DeckMutationResult> => {
      mutations.push("mutation" in mutation ? mutation : { mutation });
      return mutationResult();
    },
  };
  const server = createGajendraServer(service);
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
