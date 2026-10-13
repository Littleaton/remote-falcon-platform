import { resolve } from 'node:path';

import { SITE_CONFIG } from '../public/config.js';
import { dateFromPreview, seasonForDate } from '../public/seasons.js';
import { startSiteServer } from './site-server.mjs';

await startSiteServer({
  root: resolve(process.cwd(), 'dist'),
  siteConfig: SITE_CONFIG,
  seasonForDate,
  dateFromPreview,
  port: Number(process.env.PORT || 4173),
  host: process.env.HOST || '127.0.0.1',
  allowThemePreview: true,
  proxyGraphqlUrl: 'https://lightsonadmiral.com/remote-falcon-viewer/graphql'
});
