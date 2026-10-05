# Gajendra product experience — local implementation

Owner: Sid. State: local implementation complete and accepted on October 5; plugin activated and live navigation owner-confirmed. Requested on 3 October.
Outcome: a quiet, usable widget and plugin with the same authoritative work state.
This is a local update; no push, publication, merge, or provider-state change is authorized.

## Acceptance

- Ready for Review is explicit and survives midnight. Opening never acknowledges a result.
- Running and Needs input require actual provider signals. Inactivity never means finished.
- Continue contains current ongoing work; History retains finished work and predecessor chats.
- Finish/Reopen and explicit continuation links are reversible, revision-checked actions.
- A selected NOW always belongs to Focus; explicitly finishing NOW can leave selection empty.
- Both interfaces consume one service projection and detect changes made in the other interface.
- Saved data appears before slow discovery, with honest freshness and useful recovery states.
- Exact provider navigation, search, keyboard use, appearance, and existing priority actions work.
- Installed widget/plugin match the tested build. Host capabilities are reported only with proof.

## Design and engineering

Operate mode. Preserve the elephant/lotus identity and system typography. Remove oversized
marketing copy, repeated coloured pills, nested decorated cards, and ambiguous checkmark actions.
Use labelled Review, Running, Continue, and History navigation, restrained separators, readable
rows, and progressive disclosure of secondary actions. Native and embedded layouts may adapt to
their hosts; names, state transitions, and authority remain identical.

Test seams: revisioned service/store interface, MCP/CLI transport, and user-visible native/web
journeys. These implement the user's accepted product workflows. Matt Pocock's module-design
guidance and Karpathy's Four Coding Behaviors apply; no new framework or dependency is needed.

## Ownership

- Root: plugin UI, integration, docs, install, final validation.
- Astra shared_product_state: server/shared projection, durable bounded IDs/enums, service tests.
- Astra native_experience: Swift model/client/widget/organizer and native tests.
- Luna luna_coordination: fresh-context orchestration discovery, skill selection, review.

The existing dirty 0.3.2 recovery/cache work is the starting point and is preserved. Persistent
completion and continuation metadata extends the older priority-only contract at the user's
explicit request. No prompts, transcripts, free-text work labels, or provider DB writes are added.

## Verification and stopping condition

Run focused behaviour tests, repository check, web interaction/accessibility tests, native
self-tests/build/validators, real UI inspection, and installation parity. Review the integration
with a different model/lens and fix evidenced defects. Stop when the accepted flows are proven
in the available interfaces; record any unsupported host integration precisely.

Requested Astra–Luna routing and actual model dispatch are separate receipts. Worker dispatch
requests explicitly use gpt-6-astra/high and gpt-6-luna/high; no cross-provider claim is made.

## Integration receipts — 3 October

- Current Harness prepare selected Gajendra with coherent ownership. The older AstraLuna profile
  ran from worktree `5206` with an isolated variable directory; it reported preparation only and
  unresolved provider model IDs. Actual fresh-context dispatch used Astra for backend/native work
  and Luna for coordination and cross-process review. These are separate receipts.
- Applied Impeccable Operate guidance, design taste, canonical Karpathy, Matt Pocock codebase-design
  and TDD, and local PR-development/Standards guidance. No new framework or runtime dependency.
- `npm run check`: 139 tests, TypeScript, build, packaging and existing asset checks passed.
- Browser journeys: 28 passed after the final menus and contrast fixes. Includes accessibility,
  responsive/forced-colour/reduced-motion, exact navigation boundaries, lifecycle/continuation,
  review acknowledgement and five-second polling without passive layout motion.
- `npm run test:sync`: real independent MCP and CLI processes passed bidirectional revision reads,
  stale-write rejection, Finish/Reopen, link/unlink, and retention of a 2020 review signal.
- Native self-tests passed, including later review fixes: an errored newer authoritative revision
  replaces stale workflow state; transient sync errors are visible and clear independently.
- Native CUA synthetic journey: clicked the lotus, Finish cleared NOW (revision 1), Command-Z
  restored it, exact searched continuation transferred NOW, Mark reviewed created one receipt
  without completing work. The synthetic state is isolated from private user state.
- Local plugin 0.4.0 installed with all runtime/skill/hook artifacts matching source. A fresh Codex
  app-server inventory advertises all 12 tools and the MCP App resource. Read-only live provider
  discovery succeeded; this is not proof of current desktop panel activation.

Independent review exposed and fixed error-revision retention, invalid predecessor menu actions,
settings stacking, native duplicated menus and nav accessibility labels. Real interface inspection
is distinct from synthetic host and bundle evidence.

