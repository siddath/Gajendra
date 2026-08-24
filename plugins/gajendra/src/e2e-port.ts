import { createServer, type AddressInfo, type Server } from "node:net";

export const E2E_PORT_MIN = 1_024;
export const E2E_PORT_MAX = 65_535;
export const E2E_FIXED_PORT = 4_173;

export function parseRequestedE2EPort(rawValue: string | undefined): number | undefined {
  if (rawValue === undefined || !/^\d+$/.test(rawValue)) return undefined;
  const parsed = Number(rawValue);
  return Number.isSafeInteger(parsed) && parsed >= E2E_PORT_MIN && parsed <= E2E_PORT_MAX
    ? parsed
    : undefined;
}

export async function resolveE2EPort(rawValue = process.env.GAJENDRA_E2E_PORT): Promise<number> {
  return parseRequestedE2EPort(rawValue) ?? selectAvailableE2EPort();
}

async function selectAvailableE2EPort(): Promise<number> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const server = createServer();
    try {
      const port = await listenOnEphemeralPort(server);
      if (port !== E2E_FIXED_PORT && port >= E2E_PORT_MIN && port <= E2E_PORT_MAX) {
        return port;
      }
    } finally {
      await closeServer(server);
    }
  }
  throw new Error("Unable to select a bounded loopback port for the Playwright preview.");
}

function listenOnEphemeralPort(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.removeListener("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.removeListener("error", onError);
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("The loopback port probe returned no numeric address."));
        return;
      }
      resolve((address as AddressInfo).port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen({ host: "127.0.0.1", port: 0 });
  });
}

function closeServer(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
