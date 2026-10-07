import { allDeckThreads, isRunningThreadStatus, productDeckProjection, type DeckSnapshot, type DeckThread } from "../shared/contracts.js";

export type ReviewAcknowledgement = {
  thread: DeckThread;
  identity: string;
  updatedAt: number;
  idempotencyKey: string;
  index: number;
  state: "pending" | "saved" | "failed";
  error?: string;
  superseded: boolean;
};

/** Session-only feedback. The authoritative snapshot and priority state are never rolled back. */
export class ReviewAcknowledgements {
  readonly operations = new Map<string, ReviewAcknowledgement>();

  begin(thread: DeckThread, idempotencyKey: string, index: number): ReviewAcknowledgement | null {
    const review = thread.review;
    if (!review?.identity || isRunningThreadStatus(thread.status)) return null;
    const previous = this.operations.get(review.identity);
    if (previous && previous.state !== "failed") return null;
    const operation: ReviewAcknowledgement = previous ?? {
      thread: structuredClone(thread), identity: review.identity, updatedAt: review.updatedAt,
      idempotencyKey, index, state: "pending", superseded: false,
    };
    operation.state = "pending";
    delete operation.error;
    this.operations.set(operation.identity, operation);
    return operation;
  }

  observe(snapshot: DeckSnapshot): void {
    const threads = new Map(allDeckThreads(snapshot).map(thread => [thread.id, thread]));
    for (const operation of this.operations.values()) {
      const thread = threads.get(operation.thread.id);
      if (thread && (isRunningThreadStatus(thread.status)
        || thread.attention === "needs-input"
        || (thread.review?.identity && thread.review.identity !== operation.identity))) operation.superseded = true;
    }
  }

  complete(operation: ReviewAcknowledgement): void {
    operation.state = "saved";
    this.operations.delete(operation.identity);
  }
  fail(operation: ReviewAcknowledgement, error: string): void { operation.state = "failed"; operation.error = error; }
  forget(identity: string): void { this.operations.delete(identity); }
  get pending(): boolean { return [...this.operations.values()].some(operation => operation.state === "pending"); }

  ready(snapshot: DeckSnapshot): DeckThread[] {
    return (snapshot.product ?? productDeckProjection(snapshot)).readyForReview.filter(thread => {
      const operation = thread.review?.identity ? this.operations.get(thread.review.identity) : undefined;
      return operation?.state !== "pending";
    });
  }
}

/** Preserve newer provider evidence when an older acknowledgement request resolves after a refresh. */
export function preserveNewerReviewEvidence(incoming: DeckSnapshot, current: DeckSnapshot, operation: ReviewAcknowledgement, baseline?: DeckSnapshot): DeckSnapshot {
  const latest = new Map(allDeckThreads(current).map(thread => [thread.id, thread]));
  const original = new Map(baseline ? allDeckThreads(baseline).map(thread => [thread.id, thread]) : []);
  const merge = (thread: DeckThread): DeckThread => {
    const observed = latest.get(thread.id);
    if (!observed) return thread;
    if (isRunningThreadStatus(thread.status) || thread.attention === "needs-input") return thread;
    const before = original.get(thread.id);
    const changedSinceRequest = baseline && (before?.review?.identity !== observed.review?.identity || before?.status !== observed.status);
    const changedReview = thread.id === operation.thread.id && (isRunningThreadStatus(observed.status)
      || (observed.review?.identity && observed.review.identity !== operation.identity));
    if (!changedSinceRequest && !changedReview) return thread;
    if (thread.review?.identity !== (before?.review?.identity ?? operation.identity) && thread.review
      && thread.review.updatedAt >= (observed.review?.updatedAt ?? observed.updatedAt)) return thread;
    const merged = { ...thread, status: observed.status, updatedAt: observed.updatedAt };
    delete merged.review;
    delete merged.reviewAcknowledged;
    delete merged.attention;
    if (observed.review) merged.review = observed.review;
    if (observed.reviewAcknowledged !== undefined) merged.reviewAcknowledged = observed.reviewAcknowledged;
    if (observed.attention) merged.attention = observed.attention;
    return merged;
  };
  const result = { ...incoming, current: incoming.current ? merge(incoming.current) : null,
    focus: incoming.focus.map(merge), important: incoming.important.map(merge), available: incoming.available.map(merge) };
  const included = new Set(allDeckThreads(result).map(thread => thread.id));
  for (const observed of latest.values()) {
    if (!included.has(observed.id) && !original.has(observed.id) && (observed.review || isRunningThreadStatus(observed.status))) {
      // A newly discovered live row was absent from the older request. Keep it available without
      // importing an older priority decision into the authoritative mutation result.
      result.available.push({ ...observed, level: null, isCurrent: false });
    }
  }
  result.product = productDeckProjection(result);
  return result;
}
