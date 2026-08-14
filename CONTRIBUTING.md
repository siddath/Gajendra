# Contributing

Contributions are welcome. Fork [siddath/Gajendra](https://github.com/siddath/Gajendra), create a focused branch, and open a pull request against `main`.

1. Preserve the single global NOW invariant and canonical `source:thread` IDs.
2. Keep provider sessions in their owning apps. Do not add a cloud task store or persist live titles/transcripts by default.
3. New adapters must be explicit, bounded, independently failing, and documented with an official discovery/resume contract.
4. Keep Claude and Grok metadata discovery opt-in and generic command authority structured and user-configured.
5. Keep the standard MCP App and native utility working without Codex’s experimental global route.
6. Add observable behavior tests and run `npm run gauntlet` before proposing a release.
7. Do not commit private conversations, absolute private paths, credentials, proprietary host code, or copied reference artwork.

Fast loop:

```bash
npm ci
npm run check
npm run companion:test
npm run companion:preview
```

Release loop:

```bash
npm run gauntlet
npm run --silent host:preflight
```

For a source adapter contribution, include:

- a primary vendor link for discovery and resume behavior;
- parser fixtures containing synthetic metadata only;
- timeout/size/count limits;
- failure-state behavior;
- documentation of any executable authority.

Use focused commits. Do not report hosted CI, a notarized download, or live provider compatibility until the matching receipt exists.
