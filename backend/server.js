const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { initializeDatabase, tableExists, MATRIZ_SQL_PATH } = require('./db/sqlite');
const { findStudentByRun, getMatrizMapping } = require('./services/student-service');
const { registerAttendance, closeAttendanceById, listTodayRecords } = require('./services/attendance-service');
const { summarize } = require('./services/report-service');
const { generateExcel } = require('./services/export-service');
const { readBody, sendJson, serveStatic } = require('./utils/http');

initializeDatabase();

const publicDir = path.join(process.cwd(), 'public');
const exportsDir = path.join(process.cwd(), 'data', 'exports');
fs.mkdirSync(exportsDir, { recursive: true });

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  try {
    if (req.method === 'GET' && req.url.startsWith('/api/health')) {
      return sendJson(res, 200, {
        ok: true,
        matrizDisponible: tableExists('matriz_estudiantes'),
        matrizSqlPresente: fs.existsSync(MATRIZ_SQL_PATH),
        matrizMapping: getMatrizMapping(),
      });
    }

    if (req.method === 'GET' && req.url.startsWith('/api/student/')) {
      const run = req.url.split('/').pop();
      return sendJson(res, 200, { student: findStudentByRun(run) });
    }

    if (req.method === 'GET' && req.url.startsWith('/api/records/today')) {
      return sendJson(res, 200, { records: listTodayRecords() });
    }

    if (req.method === 'GET' && req.url.startsWith('/api/reports/summary')) {
      return sendJson(res, 200, summarize());
    }

    if (req.method === 'GET' && req.url.startsWith('/api/export/xlsx')) {
      const fileName = `ciac-registro-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.xlsx`;
      const filePath = path.join(exportsDir, fileName);
      generateExcel(filePath);
      const buffer = fs.readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length,
      });
      return res.end(buffer);
    }

    if (req.method === 'POST' && req.url === '/api/attendance/register') {
      const body = await readBody(req);
      return sendJson(res, 200, registerAttendance(body));
    }

    if (req.method === 'POST' && req.url.startsWith('/api/attendance/close/')) {
      const id = req.url.split('/').pop();
      return sendJson(res, 200, { record: closeAttendanceById(id) });
    }

    if (req.method === 'GET' && serveStatic(req, res, publicDir)) return;

    sendJson(res, 404, { error: 'Ruta no encontrada.' });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Error interno.' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`CIAC Registro disponible en http://localhost:${PORT}`);
});
