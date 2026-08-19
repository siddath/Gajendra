# Developer-experience review

**Scope:** the 2026-08-19 dirty Gajendra working candidate.

## Current source-level expectations

1. npm run check is the ordinary repository check; it includes TypeScript/plugin behavior and
   script syntax checks.
2. Companion build, validator, local bundle-readiness, E2E, and gauntlet are separate commands with
   distinct evidence scopes.
3. Source builds target macOS 13.5 and Node >=20. A bundle contract calls for a pinned Node v24.19.0
   runtime and notices; it is not a statement that a new binary exists.
4. The source is local-first: no provider database mutation, arbitrary shell discovery, or provider
   content persistence.
5. The release-ready tooling fails closed for missing distribution identity, Gatekeeper, notarization,
   staple, archive, or checksum inputs. It performs none of those consequential actions.

## Current review boundary

This source candidate is prepared on `codex/fix-drag-dock-interactions`; exact commit, push, PR, and
hosted-CI receipts are recorded only after they exist. One exact ad-hoc installed build has a full
isolated automated interaction receipt. It is not a merged tag, clean-Mac result, or distributable
binary. The open gates are listed in [STATUS.md](../STATUS.md).
