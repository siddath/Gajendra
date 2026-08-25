import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  MUTATION_PROTOCOL_VERSION,
  type DeckMutation,
  type DeckMutationRequest,
  type DeckMutationResult,
  type DeckSnapshot,
} from "../shared/contracts.js";
import { GajendraService } from "./service.js";

export const RESOURCE_URI = "ui://gajendra/app-v1.html";

type DeckService = Pick<GajendraService, "snapshot" | "mutate">;

const mutationOptionsSchema = {
  expectedRevision: z.number().int().nonnegative().optional(),
  idempotencyKey: z.string().min(1).max(256).optional(),
};

const deckMutationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set-level"), threadId: z.string().min(1), level: z.enum(["focus", "important"]).nullable() }),
  z.object({ type: z.literal("set-current"), threadId: z.string().min(1) }),
  z.object({ type: z.literal("move"), threadId: z.string().min(1), direction: z.enum(["up", "down"]) }),
  z.object({
    type: z.literal("move-before"),
    threadId: z.string().min(1),
    level: z.enum(["focus", "important"]).nullable(),
    beforeThreadId: z.string().min(1).nullable().optional(),
    context: z.enum(["design", "engineering", "life"]).nullable().optional(),
    isCurrent: z.boolean().optional(),
    currentThreadId: z.string().min(1).nullable().optional(),
  }),
  z.object({ type: z.literal("set-context"), threadId: z.string().min(1), context: z.enum(["design", "engineering", "life"]).nullable() }),
  z.object({
    type: z.literal("set-review-acknowledged"),
    threadId: z.string().min(1),
    reviewUpdatedAt: z.number().finite().nonnegative(),
    reviewIdentity: z.string().regex(/^[a-f0-9]{64}$/iu),
    acknowledged: z.boolean(),
  }),
  z.object({ type: z.literal("set-collapsed"), level: z.enum(["focus", "important"]), collapsed: z.boolean() }),
  z.object({ type: z.literal("set-source-enabled"), sourceId: z.string().min(1), enabled: z.boolean() }),
]);

const deckMutationRequestSchema = z.object({
  protocolVersion: z.literal(MUTATION_PROTOCOL_VERSION).optional(),
  mutation: deckMutationSchema,
  ...mutationOptionsSchema,
});

