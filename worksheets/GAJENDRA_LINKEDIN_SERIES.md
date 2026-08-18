# Gajendra LinkedIn series

- **Status:** ten local drafts for maintainer approval; none is published or scheduled
- **Public review:** <https://github.com/siddath/Gajendra/pull/12>
- **Product boundary:** public source-review candidate with a narrow installed launcher receipt; no signed or notarized download
- **Natural series size:** ten posts. Beyond these ten, the current evidence starts repeating the same lessons rather than adding a distinct story.

The order deliberately starts with the product problem, then moves through engineering decisions,
and ends with accountable AI use and the gated mobile plan. Post 1 pairs with
`evidence/launch/gajendra-linkedin-synthetic.png`; the image uses synthetic demo data.

## 1. Why I built Gajendra

I kept losing the one AI thread I actually needed to return to.

The sessions were still there, spread across different tools. What was missing was a small layer
that remembered my decision: this is the thread for now; these few come next.

🧭 So I built a small side project called Gajendra. It gives me one NOW, a short Focus queue,
Important, explicit Running state, search, and a direct route back to the source thread.

**One NOW. One short queue. One click back to the exact thread.**

🛠️ I chose a native macOS surface because I wanted it to feel quiet and close at hand, not like
another dashboard. That choice made keyboard use, accessibility labels, Reduce Motion, compact
density, and a self-contained runtime part of the product rather than polish for later.

The harder work started when I treated it like a release candidate.

🔍 Atomic file replacement was not concurrency safety. A smooth drag interaction was still unsafe
when it became several writes. “Local-first” required an audit of every metadata read and every
error. A Mac app was not self-contained if a clean machine still needed Homebrew and Node.

The current source-review candidate passes the repository gauntlet, native build and validator,
isolated real-window launcher automation, and hosted Linux and macOS checks. The exact ad-hoc build
also passed a launcher journey after local installation.

It is still not a signed, notarized download. Physical VoiceOver, login-item, drag, and clean-Mac
checks remain open.

📱 A mobile companion is planned, not shipped. I am keeping that boundary explicit until pairing,
transport, lifecycle, privacy, and real-device evidence exist.

Source review: <https://github.com/siddath/Gajendra/pull/12>

*Image uses synthetic demo data.*

---

## 2. “Local-first” is not just a storage location

I used to hear “local-first” and think primarily about where the database lived.

Building Gajendra made that definition feel incomplete.

The product has to discover threads from several AI tools, show enough metadata to help me resume
work, and open the exact source destination. Each of those steps is a privacy boundary.

So I treated local-first as a chain of constraints:

- no cloud service of its own;
- no transcript body in Gajendra's persisted state;
- bounded metadata reads instead of unbounded file ingestion;
- allowlisted destination schemes before anything opens;
- generic user-facing errors that do not echo private paths or child-process output;
- synthetic fixtures and synthetic launch artwork in the public repository.

The live probe reports counts and source health without printing thread content. Gajendra's private
store retains canonical IDs, queue order, a small context enum, preferences, and a revision—not a
second copy of provider conversations.

That does not make metadata harmless. A title can still be sensitive. It means the system has a
smaller, inspectable responsibility and a clearer failure mode.

My takeaway: local-first is not a marketing adjective. It is a data-flow review you should be able
to draw, test, and challenge one boundary at a time.

---

## 3. Atomic file replacement did not make my local app concurrency-safe

One of the most useful failures in Gajendra began with a comforting sentence:

“The state file is replaced atomically.”

That protects against a torn write. It does not stop two writers from reading revision 7,
independently computing revision 8, and silently overwriting each other.

The fix became a small transaction protocol:

- a cross-process, token-owned lock;
- compare-and-swap on the expected revision;
- idempotency keys for replayed mutations;
- one atomic `move-before` operation instead of a drag becoming several writes;
- last-known-good recovery and quarantine for damaged state;
- stale-lock reclamation that cannot delete a newly acquired lock.

