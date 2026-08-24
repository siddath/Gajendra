# Apple design alignment

This is a source-level design rationale for Gajendra, not proof that an installed app has completed
Apple-platform, assistive-technology, or App Review validation.

## Intended alignment

- A compact focus utility uses clear primary actions, semantic materials/colors, standard focus,
  keyboard, and menu semantics, and supports reduced motion.
- Click—not passive hover—should change presentation state. Contextual and destructive actions must
  be explicit, ordered, and confirmed.
- Compact queue rows keep a quick Open click distinct from a stationary hold. The hold selects the
  task; continuing the same press lifts a visible metadata preview for full-row drag. Compact rows
  have no generic hamburger or permanent drag handle. A reserved purpose-specific control adds an
  unprioritized status row to Focus/Important or moves a non-NOW prioritized row to the opposite
  lane without covering the primary Open target. Running and Ready for Review use text, symbols,
  and high-visibility counts. Running adds an explicit **All priority lanes** click control; both
  docks retain a deliberate header double-click (or accessibility press) to shrink or expand
  contents.
- The visible identity is **Gajendra** with **One clear focus across your AI tools.** Queue labels
  are NOW, Focus, Important, Running, and Ready for Review.
- The native target floor is macOS 13.5. The source contract treats the floating utility as an
  AppKit/SwiftUI application surface, not a WidgetKit extension.
- Source destinations must be validated at execution; provider metadata is not allowed to cause
  arbitrary navigation.

## Evidence boundary

The exact installed candidate has an automated receipt for stationary/2 px taps, move/hide
recovery, AX press, edge target, quick task click versus 280 ms hold, continuous
select/lift/full-row drag, Organizer pointer reorder, real-key Search, and dock double-click. The
source-build performance journey separately checks a 200 ms launcher budget, a same-host baseline,
and the widget-path dependency-cycle log. It has no physical
VoiceOver screen-reader, manual human drag, login-item, clean-Mac, Developer ID, notarization, or
App Review evidence. Separately authorized physical checks remain required before those claims are
made.
