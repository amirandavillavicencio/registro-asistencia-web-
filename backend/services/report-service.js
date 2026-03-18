const { runJson } = require('../db/sqlite');

function summarize() {
  const totals = runJson(`
    SELECT
      COUNT(*) AS total_registros,
      ROUND(COALESCE(SUM(duracion_minutos), 0) / 60.0, 2) AS total_horas,
      ROUND(AVG(CASE WHEN duracion_minutos IS NOT NULL THEN duracion_minutos END), 2) AS promedio_duracion,
      COUNT(DISTINCT CASE WHEN carrera IS NOT NULL AND TRIM(carrera) <> '' THEN carrera END) AS carreras_distintas
    FROM attendance_records;
  `)[0] || {};

  const byActivity = runJson(`SELECT COALESCE(NULLIF(TRIM(actividad), ''), 'Sin actividad') AS label, COUNT(*) AS total FROM attendance_records GROUP BY label ORDER BY total DESC, label ASC;`);
  const byTematica = runJson(`SELECT COALESCE(NULLIF(TRIM(tematica), ''), 'Sin temática') AS label, COUNT(*) AS total FROM attendance_records GROUP BY label ORDER BY total DESC, label ASC;`);
  const topCarreras = runJson(`SELECT COALESCE(NULLIF(TRIM(carrera), ''), 'Sin carrera') AS label, COUNT(*) AS total FROM attendance_records GROUP BY label ORDER BY total DESC, label ASC LIMIT 10;`);
  const byCampus = runJson(`SELECT COALESCE(NULLIF(TRIM(campus), ''), 'Sin campus') AS label, COUNT(*) AS total FROM attendance_records GROUP BY label ORDER BY total DESC, label ASC;`);
  const bySemestre = runJson(`
    SELECT
      CASE
        WHEN anio_ingreso GLOB '[0-9][0-9][0-9][0-9]' THEN CAST(((CAST(strftime('%Y','now') AS INTEGER) - CAST(anio_ingreso AS INTEGER)) * 2) + CASE WHEN CAST(strftime('%m','now') AS INTEGER) BETWEEN 1 AND 6 THEN 1 ELSE 2 END AS TEXT)
        ELSE 'No disponible'
      END AS label,
      COUNT(*) AS total
    FROM attendance_records
    GROUP BY label
    ORDER BY CASE WHEN label = 'No disponible' THEN 9999 ELSE CAST(label AS INTEGER) END ASC;
  `);

  const byCarreraTable = runJson(`
    SELECT
      COALESCE(NULLIF(TRIM(carrera), ''), 'Sin carrera') AS carrera,
      COUNT(*) AS registros,
      ROUND(COALESCE(SUM(duracion_minutos), 0) / 60.0, 2) AS horas_acumuladas,
      ROUND(AVG(CASE WHEN duracion_minutos IS NOT NULL THEN duracion_minutos END), 2) AS promedio_duracion
    FROM attendance_records
    GROUP BY carrera
    ORDER BY registros DESC, carrera ASC;
  `);

  return {
    kpis: totals,
    byActivity,
    byTematica,
    topCarreras,
    byCampus,
    bySemestre,
    byCarreraTable,
  };
}

module.exports = { summarize };