Then I stopped proving it with one process.

The integration suite drives 40 independent Node processes against an isolated data directory. It
also kills a writer at a fault point after the primary write and checks that recovery exposes a
complete old or complete new state—never a half-applied queue.

The lesson was simple: atomic I/O is one property. Concurrency safety is a protocol.

---

## 4. A two-pixel movement exposed the gap in my UI testing

The bug report was straightforward: the Gajendra widget would not open again on tap.

The cause was less obvious. The launcher could remain in move/hide edit mode, where a normal click
did nothing. At the same time, a drag recognizer started after one point of movement, so the tiny
motion inside an ordinary click could consume the tap before the six-point placement threshold.

I changed the interaction contract:

- a primary click exits edit mode and opens the card;
- the drag recognizer starts at the same six-point threshold as placement;
- the borderless panel exposes a real accessibility button whose press uses the same recovery path.

The more important change was the test.

The macOS UI driver now launches the actual app window with an isolated empty store and checks a
stationary click, a two-pixel click, edit-mode recovery, an Accessibility press, and a near-edge
placement. I ran that journey repeatedly and once against the freshly installed ad-hoc candidate.

Hosted CI compiles the UI target, but it does not pretend a headless runner has proved macOS
permissions or physical input. The real interaction receipt remains a logged-in-Mac test.

That distinction matters. A view can be unit-tested and still be impossible to click.

---

## 5. Undo is a concurrency protocol, not a menu item

Adding Undo and Redo to Gajendra looked like a native-app task. It turned into a state-consistency
task.

The first implementation registered the opposite action only after an asynchronous server call
returned. By then macOS no longer considered the app to be inside an undo operation, so the entry
went back onto the Undo stack instead of creating Redo.

A second problem was more dangerous. If another writer changed the queue and the app refreshed,
an old inverse action could be sent with the newest revision and overwrite newer intent.

The correction was to own the asynchronous history explicitly:

- queue typed user intents, not precomputed mutations;
- plan both the forward action and its inverse from the snapshot at dispatch time;
- keep one coherent history revision watermark;
- invalidate history after an unrelated authoritative refresh or conflict;
- update the visible Undo and Redo stacks only after a successful mutation.

The regression now proves two user actions, two undos, and two redos with advancing revisions and
exact queue, context, and NOW state.

The UI labels were the easy part. The real feature was refusing to undo against a world that no
longer existed.

---

## 6. A timeout is not bounded if a grandchild still owns the pipe

I had process timeouts in both the TypeScript service and the Swift companion. They looked
reasonable: wait, send TERM, then send KILL.

They were still wrong.

A child process could fork a descendant that inherited stdout or stderr. The direct child exited,
but the descendant kept the pipe open. The caller then waited beyond its advertised deadline—
potentially forever.

The eventual contract was stricter:

- create a dedicated process group before execution;
- signal the whole group, not only the leader;
- use bounded TERM and KILL grace periods;
- bound captured bytes as well as elapsed time;
- wait for close only within a final watchdog;
- destroy local pipe handles if the group still does not close;
- reject with a generic error that does not leak captured private output.

The fixtures use silent descendants that ignore TERM and keep inherited pipes. Tests require both
the leader and descendant to be non-runnable before the operation settles, including normal-exit,
timeout, output-overflow, shutdown, and retry races.

The lesson I am keeping: test the process tree, not just the PID returned by `spawn`.

---

## 7. “Ready for Review” had to remain a signal, not become another priority

I wanted Gajendra to show work that an AI tool says is ready for human attention.

The tempting implementation was a new queue or a guess based on recency. Both would blur the
product's contract.

Gajendra already has user-owned priority: NOW, Focus, and Important. Ready for Review is different.
It is derived live metadata and appears only when an enabled provider emits an explicit, validated
review-ready signal with a supported destination.

That led to a few rules:

