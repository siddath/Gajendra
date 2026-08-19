# Focus card design case study

Gajendra's card is designed to answer six questions without becoming a second full organizer:

1. What is NOW?
2. Is it provider-reported Running or otherwise resumable?
3. What are the next Focus and Important threads?
4. What work is explicitly Running across lanes?
5. What completed work is explicitly Ready for Review?
6. Can the user return to the exact source thread or review destination?

The answer is a compact hierarchy: NOW first; Focus and Important next; explicit Running as a
separate disclosure; Ready for Review immediately below it; and Organizer for full retrieval and
queue management. Compact lanes show at most five rows and route the remaining count to Organizer.

## Interaction rationale

A focus card should keep direct source opening clear, never reinterpret provider content as a new
task system, and avoid accidental state changes from hover. Queue editing is an atomic move-before
source contract, not a chain of individual moves. Unsafe destinations are rejected before any
host/native navigation.

The identity uses Gajendra, **One clear focus across your AI tools.**, and the plain labels NOW,
Focus, Important, and Running. The longer positioning line is **One NOW. One short queue. One click
back to the exact thread.**

## Evidence boundary

This document records the intended hierarchy and source contracts. The current candidate has a
passing local gauntlet, synthetic screenshots, and an exact-installed automated card interaction
receipt; this page is not clean-Mac, physical VoiceOver/human drag, or cross-machine performance proof.
Those gates remain in [Status](../STATUS.md) and [Gauntlet](GAUNTLET.md).
