import test from 'node:test';
import assert from 'node:assert/strict';
import { localArtworkForSong } from '../public/song-artwork.js';

test('uses the stable Remote Falcon sequence name before display metadata', () => {
  assert.equal(
    localArtworkForSong({
      name: 'MLS-Best of Michael Jackson',
      displayName: 'A future renamed medley'
    }),
    './assets/song-art/best-of-michael-jackson.jpg'
  );
});

test('falls back to normalized display titles when a sequence name changes', () => {
  assert.equal(
    localArtworkForSong({ name: 'renamed-sequence', displayName: "  Somebody's   Watching Me " }),
    './assets/song-art/somebodys-watching-me.jpg'
  );
});

test('leaves unknown songs on the generated poster fallback', () => {
  assert.equal(localArtworkForSong({ name: 'new-song', displayName: 'New Song' }), '');
});
