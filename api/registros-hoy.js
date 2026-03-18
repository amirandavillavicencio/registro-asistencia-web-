function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function getStore() {
  if (!globalThis.__REGISTROS_MVP__) {
    globalThis.__REGISTROS_MVP__ = [];
  }

  return globalThis.__REGISTROS_MVP__;
}

function getFechaChile() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }

  const fecha = getFechaChile();
  const records = getStore()
    .filter((item) => item.fecha === fecha)
    .slice()
    .reverse();

  return sendJson(res, 200, { records });
};
