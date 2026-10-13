import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SITE_CONFIG } from '../public/config.js';
import { dateFromPreview, seasonForDate } from '../public/seasons.js';
import { renderSeasonHtml } from '../scripts/seasonal-html.mjs';
import { calendarDateInZone, seasonForRequest, startSiteServer } from '../scripts/site-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const publicRoot = resolve(here, '..', 'public');

test('renders crawler-ready head metadata for every season', async () => {
  const template = await readFile(resolve(publicRoot, 'index.html'), 'utf8');

  for (const [seasonKey, season] of Object.entries(SITE_CONFIG.seasons)) {
    const html = renderSeasonHtml(template, seasonKey, season, SITE_CONFIG);
    const socialImage = new URL(season.socialImage, SITE_CONFIG.siteUrl).href;
    assert.ok(html.includes(`<html lang="en" data-season="${seasonKey}">`));
    assert.ok(html.includes(`<title>${season.pageTitle}</title>`));
    assert.ok(html.includes(`content="${season.metaDescription.replaceAll('&', '&amp;')}"`));
    assert.ok(html.includes(`content="${socialImage}"`));
    assert.ok(html.includes(`content="${season.socialImageAlt}"`));

    const structuredMatch = html.match(/<script[^>]*id="site-structured-data"[^>]*>([\s\S]*?)<\/script>/);
    assert.ok(structuredMatch);
    const structured = JSON.parse(structuredMatch[1]);
    assert.equal(structured.description, season.metaDescription);
    assert.equal(structured.image, socialImage);
    assert.equal(structured.keywords, season.keywords);
  }
});

test('uses the America/Denver calendar date around the UTC boundary', () => {
  assert.equal(calendarDateInZone(new Date('2026-12-01T06:59:00Z')).toISOString().slice(0, 10), '2026-11-30');
  assert.equal(calendarDateInZone(new Date('2026-12-01T07:01:00Z')).toISOString().slice(0, 10), '2026-12-01');
});

test('production season selection ignores preview parameters', () => {
  const season = seasonForRequest(new URL('https://lightsonadmiral.com/?date=2026-12-15&season=christmas'), {
    allowThemePreview: false,
    siteConfig: SITE_CONFIG,
    seasonForDate,
    dateFromPreview,
    timeZone: 'America/Denver',
    now: () => new Date('2026-10-13T18:00:00Z')
  });
  assert.equal(season, 'halloween');
});

test('serves seasonal HTML dynamically while keeping assets immutable', async () => {
  const server = await startSiteServer({
    root: publicRoot,
    siteConfig: SITE_CONFIG,
    seasonForDate,
    dateFromPreview,
    port: 0,
    allowThemePreview: true,
    now: () => new Date('2026-10-13T18:00:00Z'),
    log: false
  });

  try {
    const { port } = server.address();
    const root = `http://127.0.0.1:${port}`;
    const christmas = await fetch(`${root}/?date=2026-12-15`);
    const html = await christmas.text();
    assert.equal(christmas.status, 200);
    assert.equal(christmas.headers.get('x-lights-on-admiral-season'), 'christmas');
    assert.equal(christmas.headers.get('cache-control'), 'no-cache, max-age=0');
    assert.ok(html.includes('<title>Lights On Admiral | Christmas Light Show in Herriman, Utah</title>'));
    assert.ok(html.includes('https://lightsonadmiral.com/assets/hero-house-christmas-v1.jpg'));

    const veterans = await fetch(`${root}/?date=2026-11-11`);
    assert.equal(veterans.headers.get('x-lights-on-admiral-season'), 'veterans');
    assert.ok((await veterans.text()).includes('Lights On Admiral | Veterans Day Light Tribute'));

    const asset = await fetch(`${root}/assets/loa-christmas-crest.svg`);
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get('cache-control'), 'public, max-age=604800, immutable');

    const health = await fetch(`${root}/health.json`);
    assert.deepEqual(await health.json(), { status: 'ok' });
    assert.equal(health.headers.get('cache-control'), 'no-store');
  } finally {
    await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
  }
});
