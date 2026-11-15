// Расчёты денег TGM. Чистые функции, без доступа к экрану и хранилищу (их легко тестировать).
export const BASKETS = ['needs', 'debts', 'cushion', 'invest', 'joy'];
export const MODES = ['calm', 'mid', 'hard'];
// Статьи обязательных расходов (еда считается отдельно: она в неделю и сильно плавает)
export const NEED_KEYS = ['home', 'utilities', 'transport', 'comm', 'health', 'other'];
export const PILOT_DAYS = 30;

// Веса остатка (после нужд) по режимам. Совпадают с блоком «Формулы» (55/20/10/5/10 и т.д.).
const W_DEBT = {
  calm: { debts: 20, cushion: 10, invest: 5, joy: 10 },
  mid: { debts: 25, cushion: 10, invest: 5, joy: 10 },
  hard: { debts: 35, cushion: 5, invest: 0, joy: 10 },
};
const W_FREE = {
  calm: { cushion: 25, invest: 10, joy: 15 },
  mid: { cushion: 15, invest: 20, joy: 15 },
  hard: { cushion: 10, invest: 28, joy: 12 },
};
const TPL_NEEDS = { withDebts: { calm: 0.55, mid: 0.5, hard: 0.5 }, free: 0.5 };

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const num = (v) => {
  const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
// Сумма больше нуля и разумная, иначе null
export const parseMoney = (v) => {
  const n = num(v);
  return n > 0 && n <= 1e9 ? round2(n) : null;
};
// Ноль и больше (пустое поле = 0), иначе null
export const parseNonNeg = (v) => {
  if (String(v ?? '').trim() === '') return 0;
  const n = num(v);
  return n >= 0 && n <= 1e9 ? round2(n) : null;
};

// ---------- даты и часовой пояс ----------
let TZ;
export function setTz(tz) {
  try { if (tz) new Intl.DateTimeFormat('en-US', { timeZone: tz }); TZ = tz || undefined; } catch { TZ = undefined; }
}
export function getTz() {
  if (TZ) return TZ;
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}
export const pad = (n) => String(n).padStart(2, '0');
// Сегодняшняя дата ГГГГ-ММ-ДД в часовом поясе пользователя
export const ymd = (d = new Date()) => {
  if (TZ) return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const monthOf = (s) => s.slice(0, 7);
export function addDays(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
export const diffDays = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
// Дней до конца месяца, считая сегодняшний
export function daysLeft(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m, 0).getDate() - d + 1;
}

const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);

// ---------- доход и нужды ----------
export function needsMonthly(p) {
  const n = (p && p.needs) || {};
  return round2(sum(NEED_KEYS, (k) => Number(n[k]) || 0) + ((Number(n.foodWeek) || 0) * 52) / 12);
}

// ---------- изменения расходов и дохода по месяцам ----------
// profile.needs / incomeAmount / incomeEstimate это значения на старте. Каждое следующее изменение хранится в
// profile.timeline как { from: 'ГГГГ-ММ', needs, incomeAmount, incomeEstimate } и действует с этого месяца,
// поэтому прошлые месяцы продолжают считаться по старым цифрам.
export function effProfile(state, date = ymd()) {
  const p = (state && state.profile) || {};
  const tl = Array.isArray(p.timeline) ? p.timeline : [];
  if (!tl.length) return p;
  const mk = monthOf(date);
  let eff = p;
  [...tl].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0)).forEach((e) => {
    if (e.from > mk) return;
    eff = { ...eff };
    if (e.needs) eff.needs = { ...e.needs };
    if (e.incomeAmount != null) eff.incomeAmount = e.incomeAmount;
    if (e.incomeEstimate != null) eff.incomeEstimate = e.incomeEstimate;
  });
  return eff;
}
// Ближайшее запланированное изменение (со следующих месяцев), если оно есть
export function pendingChange(state, today = ymd()) {
  const mk = monthOf(today);
  const tl = (state.profile && state.profile.timeline) || [];
  return [...tl].filter((e) => e.from > mk).sort((a, b) => (a.from < b.from ? -1 : 1))[0] || null;
}
// Записывает изменение расходов/дохода. mode: 'next' со следующего месяца, 'now' с текущего.
// Пока идёт пилотный месяц, истории ещё нет, и значения просто заменяются.
export function applyBudgetChange(state, change, mode = 'next', today = ymd()) {
  const p = state.profile;
  const ch = { needs: { ...change.needs } };
  if (change.incomeAmount != null) ch.incomeAmount = change.incomeAmount;
  if (change.incomeEstimate != null) ch.incomeEstimate = change.incomeEstimate;
  if (!p.pilotApplied) {
    p.needs = ch.needs;
    if (ch.incomeAmount != null) p.incomeAmount = ch.incomeAmount;
    if (ch.incomeEstimate != null) p.incomeEstimate = ch.incomeEstimate;
    return { from: null, immediate: true };
  }
  const from = mode === 'now' ? monthOf(today) : monthAdd(monthOf(today), 1);
  p.timeline = (Array.isArray(p.timeline) ? p.timeline : []).filter((e) => e.from !== from).concat({ from, ...ch }).sort((a, b) => (a.from < b.from ? -1 : 1));
  return { from, immediate: false };
}

