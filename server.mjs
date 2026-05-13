import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number.parseInt(process.argv[2] || '4173', 10);

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.json', 'application/json; charset=utf-8']
]);

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
    res.writeHead(200, {
      'Content-Type': mimeTypes.get(path.extname(resolvedFile).toLowerCase()) || 'application/octet-stream'
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Preview server running at http://127.0.0.1:${port}/`);
});
