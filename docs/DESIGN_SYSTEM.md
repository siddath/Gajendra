# Gajendra design system

**Gajendra** is a quiet focus beacon: steady attention without another busy workspace.

- **Descriptor:** One clear focus across your AI tools.
- **Promise:** One NOW. One short queue. One click back to the exact thread.
- **Work views:** Ready for Review, Needs input, Running, Your priorities, History.
- **Priority language:** NOW, Focus, Important. Finish work/Reopen are explicit lifecycle actions.
- **Compatibility:** gajendra, gajendra://, dev.sid.gajendra, executable and state-path names
  remain stable identifiers, not visible copy.

## Product principles

1. **One decision, not a replacement task system.** Providers own sessions and credentials;
   Gajendra owns bounded priority, explicit lifecycle/continuation metadata, and context.
2. **Direct return.** An action opens an allow-listed source destination; it must not manufacture
   browser or shell behavior from provider data.
3. **Quiet density.** Keep review, input, and running attention separate from Your priorities and History.
   NOW is one explicit selection within open Focus; finishing it can leave NOW empty. Focus and
   Important remain short ordered queues. Ready is independent of age and never a priority tier.
4. **Plain language.** Use Focus, never a decorative or doubled-star name. Do not use historical
   visible product names in new UI, docs, status text, accessibility labels, or errors.
5. **Accessible restraint.** Semantic colors, legible labels, keyboard operation, and Reduce Motion
   are source requirements. Physical accessibility evidence remains a separate pending gate.
6. **Metadata-first rows.** Compact tasks show the thread title, project, context/tag when present,
   provider, and an applicable Running/Review mark. Hover and hold create selection feedback; a
   selected row lifts for app-local drag instead of carrying generic menu/drag chrome. A stable
   trailing slot may hold a purpose-specific status-row priority control, but compact Focus and
   Important rows rely on drag/context/accessibility movement instead of a duplicate lane-swap button.
   NOW never exposes a lane-changing action. Finish work is separate from Open and Mark reviewed;
   every control remains separate from the row's Open target.

The compact widget omits per-row More menus. Lifecycle and continuation controls remain in Organizer
and the embedded plugin. Neither surface duplicates its sections in top navigation. The open
Focus/Important section has a centered, primary-color Your priorities heading; the compact Edit
control stays on the right without shifting the title. Focus and Important use equally emphasized
headers on a shared baseline, with matching insets for their task rows. Ready for Review retains
its tray mark alongside the section label and count.

Green supports provider-confirmed activity and the explicit Ready-row **Mark reviewed** action.
System orange identifies Ready for Review and is paired with a tray glyph, the visible status
label and ready time. Omit redundant Task/Review destination ornaments; destination meaning remains
in the link's accessible label. Orange never implies a completed user action. Heading hover feedback is pointer-local: Running gives one short green wave, Review receives a
small letter in its tray, Focus highlights its star, and Important highlights and moves its bookmark.
There is no idle loop. Motion stays inside the icon slot (160–240ms), can be interrupted, and never
moves labels or click targets. Reduce Motion retains static highlights. Row titles reserve a single-line
slot, gain weight on hover, and retain full accessible names; long row titles truncate rather than rewrap.
Native NOW retains its two-line Organizer and two/three-line compact/expanded widget allowance,
reserving the bold footprint so hover does not resize the card.

Review and Running share heading font, icon slot, baseline, count, inset, and disclosure geometry.
The review action is an icon-only check with a named accessible label and tooltip/help. Its target
remains distinct from Open. Acknowledgement immediately dismisses only the clicked response while
Saving review feedback remains visible. Failed writes restore authoritative evidence and offer Retry;
successful writes offer Undo. Newer responses and external Undo override old local feedback.

History separates All, Reviewed, and Finished, with direct chat titles and continuation links.
Reviewed means a confirmed exact-response receipt, not completed work. Pending entries say Saving
review in All and stay out of Reviewed until confirmed. Updated labels mean chat activity time,
not acknowledgement time. Native lists reveal more on demand. Keyboard activation is immediate;
press-scale feedback is pointer-only.

## Surface contract

The mark is an elephant holding a lotus, representing steady attention and clarity. A source-level
native header should retain leading identity, a geometrically centered Gajendra title/descriptor, and
trailing actions without relying on a live implementation claim. The web app follows the same copy
and queue vocabulary.

Native and embedded surfaces consume the same product projection. Cached activity is labeled and
neutral until live evidence arrives. Pending review must not disappear into an age bucket. History
uses exact chat identities; predecessor links do not merge titles or erase previous destinations.

The 0.4.0 local candidate requires its own interface and installation proof. Earlier gauntlet,
synthetic preview, and installed interaction receipts remain historical; no clean-Mac or physical
VoiceOver claim follows from them.

## Record and action feedback

Record titles crossfade medium/bold layers over 120 ms within a fixed title footprint. Row hover
surfaces fade over 160 ms; pointer press feedback uses a subtle 0.97 scale and 100–160 ms response.
No provider navigation or disclosure waits for feedback to complete. Keyboard actions remain
immediate; Reduce Motion removes transform motion and title transitions. Rapid interactions
retarget existing feedback, and pointer cancellation resets pressed controls. There is no perpetual
row animation or stagger on ordinary refresh.
