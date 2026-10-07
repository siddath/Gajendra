# Status

**Product:** Gajendra — One clear focus across your AI tools.

**Promise:** One NOW. One short queue. One click back to the exact thread.

**Reconciled:** 2026-10-05 (local 0.4.0 implementation accepted; installed parity verified; owner confirmed live navigation)

## 0.4.0 source release closure — 2026-10-07

The five pending PRs were resolved in ascending order: #34 merged (`e37d370`), #38 merged
(`cb37ac4`), #39 closed because its ip-address update was already included, #40 merged (`b8495bb`),
and #41 merged (`e523ddb`). Each merge followed passing current hosted checks; no admin bypass.
MCP Apps stays on compatible 1.7.5; SDK 1.31.0 and current transitives carry the runtime fixes.

The release update adds six explicit product evals to CI and the gauntlet, current SwiftUI renders,
a new ivory Focus Deck hero, fresh isolated native/plugin screenshots, corrected community docs,
and current third-party notices. Both 2026 MIT license copies were reviewed and remain unchanged.
The source release uses `v0.4.0`; the earlier RC tag remains historical. See
[release notes](docs/releases/0.4.0.md), [eval workflow](docs/EVALS.md), and
[capture provenance](evidence/launch/README.md). The [LinkedIn draft](worksheets/2026-10-07-gajendra-040-linkedin-draft.md) remains unpublished.

The release gauntlet remains partial in this environment, with three native AX-driver gates not
run. Separate CUA review/Undo checks do not establish those broader native latency/fullscreen gates.
The following dated sections retain earlier implementation and prerelease context.

## 0.4.0 source prerelease preparation — 2026-10-06

The native app and Codex plugin have been updated with title emphasis crossfades, row feedback and
pointer press response. Navigation and disclosure now dispatch immediately while cosmetic motion
runs independently. Keyboard and Reduce Motion paths remain immediate. Release review fixed a
relative-config/provider/catalog scope collision in the shared backend; regression coverage
preserves sharing for equivalent absolute configurations.

The candidate has 169 passing source tests and 31 passing browser journeys, plus five source-suite
repetitions and 155 passing repeated browser cases. The partial gauntlet has 18 passing gates and
three native driver gates not run; the separate CUA checks do not replace those broader gates.
Coverage includes immediate
action dispatch, newer-response handling, Undo and accessibility. Native self-tests, release build,
strict signature and bundle validation pass. Separate CUA journeys verified installed native
review/Undo and priority changes plus plugin review/Undo. The installed app was returned to real
metadata; user state stayed byte-identical. An in-place bundle overwrite caused the installed Node
runtime to be killed; replacing the entire bundle with a fresh copy restored execution. Rollback
copies remain private. Updated plugin parity includes bundled license notices.

The GitHub update is a source prerelease attached to the PR candidate, not an unreviewed merge or a
notarized download. [Release changes](docs/releases/0.4.0.md),
[Codex publication readiness](docs/CODEX_PLUGIN_PUBLICATION.md) and [privacy information](PRIVACY.md)
cover the current package. Directory submission still needs a supported local-MCP route or approved
remote architecture, verified publisher and review materials; no official approval is claimed.
The LinkedIn update is a local owner-review draft and has not been posted. Runtime dependency
patches clear the production audit. The unpatched build-only braces advisory and its unused
pattern-matching path are documented in the release notes.

## Shared workflow candidate

The local 0.4.0 candidate gives the native utility and embedded extension the same Ready for Review,
Needs input, Running, Continue, and History projection. Ready does not expire with age. Explicit
Finish/Reopen persists across clients/restarts and preserves pending review; finishing NOW clears it
without silently selecting another task. Exact continuation selection transfers priority/context/
order/NOW and retains predecessor chats. Opening remains read-only; idle never means finished.

Both surfaces can show a neutral cached view before live refresh, check local revisions about every
five seconds while visible, and request source refreshes about every thirty seconds plus provider
latency. Optional lifecycle hooks write one private invalidation token and do not steer Codex or
mutate work. Installation does not grant hook trust; ordinary polling remains the fallback.

Current verification: `npm run check` passed 139 tests plus TypeScript/build/package checks;
28 browser journeys passed, including external-sync Undo safety; native self-tests, production
build/signature and local bundle validation passed. Independent MCP/CLI process synchronization
passed. Real native synthetic journeys covered Finish/Undo, exact continuation, review, search,
and an externally written change appearing automatically. The installed native interface was
then checked against real metadata. User priority state remained byte-for-byte unchanged.

