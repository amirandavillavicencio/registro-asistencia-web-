const { registerAttendance, getStorageMode } = require('../lib/attendance');
const { readJsonBody, sendJson } = require('../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }

  try {
    const payload = await readJsonBody(req);
    const result = await registerAttendance(payload);
    return sendJson(res, 200, { ...result, storage: getStorageMode() });
  } catch (error) {
    const status = /inválido|obligatorio/i.test(error.message) ? 400 : 500;
    return sendJson(res, status, { error: error.message });
  }
};