// Сколько человек обычно получает в месяц. Почасовая ставка: считаем по реальным сменам.
export function expectedMonthly(state, today = ymd()) {
  const p = effProfile(state, today);
  if (p.incomeType !== 'hour') return Number(p.incomeAmount) || 0;
  const est = Number(p.incomeEstimate) || 0;
  const done = (state.shifts || []).filter((s) => s.end);
  if (!done.length) return est;
  const first = done.reduce((m, s) => (s.date < m ? s.date : m), done[0].date);
  const span = Math.min(30, Math.max(1, diffDays(first, today) + 1));
  const from = addDays(today, -(span - 1));
  const earned = sum(done.filter((s) => s.date >= from && s.date <= today), (s) => s.amount);
  const proj = round2((earned / span) * 30);
  return span >= 7 ? proj : est || proj;
}
export const unpaidEarned = (state) => round2(sum((state.shifts || []).filter((s) => s.end && !s.paidBy), (s) => s.amount));
// Предыдущий месяц в виде ГГГГ-ММ (для января это декабрь прошлого года)
export function prevMonthKey(mk) {
  const [y, m] = mk.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
}
// Сколько ещё не выплачено за смены, отработанные ДО месяца mk (то есть за прошлые месяцы)
export const unpaidBefore = (state, mk) => round2(sum((state.shifts || []).filter((s) => s.end && !s.paidBy && monthOf(s.date) < mk), (s) => s.amount));
// Заработок по часам в разрезе месяцев: этот месяц, прошлый месяц, и что из более раннего ещё не выплачено.
// Месяц определяется датой смены, а не днём, когда пришли деньги.
export function earnedSplit(state, today = ymd()) {
  const cur = monthOf(today);
  const prev = prevMonthKey(cur);
  const done = (state.shifts || []).filter((s) => s.end);
  const by = (f) => round2(sum(done.filter(f), (s) => s.amount));
  return {
    thisMonth: by((s) => monthOf(s.date) === cur),
    prevMonth: by((s) => monthOf(s.date) === prev),
    prevWaiting: by((s) => monthOf(s.date) === prev && !s.paidBy),
    olderWaiting: by((s) => monthOf(s.date) < prev && !s.paidBy),
  };
}

export const hasDebts = (debts) => (debts || []).some((d) => d.balance > 0);

// Доли корзин (сумма = 1). Нужды берутся из реальных расходов, остаток делится по режиму.
export function percentages({ mode = 'mid', debts = false, income = 0, needs = 0, cushion = 0 }) {
  const m = MODES.includes(mode) ? mode : 'mid';
  const w = { ...(debts ? W_DEBT[m] : W_FREE[m]) };
  // Подушка на 3 месяца набрана: лишний вес уходит в долги (если есть) или в инвестиции
  if (needs > 0 && cushion >= 3 * needs && w.cushion > 5) {
    const move = w.cushion - 5;
    w.cushion = 5;
    if (debts) w.debts += move; else w.invest += move;
  }
  const tpl = debts ? TPL_NEEDS.withDebts[m] : TPL_NEEDS.free;
  const needsShare = income > 0 && needs > 0 ? Math.min(needs / income, 1) : tpl;
  const rest = Math.max(0, 1 - needsShare);
  const wsum = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const out = { needs: needsShare };
  for (const k of ['debts', 'cushion', 'invest', 'joy']) out[k] = (rest * (w[k] || 0)) / wsum;
  out.noSurplus = rest < 0.05;
  return out;
}

