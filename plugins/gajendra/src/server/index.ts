import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import type { DeckMutation, DeckSnapshot } from "../shared/contracts.js";
import { GajendraService } from "./service.js";

export const RESOURCE_URI = "ui://gajendra/app-v1.html";

type DeckService = Pick<GajendraService, "snapshot" | "mutate">;

const deckMutationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set-level"), threadId: z.string().min(1), level: z.enum(["focus", "important"]).nullable() }),
  z.object({ type: z.literal("set-current"), threadId: z.string().min(1) }),
  z.object({ type: z.literal("move"), threadId: z.string().min(1), direction: z.enum(["up", "down"]) }),
  z.object({ type: z.literal("set-context"), threadId: z.string().min(1), context: z.enum(["design", "engineering", "life"]).nullable() }),
  z.object({ type: z.literal("set-collapsed"), level: z.enum(["focus", "important"]), collapsed: z.boolean() }),
  z.object({ type: z.literal("set-source-enabled"), sourceId: z.string().min(1), enabled: z.boolean() }),
]);

export function createGajendraServer(service: DeckService = new GajendraService()): McpServer {
  const server = new McpServer({ name: "gajendra", version: "0.3.1" });

  registerAppResource(server, "gajendra-ui", RESOURCE_URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: await loadUiHtml() }],
  }));

  registerAppTool(server, "gajendra_open", {
    title: "Gaja, Elephant Focus for AI Power Users",
    description: "Open one unified focus queue across configured AI-agent thread sources.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: {
      ui: { resourceUri: RESOURCE_URI, visibility: ["app"] },
      "openai/outputTemplate": RESOURCE_URI,
      "openai/widgetAccessible": true,
      "openai/ui": { entrypoints: [{ type: "global" }] },
    },
  }, async () => toolResult(await service.snapshot()));

  registerAppTool(server, "gajendra_set_level", {
    title: "Set thread priority",
    description: "Add, move, or remove one agent thread in Gaja.",
    inputSchema: { threadId: z.string().min(1), level: z.enum(["focus", "important"]).nullable() },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { ui: { visibility: ["app"] } },
  }, async ({ threadId, level }: { threadId: string; level: "focus" | "important" | null }) =>
    toolResult(await service.mutate({ type: "set-level", threadId, level })));

  registerAppTool(server, "gajendra_set_current", {
    title: "Set current focus",
    description: "Make one thread from any configured source the single NOW item.",
    inputSchema: { threadId: z.string().min(1) },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { ui: { visibility: ["app"] } },
  }, async ({ threadId }: { threadId: string }) => toolResult(await service.mutate({ type: "set-current", threadId })));

  registerAppTool(server, "gajendra_move", {
    title: "Move prioritized thread",
    description: "Move one thread up or down within its Gaja section.",
    inputSchema: { threadId: z.string().min(1), direction: z.enum(["up", "down"]) },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
    _meta: { ui: { visibility: ["app"] } },
  }, async ({ threadId, direction }: { threadId: string; direction: "up" | "down" }) =>
    toolResult(await service.mutate({ type: "move", threadId, direction })));

  registerAppTool(server, "gajendra_set_context", {
    title: "Set thread context",
    description: "Assign or clear one bounded Gaja context label on a prioritized thread.",
    inputSchema: { threadId: z.string().min(1), context: z.enum(["design", "engineering", "life"]).nullable() },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { ui: { visibility: ["app"] } },
  }, async ({ threadId, context }: { threadId: string; context: "design" | "engineering" | "life" | null }) =>
    toolResult(await service.mutate({ type: "set-context", threadId, context })));

  registerAppTool(server, "gajendra_set_collapsed", {
    title: "Set section visibility",
    description: "Persist whether a Gaja priority section is collapsed.",
    inputSchema: { level: z.enum(["focus", "important"]), collapsed: z.boolean() },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { ui: { visibility: ["app"] } },
  }, async ({ level, collapsed }: { level: "focus" | "important"; collapsed: boolean }) =>
    toolResult(await service.mutate({ type: "set-collapsed", level, collapsed })));

  registerAppTool(server, "gajendra_set_source_enabled", {
    title: "Set thread source availability",
    description: "Enable or disable a local Gaja thread source. Claude metadata discovery remains opt-in.",
    inputSchema: { sourceId: z.string().min(1), enabled: z.boolean() },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { ui: { visibility: ["app"] } },
  }, async ({ sourceId, enabled }: { sourceId: string; enabled: boolean }) =>
    toolResult(await service.mutate({ type: "set-source-enabled", sourceId, enabled })));

  return server;
}

function toolResult(snapshot: DeckSnapshot) {
  const readySources = snapshot.sources.filter((source) => source.state === "ready").length;
  return {
    structuredContent: snapshot,
    content: [{
      type: "text" as const,
      text: snapshot.error
        ? `Gaja could not read configured threads: ${snapshot.error}`
        : `Gaja has ${snapshot.focus.length} focus threads and ${snapshot.important.length} important threads across ${readySources} ready sources.`,
    }],
  };
}

async function loadUiHtml(): Promise<string> {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(currentDirectory, "gajendra.html"),
    path.join(currentDirectory, "..", "dist", "gajendra.html"),
    path.join(currentDirectory, "..", "..", "dist", "gajendra.html"),
  ];
  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf8");
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
    }
  }
  throw new Error("Gaja UI bundle is missing. Run npm run build.");
}

export async function runCompanionCommand(command: "snapshot" | "mutate", input: string, service: DeckService): Promise<DeckSnapshot> {
  if (command === "snapshot") return service.snapshot();
  const mutation = deckMutationSchema.parse(JSON.parse(input) as unknown) as DeckMutation;
  return service.mutate(mutation);
}

const companionCommand = process.argv.includes("--snapshot-json")
  ? "snapshot"
  : process.argv.includes("--mutate-json") ? "mutate" : null;

if (companionCommand) {
  const service = new GajendraService();
  try {
    const input = companionCommand === "mutate" ? await readStandardInput() : "";
    process.stdout.write(`${JSON.stringify(await runCompanionCommand(companionCommand, input, service))}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Gajendra companion command failed."}\n`);
    process.exitCode = 1;
  } finally {
    await service.close();
  }
} else if (process.argv.includes("--stdio")) {
  const service = new GajendraService();
  const server = createGajendraServer(service);
  const shutdown = async () => {
    await service.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  await server.connect(new StdioServerTransport());
}

async function readStandardInput(): Promise<string> {
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) input += chunk;
  return input;
}
