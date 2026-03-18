const runInput = document.getElementById('run');
const dvInput = document.getElementById('dv');
const nombreInput = document.getElementById('nombre');
const carreraInput = document.getElementById('carrera');
const anioInput = document.getElementById('anio_ingreso');
const registerForm = document.getElementById('registerForm');
const recordsBody = document.getElementById('recordsBody');
const summary = document.getElementById('summary');
const lookupInfo = document.getElementById('lookupInfo');
const messageBox = document.getElementById('message');
const clearBtn = document.getElementById('clearBtn');
const submitBtn = document.getElementById('submitBtn');
const currentDate = document.getElementById('currentDate');
const currentTime = document.getElementById('currentTime');

let lookupTimer = null;
let lastFound = false;

function sanitizeRun(value) {
  return String(value || '').replace(/\D/g, '');
}

function sanitizeDv(value) {
  return String(value || '').toUpperCase().replace(/[^0-9K]/g, '').slice(0, 1);
}

function formatDateTime() {
  const now = new Date();
  currentDate.textContent = now.toLocaleDateString('es-CL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  currentTime.textContent = now.toLocaleTimeString('es-CL');
}

function showMessage(text, type) {
  messageBox.textContent = text;
  messageBox.className = `message ${type}`;
}

function hideMessage() {
  messageBox.className = 'message hidden';
  messageBox.textContent = '';
}

function resetForm() {
  registerForm.reset();
  lookupInfo.textContent = 'Escribe el RUN completo. La validación ocurre solo al registrar.';
  nombreInput.readOnly = false;
  lastFound = false;
  hideMessage();
  runInput.focus();
}

function setFoundStudent(student) {
  dvInput.value = student.dv || '';
  nombreInput.value = student.nombre || '';
  carreraInput.value = student.carrera || '';
  anioInput.value = student.anio_ingreso || '';
  nombreInput.readOnly = Boolean(student.nombre);
  lastFound = true;
  lookupInfo.textContent = student.nombre
    ? 'Alumno encontrado en la matriz. Nombre bloqueado porque viene desde la base.'
    : 'RUN encontrado en la matriz, pero la base cargada no trae nombre. Puedes ingresarlo manualmente.';
}

function clearAutofillKeepRun() {
  dvInput.value = '';
  nombreInput.value = '';
  carreraInput.value = '';
  anioInput.value = '';
  nombreInput.readOnly = false;
  lastFound = false;
  lookupInfo.textContent = 'No se encontró coincidencia en la matriz. Puedes completar los datos manualmente.';
}

async function lookupStudent() {
  const run = sanitizeRun(runInput.value);

  if (run.length < 3) {
    nombreInput.readOnly = false;
    lookupInfo.textContent = 'Escribe al menos 3 dígitos para buscar en la matriz.';
    return;
  }

  try {
    const response = await fetch(`/api/students/by-run/${run}`);
    const data = await response.json();

    if (data.found) {
      setFoundStudent(data.student);
    } else {
      clearAutofillKeepRun();
    }
  } catch (error) {
    lookupInfo.textContent = 'No se pudo consultar la matriz en este momento.';
  }
}

async function loadTodayRecords() {
  try {
    const response = await fetch('/api/records/today');
    const data = await response.json();
    const records = data.records || [];

    if (records.length === 0) {
      recordsBody.innerHTML = '<tr><td colspan="6" class="empty">No hay registros hoy.</td></tr>';
      summary.textContent = '0 registros • 0 dentro';
      return;
    }

    const openCount = records.filter((record) => !record.hora_salida).length;
    summary.textContent = `${records.length} registros • ${openCount} dentro`;

    recordsBody.innerHTML = records.map((record) => `
      <tr>
        <td>${record.hora_entrada || ''}</td>
        <td>${record.hora_salida || ''}</td>
        <td>${record.run_completo}</td>
        <td>${escapeHtml(record.nombre)}</td>
        <td>${escapeHtml(record.carrera)}</td>
        <td>
          <span class="badge ${record.hora_salida ? 'closed' : 'open'}">
            ${record.estado}
          </span>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    recordsBody.innerHTML = '<tr><td colspan="6" class="empty">No se pudo cargar la tabla del día.</td></tr>';
    summary.textContent = 'Error al cargar';
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

runInput.addEventListener('input', () => {
  runInput.value = sanitizeRun(runInput.value);
  hideMessage();

  if (lookupTimer) clearTimeout(lookupTimer);
  lookupTimer = setTimeout(lookupStudent, 250);
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
    anio_ingreso: anioInput.value.trim()
  };

  submitBtn.disabled = true;

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'No se pudo registrar.');
    }

    showMessage(data.message, 'success');
    await loadTodayRecords();

    if (data.action === 'salida') {
      resetForm();
    } else if (lastFound) {
      nombreInput.readOnly = Boolean(nombreInput.value);
    }
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

clearBtn.addEventListener('click', resetForm);

formatDateTime();
setInterval(formatDateTime, 1000);
loadTodayRecords();
runInput.focus();
