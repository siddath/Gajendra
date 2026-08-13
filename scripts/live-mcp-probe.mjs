import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "gajendra-probe-"));
const serverPath = path.resolve("plugins/gajendra/dist/server.mjs");
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath, "--stdio"],
  env: { ...process.env, GAJENDRA_DATA_DIR: dataDirectory },
});
const client = new Client({ name: "gajendra-live-probe", version: "0.3.1" });

try {
  await client.connect(transport);
  const tools = await client.listTools();
  const open = tools.tools.find((tool) => tool.name === "gajendra_open");
  if (!open) throw new Error("gajendra_open is missing");
  if (JSON.stringify(open._meta?.["openai/ui"]) !== JSON.stringify({ entrypoints: [{ type: "global" }] })) {
    throw new Error("experimental global entry point metadata is missing");
  }
  const resource = await client.readResource({ uri: "ui://gajendra/app-v1.html" });
  if (resource.contents[0]?.mimeType !== "text/html;profile=mcp-app") {
    throw new Error("MCP App resource MIME type is invalid");
  }
  const result = await client.callTool({ name: "gajendra_open", arguments: {} });
  const snapshot = result.structuredContent;
  if (!snapshot || snapshot.source !== "gajendra-registry" || snapshot.error) {
    throw new Error(`live snapshot failed: ${snapshot?.error ?? "missing structured content"}`);
  }
  console.log(
    JSON.stringify({
      toolCount: tools.tools.length,
      uiResource: resource.contents[0]?.mimeType,
      globalEntrypoint: true,
      codexAppServer: "reachable",
      threadCount: Array.isArray(snapshot.available) ? snapshot.available.length : null,
      sourceCount: Array.isArray(snapshot.sources) ? snapshot.sources.length : null,
    }),
  );
} finally {
  await client.close().catch(() => undefined);
  await rm(dataDirectory, { recursive: true, force: true });
}
