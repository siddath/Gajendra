# Release gauntlet

Run from the repository root:

```bash
npm run gauntlet
```

The runner is fail-fast. Any failed hard gate stops the run and writes the partial receipt to `evidence/gauntlet/report.json`.

## Gates

1. Repository script syntax.
2. TypeScript static checking.
3. Domain, bounded-context, store-privacy, source-adapter, and MCP tests.
4. Deterministic web/server build.
5. Plugin manifest, license, lotus, and artifact validation.
6. Live MCP/real Codex app-server snapshot.
7. Swift model, queue, placement, hover, refresh, and clean-launch/existing-user source-onboarding self-test.
8. Signed native app build.
9. Native bundle/service/state/privacy validation, including first-launch setup, replay paths, provider-boundary copy, source toggles, and accessibility identifiers.
10. Browser user journeys, context assignment, accessibility, light/dark, reduced motion, forced colors, compact layout, and no-overlap controls.
11. Five repeated unit suites.
12. Five repeated browser journeys.
13. Final post-UI artifact presence/manifest validation.
14. Production dependency audit at high severity.

## Proof boundaries

- A green Codex live probe proves only Codex on the current machine.
- Claude live proof requires enabling the source and observing a `ready` status without emitting private metadata.
- Cursor live proof requires a locally installed `cursor-agent`; fixture/parser proof is labeled separately.
- Synthetic screenshots prove rendering contracts, not subjective adoption.
- Isolated onboarding state proves launch policy; the installed Accessibility receipt proves real window timing, source health, toggles, completion, and replay.
- Ad-hoc signature verification is not Developer ID/notarization proof.
- A local report is not hosted CI or a public release.

The report contains gate IDs, trial numbers, status, duration, and timestamps. It intentionally excludes thread titles, IDs, prompts, transcripts, provider output, and private absolute paths.
