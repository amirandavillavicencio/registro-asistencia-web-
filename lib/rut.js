function normalizeRun(input) {
  return String(input || '').replace(/\D/g, '');
}

function normalizeDv(input) {
  return String(input || '').trim().toUpperCase().replace(/[^0-9K]/g, '').slice(0, 1);
}

function computeDv(run) {
  const cleanRun = normalizeRun(run);
  let sum = 0;
  let multiplier = 2;

  for (let index = cleanRun.length - 1; index >= 0; index -= 1) {
    sum += Number(cleanRun[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}

function isValidRut(run, dv) {
  const cleanRun = normalizeRun(run);
  const cleanDv = normalizeDv(dv);

  if (!cleanRun || !cleanDv) {
    return false;
  }

  return computeDv(cleanRun) === cleanDv;
}

module.exports = {
  normalizeRun,
  normalizeDv,
  computeDv,
  isValidRut
};
