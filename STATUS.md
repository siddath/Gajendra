# Status

**Product:** Gajendra — One clear focus across your AI tools.

**Promise:** One NOW. One short queue. One click back to the exact thread.

**Reconciled:** 2026-09-05

**Public state:** source is public on `main`; no signed/notarized binary or mobile release is
claimed.

**Ready acknowledgement source release:** [PR #27](https://github.com/siddath/Gajendra/pull/27).
It keeps Ready for Review independent of priority, adds a bounded exact-response acknowledgement,
preserves Running precedence, removes duplicate compact lane controls and priority-row Ready glyphs,
and updates the matching source, privacy, tests, launch evidence, and public copy. Hosted and merge
receipts remain distinct from the local receipts below.

## September focus and performance update

[PR #31](https://github.com/siddath/Gajendra/pull/31) and the [September audit](docs/PERFORMANCE-AUDIT-2026-09-05.md) records the conversational MCP actions,
bounded discovery changes, full-screen reopen work, raw aggregate timings, and current validation
boundaries. Claude metadata discovery improved 34–42% and Grok 37–40% across two controlled rounds;
these are adapter measurements, not a faster-current-live-refresh claim. The older performance
worktree was subsequently retired with verified recovery material, and its concurrent Codex runtime/review proposal was rejected because it
changed candidate-selection and failure semantics.

The production lockfile updates only `fast-uri` and `qs` to their fixed resolutions. The current
source update's local and hosted verification is recorded in the audit; the historical release
receipts below remain dated evidence and do not substitute for those checks.

## Running and branch reconciliation

The [Running investigation](docs/RUNNING-AND-BRANCH-RECONCILIATION-2026-09-05.md) records a bounded
metadata fallback for active desktop tasks omitted by the provider list, exact stale-branch
reconciliation, and verified local recovery archives. The old performance worktree and four
superseded branches have been retired; active dependency proposals remain open.

## Current user-facing state

| Area | Current merged behavior | Boundary that remains open |
| --- | --- | --- |
| NOW, Focus, Important | One NOW remains inside Focus. Quick click opens; a stationary hold selects and lifts the visible row, and continuing the same press drags it. Compact priority rows no longer duplicate drag/drop with a left/right lane button; context-menu and accessibility alternatives remain. Unprioritized Running/Ready rows still use **+** to choose Focus or Important. | Physical human-pointer and VoiceOver journeys remain separate evidence. |
| Running | Explicit provider-reported activity appears across every priority lane without changing priority. The highlighted count remains visible; **All priority lanes** single-click and dock-header double-click expand or contract the list. | Activity is never inferred from age or resumability. |
| Ready for Review | Provider-completed work appears independently of priority and opens the exact Task/Review destination. Opening does not clear it. A Ready-only green action reversibly acknowledges the exact response without changing NOW, Focus, Important, or Running; later or corrected evidence reappears. Expanded compact view shows five rows and the exact Organizer overflow. | Codex currently supplies built-in completion evidence; Claude Code, Cursor, and Grok are not guessed ready. A 1,024-thread receipt ceiling rejects overflow visibly instead of evicting handled work. |
| Ready sync fix | One exact safe legacy `completedAt: null` summary is treated as missing evidence for that candidate only. It no longer suppresses valid completed siblings. The derived 70-second source-generation envelope no longer races the 30-second stale-lock marker; at 85 seconds the native watchdog initiates TERM/KILL, followed by process-group and pipe cleanup. It is not a strict response-by-85s SLO. Private items, errors on purported completed turns, malformed shapes, invalid/future timestamps, timeouts, and unsupported metadata still fail the built-in batch closed. | The provider does not expose a trustworthy human opened/unread field, so Gajendra does not claim one. |
| Test isolation | Native transition proof mutates only a temporary synthetic catalog. Browser automation selects a bounded OS-assigned loopback port unless an explicit test port is supplied, so an interrupted preview on fixed port `4173` no longer creates that deterministic failure. | Automated real-window proof does not replace physical VoiceOver or clean-Mac testing; a narrow port-release-to-bind race remains possible. |
| Launcher and performance | The circular launcher has no clipped rectangular blur, recovers the inactive first click, and prewarms the card. Three August release widget samples measured median 47 ms prewarmed, 85 ms cold, and 86 ms warm against 58/86/85 ms at the exact pre-change revision; all paths stayed under the local 200 ms budget. | Same-host automation is not a cross-machine performance claim; the system AX tree did not expose the status item. |
| Sources and privacy | Codex, Claude Code, Cursor, and Grok adapters are explicit and bounded. Gajendra persists namespaced IDs, its own priority metadata, and bounded hashed review acknowledgements—not titles, prompts, transcripts, credentials, review bodies, destinations, or provider databases. | Installed-provider and clean-account proof remain separate. |
| Native app | macOS 13.5 source build, bundled Node v24.19.0/notices, service parity, strict ad-hoc codesign verification, and local bundle readiness pass. | Developer ID, notarization, stapling, Gatekeeper, clean-Mac, and binary distribution are not complete. |
| Mobile | A documentation-only transport/security plan exists. | No listener, relay, mobile app, credential, signing, or store submission exists. |

## Public launch package

- The README documents source setup, the daily workflow, direct priority actions, review semantics,
  privacy, and the source-only distribution boundary.
- High-resolution screenshots are rendered from the real SwiftUI views using synthetic fixtures.
- The [repository hero](evidence/launch/gajendra-hero.png) visibly labels the data synthetic and is
  embedded on the repository front page. The separate
  [Ready acknowledgement hero](evidence/launch/gajendra-linkedin-ready-review-v2.png) is the proposed
  LinkedIn attachment.
- The [launch-media receipt](evidence/launch/README.md) records dimensions, hashes, reproduction,
  and privacy validation.
- The [adversarial launch review](evidence/verification/2026-08-24-adversarial-launch-review.md)
  records challenged claims, accepted evidence, and gates that remain deliberately open.
- The [LinkedIn draft](worksheets/GAJENDRA_LINKEDIN_POST_DRAFT.md) recommends manual publication at
  **4:00 PM IST on Wednesday, 26 August 2026**, within a 3:55–4:05 PM window. It is not published.

## Current implementation receipts

The Ready acknowledgement release candidate passed locally on 2026-08-25:

- `npm run check` — script/release regressions, launch privacy validation, TypeScript, **110/110**
  Vitest tests, deterministic plugin build, and plugin validation passed.
- A local metadata-only provider probe confirmed that valid completed candidates remain visible
  when an unrelated legacy candidate has no completion timestamp. No live workload counts, task
  titles, task IDs, prompts, or transcripts are recorded in public evidence.
- `npm run companion:test` and `npm run companion:build` — native model/source invariants, isolated
  persistence/undo paths, bundled runtime, service parity, and strict ad-hoc signature checks passed.
- `npm run companion:ui-test` — full synthetic real-window journey passed with
  `priorityActions:true`, `readyPriorityActions:true`, `readyAcknowledgement:true`,
  `organizerNowGuard:true`, and `runningToReadyTransition:true`, including
  inactive-first-click recovery, reopen, quick Open versus long-press/drag, direct Ready/Running
  priority changes, exact-response acknowledgement and undo, the same visible row moving from
  Running to Ready on refresh, unchanged NOW, exact destination opening, dock controls, Search, and
  Organizer drag/drop. The exact final full run measured 55 ms prewarmed, 87 ms cold, and 83 ms
  warm; the focused widget run measured 67/86/91 ms.
- `npm run companion:ui-performance-test` — three final widget journeys passed the 200 ms budget
  and dependency-cycle gate. See the
  [same-host comparison](evidence/verification/2026-08-24-priority-actions-performance.md).
- `npm run launch:assets` and `npm run validate:launch-assets` — the real SwiftUI screenshot suite
  and Ready acknowledgement hero regenerated; **9/9** expected privacy-safe launch assets passed.
- `npm run companion:validate` and `npm run companion:bundle-readiness` passed; local readiness
  correctly reports `distributionReady:false` and ad-hoc signing.
- `npm run gauntlet` — **20** fail-fast gate receipts passed against the final source candidate,
  including live MCP, native UI, widget performance, **85/85** repeated browser journeys, five
  repeated 110-test unit runs, final-artifact validation, and dependency audit.

- The exact merged plugin and standalone app were installed locally from `d877ff4`. All nine plugin
  artifacts matched source; the installed app matched the rebuilt bundle; the isolated installed-app
  UI journey passed; and the real private state bytes plus `0700`/`0600` permissions were unchanged.
- GitHub Actions passed the `plugin` and `macos-companion` jobs for both the exact PR head and merged
  revision `d877ff4`.

Local receipts, hosted receipts, and installation proof are distinct. Together they close the
authorized source-release gates, but they do not close clean-Mac, physical accessibility, signed
distribution, mobile, or publication gates.

## Open gates

- Reload the Codex desktop host, which was already running when the plugin was installed, then
  complete the visible in-host icon, open, Search, exact-task return, and persistent-NOW proof.
- Clean-Mac installation and independent offline-path proof.
- Physical VoiceOver, status-item accessibility, manual drag, keyboard/system-toggle, and login-item
  receipts.
- The strict compact-widget journey is cycle-clean, but the longer synthetic journey can still emit
  an Organizer-path SwiftUI `AttributeGraph` diagnostic after all functional assertions pass; keep
  this P2 layout diagnostic open for a dedicated Organizer follow-up.
- Developer ID signing, notarization, stapling, Gatekeeper, archive parity, and distribution proof.
- Manual owner approval and publication of the LinkedIn post and synthetic hero.
- Mobile D01–D07 and D11 approvals before any relay or application implementation.

See the [release checklist](docs/RELEASE_CHECKLIST.md), [host procedure](docs/HOST_VALIDATION.md), and
[historical execution handoff](worksheets/GAJENDRA_RELEASE_BRAND_MOBILE_HANDOFF.md) for the complete
gate structure.