// Делит сумму по корзинам до копейки (остаток от округления уходит в самую большую корзину)
export function splitAmount(amount, pcts) {
  const out = {};
  let s = 0;
  for (const k of BASKETS) { out[k] = round2(amount * pcts[k]); s += out[k]; }
  const diff = round2(amount - s);
  if (diff !== 0) {
    const big = BASKETS.reduce((a, b) => (out[b] > out[a] ? b : a), BASKETS[0]);
    out[big] = round2(out[big] + diff);
  }
  return out;
}

// Крупные покупки (машина, ремонт, техника): разовая трата из подушки или из корзины инвестиций, не входит в нужды и месячный план
export const PURCHASE_SOURCES = ['cushion', 'invest'];
export const purchaseTotal = (state, src) => round2(sum((state.purchases || []).filter((x) => x.source === src), (x) => x.amount));
export function cushionTotal(state) {
  return round2((Number(state.profile.cushion) || 0) + sum(state.incomes, (i) => i.alloc && i.alloc.cushion) + sum((state.transfers || []).filter((x) => x.to === 'cushion'), (x) => x.amount) - purchaseTotal(state, 'cushion') - loanOut(state, 'cushion'));
}
export function investTotal(state) {
  return round2(sum(state.incomes, (i) => i.alloc && i.alloc.invest) + sum((state.transfers || []).filter((x) => x.to === 'invest'), (x) => x.amount) - purchaseTotal(state, 'invest') - goalFromInvest(state) - loanOut(state, 'invest'));
}
// Сколько можно потратить на покупку из выбранного источника
export function purchaseAvailable(state, src) {
  return Math.max(0, src === 'invest' ? investAvailable(state) : cushionTotal(state));
}
// На сколько месяцев нужд хватит подушки (после покупки)
export function cushionMonths(state, today = ymd()) {
  const n = needsMonthly(effProfile(state, today));
  return n > 0 ? round2(cushionTotal(state) / n) : null;
}
export function debtTotal(state) {
  return round2(sum(state.debts, (d) => d.balance));
}

// Текущий план процентов пользователя
export function plan(state, today = ymd()) {
  const p = effProfile(state, today);
  return percentages({
    mode: p.mode || 'mid',
    debts: hasDebts(state.debts),
    income: expectedMonthly(state, today),
    needs: needsMonthly(p),
    cushion: cushionTotal(state),
  });
}

// Нужды это ФИКСИРОВАННАЯ сумма на месяц (оплатил один раз и всё). Она не растёт вместе с доходом.
// Считаем её фиксированной, когда известны и расходы, и доход (иначе работают шаблонные проценты).
export function fixedNeeds(state, today = ymd()) {
  const n = needsMonthly(effProfile(state, today));
  return n > 0 && expectedMonthly(state, today) > 0 ? n : 0;
}

// Сколько за месяц запланировано в корзину k: нужды ограничены своей суммой, остальное делится из денег сверх нужд
export function plannedFor(state, today, k, pc = plan(state, today)) {
  const base = monthBase(state, today);
  const fx = fixedNeeds(state, today);
  if (!fx || pc.needs >= 1) return round2(base * pc[k]);
  const needsPart = Math.min(fx, base);
  if (k === 'needs') return round2(needsPart);
  return round2((Math.max(0, base - needsPart) * pc[k]) / (1 - pc.needs));
}

// Делит новый доход по корзинам. Если сумма на нужды этого месяца уже набрана, нужды больше ничего не получают,
// а то, что им причиталось, уходит в остальные корзины в тех же пропорциях.
export function allocateIncome(state, amount, date = ymd(), today = ymd()) {
  const pc = plan(state, today);
  const out = splitAmount(amount, pc);
  const fx = fixedNeeds(state, today);
  if (!fx) return out;
  const got = sum(state.incomes.filter((i) => monthOf(i.date) === monthOf(date)), (i) => i.alloc && i.alloc.needs);
  const room = Math.max(0, round2(fx - got));
  if (out.needs <= room) return out;
  const excess = round2(out.needs - room);
  out.needs = room;
  const others = ['debts', 'cushion', 'invest', 'joy'];
  const wsum = others.reduce((a, k) => a + pc[k], 0);
  if (wsum <= 0) { const b = priorityBasket(state, today); out[b] = round2(out[b] + excess); return out; }
  let given = 0;
  others.forEach((k) => { const x = round2((excess * pc[k]) / wsum); out[k] = round2(out[k] + x); given += x; });
  const diff = round2(excess - given);
  if (diff !== 0) { const big = others.reduce((a, b) => (pc[b] > pc[a] ? b : a), others[0]); out[big] = round2(out[big] + diff); }
  return out;
}

