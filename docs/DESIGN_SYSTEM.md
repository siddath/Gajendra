# Gaja design system

## Intent

Gaja is a quiet focus beacon: persistent enough to become a habit, restrained enough not to become another workspace. The elephant represents steady attention and agency; the lotus it carries represents clarity.

## Mark

- Seventeen authored contours: five establish the Indian-elephant ear, forehead, cheek, and two-edge trunk; four define the attentive eye, neutral mouth, and short tusk; seven form the layered lotus; and one curved stem terminates at the trunk's two subtle finger lobes. One small filled pupil directs the gaze toward the lotus.
- Every contour remains unfilled. The primary SVG uses 3.55-unit structural, 1.75-unit detail, and 2.55-unit petal strokes in a 128-unit view box; small native/menu-bar variants reinforce those weights optically with round caps and joins.
- Every renderer uses the same reviewed 128-unit control geometry. SwiftUI maps the canonical coordinates into its drawing rectangle; SVG surfaces reuse the exact elephant, eye, tusk, trunk grip, stem, lotus, and pupil data.
- The desktop pill is icon-only. The full name remains its accessibility label, tooltip, and app/window title.
- Menu-bar artwork is monochrome/template-safe; the app icon uses a deep neutral field.
- The mark is original deterministic SVG/SwiftUI geometry redrawn from the approved visual master. Reference images are not bundled or mechanically traced.
- The approval gate checks the silhouette at 512, 128, 64, 34, 24, and 18 pixels before propagation; elephant, trunk, tusk, exposed stem, and lotus must remain distinguishable at the sizes where each detail can physically resolve.
- In native card and organizer headers, the mark is a leading identity element, **Gaja** and its descriptor sit on the surface's geometric centerline, and Settings is the trailing-most action after Organizer and Refresh. A center-layer layout prevents asymmetric controls from shifting the title.

## Naming

- Visible product: **Gaja, Elephant Focus for AI Power Users**; compact surfaces use **Gaja**.
- Repository and compatibility identity: **Gajendra**. Package names, bundle identifiers, executable paths, the `gajendra://` route, and the `Application Support/Gajendra` state path stay stable.

## Semantic tokens

| Role | Light | Dark | Rule |
| --- | --- | --- | --- |
| Window field | System window/material | System window/material | Follow macOS appearance |
| Glass edge | Primary at 13% | Primary at 13% | Hairline only |
| Lotus | Deep temple gold | Light temple gold | Identity, not status |
| NOW emphasis | Gold tint plus `NOW` text | Gold tint plus `NOW` text | Never color-only |
| Primary action | System accent | System accent | Standard bordered-prominent control |
| Source health | System green/orange/red plus text/help | Same | Color is supplemental |
| Context labels | Blue/green/rose tint plus Design/Engineering/Life text | Lighter semantic tints plus text | Bounded, user-assigned, never color-only |

## Selectable themes

Gaja ships two visual themes over one interaction and data model:

- **Native Popover** is the default. It follows macOS materials, semantic colors, standard controls, and a restrained gold NOW cue.
- **Focus Deck** uses a warmer light field and a deep indigo dark field, with stronger gold hierarchy for NOW and Focus. Important remains deliberately quieter.

Both themes support Auto, Light, and Dark. Auto follows the macOS appearance in the companion and the MCP host theme when available, with the browser preference as a fallback. Command Capsule is not a production theme.

The native card's trailing gear is the compact settings disclosure for theme, Auto/Light/Dark appearance, hover-card size, and lotus position. Opening it never changes a preference. The floating mark reserves primary click for opening and closing the card. The portable MCP App retains its contained mark disclosure because that surface has a different header grammar.

## Materials

- macOS 26+: SwiftUI Liquid Glass on pill, card, and organizer field.
- macOS 13–15: `.ultraThinMaterial` with a subtle semantic edge.
- Interactive glass is reserved for the pill.
- Content rows use low-emphasis semantic fills; avoid nested glass islands.
- Web uses translucent surfaces, `prefers-color-scheme`, and forced-colors fallbacks.

## Layout and interaction

- Pill target: 60 × 60 points with a 48-point circular visual.
- Hover card: adaptive Compact 560 × 570, Comfortable 660 × 610, or Expanded 760 × 680 points at the reference display; positioned inward from the selected lotus anchor and clamped to the visible display.
- Organizer: resizable, initial 620 × 700 points, minimum 520 × 620.
- NOW presents one aligned trailing sequence: primary Open thread action, compact explicit Running/Ready state plus last-update recency, then the owning provider badge.
- Focus and Important counts sit beside their labels, not against the far edge.
- Focus and Important render at most five hover-card rows; any remainder is exposed by a bottom-edge Organizer shortcut.
- Running is a green-semantic expandable disclosure after Focus and Important. It starts expanded, includes every thread with an explicit provider active status, labels its NOW/Focus/Important placement when applicable, and never becomes stored priority metadata.
- NOW, both queues, Running, and search results share one vertical scroll body. The Compact/Comfortable/Expanded choice changes the viewport size, never the available task count. A clipped continuation at the lower edge and the system scroll indicator communicate overflow.
- A full-width capsule in a stable sibling footer searches every deduplicated loaded thread with multi-term metadata matching. Clicking anywhere in the capsule focuses input and selects an existing query, while the active border makes typing readiness visible. Results replace the queue region temporarily and expose the same priority/context/provider actions without changing Organizer into a hidden mode. The complete capsule highlights on hover or keyboard focus, matching the complete rounded NOW surface.
- Provider badges are text-backed and use supplemental source accents; activating a badge resumes that exact thread in its owning provider.
- Prioritized threads may show one compact Design, Engineering, or Life context badge. The organizer exposes a direct Add label control on macOS and a native select in the MCP App; the hover card is display-only.
- Recent and prioritized rows are draggable between Focus and Important. Visible move and tier controls remain the keyboard-accessible equivalent.
- Menus and disclosure indicators have separate hit targets and never overlap.
- The trailing Settings and app menus expose six spatially named Lotus Position hotspots: Top Left, Top Right, Center, Bottom Left, Bottom Center, and Bottom Right. The default is Bottom Right.
- Primary-click the floating mark to show or hide the detail card; hover only scales the launcher. The card remains open until another launcher click, an outside click, or Escape. Double-click enters or leaves edit mode. Only the mark artwork and its X jiggle; the material background remains stable. Movement under six points is ignored; intentional global-pointer drag snaps to the nearest hotspot without reopening the card. Card geometry opens inward or beside Center without covering the launcher. Clicking outside or pressing Escape exits edit mode without hiding it; the app menu restores a hidden launcher. Secondary-click/Control-click exposes a short contextual menu whose last, destructive command confirms before uninstalling the app and retains priority metadata.

## Motion

- Pill hover uses one small spring scale without changing card visibility. Edit mode applies a separate bounded jiggle only to the mark artwork and X.
- Click-driven card reveal/hide uses short opacity transitions.
- Native motion follows Reduce Motion; the MCP App’s GSAP/Flip layer stops under `prefers-reduced-motion`.
- Motion confirms state; it never delays navigation or refresh.

## Evidence

- Native: `evidence/companion/gajendra-*.png`, including the `gajendra-focus-deck-*` matrix.
- MCP App: `evidence/gauntlet/gajendra-*.png`, including Native and Focus Deck light/dark/compact states.
- Source: `plugins/gajendra/assets/gajendra*.svg`, `DeckWidgetView.swift`, and `styles.css`.
