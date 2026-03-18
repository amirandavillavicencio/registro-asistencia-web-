const { getStudentByRun } = require('../lib/matrix');
const { normalizeRun } = require('../lib/rut');
const { sendJson } = require('../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const run = normalizeRun(url.searchParams.get('run'));

    if (run.length < 3) {
      return sendJson(res, 200, { found: false });
    }

    const student = getStudentByRun(run);
    return sendJson(res, 200, student ? { found: true, student } : { found: false });
  } catch (error) {
    return sendJson(res, 500, { found: false, error: error.message });
  }
};
