# Contributing

Contributions are welcome. Fork [siddath/Gajendra](https://github.com/siddath/Gajendra), create a focused branch, and open a pull request against `main`.

1. Preserve the single global NOW invariant (NOW may be explicitly cleared) and canonical `source:thread` IDs.
2. Keep provider sessions in their owning apps. The authoritative priority store must exclude provider text. Separate bounded, private, disposable metadata caches may retain titles/project labels; never cache transcripts, prompts, credentials or executable commands.
3. New adapters must be explicit, bounded, independently failing, and documented with an official discovery/resume contract.
4. Keep Claude and Grok metadata discovery opt-in and generic command authority structured and user-configured.
5. Keep the standard MCP App and native utility working without Codex’s experimental global route.
6. Add observable behavior tests and product evals for changed outcomes; run `npm run gauntlet` before proposing a release.
7. Do not commit private conversations, absolute private paths, credentials, proprietary host code, or copied reference artwork.

Fast loop:

```bash
npm ci
npm run check
npm run evals
npm run companion:test
npm run companion:preview
```

Use the [product eval development loop](docs/EVALS.md): state the user intent and acceptance
criteria, retain a baseline failure where applicable, implement the change, and include a
sanitized eval report with the tested revision. Do not replace acceptance criteria with a score
or a hardware-specific latency threshold.

For user-interface changes, also run the observable journey for the surface you changed. Native
launcher, card, Organizer, Search, and pointer behavior use `npm run companion:ui-test` on a
logged-in Mac with Accessibility permission; browser behavior uses `npm run test:e2e`.

Release loop:

```bash
npm run gauntlet
npm run --silent host:preflight
```

If the execution environment restricts native automation, use `npm run gauntlet -- --non-native-ui`
and report its **partial** result. Record permitted real-interface checks separately; skipped gates
are not passes.

For a source adapter contribution, include:

- a primary vendor link for discovery and resume behavior;
- parser fixtures containing synthetic metadata only;
- timeout/size/count limits;
- failure-state behavior;
- documentation of any executable authority.

Use focused commits. Do not report hosted CI, a notarized download, or live provider compatibility until the matching receipt exists.
