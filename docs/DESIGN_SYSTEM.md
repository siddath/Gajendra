# Gajendra design system

**Gajendra** is a quiet focus beacon: steady attention without another busy workspace.

- **Descriptor:** One clear focus across your AI tools.
- **Promise:** One NOW. One short queue. One click back to the exact thread.
- **Queue language:** NOW, Focus, Important, Running, Ready for Review.
- **Compatibility:** gajendra, gajendra://, dev.sid.gajendra, executable and state-path names
  remain stable identifiers, not visible copy.

## Product principles

1. **One decision, not a replacement task system.** Providers own sessions and credentials;
   Gajendra owns only priority metadata and the bounded context enum.
2. **Direct return.** An action opens an allow-listed source destination; it must not manufacture
   browser or shell behavior from provider data.
3. **Quiet density.** NOW is visually primary. Focus and Important are short, ordered, and reveal
   longer queues in Organizer. Running is an explicit provider signal, not a prediction.
   Ready for Review is a derived disclosure below Running, never a third priority tier.
4. **Plain language.** Use Focus, never a decorative or doubled-star name. Do not use historical
   visible product names in new UI, docs, status text, accessibility labels, or errors.
5. **Accessible restraint.** Semantic colors, legible labels, keyboard operation, and Reduce Motion
   are source requirements. Physical accessibility evidence remains a separate pending gate.
6. **Metadata-first rows.** Compact tasks show the thread title, project, context/tag when present,
   provider, and an applicable Running/Review mark. Hover and hold create selection feedback; a
   selected row lifts for app-local drag instead of carrying generic menu/drag chrome. A stable
   trailing slot may hold a purpose-specific status-row priority control, but compact Focus and
   Important rows rely on drag/context/accessibility movement instead of a duplicate lane-swap button.
   NOW never exposes a lane-changing action and every control remains separate from the row's Open target.

Green supports provider-confirmed activity and the explicit Ready-row **Mark reviewed** action.
System orange identifies Ready for Review and is paired with a static tray glyph, the visible status
label, ready time, and destination text. Orange never implies a completed user action. The mark does
not loop or pulse, so Reduce Motion receives the same complete static state.

## Surface contract

The mark is an elephant holding a lotus, representing steady attention and clarity. A source-level
native header should retain leading identity, a geometrically centered Gajendra title/descriptor, and
trailing actions without relying on a live implementation claim. The web app follows the same copy
and queue vocabulary.

The current source-review candidate has a passing local gauntlet receipt, generated synthetic
previews, and an exact-installed automated tap/drag/Search/dock receipt. It has no clean-Mac or
physical VoiceOver screen-reader evidence; those remain release gates, not design-system facts.
