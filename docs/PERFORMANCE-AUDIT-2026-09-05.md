# Gajendra performance and focus audit — 2026-09-05

## Contract and environment

Owner: Sid. Authorized outcome: audit the open app and retained performance work, keep measured
improvements, publish a reviewed PR, and merge only after required checks pass. Preserve one NOW,
priority state, source opt-in, candidate limits, the four-worker review cap, and provider privacy.
No remote provider or transcript mutation. Stop when further gains are provider-bound or unproven.

Same Mac, macOS 26.6 arm64, bundled Node v24.19.0. Base `94a84d3` was refreshed against GitHub.
The earlier `codex/gajendra-performance` worktree was preserved during this audit. It was later
retired with complete recovery evidence in the [branch reconciliation](RUNNING-AND-BRANCH-RECONCILIATION-2026-09-05.md).
Its historic measurements are retained in [the August report](PERFORMANCE-BENCHMARK-2026-08-23.md).
This report supersedes that report's proposed next-round procedure.

## Measurements

[Raw aggregate receipts](../evidence/performance/2026-09-05.json) retain all measured samples,
including outliers. Discovery uses 1,000 synthetic candidates across 20 projects, one warm-up,
seven measured iterations, and two rounds in before/after/after/before order. Every iteration
asserts the exact same newest 200 selected IDs and 200 readable metadata results per adapter.

| Flow | Before round 1 median / p95 | After round 1 median / p95 | Before round 2 median / p95 | After round 2 median / p95 |
| --- | ---: | ---: | ---: | ---: |
| Claude discovery | 23.27 / 35.22 ms | 15.43 / 21.00 ms | 22.81 / 25.62 ms | 13.30 / 15.44 ms |
| Grok discovery | 20.73 / 23.90 ms | 13.11 / 14.13 ms | 21.76 / 23.93 ms | 13.12 / 13.62 ms |

Claude median improved 34–42%; Grok improved 37–40%. Both p95 values improved in both rounds.
This measures local metadata discovery, not the end-to-end refresh of the current enabled sources.

The running native app's short diagnostic sample was approximately 153–154 MiB resident memory,
with CPU samples varying from 1.3% to 14.4%. This is not a sustained-load profile or a memory-leak
finding. No CPU or memory optimization is claimed from that sample.

Seven measured live refreshes after one warm-up had median **5,863.58 ms**, p95 **6,130.15 ms**.
The RPC listing component had median **3,303.56 ms**, review projection wall time **2,140.68 ms**,
and initialization **41.24 ms**. Component medians are computed independently and need not sum to
the total median. The enabled local provider data and workstation load can change during this
measurement. No thread content, task IDs, titles, review destinations, or workload counts are
published in the receipt. Claude was unavailable in this host snapshot and Grok disabled, so the
retained discovery optimization does not establish faster current live refreshes.

The initial native launcher run measured 62 ms prewarmed, 91 ms cold, and 88 ms warm, all under the
existing 200 ms budget. Its later edit-mode assertion failed, so it is a timing sample, not a
passing journey. Final native/regression receipts are recorded below after verification.

## Retained and rejected changes

- Retain bounded eight-worker filesystem stat reads, adapted from `40b5d57`. Preserve deterministic
  order, the directory-entry ceiling, candidate caps, exact selection, and source fail-closed
  behavior. Stop scheduling on an error/overflow and drain already-started reads before returning.
  Tests cover overflow settlement and missing Grok summaries not consuming the valid-file budget.
- Reject the older branch's concurrent Codex runtime/review enrichment. It selects review
  candidates before runtime activity is finalized. Newly Running tasks can consume the review
  candidate window or contribute malformed review evidence that suppresses other valid Ready
  signals. A merge that merely strips Running signals afterward does not restore the prior
  candidate-selection/failure behavior. No provider caps or privacy requirements were weakened
  for speed, and the historic live improvement is not reused as a current claim.
- Do not add caching, skip review candidates, increase review concurrency, or poll while hidden.
  The measured live refresh is dominated by provider RPCs. A different provider contract or
  explicit freshness policy would be required for a broader optimization.

