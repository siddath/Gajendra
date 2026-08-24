import { defineConfig, devices } from "@playwright/test";
import { parseRequestedE2EPort, resolveE2EPort } from "./src/e2e-port.js";

const requestedPort = parseRequestedE2EPort(process.env.GAJENDRA_E2E_PORT);
const e2ePort = await resolveE2EPort();
if (requestedPort === undefined) process.env.GAJENDRA_E2E_PORT = String(e2ePort);
const e2eOrigin = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "../../.artifacts/playwright",
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["line"]],
  use: {
    baseURL: e2eOrigin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    ...devices["Desktop Chrome"],
    viewport: { width: 980, height: 900 },
  },
  webServer: {
    command: `npm run build:ui && npx vite preview --host 127.0.0.1 --port ${e2ePort}`,
    url: `${e2eOrigin}/gajendra.html?fixture=1`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
