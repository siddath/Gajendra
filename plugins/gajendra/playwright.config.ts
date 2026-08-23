import { defineConfig, devices } from "@playwright/test";

const requestedPort = Number.parseInt(process.env.GAJENDRA_E2E_PORT ?? "", 10);
const e2ePort = Number.isSafeInteger(requestedPort) && requestedPort >= 1_024 && requestedPort <= 65_535
  ? requestedPort
  : 4_173;
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
