# Focus, full-screen, and review UX follow-up

This records the first local trial. The [subsequent performance and correctness audit](../docs/PERFORMANCE-AUDIT-2026-09-05.md) supersedes its full-screen and release-status boundaries.

## Contract

Owner: Sid. Timing: current local session. Deliver local improvements for the reported full-screen
launcher failure, explicit conversational priority changes, and one-time acknowledgement of Ready
responses completed more than ten days ago. Keep provider tasks and all priority state unchanged
by review cleanup. No publication or merge. Stop at verified local behavior or a concrete runtime
verification boundary.

## Changes

- The launcher and prewarmed details panel now both retain `fullScreenAuxiliary` on every supported
  macOS release, alongside `canJoinAllApplications` where already supported. Previously the newer
  OS branch omitted the explicit full-screen eligibility flag. Apple documents the newer role as
  joining full-screen spaces **when eligible**, and the SDK documents `fullScreenAuxiliary` as the
  full-screen eligibility behavior. This is a candidate repair; compilation does not prove the
  reported cross-Space interaction is fixed.
- The MCP snapshot, set-current, set-level, and exact-response acknowledgement tools now include
  model visibility. The other five app controls stay app-only. The existing plugin skill explains
  exact task resolution, user intent, revision checks, ambiguous “this” references, and truthful
  mutation confirmation. This updates the existing integration, without adding a passive watcher.
- The user guide documents the conversational commands and host-reload requirement.

## Local review cleanup

Executed using the installed service and its bundled runtime, selecting response completion time
strictly before the session's ten-day cutoff. The existing mutation authority revalidated each
exact response and revision. A private pre-cleanup state copy is retained beside the live state.
No titles, IDs, review destinations, timestamps, or private state are copied into this repository.

All selected older responses were acknowledged; a fresh service snapshot contained no matching
older Ready response. Comparison excluding only revision and review receipt metadata proved all
other persisted state unchanged. The running native UI subsequently showed the reduced queue.
Recent Ready counts continue changing as other work completes. This is a one-time cleanup, not a
permanent rolling filter or a declaration that provider work is complete.

## Verification

- `npm run check`: passed, including 110 source tests and MCP model/app visibility assertions.
  The first sandboxed attempt could not bind loopback and had a child-process timeout; the same
  check passed outside that restriction.
- `npm run companion:test`: passed.
- Native build, installation parity, and host activation receipts are recorded below when complete.
- `git diff --check`: passed before installation.

## Runtime boundaries and follow-up

Computer control timed out opening TextEdit; the app connection later recovered. The old native
app's refresh and reduced review queue were inspected via its accessibility tree. Full-screen
Firefox was available, but app-scoped captures alone do not establish that macOS stayed on the
same Space during another app's activation. Physical full-screen confirmation remains necessary.

The native client selects the Codex desktop binary, while an unconfigured CLI service selects
`codex` from PATH. On this host the latter did not supply review evidence; cleanup therefore used
the exact native executable selection. Review actions in another host require that host's adapter
to supply valid evidence; focus operations do not depend on Ready evidence.

## Proposed next UX work (not implemented)

1. A visible “Last 10 days / All” review filter with an explicit bulk “Clear older responses” action
   and recoverable receipt handling. Keep recency distinct from reviewed state.
2. A keyboard shortcut and a small command menu for NOW, Focus, Important, and Reviewed, with the
   existing Undo feedback. This gives a direct alternative to holding and dragging.
3. Show the last successful refresh and a plain source error near status lists, so stale data is
   distinguishable from an empty queue or a disconnected provider.

Sources: Apple AppKit documentation for
[canJoinAllApplications](https://developer.apple.com/documentation/appkit/nswindow/collectionbehavior-swift.struct/canjoinallapplications)
and the installed SDK's `NSWindow.h` collection-behavior contract.

## Completed local installation receipts

- `npm run companion:build`, `companion:validate`, and `companion:bundle-readiness` passed.
  Signing remains local ad-hoc; no release or distribution claim.
- `npm run install:local` passed with all installed plugin artifacts matching source. A direct
  `tools/list` against the installed server returned exactly the four intended model-visible tools.
  The already-running AI host must reload before it can use the changed tool inventory; a natural
  language request in that reloaded host has not yet been observed.
- The installed native executable and server SHA-256 values match the built files:
  `1852d534df6cbe2c30ed579f08a177671fe8dbe05baae0090ae8700ca7d7841a` and
  `36c24ae21023dcfad3d63fabd4506a7224eebec12a55b86c03320feab08a08e6` respectively.
- The previous installed app was retained as `Gajendra.app.rollback-20260905-focus`. The updated
  app was launched, its compact card opened through the launcher, and retained priorities plus the
  reduced Ready queue were visible. An initial no-change click and menu-dismissal interference
  mean this interaction does not establish first-click reliability or full-screen Space behavior.
- Full-screen trial acceptance: Sid can open the launcher/card over the original full-screen app
  without switching to Desktop. If that still fails, this window-policy candidate is insufficient;
  do not call the issue resolved. Keep the previous app available for rollback.
- All source changes remain local on `codex/fullscreen-and-ai-focus`; no commit, push, or merge was
  performed. The full release gauntlet was not run, and no release claim is made.
