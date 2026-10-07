# Review and History experience

Owner: Sid. Requested October 5; no external deadline supplied. The action enabled is quickly
reviewing a result, knowing whether that acknowledgement was saved, and finding earlier work.
Acceptance: identical Review/Running heading geometry; compact accessible review action; immediate
exact-response dismissal; durable asynchronous save with honest failure/retry; History that separates
Reviewed from Finished; matching native/plugin behavior; preserved private priorities.
Stop after the bounded whole-surface audit's material fixes and relevant verification. No publication.

## Emil design-engineering audit

The audit covered compact and Organizer headings/rows, History, search, settings/source feedback,
mutation feedback, keyboard/pointer motion, and reduced motion. It applied the Emil design-engineering,
Apple design, animation vocabulary, review, improvement, and opportunity skills, with existing
Gajendra design authority and Impeccable's craft floor. Fresh Astra agents independently handled the
web and receipt/test slices; Luna audited the surfaces and implemented the Organizer slice.

| Before | After | Why |
| --- | --- | --- |
| Review and Running use different font, icon and inset geometry | Shared native heading geometry and matching web header rules | Align the actual baselines, not just their outer containers |
| Long Mark reviewed text and redundant orange Task/Review destination ornament | Named checkmark action with tooltip/help and sufficient target size; destination remains in semantic labels | Reduce row noise while keeping the action understandable |
| Row stays visible through fresh discovery and persistence | Immediate exact-response presentation update; authoritative snapshot stays separate | Confirm the click immediately without claiming a completed save |
| Generic failure and global busy state | Saving feedback; authoritative row restored on failure; retry reconciles the original operation key | A lost response can occur after the write, so retry must be idempotent |
| Undifferentiated History and limited return paths | All/Reviewed/Finished filters, explicit state, direct title links, bounded Show more, continuation links | Reviewed is not Finished; earlier work must remain reachable |
| Native mutation error offers Reconnect | Retry review for save failures, Reconnect only for source problems | Recovery should match the actual failure |
| Keyboard activation gets decorative button scaling | Pointer-only press animation; keyboard activation remains immediate | Frequent input should not wait for decoration |

The existing reduced-motion reset is retained: removing movement already satisfies the relevant
accessibility requirement. Added decorative stagger, motion libraries, and a visual redesign were
rejected because they would not improve this frequent-use workflow.

## State and history contract

- Optimism is session-only and keyed to the exact thread/response identity. Priorities, NOW, context,
  explicit completion, and provider-owned data remain authoritative and unchanged by acknowledgement.
- Pending rows appear as Saving review in All History; Reviewed filters contain confirmed receipts.
- A matching durable receipt projects `reviewAcknowledged: true`. No new timestamps, titles, or
  transcript content are persisted. Updated timestamps remain chat activity timestamps.
- Newer response evidence, Running, Needs input, fresh absence, and external Undo take precedence
  over old local feedback. Failure never writes an inverse acknowledgement or restores an old store.
- Retry after transport uncertainty retains the operation key. Acknowledgement still validates fresh
  provider evidence under the existing revision/idempotency transaction contract.
- Closing before a queued write finishes cannot manufacture completion; the next refresh shows only
  durable receipts. Pending feedback is not stored as reviewed history.

## Verification

- `VITEST_MAX_WORKERS=1 npm run check`: passed 156 tests across 12 files, TypeScript, UI/server
  builds, release-readiness regressions, privacy-safe launch assets, and plugin validation.
- Final native production build, `companion:test`, `companion:validate`, and local
  `companion:bundle-readiness`: passed. Native gated-client scenarios cover immediate dismissal,
  failure restoration, same-operation retry, Undo, and newer-response/revision safety.
- CUA browser journeys used synthetic data: an eight-second pending save immediately removes the
  clicked result; a forced failure restores it with Retry; retry succeeds; Reviewed/Finished filters
  and Undo work; a newer response remains visible after the older acknowledgement finishes.
  Keyboard focus moves to the next review control. Header bounds match at normal width
  (x 232, width 816, height 38) and 360px (x 16, width 328, height 38), with no horizontal overflow.
- Visual inspection caught and fixed duplicated Updated copy and singular chat grammar. Final
  TypeScript/build checks passed. Native History hides its redundant visible picker label while
  keeping its accessible name; Organizer icon slots and heading heights also match.
- The installed native launcher opened Details. Real metadata inspection confirmed aligned Review
  and Running headings, icon actions, removed Task ornament, and working Reviewed History filters.
  The final Organizer build was visually checked with both headings visible. No real review was
  acknowledged for testing.
- Local installation verified all nine native bundle files and eleven plugin artifacts. Executable
  SHA-256: `019dc1e298620952c70a9c4088f3faa8d0c32e4e0a34db6d7b951808fc015a36`.
  UI SHA-256: `5c8d17b94c7b27c8165267526366b7041f25b52c0e381bf5bb075ff08d76a67c`.
  Shared server SHA-256: `78434801e5f150b4047e7c3a324a4a4310cf2e3bf6346443abd46d0f0bf10d60`.
- Private priority state is byte-for-byte unchanged from this pass's baseline: revision 220, seven
  entries. Timestamped local app rollback bundles are retained. Earlier revision-218 receipts are
  historical, not the baseline for this pass.

This is a local installed update, not a publication or distribution receipt. Native review mutation
behavior is proven by isolated self-tests; live user rows were inspected read-only. The built plugin
UI was exercised in the in-app browser with synthetic data, not by mutating the user's embedded panel.
An already-open embedded panel must be reopened to load the new UI. Physical VoiceOver and the
owner's precise fullscreen-Space configuration were not re-certified. The existing warning about one
saved priority outside source results remains accurate and was not hidden or repaired by deleting data.


