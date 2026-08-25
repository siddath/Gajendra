# Gajendra launch media

This directory contains the public, privacy-safe media package for the Gajendra source launch. The
primary screenshots are actual SwiftUI renders; the hero composites one of those renders over a
text-free generated background.

## Current assets

| Asset | Kind | Dimensions | SHA-256 |
| --- | --- | ---: | --- |
| `gajendra-hero.png` | Screenshot-led GitHub/LinkedIn hero | 1536×1024 | `37f0a9a8d4d42d11b534b72e2b9fbc1fed76bf9c78829cc63e5388e17459e645` |
| `gajendra-launch-overview.png` | Real SwiftUI overview render | 1520×1360 | `61671c91bc6a97dc27206a796b0cc2931df8078589cac5f80e42f3b76f84dfb9` |
| `gajendra-launch-ready-for-review.png` | Real SwiftUI review render | 1520×1360 | `f3b05dc6e8a2bab174dc47251d1fe92609eae1db41c42a8e3eb6e1958b7f4c5e` |
| `gajendra-launch-search.png` | Real SwiftUI search render | 1320×1220 | `22089595c30d138b6c1ca9eddfd485ba982adb7e904a61827b86bf0e083209f7` |
| `gajendra-launch-queue-editing.png` | Real SwiftUI edit-mode render | 1320×1220 | `2bc0ac2cc913395e86bb4b33d40ebca92b72fe9d7e32f37be8c5505b5f43f14e` |
| `gajendra-launch-organizer.png` | Real SwiftUI Organizer render | 1240×1800 | `dddb47b01a5f94a404f547931903e839a5b96aafa0fe6b1a57fe75df5e2cd89f` |
| `gajendra-hero-background.png` | Text-free generated backdrop | 1536×1024 | `7607d5be2faa69ee1213ba5d370d002ec3cd51f392a79a7a0c38355021587c07` |
| `gajendra-linkedin-ready-review-v2.png` | Ready acknowledgement LinkedIn hero | 1536×1024 | `815d0101ba5704567eb574a97aca5217e710b825ad6494326fa292911780f07b` |
| `gajendra-ready-review-hero-background-v2.png` | Text-free Ready acknowledgement backdrop | 1536×1024 | `f9752bf9e9b617a766cf4b86af55e2a351d84847b6bfeb74d3ce01dd884f5811` |

`gajendra-linkedin-synthetic.png` is the earlier all-synthetic concept image. It is retained as
design history, but it is no longer the primary product visual.

## What is real and what is synthetic

- The app surfaces, layout, typography, controls, source badges, status disclosures, queue editing,
  search, and Organizer are rendered by the real `GajendraKit` SwiftUI views.
- The six task titles, projects, IDs, timestamps, and statuses are a dedicated public fixture. They
  describe generic coding, writing, setup, release, and review work inspired by the shape of Codex
  and Claude workflows—not by copying any private thread.
- Codex and Claude are used for the built-in metadata examples. This deterministic screenshot
  intentionally supplies Ready for Review through the explicitly labeled **Demo Review Feed**. The
  current local Codex app-server may also emit the guarded zero-item terminal-turn signal; Claude
  is never inferred ready.
- The hero's product panel is `gajendra-launch-overview.png` without generative edits. Only the
  abstract background was generated.
- Every public visual says or is documented as **Synthetic demo data**.

## Reproduction

```sh
npm run launch:assets
npm run validate:launch-assets
```

`companion:preview` renders the product views at 2×. `scripts/render-launch-hero.mjs` uses
Playwright to place the overview render, the repository logo, and fixed product copy over the
tracked background. `scripts/validate-launch-assets.mjs` checks expected dimensions, bounded file
sizes, required synthetic fixture values, and the absence of user paths, email addresses, or
non-synthetic URLs in the fixture.

## Generated-background prompt

The built-in image-generation tool created `gajendra-hero-background.png` from this brief:

> Create a restrained, elegant, macOS-inspired abstract product-hero background: soft dawn
> gradient, pale sky blue and warm ivory, a subtle saffron-gold clarity glow, faint frosted-glass
> ambience, and generous space for real screenshots. No text, letters, logos, elephant, app UI,
> devices, people, icons, or watermark.

The background was generated with the built-in image tool, then copied into this project. The hero
composition and every app screenshot are deterministic local renders.

The Ready acknowledgement hero uses `gajendra-ready-review-hero-background-v2.png`, generated with
the built-in image tool from this brief:

> Create a restrained 3:2 macOS-inspired abstract product background showing several translucent
> work streams converging into one calm decision point. Use warm ivory, pale mist blue, one subtle
> emerald clarity glow, and a restrained saffron accent. Leave generous space for deterministic
> product copy and a real screenshot. No text, logos, elephant, app UI, devices, people, icons, or
> watermark.

`GAJENDRA_HERO_VARIANT=review node scripts/render-launch-hero.mjs` composites the current real
SwiftUI Ready for Review render over that generated background. The green acknowledgement control,
orange tray status, labels, and synthetic task data are all deterministic app output rather than
generated interface imagery.

## Publication boundary

These assets are approved only as repository artifacts and a proposed social-post attachment. They
do not prove a signed/notarized binary, provider adoption, clean-Mac installation, or LinkedIn
publication. Publishing the post remains a manual owner decision.
