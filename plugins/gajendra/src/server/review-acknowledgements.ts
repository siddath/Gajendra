import { createHash } from "node:crypto";

import type { ReviewSignal } from "../shared/contracts.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashReviewThread(threadId: string): string {
  return sha256(JSON.stringify([threadId]));
}

export function hashReviewAcknowledgement(threadId: string, review: ReviewSignal): string {
  const destination = review.destination.type === "thread"
    ? [review.destination.type, review.destination.deepLink]
    : [review.destination.type, review.destination.url];
  return sha256(JSON.stringify([threadId, review.updatedAt, review.kind, ...destination]));
}
