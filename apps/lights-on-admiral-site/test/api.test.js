import test from 'node:test';
import assert from 'node:assert/strict';

import { hasPlaybackActivity, isHeartbeatFresh, isShowRunning, normalizeShow } from '../public/api.js';

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

test('hasPlaybackActivity requires a current or upcoming Remote Falcon sequence', () => {
  assert.equal(hasPlaybackActivity({ playingNow: '', playingNext: '  ', playingNextFromSchedule: '' }), false);
  assert.equal(hasPlaybackActivity({ playingNow: 'Halloween Overture' }), true);
  assert.equal(hasPlaybackActivity({ playingNextFromSchedule: 'Ghostbusters' }), true);
});

test('isShowRunning follows Remote Falcon state instead of show hours', () => {
  const now = Date.parse('2026-10-09T23:30:00Z');
  const base = {
    lastFppHeartbeat: '2026-10-09T23:29:40Z',
    preferences: { viewerControlEnabled: true },
    playingNow: 'Halloween Overture',
    playingNext: '',
    playingNextFromSchedule: ''
  };

  assert.equal(isShowRunning(base, { now }), true);
  assert.equal(isShowRunning({ ...base, playingNow: '' }, { now }), false);
  assert.equal(isShowRunning({ ...base, preferences: { viewerControlEnabled: false } }, { now }), false);
  assert.equal(isShowRunning({ ...base, lastFppHeartbeat: '2026-10-09T23:20:00Z' }, { now }), false);
});

test('isShowRunning keeps short between-song gaps live without masking a stopped show', () => {
  const now = Date.parse('2026-10-09T23:30:00Z');
  const betweenSongs = {
    lastFppHeartbeat: '2026-10-09T23:29:40Z',
    preferences: { viewerControlEnabled: true },
    playingNow: '',
    playingNext: '',
    playingNextFromSchedule: ''
  };

  assert.equal(isShowRunning(betweenSongs, { now, lastPlaybackAt: now - 20_000 }), true);
  assert.equal(isShowRunning(betweenSongs, { now, lastPlaybackAt: now - 50_000 }), false);
});