## Hover follow-up and seven-finding closure — October 5

Owner and stopping condition remain unchanged: Sid; no supplied deadline; finish the authorized
local experience once the seven findings and hover acceptance are proven. Preserve the dirty
0.4.0 candidate; do not publish, mutate provider work, or test acknowledgement on real records.
The earlier verification section is a historical receipt; the following hashes supersede its builds.

| Finding | Closure in current candidate | Evidence |
| --- | --- | --- |
| Review/Running geometry mismatch | Shared icon slots and header typography/insets | Native widget/Organizer CUA inspection; plugin bounds equal at default and 360px widths |
| Noisy review action/ornament | Named checkmark with distinct target; semantic destination retained | Native and plugin accessible control names inspected; green action matches canon |
| Delayed row removal | Exact-response optimistic dismissal; saving remains honest | Synthetic eight-second save removes row immediately and focuses next review control |
| Generic failure/global busy | Failed acknowledgement restores row; Retry retains operation key | Forced browser interruption, successful Retry, 156-test suite and native gated-client tests |
| Undifferentiated History | All/Reviewed/Finished, confirmed-only Reviewed, direct return and Undo | Synthetic reviewed filter and Undo journey; source/native regression checks |
| Wrong native recovery | Retry review for acknowledgement failures; Reconnect for sources | Independent source reconciliation plus native self-tests; real unresolved-source warning preserved |
| Keyboard decorative motion | Pointer-only animation; keyboard activation immediate | CUA Enter-collapse and History filter focus retention; fixed focus lost during rerender |

### Refinements

- Full heading highlights for Ready for Review, Running, Focus and Important. Running's green
  waveform moves once, a small letter arrives in the tray, the star highlights, and the bookmark
  fills/moves briefly. No timers or idle animation loops. Native entry/exit takes 220/160ms;
  plugin icon entry takes 220–240ms and can cancel/return on pointer departure.
- Reduce Motion keeps static highlights/fills and disables transforms. Pointer animation does not
  gate commands. Keyboard input, window blur and visibility changes cancel plugin hover motion.
- Row titles become bolder within the same single-line row slots. Native reserves the bold footprint.
  The final independent review found accidental single-line NOW truncation; the final fix restores
  two Organizer lines and two/three widget lines while retaining reserved geometry.
- Organizer Your priorities is centered. Plugin review actions use the existing green semantic
  accent. Collapse, History expansion and filters restore the activated keyboard control after render.

### Current evidence and limits

- Final `VITEST_MAX_WORKERS=1 npm run check`: **156/156 tests, 12 files**, TypeScript, builds and
  plugin validation passed. A first restricted run hit an isolated fixture timeout and loopback
  `EPERM`; the authorized unrestricted rerun passed without a source workaround. The final green
  action color-only change subsequently passed build/plugin validation and `git diff --check`.
- After the NOW fix, `companion:test`, `companion:build`, `companion:validate` and
  `companion:bundle-readiness` passed. Local readiness remains ad-hoc and `distributionReady:false`.
- CUA exercised the built plugin using synthetic data: immediate pending dismissal, failure/Retry,
  confirmed Reviewed history, Undo and keyboard focus. At 360px, document width and scroll width
  both equal 360; Review/Running headers both measure x16, width328, height39. At normal width
  both headers measure x32, width603, height39. Hovered title weight changes 550 to 700 while row
  height (92.695px), title height (20.297px) and action dimensions (108.578 by 34px) remain fixed.
  Locator scrolling changed viewport Y; this is not evidence of identical absolute page coordinates.
- Installed synthetic native widget and Organizer were inspected through CUA. Review and Undo worked;
  Review's tray/letter, Running's waveform and Focus highlight were visually observed. Native row
  weight and full heading feedback were inspected. Bookmark motion is source-reviewed; screenshots
  alone do not certify every transition frame. Final installed normal widget opened with real
  metadata, original NOW and the existing unresolved-priority warning; no real review was changed.
- Current physical VoiceOver and OS Reduce Motion toggle journeys were not run. The static reduced
  path is verified by code review; native self-tests report this host's Reduce Motion off. Previous
  physical-accessibility/fullscreen limits remain open and are not claimed closed by this pass.
- Local evidence is under `.artifacts/hover-2026-10-05/` (ignored): synthetic screenshots, final
  source/native logs and installation receipt. No native Codex inspection or non-CUA UI driver used.

Final executable SHA-256: `de1ebc36d6ecf14cb2182b32a594342b8d491d6db8fc0e040559ac7c7c3d45ad`.

Final plugin UI SHA-256: `d5557f74cd98088434ae8f1bb25429887c1fe7067d42148ddced50b35c911334`.

Shared server SHA-256: `78434801e5f150b4047e7c3a324a4a4310cf2e3bf6346443abd46d0f0bf10d60`.

All nine native bundle files and eleven plugin artifacts match source/build. Private priority state
is byte-for-byte unchanged at revision 220 from the preserved baseline, with owner-only permissions.
Rollback app and plugin copies are retained privately by the operator.
Existing embedded panels must be reopened to load the final UI. The normal installed app is running.

Rejected scope/claims: no idle flourish, decorative delay for keyboard commands, fresh timestamps
masquerading as review history, publication/CI/distribution claim, or inferred fix for the missing
saved source record. These would weaken the contract or go beyond this local installation.
