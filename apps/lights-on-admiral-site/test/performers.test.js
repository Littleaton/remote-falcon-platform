import test from 'node:test';
import assert from 'node:assert/strict';

import { choosePerformer } from '../public/performers.js';

const performers = { pumpkin: {}, death: {}, phantom: {} };

test('choosePerformer honors a valid forced preview', () => {
  assert.equal(choosePerformer(performers, { forced: 'phantom', previous: 'death', random: () => 0 }), 'phantom');
});

test('choosePerformer randomly chooses without immediately repeating', () => {
  assert.equal(choosePerformer(performers, { previous: 'pumpkin', random: () => 0 }), 'death');
  assert.equal(choosePerformer(performers, { previous: 'pumpkin', random: () => 0.999 }), 'phantom');
});
