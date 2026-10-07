import { MAX_WORKFLOW_RECORDS, type StoredContinuation } from "../shared/contracts.js";

export function isCanonicalWorkflowId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 512 && /^[a-z0-9][a-z0-9-]{0,48}:[^\s\x00-\x1f]+$/u.test(value);
}

/** Strict bounded identity graph. Every conversation has at most one predecessor and successor. */
export function validContinuations(value: unknown): value is StoredContinuation[] {
  if (!Array.isArray(value) || value.length > MAX_WORKFLOW_RECORDS) return false;
  const next = new Map<string, string>();
  const incoming = new Set<string>();
  for (const link of value) {
    if (!link || typeof link !== "object" || !isCanonicalWorkflowId(link.predecessorThreadId)
      || !isCanonicalWorkflowId(link.currentThreadId) || link.predecessorThreadId === link.currentThreadId
      || next.has(link.predecessorThreadId) || incoming.has(link.currentThreadId)) return false;
    next.set(link.predecessorThreadId, link.currentThreadId);
    incoming.add(link.currentThreadId);
  }
  for (const id of next.keys()) {
    const visited = new Set<string>();
    let current = id;
    while (next.has(current)) {
      if (visited.has(current)) return false;
      visited.add(current);
      current = next.get(current)!;
    }
  }
  return true;
}

export function validCompletedIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_WORKFLOW_RECORDS
    && value.every(isCanonicalWorkflowId) && new Set(value).size === value.length;
}
