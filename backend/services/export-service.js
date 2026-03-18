const fs = require('node:fs');
const path = require('node:path');
const { listAllRecords } = require('./attendance-service');

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colName(index) {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function sheetXml(rows) {
  const headers = [
    'Día', 'Hora Entrada', 'Hora Salida', 'RUN', 'Dígito V', 'Nombre', 'Carrera', 'Sede',
    'Año Ingreso', 'Jornada', 'Actividad', 'Temática', 'Espacio', 'Observaciones'
  ];
  const allRows = [headers, ...rows.map((record) => [
    record.fecha || '',
    record.hora_entrada || '',
    record.hora_salida || '',
    record.run || '',
    record.dv || '',
    record.nombre || '',
    record.carrera || '',
    record.campus || '',
    record.anio_ingreso || '',
    record.jornada || '',
    record.actividad || '',
    record.tematica || '',
    record.espacio || '',
    record.observaciones || ''
  ])];

  const rowXml = allRows.map((row, rIdx) => {
    const cells = row.map((value, cIdx) => `<c r="${colName(cIdx)}${rIdx + 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`).join('');
    return `<row r="${rIdx + 1}">${cells}</row>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <sheetData>${rowXml}</sheetData>
  </worksheet>`;
}

function workbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <sheets><sheet name="CIAC Registro" sheetId="1" r:id="rId1"/></sheets>
  </workbook>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
    <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  </Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  </Relationships>`;
}

function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  </Relationships>`;
}

function generateExcel(outputPath) {
  const rows = listAllRecords();
  const tempDir = fs.mkdtempSync(path.join(path.dirname(outputPath), 'xlsx-'));
  fs.mkdirSync(path.join(tempDir, '_rels'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'xl', '_rels'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'xl', 'worksheets'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, '[Content_Types].xml'), contentTypesXml());
  fs.writeFileSync(path.join(tempDir, '_rels', '.rels'), rootRelsXml());
  fs.writeFileSync(path.join(tempDir, 'xl', 'workbook.xml'), workbookXml());
  fs.writeFileSync(path.join(tempDir, 'xl', '_rels', 'workbook.xml.rels'), workbookRelsXml());
  fs.writeFileSync(path.join(tempDir, 'xl', 'worksheets', 'sheet1.xml'), sheetXml(rows));

  require('node:child_process').execFileSync('zip', ['-qr', outputPath, '.'], { cwd: tempDir });
  fs.rmSync(tempDir, { recursive: true, force: true });
  return outputPath;
}

module.exports = { generateExcel };
