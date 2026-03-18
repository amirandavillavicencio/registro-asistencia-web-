function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('JSON inválido.'));
      }
    });

    req.on('error', () => {
      reject(new Error('No fue posible leer la solicitud.'));
    });
  });
}

function validarRut(run, dv) {
  if (!/^\d+$/.test(run)) {
    return false;
  }

  if (!/^[0-9K]$/.test(dv)) {
    return false;
  }

  let suma = 0;
  let multiplicador = 2;

  for (let index = run.length - 1; index >= 0; index -= 1) {
    suma += Number(run[index]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return esperado === dv;
}

function getStore() {
  if (!globalThis.__REGISTROS_MVP__) {
    globalThis.__REGISTROS_MVP__ = [];
  }

  return globalThis.__REGISTROS_MVP__;
}

function getFechaChileParts() {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(new Date());
  const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));

  return {
    fecha: `${map.year}-${map.month}-${map.day}`,
    hora: `${map.hour}:${map.minute}:${map.second}`
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }

  try {
    const payload = await readJsonBody(req);
    const run = String(payload.run || '').replace(/\D/g, '');
    const dv = String(payload.dv || '').trim().toUpperCase().replace(/[^0-9K]/g, '').slice(0, 1);
    const nombre = String(payload.nombre || '').trim();
    const carrera = String(payload.carrera || '').trim();
    const anioIngreso = String(payload.anio_ingreso || '').trim();

    if (!run) {
      return sendJson(res, 400, { error: 'El RUN es obligatorio y debe contener solo números.' });
    }

    if (!dv || !/^[0-9K]$/.test(dv)) {
      return sendJson(res, 400, { error: 'El DV es obligatorio y debe tener un solo carácter válido (0-9 o K).' });
    }

    if (!nombre) {
      return sendJson(res, 400, { error: 'El nombre es obligatorio.' });
    }

    if (!validarRut(run, dv)) {
      return sendJson(res, 400, { error: 'El RUT ingresado no es válido.' });
    }

    const store = getStore();
    const { fecha, hora } = getFechaChileParts();
    const runCompleto = `${run}-${dv}`;
    const registroAbierto = [...store].reverse().find((item) => item.run === run && item.fecha === fecha && !item.hora_salida);

    if (registroAbierto) {
      registroAbierto.hora_salida = hora;
      registroAbierto.estado = 'Salida registrada';

      return sendJson(res, 200, {
        ok: true,
        action: 'salida',
        message: `Salida registrada para ${registroAbierto.nombre}.`,
        record: registroAbierto
      });
    }

    const nuevoRegistro = {
      fecha,
      run,
      dv,
      run_completo: runCompleto,
      nombre,
      carrera,
      anio_ingreso: anioIngreso,
      hora_entrada: hora,
      hora_salida: '',
      estado: 'Entrada registrada'
    };

    store.push(nuevoRegistro);

    return sendJson(res, 200, {
      ok: true,
      action: 'entrada',
      message: `Entrada registrada para ${nombre}.`,
      record: nuevoRegistro
    });
  } catch (error) {
    const statusCode = error.message === 'JSON inválido.' ? 400 : 500;
    return sendJson(res, statusCode, { error: error.message || 'Error interno del servidor.' });
  }
};
