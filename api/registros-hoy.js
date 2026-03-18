const { getTodayRecords, getStorageMode } = require('../lib/attendance');
const { sendJson } = require('../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }

  try {
    const records = await getTodayRecords();
    return sendJson(res, 200, { records, storage: getStorageMode() });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
};
