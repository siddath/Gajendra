# Gajendra launch media

This directory contains the public, privacy-safe media package for the Gajendra source launch. The
primary screenshots are actual SwiftUI renders; the hero composites one of those renders over a
text-free generated background.

## Current assets

| Asset | Kind | Dimensions | SHA-256 |
| --- | --- | ---: | --- |
| `gajendra-hero.png` | Screenshot-led GitHub/LinkedIn hero | 1536×1024 | `d8bbf2b0aa936cdedd418e0cfb198fbd023c6eba4be4e962eb6227f12cb3f6dc` |
| `gajendra-launch-overview.png` | Real SwiftUI overview render | 1520×1360 | `447328d26950f12fcf963b4fcf282f07bb73f1eef83f3263aaa79c9e4c18052e` |
| `gajendra-launch-ready-for-review.png` | Real SwiftUI review render | 1320×1220 | `2c67e87d00d9fe6eeed069e6ff85ae3787e5b2a2c1205c8d330195866dbec7f7` |
| `gajendra-launch-search.png` | Real SwiftUI search render | 1320×1220 | `2801a6c3e68448231549938bed80a4ae2a8a82783a6d835327ab31fcf402b9e4` |
| `gajendra-launch-queue-editing.png` | Real SwiftUI edit-mode render | 1320×1220 | `2c71ce09b815abdf1552197405877e1e283bb14b43d5331075e4ca243f61ae6d` |
| `gajendra-launch-organizer.png` | Real SwiftUI Organizer render | 1240×1800 | `33b70a937f26d65d74ee6f220e10fb81b045eaadfd0257df80bf93cc3e87d180` |
| `gajendra-hero-background.png` | Text-free generated backdrop | 1536×1024 | `7607d5be2faa69ee1213ba5d370d002ec3cd51f392a79a7a0c38355021587c07` |

`gajendra-linkedin-synthetic.png` is the earlier all-synthetic concept image. It is retained as
design history, but it is no longer the primary product visual.

## What is real and what is synthetic

- The app surfaces, layout, typography, controls, source badges, status disclosures, queue editing,
  search, and Organizer are rendered by the real `GajendraKit` SwiftUI views.
- The six task titles, projects, IDs, timestamps, and statuses are a dedicated public fixture. They
  describe generic coding, writing, setup, release, and review work inspired by the shape of Codex
  and Claude workflows—not by copying any private thread.
- Codex and Claude are used for the built-in metadata examples. Ready for Review is supplied by an
  explicitly labeled **Demo Review Feed**, because the built-in adapters do not currently emit that
  signal.
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
