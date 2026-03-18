const express = require('express');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const APP_DB_PATH = path.join(DATA_DIR, 'ciac_registro.db');
const SQL_SEED_PATH = path.join(DATA_DIR, 'matriz_estudiantes.sql');
const FALLBACK_DB_PATH = path.join(DATA_DIR, 'matrizsjvita.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(APP_DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');

function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function normalizeRun(input) {
  return String(input || '').replace(/\D/g, '');
}

function normalizeDv(input) {
  return String(input || '').trim().toUpperCase().replace(/[^0-9K]/g, '').slice(0, 1);
}

function computeDv(run) {
  const cleanRun = normalizeRun(run);
  let sum = 0;
  let multiplier = 2;

  for (let i = cleanRun.length - 1; i >= 0; i -= 1) {
    sum += Number(cleanRun[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}

function isValidRut(run, dv) {
  const cleanRun = normalizeRun(run);
  const cleanDv = normalizeDv(dv);
  if (!cleanRun || cleanRun.length < 7 || !cleanDv) return false;
  return computeDv(cleanRun) === cleanDv;
}

function tableExists(tableName) {
  return !!get(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, [tableName]);
}

function importSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  if (sql.trim()) db.exec(sql);
}

function importFromFallbackDb(filePath) {
  const sourceDb = new DatabaseSync(filePath, { readonly: true });
  try {
    const schema = sourceDb.prepare(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'matriz_estudiantes'`
    ).get();

    if (!schema || !schema.sql) {
      throw new Error('No se encontró la tabla matriz_estudiantes en la base externa.');
    }

    db.exec(schema.sql);

    const columnsInfo = sourceDb.prepare('PRAGMA table_xinfo(matriz_estudiantes)').all();
    const columns = columnsInfo.filter((column) => column.hidden === 0).map((column) => column.name);
    const rows = sourceDb.prepare(`SELECT ${columns.join(', ')} FROM matriz_estudiantes`).all();
    if (rows.length > 0) {
      const placeholders = columns.map(() => '?').join(', ');
      const insert = db.prepare(
        `INSERT INTO matriz_estudiantes (${columns.join(', ')}) VALUES (${placeholders})`
      );

      db.exec('BEGIN');
      try {
        for (const row of rows) {
          insert.run(...columns.map((column) => row[column]));
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  } finally {
    sourceDb.close();
  }
}

function ensureStudentSourceLoaded() {
  if (tableExists('matriz_estudiantes')) return;

  if (fs.existsSync(SQL_SEED_PATH)) {
    importSqlFile(SQL_SEED_PATH);
    return;
  }

  if (fs.existsSync(FALLBACK_DB_PATH)) {
    importFromFallbackDb(FALLBACK_DB_PATH);
    return;
  }

  throw new Error('No existe data/matriz_estudiantes.sql ni una base local de respaldo para cargar la matriz.');
}

function ensureAttendanceTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run TEXT NOT NULL,
      dv TEXT NOT NULL,
      nombre TEXT,
      carrera TEXT,
      anio_ingreso TEXT,
      entry_time TEXT NOT NULL,
      exit_time TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_run_open ON attendance_records(run, exit_time);
    CREATE INDEX IF NOT EXISTS idx_attendance_entry_time ON attendance_records(entry_time);
  `);
}

function detectStudentColumns() {
  const columns = all(`PRAGMA table_info(matriz_estudiantes)`);
  const names = columns.map((column) => column.name);

  const nameColumn = names.find((name) => /nombre/i.test(name)) || null;
  const careerColumn = names.includes('carrera_ingreso') ? 'carrera_ingreso' : (names.find((name) => /carrera/i.test(name)) || null);
  const cohortColumn = names.includes('cohorte') ? 'cohorte' : (names.find((name) => /ingreso|cohorte|anio/i.test(name)) || null);

  return {
    runColumn: names.includes('rut') ? 'rut' : (names.find((name) => /^run$|rut/i.test(name)) || null),
    dvColumn: names.includes('dv') ? 'dv' : (names.find((name) => /^dv$/i.test(name)) || null),
    nameColumn,
    careerColumn,
    cohortColumn
  };
}

function findStudentByRun(runValue) {
  const columns = detectStudentColumns();
  if (!columns.runColumn) return null;

  const selectParts = [
    `${columns.runColumn} AS run`,
    columns.dvColumn ? `${columns.dvColumn} AS dv` : `'' AS dv`,
    columns.nameColumn ? `${columns.nameColumn} AS nombre` : `NULL AS nombre`,
    columns.careerColumn ? `${columns.careerColumn} AS carrera` : `NULL AS carrera`,
    columns.cohortColumn ? `${columns.cohortColumn} AS anio_ingreso` : `NULL AS anio_ingreso`
  ];

  return get(
    `SELECT ${selectParts.join(', ')} FROM matriz_estudiantes WHERE ${columns.runColumn} = ? LIMIT 1`,
    [normalizeRun(runValue)]
  );
}

function formatRow(row) {
  return {
    id: row.id,
    hora_entrada: row.entry_time ? row.entry_time.slice(11, 16) : '',
    hora_salida: row.exit_time ? row.exit_time.slice(11, 16) : '',
    run: row.run,
    dv: row.dv,
    run_completo: `${row.run}-${String(row.dv || '').toUpperCase()}`,
    nombre: row.nombre || '',
    carrera: row.carrera || '',
    anio_ingreso: row.anio_ingreso || '',
    estado: row.exit_time ? 'Salida registrada' : 'Dentro del CIAC'
  };
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  try {
    const matrixCount = get('SELECT COUNT(*) AS total FROM matriz_estudiantes');
    const recordsCount = get('SELECT COUNT(*) AS total FROM attendance_records');
    res.json({ ok: true, matriz_estudiantes: matrixCount.total, attendance_records: recordsCount.total });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/students/by-run/:run', (req, res) => {
  try {
    const runValue = normalizeRun(req.params.run);
    if (runValue.length < 3) return res.json({ found: false });

    const student = findStudentByRun(runValue);
    if (!student) return res.json({ found: false });

    res.json({
      found: true,
      student: {
        run: student.run || runValue,
        dv: normalizeDv(student.dv),
        nombre: student.nombre || '',
        carrera: student.carrera || '',
        anio_ingreso: student.anio_ingreso ? String(student.anio_ingreso) : ''
      }
    });
  } catch (error) {
    res.status(500).json({ found: false, error: error.message });
  }
});

app.get('/api/records/today', (_req, res) => {
  try {
    const rows = all(`
      SELECT *
      FROM attendance_records
      WHERE date(entry_time, 'localtime') = date('now', 'localtime')
      ORDER BY entry_time DESC, id DESC
    `);
    res.json({ records: rows.map(formatRow) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/register', (req, res) => {
  try {
    const runValue = normalizeRun(req.body.run);
    const dvValue = normalizeDv(req.body.dv);
    const nombre = String(req.body.nombre || '').trim();
    const carrera = String(req.body.carrera || '').trim();
    const anioIngreso = String(req.body.anio_ingreso || '').trim();

    if (!isValidRut(runValue, dvValue)) {
      return res.status(400).json({ error: 'RUN o DV inválido.' });
    }

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio para registrar.' });
    }

    const openRecord = get(
      `SELECT * FROM attendance_records WHERE run = ? AND exit_time IS NULL ORDER BY id DESC LIMIT 1`,
      [runValue]
    );

    if (!openRecord) {
      const result = run(
        `INSERT INTO attendance_records (run, dv, nombre, carrera, anio_ingreso, entry_time)
         VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
        [runValue, dvValue, nombre, carrera, anioIngreso]
      );
      const created = get(`SELECT * FROM attendance_records WHERE id = ?`, [result.lastInsertRowid]);
      return res.json({ action: 'entrada', message: 'Entrada registrada correctamente.', record: formatRow(created) });
    }

    run(
      `UPDATE attendance_records
       SET exit_time = datetime('now', 'localtime'),
           nombre = ?, carrera = ?, anio_ingreso = ?, dv = ?
       WHERE id = ?`,
      [nombre, carrera, anioIngreso, dvValue, openRecord.id]
    );

    const updated = get(`SELECT * FROM attendance_records WHERE id = ?`, [openRecord.id]);
    return res.json({ action: 'salida', message: 'Salida registrada correctamente.', record: formatRow(updated) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

try {
  ensureStudentSourceLoaded();
  ensureAttendanceTable();
  app.listen(PORT, () => {
    console.log(`CIAC Registro MVP ejecutándose en http://localhost:${PORT}`);
  });
} catch (error) {
  console.error('No se pudo iniciar la app:', error);
  process.exit(1);
}
