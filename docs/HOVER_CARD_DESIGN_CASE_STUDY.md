# Adaptive hover-card design case study

## Decision

Gaja's focus card is a click-presented macOS focus surface with organizer-grade retrieval, not a second full organizer. It should answer five questions without taking over the display: What is NOW? Is that thread actively running or ready to resume? What are the next Focus and Important threads? What work is explicitly running across every lane? Can I find and reprioritize one thread immediately?

The chosen design uses one dominant NOW block, two parallel queue lanes, an expandable Running disclosure, and a full-width search capsule. NOW, both lanes, Running, and search results share one vertical scroll body. Search is a sibling footer outside that body, so it remains reachable without covering task rows. Each priority lane renders up to five live threads using one shared row grammar. A count-aware shortcut on the bottom edge opens the Organizer when a lane contains additional items. Running is derived from explicit provider state across every priority placement and never becomes a persisted priority tier. Search results temporarily replace the queue region and reuse its compact action grammar.

## Observed problem

The previous 428 × 326-point panel was fixed across displays. Its root content was vertically centered inside that frame, which amplified the gap above the Gaja header. It showed only one queued thread per tier, separated the provider label from its action, and could not make useful use of a 14-inch MacBook Pro display.

The measured built-in display used for this pass exposes a 1512 × 949-point visible frame at 2× backing scale. Apple's 14-inch M4 MacBook Pro specification lists a 3024 × 1964 native display at 254 pixels per inch. Window sizing therefore uses the live logical visible frame, not the model name or physical diagonal.

## Primary-source design constraints

- Apple describes Mac use as high-resolution, multi-application work at roughly 1–3 feet and recommends using larger displays to expose more content with fewer nested levels while preserving comfortable density. It also recommends user personalization. See [Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/).
- Apple recommends that a popover expose a small set of related tasks, remain only as large as its content needs, and transition smoothly when its size changes. Gaja is technically a floating AppKit panel, but the transient information pattern is the same. See [Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers/).
- Apple identifies SF Pro as the macOS system font, recommends 13 points as the default and 10 points as the minimum, and advises minimizing typeface mixing. See [Typography](https://developer.apple.com/design/human-interface-guidelines/typography).
- Apple recommends semantic materials for structure and notes that more opaque materials can improve fine-text contrast. The card therefore uses system material for the outer transient surface and restrained semantic fills for the content groups instead of decorative blur layers. See [Materials](https://developer.apple.com/design/human-interface-guidelines/materials).
- Apple recommends native scrolling gestures and keyboard shortcuts, visible overflow cues, room for the macOS scroll indicator, and avoiding nested scroll views on the same axis. The card therefore has one vertical scroll owner and reveals a partial Running row at the lower edge when more content remains. See [Scroll views](https://developer.apple.com/design/human-interface-guidelines/scroll-views).
- Apple treats primary click as activation and describes search as an editable field that can begin filtering immediately. The floating Gaja mark therefore uses click, not hover, to present the card; its search capsule focuses from the whole surface, visibly enters its active state, and selects an existing query for replacement. See [Pointing devices](https://developer.apple.com/design/human-interface-guidelines/pointing-devices) and [Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields).
- SwiftUI supports pinned section footers, but Gaja keeps search as a sibling outside the scroll view instead. This guarantees visibility without allowing list rows to move underneath an interactive overlay. See [PinnedScrollableViews](https://developer.apple.com/documentation/swiftui/pinnedscrollableviews).
- W3C keyboard guidance requires interactive components to remain in a predictable DOM and tab order. The MCP App places its search footer after the scroll region in source order and uses a labeled search landmark. See [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/).

## Alternatives considered

1. **One tabbed queue.** This was compact, but it hid either Focus or Important and made comparison slower. Rejected.
2. **Two parallel lanes.** This exposes both priority tiers, keeps their row systems symmetric, and uses the 14-inch display's width without increasing interaction depth. Chosen.
3. **One stacked ten-row stream.** This preserved width for long titles but made the transient panel excessively tall and blurred the difference between Focus and Important. Rejected.
4. **A nested Running scroller.** This bounded the section locally but competed with the card's vertical scrolling and made trackpad ownership ambiguous. Rejected.
5. **A floating overlay footer.** This kept search visible but covered rows and interfered with drag targets. Rejected after an end-to-end failure; a sibling shell row was chosen.

Typography was also narrowed to three directions:

- **SF Pro Display + Text:** chosen for native hierarchy, compact metrics, and system-control consistency.
- **SF Rounded:** rejected for this surface because its friendly voice weakens the precision of a dense work queue.
- **New York:** rejected because its editorial rhythm competes with short operational metadata and is not the standard macOS SwiftUI system face.

## Sizing system

The 1512 × 949-point reference frame resolves to:

| Preference | Reference panel | Intended posture |
| --- | ---: | --- |
| Compact | 560 × 570 pt | Glanceable, lower visual footprint |
| Comfortable | 660 × 610 pt | Default for a 14-inch MacBook Pro |
| Expanded | 760 × 680 pt | Larger type and longer viewing distance |

Each base size scales with the active display's visible frame, bounded to 0.88–1.18× and then clamped inside a 12-point screen margin. This is adaptation rather than device detection: moving Gaja to another display recomputes the panel before it is positioned.

## Component grammar

- **Header:** equal 116-point side rails keep Gaja optically centered while the lotus and actions remain independently aligned. The root frame is top-aligned, eliminating accidental space above it.
- **NOW:** a single emphasized surface, 17-point semibold title, project and optional context on the action line, then one trailing sequence: Open, compact Running/Ready plus recency, and provider. Hover highlights the complete rounded surface, matching the queue-row grammar.
- **Queue header:** symbol, label, and count share one baseline.
- **Queue continuation:** a full-width bottom-edge shortcut appears only when the hidden remainder is nonzero and opens the Organizer.
- **Queue row:** one-line 12.5-point title, labeled provider badge at the trailing edge, then project and optional bounded context. The whole row opens the exact thread and receives hover feedback.
- **Running disclosure:** a green-semantic section after both priority lanes starts expanded, exposes every deduplicated active thread as a full-width row, and can collapse to a count summary. NOW/Focus/Important rows carry a placement label; the Organizer renders the same complete set and its priority actions.
- **Scrollable body:** NOW, queues, Running, and search results use one native vertical scroll surface with system indicators and a small trailing inset. Compact height changes the viewport, not the number of threads available.
- **Quick-search footer:** one full-width capsule occupies a stable sibling row below the scroll body. The detail panel becomes key only when keyboard input is required. Clicking anywhere focuses the field and selects an existing query; hover or focus highlights the complete capsule. Multi-term metadata search shows up to five matches with open and organizer actions and offers an Organizer continuation for overflow.
- **Material:** system thin material on supported fallback systems, restrained theme tint, semantic text, and flat content groups. Translucency supports context; it does not replace contrast.

## Acceptance evidence

- Swift self-tests cover reference, Compact, Expanded, small-display clamping, enum persistence, and invalid-value fallback.
- Native previews render both themes in light and dark plus Compact, Expanded, and active-search artifacts with six queued items per lane and five active threads, proving five visible rows, bottom-edge overflow, the Running disclosure/continuation cue, and the persistent search footer.
- The installed-app smoke must still verify no hover-triggered opening, click presentation and dismissal, active-display sizing, search focus, bottom-edge Organizer navigation, and exact provider-thread resume behavior; rendered previews do not prove pointer interaction.
