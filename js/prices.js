// Цены крипты и акций. Запросы идут из самого приложения: наружу уходят только названия монет и тикеры, личных данных нет.
// Крипта: CoinGecko (без ключа). Курсы валют: Frankfurter (без ключа). Акции и ETF: Twelve Data (нужен бесплатный ключ человека).
const CG = 'https://api.coingecko.com/api/v3';
const FX = 'https://api.frankfurter.dev/v1/latest';
const TD = 'https://api.twelvedata.com/quote';
export const TD_KEY_LS = 'tgm_td_key';

async function getJson(url, ms = 10000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctl.signal });
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return await r.json();
  } finally { clearTimeout(timer); }
}

// Ключ для акций хранится только на этом устройстве и не уходит в облако вместе с данными
export function getTdKey() { try { return localStorage.getItem(TD_KEY_LS) || ''; } catch { return ''; } }
export function setTdKey(k) { try { if (k) localStorage.setItem(TD_KEY_LS, k); else localStorage.removeItem(TD_KEY_LS); return true; } catch { return false; } }

// Ищет монету по названию или тикеру, первой идёт самая крупная по капитализации
export async function searchCrypto(query) {
  const q = String(query || '').trim();
  if (!q) return [];
  const d = await getJson(`${CG}/search?query=${encodeURIComponent(q)}`);
  return (d.coins || []).slice(0, 5).map((c) => ({ id: c.id, name: c.name, symbol: String(c.symbol || '').toUpperCase(), rank: c.market_cap_rank || null }));
}

// Курс одной валюты в другую (ЕЦБ). Если валюты совпадают, 1.
export async function fxRate(from, to) {
  const a = String(from || '').toUpperCase(); const b = String(to || '').toUpperCase();
  if (!a || !b || a === b) return 1;
  const d = await getJson(`${FX}?base=${a}&symbols=${b}`);
  const r = d && d.rates && d.rates[b];
  if (!(r > 0)) throw new Error('no fx ' + a + b);
  return r;
}

// Цены нескольких монет сразу в валюте человека: { bitcoin: 261213, ... }. Если валюты нет в CoinGecko, берём доллар и пересчитываем.
export async function cryptoPrices(ids, cur) {
  const list = [...new Set(ids)].filter(Boolean);
  if (!list.length) return {};
  const c = String(cur || 'USD').toLowerCase();
  const d = await getJson(`${CG}/simple/price?ids=${encodeURIComponent(list.join(','))}&vs_currencies=${c},usd`);
  const out = {};
  let fx = null;
  for (const id of list) {
    const row = d[id];
    if (!row) continue;
    if (row[c] > 0) out[id] = row[c];
    else if (row.usd > 0) { if (fx === null) fx = await fxRate('USD', cur); out[id] = row.usd * fx; }
  }
  return out;
}

// Цена акции или ETF в валюте человека. Нужен ключ Twelve Data.
export async function stockPrice(symbol, key, cur) {
  if (!key) throw new Error('no key');
  const d = await getJson(`${TD}?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`);
  if (d && d.status === 'error') throw new Error(d.message || 'td error');
  const p = Number(d.close || d.price);
  if (!(p > 0)) throw new Error('no price');
  const fx = await fxRate(d.currency || 'USD', cur);
  return p * fx;
}

// ---------- рынок: цены ведущих монет и акций (главный экран и раздел «Рынок») ----------
// Крупные компании и популярные фонды для списка акций. Цены тянутся пачками по 8 (лимит бесплатного ключа Twelve Data).
export const STOCK_PRESET = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'JPM', 'V', 'WMT', 'XOM', 'KO', 'DIS', 'NFLX', 'AMD', 'INTC', 'MCD', 'NKE', 'BA', 'PFE', 'SPY', 'QQQ', 'VOO', 'VT'];
export const STABLES = ['USDT', 'USDC', 'DAI', 'USDE', 'FDUSD', 'TUSD', 'USDS'];
export const STOCK_BATCH = 8;
const MK_LS = 'tgm_mkt_v1';
const WATCH_LS = 'tgm_watch_v1';
export function cacheRead() { try { return JSON.parse(localStorage.getItem(MK_LS)) || {}; } catch { return {}; } }
export function cacheWrite(c) { try { localStorage.setItem(MK_LS, JSON.stringify(c)); } catch { /* память переполнена или запрещена */ } }
export function getWatch() { try { const a = JSON.parse(localStorage.getItem(WATCH_LS)); return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []; } catch { return []; } }
export function setWatch(list) { try { localStorage.setItem(WATCH_LS, JSON.stringify(list.slice(0, 60))); } catch { /* ничего */ } }
// Тикер вида AAPL, BRK.B, ASML (буквы, цифры, точка и дефис)
export const cleanTicker = (s) => { const x = String(s || '').trim().toUpperCase(); return /^[A-Z0-9][A-Z0-9.\-]{0,11}$/.test(x) ? x : ''; };

