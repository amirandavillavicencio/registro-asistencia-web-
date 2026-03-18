const { runJson, tableExists, getColumns, escapeSqlValue } = require('../db/sqlite');

function pickColumn(columns, candidates) {
  const normalized = new Map(columns.map((col) => [col.toLowerCase(), col]));
  for (const candidate of candidates) {
    if (normalized.has(candidate.toLowerCase())) return normalized.get(candidate.toLowerCase());
  }
  return null;
}

function getMatrizMapping() {
  if (!tableExists('matriz_estudiantes')) return null;
  const columns = getColumns('matriz_estudiantes');
  if (!columns.length) return null;

  const mapping = {
    run: pickColumn(columns, ['rut', 'run', 'runn', 'rut_alumno']),
    dv: pickColumn(columns, ['dv', 'dvrut', 'digito_verificador']),
    nombre: pickColumn(columns, ['nombre', 'nombre_completo', 'alumno', 'estudiante', 'nom_alumno']),
    carrera: pickColumn(columns, ['carrera_ingreso', 'carrera', 'programa', 'plan']),
    anioIngreso: pickColumn(columns, ['cohorte', 'anio_ingreso', 'ano_ingreso', 'ingreso'])
  };

  if (!mapping.run) return null;
  return mapping;
}

function cleanRun(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function normalizeStudent(row) {
  if (!row) return null;
  return {
    run: cleanRun(row.run),
    dv: row.dv ? String(row.dv).trim().toUpperCase() : '',
    nombre: row.nombre ? String(row.nombre).trim() : '',
    carrera: row.carrera ? String(row.carrera).trim() : '',
    anio_ingreso: row.anio_ingreso ? String(row.anio_ingreso).trim() : '',
  };
}

function findStudentByRun(run) {
  const sanitizedRun = cleanRun(run);
  if (!sanitizedRun) return null;

  const mapping = getMatrizMapping();
  if (mapping) {
    const select = [
      `${mapping.run} AS run`,
      mapping.dv ? `${mapping.dv} AS dv` : `'' AS dv`,
      mapping.nombre ? `${mapping.nombre} AS nombre` : `'' AS nombre`,
      mapping.carrera ? `${mapping.carrera} AS carrera` : `'' AS carrera`,
      mapping.anioIngreso ? `${mapping.anioIngreso} AS anio_ingreso` : `'' AS anio_ingreso`,
    ].join(', ');

    const rows = runJson(`
      SELECT ${select}
      FROM matriz_estudiantes
      WHERE REPLACE(REPLACE(CAST(${mapping.run} AS TEXT), '.', ''), '-', '') = ${escapeSqlValue(sanitizedRun)}
      LIMIT 1;
    `);

    const student = normalizeStudent(rows[0]);
    if (student) return { ...student, source: 'matriz_estudiantes' };
  }

  const fallbackRows = runJson(`
    SELECT run, dv, nombre, carrera, anio_ingreso
    FROM attendance_records
    WHERE run = ${escapeSqlValue(sanitizedRun)}
      AND (nombre IS NOT NULL OR carrera IS NOT NULL OR anio_ingreso IS NOT NULL)
    ORDER BY created_at DESC
    LIMIT 1;
  `);

  const fallback = normalizeStudent(fallbackRows[0]);
  return fallback ? { ...fallback, source: 'attendance_records' } : null;
}

module.exports = { findStudentByRun, getMatrizMapping, cleanRun };
