# Code-only match-cut / beat-relay study

An original paper-symbol animatic: **seed → sun → care-time dial**. The link is a small beginning becoming a daily care routine, not merely three round shapes. This is a fictional concept and engineering fixture, not a branded advertisement, approved production copy or proof of any product feature.

The `promo` recipe and paper-like visual treatment are independent of `editingMode: "match-cut-beat-relay"`. Nothing is added to the style catalog. Only the two declared boundaries participate: seed → sun continues rightward motion; sun → dial matches at rest before a new clockwise hand movement. Other shots/cuts in a real project can keep their existing grammar.

## Prepare and check without services or dependencies

From the skill checkout, choose a **new directory outside this repository**:

```sh
node examples/match-cut-beat-relay/prepare.mjs /tmp/a2v-match-cut-study
node scripts/check-plan.mjs /tmp/a2v-match-cut-study
node scripts/match-cut-plan.mjs /tmp/a2v-match-cut-study
node scripts/match-cut-plan.mjs /tmp/a2v-match-cut-study --review-request > /tmp/a2v-match-cut-study/qc/match-cut-request.json
node scripts/review-pack.mjs /tmp/a2v-match-cut-study plan qc/match-cut-request.json
```

The preparation script imports `createComposedGrid` / `beatToFrame` from the actual editing-mode implementation. It writes the helper-derived boundaries to `script/storyboard.json`; `Scene.tsx` mounts those same boundaries with `Sequence`, converting the global 1-based inclusive frame convention once. `Root.tsx` reads the real project dimensions, fps and duration. There is no disconnected demonstration timeline.

Default: **24 fps, 96 BPM, first beat 0.18 s**. A second study can use:

```sh
node examples/match-cut-beat-relay/prepare.mjs /tmp/a2v-match-cut-study-60 --fps 60 --bpm 137 --phase 0.18
node scripts/check-plan.mjs /tmp/a2v-match-cut-study-60
node scripts/match-cut-plan.mjs /tmp/a2v-match-cut-study-60
```

The frame grid is **explicitly composed**, not analyzed from a recording. A deterministic 48 kHz mono PCM click track is synthesized from the same seconds values with no external assets, service calls or paid generation. It is a timing aid, **not a finished soundtrack or evidence of measured music sync**. The number of beats per shot grows with tempo to preserve time for the ending action and reading hold; tempo does not force a cut every beat.

## Cheap animatic before expensive production

When the ordinary pinned Remotion environment is available, install/use it in the external study project according to [environment setup](../../reference/environment-capabilities.md). Installation is not done by the preparation script.

```sh
cd /tmp/a2v-match-cut-study
npm ci
npx remotion browser ensure
npm run typecheck
# Replace /path/to/anything2video with the skill's absolute path:
node /path/to/anything2video/scripts/render.mjs /tmp/a2v-match-cut-study preview 10
node /path/to/anything2video/scripts/review-pack.mjs /tmp/a2v-match-cut-study render qc/match-cut-request.json
```

Keep it `status: "draft"`. The review request includes action windows and cut-pair frames; planning remains `needs_review` / `not_rendered`. Actual previews must be watched with sound at normal speed and inspected at full size. Read the final holding text, compare the moving pair, inspect the resting pair before the dial starts, and check that the synthetic clicks align after encoding. Still frames/contact sheets do not establish movement or listening acceptance.

This example does not run an external video model, attach to Renoise, change an existing project, approve a script, or pass final QC. A real production uses the existing approval, asset, visual-direction and final playback contracts. Do not copy its fixture disclosure as user approval.

## Scope and license

Code, drawn shapes and synthetic clicks are original work under this repository's [MIT license](../../LICENSE). No upstream video, logo, reference frame, song or generated asset is copied. Editing-method attribution is in [the mode reference](../../reference/match-cut-beat-relay.md). Preparing or structurally checking this example alone is not a claim that it has been rendered, continuously viewed, listened to or aesthetically accepted.
