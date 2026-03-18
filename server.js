const http = require('http');
const fs = require('fs');
const path = require('path');
const buscarHandler = require('./api/buscar');
const registrarHandler = require('./api/registrar');
const registrosHoyHandler = require('./api/registros-hoy');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(process.cwd(), 'public');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', mimeTypes[path.extname(filePath)] || 'text/plain; charset=utf-8');
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/buscar') return buscarHandler(req, res);
  if (url.pathname === '/api/registrar') return registrarHandler(req, res);
  if (url.pathname === '/api/registros-hoy') return registrosHoyHandler(req, res);
  if (url.pathname === '/' || url.pathname === '/index.html') return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
  if (url.pathname.startsWith('/public/')) return sendFile(res, path.join(process.cwd(), url.pathname.slice(1))); 

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`CIAC Registro MVP disponible en http://localhost:${PORT}`);
});
