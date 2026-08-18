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

1. **Single-click the floating Gajendra button** to show or hide the focus card.
2. Put one thread in **NOW**. It remains part of the Focus queue.
3. Keep the next few threads in **Focus** and lower-pressure work in **Important**.
4. Glance at **Running** for active provider work and **Ready for Review** for explicit completed
   work that needs human attention.
5. Select **Open**, a row, a provider badge, or a Review/Task action to return to the source-owned
   destination.
6. Use the search field for a title, project, source, or status; open Organizer when you need the
   full queues.

## Interaction reference

### Floating button and card

- Single-click the floating button to toggle the card. The same action recovers from move/hide mode,
  so the launcher should not become a dead end.
- Double-click the card background to open NOW.
- Open the app menu to show or hide the lotus, manage sources, change appearance, or quit.
- Card size can be Compact, Comfortable, or Expanded. Appearance can follow the system or use an
  explicit light/dark choice.

### Priorities

- **Make NOW** promotes a thread while preserving the previous lane/order information needed for
  Undo.
- **Edit priorities** exposes remove controls and drag handles for Focus and Important.
- Organizer provides explicit up/down, lane, context, and overflow actions when drag is not the
  preferred input.
- Successful changes participate in app-owned Undo/Redo. A conflicting external refresh clears
  stale history rather than applying an old inverse to newer work.

### Running

Running is derived from an explicit provider status such as active, working, or streaming. It can
contain NOW, Focus, Important, or unprioritized work and never changes priority by itself.

### Ready for Review

Ready for Review requires an explicit live signal from a configured source. The review row opens the
declared **Review** or **Task** destination; the provider badge separately opens the owning task.
The built-in Codex, Claude Code, Cursor, and Grok adapters do not currently infer review readiness.

To experiment without private data, start from [the synthetic review catalog](../examples/review-catalog.json)
and the boundaries in [Thread sources](THREAD_SOURCES.md).

## Accessibility and comfort

- The native controls expose labels, values, hints, and keyboard actions.
- The interface respects Reduce Motion and supports system, light, and dark appearances.
- Status is never communicated by color alone: Running and Ready for Review include symbols, text,
  counts, and destination labels.
- Organizer offers explicit controls as an alternative to drag-and-drop.

Physical VoiceOver, drag, login-item, and system-toggle receipts remain part of the external release
gate; the repository does not present source tests as proof of every physical journey.

## Troubleshooting

### The floating button does not reopen the card

Use a normal single click without dragging. A primary click exits move/hide mode before toggling the
card. You can also use the app menu to show the Gajendra lotus again. If the current source build
still fails, run the isolated launcher journey and include its output in a bug report:

```sh
npm run companion:ui-test
```

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
