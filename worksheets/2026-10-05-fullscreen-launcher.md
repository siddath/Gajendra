# Fullscreen launcher recovery

Owner: Sid. Requested October 5; no external deadline supplied.
Action enabled: open the compact card with one launcher click while working in a fullscreen app.
Acceptance: reveal an inaccessible card, retain ordinary click-to-close and rapid reopen, preserve
priorities, and distinguish model/build evidence from the owner's exact fullscreen setup.
Scope: local native repair only; preserve the existing 0.4.0 workflow/plugin work.

## Finding and change

The installed and built executables matched before this investigation. Both overlay panels already
carry `canJoinAllSpaces`, `fullScreenAuxiliary`, and, on newer macOS, `canJoinAllApplications`.
The launcher opened the installed card through accessibility and a CUA coordinate click. Neither
observation proved that Codex stayed in its fullscreen Space during the interaction.

The launcher trusted its logical presentation flag even if AppKit no longer showed the card on the
active Space. The toggle now dismisses only when both the flag and actual visible/active-Space
state agree. Otherwise it runs the existing reveal path. Dock reopen and the existing animation
generation guard remain intact. No collection flags, activation policy, data, or plugin behavior
changed. This repairs a concrete recovery gap; it is not yet a confirmed root cause of the report.

Independent Luna review found no regression in those transitions. An ordered, active-Space card
could still be obscured; do not infer that case or add more flags without a live reproduction.

## Verification

- Native self-tests passed, including stale-presentation recovery and reopening during dismissal.
- `npm run check` passed all 139 tests, TypeScript, build, and plugin validation. The first concurrent
  run hit one lifecycle CLI timeout; the unchanged serial rerun passed.
- A temporary separate fullscreen host was exercised through CUA and closed. It reported an
  inactive Space, so it provides no same-Space acceptance receipt.
- Production build, companion validator, and local bundle/signature checks passed. Installed at
  `~/Applications/Gajendra.app`; the previous app is retained privately for rollback.
- Installed executable SHA-256: `a8c0696a4af8b26eac14312e4b8ae43c3616330ccb348e1d3c281cf5d434747d`.
  Every installed bundle file matches the build, and the native/installed-plugin/source backends
  match. The seven saved priorities remain byte-for-byte unchanged at revision 218.
- CUA opened the newly installed launcher with a coordinate click, observed the populated Details
  card, then dismissed it with Escape. This is an ordinary interaction receipt, not proof that
  Codex remained fullscreen on the same Space. The launcher is left closed for the owner's retry.

The earlier owner confirmation of chat navigation does not close this new fullscreen report.
Stop source changes after the focused repair is verified; retain exact Codex-fullscreen acceptance
as open unless the current tools or owner demonstrate it.

## Owner rejection and diagnostic follow-up

The owner replied “It's not working.” The visibility recovery did not resolve the reported case.
Do not describe it as the fullscreen fix. Fresh Astra and Luna reviews found no evidence for more
collection flags or an activation-policy change. Mixed NSEvent coordinate bases remain an unproven
input hypothesis; same-Space occlusion and missed mouse-up delivery also need live evidence.

A temporary diagnostic build is installed with executable SHA-256
`c30956f0a5a6065a77b698d735e84fb627a5845eb59ae3404af847b624487b96`.
The previous app is retained privately for rollback.
It retains at most 64 window/event metadata records in a mode-0600 temporary file named
`gajendra-overlay-diagnostic-<pid>.json`. No titles, coordinates, chat IDs, prompts or provider
responses enter the trace. The unified log store was unavailable, so this app-owned buffer is used.
Remove the temporary instrumentation after the failing-click comparison; it is not a product feature.

The automated baseline received down/up, accepted the primary action, and produced a visible,
active-Space, unoccluded card. The reported physical fullscreen click is still required to compare
with that baseline. CUA's synthetic event did not move the actual desktop pointer into the pill,
so it cannot establish the human pointer/Space path. Escape dismissed the card, leaving it closed
for the owner. No new functional fix is claimed by this diagnostic build.

## Owner-observed recovery and control cleanup

The owner subsequently reported that the card now opens. The captured physical-click trace showed
accepted mouse-down/up and an active-Space, unoccluded card after reveal. This corroborates the
reported successful opening; it does not establish the earlier failure's cause. Temporary tracing
and its file were removed in the subsequent control-cleanup build.

At the owner's request, the compact widget now omits per-row More controls. They contained explicit
Finish/Reopen and continuation actions and were disabled in a cached snapshot, which made them
feel inert. Those functions remain in Organizer and the plugin. The redundant Continue shortcut
was removed, its section is now Your priorities, and Ready for Review has a tray icon in both its
shortcut and section heading. The shortcut expands a collapsed review section before revealing it.
The embedded plugin uses the same labels and review mark.

Verification: native self-tests, production build, bundle validation and all 139 source tests passed.
The source check required loopback permission and one worker after an initial permission failure
and an unrelated filesystem-fixture timeout. No test timeout or production contract was weakened.
CUA observed the installed card without More/Continue buttons and verified review collapse then
shortcut expansion. The plugin was inspected at wide and 360px widths; 360px document/scroll widths
matched, and its retained Actions menu exposed Finish work and Link next chat.

Installed executable: `d6c5db99873eba0303ce71e3c4e1e63744c1de04e19720ea2659d15165274762`.
The previous app is retained privately for rollback.
All nine native files and eleven plugin artifacts match source/build, and the backends match.
The seven saved priorities are unchanged at revision 218. No public release or root-cause claim.

## Priority heading refinement

The owner requested removal of the remaining top navigation and stronger, aligned priority
headings. Both the compact widget and embedded plugin now omit the shortcut navigation. Your
priorities is centered in primary text (bright in dark appearance), with compact Edit kept at the
right. Focus and Important use matching header emphasis and insets; the plugin retains its real
collapse buttons and hover/focus affordances. No priority or lifecycle behavior changed.

All 139 source tests, native self-tests, production build, companion validation and strict local
signature/bundle checks passed. Browser inspection confirmed no navigation, working Focus collapse,
aligned headings and equal document/viewport width at 360px. Synthetic SwiftUI previews checked
the priority title and equal column headers. Automated native clicks did not keep the Details
card visible for inspection in this pass; this is not a new fullscreen acceptance receipt.

Final installed executable: `81bf95ca1b31aba08e3495228b4fb37098032f279fd5014d37da566c48fa9a65`.
The previous app is retained privately for rollback.
All nine native files and eleven plugin artifacts match build/source. The seven saved priorities
remain byte-for-byte unchanged at revision 218. Reopen an existing embedded panel to load its new
HTML resource. No public release is claimed.
