import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {sha256File} from '../scripts/hash-file.mjs';
import {sha256File as runtimeHash} from '../scripts/runtime-lib.mjs';

test('runtime and package hashing share a bounded, uncached byte-exact implementation', t => {
  assert.equal(runtimeHash, sha256File);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-hash-'));
  t.after(() => fs.rmSync(temp, {recursive: true, force: true}));
  const file = path.join(temp, 'asset.bin');
  for (const size of [0, 1, 1048575, 1048576, 1048577, 2097189, 13, 0]) {
    const bytes = Buffer.alloc(size, size % 251);
    fs.writeFileSync(file, bytes);
    assert.equal(sha256File(file), createHash('sha256').update(bytes).digest('hex'));
  }
  fs.writeFileSync(file, 'first');
  const before = sha256File(file);
  const stat = fs.statSync(file);
  fs.writeFileSync(file, 'other');
  fs.utimesSync(file, stat.atime, stat.mtime);
  assert.notEqual(sha256File(file), before, 'same size and timestamp cannot hide a source edit');
  fs.unlinkSync(file);
  assert.throws(() => sha256File(file), {code: 'ENOENT'});
  fs.writeFileSync(file, 'recreated');
  assert.equal(sha256File(file), createHash('sha256').update('recreated').digest('hex'));
});
