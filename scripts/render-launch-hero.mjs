import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const launchRoot = path.join(repositoryRoot, "evidence", "launch");
const background = await pngDataUrl(path.join(launchRoot, "gajendra-hero-background.png"));
const product = await pngDataUrl(path.join(launchRoot, "gajendra-launch-overview.png"));
const mark = await svgDataUrl(path.join(repositoryRoot, "plugins", "gajendra", "assets", "gajendra.svg"));
const output = path.join(launchRoot, "gajendra-hero.png");

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
  await page.setContent(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1536px; height: 1024px; overflow: hidden; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif;
      color: #171b20;
      background: #edf4f7 url("${background}") center / cover no-repeat;
    }
    .veil {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(90deg, rgba(247, 250, 250, .92) 0%, rgba(247, 250, 250, .8) 34%, rgba(247, 250, 250, .12) 68%),
        radial-gradient(circle at 18% 64%, rgba(255, 204, 100, .22), transparent 31%);
    }
    .copy {
      position: absolute;
      left: 92px;
      top: 104px;
      width: 540px;
      z-index: 2;
    }
    .brand { display: flex; align-items: center; gap: 20px; }
    .mark {
      width: 92px;
      height: 92px;
      padding: 14px;
      border-radius: 25px;
      background: rgba(255,255,255,.7);
      box-shadow: 0 18px 55px rgba(38, 54, 68, .12), inset 0 0 0 1px rgba(255,255,255,.82);
    }
    h1 { margin: 0; font-size: 72px; line-height: .98; letter-spacing: -3.5px; }
    .tagline {
      margin: 42px 0 0;
      font-size: 39px;
      line-height: 1.13;
      letter-spacing: -1.4px;
      font-weight: 650;
      max-width: 510px;
    }
    .promise {
      margin: 24px 0 0;
      font-size: 24px;
      line-height: 1.42;
      color: #4a545e;
      max-width: 500px;
    }
    .features { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 34px; }
    .chip {
      padding: 10px 15px;
      border-radius: 999px;
      font-size: 18px;
      font-weight: 700;
      background: rgba(255,255,255,.72);
      border: 1px solid rgba(108, 83, 27, .16);
      box-shadow: 0 8px 28px rgba(35, 49, 60, .07);
    }
    .sources {
      margin-top: 30px;
      font-size: 18px;
      font-weight: 600;
      color: #505a63;
    }
    .product {
      position: absolute;
      z-index: 3;
      width: 800px;
      right: 52px;
      top: 72px;
      filter: drop-shadow(0 35px 55px rgba(20, 35, 50, .27));
    }
    .caption {
      position: absolute;
      left: 92px;
      bottom: 72px;
      z-index: 2;
      font-size: 17px;
      font-weight: 650;
      color: #5b646c;
      letter-spacing: .1px;
    }
  </style>
</head>
<body>
  <div class="veil"></div>
  <main class="copy">
    <div class="brand">
      <img class="mark" src="${mark}" alt="" />
      <h1>Gajendra</h1>
    </div>
    <p class="tagline">One clear focus across your AI tools.</p>
    <p class="promise">One NOW. One short queue. One click back to the exact thread.</p>
    <div class="features">
      <span class="chip">NOW</span>
      <span class="chip">Running</span>
      <span class="chip">Ready for Review</span>
    </div>
    <p class="sources">Local-first macOS utility for Codex and Claude workflows</p>
  </main>
  <img class="product" src="${product}" alt="Gajendra app overview with synthetic data" />
  <div class="caption">Actual app UI · Synthetic demo data</div>
</body>
</html>`);
  await page.screenshot({ path: output, type: "png" });
  process.stdout.write(`${output}\n`);
} finally {
  await browser.close();
}

await updateLaunchReceipt();

async function pngDataUrl(filePath) {
  return `data:image/png;base64,${(await readFile(filePath)).toString("base64")}`;
}

async function svgDataUrl(filePath) {
  return `data:image/svg+xml;base64,${(await readFile(filePath)).toString("base64")}`;
}

async function updateLaunchReceipt() {
  const receiptPath = path.join(launchRoot, "README.md");
  const assetNames = [
    "gajendra-hero.png",
    "gajendra-launch-overview.png",
    "gajendra-launch-ready-for-review.png",
    "gajendra-launch-search.png",
    "gajendra-launch-queue-editing.png",
    "gajendra-launch-organizer.png",
    "gajendra-hero-background.png",
  ];
  let receipt = await readFile(receiptPath, "utf8");
  for (const name of assetNames) {
    const bytes = await readFile(path.join(launchRoot, name));
    const digest = createHash("sha256").update(bytes).digest("hex");
    const lines = receipt.split("\n");
    const index = lines.findIndex((line) => line.startsWith(`| \`${name}\` |`));
    if (index < 0) throw new Error(`launch receipt is missing ${name}`);
    const hashCell = /`[a-f0-9]{64}`(?= \|$)/u;
    if (!hashCell.test(lines[index])) throw new Error(`launch receipt hash cell is malformed for ${name}`);
    lines[index] = lines[index].replace(hashCell, `\`${digest}\``);
    receipt = lines.join("\n");
  }
  await writeFile(receiptPath, receipt, "utf8");
}
