import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist');
const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml'
};

createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  let file = normalize(join(root, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(root)) {
    response.writeHead(403).end();
    return;
  }
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(root, 'index.html');
  }
  response.setHeader('Content-Type', contentTypes[extname(file)] || 'application/octet-stream');
  createReadStream(file).pipe(response);
}).listen(4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173'));
