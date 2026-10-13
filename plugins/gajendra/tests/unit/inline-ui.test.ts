import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { afterEach, describe, expect, it } from "vitest";
import { build } from "vite";
import config from "../../vite.config.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(html: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), "gajendra-inline-ui-"));
  temporaryRoots.push(root);
  await writeFile(path.join(root, "gajendra.html"), html);
  return root;
}

describe("self-contained UI build", () => {
  it("embeds executable JS and CSS safely while preserving the separately built server", async () => {
    const root = await fixture('<html><head></head><body><script type="module" src="/main.js"></script></body></html>');
    const payload = "</ScRiPt><!-- fixture text";
    await writeFile(path.join(root, "main.js"), `import './style.css'; globalThis.fixtureValue = ${JSON.stringify(payload)};`);
    await writeFile(path.join(root, "style.css"), ':root { --fixture: "</StYlE><script>not code</script>"; }');
    await mkdir(path.join(root, "dist"));
    await writeFile(path.join(root, "dist/server.mjs"), "separately built server");
    await build({ ...config, configFile: false, root, logLevel: "silent" });

    expect((await readdir(path.join(root, "dist"))).sort()).toEqual(["gajendra.html", "server.mjs"]);
    expect(await readFile(path.join(root, "dist/server.mjs"), "utf8")).toBe("separately built server");
    const html = await readFile(path.join(root, "dist/gajendra.html"), "utf8");
    const withoutStyles = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, "");
    expect(withoutStyles.match(/<script\b/giu)).toHaveLength(1);
    expect(withoutStyles.match(/<\/script\s*>/giu)).toHaveLength(1);
    expect(html.match(/<\/style\s*>/giu)).toHaveLength(1);
    expect(html).not.toMatch(/(?:src|href)="\.\/ui\.(?:js|css)"/u);
    const code = /<script\b[^>]*>([\s\S]*?)<\/script>/iu.exec(withoutStyles)?.[1];
    expect(code).toBeDefined();
    const context = { document: { createElement: () => ({ relList: { supports: () => true } }) }, fixtureValue: "" };
    vm.runInNewContext(code!, context);
    expect(context.fixtureValue).toBe(payload);
  });

  it("rejects an incomplete entry instead of publishing HTML without its UI", async () => {
    const root = await fixture("<html><head></head><body>missing application</body></html>");
    await expect(build({ ...config, configFile: false, root, logLevel: "silent" }))
      .rejects.toThrow("Expected one Gajendra HTML entry and its fixed JS/CSS bundles.");
  });
});
