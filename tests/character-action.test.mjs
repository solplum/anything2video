import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('character action fixture binds storyboard phases, planted stance and timing-only edit', () => {
  const output = execFileSync(process.execPath, [path.join(root, 'examples/character-action-contract/verify.mjs'), path.join(root, 'template')], {cwd: root, encoding: 'utf8'});
  assert.match(output, /PASS:/);
});

test('fixture verification rejects a declared storyboard phase that drifts from actual motion', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const {spawnSync} = await import('node:child_process');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-story-drift-'));
  try {
    for (const file of ['scripts/story-contract-lib.mjs', 'scripts/runtime-lib.mjs', 'scripts/hash-file.mjs', 'template/src/shots/character-action/timing.ts', ...['verify.mjs', 'timing.json', 'storyboard.json', 'storyboard.late-contact.json'].map(f => `examples/character-action-contract/${f}`)]) {
      const dest = path.join(temp, file); fs.mkdirSync(path.dirname(dest), {recursive: true}); fs.copyFileSync(path.join(root, file), dest);
    }
    const file = path.join(temp, 'examples/character-action-contract/storyboard.json');
    const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
    plan.shots[0].story.actions[0].phases.support[0]++;
    fs.writeFileSync(file, JSON.stringify(plan));
    const result = spawnSync(process.execPath, [path.join(temp, 'examples/character-action-contract/verify.mjs'), path.join(root, 'template')], {encoding: 'utf8'});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Storyboard phases drift/);
  } finally {fs.rmSync(temp, {recursive: true, force: true});}
});
