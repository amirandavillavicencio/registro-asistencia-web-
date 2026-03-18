const CAMPUS_OPTIONS = ['Campus San Joaquín', 'Campus Vitacura'];
const ESPACIOS = {
  'Campus Vitacura': ['Espacio Común CIAC'],
  'Campus San Joaquín': ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 6', 'Espacio Común CIAC'],
};
const JORNADAS = ['Diurno', 'Vespertino'];
const ACTIVIDADES = ['Estudio Personal', 'Consultas', 'Psicoeducativo Grupal', 'Psicoeducativo Individual'];
const TEMATICAS = ['Química', 'Física', 'Matemática', 'Programación'];
const CARRERAS = ['Plan Común de Ingenierías y Licenciaturas','Ingeniería Civil','Ingeniería Civil Eléctrica','Ingeniería Civil Informática','Ingeniería Civil Mecánica','Ingeniería Civil de Minas','Ingeniería Civil Química','Ingeniería Civil Matemática','Ingeniería Civil Telemática','Ingeniería Civil Física','Licenciatura en Astrofísica','Licenciatura en Física','Ingeniería en Diseño de Productos','Técnico Universitario en Construcción','Técnico Universitario en Control de Alimentos','Técnico Universitario en Control del Medio Ambiente','Técnico Universitario en Electricidad','Técnico Universitario en Electrónica','Técnico Universitario en Energías Renovables','Técnico Universitario en Mantenimiento Industrial','Técnico Universitario en Mecánica Automotriz','Técnico Universitario en Mecánica Industrial','Técnico Universitario en Informática','Técnico Universitario en Proyectos de Ingeniería','Técnico Universitario en Telecomunicaciones y Redes','Técnico Universitario en Minería y Metalurgia','Técnico Universitario en Química (mención Química Analítica)','Técnico Universitario en Matricería para plásticos y metales','Técnico Universitario en Prevención de Riesgos'];

const form = document.getElementById('attendanceForm');
const feedback = document.getElementById('feedback');
const reportDialog = document.getElementById('reportDialog');
const currentDate = document.getElementById('currentDate');
const currentTime = document.getElementById('currentTime');
const matrizStatus = document.getElementById('matrizStatus');
const fields = {
  campus: document.getElementById('campus'),
  run: document.getElementById('run'),
  dv: document.getElementById('dv'),
  nombre: document.getElementById('nombre'),
  carrera: document.getElementById('carrera'),
  jornada: document.getElementById('jornada'),
  anioIngreso: document.getElementById('anioIngreso'),
  semestreEstimado: document.getElementById('semestreEstimado'),
  actividad: document.getElementById('actividad'),
  tematica: document.getElementById('tematica'),
  espacio: document.getElementById('espacio'),
  observaciones: document.getElementById('observaciones'),
};

