const { run, runJson, escapeSqlValue } = require('../db/sqlite');
const { cleanRun } = require('./student-service');

function nowParts(date = new Date()) {
  const iso = date.toISOString();
  return {
    fecha: iso.slice(0, 10),
    hora: iso.slice(11, 19),
    createdAt: iso.slice(0, 19).replace('T', ' '),
  };
}

function parseDurationMinutes(fecha, horaEntrada, horaSalida) {
  if (!fecha || !horaEntrada || !horaSalida) return null;
  const start = new Date(`${fecha}T${horaEntrada}Z`);
  const end = new Date(`${fecha}T${horaSalida}Z`);
  const diff = Math.round((end - start) / 60000);
  return Number.isFinite(diff) && diff >= 0 ? diff : null;
}

function findOpenRecord(run, campus) {
  const rows = runJson(`
    SELECT * FROM attendance_records
    WHERE run = ${escapeSqlValue(cleanRun(run))}
      AND campus = ${escapeSqlValue(campus)}
      AND hora_entrada IS NOT NULL
      AND (hora_salida IS NULL OR hora_salida = '')
      AND estado = 'abierto'
    ORDER BY id DESC
    LIMIT 1;
  `);
  return rows[0] || null;
}

function registerAttendance(payload) {
  const runValue = cleanRun(payload.run);
  const dv = String(payload.dv || '').trim().toUpperCase();
  const campus = payload.campus;
  if (!runValue || !campus) throw new Error('RUN y campus son obligatorios.');

  const openRecord = findOpenRecord(runValue, campus);
  const current = nowParts();

  if (openRecord) {
    const horaSalida = current.hora;
    const duracion = parseDurationMinutes(openRecord.fecha, openRecord.hora_entrada, horaSalida);
    run(`
      UPDATE attendance_records
      SET hora_salida = ${escapeSqlValue(horaSalida)},
          estado = 'cerrado',
          duracion_minutos = ${duracion ?? 'NULL'}
      WHERE id = ${openRecord.id};
    `);
    const updated = runJson(`SELECT * FROM attendance_records WHERE id = ${openRecord.id};`)[0];
    return { action: 'salida', record: updated };
  }

  run(`
    INSERT INTO attendance_records (
      campus, fecha, run, dv, nombre, carrera, jornada, anio_ingreso,
      actividad, tematica, espacio, observaciones, hora_entrada, estado, created_at
    ) VALUES (
      ${escapeSqlValue(campus)},
      ${escapeSqlValue(current.fecha)},
      ${escapeSqlValue(runValue)},
      ${escapeSqlValue(dv)},
      ${escapeSqlValue(payload.nombre || '')},
      ${escapeSqlValue(payload.carrera || '')},
      ${escapeSqlValue(payload.jornada || '')},
      ${escapeSqlValue(payload.anio_ingreso || '')},
      ${escapeSqlValue(payload.actividad || '')},
      ${escapeSqlValue(payload.tematica || '')},
      ${escapeSqlValue(payload.espacio || '')},
      ${escapeSqlValue(payload.observaciones || '')},
      ${escapeSqlValue(current.hora)},
      'abierto',
      ${escapeSqlValue(current.createdAt)}
    );
  `);

  const inserted = runJson('SELECT * FROM attendance_records ORDER BY id DESC LIMIT 1;')[0];
  return { action: 'entrada', record: inserted };
}

function closeAttendanceById(id) {
  const rows = runJson(`SELECT * FROM attendance_records WHERE id = ${Number(id)} LIMIT 1;`);
  const record = rows[0];
  if (!record) throw new Error('Registro no encontrado.');
  if (record.hora_salida) return record;
  const current = nowParts();
  const duracion = parseDurationMinutes(record.fecha, record.hora_entrada, current.hora);
  run(`
    UPDATE attendance_records
    SET hora_salida = ${escapeSqlValue(current.hora)},
        estado = 'cerrado',
        duracion_minutos = ${duracion ?? 'NULL'}
    WHERE id = ${Number(id)};
  `);
  return runJson(`SELECT * FROM attendance_records WHERE id = ${Number(id)} LIMIT 1;`)[0];
}

function listTodayRecords() {
  const today = nowParts().fecha;
  return runJson(`
    SELECT * FROM attendance_records
    WHERE fecha = ${escapeSqlValue(today)}
    ORDER BY id DESC
    LIMIT 100;
  `);
}

function listAllRecords() {
  return runJson(`SELECT * FROM attendance_records ORDER BY fecha DESC, hora_entrada DESC, id DESC;`);
}

module.exports = {
  registerAttendance,
  closeAttendanceById,
  listTodayRecords,
  listAllRecords,
};
