import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {inflateSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(root, 'template/package.json'));
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const context = {frame: 0, fps: 30};
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = {exports: {}};
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  }}).outputText;
  const localRequire = name => {
    if (name === 'remotion') return {useCurrentFrame: () => context.frame, useVideoConfig: () => ({fps: context.fps, width: 1280, height: 720})};
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(file), name);
    return load(['.ts', '.tsx'].map(ext => base + ext).find(f => fs.existsSync(f)));
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, {filename: file})(localRequire, module, module.exports);
  return module.exports;
}
const common = name => load(path.join(root, `template/src/common/${name}`));
const model = common('DotFieldModel.ts');
const grain = common('Grain.ts');
const {DotFieldBg} = common('DotFieldBg.tsx');
const {FrameGrade} = common('FrameGrade.tsx');
const render = (props = {}) => renderToStaticMarkup(React.createElement(DotFieldBg, {specs: [], ...props}));

test('dot timing: one-based inclusive suppression, overlapping intervals and fog independence', () => {
  const specs = [{from: 10, to: 20, stars: 'none'}, {from: 1, to: 100, stars: 'dense'}];
  for (const [frame, visible] of [[8, true], [9, false], [19, false], [20, true]]) {
    context.frame = frame;
    assert.equal(model.dotsVisible(frame, specs), visible);
    assert.equal(render({specs}) !== '', visible);
  }
  context.frame = 10;
  assert.equal(render({specs: [{from: 1, to: 100, fog: false}]}), render());
  assert.equal(render({specs: [{from: 1, to: 100, stars: 'none'}], grain: true}), '');
});

test('actual component renders fixed lattice, deterministic speed-scaled motion and optional grain', () => {
  context.frame = 0; const start = render({grain: false});
  assert.equal((start.match(/<circle /g) ?? []).length, 390);
  assert.match(start, /preserveAspectRatio="xMidYMid slice"/);
  assert.doesNotMatch(start, /data:image/);
  assert.match(render(), /data:image\/png;base64/);
  context.frame = 90; const later = render({grain: false});
  assert.notEqual(later, start);
  assert.equal(render({speed: 0, grain: false}), start);
  context.frame = 45; assert.equal(render({speed: 3, grain: false}), later);
  context.fps = 60; context.frame = 180; assert.equal(render({grain: false}), later);
  context.fps = 30; context.frame = 90; assert.equal(render({grain: false}), later);
  assert.equal(render({speed: NaN}), render());
  assert.equal(common('DotFieldBg.tsx').GRAIN_URL, grain.GRAIN_URL);
});

test('dot brightness is finite and bounded across positions, negative time and long timelines', () => {
  for (const seconds of [-1000, -1, 0, 0.25, 12, 10000, NaN]) for (const p of model.DOT_POSITIONS) {
    const result = model.dotAppearance(p.x, p.y, seconds);
    assert.ok(result.opacity >= 0 && result.opacity <= 0.72);
    assert.ok(result.radius >= 1.4 && result.radius <= model.DOT_MAX_RADIUS);
  }
});

test('grain decodes as a valid deterministic neutral grayscale PNG, not SVG turbulence', () => {
  const uri = grain.grainPng(); assert.equal(uri, grain.grainPng());
  assert.doesNotMatch(grain.GRAIN_URL, /svg|Turbulence/);
  const png = Buffer.from(uri.split(',')[1], 'base64');
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const chunks = new Map();
  for (let i = 8; i < png.length;) {
    const length = png.readUInt32BE(i), name = png.toString('ascii', i + 4, i + 8);
    chunks.set(name, png.subarray(i + 8, i + 8 + length)); i += length + 12;
  }
  const header = chunks.get('IHDR');
  assert.equal(header.readUInt32BE(0), 160); assert.equal(header.readUInt32BE(4), 160);
  assert.equal(header[8], 8); assert.equal(header[9], 0);
  const raw = inflateSync(chunks.get('IDAT')); const pixels = grain.grainPixels();
  for (let y = 0; y < 160; y++) {
    assert.equal(raw[y * 161], 0);
    assert.deepEqual(raw.subarray(y * 161 + 1, (y + 1) * 161), Buffer.from(pixels.subarray(y * 160, (y + 1) * 160)));
  }
  const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length;
  assert.ok(mean > 125 && mean < 130); assert.ok(new Set(pixels).size === 160);
  for (const size of [1, 2, 160, 255]) {
    const bytes = Buffer.from(grain.grainPng(size).split(',')[1], 'base64');
    const decoded = spawnSync('python3', ['-c', 'from PIL import Image; import io,sys; im=Image.open(io.BytesIO(sys.stdin.buffer.read())); im.verify()'], {input: bytes});
    assert.equal(decoded.status, 0, decoded.stderr.toString());
  }
  for (const size of [0, -1, 1.5, 256, NaN]) assert.throws(() => grain.grainPng(size), RangeError);
});

