# Adaptive hover-card design case study

## Decision

Gaja's hover card is a transient macOS focus surface, not a miniature organizer. It should answer three questions without taking over the display: What is NOW? What are the next Focus and Important threads? Where does each thread resume?

The chosen design uses one dominant NOW block and two parallel queue lanes. Each lane renders up to five live threads using one shared row grammar. A count-aware More action opens the Organizer when a lane contains additional items.

## Observed problem

The previous 428 × 326-point panel was fixed across displays. Its root content was vertically centered inside that frame, which amplified the gap above the Gaja header. It showed only one queued thread per tier, separated the provider label from its action, and could not make useful use of a 14-inch MacBook Pro display.

The measured built-in display used for this pass exposes a 1512 × 949-point visible frame at 2× backing scale. Apple's 14-inch M4 MacBook Pro specification lists a 3024 × 1964 native display at 254 pixels per inch. Window sizing therefore uses the live logical visible frame, not the model name or physical diagonal.

## Primary-source design constraints

- Apple describes Mac use as high-resolution, multi-application work at roughly 1–3 feet and recommends using larger displays to expose more content with fewer nested levels while preserving comfortable density. It also recommends user personalization. See [Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/).
- Apple recommends that a popover expose a small set of related tasks, remain only as large as its content needs, and transition smoothly when its size changes. Gaja is technically a floating AppKit panel, but the transient information pattern is the same. See [Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers/).
- Apple identifies SF Pro as the macOS system font, recommends 13 points as the default and 10 points as the minimum, and advises minimizing typeface mixing. See [Typography](https://developer.apple.com/design/human-interface-guidelines/typography).
- Apple recommends semantic materials for structure and notes that more opaque materials can improve fine-text contrast. The card therefore uses system material for the outer transient surface and restrained semantic fills for the content groups instead of decorative blur layers. See [Materials](https://developer.apple.com/design/human-interface-guidelines/materials).

## Alternatives considered

1. **One tabbed queue.** This was compact, but it hid either Focus or Important and made comparison slower. Rejected.
2. **Two parallel lanes.** This exposes both priority tiers, keeps their row systems symmetric, and uses the 14-inch display's width without increasing interaction depth. Chosen.
3. **One stacked ten-row stream.** This preserved width for long titles but made the transient panel excessively tall and blurred the difference between Focus and Important. Rejected.

Typography was also narrowed to three directions:

- **SF Pro Display + Text:** chosen for native hierarchy, compact metrics, and system-control consistency.
- **SF Rounded:** rejected for this surface because its friendly voice weakens the precision of a dense work queue.
- **New York:** rejected because its editorial rhythm competes with short operational metadata and is not the standard macOS SwiftUI system face.

## Sizing system

The 1512 × 949-point reference frame resolves to:

| Preference | Reference panel | Intended posture |
| --- | ---: | --- |
| Compact | 560 × 460 pt | Glanceable, lower visual footprint |
| Comfortable | 660 × 500 pt | Default for a 14-inch MacBook Pro |
| Expanded | 760 × 560 pt | Larger type and longer viewing distance |

Each base size scales with the active display's visible frame, bounded to 0.88–1.18× and then clamped inside a 12-point screen margin. This is adaptation rather than device detection: moving Gaja to another display recomputes the panel before it is positioned.

## Component grammar

- **Header:** equal 116-point side rails keep Gaja optically centered while the lotus and actions remain independently aligned. The root frame is top-aligned, eliminating accidental space above it.
- **NOW:** a single emphasized surface, 17-point semibold title, project and optional context on the action line, then provider and Open adjacent at the trailing edge.
- **Queue header:** symbol, label, and count share one baseline; More appears only when the hidden remainder is nonzero.
- **Queue row:** one-line 12.5-point title, labeled provider badge at the trailing edge, then project and optional bounded context. The whole row opens the exact thread and receives hover feedback.
- **Material:** system thin material on supported fallback systems, restrained theme tint, semantic text, and flat content groups. Translucency supports context; it does not replace contrast.

## Acceptance evidence

- Swift self-tests cover reference, Compact, Expanded, small-display clamping, enum persistence, and invalid-value fallback.
- Native previews render both themes in light and dark plus Compact and Expanded size artifacts with six queued items per lane, proving five visible rows and More.
- The installed-app smoke must still verify the real hover transition, active-display sizing, More-to-Organizer navigation, and exact provider-thread resume behavior; rendered previews do not prove pointer interaction.
