import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { createHandler } from './http.js';

const demo = !process.env.DATABASE_URL;
const api = createHandler({ demo });
const port = Number(process.env.PORT ?? 4174);
const root = resolve('dist');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname.startsWith('/api/')) return api(req, res);
  const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  try {
    if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) throw new Error();
    res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(res);
  } catch {
    res.statusCode = 404;
    res.end('File not found. Run npm run build before starting the preview.');
  }
}).listen(port, '127.0.0.1', () => console.log(`CRM available at http://localhost:${port}${demo ? ' (sample data)' : ''}`));
