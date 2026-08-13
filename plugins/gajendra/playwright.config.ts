import { defineConfig, devices } from "@playwright/test";

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
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    ...devices["Desktop Chrome"],
    viewport: { width: 980, height: 900 },
  },
  webServer: {
    command: "npm run build:ui && npx vite preview --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/gajendra.html?fixture=1",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
