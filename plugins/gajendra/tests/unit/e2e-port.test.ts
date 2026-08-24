import { createServer } from "node:net";

import { describe, expect, it } from "vitest";

import {
  E2E_FIXED_PORT,
  E2E_PORT_MAX,
  E2E_PORT_MIN,
  parseRequestedE2EPort,
  resolveE2EPort,
} from "../../src/e2e-port.js";

describe("Playwright preview port selection", () => {
  it("preserves a valid explicit port override", async () => {
    expect(parseRequestedE2EPort("43123")).toBe(43_123);
    await expect(resolveE2EPort("43123")).resolves.toBe(43_123);
  });

  it("selects and releases a bounded loopback port when no valid override exists", async () => {
    expect(parseRequestedE2EPort("4173oops")).toBeUndefined();
    expect(parseRequestedE2EPort("0")).toBeUndefined();

    const port = await resolveE2EPort("not-a-port");
    expect(port).toBeGreaterThanOrEqual(E2E_PORT_MIN);
    expect(port).toBeLessThanOrEqual(E2E_PORT_MAX);
    expect(port).not.toBe(E2E_FIXED_PORT);

    const probe = createServer();
    await new Promise<void>((resolve, reject) => {
      probe.once("error", reject);
      probe.listen({ host: "127.0.0.1", port }, () => resolve());
    });
    await new Promise<void>((resolve, reject) => {
      probe.close((error) => error ? reject(error) : resolve());
    });
  });
});
