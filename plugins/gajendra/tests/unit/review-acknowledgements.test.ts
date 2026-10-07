import { describe, expect, it } from "vitest";
import { allDeckThreads, productDeckProjection, type DeckSnapshot, type DeckThread } from "../../src/shared/contracts.js";
import { fixtureSnapshot } from "../../src/ui/fixtures.js";
import { ReviewAcknowledgements, preserveNewerReviewEvidence } from "../../src/ui/review-acknowledgements.js";

const id = "review-agent:focus-review";
function fixture(): DeckSnapshot {
  const snapshot = structuredClone(fixtureSnapshot);
  snapshot.product = productDeckProjection(snapshot);
  return snapshot;
}
function thread(snapshot: DeckSnapshot): DeckThread { return allDeckThreads(snapshot).find(row => row.id === id)!; }
function refresh(snapshot: DeckSnapshot): DeckSnapshot { snapshot.product = productDeckProjection(snapshot); return snapshot; }

describe("optimistic exact review acknowledgements", () => {
  it("removes only the exact response immediately without changing NOW, order, work state or source data", () => {
    const snapshot = fixture();
    const before = structuredClone(snapshot);
    const state = new ReviewAcknowledgements();
    state.begin(thread(snapshot), "attempt-1", 0);
    expect(state.ready(snapshot).map(row => row.id)).not.toContain(id);
    expect(state.ready(snapshot)).toHaveLength(2);
    expect(snapshot).toEqual(before);
    expect(state.pending).toBe(true);
  });

  it("suppresses the exact pending response and lets confirmed authoritative snapshots own saved visibility", () => {
    const snapshot = fixture();
    const state = new ReviewAcknowledgements();
    const operation = state.begin(thread(snapshot), "attempt-1", 0)!;
    state.observe(structuredClone(snapshot));
    expect(state.ready(snapshot).some(row => row.id === id)).toBe(false);
    state.complete(operation);
    expect(state.pending).toBe(false);
    expect(state.ready(structuredClone(snapshot)).some(row => row.id === id)).toBe(true);
    state.forget(operation.identity);
    expect(state.ready(snapshot).some(row => row.id === id)).toBe(true);
  });

  it("restores the exact original row and placement after failure and retains the retry identity", () => {
    const snapshot = fixture();
    const original = structuredClone(thread(snapshot));
    const state = new ReviewAcknowledgements();
    const operation = state.begin(original, "stable-transport-retry", 0)!;
    state.fail(operation, "Connection interrupted");
    expect(state.ready(snapshot)[0]).toEqual(original);
    expect(state.begin(original, "unused-new-key", 0)?.idempotencyKey).toBe("stable-transport-retry");
    expect(state.ready(snapshot).some(row => row.id === id)).toBe(false);
  });

  it.each(["timestamp", "destination"])("never suppresses new %s evidence while saving the previous response", change => {
    const snapshot = fixture();
    const state = new ReviewAcknowledgements();
    const operation = state.begin(thread(snapshot), "attempt-1", 0)!;
    const review = thread(snapshot).review!;
    review.identity = "b".repeat(64);
    if (change === "timestamp") review.updatedAt += 100;
    else review.destination = { type: "url", url: "https://example.invalid/corrected" };
    refresh(snapshot);
    state.observe(snapshot);
    expect(state.ready(snapshot).find(row => row.id === id)?.review).toEqual(review);
    state.fail(operation, "Stale review");
    expect(state.ready(snapshot).filter(row => row.id === id)).toHaveLength(1);
    expect(operation.superseded).toBe(true);
  });

  it("does not restore obsolete failed evidence after Running or a newer generation was observed", () => {
    const snapshot = fixture();
    const state = new ReviewAcknowledgements();
    const operation = state.begin(thread(snapshot), "attempt-1", 0)!;
    thread(snapshot).status = "running";
    state.observe(refresh(snapshot));
    state.fail(operation, "Unavailable");
    expect(state.ready(snapshot).some(row => row.id === id)).toBe(false);
    thread(snapshot).status = "idle";
    delete thread(snapshot).review;
    refresh(snapshot);
    expect(state.ready(snapshot).some(row => row.id === id)).toBe(false);
  });

  it("supports several immediate dismissals independently while their writes are queued", () => {
    const snapshot = fixture();
    const state = new ReviewAcknowledgements();
    const ready = state.ready(snapshot);
    const first = state.begin(ready[0]!, "first", 0)!;
    const second = state.begin(ready[1]!, "second", 1)!;
    expect(state.ready(snapshot)).toHaveLength(1);
    delete thread(snapshot).review;
    thread(snapshot).reviewAcknowledged = true;
    refresh(snapshot);
    state.complete(first);
    state.fail(second, "Retry");
    expect(state.ready(snapshot).map(row => row.id)).toEqual([ready[1]!.id, ready[2]!.id]);
  });

  it("merges fresh provider evidence into a late save without rolling back authoritative priorities", () => {
    const current = fixture();
    const state = new ReviewAcknowledgements();
    const operation = state.begin(thread(current), "first", 0)!;
    const incoming = structuredClone(current);
    incoming.revision += 1;
    delete thread(incoming).review;
    thread(incoming).reviewAcknowledged = true;
    thread(incoming).workState = "completed";
    thread(current).review!.identity = "b".repeat(64);
    thread(current).review!.updatedAt += 100;
    const merged = preserveNewerReviewEvidence(incoming, current, operation);
    expect(merged.revision).toBe(incoming.revision);
    expect(thread(merged).workState).toBe("completed");
    expect(thread(merged).review?.identity).toBe("b".repeat(64));
    expect(thread(merged).reviewAcknowledged).toBeUndefined();
    expect(merged.current).toEqual(incoming.current);
  });

  it("accepts even newer evidence supplied by the mutation result", () => {
    const current = fixture();
    const state = new ReviewAcknowledgements();
    const operation = state.begin(thread(current), "first", 0)!;
    thread(current).review!.identity = "b".repeat(64);
    thread(current).review!.updatedAt += 100;
    const incoming = structuredClone(current);
    thread(incoming).review!.identity = "c".repeat(64);
    thread(incoming).review!.updatedAt += 100;
    const merged = preserveNewerReviewEvidence(incoming, current, operation);
    expect(thread(merged).review?.identity).toBe("c".repeat(64));
  });

  it("honors an authoritative later revision that undoes a review in another surface", () => {
    const snapshot = fixture();
    const state = new ReviewAcknowledgements();
    const operation = state.begin(thread(snapshot), "first", 0)!;
    state.complete(operation);
    snapshot.revision += 1;
    state.observe(snapshot);
    expect(state.ready(snapshot).some(row => row.id === id)).toBe(true);
  });

  it("retains a different chat's new response discovered during an acknowledgement", () => {
    const baseline = fixture();
    const current = structuredClone(baseline);
    const incoming = structuredClone(baseline);
    const state = new ReviewAcknowledgements();
    const operation = state.begin(thread(baseline), "first", 0)!;
    const other = current.important.find(row => row.review)!;
    other.review!.identity = "d".repeat(64);
    other.review!.updatedAt += 100;
    const merged = preserveNewerReviewEvidence(incoming, current, operation, baseline);
    expect(allDeckThreads(merged).find(row => row.id === other.id)?.review?.identity).toBe("d".repeat(64));
  });

  it.each(["running", "needs-input"])("retains incoming %s precedence over an observed ready response", activity => {
    const current = fixture();
    const state = new ReviewAcknowledgements();
    const operation = state.begin(thread(current), "first", 0)!;
    thread(current).review!.identity = "b".repeat(64);
    const incoming = structuredClone(current);
    if (activity === "running") thread(incoming).status = "running";
    else thread(incoming).attention = "needs-input";
    const merged = preserveNewerReviewEvidence(incoming, current, operation);
    expect(thread(merged)).toEqual(thread(incoming));
    state.observe(merged);
    state.fail(operation, "Unavailable");
    expect(state.ready(merged).some(row => row.id === id)).toBe(false);
  });

  it("does not fabricate a restored review after a fresh authoritative snapshot omits the evidence", () => {
    const snapshot = fixture();
    const state = new ReviewAcknowledgements();
    const operation = state.begin(thread(snapshot), "first", 0)!;
    delete thread(snapshot).review;
    state.observe(refresh(snapshot));
    state.fail(operation, "Connection interrupted");
    expect(state.ready(snapshot).some(row => row.id === id)).toBe(false);
  });

  it("retains a distinct incoming response at the same timestamp", () => {
    const current = fixture();
    const state = new ReviewAcknowledgements();
    const operation = state.begin(thread(current), "first", 0)!;
    thread(current).review!.identity = "b".repeat(64);
    const incoming = structuredClone(current);
    thread(incoming).review!.identity = "c".repeat(64);
    expect(thread(preserveNewerReviewEvidence(incoming, current, operation)).review?.identity).toBe("c".repeat(64));
  });
});
