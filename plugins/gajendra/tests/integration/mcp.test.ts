import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";

import { fixtureSnapshot } from "../../src/ui/fixtures.js";
import type { DeckMutation, DeckSnapshot } from "../../src/shared/contracts.js";
import { createGajendraServer, RESOURCE_URI, runCompanionCommand } from "../../src/server/index.js";

const closeCallbacks: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closeCallbacks.splice(0).map((close) => close()));
});

describe("Gaja MCP contract", () => {
  it("advertises one experimental global entry point with a standard MCP App resource", async () => {
    const { client } = await connect();
    const tools = await client.listTools();
    const open = tools.tools.find((tool) => tool.name === "gajendra_open");

    expect(open?._meta?.ui).toEqual({ resourceUri: RESOURCE_URI, visibility: ["app"] });
    expect(open?._meta?.["openai/ui"]).toEqual({ entrypoints: [{ type: "global" }] });
    expect(tools.tools.filter((tool) => tool._meta?.["openai/ui"])).toHaveLength(1);
    expect(tools.tools).toHaveLength(6);

    const resource = await client.readResource({ uri: RESOURCE_URI });
    expect(resource.contents[0]?.mimeType).toBe("text/html;profile=mcp-app");
    const firstContent = resource.contents[0];
    expect(firstContent && "text" in firstContent ? firstContent.text : "").toContain("Gaja, Elephant Focus for AI Power Users");
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
    const mutations: DeckMutation[] = [];
    const { client } = await connect(mutations);
    await client.callTool({
      name: "gajendra_set_current",
      arguments: { threadId: "claude:focus-2" },
    });
    expect(mutations).toEqual([{ type: "set-current", threadId: "claude:focus-2" }]);
  });

  it("exposes the same service through the companion JSON command", async () => {
    const mutations: DeckMutation[] = [];
    const service = {
      snapshot: async (): Promise<DeckSnapshot> => structuredClone(fixtureSnapshot),
      mutate: async (mutation: DeckMutation): Promise<DeckSnapshot> => {
        mutations.push(mutation);
        return structuredClone(fixtureSnapshot);
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
    expect(mutations).toEqual([{ type: "set-level", threadId: "recent-1", level: "important" }]);
    await expect(runCompanionCommand("mutate", JSON.stringify({ type: "set-current", threadId: "" }), service))
      .rejects.toThrow();
  });
});

async function connect(mutations: DeckMutation[] = []) {
  const service = {
    snapshot: async (): Promise<DeckSnapshot> => structuredClone(fixtureSnapshot),
    mutate: async (mutation: DeckMutation): Promise<DeckSnapshot> => {
      mutations.push(mutation);
      return structuredClone(fixtureSnapshot);
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