// База месяца: большее из «ожидаемого» и «уже полученного» (доход нерегулярный)
export function monthBase(state, today) {
  const got = sum(state.incomes.filter((i) => monthOf(i.date) === monthOf(today)), (i) => i.amount);
  return Math.max(expectedMonthly(state, today), got);
}

// «Сколько можно потратить сегодня» из корзины «радость» (траты «хочу»)
export function todayLimit(state, today) {
  const pc = plan(state, today);
  const carry = sum((state.transfers || []).filter((x) => x.to === 'joy' && monthOf(x.date) === monthOf(today)), (x) => x.amount);
  const joyBudget = round2(plannedFor(state, today, 'joy', pc) + carry);
  const wants = state.expenses.filter((e) => e.kind === 'want' && monthOf(e.date) === monthOf(today));
  const before = sum(wants.filter((e) => e.date < today), (e) => e.amount);
  const spentToday = sum(wants.filter((e) => e.date === today), (e) => e.amount);
  const dl = daysLeft(today);
  const allowance = Math.max(0, (joyBudget - before) / dl);
  const left = round2(allowance - spentToday);
  return { joyBudget, before, spentToday: round2(spentToday), daysLeft: dl, allowance: round2(allowance), left, over: left < 0 };
}

// Сводка по корзинам за месяц: сколько ПРИШЛО в каждую корзину, сколько потрачено, сколько осталось
export function basketStats(state, today) {
  const pc = plan(state, today);
  const mk = monthOf(today);
  const inMonth = (d) => monthOf(d) === mk;
  const alloc = (k) => sum(state.incomes.filter((i) => inMonth(i.date)), (i) => i.alloc && i.alloc[k])
    + sum((state.transfers || []).filter((x) => x.to === k && inMonth(x.date)), (x) => x.amount);
  const spent = {
    needs: sum(state.expenses.filter((e) => e.kind === 'need' && inMonth(e.date)), (e) => e.amount),
    joy: sum(state.expenses.filter((e) => e.kind === 'want' && inMonth(e.date)), (e) => e.amount),
    debts: sum(state.payments.filter((x) => inMonth(x.date)), (x) => x.amount),
    cushion: 0,
    invest: 0,
  };
  const out = {};
  for (const k of BASKETS) {
    const planned = plannedFor(state, today, k, pc);
    const allocated = round2(alloc(k));
    const used = round2(spent[k]);
    const spendable = k === 'needs' || k === 'joy' || k === 'debts';
    const value = spendable ? used : allocated;
    out[k] = {
      pct: pc[k], planned, allocated, spent: used, spendable,
      left: spendable ? round2(allocated - used) : null,
      value, progress: planned > 0 ? Math.min(1, value / planned) : 0,
    };
  }
  return out;
}

// ---------- инвестиции: куда, сколько, под какой процент ----------
export const HOLD_TYPES = ['etf', 'stock', 'crypto', 'deposit', 'skills', 'business', 'other'];
const years = (a, b) => Math.max(0, diffDays(a, b)) / 365;
const grow = (amount, rate, a, b) => amount * Math.pow(1 + (Number(rate) || 0) / 100, years(a, b));
export const holdingInvested = (h) => round2(sum(h.lots || [], (l) => l.amount));
// Стоимость вложения сегодня: от последней ручной оценки (если есть) или от взносов с ожидаемым % в год
export function holdingValue(h, today) {
  const lots = h.lots || [];
  // Автоцена: если привязана монета или акция и цена получена, стоимость = штуки × цена
  if (h.live && Number(h.live.units) > 0 && Number(h.live.price) > 0) return round2(Number(h.live.units) * Number(h.live.price));
  if (h.valueDate && h.currentValue != null) {
    let v = grow(Number(h.currentValue) || 0, h.rate, h.valueDate, today);
    lots.filter((l) => l.date > h.valueDate).forEach((l) => { v += grow(l.amount, h.rate, l.date, today); });
    return round2(v);
  }
  return round2(sum(lots, (l) => grow(l.amount, h.rate, l.date, today)));
}
export function portfolioStats(state, today) {
  const byType = {};
  let invested = 0;
  let value = 0;
  (state.holdings || []).forEach((h) => {
    const i = holdingInvested(h);
    const v = holdingValue(h, today);
    invested += i; value += v;
    const b = byType[h.type] || (byType[h.type] = { invested: 0, value: 0 });
    b.invested = round2(b.invested + i); b.value = round2(b.value + v);
  });
  invested = round2(invested); value = round2(value);
  return { count: (state.holdings || []).length, invested, value, gain: round2(value - invested), gainPct: invested > 0 ? round2(((value - invested) / invested) * 100) : 0, byType };
}
// Сколько ещё можно вложить из корзины «Инвестиции» (пришло минус уже вложенное «из корзины»)
export const investAvailable = (state) => round2(investTotal(state) - sum((state.holdings || []).flatMap((h) => h.lots || []).filter((l) => l.fromBasket), (l) => l.amount));
// Чистый капитал: подушка + портфель − долги
export const netWorth = (state, today) => round2(cushionTotal(state) + portfolioStats(state, today).value - debtTotal(state) + loansReceivable(state));

