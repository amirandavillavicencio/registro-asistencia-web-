const fs = require('fs');
const path = require('path');

const STORAGE_KEY = 'ciac-registro-records';
const LOCAL_FILE_PATH = path.join(process.cwd(), 'data', 'attendance-records.json');

function getKvConfig() {
  const baseUrl = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!baseUrl || !token) {
    return null;
  }

  return { baseUrl, token };
}

async function kvRequest(pathname, options = {}) {
  const config = getKvConfig();
  if (!config) {
    throw new Error('KV no configurado.');
  }

  const response = await fetch(`${config.baseUrl}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.token}`,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`KV request failed (${response.status}): ${body}`);
  }

  return response.json();
}

async function readKvRecords() {
  const data = await kvRequest(`/get/${STORAGE_KEY}`);
  const raw = data.result;

  if (!raw) {
    return [];
  }

  return JSON.parse(raw);
}

async function writeKvRecords(records) {
  const serialized = JSON.stringify(records);
  const encoded = encodeURIComponent(serialized);
  await kvRequest(`/set/${STORAGE_KEY}/${encoded}`, { method: 'POST' });
}

function readLocalRecords() {
  if (!fs.existsSync(LOCAL_FILE_PATH)) {
    return [];
  }

  const raw = fs.readFileSync(LOCAL_FILE_PATH, 'utf8').trim();
  return raw ? JSON.parse(raw) : [];
}

function writeLocalRecords(records) {
  fs.mkdirSync(path.dirname(LOCAL_FILE_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_FILE_PATH, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
}

async function getRecords() {
  if (getKvConfig()) {
    return readKvRecords();
  }

  return readLocalRecords();
}

async function saveRecords(records) {
  if (getKvConfig()) {
    await writeKvRecords(records);
    return;
  }

  writeLocalRecords(records);
}

module.exports = {
  getRecords,
  saveRecords,
  getStorageMode: () => (getKvConfig() ? 'vercel-kv-rest' : 'local-json')
};
