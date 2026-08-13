import { readFile, writeFile } from "node:fs/promises";

const files = process.argv.slice(2);

for (const file of files.length ? files : ["dist/gajendra.html", "dist/server.mjs"]) {
  const source = await readFile(file, "utf8");
  const normalized = source.replace(/[\t ]+\r?\n/gu, "\n");
  await writeFile(file, normalized, "utf8");
}
