# Apple design compliance

Gaja follows Apple platform conventions while being candid about where its requested interaction differs from WidgetKit.

| Principle | Implementation |
| --- | --- |
| Deference | The persistent surface is one icon; detail appears only on hover/press. |
| Clarity | One non-color-only NOW label, source badge, standard button labels, and system typography. |
| Consistency | Standard SwiftUI controls, menu commands, `⌘R`, `⇧⌘O`, `⌘Q`, Dock reopen, and resizable organizer. |
| Materials | Liquid Glass only on macOS 26 navigation/overlay surfaces; semantic material fallback on older macOS. |
| Adaptivity | Semantic foreground styles, system light/dark appearance, and a template-safe menu-bar mark. |
| Accessibility | VoiceOver names/hints, minimum 48-point pill target, keyboard access, non-color status text, and Reduce Motion. |
| User control | Reversible Launch at Login, optional source enablement, and no required Accessibility permission. |

## Glass restraint

Glass is a hierarchy material, not a theme painted across every row. The lotus pill, hover card, and organizer background use it; list rows use quieter semantic fills and standard controls. Interactive Liquid Glass is applied only to the pill. The NOW cue remains readable without translucency.

## WidgetKit decision

Apple’s WidgetKit guidance favors glanceable information with simple click-through actions on the desktop or in Notification Center. It does not provide the always-on-top, cross-application hover reveal requested for Gaja. Therefore:

- 0.3.1 ships a native floating utility and calls itself a widget-style focus utility.
- A future WidgetKit extension may show NOW passively and open `gajendra://thread/...`.
- The extension must reuse the same store/service through an explicitly designed shared container; it must not become a second priority store.
- It is justified only after the floating utility produces real adoption receipts.

## Primary references

- [Apple: Liquid Glass overview](https://developer.apple.com/documentation/technologyoverviews/liquid-glass)
- [Apple: Applying Liquid Glass to custom views](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views)
- [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Apple HIG: Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/)
- [Apple HIG: Widgets](https://developer.apple.com/design/human-interface-guidelines/widgets/)