function setOptions(select, options, placeholder = 'Seleccione') {
  const previous = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>` + options.map((option) => `<option value="${option}">${option}</option>`).join('');
  if (options.includes(previous)) select.value = previous;
}

function systemYear() { return new Date().getFullYear(); }
function years() {
  return Array.from({ length: systemYear() - 2020 + 1 }, (_, i) => String(2020 + i));
}

function updateClock() {
  const now = new Date();
  currentDate.textContent = now.toLocaleDateString('es-CL');
  currentTime.textContent = now.toLocaleTimeString('es-CL', { hour12: false });
}

function calculateSemestre(anio) {
  const year = Number(anio);
  if (!Number.isInteger(year) || year < 1900) return 'No disponible';
  const now = new Date();
  const semestreActual = now.getMonth() <= 5 ? 1 : 2;
  return String(((now.getFullYear() - year) * 2) + semestreActual);
}

function refreshSemestre() {
  fields.semestreEstimado.value = calculateSemestre(fields.anioIngreso.value);
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data;
}

async function lookupStudent() {
  const run = fields.run.value;
  if (run.length < 7) return;
  const data = await fetchJson(`/api/student/${run}`);
  if (data.student) {
    fields.dv.value = data.student.dv || '';
    fields.nombre.value = data.student.nombre || '';
    if (data.student.carrera && CARRERAS.includes(data.student.carrera)) fields.carrera.value = data.student.carrera;
    else if (data.student.carrera) fields.carrera.value = '';
    if (data.student.anio_ingreso && years().includes(String(data.student.anio_ingreso))) fields.anioIngreso.value = String(data.student.anio_ingreso);
    refreshSemestre();
    setFeedback(`Autocompletado desde ${data.student.source}.`, 'success');
  } else {
    setFeedback('RUN sin coincidencias en matriz_estudiantes ni registros previos. Ingreso manual habilitado.', 'warn');
  }
}

function setFeedback(message, tone = '') {
  feedback.textContent = message;
  feedback.className = `feedback ${tone}`.trim();
}

async function loadHealth() {
  const health = await fetchJson('/api/health');
  matrizStatus.textContent = health.matrizDisponible ? 'Matriz cargada' : (health.matrizSqlPresente ? 'SQL disponible, tabla pendiente' : 'Sin data/matriz_estudiantes.sql');
}

async function loadTodayRecords() {
  const { records } = await fetchJson('/api/records/today');
  const tbody = document.getElementById('recordsBody');
  tbody.innerHTML = records.length ? records.map((record) => `
    <tr>
      <td>${record.hora_entrada || ''}</td>
      <td>${record.hora_salida || ''}</td>
      <td>${record.run || ''}-${record.dv || ''}</td>
      <td>${record.nombre || ''}</td>
      <td>${record.carrera || ''}</td>
      <td>${record.actividad || ''}</td>
      <td>${record.estado || ''}</td>
      <td>${record.estado === 'abierto' ? `<button data-close-id="${record.id}">Salida</button>` : '—'}</td>
    </tr>`).join('') : '<tr><td colspan="8">No hay registros hoy.</td></tr>';
}

async function submitForm(event) {
  event.preventDefault();
  const payload = {
    campus: fields.campus.value,
    run: fields.run.value,
    dv: fields.dv.value,
    nombre: fields.nombre.value,
    carrera: fields.carrera.value,
    jornada: fields.jornada.value,
    anio_ingreso: fields.anioIngreso.value,
    actividad: fields.actividad.value,
    tematica: fields.tematica.value,
    espacio: fields.espacio.value,
    observaciones: fields.observaciones.value,
  };
  const response = await fetchJson('/api/attendance/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  setFeedback(`Registro de ${response.action} guardado para ${response.record.nombre || payload.run}.`, 'success');
  await loadTodayRecords();
}

function clearForm() {
  form.reset();
  initSelects();
  refreshSemestre();
  setFeedback('Formulario limpiado.');
}

async function openReport() {
  const data = await fetchJson('/api/reports/summary');
  const kpis = [
    ['Total registros', data.kpis.total_registros ?? 0],
    ['Total horas acumuladas', data.kpis.total_horas ?? 0],
    ['Promedio duración (min)', data.kpis.promedio_duracion ?? '0'],
    ['Carreras distintas', data.kpis.carreras_distintas ?? 0],
  ];
  const summaryList = (title, rows) => `<section class="panel"><h3>${title}</h3><ul>${rows.map((row) => `<li>${row.label}: ${row.total}</li>`).join('') || '<li>Sin datos</li>'}</ul></section>`;
  document.getElementById('reportContent').innerHTML = `
    <section class="kpis">${kpis.map(([label, value]) => `<div class="kpi"><strong>${label}</strong><div>${value}</div></div>`).join('')}</section>
    <section class="summary-grid">
      ${summaryList('Por actividad', data.byActivity)}
      ${summaryList('Por temática', data.byTematica)}
      ${summaryList('Top carreras', data.topCarreras)}
      ${summaryList('Por campus', data.byCampus)}
      ${summaryList('Por semestre estimado', data.bySemestre)}
    </section>
    <section class="panel"><h3>Resumen por carrera</h3><div class="table-wrap"><table><thead><tr><th>Carrera</th><th>Registros</th><th>Horas acumuladas</th><th>Promedio duración</th></tr></thead><tbody>${data.byCarreraTable.map((row) => `<tr><td>${row.carrera}</td><td>${row.registros}</td><td>${row.horas_acumuladas}</td><td>${row.promedio_duracion ?? ''}</td></tr>`).join('') || '<tr><td colspan="4">Sin datos</td></tr>'}</tbody></table></div></section>`;
  reportDialog.showModal();
}

function initSelects() {
  setOptions(fields.campus, CAMPUS_OPTIONS, 'Seleccione campus');
  fields.campus.value ||= CAMPUS_OPTIONS[0];
  setOptions(fields.jornada, JORNADAS);
  setOptions(fields.actividad, ACTIVIDADES);
  setOptions(fields.tematica, TEMATICAS);
  setOptions(fields.carrera, CARRERAS, 'Seleccione carrera');
  setOptions(fields.anioIngreso, years(), 'Seleccione año');
  updateEspacios();
}

function updateEspacios() {
  const current = fields.espacio.value;
  const options = ESPACIOS[fields.campus.value] || [];
  setOptions(fields.espacio, options, 'Seleccione espacio');
  if (!options.includes(current)) fields.espacio.value = '';
}

fields.run.addEventListener('input', (event) => {
  const cursor = event.target.selectionStart;
  const sanitized = event.target.value.replace(/\D/g, '');
  event.target.value = sanitized;
  event.target.setSelectionRange(cursor, cursor);
});
fields.dv.addEventListener('input', (event) => {
  event.target.value = event.target.value.toUpperCase().replace(/[^0-9K]/g, '').slice(0, 1);
});
fields.run.addEventListener('blur', () => lookupStudent().catch((error) => setFeedback(error.message, 'warn')));
fields.anioIngreso.addEventListener('change', refreshSemestre);
fields.campus.addEventListener('change', updateEspacios);
form.addEventListener('submit', (event) => submitForm(event).catch((error) => setFeedback(error.message, 'warn')));
document.getElementById('clearBtn').addEventListener('click', clearForm);
document.getElementById('exportBtn').addEventListener('click', () => { window.location.href = '/api/export/xlsx'; });
document.getElementById('reportBtn').addEventListener('click', () => openReport().catch((error) => setFeedback(error.message, 'warn')));
document.getElementById('closeReportBtn').addEventListener('click', () => reportDialog.close());
document.getElementById('recordsBody').addEventListener('click', async (event) => {
  const id = event.target.dataset.closeId;
  if (!id) return;
  try {
    await fetchJson(`/api/attendance/close/${id}`, { method: 'POST' });
    setFeedback('Salida registrada correctamente.', 'success');
    await loadTodayRecords();
  } catch (error) {
    setFeedback(error.message, 'warn');
  }
});

initSelects();
updateClock();
setInterval(updateClock, 1000);
refreshSemestre();
loadHealth().catch(() => setFeedback('No se pudo consultar estado de la matriz.', 'warn'));
loadTodayRecords().catch(() => setFeedback('No se pudo cargar la tabla del día.', 'warn'));
