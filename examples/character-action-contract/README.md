# Character action contract: gardener and flowerpot

Original synthetic regression story, **not a selected user story or factual adaptation**. A recognizable paper-cut gardener approaches a shaded flowerpot, reaches, pushes its wheeled base into sunlight, releases, and relaxes as its bud opens. Silent, fixed camera, 8 seconds, 1280×720, 30 fps. No fetched/generated media assets, fonts, models, or soundtrack.

## Authority and local edit

`storyboard.json` is the baseline declaration; `storyboard.late-contact.json` moves all five action phases 15 frames later. Both render entry points derive contact time from the declared contact frame, not independent constants. `timing.ts` provides the pure frame clock and computes the remaining relative phase boundaries; `verify.mjs` rejects disagreement between every declared phase and that clock. `timing.json` is generated documentation, not another editable authority. Storyboard ranges are global **1-based inclusive**; renderer inputs are 0-based. The character approach, background, camera, palette, duration, and silence stay unchanged. The later variant finishes within the same shot.

Contact palm `(potX-70,450)` equals the prop edge throughout push/support. The pot stays still before contact and after support. Wheel angle derives from translation. Alternating swing windows explicitly hold stance feet at fixed world coordinates; the flower opens only after the pot reaches sunlight. Frame evaluation is independent of render order, wall clock, and randomness.

## Reproduce

Use official Remotion 4.0.507 dependencies in an **external** workspace, Node, system Chromium, ffmpeg, and system librsvg/cairo. The renderer script copies the exact owned scene plus existing `common/riso` into the external workspace; it does not change shared Root/config.

```sh
examples/character-action-contract/render.sh /absolute/external/workspace
node examples/character-action-contract/verify.mjs /absolute/external/workspace
```

Native Chromium rendering may require a runtime that permits browser local sockets. In the current environment it is **blocked**, and escalation failed before execution. Do not claim a successful Remotion render from bundle/type checks.

Permitted offline fallback (uses **the same exported `CharacterActionFrame` component**, ReactDOMServer → existing system librsvg/cairo → ffmpeg, not a forked reimplementation):

```sh
node examples/character-action-contract/render-component-proof.mjs /absolute/external/workspace
```

Outputs are named **component-frame proof**, not native Remotion proof. `verification.json` records actual execution/visual-review evidence and limitations when available. The pure clock checks cover deterministic state, world-locked stance feet, palm/prop equality, unchanged pre-action states, local retiming, and invalid inputs. They are not subjective quality scores.

## Design and license

New vector artwork and timing code are contributed under the repository MIT license. Reuses the repository's MIT `RisoPaper` for static paper fibers. Design principles inspected: grain-flat's pose interpolation/foot-pivot discipline and riso-story's pure frame evaluation, recognizable silhouettes, and causal prop changes. No copied cat coordinates or external artwork. Stylized planted-foot walk is not a full biomechanical solver; the pot's wheels and flower response are intentionally simplified. Native Remotion/browser pixel parity remains unverified while that path is blocked.