The app and plugin are installed as 0.4.0 with matching artifacts and a private rollback backup.
A fresh Codex app-server advertises all 12 tools and the UI resource. After the owner's October 5
reload, this conversation exposes the new lifecycle tools and the embedded panel renders the
Review/Running/Continue/History navigation. An initial source failure showed saved metadata and
an explicit diagnostic; a subsequent live refresh returned 245 Codex chats, 75 Ready and one
Running, with no cached marker. Its exact initial failure cause is unproven. The corrected live
probe now requires the Codex source itself to be ready and also passes with 245 chats. All 139
source tests/build checks passed again, installed runtime hashes match, and private state bytes
remain unchanged. Panel interaction inspection timed out after the initial rendered observation.
The owner then confirmed the requested Open thread and return/NOW-preservation journey with
“It works, resume the goal and finish it.” This closes live navigation acceptance through owner
confirmation, not an automated click receipt. Final checks reconfirmed all 11 plugin artifacts,
four native artifacts, the shared backend, and unchanged private state at revision 218. Optional
hooks remain untrusted. The local implementation goal is complete; no public release is claimed.

On October 5 the owner separately reported that the native launcher does not open over fullscreen
Codex. A [focused recovery patch](worksheets/2026-10-05-fullscreen-launcher.md) reconciles the logical
open flag with AppKit visibility and active-Space state. Native tests and repository checks pass;
the owner's exact fullscreen case remains unconfirmed. Earlier chat-navigation acceptance does not
close this new report. The owner subsequently confirmed that the recovery patch did not resolve
it. A temporary metadata-only diagnostic build then captured a successful physical click, and the
owner reported that opening now works. The cause of the earlier failure remains unproven; temporary
diagnostics have been removed. The subsequent installed cleanup removes compact row More controls
and the duplicate Continue shortcut, labels open priorities Your priorities, and gives Ready for
Review a tray mark. The plugin uses matching labels. Source/native checks and installed parity pass;
the seven saved priorities remain unchanged. Details and limitations are in the worksheet.

The next owner-requested layout refinement removes the remaining top work navigation from both
surfaces. Your priorities is centered in primary text; Edit remains on the right, and Focus and
Important have equally emphasized, aligned headers. The local app/plugin are updated and all
nine native files and eleven plugin artifacts match. All 139 source tests, native self-tests and
bundle/signature checks pass. Browser verification covered normal and 360px widths; native layout
was checked with synthetic SwiftUI renders. Automated launcher clicks did not leave the Details
card visible for live inspection in this pass, so live opening is not reconfirmed. Priority state
remains byte-for-byte unchanged at revision 218.

The October 5 [Review and History UX pass](worksheets/2026-10-05-review-history-ux.md) is implemented
and installed locally. Review/Running headings share aligned geometry; review rows use named
checkmark actions and omit the orange Task ornament. Exact-response dismissal is immediate, with
asynchronous durable saving, failure restoration, idempotent Retry, Undo, and protection for newer
responses. History separates All/Reviewed/Finished and provides direct return paths. Emil-family
audit findings and evidence are recorded in the worksheet. All 156 source tests, final TypeScript/
build checks, native self-tests and local bundle/signature validation passed. Synthetic browser
journeys covered delayed success/failure, retry, keyboard focus, newer responses, filters, Undo, and
360px layout. Installed native Details/Organizer were visually inspected; no real review was changed.
Nine native and eleven plugin artifacts match; private state remains unchanged at revision 220.
Existing embedded panels need reopening to load the new UI. No public release is claimed.

The follow-up hover pass is also installed locally. Ready, Running, Focus and Important have
full heading highlights and brief icon feedback; rows gain weight without moving their controls.
Reduce Motion uses static feedback. Keyboard collapse and History filters preserve focus after
rendering. Final review preserved the previous multiline NOW allowance. All 156 source tests,
native self-tests, production build, strict signature and local readiness checks passed. Synthetic
CUA journeys verified save/failure/Retry/Undo and narrow layout; the final installed widget opens
with real metadata. All nine native files and eleven plugin artifacts match the final build; private
state remains byte-identical at revision 220. The worksheet records hashes, rollback paths, audit
closure and the physical accessibility/system-toggle limits. No publication or provider mutation.

