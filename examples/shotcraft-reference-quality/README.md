# Bounded reference-quality comparison

Two **silent, draft** controls, each 10 seconds at 1920×1080 / 30 fps:
**0–6 s gradient; 6–10 s gap dial**. They use the actual reference components, not
a separately reimplemented demo. `Sequence` reads the storyboard and provides each
reference its own local frame and duration. No overlay, branding, palette, timing,
new asset or soundtrack is added. This is not the new upstream redesign.

## Prepare and test

From the skill checkout, choose two new directories outside it:

```sh
node examples/shotcraft-reference-quality/prepare.mjs /tmp/shotcraft-before before
node examples/shotcraft-reference-quality/prepare.mjs /tmp/shotcraft-after after
node scripts/check-plan.mjs /tmp/shotcraft-before
node scripts/check-plan.mjs /tmp/shotcraft-after
node --test tests/shotcraft-reference-quality.test.mjs
```

The before sources are frozen **exact** files from local
`be7513c4098f93969683a5baa3796347cc8736b4`; preparation verifies their SHA-256.
After sources are copied directly from `gallery/demos-ref`. Both get identical
fixtures, pinned package/lock files, storyboard and wrapper. Source hashes and
licenses are retained in each project. Preparation does not install, render,
approve anything or overwrite existing projects.

In an already authorized rendering environment, use the normal dependency setup,
then run both projects' `npm run typecheck` and `node check-components.mjs`.
The latter tests actual component output with the **installed Remotion spring**,
mocking only hooks/context, not spring math. Before is expected to report the two
known defects; after rejects them. This is structural evidence, not browser CSS
parsing or playback. Optional 24/60 fps trajectories test the gap geometry only;
the comparison film remains the original 30-fps timing.

## Render through the existing route only

Use the approved render worker and ordinary setup described in
`reference/environment-capabilities.md`; there is no alternate browser launch,
codec, sandbox flag or renderer in this example. For each external project:

```sh
node /path/to/anything2video/scripts/render.mjs /tmp/shotcraft-after preview 10
# Or the existing hash-bound review pack, covering both full actions plus 2 stills:
node /path/to/anything2video/scripts/review-pack.mjs /tmp/shotcraft-after plan qc/reference-request.json
node /path/to/anything2video/scripts/review-pack.mjs /tmp/shotcraft-after render qc/reference-request.json
```

Replace `after` with `before` for the control. Do not render the same target twice
concurrently, silently overwrite media, bypass the renderer gate or treat the
known-bad control as a production-ready video.

## Required review and expected failure controls

- **Gradient**: compare local frames 54–70 (first crossfade), 90 (radial body),
  112–129 (second crossfade), plus each complete 180-frame playback. Before's
  `circle <percentage>` is invalid; after resolves 45–85% of 480 to 216–408px.
  Check continuous field motion, not only that the CSS string now parses.
- **Gap**: compare local frames 66–119, especially frame 79 (global **260**,
  1-based). Before physical gap is about **−5.48px**, after **4.13px**, with the
  same spring timing. Check all 4 measurement spans and badge centres against
  actual block edges. Two-pixel readout rounding is intentional (≤1px error).
  Below-rest rebound must remain visible and settle naturally; no clipped zero-gap
  plateau. Also watch the whole 120-frame entrance/grow/hold/return context.
- Preserve the original style/art/copy. The 0.45 branch is position-continuous but
  changes slope at the rest crossing; numeric tests cannot judge its feel.
- Record exact media/source hashes and real playback ranges. Stills, source checks,
  mock component output and successful rendering do **not** establish better
  aesthetics, motion acceptance, or completed listening. Leave those reviews
  `not_performed` until actually done; intentionally silent does not mean audited.

The original imported demo code, fixtures and bounded adaptations are Apache-2.0;
see `gallery/demos-ref/MODIFICATIONS.md` and the packaged license. The study wrapper,
preparation and tests are local MIT code. No upstream video/audio/brand asset is used.
