# Apple design alignment

This is a source-level design rationale for Gajendra, not proof that an installed app has completed
Apple-platform, assistive-technology, or App Review validation.

## Intended alignment

- A compact focus utility uses clear primary actions, semantic materials/colors, standard focus,
  keyboard, and menu semantics, and supports reduced motion.
- Click—not passive hover—should change presentation state. Contextual and destructive actions must
  be explicit, ordered, and confirmed.
- The visible identity is **Gajendra** with **One clear focus across your AI tools.** Queue labels
  are NOW, Focus, Important, and Running.
- The native target floor is macOS 13.5. The source contract treats the floating utility as an
  AppKit/SwiftUI application surface, not a WidgetKit extension.
- Source destinations must be validated at execution; provider metadata is not allowed to cause
  arbitrary navigation.

## Evidence boundary

The candidate has a narrow installed launcher receipt for stationary/2 px taps, move/hide recovery,
an AX press, and the edge target. It has no physical VoiceOver screen-reader, login-item, drag/drop,
clean-Mac, Developer ID, notarization, or App Review evidence. Separately authorized physical
checks remain required before those claims are made.
