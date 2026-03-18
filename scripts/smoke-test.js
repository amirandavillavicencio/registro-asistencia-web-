const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert');

const repo = process.cwd();
const dbPath = path.join(repo, 'data', 'ciac_registro.sqlite');
const exportDir = path.join(repo, 'data', 'exports');
fs.rmSync(dbPath, { force: true });
fs.rmSync(exportDir, { recursive: true, force: true });
fs.mkdirSync(path.join(repo, 'data'), { recursive: true });
fs.writeFileSync(path.join(repo, 'data', 'matriz_estudiantes.sql'), `
CREATE TABLE matriz_estudiantes (rut TEXT, dv TEXT, nombre TEXT, carrera_ingreso TEXT, cohorte TEXT);
INSERT INTO matriz_estudiantes VALUES ('12345678','K','Ana Pérez','Ingeniería Civil Informática','2023');
INSERT INTO matriz_estudiantes VALUES ('87654321','1','Luis Soto','Ingeniería Civil','2022');
`);

function request(method, route, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: 3000, path: route, method, headers: body ? { 'Content-Type': 'application/json' } : {} }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => { chunks.push(chunk); });
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ status: res.statusCode, body: buffer.toString('utf8'), buffer, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  const server = spawn('node', ['backend/server.js'], { cwd: repo, stdio: 'inherit' });
  await new Promise((r) => setTimeout(r, 1200));
  try {
    const health = await request('GET', '/api/health');
    const healthBody = JSON.parse(health.body);
    assert.equal(healthBody.matrizDisponible, true);

    const student = await request('GET', '/api/student/12345678');
    const studentBody = JSON.parse(student.body);
    assert.equal(studentBody.student.nombre, 'Ana Pérez');
    assert.equal(studentBody.student.dv, 'K');

    const entry = await request('POST', '/api/attendance/register', {
      campus: 'Campus San Joaquín', run: '12345678', dv: 'k', nombre: 'Ana Pérez', carrera: 'Ingeniería Civil Informática', jornada: 'Diurno', anio_ingreso: '2023', actividad: 'Consultas', tematica: 'Programación', espacio: 'Sala 1', observaciones: 'Primera visita'
    });
    assert.equal(JSON.parse(entry.body).action, 'entrada');

    const today = await request('GET', '/api/records/today');
    assert.equal(JSON.parse(today.body).records.length >= 1, true);

    const exit = await request('POST', '/api/attendance/register', { campus: 'Campus San Joaquín', run: '12345678', dv: 'K' });
    assert.equal(JSON.parse(exit.body).action, 'salida');

    const report = await request('GET', '/api/reports/summary');
    const reportBody = JSON.parse(report.body);
    assert.equal(reportBody.kpis.total_registros >= 1, true);

    const exportRes = await request('GET', '/api/export/xlsx');
    assert.equal(exportRes.status, 200);
    const tempExport = path.join(repo, 'data', 'smoke-export.xlsx');
    fs.writeFileSync(tempExport, exportRes.buffer);
    const list = spawn('unzip', ['-l', tempExport], { cwd: repo });
    let unzipOutput = '';
    for await (const chunk of list.stdout) unzipOutput += chunk.toString();
    await new Promise((resolve) => list.on('close', resolve));
    assert.match(unzipOutput, /xl\/worksheets\/sheet1.xml/);

    console.log('Smoke test OK');
  } finally {
    server.kill('SIGTERM');
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