// ---------- закрытие месяца: куда уходит непотраченное ----------
// Доля остатка «радости», которая остаётся в радости (остальное уходит в приоритетную корзину)
export const ROLLOVER_RULES = { split: 0.5, joy: 1, priority: 0 };
export const monthAdd = (m, n) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
// Приоритет: долги, потом подушка (пока меньше 3 месяцев расходов), потом инвестиции
export function priorityBasket(state, date = ymd()) {
  if (hasDebts(state.debts)) return 'debts';
  const needs = needsMonthly(effProfile(state, date));
  if (needs > 0 && cushionTotal(state) < 3 * needs) return 'cushion';
  return 'invest';
}
// Прошедшие месяцы, которые ещё не закрыты (стартовый, пилотный, месяц не закрываем)
export function pendingMonths(state, today) {
  const p = state.profile;
  if (!p.startDate) return [];
  const done = new Set((state.closings || []).map((c) => c.month));
  const cur = monthOf(today);
  const out = [];
  for (let m = monthAdd(monthOf(p.startDate), 1); m < cur; m = monthAdd(m, 1)) if (!done.has(m)) out.push(m);
  return out;
}
export function activeDays(state, m) {
  const set = new Set();
  const add = (d) => { if (d && monthOf(d) === m) set.add(d); };
  [...state.incomes, ...state.expenses, ...state.payments, ...(state.shifts || [])].forEach((x) => add(x.date));
  (state.noSpendDays || []).forEach(add);
  return set.size;
}
// Считает, что осталось за месяц, и как это делится. Возвращает переводы и запись для истории.
export function planClosing(state, m) {
  const rule = ROLLOVER_RULES[state.profile.rolloverRule] !== undefined ? state.profile.rolloverRule : 'split';
  const next = monthAdd(m, 1);
  const date = `${next}-01`;
  const base = { id: 'close-' + m, month: m, date, rule };
  if (activeDays(state, m) < 3) return { transfers: [], record: { ...base, skipped: true, joyLeft: 0, needsLeft: 0, keep: 0, moved: 0, basket: null } };
  const last = addDays(date, -1);
  const pc = plan(state, last);
  const inM = (d) => monthOf(d) === m;
  const carry = sum((state.transfers || []).filter((x) => x.to === 'joy' && inM(x.date)), (x) => x.amount);
  const wants = sum(state.expenses.filter((e) => e.kind === 'want' && inM(e.date)), (e) => e.amount);
  const needSpent = sum(state.expenses.filter((e) => e.kind === 'need' && inM(e.date)), (e) => e.amount);
  const joyLeft = Math.max(0, round2(plannedFor(state, last, 'joy', pc) + carry - wants));
  const needsLeft = Math.max(0, round2(plannedFor(state, last, 'needs', pc) - needSpent));
  const keep = round2(joyLeft * ROLLOVER_RULES[rule]);
  const basket = priorityBasket(state, last);
  const transfers = [];
  const mk = (suffix, from, to, amount) => { if (amount > 0) transfers.push({ id: `tr-${m}-${suffix}`, date, month: m, from, to, amount }); };
  mk('keep', 'joy', 'joy', keep);
  mk('joy', 'joy', basket, round2(joyLeft - keep));
  mk('needs', 'needs', basket, needsLeft);
  return { transfers, record: { ...base, skipped: false, joyLeft, needsLeft, keep, moved: round2(joyLeft - keep + needsLeft), basket } };
}

