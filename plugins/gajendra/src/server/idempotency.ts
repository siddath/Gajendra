import { createHash } from "node:crypto";

/**
 * Store only a fixed-length digest of caller-controlled request keys. This supports replay and
 * reuse checks without retaining arbitrary caller text in Gajendra's private metadata file.
 */
export function hashIdempotencyKey(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function isSha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/iu.test(value);
}
