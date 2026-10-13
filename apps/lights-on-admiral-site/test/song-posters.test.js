import test from 'node:test';
import assert from 'node:assert/strict';

import { clampSongIndex, posterSeed, posterTheme } from '../public/song-posters.js';

test('generated poster styling is deterministic and follows song metadata', () => {
  const song = { name: 'skeleton-sam.fseq', title: 'Skeleton Sam', artist: 'LVCRFT' };
  assert.equal(posterSeed(song), posterSeed({ ...song }));
  assert.deepEqual(posterTheme(song), posterTheme({ ...song }));
  assert.notEqual(posterSeed(song), posterSeed({ ...song, title: 'Monster Mash' }));
});

test('carousel selection stays within the filtered playlist', () => {
  assert.equal(clampSongIndex(-3, 5), 0);
  assert.equal(clampSongIndex(2.8, 5), 2);
  assert.equal(clampSongIndex(20, 5), 4);
  assert.equal(clampSongIndex(2, 0), 0);
});