export function createGajendraServer(service: DeckService = new GajendraService()): McpServer {
  const server = new McpServer({ name: "gajendra", version: "0.3.1" });

  registerAppResource(server, "gajendra-ui", RESOURCE_URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: await loadUiHtml() }],
  }));

  registerAppTool(server, "gajendra_open", {
    title: "Gajendra",
    description: "One clear focus across your AI tools.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: {
      ui: { resourceUri: RESOURCE_URI, visibility: ["app"] },
      "openai/outputTemplate": RESOURCE_URI,
      "openai/widgetAccessible": true,
      "openai/ui": { entrypoints: [{ type: "global" }] },
    },
  }, async () => snapshotToolResult(await service.snapshot()));

  registerAppTool(server, "gajendra_set_level", {
    title: "Set thread priority",
    description: "Add, move, or remove one agent thread in Gajendra.",
    inputSchema: { threadId: z.string().min(1), level: z.enum(["focus", "important"]).nullable(), ...mutationOptionsSchema },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { ui: { visibility: ["app"] } },
  }, async ({ threadId, level, expectedRevision, idempotencyKey }) => mutationToolResult(await service.mutate(requestFor(
    { type: "set-level", threadId, level }, expectedRevision, idempotencyKey,
  ))));

  registerAppTool(server, "gajendra_set_current", {
    title: "Set current focus",
    description: "Make one thread from any configured source the single NOW item.",
    inputSchema: { threadId: z.string().min(1), ...mutationOptionsSchema },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { ui: { visibility: ["app"] } },
  }, async ({ threadId, expectedRevision, idempotencyKey }) => mutationToolResult(await service.mutate(requestFor(
    { type: "set-current", threadId }, expectedRevision, idempotencyKey,
  ))));

  registerAppTool(server, "gajendra_move", {
    title: "Move prioritized thread",
    description: "Move one thread up or down within its Gajendra section.",
    inputSchema: { threadId: z.string().min(1), direction: z.enum(["up", "down"]), ...mutationOptionsSchema },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
    _meta: { ui: { visibility: ["app"] } },
  }, async ({ threadId, direction, expectedRevision, idempotencyKey }) => mutationToolResult(await service.mutate(requestFor(
    { type: "move", threadId, direction }, expectedRevision, idempotencyKey,
  ))));

  registerAppTool(server, "gajendra_move_before", {
    title: "Move thread before target",
    description: "Atomically place, append, or remove a thread while preserving one Gajendra NOW item.",
    inputSchema: {
      threadId: z.string().min(1),
      level: z.enum(["focus", "important"]).nullable(),
      beforeThreadId: z.string().min(1).nullable().optional(),
      context: z.enum(["design", "engineering", "life"]).nullable().optional(),
      isCurrent: z.boolean().optional(),
      currentThreadId: z.string().min(1).nullable().optional(),
      ...mutationOptionsSchema,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { ui: { visibility: ["app"] } },
  }, async ({ threadId, level, beforeThreadId, context, isCurrent, currentThreadId, expectedRevision, idempotencyKey }) => {
    const mutation: Extract<DeckMutation, { type: "move-before" }> = {
      type: "move-before",
      threadId,
      level,
      ...(beforeThreadId === undefined ? {} : { beforeThreadId }),
      ...(context === undefined ? {} : { context }),
      ...(isCurrent === undefined ? {} : { isCurrent }),
      ...(currentThreadId === undefined ? {} : { currentThreadId }),
    };
    return mutationToolResult(await service.mutate(requestFor(mutation, expectedRevision, idempotencyKey)));
  });

  registerAppTool(server, "gajendra_set_context", {
    title: "Set thread context",
    description: "Assign or clear one bounded Gajendra context label on a prioritized thread.",
    inputSchema: { threadId: z.string().min(1), context: z.enum(["design", "engineering", "life"]).nullable(), ...mutationOptionsSchema },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { ui: { visibility: ["app"] } },
  }, async ({ threadId, context, expectedRevision, idempotencyKey }) => mutationToolResult(await service.mutate(requestFor(
    { type: "set-context", threadId, context }, expectedRevision, idempotencyKey,
  ))));

  registerAppTool(server, "gajendra_set_review_acknowledged", {
    title: "Set review acknowledgement",
    description: "Mark one exact Ready for Review response handled or restore it without changing task priority.",
    inputSchema: {
      threadId: z.string().min(1),
      reviewUpdatedAt: z.number().finite().nonnegative(),
      reviewIdentity: z.string().regex(/^[a-f0-9]{64}$/iu),
      acknowledged: z.boolean(),
      ...mutationOptionsSchema,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { ui: { visibility: ["app"] } },
  }, async ({ threadId, reviewUpdatedAt, reviewIdentity, acknowledged, expectedRevision, idempotencyKey }) => mutationToolResult(await service.mutate(requestFor(
    { type: "set-review-acknowledged", threadId, reviewUpdatedAt, reviewIdentity, acknowledged }, expectedRevision, idempotencyKey,
  ))));

  registerAppTool(server, "gajendra_set_collapsed", {
    title: "Set section visibility",
    description: "Persist whether a Gajendra priority section is collapsed.",
    inputSchema: { level: z.enum(["focus", "important"]), collapsed: z.boolean(), ...mutationOptionsSchema },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { ui: { visibility: ["app"] } },
  }, async ({ level, collapsed, expectedRevision, idempotencyKey }) => mutationToolResult(await service.mutate(requestFor(
    { type: "set-collapsed", level, collapsed }, expectedRevision, idempotencyKey,
  ))));

  registerAppTool(server, "gajendra_set_source_enabled", {
    title: "Set thread source availability",
    description: "Enable or disable a local Gajendra thread source. Claude metadata discovery remains opt-in.",
    inputSchema: { sourceId: z.string().min(1), enabled: z.boolean(), ...mutationOptionsSchema },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { ui: { visibility: ["app"] } },
  }, async ({ sourceId, enabled, expectedRevision, idempotencyKey }) => mutationToolResult(await service.mutate(requestFor(
    { type: "set-source-enabled", sourceId, enabled }, expectedRevision, idempotencyKey,
  ))));

  return server;
}

function requestFor(mutation: DeckMutation, expectedRevision: number | undefined, idempotencyKey: string | undefined): DeckMutationRequest {
  return {
    protocolVersion: MUTATION_PROTOCOL_VERSION,
    mutation,
    ...(expectedRevision === undefined ? {} : { expectedRevision }),
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
  };
}

function snapshotToolResult(snapshot: DeckSnapshot) {
  return {
    structuredContent: snapshot,
    content: [{
      type: "text" as const,
      text: snapshot.error
        ? `Gajendra could not read configured threads: ${snapshot.error}`
        : `Gajendra has ${snapshot.focus.length} focus threads and ${snapshot.important.length} important threads across ${snapshot.sources.filter((source) => source.state === "ready").length} ready sources.`,
    }],
  };
}

function mutationToolResult(result: DeckMutationResult) {
  return {
    structuredContent: result,
    content: [{
      type: "text" as const,
      text: result.error?.message
        ?? `Gajendra applied a change at revision ${result.revision}.`,
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
  throw new Error("Gajendra UI bundle is missing. Run npm run build.");
}

export async function runCompanionCommand(
  command: "snapshot" | "mutate",
  input: string,
  service: DeckService,
): Promise<DeckSnapshot | DeckMutationResult> {
  if (command === "snapshot") return service.snapshot();
  const parsed = JSON.parse(input) as unknown;
  const request = deckMutationRequestSchema.safeParse(parsed);
  if (request.success) return service.mutate(request.data as DeckMutationRequest);
  const legacyMutation = deckMutationSchema.parse(parsed) as DeckMutation;
  const result = await service.mutate(legacyMutation);
  // Existing native clients decode a raw DeckSnapshot. New envelope callers receive the typed result.
  return result.snapshot;
}

const companionCommand = process.argv.includes("--snapshot-json")
  ? "snapshot"
  : process.argv.includes("--mutate-json") ? "mutate" : null;

if (companionCommand) {
  const service = new GajendraService();
  try {
    const input = companionCommand === "mutate" ? await readStandardInput() : "";
    process.stdout.write(`${JSON.stringify(await runCompanionCommand(companionCommand, input, service))}\n`);
  } catch {
    process.stderr.write("Gajendra companion command was rejected.\n");
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
