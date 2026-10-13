import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { dateFromPreview, seasonForDate, veteransWeekRange } from '../public/seasons.js';

const publicRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const localDate = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};

test('October always uses the Halloween theme', () => {
  assert.equal(seasonForDate(localDate('2026-10-01')), 'halloween');
  assert.equal(seasonForDate(localDate('2026-10-31')), 'halloween');
});

test('Veterans Day uses the Sunday through Saturday week containing November 11', () => {
  const { start, end } = veteransWeekRange(2026);
  assert.equal(start.getDay(), 0);
  assert.equal(end.getDay(), 6);
  assert.equal(start.getDate(), 8);
  assert.equal(end.getDate(), 14);
  assert.equal(seasonForDate(localDate('2026-11-07')), 'lights');
  assert.equal(seasonForDate(localDate('2026-11-08')), 'veterans');
  assert.equal(seasonForDate(localDate('2026-11-11')), 'veterans');
  assert.equal(seasonForDate(localDate('2026-11-14')), 'veterans');
  assert.equal(seasonForDate(localDate('2026-11-15')), 'lights');
});

test('December always uses the Christmas theme and other dates use the neutral theme', () => {
  assert.equal(seasonForDate(localDate('2026-12-01')), 'christmas');
  assert.equal(seasonForDate(localDate('2026-12-31')), 'christmas');
  assert.equal(seasonForDate(localDate('2026-07-04')), 'lights');
});

test('date preview accepts only real YYYY-MM-DD calendar dates', () => {
  assert.equal(dateFromPreview('2026-11-11')?.getDate(), 11);
  assert.equal(dateFromPreview('2026-02-30'), null);
  assert.equal(dateFromPreview('November 11'), null);
});

test('ships compressed hero, visit, and resting artwork for both new seasonal themes', async () => {
  for (const name of [
    'hero-house-veterans-v1.jpg',
    'hero-house-christmas-v1.jpg',
    'visit-house-veterans-v1.jpg',
    'visit-house-christmas-v1.jpg',
    'admiral-gates-closed-veterans-v1.jpg',
    'admiral-gates-closed-christmas-v1.jpg'
  ]) {
    const image = await stat(resolve(publicRoot, 'assets', name));
    assert.ok(image.isFile());
    assert.ok(image.size > 100_000, `${name} should contain production artwork`);
    assert.ok(image.size < 1_000_000, `${name} should remain web-sized`);
  }
});

test('carries Veterans Day and Christmas palettes through full-page surfaces', async () => {
  const css = await readFile(resolve(publicRoot, 'styles.css'), 'utf8');
  for (const expected of [
    '--body-pattern:',
    ':root[data-season="veterans"] .visit-section',
    ':root[data-season="christmas"] .visit-section',
    '.songs-section',
    '.about-section',
    '.courtesy-icon',
    '.pulsemesh-card'
  ]) {
    assert.ok(css.includes(expected), `styles should include ${expected}`);
  }
});
