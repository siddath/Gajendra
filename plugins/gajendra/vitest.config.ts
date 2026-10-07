import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
    // Provider cleanup tests launch real process trees with strict shutdown budgets. Running
    // every file at once can exhaust CI CPU before those children report readiness.
    fileParallelism: false,
  },
});
