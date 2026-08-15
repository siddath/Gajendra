# Native macOS companion

Gaja’s default surface is a bottom-right icon-only native utility whose elephant lifts its trunk to hold an open lotus and that can snap to six configured hotspots. Click the floating mark to show or hide the focus card; hover only highlights the launcher. The card remains interactive until another launcher click, an outside click, or Escape. In the header, the elephant-and-lotus mark stays on the left, the Gaja name and descriptor remain on the card's true centerline, and Organizer, Refresh, and Settings sit on the right. The trailing Settings gear owns theme, Auto/Light/Dark appearance, card size, and position without changing a choice merely by opening. Open the organizer for source controls and queue editing. Native Popover is the default theme; Focus Deck is selectable from Settings.

## Surfaces

- Pill: borderless nonactivating panel, 60 × 60 points, one of six snap anchors, all Spaces.
- Card: separate adaptive Compact 560 × 570, Comfortable 660 × 610, or Expanded 760 × 680 keyboard-capable panel at the reference display, with click-pinned presentation, one vertically scrollable task body, an expandable inclusive Running section, and a persistent global-search footer.
- Organizer: standard resizable 620 × 700 window, 520 × 620 minimum.
- Menu bar: optional template icon and compact organizer fallback.
- Dock/app menu: reopen, refresh (`⌘R`), open organizer (`⇧⌘O`), launch-at-login toggle, confirmed uninstall, quit.
- Lotus position: choose Top Left, Top Right, Center, Bottom Left, Bottom Center, or Bottom Right from the trailing Settings gear or Gaja app menu. The selected display and hotspot persist.
- Pill edit mode: double-click to enter or leave, then drag toward a hotspot or use the jiggling X to hide the mark. Movement under six points is ignored; an intentional drag snaps to the nearest hotspot. Only the mark artwork and X jiggle; the material background remains still. The card stays hidden during editing and does not reopen after a move. Center opens the card beside the launcher; edge positions open inward. Click outside or press Escape to leave edit mode without hiding it.
- Context menu: secondary-click or Control-click the floating mark to show/hide the card, open Organizer, enter move/hide mode, or choose **Uninstall Gaja…**. Uninstall is destructive, placed last, and requires confirmation; it removes the app and Launch at Login registration while retaining priority metadata.
- Organizer: drag recent or prioritized rows into Focus or Important; arrow and tier controls remain available for keyboard operation. Running is expandable, and search stays outside the organizer's scroll body.
- Context: use the visible **Add label** control on a prioritized row to assign Design, Engineering, or Life; the label follows that entry into NOW, Focus, Important, and the hover card.

The utility does not inspect or inject into Codex, Claude, Cursor, or other app windows. It requests no Accessibility permission.

## Build and test

```bash
npm run companion:test
npm run companion:build
npm run companion:validate
npm run companion:preview
open "build/Gajendra.app"
```

The local bundle is ad-hoc signed. Public binary distribution requires a separate Developer ID/notarization pipeline.

## Install and removal

```bash
mkdir -p "$HOME/Applications"
ditto "build/Gajendra.app" "$HOME/Applications/Gajendra.app"
open "$HOME/Applications/Gajendra.app"
```

Launch at Login uses `SMAppService.mainApp` and is reversible from the app menu. **Uninstall Gaja…** unregisters it and moves the running app bundle to Trash only after explicit confirmation. Manual removal remains supported. Gaja intentionally retains priority metadata for rollback in its stable `Gajendra` compatibility path.

## WidgetKit

The companion is not a WidgetKit extension. WidgetKit cannot implement the required cross-app always-on-top interactive panel. A future glance-only widget may reuse the `gajendra://` route after a shared-container design and adoption proof.
