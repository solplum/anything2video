#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolvedPath, isWithin, sha256File} from '../../scripts/runtime-lib.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [target, variant, ...extra] = process.argv.slice(2);
if (!target || !['before', 'after'].includes(variant) || extra.length) throw new Error('Usage: node examples/shotcraft-reference-quality/prepare.mjs <new-external-directory> before|after');
const out = resolvedPath(target);
if (isWithin(repo, out) || isWithin(out, repo)) throw new Error('Choose a non-overlapping output directory outside the repository');
if (fs.existsSync(out)) throw new Error('Refusing an existing output directory');

const controls = [
  {name: 'GradientTransition', relative: 'transition/gradient-transition/GradientTransition.tsx', sha256: 'a0dfd2721778d9786b99be67b74da846725fadedcdac0a8a08b7ed3e2bb90cc3'},
  {name: 'AutolayoutGapDial', relative: 'interaction/autolayout-gap-dial/AutolayoutGapDial.tsx', sha256: '80766040683f84e3a2465b0dd3d800a4ecacd672c58f9ea4db0a63318e9c1f9c'},
];
for (const control of controls) {
  const baseline = `examples/shotcraft-reference-quality/baseline/${control.name}.tsx.txt`;
  if (sha256File(path.join(repo, baseline)) !== control.sha256) throw new Error(`Frozen control changed: ${baseline}`);
}
for (const name of ['src', 'script', 'public', 'research', 'qc']) fs.mkdirSync(path.join(out, name), {recursive: true});
const copied = [];
const copy = (from, to) => {
  fs.mkdirSync(path.dirname(path.join(out, to)), {recursive: true});
  fs.copyFileSync(path.join(repo, from), path.join(out, to));
  copied.push({source: from, path: to, sha256: sha256File(path.join(out, to))});
};
for (const name of ['package.json', 'package-lock.json', 'tsconfig.json']) copy(`template/${name}`, name);
copy('examples/shotcraft-reference-quality/Root.tsx', 'src/Root.tsx');
for (const control of controls) copy(variant === 'before'
  ? `examples/shotcraft-reference-quality/baseline/${control.name}.tsx.txt`
  : `gallery/demos-ref/${control.relative}`, `src/demos/${control.relative}`);
for (const file of ['Motion.tsx', 'Fixtures.tsx', 'ReferenceGeometry.mjs', 'ReferenceGeometry.d.mts']) copy(`gallery/demos-ref/_fixtures/${file}`, `src/demos/_fixtures/${file}`);
copy('gallery/demos-ref/MODIFICATIONS.md', 'research/reference-modifications.md');
copy('gallery/cards/ATTRIBUTION.md', 'research/upstream-card-attribution.md');
copy('LICENSE-THIRDPARTY/APACHE-2.0-video-shotcraft.txt', 'LICENSE-video-shotcraft.txt');
copy('LICENSE', 'LICENSE-anything2video.txt');
copy('examples/shotcraft-reference-quality/prepare.mjs', 'research/prepare-source.mjs');
copy('examples/shotcraft-reference-quality/check-components.mjs', 'check-components.mjs');
copy('examples/shotcraft-reference-quality/README.md', 'research/study-guide.md');
const write = (file, data) => fs.writeFileSync(path.join(out, file), JSON.stringify(data, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'src/index.ts'), "import {registerRoot} from 'remotion';\nimport {Root} from './Root';\nregisterRoot(Root);\n");
write('project.json', {schemaVersion: 1, status: 'draft', slug: `shotcraft-reference-${variant}`, width: 1920, height: 1080, fps: 30, totalFrames: 300, composition: 'ShotcraftReferenceStudy', recipe: 'custom', audio: {mode: 'silent'}});
write('script/storyboard.json', {claims: [], assets: [], shots: [
  {id: 'gradient', from: 1, to: 180, group: 'ReferenceStudy', component: 'src/demos/transition/gradient-transition/GradientTransition.tsx', purpose: 'Compare radial-layer visibility and moving crossfades without redesign', action: 'Original linear → radial → conic parameter motion; inspect both crossfades at normal speed'},
  {id: 'gap', from: 181, to: 300, group: 'ReferenceStudy', component: 'src/demos/interaction/autolayout-gap-dial/AutolayoutGapDial.tsx', purpose: 'Compare physical spacing, labels and elastic settling from one gap parameter', action: 'Original grow → hold → spring return; inspect local frames 66–119 including the overshoot'},
]});
write('script/study-provenance.json', {variant, upstreamCommit: '1266a3ec4831289c4d893d42dd5102723658039a', beforeLocalCommit: 'be7513c4098f93969683a5baa3796347cc8736b4', controls, copied, visualReview: 'not_performed', motionReview: 'not_performed', audioReview: 'not_performed', note: 'Engineering comparison, not approved production copy, upstream redesign, or aesthetic acceptance. Intentionally silent. Before contains known defects.'});
write('qc/reference-request.json', {schemaVersion: 1, id: `shotcraft-${variant}`, automatic: false,
  windows: [{id: 'gradient-whole', shotId: 'gradient', from: 1, to: 180}, {id: 'gap-whole', shotId: 'gap', from: 181, to: 300}],
  stills: [{id: 'radial', frame: 91}, {id: 'overshoot', frame: 260}],
  focus: ['Play both complete 30-fps action windows at normal speed, then compare exact frames.', 'Gradient: radial field remains visible during the middle and both crossfades; no unintended black hold.', 'Gap: blocks do not overlap; measurement width, badge centre and rounded readout agree; retain elastic below-rest return without a zero-gap freeze.'],
  preserve: ['Original palette, layout, copy, timing and 1920×1080 framing.', 'Silent engineering fixture; do not infer soundtrack or aesthetic acceptance from source/tests/stills.'],
});
console.log(out);
