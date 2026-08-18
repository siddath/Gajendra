# Implementation plan

The current delivery order is constrained by one source authority and one evidence ledger.

1. **Integrity and source safety:** revision/CAS/idempotency, atomic move-before, strict store
   recovery, isolated state, bounded source collection, safe destination schemes, and A4 enrichment
   privacy.
2. **Native source:** explicit Login choice, accessibility/interaction contracts, source build and
   bundle runtime requirements. The native source has 2026-08-18 self-test, build, isolated
   real-window launcher, validator, bundle-readiness, and exact-installed launcher receipts;
   remaining physical/clean-Mac proof stays separately gated.
3. **Canon and validation:** the current docs and companion validator reflect the frozen source
   contract; source evidence remains distinct from installed or release claims and must be reopened
   if its inputs change.
4. **Integrated local proof:** the check/E2E/companion/UI/validator/bundle gauntlet has a passing
   current candidate receipt; preserve it and rerun if its inputs change. It does not close
   clean-Mac, remaining physical, signing, notarization, binary distribution, or LinkedIn gates.
5. **External decisions:** require separate authorization for Developer ID, notarization,
   binary distribution, clean-Mac testing, LinkedIn publication, and every mobile D01–D07/D11
   decision.

Mobile remains E0 documentation-only. No relay, listener, mobile client, credential, dependency, or
branch is created by this plan.
