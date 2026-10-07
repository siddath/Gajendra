# Gajendra launch media

This directory contains the public, privacy-safe media package for the Gajendra source launch. The
primary screenshots were freshly captured from the 0.4.0 SwiftUI views on October 7, 2026; the hero composites one of those renders over a
text-free generated background.

## Current assets

| Asset | Kind | Dimensions | SHA-256 |
| --- | --- | ---: | --- |
| `gajendra-hero.png` | Screenshot-led GitHub/LinkedIn hero | 1536×1024 | `0a0da4a8e0cf85ab242b1f93ecb634d25dddf812f89bf41b68ee38a40bc57736` |
| `gajendra-launch-overview.png` | Real SwiftUI overview render | 1520×1360 | `8c120b08f434e587f1068608d352cb61c35601fc5b50c67740ef1d73cbc71b00` |
| `gajendra-launch-ready-for-review.png` | Real SwiftUI review render | 1520×1360 | `63d4f4f64ba955c345ab5fc3fba6ca1943db0c20e38072a7b00359e2ee72367a` |
| `gajendra-launch-search.png` | Real SwiftUI search render | 1320×1220 | `1bde2c62140db0373e99fd753b0cf64414c912ad0997a252264151a11ad8613c` |
| `gajendra-launch-queue-editing.png` | Real SwiftUI edit-mode render | 1320×1220 | `cad48976deda14d09f27f3242a0183414bae556f92b96075398bccfcf97dae21` |
| `gajendra-launch-organizer.png` | Real SwiftUI Organizer render | 1640×1960 | `3ebe8aab2db6ecff5ba3df628f8fc5c58e21abc5c7b285d0bf80e434c023c0cf` |
| `gajendra-hero-background.png` | Text-free generated backdrop | 1536×1024 | `cdf7dd1d623801b3a6ef144c2dbae49d34277df1a1a4cabe4053c8a6f4566bd1` |
| `gajendra-linkedin-ready-review-v2.png` | Ready acknowledgement LinkedIn hero | 1536×1024 | `d0e109484dce2a3bd05841bfb16d0c2ce8f391191ddef0d491248150a68a969c` |
| `gajendra-ready-review-hero-background-v2.png` | Text-free Ready acknowledgement backdrop | 1536×1024 | `cdf7dd1d623801b3a6ef144c2dbae49d34277df1a1a4cabe4053c8a6f4566bd1` |

`gajendra-linkedin-synthetic.png` is the earlier all-synthetic concept image. It is retained as
design history, but it is no longer the primary product visual.

## What is real and what is synthetic

- The app surfaces, layout, typography, source badges, status disclosures, queue editing,
  search, and Organizer are rendered by the real `GajendraKit` SwiftUI views. Preview mode uses
  static labels for native-only menus; the History segmented picker shows its selected value
  because SwiftUI ImageRenderer cannot rasterize that AppKit control. Real interface captures
  below retain the actual controls.
- The six task titles, projects, IDs, October 7 fixture timestamps, and statuses are a dedicated public fixture. They
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

> Background only, 1536×1024: quiet focus beacon; warm ivory and pale stone with fine paper
> grain; abstract folded lotus-petal relief at bottom right and a quiet muted brass arc along the
> bottom. Leave clean space at left for copy and a pale neutral area behind the real UI. Soft
> daylight and shallow shadows. No glossy blue glass, busy patterns, cards, text, logos, elephant,
> app UI, devices, people or watermark.

The built-in image tool generated only the background. Both hero variants now share this same
backdrop and composite current, unmodified app output over it. The dark **Focus Deck** appearance
and gold emphasis come from the product's existing theme; search, queue editing and Organizer
also demonstrate the native light style. Product UI is never generatively redrawn.

`GAJENDRA_HERO_VARIANT=review node scripts/render-launch-hero.mjs` refreshes the review variant.
The older concept image is retained as historical design material, not as a current screenshot.


## Publication boundary

These assets are approved only as repository artifacts and a proposed social-post attachment. They
do not prove a signed/notarized binary, provider adoption, clean-Mac installation, or LinkedIn
publication. Publishing the post remains a manual owner decision.

## Fresh interface captures — 2026-10-07

The following screenshots were captured through CUA from the current 0.4.0 build after the
dependency PRs merged. Native data came only from a temporary copy of the synthetic UI interaction
fixtures and a disposable preferences suite. The browser used the bundled plugin at the local
`?fixture=1` preview route. It is a real plugin UI capture, not evidence of an embedded Codex host.
Both surfaces were checked for review acknowledgement and Undo before closing the isolated sessions.
The native fixture's old response deliberately remains reviewable; age does not dismiss it.

| Capture | SHA-256 |
| --- | --- |
| `gajendra-native-040.png` | `7efb092482b6fcf735afd2ef14f611967184cfdf81420c87856f4f1b415c66ca` |
| `gajendra-plugin-040.jpg` | `4169253ce192d1bff7f210b00711d1c1c75422e3e2f4e922eddfa7139647df8b` |
