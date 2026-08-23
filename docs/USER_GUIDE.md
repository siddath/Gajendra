# Gajendra user guide

Gajendra is designed to answer one question quickly: **what deserves my attention now?** This guide
covers the source-build setup and the everyday macOS workflow.

## Ten-minute setup

### 1. Check the requirements

- macOS 13.5 or later
- Xcode or the Xcode Command Line Tools
- Node.js 20 or later for the build
- Codex, Claude Code, Cursor, or Grok Build installed or configured locally if you want that source

### 2. Build the app

```sh
git clone https://github.com/siddath/Gajendra.git gajendra
cd gajendra
npm ci
npm run companion:build
```

The app is created at `build/Gajendra.app`. The build includes the checksum-verified Node runtime
and third-party notices expected by the companion.

### 3. Open it

```sh
open build/Gajendra.app
```

The first-launch window shows the supported local sources and their current availability. Codex is
enabled when its local app-server is available. Claude Code metadata remains opt-in. You can skip
setup without losing the choice; Gajendra will offer it again on the next launch.

Select **Done** when the source selection is right. Use **Settings → Manage AI tools…** later to
toggle a source or rescan.

## Everyday workflow

1. **Single-click the floating Gajendra button** to show or hide the focus card. Dock reopen and the
   menu-bar item use the same compact-first surface; open Organizer only for deliberate management.
2. Put one thread in **NOW**. It remains part of the Focus queue.
3. Keep the next few threads in **Focus** and lower-pressure work in **Important**.
4. Glance at **Running** for active provider work and **Ready for Review** for explicit completed
   work that needs human attention.
   Click **All priority lanes** to shrink or expand Running, or double-click either dock header.
5. Double-click the NOW card, or select **Open**, a row, a provider badge, or a Review/Task action,
   to return to the source-owned destination.
6. Use the search field for a title, project, source, context/tag, priority, Running, or Ready
   status; open Organizer when you need the full queues.

## Interaction reference

### Floating button and card

- Single-click the floating button to toggle the card. The same action recovers from move/hide mode,
  so the launcher should not become a dead end.
- Double-click anywhere inside the NOW card to open that exact thread. Double-clicking another dock
  or blank part of the widget does not substitute a different action.
- Open the app menu to show or hide the lotus, manage sources, change appearance, or quit.
- Card size can be Compact, Comfortable, or Expanded. Appearance can follow the system or use an
  explicit light/dark choice.

### Priorities

- **Make NOW** promotes a thread while preserving the previous lane/order information needed for
  Undo.
- A quick task click remains the direct Open route. Hold a Focus or Important task briefly to select
  and lift it; keep holding and move the visible row to reorder it or change lanes. Releasing a
  stationary hold leaves the selected task in edit mode.
- Compact rows intentionally have no permanent three-line drag/menu handle. **Edit priorities**
  exposes full-row drag plus remove controls; hover, selection, and the lifted row provide the
  pointer feedback.
- Organizer provides explicit up/down, lane, context, and overflow actions when drag is not the
  preferred input.
- Successful changes participate in app-owned Undo/Redo. A conflicting external refresh clears
  stale history rather than applying an old inverse to newer work.

### Running

Running is derived from an explicit provider status such as active, working, or streaming. It can
contain NOW, Focus, Important, or unprioritized work and never changes priority by itself. The
highlighted badge shows the count at a glance. Click **All priority lanes** or double-click the dock
header to shrink or expand the rows; a single click on the header itself does not change it.

### Ready for Review

Ready for Review is live provider evidence, not an unread badge. The current local Codex app-server
path requests only the newest turn's status and completion time with message items explicitly not
loaded. A valid completed turn appears until a newer turn changes the evidence; opening the thread
does not clear it. Missing, active, interrupted, failed, malformed, or unsupported metadata appears
nowhere. Claude Code, Cursor, and Grok are not guessed from idle time or resumability. Configured
sources may still supply the validated signal directly.

The review row opens the declared **Review** or **Task** destination; the provider badge separately
opens the owning task. Its highlighted badge shows the number needing attention. Double-click the
dock header to shrink or expand the rows; a single click does not change it. Gajendra refreshes on
reveal and periodically while the compact surface is visible, pausing during direct manipulation.

To experiment without private data, start from [the synthetic review catalog](../examples/review-catalog.json)
and the boundaries in [Thread sources](THREAD_SOURCES.md).

## Accessibility and comfort

- The native controls expose labels, values, hints, and keyboard actions.
- The interface respects Reduce Motion and supports system, light, and dark appearances.
- Status is never communicated by color alone: Running and Ready for Review include symbols, text,
  counts, and destination labels.
- Organizer offers explicit controls as an alternative to drag-and-drop.

The isolated real-window UI journey distinguishes a quick task click from a stationary hold,
automates the selected/lifted full-row drag in the card plus Organizer controls, and checks the
resulting persisted order. Physical VoiceOver, manual human drag, login-item, and
system-toggle receipts remain part of the external release gate; the repository does not present
automation as proof of every physical journey.

## Troubleshooting

### The floating button does not reopen the card

Use a normal single click without dragging. A primary click exits move/hide mode before toggling the
card. You can also use the app menu to show the Gajendra lotus again. If the current source build
still fails, run the isolated launcher journey and include its output in a bug report:

```sh
npm run companion:ui-test
npm run companion:ui-performance-test
```

The second command also reports cold/warm launcher-to-card visibility and fails above the 200 ms
local regression budget. It uses synthetic metadata and does not read private provider content.

The current source makes the launcher key on demand for the click that targets it and makes the
nonactivating card pointer-ready as it appears. Focus and Important remain clickable and draggable
during a read refresh; only an actual priority mutation temporarily blocks another priority change.
If an older installed copy still needs a priming click, rebuild and replace it with the current
`build/Gajendra.app`.

### A task does not move when dragged

Hold the task until it lifts and **Done editing priorities** appears, then continue dragging the
visible row. Drop on another row to insert before it, or on the open area of a Focus/Important lane
to append. The whole operation is one atomic priority change. Organizer also provides explicit move
controls if pointer drag is not your preferred input.

### A source shows Off, Not installed, or Needs setup

- **Off:** turn it on in **Manage AI tools…**.
- **Not installed:** install the supported local tool, then select **Rescan**.
- **Needs setup:** complete that tool's own local setup, then rescan.
- **Needs attention:** Gajendra could not read the bounded metadata contract; the provider session
  itself is not changed.

### Open fails

Gajendra fails closed when a destination is missing or its scheme is not allowed for that source.
Confirm the source tool is installed and the catalog uses the documented safe scheme.

### Rebuild after pulling changes

```sh
npm ci
npm run check
npm run companion:build
open build/Gajendra.app
```

## Privacy summary

Gajendra reads bounded local thread metadata and stores only its own priority metadata. It does not
store prompts, transcripts, tokens, credentials, provider databases, review results, or diffs. The
source tool continues to own the session and every Open action.

For the precise persisted fields and adapter limits, see [Security](../SECURITY.md),
[Architecture](ARCHITECTURE.md), and [Thread sources](THREAD_SOURCES.md).
