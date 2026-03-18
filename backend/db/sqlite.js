const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DB_PATH = path.join(process.cwd(), 'data', 'ciac_registro.sqlite');
const MATRIZ_SQL_PATH = path.join(process.cwd(), 'data', 'matriz_estudiantes.sql');

function ensureDataDir() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

function sqliteArgs(sql, options = {}) {
  const args = [DB_PATH, '-json'];
  if (options.init) args.push('-init', options.init);
  args.push(sql);
  return args;
}

function runJson(sql) {
  ensureDataDir();
  const raw = execFileSync('sqlite3', sqliteArgs(sql), { encoding: 'utf8' }).trim();
  return raw ? JSON.parse(raw) : [];
}

function run(sql) {
  ensureDataDir();
  execFileSync('sqlite3', [DB_PATH, sql], { encoding: 'utf8' });
}

function escapeSqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function getScalar(sql) {
  const rows = runJson(sql);
  if (!rows[0]) return null;
  return Object.values(rows[0])[0] ?? null;
}

function tableExists(tableName) {
  return !!getScalar(`SELECT name FROM sqlite_master WHERE type='table' AND name=${escapeSqlValue(tableName)};`);
}

function getColumns(tableName) {
  return runJson(`PRAGMA table_info(${tableName});`).map((column) => column.name);
}

function initializeDatabase() {
  ensureDataDir();
  run(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campus TEXT NOT NULL,
      fecha TEXT NOT NULL,
      run TEXT NOT NULL,
      dv TEXT,
      nombre TEXT,
      carrera TEXT,
      jornada TEXT,
      anio_ingreso TEXT,
      actividad TEXT,
      tematica TEXT,
      espacio TEXT,
      observaciones TEXT,
      hora_entrada TEXT,
      hora_salida TEXT,
      estado TEXT NOT NULL DEFAULT 'abierto',
      duracion_minutos INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_attendance_run_fecha ON attendance_records(run, fecha);
    CREATE INDEX IF NOT EXISTS idx_attendance_campus_estado ON attendance_records(campus, estado);
  `);

  if (!tableExists('matriz_estudiantes') && fs.existsSync(MATRIZ_SQL_PATH)) {
    execFileSync('sqlite3', [DB_PATH], {
      input: fs.readFileSync(MATRIZ_SQL_PATH, 'utf8'),
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
  }
}

module.exports = {
  DB_PATH,
  MATRIZ_SQL_PATH,
  run,
  runJson,
  getScalar,
  tableExists,
  getColumns,
  initializeDatabase,
  escapeSqlValue,
};
