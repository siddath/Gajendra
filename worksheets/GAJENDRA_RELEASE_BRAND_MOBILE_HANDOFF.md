# Gajendra release, brand, and mobile execution record

**State:** public-safe historical record

**Reconciled:** 2026-08-24

**Current truth:** see [STATUS.md](../STATUS.md)

## Purpose

This worksheet records the reusable product contract, the work completed from the original release
handoff, and the gates that remain open. It intentionally excludes local machine paths, process
identifiers, executable hashes, private task metadata, prompts, transcripts, credentials, and
operator-specific notes.

The repository is the public source of truth. Historical local, reviewed, committed, hosted,
installed, signed, distributed, and published states must remain distinct.

## Product contract

Gajendra is a self-contained, local-first macOS priority layer across supported AI tools:

- **NOW** is one task inside Focus.
- **Focus** and **Important** are small user-owned priority lanes.
- **Running** is explicit provider activity and does not change priority.
- **Ready for Review** is valid provider completion evidence, not an unread badge.
- Opening a task does not clear Ready; a newer provider turn changes the evidence.
- Source tools continue to own task content, sessions, prompts, transcripts, and credentials.
- Gajendra persists namespaced identifiers and its own priority metadata only.

The expected lifecycle is:

`provider Running -> provider Ready for Review -> user-owned Focus or Important -> optional NOW`

Priority is orthogonal to provider state. A task may therefore appear in a priority lane and a
provider-status dock at the same time.

## Desktop execution outcome

The completed desktop candidate includes:

- candidate-local handling for an exact safe legacy `completedAt: null` turn summary, so it cannot
  hide independently valid completed siblings;
- fail-closed rejection of malformed, private-content, unsupported, ambiguous, future-time, and
  purported-completed error responses;
- a bounded provider/service/native deadline chain that permits valid slow collection without an
  unbounded wait;
- an isolated real-window proof that the same synthetic task leaves Running, appears in Ready,
  preserves priority and NOW, and opens its exact synthetic destination;
- direct **+** actions for unprioritized Running and Ready rows and a one-click Focus/Important swap
  for non-NOW prioritized rows;
- a defense-in-depth NOW guard across compact, Organizer, Search, accessibility, drag/drop, model,
  domain, and public mutation routes;
- long-press selection and lift, continuous hold-to-drag, visible hover/press feedback, and no
  compact-row hamburger control;
- single-click **All priority lanes**, double-click dock expansion, bounded Ready preview, Search,
  Organizer overflow, and exact task opening;
- launcher first-interaction recovery, reveal prewarming, and a circular icon without a clipped
  rectangular shadow;
- dynamic bounded loopback ports for browser automation, mitigating fixed stale-preview collisions;
- real SwiftUI launch images rendered only from synthetic fixtures.

The detailed evidence and remaining boundaries live in:

- [Status](../STATUS.md)
- [User guide](../docs/USER_GUIDE.md)
- [Thread-source contract](../docs/THREAD_SOURCES.md)
- [Native companion guide](../docs/COMPANION.md)
- [Adversarial launch review](../evidence/verification/2026-08-24-adversarial-launch-review.md)
- [Performance receipt](../evidence/verification/2026-08-24-priority-actions-performance.md)
- [Gauntlet contract](../docs/GAUNTLET.md)

## Verification contract

Release claims require evidence from the exact source revision:

1. deterministic source tests and type checking;
2. plugin build and validation;
3. native self-test, app build, service parity, and ad-hoc signature checks;
4. synthetic real-window interaction and performance journeys;
5. browser behavior, accessibility, forced-color, and overflow journeys;
6. privacy validation for every public launch asset;
7. dependency audit and a fail-fast gauntlet receipt;
8. hosted checks for the pull-request head and merged-main revision;
9. installed-state preservation and exact local artifact verification.

Automated proof does not replace clean-Mac installation, physical VoiceOver, status-item
accessibility, human-pointer drag, Developer ID signing, notarization, Gatekeeper, or distribution
evidence.

## Open-source setup and usability

The [README](../README.md) is the supported entry point for prerequisites, source build, local
installation, privacy behavior, daily use, and troubleshooting. Public screenshots are synthetic
and carry an explicit disclosure. No signed or notarized binary download is claimed.

Contributors should keep changes bounded, preserve the local-first boundary, test observable
behavior, and avoid adding provider task content or machine-specific evidence. The issue and pull
request templates contain the public privacy checklist.

## Mobile boundary

Mobile remains documentation-only. The planning pack is retained under
[`worksheets/gajendra-mobile/`](gajendra-mobile/README.md) and
[`GAJENDRA_MOBILE_APP_PLAN.md`](GAJENDRA_MOBILE_APP_PLAN.md).

No listener, relay, mobile shell, credential, signing identity, store submission, or distribution
claim is part of the desktop release. Any future mobile spike requires a separately approved trust
boundary, transport design, device matrix, kill criterion, and security review.

## Brand and publication boundary

The public promise remains:

> One NOW. One short queue. One click back to the exact thread.

The primary launch image is [`gajendra-hero.png`](../evidence/launch/gajendra-hero.png), rendered
from synthetic data. The prepared [LinkedIn draft](GAJENDRA_LINKEDIN_POST_DRAFT.md) is an
owner-reviewed manual publication artifact; repository automation must not publish or engage on
the owner's behalf.

The post may claim a local-first, source-available macOS project, provider-reported Running and
Ready states, direct priority actions, synthetic launch imagery, and bounded multi-agent
development only after the exact hosted and merged-main gates pass. It must not claim a signed
download, mobile companion, human unread tracking, or universal performance.

## Remaining release gates

- hosted checks and merged-main verification for the exact release revision;
- installed app/plugin parity without altering the user's private priority state;
- clean-Mac and independent offline-path proof;
- physical VoiceOver, status-item accessibility, manual drag, login-item, and system-toggle proof;
- a dedicated follow-up for the Organizer-only SwiftUI `AttributeGraph` diagnostic;
- Developer ID signing, notarization, stapling, Gatekeeper, release archive, and binary
  distribution;
- separate mobile decisions and implementation approval;
- final human review and manual publication of the launch post.

Stop when the authorized source release is merged, installed, and honestly reconciled, or when a
named external gate is the only work left. Do not convert an external gate into a shipped claim.
