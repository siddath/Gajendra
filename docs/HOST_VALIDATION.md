# Local host-validation procedure

This procedure has a completed host receipt for the 2026-08-19 implementation merged in PR #17: the exact ad-hoc
bundle installed in `~/Applications` passed the isolated launcher, hold/select/lift/full-row drag,
Organizer reorder, Search, dock, and measured popup journey. The executable matches the
verified build, and the private state hashes and modes stayed unchanged. It does not claim a
clean-Mac, manual human interaction, or physical accessibility journey.

## Preconditions

- All source writers have frozen their work and the exact candidate is recorded.
- Source checks have passed for that candidate.
- A locally built build/Gajendra.app is available only after the native build gate.
- Test fixtures are synthetic; no private rollout, transcript, prompt, token, or absolute private
  path appears in evidence.

## Procedure

1. Run npm run check and the focused E2E/source suites.
2. Run npm run companion:test, npm run companion:build, npm run companion:ui-test, npm run
   companion:ui-performance-test, and npm run companion:validate against the same frozen source.
   The UI harness must use its isolated synthetic store/source/catalog fixtures, restore the
   pointer, close the card, enforce OS-wide hit ownership and the widget popup budget, and reject
   widget-path dependency cycles.
3. Run npm run companion:bundle-readiness to inspect visible name, compatibility identifiers,
   macOS 13.5 floor, bundled Node v24.19.0/notices, service parity, and strict signature state.
4. Confirm the validator's synthetic configured source is isolated, applies a mutation, increments
   revision, and persists only the allowed context: design metadata.
5. If an exact installed build is authorized, preserve a rollback app, verify app/service hashes,
   run the launcher journey against its exact PID, and prove state hash/modes unchanged.
6. Treat clean-Mac behavior, physical VoiceOver, login item, manual drag interaction, Gatekeeper,
   Developer ID, notarization, binary distribution, and LinkedIn publication as separate gates.

A failed command is evidence to record, not permission to weaken a contract or make an installed
claim.
