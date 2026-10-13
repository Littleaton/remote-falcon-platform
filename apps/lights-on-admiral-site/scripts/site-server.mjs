import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

import { renderSeasonHtml } from './seasonal-html.mjs';

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp'
};

const IMMUTABLE_ASSET = /\.(?:css|js|svg|png|jpg|jpeg|webp|ico)$/i;

export function calendarDateInZone(value, timeZone = 'America/Denver') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return new Date(Number(values.year), Number(values.month) - 1, Number(values.day), 12);
}

export function seasonForRequest(url, options) {
  if (options.allowThemePreview) {
    const forcedSeason = url.searchParams.get('season');
    if (forcedSeason && options.siteConfig.seasons[forcedSeason]) return forcedSeason;

    const previewDate = options.dateFromPreview(url.searchParams.get('date'));
    if (previewDate) return options.seasonForDate(previewDate);
  }

  return options.seasonForDate(calendarDateInZone(options.now(), options.timeZone));
}

async function proxyRequest(request, response, upstreamUrl) {
  try {
    const body = [];
    for await (const chunk of request) body.push(chunk);
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: { 'content-type': request.headers['content-type'] || 'application/json' },
      body: body.length ? Buffer.concat(body) : undefined
    });
    response.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') || 'application/json'
    });
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Live preview API unavailable' }));
  }
}

export async function startSiteServer({
  root,
  siteConfig,
  seasonForDate,
  dateFromPreview,
  port,
  host = '127.0.0.1',
  timeZone = 'America/Denver',
  allowThemePreview = false,
  proxyGraphqlUrl = null,
  now = () => new Date(),
  log = true
}) {
  const resolvedRoot = resolve(root);
  const rootPrefix = `${resolvedRoot}${sep}`;
  const template = await readFile(resolve(resolvedRoot, 'index.html'), 'utf8');
  const seasonalHtml = Object.fromEntries(Object.entries(siteConfig.seasons).map(([seasonKey, season]) => [
    seasonKey,
    renderSeasonHtml(template, seasonKey, season, siteConfig)
  ]));

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    response.setHeader('X-Content-Type-Options', 'nosniff');

    if (requestUrl.pathname === '/health.json') {
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      });
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ status: 'ok' }));
      return;
    }

    if (proxyGraphqlUrl && requestUrl.pathname === '/remote-falcon-viewer/graphql') {
      await proxyRequest(request, response, proxyGraphqlUrl);
      return;
    }

    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { allow: 'GET, HEAD' });
      response.end();
      return;
    }

    const sendSeasonalHtml = () => {
      const seasonKey = seasonForRequest(requestUrl, {
        allowThemePreview,
        siteConfig,
        seasonForDate,
        dateFromPreview,
        timeZone,
        now
      });
      const html = seasonalHtml[seasonKey] || seasonalHtml.lights;
      response.writeHead(200, {
        'content-type': CONTENT_TYPES['.html'],
        'cache-control': 'no-cache, max-age=0',
        'x-lights-on-admiral-season': seasonKey
      });
      response.end(request.method === 'HEAD' ? undefined : html);
    };

    if (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html') {
      sendSeasonalHtml();
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
    } catch {
      response.writeHead(400).end();
      return;
    }

    const file = resolve(resolvedRoot, pathname);
    if (file !== resolvedRoot && !file.startsWith(rootPrefix)) {
      response.writeHead(403).end();
      return;
    }

    try {
      const details = await stat(file);
      if (!details.isFile()) throw new Error('Not a file');
      const extension = extname(file).toLowerCase();
      response.writeHead(200, {
        'content-type': CONTENT_TYPES[extension] || 'application/octet-stream',
        'content-length': details.size,
        'cache-control': IMMUTABLE_ASSET.test(extension)
          ? 'public, max-age=604800, immutable'
          : 'no-cache'
      });
      if (request.method === 'HEAD') response.end();
      else createReadStream(file).pipe(response);
    } catch {
      if (extname(pathname)) {
        response.writeHead(404).end();
        return;
      }
      sendSeasonalHtml();
    }
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, host, () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });

  if (log) {
    const address = server.address();
    console.log(`Lights On Admiral: http://${host}:${address.port}`);
  }
  return server;
}
