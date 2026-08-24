# Adversarial launch review

**Date:** 2026-08-24

**Decision:** proceed with a public **source-only** launch after PR #25 and merged-main checks pass

**Owner action:** publish the prepared LinkedIn post manually; do not imply a signed download or
mobile release

## Product verdict

Gajendra solves a coherent problem: execution status, review status, and personal priority are
related but are not the same state. The useful trajectory is provider-reported **Running** to
provider-confirmed **Ready for Review**, followed by a user-owned choice to place a task in
**Focus** or **Important**. Opening a task is intentionally not treated as proof that its review is
finished.

The compact widget is now sufficient for the high-frequency decisions. A user can add an
unprioritized Running/Ready task to Focus or Important and can move a non-NOW task between those
lanes without opening Organizer. Organizer remains available for bulk ordering and context edits.

## Claims challenged and resolved

| Attack | Resolution |
| --- | --- |
| “Unopened” could be presented as a reliable provider field. | Rejected. Codex does not expose a trustworthy human-read field here; Ready is documented and implemented as terminal completion evidence. |
| One legacy completed candidate without a timestamp could suppress valid Ready siblings. | Fixed candidate-locally; malformed, private, error, future-time, and unsupported responses still fail the optional batch closed. |
| A normal bounded Codex read could race the service's former five-second outer budget. | Fixed by using the existing 30-second overall generation budget; the native caller uses a derived 45-second watchdog covering bounded store settlement and process/output margin. |
| NOW could escape Focus through less-visible native or public mutation paths. | Fixed across compact, Organizer, Search, accessibility, drag/drop, model, domain, and service layers. A valid atomic replacement remains possible. |
| A menu on every prioritized row could preserve function but slow first reveal. | Rejected after measurement. Only unprioritized rows use the two-choice menu; prioritized non-NOW rows use one direct lane-swap button. |
| Public proof could leak real workload metadata even without titles. | Removed. Public receipts use synthetic fixtures and behavior-only live-probe claims; no live task counts or identifiers are recorded. |
| Automated UI proof could be described as complete accessibility proof. | Rejected. The real-window journey covers observable controls and keyboard/AX paths, but physical VoiceOver and the system status item remain external gates. |
| A generic “feedback?” CTA would add value. | Rejected. The draft asks for one concrete AI-tool handoff gap, consistent with LinkedIn's stated preference for useful professional perspective over generic engagement bait. |

## Evidence accepted for this launch

- Exact-source unit/integration, browser, native self-test/build, real-window UI, popup performance,
  privacy-safe launch assets, bundle inspection, and fail-fast gauntlet receipts.
- Real SwiftUI screenshots rendered only from a dedicated synthetic fixture.
- Same-host performance comparison against exact revision `185f9f3769cc`; it is not generalized to
  other machines.
- Public source setup and feature documentation with explicit privacy and distribution boundaries.

## Gates deliberately left open

- Developer ID signing, notarization, stapling, Gatekeeper, a release archive, and clean-Mac proof.
- Physical VoiceOver, status-item accessibility, login-item, and manual human-drag receipts.
- Mobile transport, relay, credentials, signing, application, and store submission.
- LinkedIn publication. The owner must perform the final privacy/accuracy read and post manually.

## LinkedIn judgment

The final post is strategically stronger after removing implementation inventory and retaining one
technical insight: execution state, review state, and priority should not be collapsed into one
status. It discloses synthetic imagery, source-only availability, local-first storage, and bounded
multi-agent development without turning the post into a test report.

For Monday, Buffer's 2026 analysis ranks 10:00 PM local time as the strongest same-day slot, while
also warning that Monday is weaker overall than mid-to-late week. The recommended owner window is
9:55–10:05 PM IST, with 10:00 PM as the target:
[Buffer timing analysis](https://buffer.com/resources/best-time-to-post-on-linkedin/).

The concrete CTA and manual reply plan follow LinkedIn's stated direction toward authentic,
substantive professional conversation:
[LinkedIn feed update](https://news.linkedin.com/2026/ImprovingTheFeed).
