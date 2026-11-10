# Independent card-conflict cloud QA

Run date: 2026-11-03 UTC. This is a separate QA supplement, not a product-source modification.

## Verified source and runtime

The exact source rendered and exercised interactively was copied from `/workspace/shared/card-conflict-prototype`. `source-hashes.json` records its identity, including scene SHA-256 `8e74f5df182f455f1171abb00749241b8f7eab1dabab85232970fc16d12d6d4c` and preview SHA-256 `ea90f7da501dd19a51e05f793bbe3d8e478a8ac773f105be6c15aeae23852ac7`.

The supported cloud CDP browser opened the local `sites-preview` QA bridge. The exact standalone HTML was assigned to an iframe by an external QA script, preserving its bytes while avoiding the managed preview's live-reload HTML injection into inline SVG strings. This wrapper is QA-only. An initial mobile click immediately after reload raced the wrapper's srcdoc setup; after waiting for and reading the settled DOM, the actual controls worked. No product code was altered to make a check pass.

The isolated TypeScript project used the exact style kit, declaration and supplied Root with strict TypeScript 5.9.3 and existing locked dependencies. `node node_modules/typescript/bin/tsc --noEmit` exited 0. `node --test tests/card-conflict*.test.mjs` passed 27/27 in an independent copy (`tests.log`). These counts cover the geometry source above; later delivery-source tests, if present, are recorded separately.

## Final delivery source bridge

A final reuse-only fix preserves visible excess guard for custom cards. Delivery scene SHA-256 is `36afaf0774e1b71685f399dfdd948226062d25e6c258c6de48c4e76a216bb203`; preview is `aeb95e80b9ed847600bab68cbfbe8623390007d361c23cd9cfed58db910ab831`. The actual web-render source remains the recorded `8e74f5...` snapshot. Independently importing those two separate files and comparing both scenarios × both choices × 480 frames × captions on/off produced **3,840/3,840 byte-identical SVG strings** (`delivery-source-equivalence.json`). No frame was excluded or normalized in this comparison. This is the explicit bridge from the rendered revision to the final built-in scenes, not a claim that the newer source itself was web-rendered. Final delivery source passed **29/29 tests** and strict TypeScript again (`delivery-tests.log`, `delivery-typecheck.log`). The final exact preview was reloaded in the real browser and rush180/299/300 rechecked.

## Actual browser controls and causality

`browser-observations.json` contains readbacks following real control actions, not simulated events. The preview starts paused, playback stops at frame 119 without a selection, and seeking to End cannot bypass that gate. Selecting a card disables both choices. Reset unlocks and returns to zero; story switching resets resources and choice. Replay restarts while retaining the locked choice. Seeking backward restores the appropriate earlier state without double payment.

All four built-in choices were read at frames 179, 180, 299, 300 and 479. Payment/protection/reward occurs at 180, and target damage only at 300. Final energy/integrity/reward is brace 0/3/0, rush 1/0/1, warm 1/2/0, harvest 2/0/1. Both reward-only branches show the corrected reward caption. Disabling captions removes all SVG text and leaves the objective-art markup identical at the same frame.

Real DOM geometry was read at 295, 298, 299, 300 and 301 for all four choices. Frame 299 leading-tip/contact X is 747.541/747 for both protected branches, 677.769/677 for rush, and 705.678/705 for harvest. At 300 the projectile is replaced by impact at precisely the same contact X and target integrity changes only then. Decoded web-render frames confirm the visual continuity (`contact-window.jpg`). Independently, all 1,920 built-in frames are byte-identical to the earlier geometry source after removing only the incoming-threat and impact groups (`nonGeometry-parity.json`).

A real 390×844 CSS iframe viewport has scrollWidth 390, a 364×204.75 scene, and usable wrapped controls. The illustration remains landscape and its small internal labels are correspondingly tiny. This is not physical-mobile or native-portrait validation. Portrait rendering is explicitly unsupported. Screenshots are evidence of the visible viewport, not full-page captures.

## Real Remotion web-render and media verification

The independent adapter in `render-qa.tsx` uses the exact exported CardConflictFrame, with useCurrentFrame/useVideoConfig and the same dimensions/default props as the three supplied compositions. It rendered all frames with Remotion and @remotion/web-renderer 4.0.507, React 19.2.8, development mode (`isProduction:false`):

- CardConflictLighthouse: lighthouse / brace.
- CardConflictCounterfactual: lighthouse / rush.
- CardConflictGreenhouse: greenhouse / warm.

Every output is silent H.264, 1280×720, 30 fps, 480 fully decoded frames. The web outputs' original container metadata says 15.966667 seconds. A stream-copy remux produces 16.000000-second files; every decoded frame hash remains identical between raw and normalized files. Both versions and full framemd5 logs are retained. `media-validation.json` contains hashes/probes. This is an actual full web-render, not screenshots assembled into a video.

Normalized outputs were played from beginning at 1× through the browser's media element. All three reached ended=true at16 seconds with no media errors and zero droppedFrames; playback observations retain raw frame counters (480 total frames). This verifies playback/decoding, not a continuous human aesthetic review. Visual review used selected decoded frames, especially the contact window.

The author's separate four final-v2 offline SVG videos, including labels-hidden, were independently fully decoded and probed (`offline-final-v2-validation.json`): each 480 frames, 16 seconds, 1280×720, 30 fps, no audio. They are not the independent web-render outputs. No pixel equality between different rasterization/encoding pipelines is claimed.

## Boundaries

No native Remotion CLI/headless-Chromium render was run in this verification. The independent adapter does not prove the CLI entrypoint itself renders. Real background-tab pause could not be exercised: this cloud CDP tab switch left the preview document visible. That behavior remains source/mock-DOM tested only. No touch-device, cross-browser, audio or native portrait claim is made. No product source, user Mac, remote branch, publishing or shared original samples were changed by this QA worker.

Historical evidence is isolated in sibling `pre-caption-fix` and `pre-geometry-fix`; do not use those source identities to attest this revision.
