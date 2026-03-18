const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { normalizeRun, normalizeDv } = require('./rut');

const MATRIX_DB_PATH = path.join(process.cwd(), 'data', 'matrizsjvita.db');
let cachedColumns = null;

function openMatrixDb() {
  if (!fs.existsSync(MATRIX_DB_PATH)) {
    throw new Error('No se encontró data/matrizsjvita.db.');
  }

  return new DatabaseSync(MATRIX_DB_PATH, { readonly: true });
}

function detectColumns(db) {
  if (cachedColumns) {
    return cachedColumns;
  }

  const columns = db.prepare('PRAGMA table_info(matriz_estudiantes)').all();
  const names = columns.map((column) => column.name);

  cachedColumns = {
    runColumn: names.includes('rut') ? 'rut' : (names.find((name) => /^run$|rut/i.test(name)) || null),
    dvColumn: names.includes('dv') ? 'dv' : (names.find((name) => /^dv$/i.test(name)) || null),
    nameColumn: names.find((name) => /nombre/i.test(name)) || null,
    careerColumn: names.includes('carrera_ingreso') ? 'carrera_ingreso' : (names.find((name) => /carrera/i.test(name)) || null),
    cohortColumn: names.includes('cohorte') ? 'cohorte' : (names.find((name) => /ingreso|cohorte|anio/i.test(name)) || null)
  };

  return cachedColumns;
}

function getStudentByRun(runValue) {
  const normalizedRun = normalizeRun(runValue);
  if (!normalizedRun) {
    return null;
  }

  const db = openMatrixDb();

  try {
    const columns = detectColumns(db);
    if (!columns.runColumn) {
      throw new Error('La matriz no tiene una columna equivalente a rut/run.');
    }

    const selectParts = [
      `${columns.runColumn} AS run`,
      columns.dvColumn ? `${columns.dvColumn} AS dv` : "'' AS dv",
      columns.nameColumn ? `${columns.nameColumn} AS nombre` : 'NULL AS nombre',
      columns.careerColumn ? `${columns.careerColumn} AS carrera` : 'NULL AS carrera',
      columns.cohortColumn ? `${columns.cohortColumn} AS anio_ingreso` : 'NULL AS anio_ingreso'
    ];

    const row = db.prepare(
      `SELECT ${selectParts.join(', ')} FROM matriz_estudiantes WHERE ${columns.runColumn} = ? LIMIT 1`
    ).get(normalizedRun);

    if (!row) {
      return null;
    }

    return {
      run: normalizeRun(row.run) || normalizedRun,
      dv: normalizeDv(row.dv),
      nombre: row.nombre ? String(row.nombre).trim() : '',
      carrera: row.carrera ? String(row.carrera).trim() : '',
      anio_ingreso: row.anio_ingreso ? String(row.anio_ingreso).trim() : ''
    };
  } finally {
    db.close();
  }
}

module.exports = {
  getStudentByRun
};