// ---------- «мне должны»: деньги, которые человек одолжил другим ----------
// loan: { id, person, amount, date, due?, rate? (простой % годовых), source: 'own' | 'cushion' | 'invest', note?, closed?, repay: [{ id, date, amount }] }
// source 'cushion' / 'invest': деньги взяты из корзины и возвращаются в неё вместе с возвратами; 'own' корзин не трогает.
export const LOAN_SOURCES = ['own', 'cushion', 'invest'];
export function loanStats(l, today = ymd()) {
  const principal = Number(l.amount) || 0;
  const rate = Number(l.rate) || 0;
  // Проценты простые: до срока возврата, а без срока до сегодня (или до дня полного возврата)
  const end = l.closed || l.due || today;
  const interest = round2((principal * rate / 100) * (Math.max(0, diffDays(l.date, end)) / 365));
  const repaid = round2(sum(l.repay || [], (r) => r.amount));
  const totalDue = round2(principal + interest);
  const owed = Math.max(0, round2(totalDue - repaid));
  const paid = principal > 0 && owed < 0.01;
  return { principal, interest, repaid, totalDue, owed, paid, pct: totalDue > 0 ? Math.min(1, repaid / totalDue) : 0, overdueDays: l.due && !paid && today > l.due ? diffDays(l.due, today) : 0 };
}
// Сколько денег из корзины ушло в займы и ещё не вернулось (отрицательное, если пришли проценты сверх)
export const loanOut = (state, src) => {
  const ls = (state.loans || []).filter((l) => l.source === src);
  return round2(sum(ls, (l) => l.amount) - sum(ls, (l) => sum(l.repay || [], (r) => r.amount)));
};
// Сколько основной суммы ещё должны вернуть: считается активом в чистом капитале
export const loansReceivable = (state) => round2(sum(state.loans || [], (l) => Math.max(0, (Number(l.amount) || 0) - sum(l.repay || [], (r) => r.amount))));
export const loansOwedTotal = (state, today = ymd()) => round2(sum(state.loans || [], (l) => loanStats(l, today).owed));

// ---------- цели накоплений («роща»: машина, поездка, квартира) ----------
// goal: { id, name, target, deadline?: 'ГГГГ-ММ-ДД', adds: [{ id, date, amount, source: 'own' | 'invest' }] }
// source 'invest' берёт деньги из корзины инвестиций (уменьшает её), 'own' это деньги вне корзин.
export const goalSaved = (g) => round2(sum(g.adds || [], (x) => x.amount));
export const goalFromInvest = (state) => round2(sum((state.goals || []).flatMap((g) => g.adds || []).filter((a) => a.source === 'invest'), (a) => a.amount));
export function goalStats(g, today = ymd()) {
  const target = Number(g.target) || 0;
  const saved = goalSaved(g);
  const left = Math.max(0, round2(target - saved));
  const done = target > 0 && saved >= target;
  const out = { target, saved, left, pct: target > 0 ? Math.min(1, saved / target) : 0, done, monthsLeft: null, perMonth: null, overdue: false, etaMonths: null };
  if (done) return out;
  if (g.deadline) {
    const days = diffDays(today, g.deadline);
    if (days < 0) out.overdue = true;
    else { out.monthsLeft = Math.max(1, Math.ceil(days / 30.4)); out.perMonth = round2(left / out.monthsLeft); }
  } else {
    const from = addDays(today, -90);
    const recent = sum((g.adds || []).filter((a) => a.date >= from && a.date <= today), (a) => a.amount);
    if (recent > 0) out.etaMonths = Math.ceil(left / (recent / 3));
  }
  return out;
}