test('FrameGrade keeps off/default, vignette and tint contracts with independent grain import', () => {
  const grade = props => renderToStaticMarkup(React.createElement(FrameGrade, props));
  assert.equal(grade({}), ''); assert.match(grade({grain: true}), /data:image\/png/);
  assert.match(grade({vignette: true, vignetteMode: 'deep', tint: '#123', tintAlpha: 0.2}), /multiply/);
  assert.doesNotMatch(grade({vignette: true, vignetteMode: 'none'}), /radial-gradient/);
  assert.ok(fs.readFileSync(path.join(root, 'styles/aurora-glass/kit.tsx'), 'utf8').includes("from '../common/Grain'"));
});

test('Python QC mask covers rendered circles across landscape, portrait, square and 4K layouts', () => {
  const result = spawnSync('python3', ['-c', `
import ast, pathlib, numpy as np
source = pathlib.Path('template/scripts/frame_metrics.py').read_text()
fn = next(n for n in ast.parse(source).body if isinstance(n, ast.FunctionDef) and n.name == 'dot_mask')
ns = {'np': np, 'BG': 'dots'}
exec(compile(ast.Module(body=[fn], type_ignores=[]), '<mask>', 'exec'), ns)
for w,h in [(1280,720),(720,1280),(800,800),(3840,2160),(320,180)]:
    mask = ns['dot_mask'](w,h); scale=max(w/960,h/540)
    for y in range(18,540,36):
        for x in range(24,960,36):
            cx=(w-960*scale)/2+x*scale; cy=(h-540*scale)/2+y*scale
            for yy in range(max(0,int(cy-1.8*scale)-1), min(h,int(cy+1.8*scale)+2)):
                for xx in range(max(0,int(cx-1.8*scale)-1), min(w,int(cx+1.8*scale)+2)):
                    if (xx-cx)**2+(yy-cy)**2 <= (1.8*scale)**2: assert mask[yy,xx]
ns['BG']='stars'; assert not ns['dot_mask']().any()
`], {cwd: root, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
});


test('diagonal crest progresses across the frame and loops continuously at the original cadence', () => {
  const crest = t => {
    let weight = 0, location = 0;
    for (const {x,y} of model.DOT_POSITIONS) {
      const u=x/960, v=y/540;
      const rim=0.3+0.7*Math.min(1, Math.max(0,Math.min(u,1-u,v,1-v))/0.18);
      const light=(model.dotAppearance(x,y,t).opacity/rim-0.17)/0.55;
      weight += light;
      location += light*(0.72*u+0.28*v);
    }
    return location/weight;
  };
  const locations=[3,5,7,9].map(crest);
  for(let i=1;i<locations.length;i++) assert.ok(locations[i]-locations[i-1]>0.15);
  for(const p of model.DOT_POSITIONS) {
    const a=model.dotAppearance(p.x,p.y,2.3), b=model.dotAppearance(p.x,p.y,16.3);
    assert.ok(Math.abs(a.opacity-b.opacity)<1e-12);
    assert.ok(Math.abs(model.dotAppearance(p.x,p.y,14-1e-6).opacity-model.dotAppearance(p.x,p.y,14+1e-6).opacity)<1e-5);
  }
  // Same projection along the diagonal band has the same illumination (away from rim).
  const a=model.dotAppearance(480,270,7);
  const b=model.dotAppearance((0.5+0.07)*960,(0.5-0.18)*540,7);
  assert.ok(Math.abs(a.opacity-b.opacity)<1e-12);
});
