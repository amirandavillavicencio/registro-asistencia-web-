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
const storageMode = document.getElementById('storageMode');

let lookupTimer = null;
let lastLookupRun = '';

function sanitizeRun(value) {
  return String(value || '').replace(/\D/g, '');
}

function sanitizeDv(value) {
  return String(value || '').toUpperCase().replace(/[^0-9K]/g, '').slice(0, 1);
}

function setClock() {
  const now = new Date();
  currentDate.textContent = now.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
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

function fillStudent(student) {
  if (student.dv) dvInput.value = student.dv;
  nombreInput.value = student.nombre || '';
  carreraInput.value = student.carrera || '';
  anioInput.value = student.anio_ingreso || '';
  lookupInfo.textContent = student.nombre
    ? 'Alumno encontrado en la matriz.'
    : 'RUN encontrado en la matriz. Completa el nombre manualmente si no viene informado.';
}

function clearAutofill() {
  dvInput.value = '';
  nombreInput.value = '';
  carreraInput.value = '';
  anioInput.value = '';
}

async function lookupStudent() {
  const run = sanitizeRun(runInput.value);
  if (run.length < 3) {
    lookupInfo.textContent = 'Escribe al menos 3 dígitos para consultar la matriz.';
    clearAutofill();
    return;
  }

  lastLookupRun = run;

  try {
    const response = await fetch(`/api/buscar?run=${encodeURIComponent(run)}`);
    const data = await response.json();

    if (run !== sanitizeRun(runInput.value) || lastLookupRun !== run) {
      return;
    }

    if (data.found) {
      fillStudent(data.student);
    } else {
      clearAutofill();
      lookupInfo.textContent = 'No se encontró coincidencia en la matriz. Puedes completar los datos manualmente.';
    }
  } catch (error) {
    lookupInfo.textContent = 'No se pudo consultar la matriz en este momento.';
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

async function loadRecords() {
  try {
    const response = await fetch('/api/registros-hoy');
    const data = await response.json();
    const records = data.records || [];

    storageMode.textContent = `Persistencia: ${data.storage || 'desconocida'}`;

    if (records.length === 0) {
      recordsBody.innerHTML = '<tr><td colspan="6" class="empty">No hay registros hoy.</td></tr>';
      summary.textContent = '0 registros • 0 abiertos';
      return;
    }

    const abiertos = records.filter((record) => !record.hora_salida).length;
    summary.textContent = `${records.length} registros • ${abiertos} abiertos`;
    recordsBody.innerHTML = records.map((record) => `
      <tr>
        <td>${record.hora_entrada}</td>
        <td>${record.hora_salida}</td>
        <td>${record.run_completo}</td>
        <td>${escapeHtml(record.nombre)}</td>
        <td>${escapeHtml(record.carrera)}</td>
        <td><span class="badge ${record.hora_salida ? 'closed' : 'open'}">${record.estado}</span></td>
      </tr>
    `).join('');
  } catch (error) {
    storageMode.textContent = 'Persistencia: error';
    recordsBody.innerHTML = '<tr><td colspan="6" class="empty">No fue posible cargar los registros.</td></tr>';
    summary.textContent = 'Error';
  }
}

function resetForm() {
  registerForm.reset();
  hideMessage();
  lookupInfo.textContent = 'Escribe el RUN sin puntos ni guion. El formulario no bloquea mientras busca en la matriz.';
  runInput.focus();
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
    const response = await fetch('/api/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'No fue posible registrar.');
    }

    showMessage(data.message, 'success');
    await loadRecords();

    if (data.action === 'salida') {
      resetForm();
    }
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

clearBtn.addEventListener('click', () => {
  clearAutofill();
  resetForm();
});

setClock();
setInterval(setClock, 1000);
loadRecords();
runInput.focus();
