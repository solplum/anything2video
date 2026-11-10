# Early-bloom clipping correction

An independent browser review found a rectangular emerging cobalt patch near the second bloom at frame 90. Both the original librsvg output and the browser renderer showed it, so it was a source defect, not a renderer disagreement.

The wet-edge blur originally used the default object-bounding-box filter region with 15% padding. On a newly born, tiny bloom, that was smaller than the 20-unit stroke plus blur spread. The rectangle was the filter's clipping boundary. The reveal feather also used percentage-based bounds and had the same early-bloom risk.

The correction changes only those two filter opening tags. Both now use `filterUnits="userSpaceOnUse"`, spanning the 1280×720 or 720×1280 scene plus 32 SVG units on every side. Padding exceeds half the wet stroke width plus three blur standard deviations: 10 + 3×4.5 = 23.5. It also exceeds three times the reveal blur's standard deviation: 3×8 = 24.

## Regression evidence

- All 840 landscape/portrait frame SVG strings match their pre-fix hashes after normalizing only those two filter opening tags. Geometry, bloom timing, contours, pigment, opacity, typography and layout did not change.
- `node --test tests/porcelain-reveal*.test.mjs`: 17 tests pass, including absolute filter bounds and the 840-frame comparison.
- `node examples/porcelain-reveal/verify-blur.mjs`: 16 sample-frame pairs across both layouts compare the 32-unit region with a generous 128-unit region. Their rendered PNGs are byte-identical, checking that no residual region clipping appears in early-bloom windows.
- Landscape and portrait final-frame PNGs remain byte-identical to the pre-fix outputs. Their existing posters are unchanged.
- `blur-padding-proof.json` records source and PNG hashes. `frame90-before-after.png` shows the previously square patch becoming a soft irregular bloom.

The pre-fix source SHA was `fbfd1cd65fabb93e38915c0bfeece1fa114691f1166e6946d1615b091ee818bd`. The fixed source SHA is `9f6ca8aa4de11ec2fa1be85788a5cc9e6f874123a8ed9c755c44fc4f55075821`.

Historical verification is retained under evidence-history. The canonical sample MP4s and render-evidence.json are regenerated from the fixed source. Independent browser/web-render verification is a separate supplement; this report does not claim native Remotion CLI success or final artistic approval.
