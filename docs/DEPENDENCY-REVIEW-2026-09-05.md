# Dependency PR reconciliation — 2026-09-05

Owner: Sid. Decision: merge the active dependency proposals after compatibility and installed-app validation in this session. Stop when no Gajendra PR remains open and the final source, bundles, and installation agree. Provider data and saved Gajendra priorities remain outside the dependency change.

## Reviewed updates

- [PR #29](https://github.com/siddath/Gajendra/pull/29): Zod 4.4.3 → 4.5.4, including regenerated committed UI/server artifacts. Merged as `f3684fc` after 115 tests, 17 browser journeys, zero production vulnerabilities, and both jobs in [fresh CI](https://github.com/siddath/Gajendra/actions/runs/33982997934) passed on `af9b4d7`.
- [PR #23](https://github.com/siddath/Gajendra/pull/23): axe-core Playwright 4.13.0, Node types 26.4.1, esbuild 0.28.2, TypeScript 7.0.2, Vite 8.2.2, and Vitest 4.1.11. Reconciled with current main and PR #29, retaining the earlier Running, interruption, focus, and performance fixes.

## Compatibility corrections

1. TypeScript 7 rejected the side-effect CSS import (`TS2882`). Added the standard `vite/client` types instead of disabling import validation. [Vite client types](https://vite.dev/guide/features.html#client-types) document this configuration.
2. Vitest 4 no longer installed `vite-node`, which the source benchmark and two process-isolation tests had implicitly consumed. Added explicit development dependency `tsx` 4.23.13. Both paths use `node --import tsx`; child tests resolve the loader explicitly and keep the actual worker as the observed process. An initial CLI-wrapper trial hit a crash-recovery `StoreBusyError`; the direct-loader version passes without changing store behavior, timeouts, or assertions.
3. Added the benchmark to Linux CI so future runner removal fails visibly.
4. Corrected both package engine contracts and source-build documentation to Vite's installed requirement, `^20.19.0 || >=22.12.0`. The native bundle continues to carry Node 24.19.0.
5. Rebuilt the committed artifacts with the upgraded compiler/bundler. The source schema/store/security contracts are unchanged.

The lock retains a compatible Vite 7 peer resolution for Vitest/singlefile alongside the workspace Vite 8 build. Singlefile's Vite-version detection consequently emits an `inlineDynamicImports` deprecation warning; the option remains accepted and the inline artifact is validated. A general dedupe preview also proposed unrelated production dependency changes, so it was not applied. This warning is not a failed build or an application-performance claim.

## Verification

The corrected development candidate `5b4b085` passes `npm run check`: eight test files, 115 tests, typechecking, release/script checks, production builds, and plugin validation. The repaired source benchmark validates exactly 200 selected records from 1,000 candidates across 20 projects for each adapter, over seven measured runs. [Aggregate receipt](../evidence/performance/2026-09-05-dependency-source-benchmark.json) contains no private task identities. This is a runner/functionality check, not a controlled before/after product speed comparison.

Both hosted jobs passed on implementation commit `5b4b085`: [CI run 33983207142](https://github.com/siddath/Gajendra/actions/runs/33983207142), Linux plugin 1m31s and macOS companion 3m41s. Linux includes a clean `npm ci`, TypeScript check, 115 tests, benchmark, 17 browser journeys, and production audit.

Native interaction and synthetic full-screen tests passed. The full UI sample measured 62/81/83 ms prewarmed/cold/warm; the widget-only sample measured 45/84/93 ms with no AttributeGraph cycles, within the existing 200 ms local budget. The system accessibility tree still does not expose the menu-bar status item; that specific presentation remains a manual check. These automation results do not claim physical VoiceOver, clean-Mac, Developer ID, notarization, or binary distribution readiness.

All 21 local gauntlet gates passed from 18:09:15 to 18:16:52 UTC on implementation `5b4b085`: 115 source tests plus five complete repeats, 17 primary browser journeys plus 85 repeated journeys, live MCP, native checks, and zero production vulnerabilities. [Machine-readable receipt](../evidence/gauntlet/report.json). Regenerated synthetic screenshots were visually inspected and incidental raster differences were not committed. Later changes are documentation/evidence only.

The installed plugin passes all nine artifact comparisons against source. The native application matches the tested build's executable, bundled server, and Node runtime; strict ad-hoc signature verification passes. The installed app opens its priority card through the launcher in the real interface. Saved priorities remain byte-identical to the pre-install backup with directory/file modes 0700/0600. A separately verified previous-app rollback and state backup are retained locally; no live titles, identities, or state files are published.

Final server SHA-256: `22c11e96e332669122552d401871116e2912c9abc0c0a6aef62d5dc0663a5462`.
Final inline UI SHA-256: `5db80e69bc7aef36ede79724e6f6c366c571171599045764b0eebfe4e0f501fe`.

Final PR-head and merged-main CI receipts are attached to PR #23 after they complete. Their existence must be verified there; the local gauntlet does not stand in for hosted CI.
