# Product and UX parity plan

**State:** plan_generated

**Authority:** [master plan](../GAJENDRA_MOBILE_APP_PLAN.md)

## Product definition

The mobile product is a portable Focus Deck and Organizer for an explicitly paired Mac. It is not a
floating system widget, provider client, remote terminal, offline replica, or cloud sync product.

Portable parity preserves the decision model and journeys: singular NOW, Focus, Important,
inclusive Running, metadata search, context, source health, themes, ordering, and safe provider
handoff. Desktop mechanics adapt honestly to phone platforms.

## Information architecture

| Surface | Required content and actions |
| --- | --- |
| Pairing | Why a Mac is required, QR/manual pairing, matching code, permissions, failure/retry |
| Focus home | Singular NOW, Focus preview, Important preview, Running disclosure, refresh state |
| Organizer | Full queues, search, source/status/context metadata, reorder and move actions |
| Search | Multi-term metadata search, safe empty/error states, non-overlapping actions |
| Connection | Paired Mac identity, relay/source health, in-memory refresh status, revoke |
| Settings | Auto/Light/Dark, system-respecting motion; source management points to Mac |
| Open on Mac | Explicit target Mac/provider, request acknowledgment, typed unsupported/error |

No v1 surface enables sources, edits provider credentials, displays resume commands, or promises
that a provider opened unless the Mac acknowledges the resolved action.

## Behavioral parity

| Current behavior | Mobile requirement | Proof |
| --- | --- | --- |
| NOW is absent or one Focus item | Same invariant and top-card hierarchy | Property test and UI journey |
| Focus/Important ordered and exclusive | Five-row previews plus Show more; full organizer | Unit, touch, accessibility reorder |
| Running derives from explicit active status across lanes | Expandable section; never recency inference | Provider matrix and copy review |
| Multi-term metadata search | Persistent keyboard/IME-safe search | Unit plus compact-screen journey |
| Bounded context on prioritized threads | Accessible picker/menu; reject invalid context | Contract and UI test |
| User-controlled collapse | Preserve applicable collapse state on Mac authority | Mutation/refresh test |
| Refresh runs Mac registry | Busy/queued; disconnected/source-specific error | Integration/reconnect journey |
| Provider resume is Mac-specific | Label action Open on Mac | Canonical-ID-only test |
| Source toggles are local preferences | Read-only health; Manage on Mac guidance | Negative-scope test |

## Intentional adaptations

| Desktop-only mechanic | Mobile adaptation |
| --- | --- |
| Floating lotus and six screen anchors | Normal app home; no cross-app overlay |
| Hover and double-click edit mode | Touch feedback and explicit actions |
| Outside click and Escape | Navigation, sheet dismissal, system Back |
| Resizable Organizer window | Full-screen organizer with safe-area layout |
| Mouse drag | Touch handle plus accessible Move Up/Down actions |
| Terminal/deep-link resume | Explicit Open on Mac request |
| Launch at Login and uninstall | Mac-only settings |

Notifications, widgets, background sync, offline snapshots, cloud/out-of-home access, and public
store release are non-goals for v1. Each needs a separate product/privacy decision.

## Visual system

- Reuse canonical elephant/lotus geometry and semantic tokens; do not redraw from memory.
- Map Native Popover and Focus Deck themes to platform surfaces while preserving hierarchy.
- Use system typography, Dynamic Type on iOS, and system font scaling on Android.
- Keep source, status, and context labels text-backed and understandable without color.
- Preserve Open as the primary NOW action, followed by activity/provider context.
- Respect safe areas, edge-to-edge, rotation, reduced motion, increased contrast, and platform
  navigation.
- Essential NOW, provider, error, and action text remains perceivable at supported accessibility
  sizes; truncation cannot hide the decision.

Touch targets follow current Apple/Android guidance selected at implementation time and are
recorded in the test receipt.

## Required states

Every surface covers loading, empty, disconnected, permission-denied/revoked, pairing-expired,
auth-expired, conflict, source-error, relay-stopped, Mac-asleep, and recovery states. Failures name
what happened and the safe next action; they never fabricate stale priorities or Running.

## Phase-zero Capacitor gate

The bounded spike may reuse the responsive web UI only if:

- every relay request is mediated by the native Swift/Kotlin plugin;
- no generic WebView networking or credential storage bypasses it;
- pairing, pinning, revoke, key loss, permission recovery, and conflict refresh are drivable in
  native E2E tests;
- VoiceOver/TalkBack order, large fonts, reduced motion, Back, safe areas, rotation, and keyboard
  behavior meet the parity matrix;
- storage, backup, logs, screenshots, and app-switcher views contain no prohibited metadata.

If any gate fails, stop and update the decision register with evidence. The predeclared fallback is
SwiftUI plus Jetpack Compose over the unchanged mobile-safe contract and needs a new estimate and
Sid approval.

## UX evidence

- Screen/state inventory mapped to automated journeys.
- Compact phone, standard phone, and tablet screenshots in light/dark and portrait/landscape.
- No-overflow proof for long titles, five-plus rows, search, keyboard, and errors.
- VoiceOver/TalkBack traversal including reorder and Open on Mac.
- Dynamic Type/font-scale and reduced-motion receipts.
- Physical iPhone and Android permission, reconnect, and safe-area review.
- Human visual review against current native and web Gajendra.

Simulator/emulator screenshots prove rendering only, not local-network permission, pairing
security, provider discovery/resume, or physical-device accessibility.
