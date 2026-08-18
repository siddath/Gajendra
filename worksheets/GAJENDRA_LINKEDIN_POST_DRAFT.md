# Gajendra LinkedIn post draft

- **Status:** local draft only — not approved or published
- **Image:** `evidence/launch/gajendra-linkedin-synthetic.png` (synthetic demo data; no private threads)
- **Claim boundary:** public source-review candidate with a narrow installed launcher receipt; not Developer ID signed, notarized, or download-ready

---

I kept losing the one AI thread I actually needed to return to.

The sessions were still there, spread across different tools. What was missing was a small layer that
remembered my decision: this is the thread for now; these few come next.

🧭 So I built a small side project called Gajendra. It gives me one NOW, a short Focus queue,
Important, explicit Running state, search, and a direct route back to the source thread.

**One NOW. One short queue. One click back to the exact thread.**

🛠️ I chose a native macOS surface because I wanted it to feel quiet and close at hand, not like
another dashboard. That choice made details such as keyboard use, VoiceOver labels, Reduce Motion,
compact density, and a self-contained runtime part of the product—not polish for later.

The harder work started when I treated it like a real release candidate.

🔍 Atomic file replacement turned out not to be concurrency safety. A nice drag interaction was
still unsafe when it translated into several writes. “Local-first” meant auditing every metadata
read and every error, not just avoiding cloud storage. And a Mac app isn't self-contained if the
first clean machine still needs Homebrew and Node.

I used Codex Harness plus bounded model lanes to separate server, native, and adversarial review
work. That separation found failures the happy-path tests missed: stale undo history, process-group
leaks, corrupt-state recovery gaps, unsafe deep-link boundaries, and archive checks that looked
strict without proving the archive matched the app.

The current source-review candidate now passes the full repository gauntlet, native build and
validator, isolated real-window launcher automation, and an offline bundled-runtime check. The
exact ad-hoc build also passed its launcher journey after local installation. It is still not a
signed, notarized download. Physical VoiceOver, login-item, drag, and clean-Mac checks stay open.

📱 The next planned step is a paired iOS/Android companion through one opt-in Mac relay: start with
Open on Mac, then prove pairing, lifecycle, connectivity, and privacy on real devices. That is a
plan today, not a shipped mobile feature.

If this cross-tool problem is familiar, I'd value testers once the signed build exists. Source
contributors who want to pressure-test the provider, accessibility, and release boundaries are
welcome now.

*Image uses synthetic demo data.*