export function parseCrypto(rows) {
  return (Array.isArray(rows) ? rows : []).filter((r) => r && r.symbol && r.current_price != null).map((r) => ({
    id: r.id, name: r.name, symbol: String(r.symbol).toUpperCase(), price: Number(r.current_price),
    change: r.price_change_percentage_24h == null ? null : Number(r.price_change_percentage_24h), cap: Number(r.market_cap) || 0, rank: r.market_cap_rank || null,
  }));
}
// Список крупнейших монет в валюте человека (100 штук). Если CoinGecko не знает валюту (например BYN), берём доллар.
export async function marketCrypto(cur, perPage = 100) {
  const get = (vs) => getJson(`${CG}/coins/markets?vs_currency=${vs}&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=false&price_change_percentage=24h`, 15000);
  let used = String(cur || 'USD').toLowerCase();
  let rows;
  try { rows = await get(used); } catch (e) { if (used === 'usd') throw e; used = 'usd'; rows = await get('usd'); }
  return { cur: used.toUpperCase(), rows: parseCrypto(rows) };
}
// Ответ Twelve Data: для одного тикера сам объект котировки, для нескольких словарь «тикер → котировка».
export function parseStocks(json, symbols) {
  if (json && json.code === 429) throw new Error('rate');
  if (json && (json.code === 401 || json.code === 403)) throw new Error('key');
  const out = {};
  const one = (sym, q) => {
    if (!q || q.status === 'error' || q.code) return;
    const price = Number(q.close || q.price);
    if (!(price > 0)) return;
    out[sym] = { price, change: q.percent_change == null || q.percent_change === '' ? null : Number(q.percent_change), cur: q.currency || 'USD', name: q.name || sym };
  };
  if (symbols.length === 1) one(symbols[0], json);
  else symbols.forEach((s) => one(s, json && json[s]));
  return out;
}
export async function marketStocks(symbols, key) {
  if (!key) throw new Error('key');
  const list = symbols.slice(0, STOCK_BATCH);
  if (!list.length) return {};
  let json;
  try { json = await getJson(`${TD}?symbol=${list.map(encodeURIComponent).join(',')}&apikey=${encodeURIComponent(key)}`, 15000); } catch (e) {
    if (e.status === 401 || e.status === 403) throw new Error('key');
    if (e.status === 429) throw new Error('rate');
    throw e;
  }
  return parseStocks(json, list);
}
// ---------- металлы и валюты (без ключей) ----------
// Металлы: gold-api.com, цена в долларах за тройскую унцию (около 31,1 г). Пересчёт в валюту человека по курсу ЕЦБ (Frankfurter).
const GA = 'https://api.gold-api.com/price';
export const METALS = [['XAU', 'gold'], ['XAG', 'silver'], ['XPT', 'platinum']];
export const OZ_GRAMS = 31.1034768;
export async function marketMetals(cur) {
  const res = await Promise.all(METALS.map(([s]) => getJson(`${GA}/${s}`, 12000)));
  let fx = 1; let used = 'USD';
  try { fx = await fxRate('USD', cur); used = String(cur || 'USD').toUpperCase(); } catch { fx = 1; used = 'USD'; }
  const items = {};
  res.forEach((r, i) => { const p = Number(r && r.price); if (p > 0) items[METALS[i][0]] = { price: p * fx, usd: p }; });
  if (!Object.keys(items).length) throw new Error('no metals');
  return { cur: used, items };
}
// Курсы валют к валюте человека: сколько стоит 1 единица иностранной валюты и как изменился курс за последний день (ЕЦБ).
export const FX_LIST = ['USD', 'EUR', 'GBP', 'CHF', 'PLN', 'CZK'];
// json: ответ Frankfurter за период, rates[дата][валюта] = сколько иностранной валюты за 1 базовую
export function parseFxRange(json, symbols) {
  const dates = Object.keys((json && json.rates) || {}).sort();
  if (!dates.length) return [];
  const last = json.rates[dates[dates.length - 1]];
  const prev = dates.length > 1 ? json.rates[dates[dates.length - 2]] : null;
  const out = [];
  symbols.forEach((c) => {
    const l = Number(last[c]);
    if (!(l > 0)) return;
    const per = 1 / l;
    const p = prev && Number(prev[c]) > 0 ? 1 / Number(prev[c]) : null;
    out.push({ code: c, per, change: p ? (per / p - 1) * 100 : null });
  });
  return out;
}
export async function marketFx(cur) {
  const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const get = (base) => getJson(`${FX.replace('/latest', '')}/${day(8)}..?base=${base}&symbols=${FX_LIST.filter((c) => c !== base).join(',')}`, 12000);
  let base = String(cur || 'USD').toUpperCase();
  let json;
  try { json = await get(base); } catch (e) { if (base === 'USD') throw e; base = 'USD'; json = await get(base); } // валюты нет у ЕЦБ (например BYN): считаем к доллару
  return { base, rows: parseFxRange(json, FX_LIST.filter((c) => c !== base)) };
}

// Цена для людей: до 1000 без копеек у больших, мелкие монеты с 4 значащими цифрами
export function fmtPrice(n, cur, locale = 'en-US') {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const opt = abs >= 1000 ? { maximumFractionDigits: 0 } : abs >= 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumSignificantDigits: 4 };
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency: cur, ...opt }).format(v); } catch { return `${v} ${cur}`; }
}
