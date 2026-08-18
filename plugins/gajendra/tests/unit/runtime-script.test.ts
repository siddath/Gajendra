import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const runtimeFetchScript = fileURLToPath(new URL("../../../../companion/macos/scripts/fetch-node-runtime.zsh", import.meta.url));

describe("bundled Node runtime fetch script", () => {
  it("reconstructs its runtime cache only after verifying the pinned archive", async () => {
    const script = await readFile(runtimeFetchScript, "utf8");
    const checksum = script.indexOf("actual_sha256=");
    const extraction = script.indexOf('/usr/bin/tar -xzf "$archive_path"');

    expect(checksum).toBeGreaterThanOrEqual(0);
    expect(extraction).toBeGreaterThan(checksum);
    expect(script).not.toContain('if [[ ! -x "$runtime_binary" ]]; then');
    expect(script).toContain('/bin/rm -rf "$runtime_dir"');
    expect(script).toContain('Verified Node archive did not produce a usable runtime.');
  });
});
