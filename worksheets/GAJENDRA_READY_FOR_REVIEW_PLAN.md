# Gajendra Ready for Review — design and provider contract

Status: implemented and frozen in the dirty local source candidate through the configured-catalog
path and a guarded, content-free current-local Codex app-server path. The final local gauntlet and
exact-installed automated journey pass; external provider, physical-accessibility, signed-release,
and publication gates remain open.

Visible product language: **Gajendra** — **One clear focus across your AI tools.** The existing
promise remains **One NOW. One short queue. One click back to the exact thread.** This plan uses
NOW, Focus, Important, and Running as plain queue labels.

Owner: Sid approves the contract and rollout. No deadline was supplied.

Decision enabled: use **Ready for Review** below **Running** as a live “agent turn completed and
awaiting your next input” disclosure, while keeping remote-provider adapters separately gated.

Stopping condition for this phase: configured-catalog and current-local Codex metadata models,
native/web disclosures, visible-only refresh, search, safe opening behavior, non-persistence proof,
and local build/UI gates pass. No remote credential path is part of this phase.

## Recommendation

The local candidate now adds **Ready for Review** as a second derived disclosure directly below
**Running**, not as another priority tier and not as a tab that replaces the current card. It uses
restrained system orange/amber, a distinct `checkmark.bubble`-style glyph, and the visible text
**Ready for Review**. Green remains exclusive to provider-confirmed activity.

The lane must be confidence-first: a task appears only when an enabled provider emits an explicit
successful terminal or human-review-ready state. `idle`, `resumable`, recency, a branch name, a
rendered assistant message, or the absence of activity is never enough. Opening a task is not an
acknowledgement and does not clear the signal; a newer provider turn changes it.

## Surface contract

- Position: after Running and before the fixed all-thread search footer.
- Container: same disclosure grammar, radius, density, and single scroll owner as Running.
- Header: review glyph, **Ready for Review**, count, and a clearly clickable **Needs your review** capsule with chevron.
- Default: expanded when the card opens; collapse is transient like Running and does not become task metadata.
- Empty state: **No provider reports work ready for review.**
- Rows: lazy rendering, stable thread identity, provider label, ready timestamp, and NOW/Focus/Important placement when applicable.
- Primary row action: open the provider-declared review destination. If the provider supplies only a thread destination, open that exact thread and label the destination **Task**, not **Review**.
- When both exist: the full row opens the review destination; the provider badge remains a separate route to the owning task.
- Running rows keep their existing full-row open behavior.
- Search remains a fixed sibling footer and continues to search every loaded thread; neither derived lane creates a nested scroll view.

## Color and state language

Use dynamic system orange/amber only as a supporting status color. It means **human attention is now useful**, not warning, failure, provider identity, or completion quality.

- Running: green dot-and-ring plus **Running**.
- Ready for Review: orange `checkmark.bubble`-style mark plus **Ready for Review**.
- Error or destructive action: red, never orange.
- Codex/provider identity: existing provider treatment, never reused as review status.
- Focus gold remains the priority accent; review needs a different glyph and explicit text so similar warm hues cannot be confused.

