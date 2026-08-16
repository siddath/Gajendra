# Apple design compliance

Gaja follows Apple platform conventions while being candid about where its requested interaction differs from WidgetKit.

| Principle | Implementation |
| --- | --- |
| Deference | The persistent surface is one icon; detail appears only after deliberate primary-click activation. |
| Clarity | One non-color-only NOW label, text-backed source/context badges, standard button labels, and system typography. |
| Consistency | Standard SwiftUI controls, application-menu source setup, `⌘R`, `⇧⌘O`, `⌘Q`, Dock reopen, and resizable organizer. |
| Materials | Liquid Glass only on macOS 26 navigation/overlay surfaces; semantic material fallback on older macOS. |
| Adaptivity | Semantic foreground styles, system light/dark appearance selected from a compact trailing Settings menu, and a template-safe menu-bar mark. |
| Accessibility | VoiceOver names/hints, minimum 48-point pill target, keyboard access, non-color status text, and Reduce Motion. |
| User control | Skippable and replayable source onboarding, reversible Launch at Login, optional source enablement, confirmed app removal with metadata retention, and no required Accessibility permission. |

## Placement and appearance rationale

Apple's menu guidance recommends grouping related options behind a recognizable control. Gaja keeps the brand mark as identity at the leading edge, preserves the Gaja lockup on the card's geometric centerline, and groups theme, appearance, card size, and the six checked launcher locations behind a conventional trailing Settings gear. The application menu remains the fallback. The positions are stable choices, not hover effects.

Apple's pointing-device guidance treats primary click as activation. Gaja therefore uses primary click to show or hide the interactive card and limits hover to a visual highlight, so pointer transit never changes presentation state. Dragging remains locked behind double-click edit mode and ignores micro-movement.

Apple generally recommends following the system appearance. Gaja keeps Auto as its default and uses semantic colors in every mode. Light and Dark are explicit choices inside the Settings menu, so opening the control cannot unexpectedly change the current appearance.

Apple's context-menu guidance recommends keeping menus short, duplicating their commands in the main interface, and placing destructive commands last. Gaja mirrors **Uninstall Gaja…** in its app menu, places it last in the lotus contextual menu, and requires a confirmation that explains the retained metadata.

## Glass restraint

Glass is a hierarchy material, not a theme painted across every row. The lotus pill, hover card, and organizer background use it; list rows use quieter semantic fills and standard controls. Interactive Liquid Glass is applied only to the pill. The NOW cue remains readable without translucency.

## WidgetKit decision

Apple’s WidgetKit guidance favors glanceable information with simple click-through actions on the desktop or in Notification Center. It does not provide Gaja's always-on-top, cross-application interactive panel. Therefore:

- 0.3.1 ships a native floating utility and calls itself a widget-style focus utility.
- A future WidgetKit extension may show NOW passively and open `gajendra://thread/...`.
- The extension must reuse the same store/service through an explicitly designed shared container; it must not become a second priority store.
- It is justified only after the floating utility produces real adoption receipts.

## Primary references

- [Apple: Liquid Glass overview](https://developer.apple.com/documentation/technologyoverviews/liquid-glass)
- [Apple: Applying Liquid Glass to custom views](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views)
- [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Apple HIG: Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/)
- [Apple HIG: Menus](https://developer.apple.com/design/human-interface-guidelines/menus)
- [Apple HIG: Pointing devices](https://developer.apple.com/design/human-interface-guidelines/pointing-devices)
- [Apple HIG: Context menus](https://developer.apple.com/design/human-interface-guidelines/context-menus)
- [Apple HIG: Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields)
- [Apple HIG: Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)
- [Apple HIG: Widgets](https://developer.apple.com/design/human-interface-guidelines/widgets/)
