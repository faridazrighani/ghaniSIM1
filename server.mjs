import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number.parseInt(process.argv[2] || '4173', 10);

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.json', 'application/json; charset=utf-8']
]);

const compressibleTypes = new Set(['.html', '.css', '.js', '.svg', '.json']);

function canGzip(req, ext) {
  return compressibleTypes.has(ext) && /\bgzip\b/i.test(req.headers['accept-encoding'] || '');
}

function gzip(data) {
  return new Promise((resolve, reject) => {
    zlib.gzip(data, { level: 9 }, (err, output) => {
      if (err) reject(err);
      else resolve(output);
    });
  });
}

function responseHeaders(resolvedFile, encoded) {
  const ext = path.extname(resolvedFile).toLowerCase();
  const isHtml = ext === '.html';
  return {
    'Content-Type': mimeTypes.get(ext) || 'application/octet-stream',
    'Content-Encoding': encoded ? 'gzip' : undefined,
    'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };
}

function cleanHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== undefined));
}

function safeResolve(urlPath) {
  const decodedPath = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
  const resolvedPath = path.normalize(path.join(__dirname, decodedPath));
  return resolvedPath.startsWith(__dirname) ? resolvedPath : null;
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const filePath = safeResolve(requestUrl.pathname);
    if (!filePath) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const stat = await fs.stat(filePath);
    const resolvedFile = stat.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    const data = await fs.readFile(resolvedFile);
    const ext = path.extname(resolvedFile).toLowerCase();
    const shouldGzip = canGzip(req, ext);
    const payload = shouldGzip ? await gzip(data) : data;
    res.writeHead(200, cleanHeaders(responseHeaders(resolvedFile, shouldGzip)));
    res.end(payload);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Preview server running at http://127.0.0.1:${port}/`);
});
