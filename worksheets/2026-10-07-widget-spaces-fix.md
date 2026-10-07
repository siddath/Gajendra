# Floating widget appearance and Space repair

## Contract

Fix the launcher glass effect, unreliable reveal, and open card staying on a previous Space.
Preserve priority state, visual preferences, and provider-owned conversations. Publish and merge
only after appropriate checks; this is a source/local-app repair, not a new binary release.

## Findings and changes

The launcher used interactive Liquid Glass on macOS 26 plus a loading-dependent opacity animation.
The card faded its whole NSPanel during show/hide; generation checks protected completion callbacks
but did not cancel competing alpha animations. Overlay windows used the desktop-like stationary
Mission Control role and only listened for app activation/display changes, not active Space changes.
These were concrete implementation hazards; no controlled baseline reproduction establishes one
of them as the sole cause of the owner's intermittent missed click.

- Use an opaque theme surface, decorative layers that ignore hit testing, and no refresh opacity
  pulse. Remove the launcher's unused observation of provider refresh state.
- Show/hide the card immediately. Keep content hover/press feedback and Reduce Motion support.
- Use transient all-Spaces panels and restore logically presented surfaces on active-Space changes
  without activating the app. A hidden launcher or dismissed card stays hidden.
- Extend the full-screen regression journey to open the card before transitioning and verify real
  active-Space membership. Add an isolated, opt-in receipt containing only visibility/opacity data.
- Refresh the four synthetic launcher previews and document the native acceptance journey.

## Verification

On macOS 26.6.2, the fixed app ran through computer-use controls with synthetic source/state data
and a separate app identifier/defaults suite. The same compiled app executable is used by the local
bundle; the test copy differs only in its bundle identity and isolated launch environment.

- Two full-screen transitions in opposite directions: open card and launcher both reported
  `isOnActiveSpace=true`, `isVisible=true`; card alpha was 1. The card remained in the native AX tree.
- A transition with the card dismissed: launcher visible/on active Space, card presented=false and
  visible=false. Returning did not resurrect it; the next launcher click opened it.
- Five close/reopen cycles passed via native controls. First-click search returned the expected
  synthetic result. The new launcher surface was visually inspected.
- Horizontal keyboard shortcuts did not produce a Space notification in this automation session;
  they are not counted as a separate swipe/physical-trackpad receipt.
- `npm run check`: 170/170 source tests, typecheck, build and plugin validation passed.
- `npm run evals`: 7/7 cases passed.
- Native self-tests, release build, preview render, UI-harness compilation, companion validation,
  and local bundle readiness passed. The standalone native pointer harness was not executed;
  native interactions above were driven through the available computer-use tool.
- No full release-gauntlet, clean-Mac, Developer ID or notarization claim. The published v0.4.0
  release artifacts are unchanged.

Local logs and bounded Space receipts are under `.artifacts/widget-spaces-fix/` (ignored).
