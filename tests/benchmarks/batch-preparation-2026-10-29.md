# Batch preparation diagnostic — 2026-10-29

**Observed avoided preparation: 12.01 seconds (63.7%)** when doing one actual
TypeScript check + Remotion bundle instead of three, on this fixed template.
This is **not** end-to-end `renderBatch` speed, browser-rendering speed, or FPS.

## Measured preparation only

| Median of three groups | Three separate preparations | One preparation |
| --- | ---: | ---: |
| Actual `tsc --noEmit` | 7.66 s | 2.75 s |
| Official Remotion bundle | 11.20 s | 4.10 s |
| Sum of measured stages | **18.86 s** | **6.85 s** |

Each separate group ran three fresh workers sequentially; each one-preparation
group ran one fresh worker. Stage sum excludes module loading, process startup,
output hashing, and cleanup. Typecheck timing includes starting the `tsc` child.
Per-pair stage totals (three / one) were 19.895 / 7.088 s, 18.856 / 6.851 s, and
17.750 / 5.636 s. These are small-sample observations, not a guarantee.

- Fixed template at base `30e3084fce2afc2a5b8e67a788c2c75dfc7811e7`;
  no template changes in the live working tree. Frozen copy: 139 input files,
  44,639,518 bytes; input hashes unchanged after all runs.
- Linux x64, AMD EPYC 9V74; Node v24.22.1, TypeScript 5.9.3,
  `@remotion/bundler` 4.0.507. Measured 07:00:08–07:01:38 UTC.
- One unmeasured warmup, then three paired repetitions in AB / BA / AB order.
  Same machine/source/dependencies; fresh worker and output directory every time.
- Official bundler `enableCaching: false`; isolated `node_modules` excludes the
  shared `.cache`. No persistent-cache change. OS filesystem cache was uncontrolled
  and likely warm, **not disk-cold**. Other project workers paused heavy work;
  host-wide CPU load was not instrumented.
- All 13 bundles (warmup included) had the same aggregate content hash:
  `0d935d15cad7226ea83c10639c460211323a5b7bf9d421a571749c54ad02b204`.
  Each contained 51 files / 65,911,162 bytes.

No browser was launched. This timing harness does not invoke `renderBatch`,
measure plan gates/source snapshots, select compositions, render frames, encode
video, or build review packets. It measures the preparation work that batching
avoids repeating, not the complete user's workflow or visual quality.

## Separate session-count evidence

The production-path test
`mixed batch uses one validation/typecheck/bundle/browser and exact one-based evidence`
in [`render-batch.test.mjs`](../render-batch.test.mjs) passed independently after
timing. For **three preview windows plus two stills**, it asserts manifest counts
`planChecks`, `typechecks`, `bundles`, `browserOpens`, and
`compositionSelections` are each **1**, and independently logs one typecheck,
bundle, browser open, selection, and close. It checks the exact frame requests.

That orchestration test uses explicitly synthetic TypeScript/bundler/browser
modules and FFmpeg-generated video fixtures. Its runtime is **not performance
or real-browser evidence**. The timing table above instead uses real TypeScript
and the official bundler, without a renderer adapter.

## Reproduce and inspect

```sh
# From repository root, with template dependencies already installed:
node tests/benchmarks/batch-preparation.mjs "$PWD" "/tmp/a2v-batch-preparation-$$"
node --test --test-name-pattern='mixed batch uses one validation/typecheck/bundle/browser' \
  tests/render-batch.test.mjs
```

Use a new result path and a quiet CPU window. The harness refuses existing result
directories and retains the frozen inputs and bundle outputs (about 0.9 GB); these
can be removed after retaining `results.json`, `rows.jsonl`, and `input-hashes.json`.
No new dependencies are needed.

- [Raw timing, environment, and output digests](results-2026-10-29/batch-preparation.json)
- [Frozen input hashes](results-2026-10-29/batch-preparation-input-hashes.json)
- [Session-count test result](results-2026-10-29/batch-session-count-test.txt)
- [Exact measurement harness](batch-preparation.mjs)
  (SHA-256 `42f95e5a64a06eda36510c180dfbaa006df66142fe2a9566071a970a7c9e25e2`).