Installed native 0.4.0 was opened and inspected with live metadata after the synthetic test.
Final app binary, plist, server and bundled Node hashes match the built bundle. Plugin runtime,
skill and hook artifacts match source. All seven stored priority entries remained unchanged at
revision 218 (one is outside current source results and is honestly disclosed, not deleted).
The existing embedded MCP App panel was inspected through the dedicated MCP Apps surface and
still shows the old interface. Fresh app-server registration is 0.4.0, so existing-session reload
is the outstanding activation gate. The user has been asked to reload at a safe point; no active
Codex chat was interrupted. Optional hook trust was neither granted nor claimed.

Further proof after reload: reopen Gajendra, verify Review/Running/Continue/History and Actions,
then validate exact provider navigation in the host. Local implementation, tests and installation
are complete. No push or publication.

Blocked audit: the activation gate persisted across three consecutive goal turns. The latest
read-only call still returns the previous snapshot contract (no product projection), and this
session exposes only the four older model-visible tools. The goal is blocked on a safe Codex
reload and subsequent embedded-panel/navigation verification; it is not marked complete.

## Post-reload verification — 5 October

The owner reloaded Codex. Host preflight confirms a new process, no reload needed, version 0.4.0,
all 11 installed artifacts matching, and all 12 tools registered. This conversation now exposes
Finish/Reopen and continuation tools, returns the shared product projection, and the real embedded
panel renders the new Review/Running/Continue/History controls and Actions menus.

The first live refresh returned a Codex source error and honestly retained neutral saved data.
A later actual MCP refresh returned 245 current Codex chats and 200 Claude chats, with 75 Ready,
one Running, and six Continue items; no cached marker remained. An independent Astra diagnostic
confirmed the bundled CLI and successful 245-row metadata collection. Listing latency reached
12.06 seconds for one RPC against the 15-second bound, so transient reload load is plausible but
not proven as the first failure's cause. No provider state or source configuration was changed.

Fixed the live-probe's false-positive path: a ready non-Codex source can no longer justify the
`codexAppServer: reachable` claim. The corrected isolated probe passed with 245 Codex chats;
`npm run check` passed all 139 tests, TypeScript, build and packaging again. Built server/UI hashes
still match installed files. The private store remains byte-for-byte identical at revision 218.

Embedded inspection timed out after the initial rendered observation, including when reacquiring
the still-listed panel. This is not evidence that its buttons fail. The owner was asked to leave
the Gajendra side panel visible so exact Open thread navigation can be verified. That gate remains
open; the earlier reload blocker is resolved. No restart, priority mutation, or publication occurred.

The post-reload panel inspection timeout persisted across three consecutive goal turns, including
a final bounded attempt to select the existing panel. The resumed goal is blocked on live host
navigation verification. It can continue once the panel is inspectable or the owner supplies the
actual Open thread result and confirms the selected NOW is retained. This is a verification
blocker, not a finding that navigation is broken.

## Completion audit — 5 October

After being asked to click Open thread, confirm the correct chat opens, and return to confirm NOW
is unchanged, Sid replied: “It works, resume the goal and finish it.” This is the owner's acceptance
of that requested live journey; it is not represented as a successful automated UI inspection.
It resolves the navigation blocker above.

Final read-only checks found all 11 installed plugin artifacts and all four native bundle artifacts
matching the build. Native and plugin server bytes are identical. The current MCP response retains
the shared product projection, original NOW and revision 218; private state bytes remain identical
to the pre-install receipt, with mode 0600.

| Acceptance | Evidence and result |
| --- | --- |
| Review survives age; opening does not acknowledge | Shared projection and review regressions; 28 browser journeys; live Review panel observed. |
| Running/Needs input use explicit provider evidence | Source regressions and real live Codex refresh; no idle-to-completion inference. |
| Continue/History and reversible Finish/continuation | Service/process regressions, native self-tests and real isolated native journey. |
| NOW belongs to open Focus; Finish may clear it | Revisioned workflow tests, native Finish/Undo journey and owner-confirmed return check. |
| Shared state, cache and refresh | Independent MCP/CLI synchronization, stale-write and cache regressions, matching installed backend. |
| Search, keyboard, appearance and menus | 28 browser journeys and real native/interface inspection; Impeccable/taste refinements applied. |
| Exact host destination and local installation | Owner-confirmed live navigation; current plugin/native artifact parity and unchanged priorities. |
| Requested engineering and review approach | Harness preparation, separate Astra/Luna dispatch/review, and named skill application receipts above. |

`npm run check` most recently passed 139 tests, type checking, build and packaging after the health
probe fix. The corrected isolated live probe passed with 245 Codex chats. The remaining changes
are acceptance documentation only. The authorized local goal is complete. Optional hook trust,
one-week adoption, other-host support, signing/notarization, public release and publication remain
separate; none is claimed by this completion.
