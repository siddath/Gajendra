# Native macOS companion

Gaja’s default surface is a bottom-right icon-only native utility. Hover or press the lotus to reveal the focus card; open the organizer for source controls and queue editing. Native Popover is the default theme; Focus Deck is selectable from the palette menu. Each supports Auto, Light, and Dark.

## Surfaces

- Pill: borderless nonactivating panel, 60 × 60 points, bottom trailing, all Spaces.
- Card: separate 404 × 310 panel, cursor-bridge grace period, current thread plus compact queues.
- Organizer: standard resizable 620 × 700 window, 520 × 620 minimum.
- Menu bar: optional template icon and compact organizer fallback.
- Dock/app menu: reopen, refresh (`⌘R`), open organizer (`⇧⌘O`), launch-at-login toggle, quit.
- Pill edit mode: press and hold for 550 ms, then drag across the visible display or hide the lotus. The app menu can restore or re-anchor it.
- Organizer: drag recent or prioritized rows into Focus or Important; arrow and tier controls remain available for keyboard operation.
- Context: assign Design, Engineering, or Life from a prioritized row’s existing action menu; the label follows that entry into NOW, Focus, Important, and the hover card.

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

Launch at Login uses `SMAppService.mainApp` and is reversible from the app menu. Removal means disabling that item, quitting, and moving the app to Trash; Gaja intentionally retains priority metadata for rollback in its stable `Gajendra` compatibility path.

## WidgetKit

The companion is not a WidgetKit extension. WidgetKit cannot implement the required cross-app always-on-top hover behavior. A future glance-only widget may reuse the `gajendra://` route after a shared-container design and adoption proof.
