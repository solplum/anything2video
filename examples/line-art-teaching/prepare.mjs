#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const target = process.argv[2];
if (!target || process.argv.length !== 3) throw new Error('Usage: node examples/line-art-teaching/prepare.mjs <new-external-directory>');
const out = path.resolve(target);
const relative = path.relative(repo, out);
if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) throw new Error('Choose an output directory outside the repository');
if (fs.existsSync(out)) throw new Error('Refusing an existing output directory');
const source = path.join(repo, 'samples/line-art-sample.mp4');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourceHash = '925b5becb5d6c4d2171056733de060b6d45257106f91878924cc6bd110883b86';
if (hash(source) !== sourceHash) throw new Error('Historical audio source changed; review timing before updating this fixture');
for (const variant of ['control', 'teaching']) {
  const p = path.join(out, variant);
  for (const dir of ['src/style', 'src/common', 'public/fonts', 'script', 'research']) fs.mkdirSync(path.join(p, dir), {recursive: true});
  const copy = (from, to) => fs.copyFileSync(path.join(repo, from), path.join(p, to));
  for (const name of ['package.json', 'package-lock.json', 'tsconfig.json']) copy(`template/${name}`, name);
  for (const name of ['Scene.tsx', 'Root.tsx']) copy(`examples/line-art-teaching/${name}`, `src/${name}`);
  for (const name of ['kit.tsx', 'teaching.tsx', 'teaching-timing.mjs', 'teaching-timing.d.mts']) copy(`styles/line-art/${name}`, `src/style/${name}`);
  copy('template/src/common/easing.ts', 'src/common/easing.ts');
  fs.writeFileSync(path.join(p, 'src/common/index.ts'), "export {clamp01, cubicBezier} from './easing';\n");
  fs.writeFileSync(path.join(p, 'src/index.ts'), "import {registerRoot} from 'remotion';\nimport {Root} from './Root';\nregisterRoot(Root);\n");
  copy('template/public/fonts/NotoSansSC.ttf', 'public/fonts/NotoSansSC.ttf');
  copy('template/public/fonts/NotoSerifSC[wght].ttf', 'public/fonts/NotoSerifSC.ttf');
  copy('template/public/fonts/LICENSE.md', 'public/fonts/LICENSE.md');
  copy('template/public/fonts/LICENSE-NotoSerifSC-OFL.txt', 'public/fonts/LICENSE-NotoSerifSC-OFL.txt');
  copy('LICENSE', 'LICENSE-anything2video.txt');
  copy('LICENSE-THIRDPARTY/MIT-mg-styles-15.txt', 'LICENSE-line-art-upstream.txt');
  fs.writeFileSync(path.join(p, 'README-source-and-license.md'), '# Source and licenses\n\nSource: https://github.com/solplum/anything2video/tree/main/examples/line-art-teaching\n\nAudio is copied only for this comparison from the existing line-art sample. Existing TTS, generated BGM and Mixkit SFX retain their own terms; this extraction grants no additional reuse or standalone redistribution rights. Source disclosure: https://github.com/solplum/anything2video/blob/main/samples/README.md and https://github.com/solplum/anything2video/blob/main/samples/manifest.json .\n\nCode: LICENSE-anything2video.txt and LICENSE-line-art-upstream.txt. Fonts: public/fonts/LICENSE.md and public/fonts/LICENSE-NotoSerifSC-OFL.txt.\n');
  const audio = spawnSync('ffmpeg', ['-v', 'error', '-i', source, '-map', '0:a:0', '-c:a', 'copy', path.join(p, 'public/source-audio.m4a')], {encoding: 'utf8'});
  if (audio.status !== 0) throw new Error(`Audio extraction failed: ${audio.stderr || audio.error?.message}`);
  const write = (name, value) => fs.writeFileSync(path.join(p, name), JSON.stringify(value, null, 2) + '\n');
  write('project.json', {schemaVersion: 1, status: 'draft', slug: `line-art-${variant}`, width: 1280, height: 720, fps: 30, totalFrames: 411, composition: variant === 'control' ? 'LineArtControl' : 'LineArtTeaching', recipe: 'explainer', audio: {mode: 'narration'}});
  write('research/control.json', {source: 'samples/line-art-sample.mp4', sourceSha256: sourceHash, audioSha256: hash(path.join(p, 'public/source-audio.m4a')), audio: 'Identical copied AAC packets: existing TTS + SFX + generated BGM, no new speech', timebase: 'N = zero-based render frame + 1', limitation: 'Reconstructed kit control; not the unavailable historical source project. Both picture streams last 411/30 seconds; the same original audio/container lasts 13.76 seconds and is not retimed.'});
  write('script/storyboard.json', {shots: [{id: 'S01', from: 1, to: 244, group: 'Bridge', component: 'src/Scene.tsx', purpose: 'Identify the question while the bridge is drawn', action: 'Same continuous one-stroke construction', facts: [0]}, {id: 'S02', from: 245, to: 336, group: 'Bridge', component: 'src/Scene.tsx', purpose: 'Read load and cable at their action cues', action: 'Same load arrow and force fill timing', facts: [0]}, {id: 'S03', from: 337, to: 411, group: 'Bridge', component: 'src/Scene.tsx', purpose: 'Read the takeaway without competing movement', action: 'Opt-in stable force diagram and one conclusion', facts: [0]}], claims: [{text: 'Illustrative force transfer in a cable-stayed bridge, not an engineering calculation.', source: 'local:research/control.json'}], assets: []});
}
console.log(`Prepared ${out}. Install the pinned template dependencies in both projects, then use scripts/render.mjs.`);
