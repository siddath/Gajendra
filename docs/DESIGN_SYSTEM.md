# Gaja design system

## Intent

Gaja is a quiet focus beacon: persistent enough to become a habit, restrained enough not to become another workspace. The lotus represents attention emerging into clarity.

## Mark

- Seven authored Bézier strokes: one closed crown, paired inner petals, paired outer petals, and two grounding arcs.
- Petals are never filled. The primary SVG uses a 2.25-unit stroke in a 128-unit view box; small native/menu-bar variants target roughly one physical point with round caps and joins.
- Every renderer uses the same 128-unit control geometry. SwiftUI maps those coordinates into its drawing rectangle; SVG surfaces reuse the exact path data.
- The desktop pill is icon-only. The full name remains its accessibility label, tooltip, and app/window title.
- Menu-bar artwork is monochrome/template-safe; the app icon uses a deep neutral field.
- The mark is original deterministic SVG/SwiftUI geometry. External reference images are not bundled or traced.

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

## Materials

- macOS 26+: SwiftUI Liquid Glass on pill, card, and organizer field.
- macOS 13–15: `.ultraThinMaterial` with a subtle semantic edge.
- Interactive glass is reserved for the pill.
- Content rows use low-emphasis semantic fills; avoid nested glass islands.
- Web uses translucent surfaces, `prefers-color-scheme`, and forced-colors fallbacks.

## Layout and interaction

- Pill target: 60 × 60 points with a 48-point circular visual.
- Hover card: 404 × 310 points, bottom-trailing aligned and clamped to the visible display.
- Organizer: resizable, initial 620 × 700 points, minimum 520 × 620.
- Primary Open thread action is vertically centered at the trailing edge of NOW.
- Menus and disclosure indicators have separate hit targets and never overlap.

## Motion

- Pill hover uses one small spring scale.
- Card reveal/hide uses short opacity transitions and a 220 ms cursor bridge.
- Native motion follows Reduce Motion; the MCP App’s GSAP/Flip layer stops under `prefers-reduced-motion`.
- Motion confirms state; it never delays navigation or refresh.

## Evidence

- Native: `evidence/companion/gajendra-*.png`.
- MCP App: `evidence/gauntlet/gajendra-*.png`.
- Source: `plugins/gajendra/assets/gajendra*.svg`, `DeckWidgetView.swift`, and `styles.css`.