// ---------- напоминания о платежах (только внутри приложения, без push) ----------
// Берём платежи по долгам (если задан день месяца) и свои ежемесячные напоминания { id, name, amount, day, active, paidMonths }.
const dueDate = (ym, day) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${pad(Math.min(day, new Date(y, m, 0).getDate()))}`; };
export function upcomingPayments(state, today = ymd(), horizon = 31) {
  const mk = monthOf(today);
  const nx = monthAdd(mk, 1);
  const out = [];
  const push = (kind, id, name, amount, day, paidNow) => {
    if (!(day >= 1 && day <= 31)) return;
    const thisM = dueDate(mk, day);
    let date = thisM;
    let overdue = false;
    if (paidNow) date = dueDate(nx, day);
    else if (thisM < today) { if (diffDays(thisM, today) <= 10) overdue = true; else date = dueDate(nx, day); }
    const days = diffDays(today, date);
    if (!overdue && days > horizon) return;
    out.push({ kind, id, name, amount, date, days, overdue });
  };
  (state.debts || []).filter((d) => d.balance > 0).forEach((d) => {
    push('debt', d.id, d.name, Number(d.minPay) || 0, Number(d.day) || 0, (state.payments || []).some((p) => p.debtId === d.id && monthOf(p.date) === mk));
  });
  (state.reminders || []).filter((r) => r.active !== false).forEach((r) => {
    push('custom', r.id, r.name, Number(r.amount) || 0, Number(r.day) || 0, (r.paidMonths || []).includes(mk));
  });
  // Срок возврата чужого долга тебе: тоже показываем (incoming), чтобы вовремя напомнить
  (state.loans || []).forEach((l) => {
    if (!l.due) return;
    const st = loanStats(l, today);
    if (st.paid) return;
    const days = diffDays(today, l.due);
    if (days > horizon) return;
    out.push({ kind: 'loan', incoming: true, id: l.id, name: l.person, amount: st.owed, date: l.due, days, overdue: days < 0 });
  });
  return out.sort((a, b) => a.days - b.days);
}

// ---------- гном-учитель: какая тема человеку нужна сейчас ----------
// Темы: basics, debts, cushion, invest, budget, habits. Порядок = важность для текущей финансовой картины.
export function teacherTags(state, today = ymd()) {
  const needs = needsMonthly(effProfile(state, today));
  const cush = cushionTotal(state);
  const debts = hasDebts(state.debts);
  const out = [];
  if (activeDaysAll(state) < 7) out.push('basics');
  if (debts) out.push('debts');
  if (needs > 0 && cush < 3 * needs) out.push('cushion');
  if (needs > 0 && cush >= 3 * needs && !debts) out.push('invest');
  out.push('budget', 'habits', 'basics');
  return [...new Set(out)];
}
// Следующий материал: по самой важной теме, ещё не показанный, на языке человека (если на нём пусто, на английском).
// Внутри темы сначала проще. Возвращает { item, tag } или null.
export function pickLesson(state, library, lang, today = ymd(), seen = []) {
  const tags = teacherTags(state, today);
  const langs = lang === 'en' ? ['en'] : [lang, 'en'];
  for (const l of langs) {
    for (const tag of tags) {
      const hit = library.filter((x) => x.lang === l && !seen.includes(x.id) && x.tags.includes(tag)).sort((a, b) => a.level - b.level);
      if (hit.length) return { item: hit[0], tag };
    }
  }
  return null;
}

// ---------- итог недели (понедельник … воскресенье) ----------
export const weekdayOf = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }; // 0 = воскресенье
// Последнее воскресенье не позже сегодняшнего дня: конец последней законченной недели
export const lastWeekEnd = (today) => addDays(today, -weekdayOf(today));
const daysInMonthOf = (s) => { const [y, m] = s.split('-').map(Number); return new Date(y, m, 0).getDate(); };
export function weekSummary(state, end) {
  const start = addDays(end, -6);
  const inW = (d) => d >= start && d <= end;
  const incomes = state.incomes.filter((i) => inW(i.date));
  const exps = state.expenses.filter((e) => inW(e.date));
  const pays = (state.payments || []).filter((p) => inW(p.date));
  const none = (state.noSpendDays || []).filter(inW);
  const days = new Set([...incomes, ...exps, ...pays].map((x) => x.date).concat(none));
  const spentWants = round2(sum(exps.filter((e) => e.kind === 'want'), (e) => e.amount));
  const spentNeeds = round2(sum(exps.filter((e) => e.kind === 'need'), (e) => e.amount));
  const saved = round2(sum(incomes, (i) => i.alloc && (Number(i.alloc.cushion || 0) + Number(i.alloc.invest || 0))));
  const joyWeek = round2((plannedFor(state, end, 'joy') / daysInMonthOf(end)) * 7);
  const hasData = days.size > 0;
  let verdict = 'quiet';
  if (hasData) verdict = spentWants <= joyWeek && days.size >= 4 ? 'great' : spentWants <= joyWeek * 1.3 ? 'ok' : 'rough';
  return {
    start, end, hasData, verdict, joyWeek, spentWants, spentNeeds, saved,
    incomeTotal: round2(sum(incomes, (i) => i.amount)), debtPaid: round2(sum(pays, (p) => p.amount)),
    nospend: none.length, activeDays: days.size,
  };
}
// Итог, который стоит показать: неделя закончилась, в ней есть записи, и человек его ещё не смотрел
export function weekPending(state, today) {
  const end = lastWeekEnd(today);
  if (state.progress && state.progress.weekSeen === end) return null;
  if (state.profile && state.profile.startDate && end < state.profile.startDate) return null;
  return weekSummary(state, end).hasData ? end : null;
}

// ---------- дерево: стадии роста ----------
export const TREE_MAX = 9;
const c01 = (x) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
export function activeDaysAll(state) {
  const set = new Set();
  [...state.incomes, ...state.expenses, ...state.payments, ...(state.shifts || [])].forEach((x) => { if (x.date) set.add(x.date); });
  (state.noSpendDays || []).forEach((d) => set.add(d));
  return set.size;
}
// Стадия 0..9 идёт по порядку: следующая открывается, только когда выполнены все предыдущие условия.
// p = насколько близок человек к следующей стадии (0..1).
export function treeState(state, today) {
  const needs = needsMonthly(effProfile(state, today));
  const cush = cushionTotal(state);
  const port = portfolioStats(state, today).value;
  const days = activeDaysAll(state);
  const paid = sum(state.payments, (x) => x.amount);
  const left = debtTotal(state);
  const had = state.debts.length > 0;
  const topRate = state.debts.reduce((m, d) => Math.max(m, Number(d.rate) || 0), 0);
  const topClosed = !had || state.debts.filter((d) => (Number(d.rate) || 0) === topRate).every((d) => d.balance <= 0);
  const noOpen = !state.debts.some((d) => d.balance > 0);
  const week = (needs * 12) / 52;
  const debtP = c01(paid / (paid + left || 1));
  const conds = [
    { ok: state.incomes.length > 0 || port > 0, p: 0 }, // 1 росток
    { ok: days >= 7 || paid > 0, p: c01(days / 7) }, // 2 саженец
    { ok: needs > 0 && cush >= week, p: needs > 0 ? c01(cush / week) : 0 }, // 3 деревце
    { ok: topClosed, p: debtP }, // 4 крепкое: самый дорогой долг закрыт
    { ok: noOpen, p: debtP }, // 5 с листвой: все долги закрыты
    { ok: needs > 0 && cush >= 3 * needs, p: needs > 0 ? c01(cush / (3 * needs)) : 0 }, // 6 цветение
    { ok: needs > 0 && port >= needs, p: needs > 0 ? c01(port / needs) : 0 }, // 7 плоды
    { ok: needs > 0 && cush >= 6 * needs && port >= 12 * needs, p: needs > 0 ? Math.min(c01(cush / (6 * needs)), c01(port / (12 * needs))) : 0 }, // 8 дуб
    { ok: needs > 0 && port >= 300 * needs, p: needs > 0 ? c01(port / (300 * needs)) : 0 }, // 9 золотое древо (правило 4%, ориентир)
  ];
  let stage = 0;
  while (stage < TREE_MAX && conds[stage].ok) stage += 1;
  return { stage, p: stage < TREE_MAX ? conds[stage].p : 1 };
}

// ---------- пилотный месяц ----------
export const pilotDay = (state, today) => (state.profile.startDate ? diffDays(state.profile.startDate, today) + 1 : 1);
// running: идёт; review: 30 дней прошло, итог не применён; done: применён
export function pilotStatus(state, today) {
  const p = state.profile;
  if (!p.startDate || p.pilotApplied) return 'done';
  return pilotDay(state, today) <= PILOT_DAYS ? 'running' : 'review';
}
const catKey = (c) => (NEED_KEYS.includes(c) ? c : c === 'food' ? 'food' : 'other');
// Что человек ожидал и сколько реально потратил за пилот (записанное, без «растягивания»)
export function pilotSummary(state, today) {
  const p = state.profile;
  const start = p.startDate || today;
  const end = addDays(start, PILOT_DAYS - 1);
  const elapsed = Math.min(PILOT_DAYS, Math.max(1, diffDays(start, today) + 1));
  const inPilot = (d) => d >= start && d <= end;
  const actual = {};
  [...NEED_KEYS, 'food'].forEach((k) => { actual[k] = 0; });
  state.expenses.filter((e) => e.kind === 'need' && inPilot(e.date)).forEach((e) => { actual[catKey(e.category)] += e.amount; });
  const wants = sum(state.expenses.filter((e) => e.kind === 'want' && inPilot(e.date)), (e) => e.amount);
  const n = p.needs || {};
  return {
    elapsed,
    enough: elapsed >= PILOT_DAYS,
    hasData: state.expenses.some((e) => inPilot(e.date)),
    rows: NEED_KEYS.map((k) => ({ key: k, est: Number(n[k]) || 0, actual: round2(actual[k]) })),
    foodWeekEst: Number(n.foodWeek) || 0,
    foodWeekActual: round2((actual.food / elapsed) * 7),
    wantsMonth: round2(wants),
  };
}
