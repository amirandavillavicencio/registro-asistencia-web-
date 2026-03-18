const runInput = document.getElementById('run');
const dvInput = document.getElementById('dv');
const nombreInput = document.getElementById('nombre');
const carreraInput = document.getElementById('carrera');
const anioIngresoInput = document.getElementById('anio_ingreso');
const registerForm = document.getElementById('registerForm');
const clearBtn = document.getElementById('clearBtn');
const submitBtn = document.getElementById('submitBtn');
const messageBox = document.getElementById('message');
const lookupInfo = document.getElementById('lookupInfo');
const summary = document.getElementById('summary');
const recordsBody = document.getElementById('recordsBody');

let searchTimer;
let latestRun = '';

function sanitizeRun(value) {
  return String(value || '').replace(/\D/g, '');
}

function sanitizeDv(value) {
  return String(value || '').toUpperCase().replace(/[^0-9K]/g, '').slice(0, 1);
}

function showMessage(text, type) {
  messageBox.textContent = text;
  messageBox.className = `message ${type}`;
}

function hideMessage() {
  messageBox.textContent = '';
  messageBox.className = 'message hidden';
}

function clearAutofill() {
  dvInput.value = '';
  nombreInput.value = '';
  carreraInput.value = '';
  anioIngresoInput.value = '';
}

function renderRecords(records) {
  if (!records.length) {
    recordsBody.innerHTML = '<tr><td colspan="6" class="empty">No hay registros hoy.</td></tr>';
    summary.textContent = '0 registros';
    return;
  }

  summary.textContent = `${records.length} registros`;
  recordsBody.innerHTML = records.map((record) => `
    <tr>
      <td>${record.run_completo}</td>
      <td>${escapeHtml(record.nombre)}</td>
      <td>${escapeHtml(record.carrera || '')}</td>
      <td>${record.hora_entrada}</td>
      <td>${record.hora_salida || '-'}</td>
      <td><span class="status">${record.estado}</span></td>
    </tr>
  `).join('');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function buscarAlumno() {
  const run = sanitizeRun(runInput.value);

  if (!run) {
    clearAutofill();
    lookupInfo.textContent = 'Escribe el RUN con solo números. El autocompletado no bloquea la escritura y la validación del RUT ocurre solo al registrar.';
    return;
  }

  latestRun = run;

  try {
    const response = await fetch(`/api/buscar?run=${encodeURIComponent(run)}`);
    const data = await response.json();

    if (latestRun !== run || sanitizeRun(runInput.value) !== run) {
      return;
    }

    if (!data.found) {
      clearAutofill();
      lookupInfo.textContent = 'No se encontró el RUN en la base simulada. Puedes completar los datos manualmente.';
      return;
    }

    dvInput.value = data.student.dv || '';
    nombreInput.value = data.student.nombre || '';
    carreraInput.value = data.student.carrera_ingreso || '';
    anioIngresoInput.value = data.student.cohorte || '';
    lookupInfo.textContent = 'Alumno encontrado. Puedes editar los datos antes de registrar.';
  } catch (error) {
    lookupInfo.textContent = 'No fue posible consultar el autocompletado en este momento.';
  }
}

async function cargarRegistros() {
  try {
    const response = await fetch('/api/registros-hoy');
    const data = await response.json();
    renderRecords(Array.isArray(data.records) ? data.records : []);
  } catch (error) {
    recordsBody.innerHTML = '<tr><td colspan="6" class="empty">No fue posible cargar los registros.</td></tr>';
    summary.textContent = 'Error al cargar';
  }
}

runInput.addEventListener('input', () => {
  runInput.value = sanitizeRun(runInput.value);
  hideMessage();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(buscarAlumno, 250);
});

dvInput.addEventListener('input', () => {
  dvInput.value = sanitizeDv(dvInput.value);
  hideMessage();
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideMessage();

  const payload = {
    run: sanitizeRun(runInput.value),
    dv: sanitizeDv(dvInput.value),
    nombre: nombreInput.value.trim(),
    carrera: carreraInput.value.trim(),
    anio_ingreso: anioIngresoInput.value.trim()
  };

  submitBtn.disabled = true;

  try {
    const response = await fetch('/api/registrar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'No se pudo registrar.');
    }

    showMessage(data.message, 'success');
    await cargarRegistros();
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

clearBtn.addEventListener('click', () => {
  registerForm.reset();
  hideMessage();
  clearAutofill();
  lookupInfo.textContent = 'Escribe el RUN con solo números. El autocompletado no bloquea la escritura y la validación del RUT ocurre solo al registrar.';
  runInput.focus();
});

cargarRegistros();
runInput.focus();
