const { getRecords, saveRecords, getStorageMode } = require('./storage');
const { normalizeRun, normalizeDv, isValidRut } = require('./rut');

function nowIso() {
  return new Date().toISOString();
}

function toChileDateParts(value) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`
  };
}

function formatRecord(record) {
  const entry = toChileDateParts(record.entry_time);
  const exit = record.exit_time ? toChileDateParts(record.exit_time) : null;

  return {
    id: record.id,
    hora_entrada: entry.time,
    hora_salida: exit ? exit.time : '',
    run: record.run,
    dv: record.dv,
    run_completo: `${record.run}-${record.dv}`,
    nombre: record.nombre || '',
    carrera: record.carrera || '',
    anio_ingreso: record.anio_ingreso || '',
    estado: record.exit_time ? 'Salida registrada' : 'Dentro del CIAC'
  };
}

async function getTodayRecords() {
  const today = toChileDateParts(nowIso()).day;
  const records = await getRecords();

  return records
    .filter((record) => toChileDateParts(record.entry_time).day === today)
    .sort((a, b) => (a.entry_time < b.entry_time ? 1 : -1))
    .map(formatRecord);
}

async function registerAttendance(payload) {
  const run = normalizeRun(payload.run);
  const dv = normalizeDv(payload.dv);
  const nombre = String(payload.nombre || '').trim();
  const carrera = String(payload.carrera || '').trim();
  const anioIngreso = String(payload.anio_ingreso || '').trim();

  if (!isValidRut(run, dv)) {
    throw new Error('RUN o DV inválido.');
  }

  if (!nombre) {
    throw new Error('El nombre es obligatorio para registrar.');
  }

  const records = await getRecords();
  const openRecord = [...records].reverse().find((record) => record.run === run && !record.exit_time);

  if (!openRecord) {
    const created = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      run,
      dv,
      nombre,
      carrera,
      anio_ingreso: anioIngreso,
      entry_time: nowIso(),
      exit_time: null
    };

    records.push(created);
    await saveRecords(records);

    return {
      action: 'entrada',
      message: 'Entrada registrada correctamente.',
      record: formatRecord(created)
    };
  }

  openRecord.dv = dv;
  openRecord.nombre = nombre;
  openRecord.carrera = carrera;
  openRecord.anio_ingreso = anioIngreso;
  openRecord.exit_time = nowIso();
  await saveRecords(records);

  return {
    action: 'salida',
    message: 'Salida registrada correctamente.',
    record: formatRecord(openRecord)
  };
}

module.exports = {
  getTodayRecords,
  registerAttendance,
  getStorageMode
};
