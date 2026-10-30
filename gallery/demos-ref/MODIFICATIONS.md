# Local reference fixes — 2026-10-30

These are bounded modifications to the imported **video-shotcraft** references,
not a full upstream refresh or a claim of equivalent visual quality. The original
card text, palette, type, copy, timing and artwork remain unchanged.

Compared directly with upstream commit
[`1266a3ec4831289c4d893d42dd5102723658039a`](https://github.com/Vincentwei1021/video-shotcraft/tree/1266a3ec4831289c4d893d42dd5102723658039a):

- [GradientTransition.tsx](https://github.com/Vincentwei1021/video-shotcraft/blob/1266a3ec4831289c4d893d42dd5102723658039a/demos/transition/gradient-transition/GradientTransition.tsx):
  resolve the radius against the 480px design width, as upstream does. Our existing
  45–85% range becomes **216–408 design pixels**, not percentages in CSS `circle`.
  The same design width is explicit on `DesignStage`, so output scaling happens
  once. The old radial layer was invalid CSS, not a deliberate dark hold.
- [AutolayoutGapDial.tsx](https://github.com/Vincentwei1021/video-shotcraft/blob/1266a3ec4831289c4d893d42dd5102723658039a/demos/interaction/autolayout-gap-dial/AutolayoutGapDial.tsx):
  adopt upstream's **0.45 overshoot compression** after spring progress exceeds 1;
  retain our 12→110 range and original 14/52/66-frame timing. Bound the resulting
  physical gap to 0..110 before deriving **all** positions, measurement widths,
  badge centres and rounded readouts. The current spring stays above 4px, so the
  defensive floor does not create a flat zero-gap hold. Do not clamp only the badge.

The shared `ReferenceGeometry.mjs` contains these two testable calculations, with
TypeScript declarations alongside. No new dependency or renderer is introduced.
CSS grammar reference: [CSS Images 3, radial gradients](https://www.w3.org/TR/css-images-3/#radial-gradients).

The upstream redesign also changes typography, palette, staging, anticipation,
motion blur and holds. Those choices are **not** imported here. A source comparison
and numeric checks cannot establish better motion or aesthetics: the
[before/after study](../../examples/shotcraft-reference-quality/README.md) requires
normal-speed playback through the existing render/review workflow.

## License and provenance

The existing references and these adapted calculations remain **Apache-2.0**;
retain [the license](../../LICENSE-THIRDPARTY/APACHE-2.0-video-shotcraft.txt) and the
original upstream attribution in [gallery/README.md](../README.md). Modified files
carry prominent modification notices. No upstream video, brand mark, external
font, audio or newly redesigned artwork is copied. Frozen before controls in the
study are exact local `be7513c4098f93969683a5baa3796347cc8736b4` copies, with their
hashes recorded by the preparation script; they are intentionally broken controls,
not production examples.
