# Engraving upstream and asset record

## Pinned source

- Project: [lemomo-ai/lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar), Copyright (c) 2026 LemoLab.
- Revision: [`508848acb2b4930c4041fef4d594120da1525bff`](https://github.com/lemomo-ai/lemo-opuscar/tree/508848acb2b4930c4041fef4d594120da1525bff).
- License: [upstream MIT LICENSE at that revision](https://github.com/lemomo-ai/lemo-opuscar/blob/508848acb2b4930c4041fef4d594120da1525bff/LICENSE). The complete, unchanged notice is retained in [`LICENSE-THIRDPARTY/MIT-lemo-opuscar.txt`](../../LICENSE-THIRDPARTY/MIT-lemo-opuscar.txt).
- Verification date: 2026-10-19. Files were retrieved from the pinned revision through GitHub's file API, decoded from its base64 response, and compared byte for byte with this repository. The returned Git blob IDs also matched the decoded bytes. This is a pinned-revision check, not a comparison against a moving `main` branch.

| Local file | Pinned upstream file | Treatment |
|---|---|---|
| `engine/burin.js` | [`styles/engraving/demo/engine/burin.js`](https://github.com/lemomo-ai/lemo-opuscar/blob/508848acb2b4930c4041fef4d594120da1525bff/styles/engraving/demo/engine/burin.js) | Unmodified, byte-identical vendor copy (33,064 bytes) |
| `engine/index.js` | [`styles/engraving/demo/engine/index.js`](https://github.com/lemomo-ai/lemo-opuscar/blob/508848acb2b4930c4041fef4d594120da1525bff/styles/engraving/demo/engine/index.js) | Adapted public entry: retains `B` and `engraveShape`; removes exports of the unported plate, wash and copper modules; adds attribution and reformats the entry |
| `../../LICENSE-THIRDPARTY/MIT-lemo-opuscar.txt` | `LICENSE` | Unmodified, byte-identical MIT notice (1,064 bytes) |

Verified upstream SHA-256 values:

```text
0c96d24e39b5ed275816fbaa8de993bc9a2a658d067e680728171150e5352242  styles/engraving/demo/engine/burin.js
127d4c84b3190a6a1a91d441601176d1037ffe159674b5b4a1a101d6a8b4e66d  styles/engraving/demo/engine/index.js
14c9ff6f14bfb2391e74fedb01c256891d2a3bba1c2acf5789901bdf77e54e33  LICENSE
```

The `index.js` hash above is for the upstream original; the adapted local entry is intentionally different. The upstream `burin.js` Git blob ID is `c5797928b363c66fc93b9776a1c6c6267e0c6569`; the license blob ID is `5ba3cce5467fd31494d7e117662de08f477e372a`.

## What is original here

`kit.tsx` supplies the original procedural pear, leaf and stem paths, React/Canvas integration, seeded paper marks, transparent colour layer and absolute-frame timing. `examples/engraving/Scene.tsx` supplies the original Chinese explanation, layout and separately composed landscape/portrait views. These additions use this repository's [MIT license](../../LICENSE).

No upstream bee/specimen artwork, photographs, sample video, audio, fonts or demo composition is imported. `plate.js`, `wash.js`, `copper.js`, the upstream player and its exporter are not included. The transparent wash in this kit is a smaller original implementation; it does not claim all of the upstream hand-colouring behavior. Remotion remains responsible for frame timing and export.

## Fonts and generated media

The example reuses fonts already bundled in `template/public/fonts/`:

- `NotoSerifSC[wght].ttf` → example `NotoSerifSC.ttf`, with [`LICENSE-NotoSerifSC-OFL.txt`](../../template/public/fonts/LICENSE-NotoSerifSC-OFL.txt).
- `Fraunces[SOFT,WONK,opsz,wght].ttf` → example `Fraunces.ttf`, with [`LICENSE-Fraunces-OFL.txt`](../../template/public/fonts/LICENSE-Fraunces-OFL.txt).

Both notices are SIL Open Font License 1.1. The example preparation script copies the font bytes and their notices; it does not download substitute fonts. Sample frames/posters and videos are renders of this original composition, not upstream artwork. Their render/source hashes belong in the delivery sidecars and sample manifest, not in this upstream code record.

## Redistribution and maintenance

Keep the LemoLab copyright and full MIT permission notice with copies or substantial portions of the borrowed engine, and keep the OFL notices with redistributed fonts. Keep this attribution record with source distributions. A new upstream revision must be reviewed and repinned explicitly; do not silently update the vendor file or replace its hash with a current-branch value. For changed code, retain attribution and state the adaptation rather than claiming byte identity.