The October 5 [shared backend/cache performance pass](worksheets/2026-10-05-backend-cache-performance.md)
is implemented and installed locally. Native and MCP clients share a private session backend with
prepared catalog reads, coalesced refreshes, revision synchronization and durable local writes.
Supported Codex metadata-only listing removes the measured rollout-scan bottleneck; periodic full
reconciliation remains. Controlled three-sample medians improved full refresh from 15.05 seconds
to 0.797 seconds (94.7% lower) and local writes from 15.92 seconds to 0.113 seconds (99.3% lower).
Final installed warm refreshes took 646–671 ms, prepared reads 90–94 ms and writes 101–117 ms;
the new-owner cold refresh took 2.86 seconds. These are backend CLI timings, not UI-render latency.
All 167 source tests, TypeScript/build checks, native self-tests and signature/bundle validation
passed. Synthetic native priority, review and Undo interactions passed. The normal installed widget
then rendered 449 real threads; state remained byte-identical at revision 220. Nine native and
eleven plugin artifacts match, with rollback copies retained. Existing embedded panels need
reopening. This remains the bounded local trial; no public release or provider mutation occurred.

The [daily workflow trial](docs/DAILY-WIDGET.md) retains the October 1 cache receipts and the owner's
one-week adoption decision. Preserve private state and its backup before rollback: older v3 writers
can discard lifecycle/continuation/cleared-NOW fields. No source publication is authorized here.

## Local Codex extension recovery

Version 0.3.2 adds supported sidebar/conversation entrypoints, initial-result rendering, connection
retry and visible navigation errors. It repairs Claude directory-budget exhaustion, recognizes
Codex's new bundled CLI path, and explains provider failures/unresolved saved priorities in both
surfaces. The state investigation found preserved priorities, not an erased store; one saved task
is archived in Codex. See [extension use](docs/CODEX_EXTENSION.md) and the
[current verification worksheet](worksheets/2026-10-03-product-experience.md).
The 0.4.0 local acceptance is recorded above; this is not a new public release. The dated release
receipts below describe earlier builds.

The embedded refinement follows host style variables in Native/Auto appearance, retains search
through updates, and moves source switches into explicit settings. The installed Codex conversation
panel was observed and its navigation was owner-confirmed. Advertised entrypoints alone do not
establish availability in other hosts or accounts, or OpenAI first-party ownership.

**Public state:** source is public on `main`; no signed/notarized binary or mobile release is
claimed.

## Widget update and settings polish

The [independent widget-sizing update](docs/WIDGET-SIZING-2026-09-06.md) is implemented and installed.
Compact, Comfortable, and Expanded change task layout; a separate slider changes the outer widget
size on release. Preferences persist independently, old dimensions migrate once, and the settings
popover remains interactive outside the card bounds. Theme, Appearance, and Lotus position share
an equally spaced dropdown column. Settings opening and task layout changes have short transitions
that respect macOS Reduce Motion.

Implementation/test freeze `bd43025` passed all 21 gauntlet gates, including full native,
synthetic full-screen, strict widget performance, and 102 browser journeys. The tested app is
installed with signature/parity verification, unchanged priority data, an installed bottom-right
interaction recheck, direct UI inspection, and a retained rollback.
The notes preserve an earlier 224 ms timing failure alongside its passing unchanged-code recheck
and both complete gauntlet receipts.

Publication is tracked in [PR #33](https://github.com/siddath/Gajendra/pull/33), with hosted CI and
merge receipts on that PR. The local validation above remains anchored to its tested implementation;
it does not substitute for the hosted checks. Later material in this file describes earlier merged
behavior or explicitly dated receipts.

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
superseded branches have been retired.

## Dependency maintenance

The [dependency review](docs/DEPENDENCY-REVIEW-2026-09-05.md) records the Zod update in
[PR #29](https://github.com/siddath/Gajendra/pull/29) and completed TypeScript/Vite/Vitest migration
in [PR #23](https://github.com/siddath/Gajendra/pull/23), including explicit benchmark/process-test
runner ownership, asset types, source-build Node requirements, rebuilt artifacts, and current
validation evidence. Earlier dated launch receipts below do not substitute for these checks.

## Historical merged user-facing state (before the local 0.4.0 candidate)

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

## Dated August implementation receipts

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

- Optional hook trust remains a separate owner decision; normal polling already operates without it.

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
