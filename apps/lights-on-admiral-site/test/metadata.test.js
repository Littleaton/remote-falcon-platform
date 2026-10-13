import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SITE_CONFIG } from '../public/config.js';

const here = dirname(fileURLToPath(import.meta.url));
const publicRoot = resolve(here, '..', 'public');
const html = await readFile(resolve(publicRoot, 'index.html'), 'utf8');
const app = await readFile(resolve(publicRoot, 'app.js'), 'utf8');
const config = await readFile(resolve(publicRoot, 'config.js'), 'utf8');

test('publishes accurate title, description, keywords, and canonical URL', () => {
  assert.match(html, /<title>Lights On Admiral \| Halloween Light Show in Herriman, Utah<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]*Herriman, Utah[^"]*107\.7 FM\." \/>/);
  assert.match(html, /<meta name="keywords" content="[^"]*Herriman Halloween lights[^"]*interactive light show[^"]*" \/>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/lightsonadmiral\.com\/" \/>/);
  assert.doesNotMatch(html, /West Jordan/i);
});

test('publishes complete Open Graph and X social-card metadata', () => {
  const imageUrl = 'https://lightsonadmiral.com/assets/social-share-halloween-v1.jpg';

  assert.match(html, /<meta property="og:title" content="Lights On Admiral \| Halloween Light Show" \/>/);
  assert.match(html, /<meta property="og:type" content="website" \/>/);
  assert.ok(html.includes(`<meta property="og:image" content="${imageUrl}" />`));
  assert.match(html, /<meta property="og:image:width" content="1200" \/>/);
  assert.match(html, /<meta property="og:image:height" content="630" \/>/);
  assert.match(html, /<meta property="og:image:alt" content="[^"]+" \/>/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/);
  assert.ok(html.includes(`<meta name="twitter:image" content="${imageUrl}" />`));
});

test('ships the social preview image referenced by metadata', async () => {
  const image = await stat(resolve(publicRoot, 'assets', 'social-share-halloween-v1.jpg'));
  assert.ok(image.isFile());
  assert.ok(image.size > 100_000);
});

test('publishes valid website structured data', () => {
  const match = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(match, 'expected application/ld+json metadata');

  const metadata = JSON.parse(match[1]);
  assert.equal(metadata['@type'], 'WebSite');
  assert.equal(metadata.name, 'Lights On Admiral');
  assert.equal(metadata.url, 'https://lightsonadmiral.com/');
  assert.equal(metadata.image, 'https://lightsonadmiral.com/assets/social-share-halloween-v1.jpg');
  assert.equal(metadata.inLanguage, 'en-US');
});

test('keeps the browser title aligned with the active seasonal show', () => {
  assert.match(app, /applySeasonMetadata\(season\)/);
  assert.match(config, /pageTitle: 'Lights On Admiral \| Halloween Light Show in Herriman, Utah'/);
  assert.match(config, /pageTitle: 'Lights On Admiral \| Veterans Day Light Tribute in Herriman, Utah'/);
  assert.match(config, /pageTitle: 'Lights On Admiral \| Christmas Light Show in Herriman, Utah'/);
});

test('defines complete search and social metadata for every seasonal theme', async () => {
  for (const [seasonKey, season] of Object.entries(SITE_CONFIG.seasons)) {
    for (const property of [
      'pageTitle',
      'themeColor',
      'metaDescription',
      'keywords',
      'socialTitle',
      'socialDescription',
      'socialImage',
      'socialImageWidth',
      'socialImageHeight',
      'socialImageAlt'
    ]) {
      assert.ok(season[property], `${seasonKey} should define ${property}`);
    }

    assert.match(season.metaDescription, /Herriman, Utah/);
    assert.match(season.metaDescription, /107\.7 FM/);
    assert.match(season.socialImage, /^\.\/assets\//);
    const image = await stat(resolve(publicRoot, season.socialImage.replace(/^\.\//, '')));
    assert.ok(image.isFile(), `${seasonKey} social image should ship with the site`);
  }
});

test('updates document, Open Graph, X, and structured metadata together', () => {
  for (const selector of [
    'meta[name="description"]',
    'meta[name="keywords"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[property="og:image"]',
    'meta[property="og:image:alt"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
    'meta[name="twitter:image"]',
    'meta[name="twitter:image:alt"]'
  ]) {
    assert.ok(app.includes(`setMetaContent('${selector}'`), `app should update ${selector}`);
  }
  assert.match(app, /metadata\.description = description/);
  assert.match(app, /metadata\.image = socialImage/);
  assert.match(app, /metadata\.keywords = season\.keywords/);
});