Apple recommends consistent semantic color, system-adaptive colors, and a glyph or label in addition to color. Status feedback should sit near the item it describes and avoid needless perpetual animation. See [Color](https://developer.apple.com/design/human-interface-guidelines/color), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility/), and [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback).

The implementation chooses the permitted quieter variant: the review check is static immediately,
with no loop, pulse, spinner, or amber glow. Reduce Motion therefore receives the same complete state
without an animation branch.

## Normalized data contract

Extend the live normalized thread value with an optional, non-persisted structure:

```ts
type ReviewSignal = {
  state: "ready";
  kind: "result" | "diff" | "pull-request";
  updatedAt: number;
  destination:
    | { type: "thread"; deepLink: string }
    | { type: "url"; url: string };
  providerStatus: string;
};
```

Rules:

1. The provider adapter, not the renderer, creates `ReviewSignal`.
2. `providerStatus` must match a documented explicit provider value; it is evidence for diagnostics, not user-authored text.
3. A valid structured destination is required. Free-form shell strings remain forbidden.
4. Gajendra never persists this signal, result text, diffs, PR content, transcripts, or provider output.
5. Duplicate source records collapse to one canonical namespaced thread ID before projection.
6. Review eligibility is removed as soon as the provider no longer reports it.

The derived projection is:

```text
reviewReadyThreads = allThreads
  where review.state == ready
  and isRunning == false
  ordered by review.updatedAt descending
```

If stale provider data claims both Running and Ready, Running wins and the review duplicate is suppressed. This prevents Gajendra from simultaneously telling the user that work is still active and ready for inspection.

## Priority overlap

Ready for Review is inclusive across priority placement, just like Running:

- A matching NOW, Focus, or Important row gains the static orange review mark next to its title.
- The corresponding review-lane row remains visible and adds a placement label: **NOW**, **Focus**, or **Important**.
- Unprioritized review-ready work appears without a placement label.
- Review status never changes priority and is never stored as a third tier.
- When a priority row is both running and has a stale review signal, show only the green Running mark because Running has precedence.

## Provider capability gate

| Source | Current verified signal | Decision |
| --- | --- | --- |
| Codex local app-server | Local Codex CLI 0.147.0's generated experimental schema exposes `thread/turns/list`, `itemsView: notLoaded`, terminal turn status, and completion time without loading message items. | Implemented fail-closed for the 200 newest non-Running candidates with four workers and a five-second total budget. Require exactly one newest zero-item `completed` turn, no error, and a valid completion timestamp; unsupported/malformed/ambiguous evidence emits no built-in signals. |
| Codex Cloud | OpenAI documents creating cloud tasks, tracking in-progress work, and reviewing completed tasks, but this research found no supported cloud-task listing contract that Gajendra can consume without scraping private app data. | UX supported; adapter blocked until OpenAI exposes an authenticated supported list/status/destination contract. |
| Cursor Cloud Agents | The public-beta API exposes `RUNNING` and successful terminal `FINISHED` runs, plus pushed branch and optional `prUrl`. | Viable explicit adapter: map only `FINISHED`; prefer `prUrl`, otherwise the documented agent URL. Requires a separately approved remote-source and credential design. |
| Claude Code local | Current Gajendra adapter emits `resumable`; the installed CLI exposes no equivalent metadata-only terminal-turn contract. | Unsupported; never infer readiness or inspect transcript records. |
| Grok Build local | Current Gajendra adapter emits `resumable`, not a successful review-ready state. | Unsupported; never infer readiness. |
| Configured catalog | The bounded version-1 catalog now accepts and validates the optional live-only `ReviewSignal`. | Implemented first safe extensibility path; unsafe or fabricated signals fail the source closed. |

OpenAI’s product documentation distinguishes in-progress cloud work from completed tasks people can review, which supports the lane concept but not an adapter contract: [Introducing upgrades to Codex](https://openai.com/index/introducing-upgrades-to-codex/). Cursor documents terminal `FINISHED` runs and `git.branches[].prUrl` in its [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints).

## Architecture and privacy gate

Gajendra currently makes no third-party network requests and stores no tokens. A Codex Cloud or Cursor Cloud adapter would change that boundary. It must not be smuggled in as a UI-only change.

Before a remote adapter ships, approve all of the following:

- explicit opt-in per remote source;
- official supported API and stable task identifier;
- least-privilege authentication stored in Keychain, never the Gajendra JSON state;
- bounded pagination, timeout, rate-limit, and failure behavior;
- no transcript, diff, result, or PR-body persistence;
- disconnect and credential-revocation controls;
- separate source health so one remote failure cannot hide local tasks;
- updated security, privacy, onboarding, and uninstall documentation.

The configured-catalog path can validate the UI and normalized contract without adding network or credential authority.

## Implementation sequence

1. **Complete locally:** `ReviewSignal` validation, deduplication, Running precedence, ordering,
   configured-catalog fixtures, and guarded current-local Codex zero-item terminal metadata.
2. **Complete locally:** derived `reviewReadyThreads` without persistence or priority mutation.
3. **Complete locally:** light/dark and both-theme suite coverage plus dedicated empty, one-row,
   ten-row/static, priority-overlap, and compact single-scroll preview cases. The review mark itself
   has no animation; physical Reduce Motion verification remains an installed gate.
4. **Complete locally:** hover-card and Organizer disclosures use lazy rows and the existing single-scroll-body architecture.
5. **Complete locally:** full-row destination, Task fallback, priority highlight, disclosure state,
   search, keyboard-safe buttons, accessibility labels, and web/native behavioral coverage. Physical
   VoiceOver remains an installed gate.
6. **Complete locally:** visible compact surfaces refresh on reveal
   and on a conservative visible-only cadence, pausing for search/edit/drag/load/mutation and
   stopping when hidden. Search indexes fixed Ready/Running semantics plus ordinary metadata; the
   real-key UI journey proves filter and clear restore behavior.
7. **Pending separate authority:** a remote provider adapter. Cursor Cloud remains technically
   viable but needs a remote-source security decision; Codex Cloud remains blocked on a supported listing contract.
8. **Complete for the local ad-hoc boundary:** this exact Ready/drag candidate was installed with
   preserved state and a rollback, then passed launcher tap/AX/edge, full-row drag, Search, and dock
   journeys. Clean-Mac, physical VoiceOver/human drag, Developer ID, notarization, and distribution
   remain open.

## Local implementation receipt — 2026-08-19

- `npm run check`: 98/98 TypeScript unit/integration tests, typecheck, plugin build, and plugin validation passed.
- `npm run test:e2e`: 17/17 browser journeys passed, including the configured review disclosure,
  unsafe-destination rejection, exact Review/Task routing, overlap, collapse, and search.
- `npm run companion:test`, `npm run companion:build`, `npm run companion:ui-test`,
  `npm run companion:ui-performance-test`, `npm run companion:validate`, and
  `npm run companion:bundle-readiness` passed. Five consecutive fresh-process full UI journeys
  passed with all cold/warm reveals at or below 93 ms; the exact installed build then passed at
  56 ms prewarmed, 90 ms cold, and 89 ms warm. The validator's isolated configured source projected
  a review signal and proved no review/provider/destination field entered the private store.
- Generated native evidence covers light/dark and both base themes plus dedicated
  [empty](../evidence/companion/gajendra-hover-card-review-empty.png),
  [one-row](../evidence/companion/gajendra-hover-card-review-one.png), and
  [ten-row static](../evidence/companion/gajendra-hover-card-review-ten-dark-static.png) review
  cases. The ten-row case retains the one card scroll owner and fixed search footer.
- Bundle readiness reports an ad-hoc local bundle with `distributionReady:false`. The final
  20-receipt gauntlet, exact installed automated journey, rollback, and unchanged private-state
  hash/modes are recorded; no physical VoiceOver screen-reader, Developer ID, notarization, binary
  distribution, or LinkedIn publication claim is made.

## Acceptance tests

- Explicit `ready`/`FINISHED` success appears; idle, resumable, cancelled, expired, failed, and unknown do not.
- Codex `completed` plus zero unloaded items and a renderable, non-future Unix-second completion
  time appears. A structurally valid empty, active, in-progress, interrupted, or failed candidate
  emits no Ready signal. Malformed, returned-content, invalid-time, deadline, and
  unsupported-method cases suppress the guarded built-in batch.
- Opening a Ready thread does not clear it; a newer turn's status is the only built-in state change.
- A simultaneously active and ready record appears only in Running.
- The same canonical ID can appear in Focus/Important and Ready for Review, with one priority highlight and one placement label.
- Full-row open chooses the declared review destination; provider fallback is labeled and opens the exact owning task.
- Ten or more review rows scroll smoothly inside the card's one scroll body; the global search footer remains fixed.
- Search returns review-ready and ordinary threads without duplicate canonical IDs.
- Searching `ready`, `running`, a provider, project, or context/tag uses loaded metadata only.
- Orange is paired with glyph, label, timestamp, accessibility value, and tooltip; grayscale and Differentiate Without Color remain understandable.
- The review check remains static under Reduce Motion; reorder/snap motion is removed without
  removing state feedback.
- Provider failure produces source health and no fabricated review rows.
- No review signal, destination, result text, diff, PR body, token, or credential enters `gajendra.v2.json`.

## Rejected shortcuts

- `idle == ready`: false; idle can mean paused, untouched, completed, or unavailable.
- `resumable == ready`: false; it only says a thread can be opened again.
- “not running anymore” as readiness: absence of activity is not evidence of successful work.
- local provider database or signed-app scraping: violates Gajendra's provider boundary and is too brittle.
- GitHub PR existence alone: loses the provider-thread identity and can surface unrelated human work.
- orange alone: insufficient state communication and too close to the existing warm Focus palette.
