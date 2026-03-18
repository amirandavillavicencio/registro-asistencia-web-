const fs = require('fs');
const path = require('path');
const buscar = require('../api/buscar');
const registrar = require('../api/registrar');
const registrosHoy = require('../api/registros-hoy');

const localStore = path.join(process.cwd(), 'data', 'attendance-records.json');
if (fs.existsSync(localStore)) fs.unlinkSync(localStore);

function runHandler(handler, { method = 'GET', url = '/', body } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const req = {
      method,
      url,
      headers: body ? { 'content-type': 'application/json' } : {},
      [Symbol.asyncIterator]: async function* iterator() {
        if (body) {
          yield Buffer.from(JSON.stringify(body));
        }
      }
    };

    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
      },
      end(value) {
        chunks.push(value ? Buffer.from(value) : Buffer.alloc(0));
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          resolve({ statusCode: this.statusCode, body: raw ? JSON.parse(raw) : null });
        } catch (error) {
          reject(error);
        }
      }
    };

    Promise.resolve(handler(req, res)).catch(reject);
  });
}

(async () => {
  const lookup = await runHandler(buscar, { url: '/api/buscar?run=22222222' });
  if (lookup.statusCode !== 200 || typeof lookup.body.found !== 'boolean') {
    throw new Error('Falló /api/buscar');
  }

  const invalid = await runHandler(registrar, {
    method: 'POST',
    url: '/api/registrar',
    body: { run: '123', dv: '1', nombre: 'Test' }
  });
  if (invalid.statusCode !== 400) {
    throw new Error('Debió rechazar RUT inválido');
  }

  const entrada = await runHandler(registrar, {
    method: 'POST',
    url: '/api/registrar',
    body: { run: '11111111', dv: '1', nombre: 'Persona Demo', carrera: 'Piloto', anio_ingreso: '2024' }
  });
  if (entrada.statusCode !== 200 || entrada.body.action !== 'entrada') {
    throw new Error('Falló registro de entrada');
  }

  const salida = await runHandler(registrar, {
    method: 'POST',
    url: '/api/registrar',
    body: { run: '11111111', dv: '1', nombre: 'Persona Demo', carrera: 'Piloto', anio_ingreso: '2024' }
  });
  if (salida.statusCode !== 200 || salida.body.action !== 'salida') {
    throw new Error('Falló registro de salida');
  }

  const hoy = await runHandler(registrosHoy, { url: '/api/registros-hoy' });
  if (hoy.statusCode !== 200 || !Array.isArray(hoy.body.records)) {
    throw new Error('Falló /api/registros-hoy');
  }

  console.log('Smoke test OK');
  if (fs.existsSync(localStore)) fs.unlinkSync(localStore);
})();
