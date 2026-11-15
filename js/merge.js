// Слияние двух копий данных (телефон и облако), когда правки делали на двух устройствах и ни одна не знала о другой.
// Чистая функция: без доступа к сети и браузеру, поэтому её можно проверять тестами.
// Правила:
//  1) Записи с разными id объединяются: ничего не теряется.
//  2) Одна и та же запись (тот же id) на обеих сторонах: побеждает версия с более свежим состоянием (updatedAt).
//  3) Внутри целей (взносы), займов (возвраты) и вложений (покупки) вложенные записи тоже объединяются.
//  4) Остаток долга: платежи, которые знает только проигравшая сторона, вычитаются из остатка выигравшей, чтобы остаток сошёлся.
//  5) Профиль, тема, прогресс: берётся более свежая сторона целиком.
// Ограничение: удаления между копиями не помечаются, поэтому запись, удалённая на одном устройстве и ещё живая на другом, вернётся.
const LISTS = ['incomes', 'expenses', 'payments', 'shifts', 'holdings', 'closings', 'transfers', 'purchases', 'goals', 'reminders', 'loans', 'debts'];
const NESTED = { goals: ['adds', (x) => x.id], loans: ['repay', (x) => x.id], holdings: ['lots', (x) => `${x.date}|${x.amount}|${x.fromBasket ? 1 : 0}`] };
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function unionBy(first, second, keyOf) {
  const seen = new Set();
  const out = [];
  [...first, ...second].forEach((x) => { const k = keyOf(x); if (!seen.has(k)) { seen.add(k); out.push(x); } });
  return out;
}

function mergeList(name, newer, older) {
  const byOlder = new Map((older || []).map((x) => [x.id, x]));
  const merged = (newer || []).map((x) => {
    const other = byOlder.get(x.id);
    const nest = NESTED[name];
    if (other && nest && (Array.isArray(x[nest[0]]) || Array.isArray(other[nest[0]]))) return { ...x, [nest[0]]: unionBy(x[nest[0]] || [], other[nest[0]] || [], nest[1]) };
    return x;
  });
  const have = new Set(merged.map((x) => x.id));
  (older || []).forEach((x) => { if (!have.has(x.id)) merged.push(x); });
  return merged;
}

export function mergeStates(local, remote) {
  const localNewer = (local.updatedAt || 0) >= (remote.updatedAt || 0);
  const newer = localNewer ? local : remote;
  const older = localNewer ? remote : local;
  const out = { ...older, ...newer };
  LISTS.forEach((k) => { out[k] = mergeList(k, newer[k], older[k]); });
  out.noSpendDays = [...new Set([...(newer.noSpendDays || []), ...(older.noSpendDays || [])])].sort();
  // остатки долгов, которые есть у более свежей стороны, уменьшаем на платежи, известные только старой стороне
  const newerPayIds = new Set((newer.payments || []).map((p) => p.id));
  const onlyOld = (older.payments || []).filter((p) => !newerPayIds.has(p.id));
  const newerDebtIds = new Set((newer.debts || []).map((d) => d.id));
  out.debts = out.debts.map((d) => {
    if (!newerDebtIds.has(d.id)) return d;
    const extra = onlyOld.filter((p) => p.debtId === d.id).reduce((a, p) => a + (Number(p.amount) || 0), 0);
    return extra > 0 ? { ...d, balance: Math.max(0, round2((Number(d.balance) || 0) - extra)) } : d;
  });
  out.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0) + 1; // слитая копия новее обеих, чтобы уйти в облако
  return out;
}
