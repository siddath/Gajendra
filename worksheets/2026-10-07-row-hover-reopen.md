# Complete-row hover and rapid widget reopening

## Contract

Highlight the entire native record, retain legible title emphasis, repeat Running and Ready for
Review artwork while hovered, and keep immediate close/reopen clicks actionable. Preserve local
preferences and priority state. Ship this focused source repair through a checked PR and update
the local app; no new release tag or distribution claim.

## Findings and changes

- Queue hover backgrounds belonged to the inner open target. Running and review records also
  combined outer feedback with an inner background. The complete row now owns its background;
  individual action controls retain their own feedback. Titles reserve the bold footprint and
  preserve the configured resting font.
- Status artwork previously had a single hover transition or an on-appear pulse. Its small,
  fixed-size artwork now repeats on a 30 fps timeline while hovered. Pointer exit, Reduce Motion,
  or an occluded/hidden window pauses it. One observer per surface covers prewarmed hosting views
  that remain mounted after their panel is ordered out.
- AppKit increments click counts during rapid clicks. The launcher previously treated count 2
  as move mode unconditionally and ignored later counts. A sequence that begins by closing the
  card now keeps every subsequent click as a primary show/hide action. A deliberate double-click
  beginning with a closed card retains move mode. There is no new debounce or reveal delay.

## Verification

- `npm run check`: 170/170 source tests, typecheck, build and plugin validation passed.
- `npm run evals`: 7/7 behavior cases passed.
- `npm run companion:test`: native self-tests passed, including close/reopen click counts 1–6,
  deliberate move-mode entry, repeated animation phases, and motion visibility/accessibility gates.
- Native release build, UI-harness compilation, companion validation, and local bundle readiness
  passed. The UI harness now includes a close/reopen pair with real click counts inside the
  double-click interval; it was compiled, not executed in this tool session.
- The built native app rendered synthetic Ready for Review, Running and priority records through
  computer-use controls, with isolated source data and defaults. Sustained hover and physical
  click timing were not reliably observable through the available UI controls and are not claimed
  as passed. Unit evidence establishes the click-routing correction, not a measured latency gain.
- No full release-gauntlet, clean-Mac, signing/notarization or published-binary claim. The existing
  v0.4.0 release artifacts remain unchanged.

The installed app was replaced from the checked build after a fresh private state/preferences
backup, retaining the previous app as a rollback. All nine bundle files matched the build. Native
launcher activation opened the installed card with the existing theme and records; the authoritative
priority store remained byte-identical and all `gajendra.*` preferences remained equal.

Local logs and synthetic test state are retained under `.artifacts/row-hover-reopen/` (ignored).
