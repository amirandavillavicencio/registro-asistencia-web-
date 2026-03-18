const estudiantes = [
  {
    rut: '12345678',
    dv: '9',
    nombre: 'Juan Pérez',
    carrera_ingreso: 'Ingeniería Civil',
    cohorte: '2022'
  }
];

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }

  const url = new URL(req.url, 'http://localhost');
  const run = String(url.searchParams.get('run') || '').replace(/\D/g, '');

  if (!run) {
    return sendJson(res, 200, { found: false });
  }

  const student = estudiantes.find((item) => item.rut === run);

  if (!student) {
    return sendJson(res, 200, { found: false });
  }

  return sendJson(res, 200, {
    found: true,
    student: {
      rut: student.rut,
      dv: student.dv,
      nombre: student.nombre,
      carrera_ingreso: student.carrera_ingreso,
      cohorte: student.cohorte
    }
  });
};
