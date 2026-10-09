import test from 'node:test';
import assert from 'node:assert/strict';

import { isHeartbeatFresh, normalizeShow } from '../public/api.js';

test('normalizeShow filters hidden songs and sorts playlist and queue', () => {
  const show = normalizeShow({
    sequences: [
      { name: 'late', active: true, visible: true, order: 4 },
      { name: 'hidden', active: true, visible: false, order: 1 },
      { name: 'early', active: true, visible: true, order: 2 }
    ],
    requests: [
      { position: 4, sequence: { name: 'late' } },
      { position: 2, sequence: { name: 'early' } }
    ],
    votes: [{ sequence: { name: 'early' }, votes: 3 }]
  });

  assert.deepEqual(show.sequences.map((song) => song.name), ['early', 'late']);
  assert.deepEqual(show.queue.map((request) => request.sequence.name), ['early', 'late']);
  assert.equal(show.votes.get('early'), 3);
});

test('normalizeShow falls back to the sequence index when order is absent', () => {
  const show = normalizeShow({
    sequences: [
      { name: 'third', active: true, visible: true, index: 3 },
      { name: 'first', active: true, visible: true, index: 1 }
    ]
  });

  assert.deepEqual(show.sequences.map((song) => song.name), ['first', 'third']);
});

test('isHeartbeatFresh accepts recent timestamps and rejects stale or invalid values', () => {
  const now = Date.parse('2026-10-09T12:00:00Z');
  assert.equal(isHeartbeatFresh('2026-10-09T11:58:01Z', now), true);
  assert.equal(isHeartbeatFresh('2026-10-09T11:56:59Z', now), false);
  assert.equal(isHeartbeatFresh(null, now), false);
  assert.equal(isHeartbeatFresh('not-a-date', now), false);
});
