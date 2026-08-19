# Gajendra launch media

This directory contains the public, privacy-safe media package for the Gajendra source launch. The
primary screenshots are actual SwiftUI renders; the hero composites one of those renders over a
text-free generated background.

## Current assets

| Asset | Kind | Dimensions | SHA-256 |
| --- | --- | ---: | --- |
| `gajendra-hero.png` | Screenshot-led GitHub/LinkedIn hero | 1536×1024 | `f16b64742a6ece5735a69c59533586af7d1ee66b890568a144ad178cc2c66531` |
| `gajendra-launch-overview.png` | Real SwiftUI overview render | 1520×1360 | `f4932fe4a978e0968f8a45140b70e7c8e6061eac79278b5c46762ca00fd656e7` |
| `gajendra-launch-ready-for-review.png` | Real SwiftUI review render | 1320×1220 | `1e1cf20153637d465cedd07a5047b60ba0b52720e8d0f5a1dfe28a317095b345` |
| `gajendra-launch-search.png` | Real SwiftUI search render | 1320×1220 | `22089595c30d138b6c1ca9eddfd485ba982adb7e904a61827b86bf0e083209f7` |
| `gajendra-launch-queue-editing.png` | Real SwiftUI edit-mode render | 1320×1220 | `79803828fb7246ee596ae5c12f6deea7e66a4174acf82d656d5e812ff3786d17` |
| `gajendra-launch-organizer.png` | Real SwiftUI Organizer render | 1240×1800 | `be35c7f17359b4941b4b6e298ac46b43405a5200573d715a7e3010a863165330` |
| `gajendra-hero-background.png` | Text-free generated backdrop | 1536×1024 | `7607d5be2faa69ee1213ba5d370d002ec3cd51f392a79a7a0c38355021587c07` |

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

## Publication boundary

These assets are approved only as repository artifacts and a proposed social-post attachment. They
do not prove a signed/notarized binary, provider adoption, clean-Mac installation, or LinkedIn
publication. Publishing the post remains a manual owner decision.