- idle, resumable, recently updated, or “last message was from the assistant” is not enough;
- Running wins if a stale provider reports both running and review-ready;
- review status never changes queue placement and is never persisted as a third tier;
- the main row opens the declared Review or Task destination;
- the provider badge separately returns to the owning thread;
- invalid or failed source data creates no fabricated review row.

The current implementation is proven through the configured-catalog path, native and web views,
search, empty/one/ten-row previews, and non-persistence tests.

It is not yet a remote-provider integration. That requires a separate credential, network, and
trust decision.

Good derived status should help me notice reality without quietly rewriting my priorities.

---

## 8. “It builds on my Mac” was not the release boundary

The first Gajendra companion could find Node through developer-machine paths. That made it a local
build, not a self-contained Mac app.

The candidate now bundles a pinned Node 24.19.0 runtime, verifies its archive checksum during
extraction, carries the license and notices, and resolves the bundled runtime before development
fallbacks. The minimum macOS version is 13.5 because that is the floor of the pinned official
runtime—not a number chosen for appearance.

The release checker also became deliberately suspicious. For a distribution claim it must inspect
the archive before extraction, reject outside payloads and oversized contents, compare the entire
embedded app manifest—including the app root mode—with the inspected source app, and run signing,
Gatekeeper, and stapling checks on the extracted copy.

That work caught an uncomfortable truth: a checker can be strict in many places and still prove
the wrong artifact.

The current local bundle is ad-hoc signed and passes local bundle-readiness. It is not Developer ID
signed, notarized, stapled, or offered as a download.

Release engineering is mostly the discipline of naming exactly what the evidence proves.

---

## 9. The useful part of multi-agent coding was not the number of agents

I used Codex Harness with separate server, native, and adversarial-review lanes for this Gajendra
release candidate.

Parallelism helped, but it was not the main advantage. The useful part was explicit ownership and
an evidence contract:

- one lane owned persistence, provider discovery, and web behavior;
- one lane owned the Swift companion and native tests;
- the orchestrator integrated only frozen snapshots;
- an adversarial pass had to produce a concrete reproduction, exact source location, and smallest
  credible fix;
- any later edit reopened the affected proof.

That process found defects after broad test suites were already green: a crash window before a
recovery marker, stale history that could undo over newer work, a symlink escape, inherited-pipe
process leaks, an archive checker that did not prove archive purity, and UI automation that was not
actually exercising the accessibility route.

It also caught test failures in hosted Linux CI that did not reproduce on the development Mac.

My takeaway is not “more agents equals better software.” It is that AI assistance becomes more
accountable when roles, write scopes, stopping conditions, and proof are explicit.

---

## 10. I planned the mobile companion by deciding what not to build yet

Gajendra's desktop model is local: provider discovery and mutation happen on the Mac that already
owns the tool data.

It would be easy to call the same model “portable” and start building an iOS or Android client.
That would skip the hard part: the trust boundary.

The current mobile work is therefore a plan, not an app. The proposed shape is an opt-in Mac relay
with a paired device, beginning with a narrow Open on Mac action. Before implementation, it needs
explicit decisions and evidence for:

- pairing and revocation;
- authentication and replay protection;
- discovery and same-LAN transport;
- background and sleep/wake lifecycle;
- deep-link policy on each platform;
- lost-device and credential recovery;
- privacy disclosures and app-store requirements;
- cross-process mutation safety through the existing revision protocol.

No listener, mobile credential, mobile dependency, or mobile client exists in the current branch.

I like roadmaps that make ambition visible. I trust them more when they also show the gates that
keep an idea from being described as shipped software.

## Approval and publication notes

- Review every draft independently; approving one does not approve the series.
- Keep the source-review link until the candidate is merged. Do not imply that the PR is already on
  `main`.
- Do not add a download link until Developer ID, notarization, Gatekeeper, archive, clean-Mac, and
  distribution receipts exist.
- Do not publish automatically. Timing, edits, image selection, and publication remain the
  maintainer's decisions.
