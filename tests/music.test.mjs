import {test} from 'node:test';
import {tsLoader} from './helpers/load-ts.mjs';

const {runAllMusicTests} = tsLoader()('template/src/common/music.test.ts');

test('music: envelopes, hits, beat timing, frame snapping, sparse grids and determinism', () => {
  runAllMusicTests();
});