## Focus and full-screen correctness

The four existing snapshot/priority/review MCP tools become visible to the AI model as well as the
inline app. Five other app controls remain app-only. The plugin instructions require explicit
user intent, exact canonical task resolution, revision checks, and truthful confirmation. No
background conversation watcher or automatic inference of importance is added.

The previous owner-authorized ten-day review cleanup used exact-response acknowledgements and
preserved every other saved setting. It was a one-time local action, not a rolling product filter,
and no private state is part of the PR.

The new synthetic full-screen native test owns its own host window, checks the actual OS hit at
the launcher, verifies the card and full-screen host share the active Space, then exercises the
Dock/reopen route. The original trial passed floating-launcher checks on both old and new window
policies; that alone did not prove a fix. Early extended tests observed a Desktop switch, but
subsequent harness corrections and an invalid old-bundle launch path prevent treating those as a
controlled before/after result. Two final attempts using the preserved original app in a proper
`.app` bundle failed the synthetic host's full-screen setup precondition, before exercising the
app behavior. The original intermittent issue therefore remains unconfirmed in that comparison.
The final build passes both launcher and Dock/reopen on the same full-screen Space. It remembers
the last external app in memory and restores that tool on compact reopen, while leaving explicit
Organizer/setup interactions in their own window. The overlay keeps explicit full-screen
eligibility on all supported OS releases.

The full-screen test permits the card to receive keyboard focus. It checks active-Space and
on-screen window behavior, rather than incorrectly requiring the host app to remain frontmost.
Status-item accessibility, physical VoiceOver, multiple monitors, and clean-Mac behavior remain
separate proof boundaries.

## Validation repairs and dependency gate

A pre-existing retry-cap test assumed two real disk-backed collections finish within 100 ms.
Under concurrent build load it completed one before its deadline. The test now uses the service's
existing injected clock, retaining the exact two-collection assertion and strengthening the
snapshot retry assertion; production deadlines remain unchanged.

The required production audit found vulnerable transitive `fast-uri` and `qs` resolutions. Only
those lockfile entries were updated, to 3.1.7 and 6.16.0 respectively. This also incorporates the
same narrow resolution changes proposed by dependency PRs #28 and #30; unrelated dependency PRs
are outside this change. No direct dependency ranges were changed.

## Final verification and review

Implementation boundary: `e63a948`; [PR #31](https://github.com/siddath/Gajendra/pull/31).
Subsequent changes record evidence and documentation only. The September 5 local
[gauntlet receipt](../evidence/gauntlet/report.json) contains **21 passing gates**:

- 112/112 source tests, plus five complete repeated passes; source checks, build, and plugin validation.
- 17/17 browser journeys and 85/85 repeated journeys, including keyboard, accessibility, and reflow.
- Native self-tests, bundle build, complete real-window interaction, full-screen launcher/reopen,
  widget performance, and live probes. Full journey prewarmed/cold/warm samples were 48/101/92 ms;
  the dedicated widget journey measured 121/94/83 ms, all under the existing 200 ms budget.
- Production dependency audit: zero vulnerabilities. No AttributeGraph cycle in the dedicated
  widget journey. Hosted `plugin` and `macos-companion` jobs passed at the implementation boundary;
  the final evidence commit must also pass hosted checks before merge.

The focused final code review checked bounded scheduling/draining, deterministic selection,
Running precedence, revision-checked mutations, model tool exposure, native reopen focus, test
isolation, dependency scope, and private-data exclusion. No blocking code finding remained.
The rejected concurrent Codex enrichment and inconclusive old-app full-screen comparison are
retained above so the validation limits are visible to the reviewer.

The local app update preserves a separate rollback bundle and a mode-0600 state backup. Its
executable, server, and bundled runtime match the tested build by SHA-256; installation leaves
saved priority/review state byte-for-byte unchanged. The plugin installer separately verifies
all nine deployed artifacts. The installed card was reopened in the native interface and displayed
the saved NOW/Focus/Important state and the reduced Ready queue. Reloading the AI host is still required to refresh its tool inventory.
