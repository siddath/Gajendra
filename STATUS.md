# Status

**Product:** Gajendra — One clear focus across your AI tools.

**Promise:** One NOW. One short queue. One click back to the exact thread.

**Reconciled:** 2026-08-18

**Public state:** source is public on `main`; no binary release is claimed.

**Last merged implementation baseline:** `b359ab61c730ce7c8ee5e282c154ecfdfdff001e`

**Hosted baseline receipt:** [CI run 32148617813](https://github.com/siddath/Gajendra/actions/runs/32148617813) passed both jobs.

PRs [#12](https://github.com/siddath/Gajendra/pull/12),
[#13](https://github.com/siddath/Gajendra/pull/13),
[#14](https://github.com/siddath/Gajendra/pull/14), and
[#15](https://github.com/siddath/Gajendra/pull/15) are merged. Hosted proof remains commit-scoped;
every later revision must pass its own pull-request and merged-main checks before it inherits a
public green claim.

## Current user-facing state

| Area | Current source/local state | Boundary that remains open |
| --- | --- | --- |
| Focus surface | One NOW, ordered Focus and Important queues, compact overflow to Organizer, bounded context, search, and direct Open routes are implemented. | Physical installed-device journeys remain separate evidence. |
| Running | Explicit provider-reported activity appears across every priority lane without changing priority. | Do not infer activity from age or resumability. |
| Ready for Review | A validated configured catalog can provide a live-only review signal with Review/Task destinations and Running precedence. | Built-in providers do not emit or infer review readiness; remote credentials/network adapters do not exist. |
| Launcher reopen | The real 60×60 macOS launcher passes stationary click, 2-pixel click, move/edit recovery, accessibility press, and outer-edge target automation. | This is isolated local automation, not every physical pointer or VoiceOver journey. |
| Sources and privacy | Codex, Claude Code, Cursor, and Grok adapters are explicit and bounded. Gajendra persists its own priority metadata, not titles, prompts, transcripts, credentials, review content, or provider databases. | Installed-provider and clean-account proof remain separate. |
| Native app | macOS 13.5 source build, bundled Node v24.19.0, notices, service parity, and strict ad-hoc codesign verification pass locally. | Developer ID, notarization, stapling, Gatekeeper, clean-Mac, and distribution are not complete. |
| Mobile | A documentation-only transport/security plan exists. | No listener, relay, mobile app, credential, signing, or store submission exists. |

## Public launch package

- The README now leads with the product problem, real features, a short source-build setup, daily
  usability, privacy boundaries, and a [detailed user guide](docs/USER_GUIDE.md).
- Five high-resolution product screenshots are rendered from the real SwiftUI views with a dedicated
  six-task synthetic Codex/Claude-style fixture.
- The primary [hero image](evidence/launch/gajendra-hero.png) uses the real overview screenshot over
  a text-free generated backdrop and visibly labels the data synthetic.
- The [launch media receipt](evidence/launch/README.md) records dimensions, hashes, generation
  boundaries, reproduction commands, and privacy validation.
- The [concise LinkedIn draft](worksheets/GAJENDRA_LINKEDIN_POST_DRAFT.md) recommends Wednesday,
  2026-08-19 at 16:00 IST as a first timing experiment. It is not published.

## Current local receipts

The current launch-media/docs revision passed locally on 2026-08-18:

- `npm run launch:assets` — real SwiftUI screenshot suite and screenshot-led hero regenerated.
- `npm run validate:launch-assets` — **7/7** expected privacy-safe assets validated.
- `npm run check` — scripts, release-readiness regressions, TypeScript, **83/83** Vitest tests,
  plugin build, and plugin validation passed.
- `npm run test:e2e` — **17/17** browser journeys passed.
- `npm run companion:test` — native self-test passed.
- `npm run companion:build` — ad-hoc app with bundled runtime built and strict verification passed.
- `npm run companion:ui-test` — stationary reopen, 2-pixel reopen, move/edit recovery, real macOS
  accessibility press, and outer-edge target all passed.
- `npm run companion:validate` and `npm run companion:bundle-readiness` passed; readiness reported
  `distributionReady:false` and ad-hoc signing.
- `npm run gauntlet` — **19** gate receipts passed, including **85/85** repeated browser journeys,
  five repeated unit runs, live MCP, native, bundle, final-artifact, and dependency-audit gates.

These are local receipts and do not substitute for commit-scoped GitHub checks. A public green claim
belongs only to a revision whose pull-request and merged-main CI are both green. The receipts do not
close installed, physical accessibility, signed distribution, or publication gates.

## Open gates

- Clean-Mac installation and independent offline-path proof.
- Physical VoiceOver, drag, keyboard/system-toggle, and login-item receipts.
- Developer ID signing, notarization, stapling, Gatekeeper, archive parity, and distribution proof.
- Manual owner approval and publication of the LinkedIn post and image.
- Mobile D01–D07 and D11 approvals before any relay or application implementation.

See the [execution worksheet](worksheets/2026-08-18-gajendra-release-brand-mobile-execution.md) and
[release checklist](docs/RELEASE_CHECKLIST.md) for the complete gate structure.
