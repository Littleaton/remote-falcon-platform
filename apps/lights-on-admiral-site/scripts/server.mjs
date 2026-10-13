import { resolve } from 'node:path';

import { SITE_CONFIG } from '../dist/config.js';
import { dateFromPreview, seasonForDate } from '../dist/seasons.js';
import { startSiteServer } from './site-server.mjs';

await startSiteServer({
  root: resolve(process.cwd(), 'dist'),
  siteConfig: SITE_CONFIG,
  seasonForDate,
  dateFromPreview,
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0'
});
