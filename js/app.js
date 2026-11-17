// TGM — To Grow Money. Экраны и действия.
import { t, setLang, getLang, LANGS, LANG_NAMES } from './i18n.js?v=0.9.10';
import { store } from './store.js?v=0.9.10';
import * as C from './calc.js?v=0.9.10';
import { snd } from './sound.js?v=0.9.10';
import * as P from './prices.js?v=0.9.10';
import { LIBRARY } from './library.js?v=0.9.10';
import { LEARN } from './learn.js?v=0.9.10';
import * as A from './auth.js?v=0.9.10';
import { REQUIRE_ACCOUNT, AUTH_DOMAIN, SITE_URL, VAPID_PUBLIC } from '../config.js?v=0.9.10';
import { pushInfo, pushSubscribe, pushUnsubscribe } from './push.js?v=0.9.10';
import { newsFor, cmpVersion } from './changelog.js?v=0.9.10';
import { TOUR_STEPS, tipPosition } from './tour.js?v=0.9.10';

const CURRENCIES = ['USD', 'BYN', 'RUB', 'PLN', 'UAH', 'EUR'];
const LOCALE = { ru: 'ru-RU', en: 'en-US', pl: 'pl-PL', es: 'es-ES' };
const CATS = ['food', 'home', 'utilities', 'transport', 'comm', 'health', 'fun', 'shopping', 'other'];
const NEED_CATS = new Set(['food', 'home', 'utilities', 'transport', 'comm', 'health']);
const STEPS = ['lang', 'cur', 'auth', 'income', 'debts', 'cushion', 'needs', 'food', 'fun', 'waste', 'mode', 'plan'];
const OB = 'tgm_ob';
const APP_VERSION = '0.9.10 (этап 3, автообновление)';
const APP_VER = APP_VERSION.split(' ')[0];
const ui = { screen: 'today', modal: null, step: 0, draft: null, cal: { month: null, sel: null }, acc: { tab: 'signup' }, fg: {}, rc: {}, busy: false, afterAuth: false };
const $app = document.getElementById('app');
const S = () => store.state;
const loc = () => LOCALE[getLang()] || 'en-US';

// ---------- утилиты ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
const checked = (name) => { const el = document.querySelector(`input[name="${name}"]:checked`); return el ? el.value : ''; };
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'); let c = o; ks.slice(0, -1).forEach((k) => { c[k] = c[k] || {}; c = c[k]; }); c[ks[ks.length - 1]] = v; };

function money(n) {
  const cur = S().profile.currency;
  try { return new Intl.NumberFormat(loc(), { style: 'currency', currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n); } catch { return `${Number(n).toFixed(2)} ${cur}`; }
}
// Даты хранятся как ГГГГ-ММ-ДД, поэтому показываем их в UTC, чтобы часовой пояс не сдвигал день
const dfmt = (d, opts) => { try { return new Intl.DateTimeFormat(loc(), { timeZone: 'UTC', ...opts }).format(new Date(d + 'T00:00:00Z')); } catch { return d; } };
const shortDate = (d) => dfmt(d, { day: 'numeric', month: 'short' });
const longDate = (d) => dfmt(d, { day: 'numeric', month: 'long', year: 'numeric' });
const dayTitle = (d) => dfmt(d, { weekday: 'long', day: 'numeric', month: 'long' });
function fmtHours(h) {
  const m = Math.round(h * 60); const hh = Math.floor(m / 60); const mm = m % 60;
  return `${hh} ${t('h_short')}${mm ? ` ${mm} ${t('m_short')}` : ''}`;
}
function parseHours(v) {
  const s = String(v || '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  const h = m ? Number(m[1]) + Number(m[2]) / 60 : C.num(s);
  return h > 0 && h <= 24 ? Math.round(h * 100) / 100 : null;
}
function readDate(id) {
  const v = val(id); const today = C.ymd();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && v <= today && v >= '2000-01-01' ? v : today;
}
function toast(msg, warn) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg;
  if (warn) snd.play('error');
  el.className = warn ? 'warn show' : 'show';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.className = ''; }, 4200);
}
const applyTheme = () => { document.documentElement.dataset.theme = S().theme === 'light' ? 'light' : 'dark'; };
const applyTz = () => C.setTz(S().profile.tz);

// ---------- черновик опроса ----------
// langPicked: человек сам выбрал язык. Пока не выбрал, первый экран показывает выбор на четырёх языках и ничего не подставляет
function newDraft() { const p = S().profile; return { langPicked: false, profile: { ...p, needs: { ...p.needs } }, debts: [...S().debts] }; }
function loadOb() {
  try {
    const o = JSON.parse(localStorage.getItem(OB));
    if (o && o.draft && o.draft.profile) { ui.step = Math.min(Math.max(o.step || 0, 0), STEPS.length - 1); ui.draft = o.draft; ui.draft.profile.needs = ui.draft.profile.needs || {}; if (ui.draft.langPicked === undefined) ui.draft.langPicked = ui.step > 0; return; }
  } catch { /* нет черновика */ }
  ui.step = 0; ui.draft = newDraft();
}
function saveOb() { try { localStorage.setItem(OB, JSON.stringify({ step: ui.step, draft: ui.draft })); } catch { /* ignore */ } }
function norm(pr) {
  const needs = {};
  [...C.NEED_KEYS, 'foodWeek'].forEach((k) => { needs[k] = C.parseNonNeg(pr.needs && pr.needs[k]) || 0; });
  return {
    ...pr, needs,
    incomeAmount: C.parseNonNeg(pr.incomeAmount) || 0,
    hourlyRate: C.parseNonNeg(pr.hourlyRate) || 0,
    incomeEstimate: C.parseNonNeg(pr.incomeEstimate) || 0,
    cushion: C.parseNonNeg(pr.cushion) || 0,
    monthlyFun: C.parseNonNeg(pr.monthlyFun) || 0,
    wasteText: String(pr.wasteText || '').slice(0, 200),
    tz: pr.tz || C.getTz(),
  };
}
function draftPlan() {
  const p = norm(ui.draft.profile);
  const income = C.expectedMonthly({ profile: p, shifts: [] }, C.ymd());
  return C.percentages({ mode: p.mode || 'mid', debts: C.hasDebts(ui.draft.debts), income, needs: C.needsMonthly(p), cushion: p.cushion });
}

// ---------- шаблоны ----------
const field = (label, inner) => `<label class="field"><span>${esc(label)}</span>${inner}</label>`;
const bar = (p, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.round(p * 100)}%"></i></div>`;
const BNAME = (k) => t('b_' + k);
const kv = (a, b, cls = '') => `<div class="kv"><span>${a}</span><b class="${cls}">${b}</b></div>`;
const helpBtn = (k) => `<button class="help" data-act="openHelp" data-v="${k}" aria-label="${esc(t('help_aria'))}">?</button>`;
const bindInput = (path, d, af) => `<input inputmode="decimal" data-bind="${path}" ${af ? 'data-af' : ''} value="${esc(getPath(d, path) || '')}">`;

// ---------- дерево: рисунок ----------
// Корзины стоят под землёй банками. От каждой банки к стволу идёт корень, по нему течёт удобрение цвета корзины.
const BASKET_COLOR = { needs: '#b98a52', debts: '#f08a3a', cushion: '#52b4ee', invest: '#f2c14e', joy: '#ee8fba' };
const JAR_X = [36, 93, 150, 207, 264];
// Живописная банка assets/jars/jar.webp (исходник 289x360, в приложении 217x270, пропорции те же): размер на сцене и полость стекла, куда рисуется уровень наполнения
const JAR_IMG = { w: 46.6, h: 58, y: -12 };
const JAR_IN = { cx: 0, cy: 26, rx: 18.6, ry: 17.4 };
const rndv = (i) => { const x = Math.sin(i * 12.9898 + 7.233) * 43758.5453; return x - Math.floor(x); };
const bz = (a, b, c, d, u) => { const v = 1 - u; return [v * v * v * a[0] + 3 * v * v * u * b[0] + 3 * v * u * u * c[0] + u * u * u * d[0], v * v * v * a[1] + 3 * v * v * u * b[1] + 3 * v * u * u * c[1] + u * u * u * d[1]]; };
// Сужающийся корень: толстый у ствола, тонкий у банки
function taper(a, b, c, d, w0, w1, color, steps = 16) {
  let s = '';
  for (let i = 0; i < steps; i++) {
    const p = bz(a, b, c, d, i / steps); const q = bz(a, b, c, d, (i + 1) / steps);
    s += `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="${color}" stroke-width="${(w0 + (w1 - w0) * (i / (steps - 1))).toFixed(2)}" stroke-linecap="round"/>`;
  }
  return s;
}
const jarIcon = (k) => ({
  needs: '<path d="M-6 1 L0 -6 L6 1 V7 H-6Z" fill="#fff" opacity=".92"/><rect x="-1.6" y="2" width="3.2" height="5" fill="#8a5e2c"/>',
  debts: '<g fill="none" stroke="#fff" stroke-width="1.8" opacity=".92"><circle cx="-3" cy="0" r="3.4"/><circle cx="3" cy="0" r="3.4"/></g>',
  cushion: '<path d="M0 -6.5 Q6 0 0 6.5 Q-6 0 0 -6.5Z" fill="#fff" opacity=".92"/>',
  invest: '<circle r="5.6" fill="none" stroke="#fff" stroke-width="1.8" opacity=".92"/><path d="M0 -2.6 V2.6 M-2.2 0 H2.2" stroke="#fff" stroke-width="1.6"/>',
  joy: '<path d="M0 -6.5 L1.8 -1.8 L6.5 0 L1.8 1.8 L0 6.5 L-1.8 1.8 L-6.5 0 L-1.8 -1.8Z" fill="#fff" opacity=".92"/>',
}[k]);
const miniGnome = (color) => `<path d="M-6 -4 L0 -19 L6 -4Z" fill="${color}"/><circle r="5.5" fill="#f3c9a1"/><path d="M-4 2 Q0 12 4 2Z" fill="#f5f2ea"/><circle cx="8" cy="4" r="4" fill="${color}" stroke="#2b1a06" stroke-width="1"/>`;
const NAV_ICONS = {
  today: '<svg viewBox="0 0 24 24"><path d="M12 21v-9"/><path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M12 14c0-3-2-5-6-5 0 3 2 5 6 5z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8 3v4M16 3v4"/></svg>',
  baskets: '<svg viewBox="0 0 24 24"><path d="M8 4h8M9 4v3c-3 1-4 3-4 6v4a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-4c0-3-1-5-4-6V4"/><path d="M6 13h12"/></svg>',
  debts: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>',
};
const BRAND_ICON = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="12" r="9" fill="#2c9a5a"/><circle cx="11" cy="14" r="6" fill="#3fbf6a"/><circle cx="21" cy="13" r="6" fill="#58d884"/><path d="M14.5 29c.5-5 .8-8 .8-12h1.4c0 4 .3 7 .8 12z" fill="#8a5a30"/><circle cx="20" cy="9" r="1.6" fill="#f2c94c"/></svg>';

// ---------- осенний лес, замок, лучи света ----------
const ASSET_OK = {};
// Картинки (WebP, v0.5.8) грузятся не все сразу, а по нужде: фон, банка, садовник, рамка и вывеска сразу;
// нужная стадия дерева сразу (её просит treeImageFor), соседняя следующая и остальные гномы в простое.
// Если файл не загрузился (старый браузер без WebP, нет файла), остаётся векторный рисунок, как раньше.
const ASSET_SRC = { bg: 'assets/scene/bg.webp', jar: 'assets/jars/jar.webp' };
['gardener', 'grumpy', 'comforter', 'teacher', 'investor'].forEach((k) => { ASSET_SRC['g-' + k] = `assets/gnomes/${k}.webp`; });
['t1', 't2', 't3', 't4'].forEach((k) => { ASSET_SRC[k] = `assets/trees/${k}.webp`; });
const ASSET_REQ = {}; // k -> { need }: уже запрошено; need = от картинки зависит то, что сейчас на экране
let assetRenderTimer = 0;
function assetRender() { // несколько картинок пришли почти вместе: перерисовываем один раз, без мерцания
  clearTimeout(assetRenderTimer);
  assetRenderTimer = setTimeout(() => { if (ui.screen === 'today' && !ui.modal) render(); }, 40);
}
function loadAsset(k, need, done) {
  const r = ASSET_REQ[k];
  if (r) { if (need) r.need = true; if (done) done(); return; }
  if (!ASSET_SRC[k]) { if (done) done(); return; }
  const req = ASSET_REQ[k] = { need: !!need };
  const im = new Image();
  im.onload = () => { ASSET_OK[k] = true; if (req.need) assetRender(); if (done) done(); };
  im.onerror = () => { if (done) done(); };
  im.src = ASSET_SRC[k];
}
function whenIdle(fn) { try { if ('requestIdleCallback' in window) { requestIdleCallback(fn, { timeout: 5000 }); return; } } catch (e) { /* ничего */ } setTimeout(fn, 1500); }
function saveDataOn() { try { return !!(navigator.connection && navigator.connection.saveData); } catch (e) { return false; } }
function loadAssets() {
  ['bg', 'jar', 'g-gardener'].forEach((k) => loadAsset(k, true));
  // Живописные деревянные рамка карточек и табличка: CSS подключает их классами has-frame / has-sign, без файлов остаются векторные
  [['frame', 'has-frame'], ['sign', 'has-sign']].forEach(([k, cls]) => { const im = new Image(); im.onload = () => { try { document.documentElement.classList.add(cls); } catch (e) { /* ничего */ } }; im.onerror = () => {}; im.src = `assets/ui/${k}.webp`; });
  // Остальные гномы нужны только в репликах: по одному в простое (в режиме экономии трафика не грузим заранее, возьмутся по требованию)
  if (saveDataOn()) return;
  const rest = ['grumpy', 'comforter', 'teacher', 'investor'].map((k) => 'g-' + k);
  const pump = () => { const k = rest.shift(); if (k) loadAsset(k, false, () => whenIdle(pump)); };
  whenIdle(pump);
}
const BACKDROP_DEFS = '<filter id="b1" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation=".8"/></filter><filter id="b2" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.8"/></filter><filter id="b3" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="4"/></filter>'
  + '<linearGradient id="ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d8" stop-opacity=".45"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></linearGradient>'
  + '<linearGradient id="trk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1c130a"/><stop offset=".55" stop-color="#4b3520"/><stop offset="1" stop-color="#231810"/></linearGradient>'
  + '<radialGradient id="vig" cx=".5" cy=".42" r=".78"><stop offset=".58" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>';
const LEAF_COLS = { sun: ['#e5922f', '#f2b843', '#c9632a', '#d9a43a', '#98a84a'], dry: ['#c7893a', '#b9692a', '#d6a64a'], rain: ['#7d8a5a', '#6b7a52', '#8a8f5e'] };

function backdrop(mood, gy) {
  const rain = mood === 'rain'; const dry = mood === 'dry';
  const rock = rain ? '#4b5d6e' : dry ? '#876038' : '#6c8591';
  const stone = rain ? '#6c8092' : dry ? '#c58c55' : '#a5b4b4';
  const roof = rain ? '#46566a' : dry ? '#86492a' : '#8b5a48';
  const win = rain ? '#cfe3ff' : '#ffd88a';
  const cols = LEAF_COLS[mood] || LEAF_COLS.sun;
  let s = '';
  if (!rain) s += `<circle cx="64" cy="26" r="84" fill="url(#sg)" opacity="${dry ? 0.5 : 0.85}"/>`;
  s += '<g filter="url(#b2)" opacity=".9">';
  for (let i = 0; i < 12; i++) s += `<circle cx="${(8 + i * 26 + rndv(i) * 12).toFixed(0)}" cy="${(gy - 52 + rndv(i + 3) * 18).toFixed(0)}" r="${(15 + rndv(i + 6) * 9).toFixed(0)}" fill="${cols[i % cols.length]}"/>`;
  s += '</g>';
  s += `<g filter="url(#b1)"><path d="M168 ${gy} L172 126 Q190 106 214 102 L236 97 L264 99 Q286 102 304 94 V${gy}Z" fill="${rock}"/>`
    + `<rect x="250" y="44" width="14" height="56" fill="${stone}"/><path d="M247 44 L257 14 L267 44Z" fill="${roof}"/>`
    + `<rect x="234" y="66" width="12" height="34" fill="${stone}"/><path d="M231 66 L240 44 L249 66Z" fill="${roof}"/>`
    + `<rect x="272" y="60" width="12" height="40" fill="${stone}"/><path d="M269 60 L278 38 L287 60Z" fill="${roof}"/>`
    + `<rect x="236" y="82" width="52" height="18" fill="${stone}" opacity=".95"/>`
    + `<rect x="255" y="56" width="4" height="8" rx="2" fill="${win}"/><rect x="238" y="74" width="3" height="6" rx="1.5" fill="${win}"/><rect x="276" y="70" width="3" height="6" rx="1.5" fill="${win}"/><rect x="260" y="88" width="3" height="6" rx="1.5" fill="${win}"/></g>`;
  if (!rain) for (let k = 0; k < 5; k++) s += `<path d="M${14 + k * 30} -4 L${40 + k * 30} -4 L${96 + k * 44} ${gy} L${40 + k * 44} ${gy}Z" class="ray" fill="url(#ray)" opacity="${dry ? 0.5 : 0.75}"/>`;
  s += `<g filter="url(#b3)"><ellipse cx="80" cy="${gy - 26}" rx="130" ry="13" fill="#fff" opacity="${rain ? 0.22 : 0.17}"/><ellipse cx="230" cy="${gy - 12}" rx="110" ry="10" fill="#fff" opacity=".13"/></g>`;
  return s;
}

// Два старых дерева по краям кадра с осенними ветками сверху (как на референсе)
function frameTrees(mood, gy) {
  const cols = LEAF_COLS[mood] || LEAF_COLS.sun; const rain = mood === 'rain';
  let s = `<path d="M-10 0 H26 Q18 70 24 ${gy + 4} H-10Z" fill="url(#trk)"/><path d="M310 0 H274 Q282 60 276 ${gy + 4} H310Z" fill="url(#trk)"/>`;
  for (let i = 0; i < 9; i++) {
    const y = 18 + i * 19 + rndv(i) * 8; const rx = 4 + rndv(i + 9) * 4; const ry = 6 + rndv(i + 2) * 6;
    s += `<ellipse cx="${((i % 2 ? 19 : 7) + rndv(i + 4) * 3).toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${rain ? '#5e7348' : '#6c8f3c'}" opacity=".5"/>`;
    s += `<ellipse cx="${(300 - (i % 2 ? 18 : 8) - rndv(i + 5) * 3).toFixed(1)}" cy="${(y + 6).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${rain ? '#5e7348' : '#6c8f3c'}" opacity=".5"/>`;
  }
  s += '<path d="M14 54 Q44 30 98 6" stroke="#2b1d11" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M286 44 Q252 24 204 4" stroke="#2b1d11" stroke-width="4.5" fill="none" stroke-linecap="round"/>';
  for (let i = 0; i < 34; i++) {
    const right = i >= 18; const u = rndv(i + 30);
    const x = right ? 286 - u * 84 : 14 + u * 84; const y = (right ? 44 - u * 40 : 54 - u * 48) + (rndv(i) - 0.5) * 24;
    s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(5 + rndv(i + 7) * 3).toFixed(1)}" ry="${(2.6 + rndv(i + 3)).toFixed(1)}" transform="rotate(${(rndv(i + 11) * 180).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${cols[i % cols.length]}"/>`;
  }
  return s;
}

function fallingLeaves(mood) {
  const cols = LEAF_COLS[mood] || LEAF_COLS.sun;
  let s = '';
  for (let i = 0; i < 8; i++) s += `<path class="leafFall" d="M0 0 Q4 -3 8 0 Q4 3 0 0Z" fill="${cols[i % cols.length]}" style="--lx:${(20 + rndv(i + 40) * 260).toFixed(0)}px;animation-duration:${(8 + rndv(i + 2) * 6).toFixed(1)}s;animation-delay:-${(rndv(i + 5) * 10).toFixed(1)}s"/>`;
  return s;
}
// ---------- свет и глубина: текстура-шум, параллакс, лесные огоньки ----------
let NOISE_URL = '';
function makeNoise() {
  try {
    const c = document.createElement('canvas'); c.width = 96; c.height = 96;
    const x = c.getContext('2d'); const d = x.createImageData(96, 96);
    for (let i = 0; i < d.data.length; i += 4) { const v = 90 + Math.random() * 130; d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v; d.data[i + 3] = 34 + Math.random() * 44; }
    x.putImageData(d, 0, 0);
    NOISE_URL = c.toDataURL('image/png');
    document.documentElement.style.setProperty('--noise', `url(${NOISE_URL})`);
    // Лёгкое зерно для фона страницы (плитка 64x64, чёрные и белые точки с прозрачностью до 4%), вместо слоя на весь экран с mix-blend-mode
    const gc = document.createElement('canvas'); gc.width = 64; gc.height = 64;
    const gx = gc.getContext('2d'); const gd = gx.createImageData(64, 64);
    for (let i = 0; i < gd.data.length; i += 4) { const v = Math.random() < 0.5 ? 0 : 255; gd.data[i] = v; gd.data[i + 1] = v; gd.data[i + 2] = v; gd.data[i + 3] = 2 + Math.random() * 9; }
    gx.putImageData(gd, 0, 0);
    document.documentElement.style.setProperty('--grain', `url(${gc.toDataURL('image/png')})`);
    const host = document.createElement('div');
    host.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><pattern id="nz" width="48" height="48" patternUnits="userSpaceOnUse"><image href="${NOISE_URL}" width="48" height="48"/></pattern></defs></svg>`;
    document.body.appendChild(host.firstChild);
  } catch { /* текстура необязательна */ }
}
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let tiltBound = false;
function setParallax(x, y) {
  const sc = document.querySelector('.scene');
  if (sc) { sc.style.setProperty('--px', x.toFixed(3)); sc.style.setProperty('--py', y.toFixed(3)); }
}
// Слои сцены двигаются с разной скоростью: от пальца/мыши, от наклона телефона и от прокрутки
function bindParallax() {
  const sc = document.querySelector('.scene');
  if (!sc || REDUCED) return;
  sc.addEventListener('pointermove', (e) => { const r = sc.getBoundingClientRect(); setParallax(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1); });
  sc.addEventListener('pointerleave', () => setParallax(0, 0));
  if (tiltBound) return;
  tiltBound = true;
  window.addEventListener('deviceorientation', (e) => { if (e.gamma == null) return; setParallax(Math.max(-1, Math.min(1, e.gamma / 25)), Math.max(-1, Math.min(1, ((e.beta || 45) - 45) / 30))); });
  window.addEventListener('scroll', () => { const sc2 = document.querySelector('.scene'); if (sc2) sc2.style.setProperty('--sy', Math.min(1, window.scrollY / 380).toFixed(3)); }, { passive: true });
}
// Светящиеся духи поднимаются от кроны (по мере роста дерева их больше)
function spiritLights(g) {
  const n = Math.min(10, 3 + Math.floor(g));
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = 70 + rndv(i + 60) * 160; const y = 190 - rndv(i + 61) * 60;
    const col = i % 3 === 0 ? '#ffe9a8' : i % 3 === 1 ? '#9ff0d0' : '#bfe8ff';
    s += `<g class="spirit" style="--sx:${((rndv(i + 62) - 0.5) * 50).toFixed(0)}px;animation-duration:${(6 + rndv(i + 63) * 5).toFixed(1)}s;animation-delay:-${(rndv(i + 64) * 8).toFixed(1)}s"><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="6" fill="${col}" opacity=".22"/><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="1.8" fill="${col}"/></g>`;
  }
  return s;
}
// Настоящие картинки дерева (assets/trees/t1..t4.webp). Стадия выбирает картинку, прогресс внутри стадии её размер.
// Грузится только нужная стадия; соседняя следующая подгружается в простое.
const TREE_NEXT = { t1: 't2', t2: 't3', t3: 't4' };
const TREE_IDLE = {};
function treeImageFor(g) {
  const seg = g < 1 ? null : g < 3 ? ['t1', 1, 3] : g < 6 ? ['t2', 3, 6] : g < 9 ? ['t3', 6, 9] : ['t4', 9, 10];
  if (!seg) return '';
  loadAsset(seg[0], true);
  const nx = TREE_NEXT[seg[0]];
  if (nx && !ASSET_REQ[nx] && !TREE_IDLE[nx] && !saveDataOn()) { TREE_IDLE[nx] = 1; whenIdle(() => loadAsset(nx, false)); }
  if (!ASSET_OK[seg[0]]) return '';
  const f = Math.min(1, (g - seg[1]) / (seg[2] - seg[1]));
  const hb = 105 + 85 * f; const w = Math.min(260, hb * 1.05);
  return `<g class="canopy" style="transform-origin:150px 204px"><image href="${ASSET_SRC[seg[0]]}" x="${(150 - w / 2).toFixed(1)}" y="${(204 - hb).toFixed(1)}" width="${w.toFixed(1)}" height="${hb.toFixed(1)}" preserveAspectRatio="xMidYMax meet"/></g>`;
}
// g = стадия + доля пути к следующей (0..9.99). mood: sun | rain | dry. ba[k] = {fill 0..1, text}. anim: fertilize | salute.
function treeScene(g, mood, ba, anim) {
  const cx = 150; const gy = 200; const jy = 300;
  const dry = mood === 'dry'; const golden = g >= 9;
  const Lf = golden ? ['#f6d365', '#e8b02e', '#fbe48a', '#b9790f'] : dry ? ['#a39a45', '#8a8a3c', '#c0b25a', '#5f5d27'] : ['#3fbf6a', '#2c9a5a', '#86e6a2', '#17583a'];
  const sky = { sun: ['#4a7d86', '#a5b99a', '#f6cf86'], rain: ['#2a3744', '#46586a', '#7d8fa0'], dry: ['#4a3322', '#9a6a38', '#e0a860'] }[mood] || ['#4a7d86', '#a5b99a', '#f6cf86'];
  const hill = { sun: ['#3c5a55', '#24402f'], rain: ['#1f2f3d', '#15222d'], dry: ['#5d3a1d', '#41270f'] }[mood] || ['#3c5a55', '#24402f'];
  let defs = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset=".55" stop-color="${sky[1]}"/><stop offset="1" stop-color="${sky[2]}"/></linearGradient>
<linearGradient id="soil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b3421"/><stop offset=".5" stop-color="#2c1d11"/><stop offset="1" stop-color="#140c06"/></linearGradient>
<linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${dry ? '#aa9e48' : '#4cb773'}"/><stop offset="1" stop-color="${dry ? '#6b5e2a' : '#1f6b44'}"/></linearGradient>
<linearGradient id="bark" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#37230f"/><stop offset=".45" stop-color="#80562f"/><stop offset="1" stop-color="#33200e"/></linearGradient>
<radialGradient id="cg"><stop offset="0" stop-color="${Lf[2]}" stop-opacity=".5"/><stop offset="1" stop-color="${Lf[2]}" stop-opacity="0"/></radialGradient>
<radialGradient id="sg"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".9"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient>`;
  C.BASKETS.forEach((k) => { defs += `<linearGradient id="jf-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BASKET_COLOR[k]}"/><stop offset="1" stop-color="${BASKET_COLOR[k]}" stop-opacity=".62"/></linearGradient>`; });
  defs += BACKDROP_DEFS;
  let s = `<svg class="treeSvg" viewBox="0 0 300 380" role="img" aria-label="${esc(t('tree_hint'))}"><defs>${defs}</defs>`;
  // небо, лес, замок, лучи света (или готовая картинка assets/scene/bg.webp)
  s += `<rect width="300" height="${gy + 1}" fill="url(#sky)"/>`;
  if (ASSET_OK.bg) s += `<image href="${ASSET_SRC.bg}" x="0" y="0" width="300" height="${gy + 1}" preserveAspectRatio="xMidYMid slice"/>`;
  else s += `<g class="px px1">${backdrop(mood, gy)}</g>`;
  s += `<g class="px px2"><path d="M-12 ${gy - 18} Q70 ${gy - 34} 140 ${gy - 20} T312 ${gy - 22} V${gy}H-12Z" fill="${hill[1]}"/></g>`;
  if (!ASSET_OK.bg) s += `<g class="px px3">${frameTrees(mood, gy)}</g>`;
  // земля
  s += `<rect y="${gy}" width="300" height="180" fill="url(#soil)"/><path d="M0 252 Q75 246 150 253 T300 250 M0 330 Q90 322 180 331 T300 327" stroke="#fff" stroke-opacity=".05" stroke-width="2" fill="none"/>`;
  if (NOISE_URL) s += `<rect y="${gy}" width="300" height="180" fill="url(#nz)" opacity=".5"/>`;
  for (let i = 0; i < 12; i++) s += `<ellipse cx="${(8 + rndv(i + 11) * 284).toFixed(1)}" cy="${(gy + 26 + rndv(i + 31) * 150).toFixed(1)}" rx="${(2 + rndv(i + 5) * 3.5).toFixed(1)}" ry="${(1.6 + rndv(i + 9) * 2).toFixed(1)}" fill="#7a6650" opacity=".45"/>`;
  // корни: от каждой банки к стволу
  C.BASKETS.forEach((k, i) => {
    const jx = JAR_X[i]; const f = Math.max(0, Math.min(1, ba[k].fill));
    const a = [jx, jy - 4]; const b = [jx, jy - 50]; const c = [cx + (jx - cx) * 0.3, gy + 56]; const d = [cx + (jx - cx) * 0.06, gy + 8];
    s += taper(a, b, c, d, 1.8 + 2.2 * f, 5.5 + 3.5 * f, '#1d1109', 18).replace(/stroke-width="([\d.]+)"/g, (m, w) => `stroke-width="${(Number(w) + 1.8).toFixed(2)}"`);
    s += taper(a, b, c, d, 1.8 + 2.2 * f, 5.5 + 3.5 * f, '#6c4727', 18);
    [0.34, 0.55, 0.74].forEach((u, n) => {
      const p = bz(a, b, c, d, u); const side = (rndv(i * 7 + n) > 0.5 ? 1 : -1); const dx = side * (9 + rndv(i + n * 3) * 9); const dy = 5 + rndv(i * 3 + n) * 9;
      s += `<path d="M${p[0].toFixed(1)} ${p[1].toFixed(1)} q${(dx * 0.5).toFixed(1)} ${(dy * 0.1).toFixed(1)} ${dx.toFixed(1)} ${dy.toFixed(1)}" stroke="#5a3b20" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".9"/>`;
    });
    const pathD = `M${a[0]} ${a[1]} C${b[0]} ${b[1]} ${c[0].toFixed(1)} ${c[1]} ${d[0].toFixed(1)} ${d[1]}`;
    s += `<path class="vein" d="${pathD}" stroke="${BASKET_COLOR[k]}" stroke-width="${(1.6 + 1.4 * f).toFixed(1)}" fill="none" stroke-linecap="round" opacity="${(0.28 + 0.72 * f).toFixed(2)}"/>`;
    s += `<path class="hit" data-act="openHelp" data-v="${k}" d="${pathD}" stroke="transparent" stroke-width="22" fill="none" pointer-events="stroke"/>`;
  });
  // банки-корзины
  C.BASKETS.forEach((k, i) => {
    const jx = JAR_X[i]; const f = Math.max(0, Math.min(1, ba[k].fill)); const h = 38 * f;
    const img = !!ASSET_OK.jar; // живописная банка assets/jars/jar.webp; если файла нет, рисуется векторная
    s += `<g transform="translate(${jx} ${jy})"><ellipse cx="0" cy="${img ? 44 : 42}" rx="${img ? 25 : 27}" ry="5" fill="#000" opacity=".35"/><circle class="jarglow" cx="0" cy="19" r="30" fill="${BASKET_COLOR[k]}" opacity=".3"/>`;
    if (img) {
      // Внутри банки уровень наполнения: полость банки = эллипс JAR_IN, наполнение растёт снизу вверх и обрезается по нему. Стекло банки лежит поверх.
      const by = JAR_IN.cy + JAR_IN.ry; const top = by - 2 * JAR_IN.ry * f;
      s += `<clipPath id="jc-${k}"><ellipse cx="${JAR_IN.cx}" cy="${JAR_IN.cy}" rx="${JAR_IN.rx}" ry="${JAR_IN.ry}"/></clipPath><ellipse cx="${JAR_IN.cx}" cy="${JAR_IN.cy}" rx="${JAR_IN.rx}" ry="${JAR_IN.ry}" fill="#0a1411" opacity=".7"/>`;
      s += `<image href="${ASSET_SRC.jar}" x="${(-JAR_IMG.w / 2).toFixed(1)}" y="${JAR_IMG.y}" width="${JAR_IMG.w}" height="${JAR_IMG.h}" preserveAspectRatio="none"/>`;
      // наполнение поверх стекла со смешением «экран»: цвет светится изнутри, блики стекла остаются
      s += `<g clip-path="url(#jc-${k})" style="mix-blend-mode:screen">${f > 0.02 ? `<rect x="-24" y="${top.toFixed(1)}" width="48" height="${(by - top + 3).toFixed(1)}" fill="url(#jf-${k})"/><path d="M-24 ${top.toFixed(1)} q6 -3 12 0 t12 0 t12 0 t12 0 v4 h-48z" fill="${BASKET_COLOR[k]}"/><rect x="-24" y="${top.toFixed(1)}" width="48" height="1.3" fill="#fff" opacity=".6"/>` : ''}</g>`;
      s += `<circle cx="0" cy="${JAR_IN.cy}" r="7.2" fill="${BASKET_COLOR[k]}" stroke="#2b1a06" stroke-width="1.2"/><circle cx="0" cy="${JAR_IN.cy}" r="7.2" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".8"/><g transform="translate(0 ${JAR_IN.cy}) scale(.85)">${jarIcon(k)}</g>`;
      s += `<text class="rl" y="58">${esc(t('b_' + k))}</text><text class="rv" y="69">${esc(ba[k].text)}</text>`;
      s += `<rect class="hit" data-act="openHelp" data-v="${k}" x="-28" y="-12" width="56" height="86" fill="transparent"/></g>`;
      return;
    }
    s += `<clipPath id="jc-${k}"><rect x="-19" y="0" width="38" height="38" rx="11"/></clipPath><rect x="-19" y="0" width="38" height="38" rx="11" fill="#0a1411" opacity=".82"/>`;
    s += `<g clip-path="url(#jc-${k})"><rect x="-20" y="${(38 - h).toFixed(1)}" width="40" height="${(h + 2).toFixed(1)}" fill="url(#jf-${k})"/>${f > 0.04 ? `<path d="M-20 ${(38 - h).toFixed(1)} q5 -3 10 0 t10 0 t10 0 t10 0 v4 h-40z" fill="${BASKET_COLOR[k]}"/>` : ''}</g>`;
    s += `<path d="M-14 6 Q-16 18 -13 30" stroke="#fff" stroke-opacity=".35" stroke-width="2.4" fill="none" stroke-linecap="round"/><rect x="-19" y="0" width="38" height="38" rx="11" fill="none" stroke="#c9a24a" stroke-width="1.8"/>`;
    s += `<rect x="-13" y="-6" width="26" height="8" rx="3" fill="#8a5e2c" stroke="#c9a24a" stroke-width="1.2"/><g transform="translate(0 19)">${jarIcon(k)}</g>`;
    s += `<text class="rl" y="55">${esc(t('b_' + k))}</text><text class="rv" y="66">${esc(ba[k].text)}</text>`;
    s += `<rect class="hit" data-act="openHelp" data-v="${k}" x="-28" y="-8" width="56" height="80" fill="transparent"/></g>`;
  });
  // трава, грибы
  let gp = `M0 ${gy + 7} V${gy - 1}`;
  for (let x = 0; x < 300; x += 10) gp += ` q5 -${x % 20 ? 7 : 5} 10 0`;
  s += `<path d="${gp} V${gy + 7}Z" fill="url(#grass)"/>`;
  if (g >= 1) [[58, 1], [246, 0.8]].forEach(([mx, sc]) => { s += `<g transform="translate(${mx} ${gy - 1}) scale(${sc})"><circle cy="-6" r="13" fill="#f08fb5" opacity=".22" class="jarglow"/><rect x="-1.6" y="-6" width="3.2" height="7" fill="#efe3c8"/><path d="M-7 -5 Q0 -15 7 -5Z" fill="#e0709b"/><circle cx="-2" cy="-8" r="1" fill="#fff"/><circle cx="2.5" cy="-7" r="0.9" fill="#fff"/></g>`; });
  // дерево
  s += `<g class="treeg${anim === 'fertilize' ? ' pulse' : ''}">`;
  const blobs = [];
  const timg = treeImageFor(g);
  if (timg) s += timg;
  else if (g < 0.5) {
    s += `<path d="M${cx} ${gy} l-6 -13 M${cx} ${gy} l2 -17 l7 -6" stroke="#6b5a3a" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  } else {
    const th = g < 1 ? 20 * g : 20 + (g - 1) * 12;
    const tw = 3 + g * 1.7; const topY = gy - th; const bw = tw * 1.5;
    s += `<path d="M${cx - bw} ${gy + 3} C${cx - tw * 0.6} ${gy - th * 0.14} ${cx - tw * 0.5} ${gy - th * 0.6} ${cx - tw * 0.32} ${topY} L${cx + tw * 0.32} ${topY} C${cx + tw * 0.5} ${gy - th * 0.6} ${cx + tw * 0.6} ${gy - th * 0.14} ${cx + bw} ${gy + 3}Z" fill="url(#bark)"/>`;
    s += `<path d="M${cx - tw * 0.15} ${gy - 4} q-2 ${-th * 0.3} 0 ${-th * 0.6} M${cx + tw * 0.2} ${gy - 4} q2 ${-th * 0.25} 0 ${-th * 0.5}" stroke="#20130a" stroke-opacity=".35" stroke-width="1.2" fill="none"/>`;
    if (g < 2) {
      const pairs = 2 + Math.floor(g * 1.5);
      for (let j = 0; j < pairs; j++) {
        const y = gy - th * (0.35 + 0.65 * (j / Math.max(1, pairs - 1))); const sc = 0.6 + 0.4 * (1 - j / pairs);
        s += `<ellipse cx="${cx + 9 * sc}" cy="${y - 1}" rx="${10 * sc}" ry="${5 * sc}" transform="rotate(-25 ${cx + 9 * sc} ${y - 1})" fill="${Lf[0]}"/><ellipse cx="${cx - 9 * sc}" cy="${y + 2}" rx="${10 * sc}" ry="${5 * sc}" transform="rotate(25 ${cx - 9 * sc} ${y + 2})" fill="${Lf[1]}"/>`;
      }
    } else {
      const R = 12 + (g - 2) * 6.4; const cy = topY - R * 0.12;
      s += `<g class="canopy" style="transform-origin:${cx}px ${topY.toFixed(0)}px"><circle class="glowpulse" cx="${cx}" cy="${cy}" r="${R + 36}" fill="url(#cg)"/>`;
      for (let j = 0; j < Math.min(6, Math.floor(g)); j++) {
        const by = gy - th * (0.3 + 0.1 * j); const side = j % 2 ? 1 : -1; const e = [cx + side * (12 + j * 6), by - 14 - j * 4];
        s += taper([cx, by], [cx + side * 4, by - 8], [e[0] - side * 5, e[1] + 4], e, Math.max(1.4, tw * 0.3), 1.1, '#5b3b20', 8);
      }
      const n = Math.min(34, 7 + Math.floor((g - 2) * 3.8));
      for (let i = 0; i < n; i++) {
        const a = rndv(i) * 6.283; const dist = R * Math.sqrt(rndv(i + 50));
        const bx = cx + Math.cos(a) * dist * 1.2; const by = cy + Math.sin(a) * dist * 0.85 + (dry ? 4 : 0); const r = 7 + g * 1.1 + rndv(i + 99) * 3;
        blobs.push([bx, by, r]);
      }
      blobs.forEach(([bx, by, r]) => { s += `<circle cx="${(bx + 1.5).toFixed(1)}" cy="${(by + 3).toFixed(1)}" r="${(r * 1.06).toFixed(1)}" fill="${Lf[3]}"/>`; });
      blobs.forEach(([bx, by, r], i) => { s += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${r.toFixed(1)}" fill="${Lf[i % 2]}"/>`; });
      blobs.forEach(([bx, by, r], i) => { if (i % 2 === 0) s += `<circle cx="${(bx - r * 0.25).toFixed(1)}" cy="${(by - r * 0.3).toFixed(1)}" r="${(r * 0.55).toFixed(1)}" fill="${Lf[2]}" opacity=".8"/>`; });
      for (let i = 0; i < 16; i++) { const a = rndv(i + 70) * 6.283; const lx = cx + Math.cos(a) * (R * 1.2 + 9); const ly = cy + Math.sin(a) * (R * 0.85 + 7); s += `<ellipse cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" rx="5" ry="2.6" transform="rotate(${(a * 57).toFixed(0)} ${lx.toFixed(1)} ${ly.toFixed(1)})" fill="${Lf[i % 3]}"/>`; }
      if (golden) s += `<circle cx="${cx}" cy="${cy}" r="${R + 34}" fill="#f2c94c" opacity=".12"/>`;
      if (g >= 6) blobs.slice(0, Math.min(14, Math.floor((g - 5) * 4))).forEach(([bx, by], i) => { const fx = bx + 5 * (rndv(i) - 0.5); const fy = by - 5; s += `<circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="3" fill="#f8b4d6"/><circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="1.1" fill="#ffe27a"/>`; });
      if (g >= 7) blobs.slice(3, 3 + Math.min(10, Math.floor((g - 6) * 4))).forEach(([bx, by]) => { s += `<circle cx="${(bx + 3).toFixed(1)}" cy="${(by + 6).toFixed(1)}" r="4.6" fill="#f2c94c" stroke="#b8860b" stroke-width="1"/><circle cx="${(bx + 1.8).toFixed(1)}" cy="${(by + 4.6).toFixed(1)}" r="1.3" fill="#fff6c8"/>`; });
      s += '</g>';
    }
  }
  s += '</g>';
  // светлячки, дождь, анимации
  if (mood !== 'rain') for (let i = 0; i < 9; i++) s += `<g class="ff" style="--fx:${((rndv(i + 3) - 0.5) * 36).toFixed(0)}px;--fy:${((rndv(i + 8) - 0.5) * 26).toFixed(0)}px;animation-delay:${(i * 0.7).toFixed(1)}s,${(i * 0.4).toFixed(1)}s"><circle cx="${(24 + rndv(i + 1) * 252).toFixed(0)}" cy="${(gy - 120 + rndv(i + 2) * 112).toFixed(0)}" r="5" fill="#fff3b0" opacity=".25"/><circle cx="${(24 + rndv(i + 1) * 252).toFixed(0)}" cy="${(gy - 120 + rndv(i + 2) * 112).toFixed(0)}" r="1.6" fill="#fff8d0"/></g>`;
  if (mood !== 'rain') s += fallingLeaves(mood);
  if (g >= 2.5) s += spiritLights(g);
  if (mood === 'rain') for (let i = 0; i < 16; i++) s += `<line class="drop" x1="${20 + i * 17}" y1="50" x2="${17 + i * 17}" y2="62" stroke="#9cc8ff" stroke-width="1.4" style="animation-delay:${(i % 5) * 0.2}s"/>`;
  if (anim === 'fertilize') {
    C.BASKETS.forEach((k, i) => {
      const jx = JAR_X[i]; const dur = '2.4s'; const begin = `${(i * 0.3).toFixed(1)}s`;
      const pathD = `M${jx} ${jy - 4} C${jx} ${jy - 50} ${(cx + (jx - cx) * 0.3).toFixed(1)} ${gy + 56} ${(cx + (jx - cx) * 0.06).toFixed(1)} ${gy + 8}`;
      s += `<g opacity="0"><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.12;.88;1" dur="${dur}" begin="${begin}" fill="freeze"/><animateMotion path="${pathD}" dur="${dur}" begin="${begin}" fill="freeze"/>${miniGnome(BASKET_COLOR[k])}</g>`;
    });
  }
  if (anim === 'salute' || golden) for (let i = 0; i < 12; i++) s += `<path class="spark" d="M0 -5 L1.4 -1.4 L5 0 L1.4 1.4 L0 5 L-1.4 1.4 L-5 0 L-1.4 -1.4Z" transform="translate(${30 + rndv(i + 7) * 240} ${20 + rndv(i + 21) * 150})" fill="#f7dc6f" style="animation-delay:${(i % 6) * 0.2}s"/>`;
  return s + '<rect width="300" height="380" fill="url(#vig)" pointer-events="none"/></svg>';
}

const moneyShort = (n) => {
  if (n < 10000) { try { return new Intl.NumberFormat(loc(), { style: 'currency', currency: S().profile.currency, maximumFractionDigits: 0 }).format(n); } catch { return String(Math.round(n)); } }
  try { return new Intl.NumberFormat(loc(), { style: 'currency', currency: S().profile.currency, notation: 'compact', maximumFractionDigits: 1 }).format(n); } catch { return String(Math.round(n)); }
};

function treeCard() {
  const today = C.ymd();
  const q = new URLSearchParams(location.search);
  const ts = C.treeState(S(), today);
  const prev = S().progress.stage || 0;
  const base = Math.max(prev, ts.stage);
  let g = base + (ts.stage >= prev ? ts.p * 0.99 : 0);
  const demo = parseFloat(q.get('stage')); // ?stage=6.5 показывает любую стадию для просмотра
  if (Number.isFinite(demo)) g = Math.max(0, Math.min(9.99, demo));
  const stage = Math.floor(g);
  const lim = C.todayLimit(S(), today);
  const mood = ['sun', 'rain', 'dry'].includes(q.get('mood')) ? q.get('mood') : lim.over ? 'dry' : S().incomes.some((i) => i.date === today) ? 'rain' : 'sun';
  const st = C.basketStats(S(), today);
  const ps = C.portfolioStats(S(), today);
  const ba = {};
  C.BASKETS.forEach((k) => {
    const x = st[k];
    const fill = x.spendable && k !== 'debts' ? (x.planned > 0 ? Math.max(0, Math.min(1, x.left / x.planned)) : 0) : x.progress;
    const amount = k === 'cushion' ? C.cushionTotal(S()) : k === 'invest' ? ps.value : Math.max(0, x.left);
    ba[k] = { fill, text: moneyShort(amount) };
  });
  const anim = ui.anim && Date.now() - ui.anim.at < 15000 ? ui.anim.type : q.get('anim');
  ui.anim = null;
  const waiting = lim.joyBudget <= 0;
  const big = waiting ? '—' : lim.over ? t('today_over_short') : money(lim.left);
  const prelim = C.pilotStatus(S(), today) === 'running' && !waiting ? ` <span class="tag">${t('prelim')}</span>` : '';
  const np = g - stage;
  const wk = C.weekLimit(S(), today);
  return `<section class="scene" data-mood="${mood}"><div class="sceneArt">${treeScene(g, mood, ba, anim)}</div>
<div class="sign" role="group" aria-label="${esc(t('today_can'))}"><span class="sglow" aria-hidden="true"></span><small>${t('today_can')}</small><b class="${lim.over ? 'amber' : ''}">${esc(big)}</b>${waiting ? '' : `<i>${t('today_days', { n: lim.daysLeft })}${prelim}</i>`}</div>
<button class="buddy" data-act="talkGnome" aria-label="${esc(t('gn_talk'))}">${gnomeSvg('gardener')}<span class="hint" aria-hidden="true">…</span></button><button class="sndbtn" data-act="cycleSound" aria-label="${esc(t('set_sound'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none"/>${S().profile.sound === 'off' ? '<path d="M16 9l5 6M21 9l-5 6"/>' : S().profile.sound === 'all' ? '<path d="M16 8.5a5 5 0 0 1 0 7M18.8 6a9 9 0 0 1 0 12"/>' : '<path d="M16 9a4 4 0 0 1 0 6"/>'}</svg></button></section>
<section class="card stagebox"><div class="between"><h3>${esc(t('tree_stage', { n: stage, name: t('st_' + stage) }))}</h3>${stage < C.TREE_MAX ? `<span class="muted small">${Math.round(np * 100)}%</span>` : ''}</div>${stage < C.TREE_MAX ? bar(np, 'b-invest') : ''}<p class="muted small">${stage >= C.TREE_MAX ? t('tree_max') : t('tree_next', { goal: t('goal_' + (stage + 1)) })}</p>${waiting ? `<p class="small">${t('calc_wait')}</p>` : ''}${waiting ? '' : `<p class="small ${wk.over ? 'amber' : ''}">${wk.over ? t('week_over') : t('week_left', { a: money(wk.left) })}</p>`}<p class="muted small">${t('roots_hint')}</p><p class="muted small startline">${t('started')}: ${esc(longDate(S().profile.startDate || today))}</p></section>`;
}


// ---------- гномы ----------
// Пять гномов: у каждого свой колпак и туника (красный колпак и зелёная туника у садовника, как на референсе)
const GN = {
  gardener: { hat: '#c8322c', hat2: '#8c1c1d', tun: '#3f7d3c', tun2: '#28592a', cuff: '#c2b08a' },
  grumpy: { hat: '#b8481f', hat2: '#7a2a12', tun: '#4a6a3a', tun2: '#30472a', cuff: '#b3a27c' },
  comforter: { hat: '#4f86b8', hat2: '#2f5c86', tun: '#d8c99f', tun2: '#a89a72', cuff: '#efe6c8' },
  teacher: { hat: '#2f9690', hat2: '#1c6560', tun: '#7b5a35', tun2: '#553b20', cuff: '#c2b08a' },
  investor: { hat: '#d3a02e', hat2: '#8f6a14', tun: '#7d2a38', tun2: '#541a26', cuff: '#c2b08a' },
};
function gnomeSvg(type) {
  if (ASSET_OK['g-' + type]) return `<img class="gnome gnomeImg" src="${ASSET_SRC['g-' + type]}" alt="" decoding="async" draggable="false">`;
  loadAsset('g-' + type, false); // в этот раз рисуется вектор, в следующий уже картинка
  const c = GN[type] || GN.gardener; const id = 'gn' + (GN[type] ? type : 'gardener');
  const mad = type === 'grumpy';
  const arms = mad
    ? `<path d="M19 88 Q50 112 81 90 L79 101 Q50 122 21 100Z" fill="${c.tun2}" stroke="#0006" stroke-width=".8"/><ellipse cx="20" cy="97" rx="6" ry="3" fill="${c.cuff}"/><ellipse cx="80" cy="97" rx="6" ry="3" fill="${c.cuff}"/><circle cx="17" cy="97" r="4.6" fill="url(#${id}f)"/><circle cx="83" cy="97" r="4.6" fill="url(#${id}f)"/>`
    : `<path d="M23 82 Q12 92 15 108 L26 106 Q24 94 31 84Z" fill="${c.tun}"/><path d="M77 82 Q88 92 85 108 L74 106 Q76 94 69 84Z" fill="${c.tun}"/><ellipse cx="20.5" cy="108" rx="7" ry="3.3" fill="${c.cuff}"/><ellipse cx="79.5" cy="108" rx="7" ry="3.3" fill="${c.cuff}"/><circle cx="20.5" cy="113" r="5" fill="url(#${id}f)"/><circle cx="79.5" cy="113" r="5" fill="url(#${id}f)"/>`;
  const prop = {
    gardener: '<g transform="translate(69 99)"><rect width="17" height="13" rx="3" fill="#98a5ad"/><rect x="1.5" y="1.5" width="4" height="10" rx="2" fill="#fff" opacity=".28"/><path d="M17 4 L26 -3" stroke="#98a5ad" stroke-width="2.6" stroke-linecap="round"/><path d="M2 3 Q-6 3 -5 10" stroke="#7d8a92" stroke-width="2" fill="none"/></g>',
    comforter: '<g transform="translate(79 101)"><path d="M0 12 V0" stroke="#3a8a4a" stroke-width="2.2"/><g fill="#f4a3c7"><circle cy="-4" r="3.4"/><circle cx="-3.5" cy="-1.5" r="3.4"/><circle cx="3.5" cy="-1.5" r="3.4"/><circle cx="-2" cy="1.8" r="3.4"/><circle cx="2" cy="1.8" r="3.4"/></g><circle cy="-.6" r="2.2" fill="#ffd96b"/></g>',
    teacher: '<g transform="translate(68 98) rotate(-8)"><rect width="18" height="13" rx="1.5" fill="#6b3f1d"/><rect x="2" y="1.5" width="14" height="10" fill="#f2e6c8"/><path d="M9 1.5 V11.5" stroke="#6b3f1d"/></g>',
    investor: '<g transform="translate(70 98)"><path d="M3 4 Q-4 10 -1 18 H16 Q19 10 12 4Z" fill="#8a5a2b"/><path d="M3 4 L5 0 H10 L12 4Z" fill="#6b4222"/><circle cx="7.5" cy="12" r="4" fill="#f2c94c" stroke="#b8860b"/></g>',
    grumpy: '',
  }[type] || '';
  const glasses = type === 'teacher' ? '<g fill="none" stroke="#2a1d12" stroke-width="1.3"><circle cx="42" cy="53" r="5"/><circle cx="58" cy="53" r="5"/><path d="M47 53 H53"/></g>' : '';
  const brows = mad ? '<path d="M35 46 L48 50.5 M65 46 L52 50.5" stroke="#e9e6dc" stroke-width="3.8" stroke-linecap="round"/>' : '<path d="M36 47.5 Q42 44 48 48 M52 48 Q58 44 64 47.5" stroke="#e9e6dc" stroke-width="3.6" stroke-linecap="round" fill="none"/>';
  const mouth = mad ? '<path d="M45 70 Q50 67 55 70" stroke="#7a3b2e" stroke-width="1.6" fill="none" stroke-linecap="round"/>' : '';
  return `<svg class="gnome" viewBox="0 0 100 130" aria-hidden="true"><defs>`
    + `<linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.tun}"/><stop offset="1" stop-color="${c.tun2}"/></linearGradient>`
    + `<linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.hat}"/><stop offset="1" stop-color="${c.hat2}"/></linearGradient>`
    + `<radialGradient id="${id}f" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#f8d6b2"/><stop offset="1" stop-color="#d99d74"/></radialGradient>`
    + `<linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#cdc8ba"/></linearGradient></defs>`
    + `<ellipse cx="50" cy="124" rx="29" ry="5" fill="#000" opacity=".3"/>`
    + `<path d="M28 116 q0 -8 10 -8 h6 q4 0 4 8 v4 q0 4 -5 4 h-10 q-5 0 -5 -4z" fill="#3a2414"/><path d="M56 116 q0 -8 4 -8 h6 q10 0 10 8 v4 q0 4 -5 4 h-10 q-5 0 -5 -4z" fill="#3a2414"/>`
    + `<rect x="32" y="98" width="15" height="18" rx="3" fill="#5a3b22"/><rect x="53" y="98" width="15" height="18" rx="3" fill="#5a3b22"/>`
    + `<g class="g-body"><path d="M22 104 Q18 78 50 72 Q82 78 78 104 Q50 112 22 104Z" fill="url(#${id}t)" stroke="#2a160a" stroke-width="1.1" stroke-linejoin="round"/><path d="M22 104 Q18 78 50 72 Q34 86 34 108Z" fill="#000" opacity=".15"/>`
    + `<path d="M36 76 L38 102 M64 76 L62 102" stroke="#7a4a26" stroke-width="5" stroke-linecap="round"/><rect x="34.5" y="88" width="7" height="5" rx="1" fill="#d7b25a" stroke="#8a6410" stroke-width=".8"/><rect x="58.5" y="88" width="7" height="5" rx="1" fill="#d7b25a" stroke="#8a6410" stroke-width=".8"/>`
    + `<rect x="24" y="100" width="52" height="6" rx="1" fill="#5a3418"/><rect x="43" y="98.5" width="14" height="9" rx="1.5" fill="#e0bb62" stroke="#8a6410"/><rect x="46" y="101.5" width="8" height="3" fill="#5a3418"/><rect x="64" y="103" width="9" height="9" rx="2" fill="#6b4222"/></g>`
    + arms
    + `<path d="M33 54 L18 45 Q21 58 34 64Z" fill="#e6b088"/><path d="M67 54 L82 45 Q79 58 66 64Z" fill="#e6b088"/><circle cx="50" cy="56" r="18" fill="url(#${id}f)" stroke="#2a160a" stroke-width="1" />`
    + `<ellipse cx="38" cy="62" rx="4.4" ry="3.4" fill="#e98d7c" opacity=".4"/><ellipse cx="62" cy="62" rx="4.4" ry="3.4" fill="#e98d7c" opacity=".4"/>`
    + `<g class="g-beard"><path d="M32 60 Q30 84 40 98 Q50 110 60 98 Q70 84 68 60 Q60 74 50 70 Q40 74 32 60Z" fill="url(#${id}b)" stroke="#2a160a" stroke-width="1.1" stroke-linejoin="round"/><path d="M40 76 Q42 90 44 99 M50 74 V104 M60 76 Q58 90 56 99" stroke="#b9b2a2" stroke-width="1" fill="none" opacity=".8"/></g>`
    + `<path d="M50 66 Q41 63 33 69 Q42 74 50 69 Q58 74 67 69 Q59 63 50 66Z" fill="url(#${id}b)"/>${mouth}`
    + `<ellipse cx="50" cy="61.5" rx="6" ry="5" fill="#e58f72"/><ellipse cx="48.4" cy="60" rx="2" ry="1.4" fill="#f6b79e" opacity=".8"/>`
    + `<g class="g-eyes"><circle cx="42" cy="53" r="2.4" fill="#2b1a10"/><circle cx="58" cy="53" r="2.4" fill="#2b1a10"/><circle cx="41.3" cy="52.2" r=".8" fill="#fff"/><circle cx="57.3" cy="52.2" r=".8" fill="#fff"/></g>${brows}${glasses}`
    + `<g class="g-hat"><path d="M29 49 C28 30 40 14 56 10 C66 7.5 76 10 88 4 C86 15 78 22 70 26 C73 34 75 42 74 49 Q51 56 29 49Z" fill="url(#${id}h)" stroke="#2a160a" stroke-width="1.1" stroke-linejoin="round"/><path d="M36 46 C36 32 44 20 58 14" stroke="#fff" stroke-opacity=".22" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M29 49 Q51 56 74 49 L74 44.5 Q51 51 29 44.5Z" fill="${c.hat2}"/></g>`
    + `<g class="g-prop">${prop}</g></svg>`;
}// Здороваемся раз в день и отвечаем на нажатие по гному у дерева
function tipText() {
  const today = C.ymd(); const lim = C.todayLimit(S(), today);
  if (lim.joyBudget <= 0) return t('gn_hello_wait');
  if (lim.over) return t('gn_hello_over');
  return t('gn_hello_ok', { n: money(lim.left) });
}
// «Что нового»: какую версию человек уже видел на этом телефоне
const SEEN_KEY = 'tgm_seen_ver';
const getSeen = () => { try { return localStorage.getItem(SEEN_KEY) || ''; } catch { return ''; } };
const setSeen = (v) => { try { localStorage.setItem(SEEN_KEY, v); } catch { /* без памяти покажем снова, это не страшно */ } };
// Показывает окно после обновления. Новичку не показываем: он только что всё увидел сам (см. finishOnboarding)
function maybeNews() {
  if (ui.modal || ui.tour || ui.afterAuth || ui.screen === 'onboarding' || !S().profile.onboarded || S().profile.tourDone === false) return false;
  if (getSeen() === APP_VER) return false;
  ui.modal = { type: 'whatsnew', seen: getSeen() };
  render();
  return true;
}
function newsBody(seen) {
  const lang = S().profile.lang;
  const { shown, older } = newsFor(seen);
  const block = (e) => `<div class="news"><h4><b>${t('news_ver', { v: e.v })}</b> <span class="muted small">${esc(longDate(e.date))}</span></h4><ul>${(e.items[lang] || e.items.en || e.items.ru).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
  return `<h3>${t('news_title')}</h3>${shown.map(block).join('')}${older.length ? `<details><summary>${t('news_older')}</summary>${older.map(block).join('')}</details>` : ''}<div class="foot"><span></span><button class="btn primary" data-act="closeModal">${t('news_ok')}</button></div>`;
}

// Автообновление: сверяем версию на сайте с запущенной и, если вышла новее, перезапускаем приложение.
// Если открыто окно или идёт обучение, ждём, пока человек закончит, чтобы не потерять то, что он вводит.
let updating = false;
async function checkUpdate(manual) {
  if (updating || !/^https?:$/.test(location.protocol)) return;
  try {
    const r = await fetch('index.html?u=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('offline');
    const m = /js\/app\.js\?v=([\d.]+)/.exec(await r.text());
    if (!m || cmpVersion(m[1], APP_VER) <= 0) { if (manual) toast(t('upd_latest', { v: APP_VER })); return; }
    if (ui.modal || ui.tour || ui.screen === 'onboarding') { if (manual) toast(t('upd_later'), true); return; }
    let tried = '';
    try { tried = sessionStorage.getItem('tgm_upd_try') || ''; } catch { /* без памяти обновимся один раз за запуск */ }
    if (tried === m[1] && !manual) return; // не гоняем перезагрузку по кругу, если сайт отдаёт старое из кэша
    try { sessionStorage.setItem('tgm_upd_try', m[1]); } catch { /* ignore */ }
    updating = true;
    toast(t('upd_now', { v: m[1] }));
    try { const reg = await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); } catch { /* ничего */ }
    setTimeout(() => location.reload(), 1300);
  } catch { if (manual) toast(t('upd_offline'), true); }
}

function greetToday() {
  if (!S().profile.onboarded || ui.screen === 'onboarding' || ui.tour) return;
  if (maybeNews()) return; // сначала рассказываем про обновление; приветствие гнома придёт после закрытия окна
  const today = C.ymd();
  if (S().gnome.greeted === today) return;
  const offer = teacherOffer(today);
  store.update((s) => {
    s.gnome.greeted = today;
    if (offer) { s.gnome.teacher = s.gnome.teacher || { seen: [], last: null }; s.gnome.teacher.last = today; }
  });
  const items = [{ type: 'gardener', text: tipText(), ms: 8000 }];
  const near = C.upcomingPayments(S(), today, 2);
  const soon = near.find((x) => !x.incoming);
  if (soon) items.push({ type: 'gardener', text: t('rem_gnome', { name: soon.name, when: payWhen(soon) }), ms: 8000 });
  const back = near.find((x) => x.incoming);
  if (back) items.push({ type: 'gardener', text: t('loan_gnome', { name: back.name, when: payWhen(back) }), ms: 8000 });
  if (offer) items.push(offer);
  gnomeSay(items);
}
// Гном-учитель: советует материал по финансовой картине (не чаще раза в 3 дня), в «Ещё» можно позвать самому
const tchState = () => S().gnome.teacher || { seen: [], last: null };
function teacherPick(ignoreSeen) {
  return C.pickLesson(S(), LIBRARY, S().profile.lang, C.ymd(), ignoreSeen ? [] : tchState().seen);
}
function teacherOffer(today) {
  const st = tchState();
  if (st.last && C.diffDays(st.last, today) < 3) return null;
  const pick = teacherPick(false);
  if (!pick) return null;
  return {
    type: 'teacher', text: t('tch_pop', { topic: t('tch_t_' + pick.tag) }),
    buttons: [{ act: 'teacherShow', v: pick.item.id, label: t('tch_show') }, { act: 'gnomeNext', label: t('tch_later') }],
  };
}
function teacherMarkSeen(id) {
  store.update((s) => {
    const g = s.gnome.teacher || (s.gnome.teacher = { seen: [], last: null });
    if (!g.seen.includes(id)) g.seen.push(id);
  });
}
const gq = [];
let gcur = null;
function gnomeNext() {
  clearTimeout(gnomeNext.timer);
  const box = document.getElementById('gnomeBox');
  const it = gq.shift();
  gcur = it || null;
  if (!box) return;
  if (!it) { box.innerHTML = ''; return; }
  snd.play({ grumpy: 'grumble', comforter: 'comfort', investor: 'coin' }[it.type] || 'pop');
  const btns = (it.buttons || []).map((b) => `<button class="gbtn" data-act="${b.act}" data-v="${esc(b.v || '')}">${esc(b.label)}</button>`).join('') || `<button class="gbtn ghost" data-act="gnomeNext">${t('gn_ok')}</button>`;
  box.innerHTML = `<div class="gnomeRow"><div class="gwrap">${gnomeSvg(it.type)}</div><div class="bubble" role="status"><p>${esc(it.text)}</p><div class="gbtns">${btns}</div></div></div>`;
  if (it.ms) gnomeNext.timer = setTimeout(gnomeNext, it.ms);
}
function gnomeSay(items) { gq.push(...items); if (!gcur) gnomeNext(); }
function grumpyAllowed() {
  if (S().profile.grumpy === false) return false;
  const today = C.ymd(); const days = S().gnome.grumpyDays;
  return !days.includes(today) && days.filter((d) => d >= C.addDays(today, -6)).length < 3;
}
function isWaste(category, note) {
  const words = String(S().profile.wasteText || '').toLowerCase().split(/[,;\n]/).map((w) => w.trim()).filter((w) => w.length > 2);
  const hay = `${String(note || '').toLowerCase()} ${t('cat_' + category).toLowerCase()}`;
  return words.some((w) => hay.includes(w));
}
// Если дерево перешло на новую стадию: салют и гном-садовник
function notifyGrowth() {
  if (!S().profile.onboarded) return;
  const ts = C.treeState(S(), C.ymd());
  if (ts.stage <= (S().progress.stage || 0)) return;
  store.update((s) => { s.progress.stage = ts.stage; });
  ui.anim = { type: 'salute', at: Date.now() };
  snd.play('levelup');
  if (!ui.modal && ui.screen === 'today') render();
  gnomeSay([{ type: 'gardener', text: t('gn_stage_up', { name: t('st_' + ts.stage) }), ms: 7000 }]);
}

// ---------- онбординг ----------
function debtFields(p) {
  return `${field(t('d_name'), `<input id="${p}name" maxlength="60" autocomplete="off">`)}
<div class="grid2">${field(t('d_balance'), `<input id="${p}balance" inputmode="decimal">`)}${field(t('d_rate'), `<input id="${p}rate" inputmode="decimal">`)}</div>
<div class="grid2">${field(t('d_min'), `<input id="${p}min" inputmode="decimal">`)}${field(t('d_day'), `<input id="${p}day" inputmode="numeric">`)}</div>`;
}
function vOnboarding() {
  const step = STEPS[ui.step];
  const d = ui.draft.profile;
  let body = '';
  if (step === 'lang') {
    const picked = ui.draft.langPicked;
    const head = picked ? `<h2>${t('ob_lang')}</h2>` : '<h2>Выберите язык</h2><p class="muted">Choose your language · Wybierz język · Elige tu idioma</p>';
    body = `${head}<div class="opts">${LANGS.map((l) => `<button class="opt ${picked && d.lang === l ? 'sel' : ''}" data-act="pickLang" data-v="${l}">${LANG_NAMES[l]}</button>`).join('')}</div>`;
  } else if (step === 'cur') {
    body = `<h2>${t('ob_cur')}</h2><div class="opts">${CURRENCIES.map((c) => `<button class="opt ${d.currency === c ? 'sel' : ''}" data-act="pickCur" data-v="${c}">${c}</button>`).join('')}</div>`;
  } else if (step === 'auth') {
    const c = store.cloud;
    let inner = `<p class="muted">${t('ob_cloud_off')}</p>`;
    if (c.enabled && c.user) inner = `<p>${t('ob_signed', { email: esc(A.displayId(c.user, AUTH_DOMAIN)) })}</p>`;
    else if (c.enabled) inner = `<p class="muted">${t('ob_have_acc')}</p>${accCard(false)}<p class="muted small">${REQUIRE_ACCOUNT ? t('ob_new_hint') : t('ob_local_hint')}</p>`;
    body = `<h2>${t('ob_auth')}</h2>${inner}`;
  } else if (step === 'income') {
    const hour = d.incomeType === 'hour';
    body = `<h2>${t('q_income')}</h2><p class="muted">${t('q_income_type')}</p>
<div class="opts two"><button class="opt ${!hour ? 'sel' : ''}" data-act="incType" data-v="month">${t('inc_month')}</button><button class="opt ${hour ? 'sel' : ''}" data-act="incType" data-v="hour">${t('inc_hour')}</button></div>
${hour ? field(t('q_rate'), bindInput('hourlyRate', d, true)) + field(t('q_estimate'), bindInput('incomeEstimate', d)) : field(t('q_amount'), bindInput('incomeAmount', d, true))}`;
  } else if (step === 'debts') {
    const list = ui.draft.debts.length
      ? ui.draft.debts.map((x) => `<div class="row"><div><b>${esc(x.name)}</b><div class="muted small">${money(x.balance)} · ${x.rate}%</div></div><button class="x" data-act="rmDebtDraft" data-id="${esc(x.id)}" aria-label="${t('remove')}">✕</button></div>`).join('')
      : `<p class="muted">${t('d_none')}</p>`;
    body = `<h2>${t('q_debts')}</h2><p class="muted">${t('q_debts_text')}</p>${list}<form class="mini" data-submit="addDebtDraft">${debtFields('dd_')}<button class="btn" type="submit">${t('d_add')}</button></form>`;
  } else if (step === 'cushion') {
    body = `<h2>${t('q_cushion')}</h2><p class="muted">${t('q_cushion_text')}</p>${field(t('amount'), bindInput('cushion', d, true))}`;
  } else if (step === 'needs') {
    body = `<h2>${t('q_needs')}</h2><p class="muted">${t('q_needs_text2')}</p>${C.NEED_KEYS.map((k, i) => field(t('n_' + k), bindInput('needs.' + k, d, i === 0))).join('')}`;
  } else if (step === 'food') {
    body = `<h2>${t('q_food')}</h2><p class="muted">${t('q_food_text')}</p>${field(t('food_week'), bindInput('needs.foodWeek', d, true))}`;
  } else if (step === 'fun') {
    body = `<h2>${t('q_fun')}</h2><p class="muted">${t('q_fun_text')}</p>${field(t('amount'), bindInput('monthlyFun', d, true))}`;
  } else if (step === 'waste') {
    body = `<h2>${t('q_waste')}</h2><p class="muted">${t('q_waste_text')}</p>${field(t('note'), `<input data-bind="wasteText" data-af maxlength="200" placeholder="${esc(t('waste_ph'))}" value="${esc(d.wasteText || '')}">`)}`;
  } else if (step === 'mode') {
    body = `<h2>${t('mode_title')}</h2>${C.MODES.map((m) => `<button class="opt card-opt ${d.mode === m ? 'sel' : ''}" data-act="pickMode" data-v="${m}"><b>${t('mode_' + m)}</b><span>${t('mode_' + m + '_d')}</span></button>`).join('')}<p class="muted small">${t('mode_note')}</p>`;
  } else if (step === 'plan') {
    const pc = draftPlan();
    const rp = C.roundedPercents(pc);
    body = `<h2>${t('plan_title')}</h2><p class="muted">${t('plan_text')}</p>${C.BASKETS.map((k) => `<div class="prow"><span>${BNAME(k)} ${helpBtn(k)}</span><b>${rp[k]}%</b>${bar(pc[k], 'b-' + k)}</div>`).join('')}${pc.noSurplus ? `<p class="warnbox">${t('plan_none')}</p>` : ''}<p class="muted small">${t('pilot_note')}</p>`;
  }
  const last = ui.step === STEPS.length - 1;
  return `<main class="ob"><div class="dots">${STEPS.map((_, i) => `<i class="${i <= ui.step ? 'on' : ''}"></i>`).join('')}</div><section class="card">${body}</section>
${step === 'lang' && !ui.draft.langPicked ? '' : `<div class="foot">${ui.step > 0 ? `<button class="btn ghost" data-act="back">${t('back')}</button>` : ''}<button class="btn primary" data-act="next">${last ? t('start') : t('next')}</button></div>`}<p class="muted small center">TGM v${APP_VERSION.split(' ')[0]}</p></main>`;
}
function readDebt(p) {
  const name = val(p + 'name').trim().slice(0, 60);
  if (!name) return { err: t('err_name') };
  const balance = C.parseMoney(val(p + 'balance'));
  if (!balance) return { err: t('err_amount') };
  const rate = C.parseNonNeg(val(p + 'rate'));
  const minPay = C.parseNonNeg(val(p + 'min'));
  if (rate === null || minPay === null) return { err: t('err_number') };
  const dayRaw = val(p + 'day').trim();
  const day = dayRaw === '' ? 0 : parseInt(dayRaw, 10);
  if (!(day >= 0 && day <= 31)) return { err: t('err_debt_day') };
  return { debt: { id: uid(), name, balance, rate, minPay, day, since: C.ymd() } };
}
function validateStep(step) {
  const d = ui.draft.profile;
  const bad = (v) => C.parseNonNeg(v) === null;
  if (step === 'income') {
    if (d.incomeType === 'hour') {
      if (!C.parseMoney(d.hourlyRate)) return t('err_rate');
      if (bad(d.incomeEstimate)) return t('err_number');
    } else if (!C.parseMoney(d.incomeAmount)) return t('err_amount');
  }
  if (step === 'cushion' && bad(d.cushion)) return t('err_number');
  if (step === 'needs' && C.NEED_KEYS.some((k) => bad(d.needs && d.needs[k]))) return t('err_number');
  if (step === 'food' && bad(d.needs && d.needs.foodWeek)) return t('err_number');
  if (step === 'fun' && bad(d.monthlyFun)) return t('err_number');
  if (step === 'mode' && !d.mode) return t('err_mode');
  return '';
}

// ---------- записи ----------
function allEntries() {
  const s = S();
  const list = [];
  s.incomes.forEach((i) => list.push({ k: 'income', id: i.id, ts: i.ts || 0, date: i.date, amount: i.amount, title: i.source, sub: t('cat_income') }));
  s.expenses.forEach((e) => list.push({ k: 'expense', id: e.id, ts: e.ts || 0, date: e.date, amount: -e.amount, title: t('cat_' + e.category), sub: (e.kind === 'need' ? t('kind_need') : t('kind_want')) + (e.note ? ' · ' + e.note : '') }));
  s.payments.forEach((p) => { const dd = s.debts.find((x) => x.id === p.debtId); list.push({ k: 'payment', id: p.id, ts: p.ts || 0, date: p.date, amount: -p.amount, title: dd ? dd.name : t('entry_payment'), sub: t('entry_payment') }); });
  s.noSpendDays.forEach((d) => list.push({ k: 'nospend', id: d, ts: 0, date: d, amount: null, title: t('entry_nospend'), sub: '' }));
  s.shifts.filter((x) => x.end).forEach((x) => list.push({ k: 'shift', id: x.id, ts: x.end, date: x.date, amount: x.amount, pending: !x.paidBy, title: `${t('shift')} · ${fmtHours(x.hours)}`, sub: x.paidBy ? t('shift_paid_tag') : t('earned_wait') }));
  return list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.ts - a.ts));
}
function rowHtml(e) {
  const a = e.amount === null ? '✓' : (e.amount > 0 ? '+' : '−') + money(Math.abs(e.amount));
  const canEdit = e.k === 'expense' || e.k === 'income' || e.k === 'shift';
  return `<div class="row"><div${canEdit ? ` class="editable" role="button" tabindex="0" data-act="editEntry" data-k="${e.k}" data-id="${esc(e.id)}"` : ''}><b>${esc(e.title)}${canEdit ? ' <span class="muted">✎</span>' : ''}</b><div class="muted small">${shortDate(e.date)}${e.sub ? ' · ' + esc(e.sub) : ''}</div></div><div class="amt ${e.amount > 0 ? (e.pending ? 'pend' : 'good') : ''}">${a}</div><button class="x" data-act="delEntry" data-k="${e.k}" data-id="${esc(e.id)}" aria-label="${t('remove')}">✕</button></div>`;
}

// ---------- аккаунт: вход, регистрация, восстановление ----------
// Экран входа нужен, когда облако подключено, аккаунт обязателен (REQUIRE_ACCOUNT), анкета пройдена, а человек не вошёл
const gateOn = () => { const c = store.cloud; return c.enabled && REQUIRE_ACCOUNT && !c.user && S().profile.onboarded && ui.screen !== 'onboarding'; };
// Код восстановления нужен всем, кто входит паролем и ещё не сохранил код
const needRecovery = () => { const c = store.cloud; return Boolean(c.user && c.recovery && !c.recovery.code && A.hasPassword(c.user)); };
const privacyUrl = () => `${SITE_URL || ''}privacy.html?lang=${getLang()}`;
const pwField = (id, label, auto = 'new-password') => field(label, `<input id="${id}" type="password" autocomplete="${auto}" maxlength="72">`);

// Форма входа и регистрации. canSignup=false: только вход (на втором шаге анкеты)
function accCard(canSignup) {
  const tab = canSignup ? ui.acc.tab : 'signin';
  if (ui.acc.sent) return `<p class="warnbox">${t('acc_check_mail', { email: esc(ui.acc.sent) })}</p><button class="btn" data-act="accTab" data-v="signin">${t('acc_signin')}</button>`;
  const last = A.getLastIdent();
  const hint = tab === 'signin' && last ? A.getHint(last) : '';
  const tabs = canSignup ? `<div class="seg"><button type="button" class="btn ${tab === 'signup' ? 'primary' : 'ghost'}" data-act="accTab" data-v="signup">${t('acc_signup')}</button><button type="button" class="btn ${tab === 'signin' ? 'primary' : 'ghost'}" data-act="accTab" data-v="signin">${t('acc_signin')}</button></div>` : '';
  const idF = field(t('acc_login'), `<input id="acc_id" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="254" value="${esc(tab === 'signin' ? last : '')}">`);
  const extra = tab === 'signup'
    ? `${pwField('acc_pw2', t('acc_password2'))}${field(t('acc_hint_label'), '<input id="acc_hint" maxlength="80" autocomplete="off">')}<p class="muted small">${t('acc_hint_note')}</p><p class="muted small">${t('acc_rules')}</p><p class="warnbox">${t('acc_nomail_warn')}</p><label class="check2"><input type="checkbox" id="acc_agree"><span>${t('acc_agree', { link: `<a href="${esc(privacyUrl())}" target="_blank" rel="noopener">${t('legal_link')}</a>` })}</span></label>`
    : (hint ? `<p class="muted small">${t('acc_hint_show')} <b>${esc(hint)}</b></p>` : '');
  return `${tabs}<form data-submit="accSubmit"><input type="hidden" id="acc_mode" value="${tab}">${idF}${pwField('acc_pw', t('acc_password'), tab === 'signup' ? 'new-password' : 'current-password')}${extra}<button class="btn primary" type="submit">${t(tab === 'signup' ? 'acc_create' : 'acc_enter')}</button></form>
<p class="muted small center">${t('acc_or')}</p><button class="btn" data-act="accGoogle">${t('acc_google')}</button>${tab === 'signin' ? `<button class="btn ghost" data-act="openForgot">${t('acc_forgot')}</button>` : ''}`;
}
function vGate() {
  if (!store.cloud.ready) return `<main class="ob"><section class="card"><p class="muted center">${t('gate_wait')}</p></section></main>`;
  return `<main class="ob"><section class="card"><h2>${t('gate_title')}</h2><p class="muted">${t('gate_text')}</p>${accCard(true)}</section><p class="warnbox">${t('risk')}</p></main>`;
}
// Окна: восстановление пароля, код восстановления, безопасность, новый пароль
function mForgot() {
  const f = ui.fg; const m = f.method === 'answer' ? 'answer' : 'code';
  const foot = `<div class="foot"><span></span><button type="button" class="btn ${f.done ? 'primary' : 'ghost'}" data-act="closeModal">${t(f.done ? 'close' : 'cancel')}</button></div>`;
  if (f.done) return `<h3>${t('fg_title')}</h3><p>${t('fg_done')}</p>${f.codeUsed ? `<p class="muted small">${t('fg_code_used')}</p>` : ''}${foot}`;
  const seg = `<div class="seg"><button type="button" class="btn ${m === 'code' ? 'primary' : 'ghost'}" data-act="fgMethod" data-v="code">${t('fg_code_m')}</button><button type="button" class="btn ${m === 'answer' ? 'primary' : 'ghost'}" data-act="fgMethod" data-v="answer">${t('fg_q_m')}</button></div>`;
  let body = field(t('fg_ident'), `<input id="fm_id" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="254" value="${esc(f.ident || '')}">`);
  let canSend = true;
  if (m === 'code') body += field(t('fg_code'), '<input id="fm_secret" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX">');
  else if (!f.asked) { canSend = false; body += `<button type="button" class="btn" data-act="fgQuestion">${t('fg_get_q')}</button>`; }
  else if (!f.question) { canSend = false; body += `<p class="warnbox">${t('fg_q_none')}</p><button type="button" class="btn ghost" data-act="fgQuestion">${t('fg_get_q')}</button>`; }
  else body += `<p><b>${esc(f.question)}</b></p>${field(t('fg_answer'), '<input id="fm_secret" autocomplete="off" spellcheck="false">')}`;
  if (canSend) body += pwField('fm_pw', t('fg_newpw'));
  return `<h3>${t('fg_title')}</h3>${seg}<form data-submit="fgSubmit">${body}${canSend ? `<button class="btn primary" type="submit">${t('fg_send')}</button>` : ''}</form><p class="muted small">${t('fg_mail_note')}</p><button type="button" class="btn ghost" data-act="fgMail">${t('fg_mail_btn')}</button>${foot}`;
}
function mRecovery() {
  if (!ui.rc.code) ui.rc = { code: A.makeRecoveryCode() };
  const cancel = ui.modal.manual ? `<button type="button" class="btn ghost" data-act="closeModal">${t('cancel')}</button>` : '<span></span>';
  return `<h3>${t('rc_title')}</h3><p class="muted small">${t('rc_text')}</p><div class="rcCode" id="rc_code">${esc(A.formatCode(ui.rc.code))}</div><button type="button" class="btn" data-act="rcCopy">${t('rc_copy')}</button>
<label class="check2"><input type="checkbox" id="rc_ack"><span>${t('rc_ack')}</span></label>
<details class="learnItem"><summary>${t('rc_add_q')}</summary><div class="lbody">${field(t('rc_q'), '<input id="rc_q" maxlength="80" autocomplete="off">')}${field(t('rc_a'), '<input id="rc_a" autocomplete="off" spellcheck="false">')}<p class="muted small">${t('rc_q_warn')}</p></div></details>
<div class="foot">${cancel}<button type="button" class="btn primary" data-act="rcDone">${t('rc_done')}</button></div>`;
}
function mSecurity() {
  const c = store.cloud; const u = c.user;
  if (!u) { ui.modal = null; return ''; }
  const id = A.displayId(u, AUTH_DOMAIN); const rec = c.recovery || {}; const pw = A.hasPassword(u);
  const email = A.hasRealEmail(u, AUTH_DOMAIN)
    ? `<p class="small">${t('sec_email_on', { email: esc(u.email) })}</p>`
    : `<p class="warnbox">${t('sec_nudge')}</p><form data-submit="secEmail">${field(t('sec_email'), '<input id="sec_email" type="email" inputmode="email" autocomplete="email" autocapitalize="none">')}<button class="btn" type="submit">${t('sec_email_btn')}</button></form>`;
  const google = A.hasGoogle(u) ? `<p class="small">${t('sec_google_on')}</p>` : `<button class="btn" data-act="secGoogle">${t('sec_google_btn')}</button>`;
  const pass = pw ? `<h4>${t('sec_pw_title')}</h4><form data-submit="pwSubmit">${pwField('np_pw', t('fg_newpw'))}${pwField('np_pw2', t('acc_password2'))}<button class="btn" type="submit">${t('sec_pw_btn')}</button></form><button class="btn" data-act="secNewCode">${t('sec_code_btn')}</button>` : '';
  const q = pw ? `<h4>${t('sec_q_title')}</h4><p class="small muted">${rec.question ? t('sec_q_on', { q: esc(rec.question) }) : t('sec_q_off')}</p><form data-submit="secQ">${field(t('rc_q'), '<input id="sq_q" maxlength="80" autocomplete="off">')}${field(t('rc_a'), '<input id="sq_a" autocomplete="off" spellcheck="false">')}<p class="muted small">${t('rc_q_warn')}</p><button class="btn" type="submit">${t('sec_q_btn')}</button>${rec.question ? `<button type="button" class="btn ghost" data-act="secClearQ">${t('sec_q_clear')}</button>` : ''}</form>` : '';
  const hint = pw ? `<form data-submit="secHint">${field(t('sec_hint'), `<input id="sec_hint" maxlength="80" autocomplete="off" value="${esc(A.getHint(id))}">`)}<button class="btn" type="submit">${t('save')}</button></form>` : '';
  return `<h3>${t('sec_title')}</h3><p class="small">${t('sec_as', { id: esc(id) })}</p>${email}${google}${pass}${q}${hint}<div class="foot"><span></span><button class="btn primary" data-act="closeModal">${t('close')}</button></div>`;
}
const mNewPw = () => `<h3>${t('sec_pw_title')}</h3><form data-submit="pwSubmit">${pwField('np_pw', t('fg_newpw'))}${pwField('np_pw2', t('acc_password2'))}<button class="btn primary" type="submit">${t('sec_pw_btn')}</button></form>`;
// После входа: идём дальше (обучение или приветствие), когда сервер ответил про код и код сохранён
function proceedAfterAuth() {
  if (!ui.afterAuth) return;
  const c = store.cloud;
  if (!c.ready) return;
  if (c.enabled && REQUIRE_ACCOUNT) { if (!c.user || c.recovery === null || needRecovery()) return; }
  ui.afterAuth = false;
  render();
  if (S().profile.onboarded) { if (S().profile.tourDone === false) startTour(); else greetToday(); }
}

// ---------- экраны ----------
function syncText() {
  const c = store.cloud;
  if (!c.enabled) return t('sync_local');
  if (!c.user) return t('sync_off');
  return c.status === 'synced' ? t('sync_ok') : t('sync_pending');
}

function pilotCard(today) {
  const st = C.pilotStatus(S(), today);
  if (st === 'done') return '';
  const day = Math.min(C.PILOT_DAYS, C.pilotDay(S(), today));
  if (st === 'review') return `<section class="card pilot"><h3>${t('pilot_title')}</h3><p>${t('pilot_review')}</p><button class="btn primary" data-act="openPilot">${t('pilot_btn')}</button></section>`;
  return `<section class="card pilot"><div class="between"><h3>${t('pilot_title')}</h3><b>${t('pilot_day', { n: day })}</b></div>${bar(day / C.PILOT_DAYS, 'b-invest')}<p class="muted small">${t('pilot_text')}</p><button class="btn ghost" data-act="openPilot">${t('pilot_btn')}</button></section>`;
}
function workCard() {
  const p = S().profile;
  if (p.incomeType !== 'hour') return '';
  const active = S().shifts.find((x) => !x.end);
  const sp = C.earnedSplit(S(), C.ymd());
  const prevTag = sp.prevWaiting > 0 ? t('earned_prev_wait') : (sp.prevMonth > 0 ? t('earned_prev_paid') : '');
  return `<section class="card work"><div class="between"><span>${t('earned_prev')}</span><b>${money(sp.prevMonth)}</b></div>${prevTag ? `<div class="muted small">${prevTag}</div>` : ''}<div class="between"><span>${t('earned_this')}</span><b>${money(sp.thisMonth)}</b></div>${sp.olderWaiting > 0 ? `<div class="between"><span>${t('earned_older')}</span><b>${money(sp.olderWaiting)}</b></div>` : ''}<div class="muted small">${t('rate_h', { r: money(p.hourlyRate) })}</div>
${active ? `<div class="timer" id="shiftTimer" data-start="${active.start}">00:00:00</div><button class="btn primary" data-act="endWork">${t('work_end')}</button>` : `<button class="btn primary" data-act="startWork">${t('work_start')}</button>`}
<button class="btn ghost" data-act="openWork">${t('work_add')}</button></section>`;
}

// Итог недели появляется после воскресенья, пока человек его не посмотрит
function weekCard(today) {
  if (!C.weekPending(S(), today)) return '';
  return `<section class="card"><h3>${t('wk_title')}</h3><p class="muted small">${t('wk_card_text')}</p><button class="btn primary" data-act="openWeek">${t('wk_open')}</button></section>`;
}

// Подсказка про зарплату: когда ждать, сегодня ли она, не задерживается ли
function payNote() {
  const ps = C.payStatus(S(), C.ymd());
  if (!ps) return '';
  const date = longDate(ps.date);
  if (ps.state === 'today') return `<div class="paynote hot"><p>${t('pay_today')}</p><button class="btn primary" data-act="openIncome">${t('pay_add')}</button></div>`;
  if (ps.state === 'late') return `<div class="paynote hot"><p>${t('pay_late', { n: ps.days, date })}</p><button class="btn primary" data-act="openIncome">${t('pay_add')}</button></div>`;
  return `<p class="muted small paynote">${t(ps.state === 'soon' ? 'pay_soon' : 'pay_done', { n: ps.days, date })}</p>`;
}
// Цель «закрыть долги»: сколько погашено, когда закроются, и совет про подушку
function debtGoalBlock() {
  const today = C.ymd();
  const g = C.debtGoal(S(), today);
  if (!g) return '';
  if (g.done) return `<div class="dgoal"><h4>${t('dg_title')}</h4>${bar(1, 'b-invest')}<p class="small">${t('dg_done')}</p></div>`;
  const cm = C.cushionMonths(S(), today);
  const eta = g.eta ? dfmt(g.eta + '-01', { month: 'long', year: 'numeric' }) : '';
  return `<div class="dgoal"><h4>${t('dg_title')}</h4>${bar(g.progress, 'b-invest')}<p class="small">${t('dg_line', { p: money(g.paid), i: money(g.initial) })}</p><p class="muted small">${eta ? t('dg_eta', { n: g.monthsLeft, m: eta }) : t('dg_nopace')}</p>${cm != null && cm >= 1 ? `<p class="muted small">${t('dg_tip', { n: Math.floor(cm) })}</p>` : ''}</div>`;
}

// Деньги, которые пришли, но ещё не разложены по горшкам. Видны всегда, пока там что-то есть (или выбран ручной режим).
function unallocCard() {
  const pool = C.unallocTotal(S());
  if (Math.abs(pool) < 0.005 && incomeAuto()) return '';
  return `<section class="card unalloc ${pool > 0.004 ? 'hot' : ''}"><div class="between"><h3>${t('unalloc')}</h3><b class="${pool < -0.004 ? 'amber' : ''}">${money(pool)}</b></div><p class="muted small">${t(pool > 0.004 ? 'unalloc_hint' : 'unalloc_empty')}</p>${pool > 0.004 ? `<button class="btn primary" data-act="openAllocate">${t('unalloc_btn')}</button>` : ''}</section>`;
}

// Общий капитал: все горшки, плюс «мне должны», минус долги. Подробности по горшкам раскрываются по нажатию
function capitalCard() {
  const cp = C.capital(S(), C.ymd());
  const pn = payNote();
  const rows = C.BASKETS.map((k) => kv(BNAME(k), money(cp.jars[k]), cp.jars[k] < 0 ? 'amber' : '')).join('') + (Math.abs(cp.jars.unalloc) >= 0.005 ? kv(t('unalloc'), money(cp.jars.unalloc), cp.jars.unalloc < 0 ? 'amber' : 'gold') : '');
  const extra = (cp.owedToMe > 0 ? kv(t('cap_owed'), '+' + money(cp.owedToMe), 'good') : '') + kv(t('cap_debts'), cp.debt > 0 ? '−' + money(cp.debt) : money(0), cp.debt > 0 ? 'amber' : '');
  return `<section class="card capital"><div class="label">${t('cap_title')}</div><div class="big ${cp.net < 0 ? 'amber' : ''}">${money(cp.net)}</div><div class="muted small">${t('cap_hint')}</div>${cp.waitIncome > 0 && !/paynote hot/.test(pn) ? `<p class="small amber">${t('cap_wait', { a: money(cp.waitIncome) })}</p>` : ''}${pn}
<details><summary>${t('cap_jars')}</summary>${rows}${kv(t('cap_total'), money(cp.total), 'gold')}${extra}<p class="muted small">${t('cap_note')}</p></details>${debtGoalBlock()}</section>`;
}
function vToday() {
  const today = C.ymd();
  const recent = allEntries().slice(0, 8).map(rowHtml).join('');
  return `${treeCard()}
<div class="actions"><button class="btn primary" data-act="openExpense">− ${t('btn_expense')}</button><button class="btn" data-act="openIncome">+ ${t('btn_income')}</button><button class="btn ghost" data-act="noSpend">${t('btn_nospend')}</button></div>
${unallocCard()}${capitalCard()}${weekCard(today)}${payCard(today)}${workCard()}${pilotCard(today)}${marketCard()}
<section class="card"><h3>${t('recent')}</h3>${recent || `<p class="muted">${t('recent_empty')}</p>`}</section>`;
}



function vCalendar() {
  const today = C.ymd();
  if (!ui.cal.month) ui.cal.month = C.monthOf(today);
  if (!ui.cal.sel) ui.cal.sel = today;
  const [y, m] = ui.cal.month.split('-').map(Number);
  const first = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const info = {};
  const get = (d) => info[d] || (info[d] = {});
  S().incomes.forEach((i) => { get(i.date).inc = true; });
  S().expenses.forEach((e) => { get(e.date).exp = true; });
  S().payments.forEach((e) => { get(e.date).exp = true; });
  S().noSpendDays.forEach((d) => { get(d).none = true; });
  S().shifts.filter((x) => x.end).forEach((x) => { get(x.date).work = true; });
  const start = S().profile.startDate;
  const pend = start ? C.addDays(start, C.PILOT_DAYS - 1) : null;
  const heads = [0, 1, 2, 3, 4, 5, 6].map((i) => `<span class="wd">${esc(dfmt(`2024-01-0${1 + i}`, { weekday: 'short' }))}</span>`).join('');
  let cells = '<span></span>'.repeat(first);
  for (let d = 1; d <= dim; d++) {
    const date = `${ui.cal.month}-${C.pad(d)}`;
    const x = info[date] || {};
    const cls = ['day', date === ui.cal.sel ? 'sel' : '', date === today ? 'today' : '', date > today ? 'dim' : '', start && date >= start && date <= pend ? 'pilot' : ''].join(' ');
    const dots = `${x.inc || x.work ? '<u class="g"></u>' : ''}${x.exp ? '<u class="o"></u>' : ''}${x.none ? '<u class="n"></u>' : ''}`;
    cells += `<button class="${cls}" data-act="calSel" data-v="${date}"><b>${d}${date === start ? '⚑' : ''}</b><i>${dots}</i></button>`;
  }
  const sel = ui.cal.sel;
  const dayList = allEntries().filter((e) => e.date === sel);
  const inc = C.round2(dayList.filter((e) => e.k === 'income').reduce((a, e) => a + e.amount, 0));
  const out = C.round2(dayList.filter((e) => e.k === 'expense' || e.k === 'payment').reduce((a, e) => a - e.amount, 0));
  const title = dfmt(`${ui.cal.month}-01`, { month: 'long', year: 'numeric' });
  return `<h2 class="h">${t('cal_title')}</h2>
<section class="card"><div class="between calnav"><button class="x" data-act="calPrev" aria-label="‹">‹</button><h3 class="calt">${esc(title)}</h3><button class="x" data-act="calNext" aria-label="›">›</button></div>
<div class="cal">${heads}${cells}</div><div class="muted small legend"><u class="g"></u> ${t('d_in')} <u class="o"></u> ${t('d_out')} <u class="n"></u> ${t('entry_nospend')} ⚑ ${t('started')}</div></section>
<section class="card"><h3>${esc(dayTitle(sel))}</h3>${dayList.length ? `<div class="between small"><span>${t('d_in')}: <b class="good">${money(inc)}</b></span><span>${t('d_out')}: <b>${money(out)}</b></span></div>${dayList.map(rowHtml).join('')}` : `<p class="muted">${t('day_empty')}</p>`}
${sel <= today ? `<div class="actions"><button class="btn" data-act="calAddExp">− ${t('btn_expense')}</button><button class="btn" data-act="calAddInc">+ ${t('btn_income')}</button></div>` : ''}</section>`;
}

function vBaskets() {
  const today = C.ymd();
  const st = C.basketStats(S(), today);
  const lab = { needs: t('lab_spent'), joy: t('lab_spent'), debts: t('lab_paid') };
  const rp = C.roundedPercents(Object.fromEntries(C.BASKETS.map((q) => [q, st[q].pct])));
  const cards = C.BASKETS.map((k) => {
    const x = st[k];
    let lines = kv(t('lab_plan'), money(x.planned)) + kv(x.spendable ? t('lab_in') : t('lab_month_saved'), money(x.allocated), x.allocated > 0 ? 'good' : '');
    if (x.spendable) lines += kv(lab[k], money(x.spent)) + kv(t('lab_left'), money(x.left), x.left < 0 ? 'amber' : '');
    if (k === 'cushion') lines += kv(t('lab_total'), money(C.cushionTotal(S())));
    if (k === 'invest') lines += kv(t('lab_total'), money(C.investTotal(S()))) + kv(t('inv_available'), money(C.investAvailable(S())), C.investAvailable(S()) < 0 ? 'amber' : '') + `<button class="btn ghost" data-act="goInvest">${t('invest_title')} →</button>`;
    return `<section class="card basket"><div class="between"><h3>${BNAME(k)} ${helpBtn(k)}</h3><b>${rp[k]}%</b></div>${bar(x.progress, 'b-' + k)}${lines}</section>`;
  }).join('');
  const closed = S().closings.filter((c) => !c.skipped).slice(-6).reverse();
  const hist = closed.length
    ? `<section class="card"><h3>${t('hist_title')}</h3>${closed.map((c) => `<div class="cl"><b>${esc(dfmt(c.month + '-01', { month: 'long', year: 'numeric' }))}</b>${kv(t('close_kept'), money(c.keep))}${kv(t('close_moved', { b: BNAME(c.basket) }), money(c.moved), 'good')}</div>`).join('')}</section>`
    : '';
  return `<h2 class="h">${t('baskets_title')}</h2>${unallocCard()}${cards}<section class="card">${kv(t('total_cushion'), money(C.cushionTotal(S())))}${kv(t('total_invest'), money(C.portfolioStats(S(), today).value))}${kv(t('total_debts'), money(C.debtTotal(S())))}${kv(t('inv_networth'), money(C.netWorth(S(), today)), 'gold')}</section>${purchasesCard()}${hist}`;
}

const monthsFmt = (n) => { try { return (Math.round(n * 10) / 10).toLocaleString(loc()); } catch { return String(Math.round(n * 10) / 10); } };
// Крупные покупки: машина, ремонт, техника. Платятся из подушки или из корзины инвестиций, нужды и месячный план не трогают
function purchasesCard() {
  const list = [...S().purchases].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  const rows = list.map((p) => `<div class="pr"><span>${esc(dfmt(p.date, { day: 'numeric', month: 'short' }))} · ${esc(p.name)}</span><b>${money(p.amount)}</b><button class="x" data-act="delPurchase" data-id="${esc(p.id)}" aria-label="${esc(t('remove'))}">×</button></div>`).join('');
  return `<section class="card"><h3>${t('pur_title')}</h3><p class="muted small">${t('pur_hint')}</p>${rows}<button class="btn" data-act="openPurchase">${t('pur_add')}</button></section>`;
}

// ---------- вкладка «Долги»: «Мои долги» и «Мне должны» (займы, которые человек выдал другим) ----------
function debtSeg() {
  const tab = ui.debtTab === 'owed' ? 'owed' : 'mine';
  return `<div class="seg"><button class="btn ${tab === 'mine' ? 'primary' : 'ghost'}" data-act="setDebtTab" data-v="mine">${t('debtors_mine')}</button><button class="btn ${tab === 'owed' ? 'primary' : 'ghost'}" data-act="setDebtTab" data-v="owed">${t('debtors_owed')}</button></div>`;
}
function vDebts() { return debtSeg() + (ui.debtTab === 'owed' ? vLoans() : vDebtsMine()); }
function vLoans() {
  const today = C.ymd();
  const list = [...S().loans].sort((a, b) => (C.loanStats(a, today).paid - C.loanStats(b, today).paid) || ((a.due || '9999') < (b.due || '9999') ? -1 : 1));
  const cards = list.map((l) => {
    const st = C.loanStats(l, today);
    const dueTxt = l.due ? `${t('loan_due_on')} ${esc(dfmt(l.due, { day: 'numeric', month: 'short', year: 'numeric' }))}` : t('loan_noterm');
    const tag = st.paid ? `<span class="tag">${t('loan_paid_tag')}</span>` : st.overdueDays > 0 ? `<span class="tag amber">${t('loan_overdue', { n: st.overdueDays })}</span>` : '';
    const reps = [...(l.repay || [])].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3)
      .map((r) => `<div class="pr"><span>${esc(dfmt(r.date, { day: 'numeric', month: 'short' }))}</span><b>${money(r.amount)}</b><button class="x" data-act="delRepay" data-id="${esc(l.id)}" data-rep="${esc(r.id)}" aria-label="${esc(t('remove'))}">×</button></div>`).join('');
    return `<section class="card"><div class="between"><h3>${esc(l.person)} ${tag}</h3><b>${st.paid ? '✓' : money(st.owed)}</b></div>
<div class="muted small">${t('loan_lent')} ${money(st.principal)} · ${esc(dfmt(l.date, { day: 'numeric', month: 'short', year: 'numeric' }))} · ${dueTxt}${l.rate ? ' · ' + esc(String(l.rate).replace('.', ',')) + '%' : ''}</div>
${bar(st.pct, 'b-debts')}${kv(t('loan_interest'), money(st.interest))}${kv(t('loan_repaid'), money(st.repaid), st.repaid > 0 ? 'good' : '')}${l.note ? `<p class="muted small">${esc(l.note)}</p>` : ''}${reps}
<div class="mini3">${st.paid ? '' : `<button class="btn primary" data-act="openRepay" data-id="${esc(l.id)}">${t('loan_repay')}</button>`}<button class="btn ghost" data-act="openLoan" data-id="${esc(l.id)}">${t('goal_edit')}</button><button class="btn ghost danger" data-act="delLoan" data-id="${esc(l.id)}">✕</button></div></section>`;
  }).join('');
  return `<h2 class="h">${t('loans_title')}</h2><section class="card center"><div class="label">${t('loans_total')}</div><div class="big">${money(C.loansOwedTotal(S(), today))}</div></section><p class="muted small">${t('loans_hint')}</p>${cards || `<p class="muted center">${t('loans_empty')}</p>`}<button class="btn primary" data-act="openLoan">+ ${t('loan_add')}</button>`;
}

function vDebtsMine() {
  const list = [...S().debts].sort((a, b) => (b.balance > 0) - (a.balance > 0) || b.rate - a.rate);
  const first = list.find((d) => d.balance > 0);
  const rows = list.map((d) => `<section class="card"><div class="between"><h3>${esc(d.name)}${first && first.id === d.id ? ` <span class="tag">${t('debts_first')}</span>` : ''}</h3><b>${d.balance > 0 ? money(d.balance) : '✓'}</b></div><div class="muted small">${d.rate}% ${t('rate_pa').replace('%', '').trim()}${d.minPay ? ' · ' + money(d.minPay) : ''}${d.day ? ' · ' + d.day : ''}</div></section>`).join('');
  return `<h2 class="h">${t('debts_title')}</h2><section class="card center"><div class="label">${t('total_debts')}</div><div class="big">${money(C.debtTotal(S()))}</div></section>
${rows || `<p class="muted center">${t('debts_none')}</p>`}
<div class="actions"><button class="btn" data-act="openDebt">+ ${t('d_add')}</button>${first ? `<button class="btn primary" data-act="openPay">${t('pay')}</button>` : ''}</div>`;
}

// ---------- цели накоплений («роща»): у каждой цели своё дерево, которое растёт вместе с накоплением ----------
function goalTree(pct, done) {
  const k = done ? 't4' : pct >= 0.6 ? 't3' : pct >= 0.25 ? 't2' : 't1';
  return `<img class="goalTree" src="${ASSET_SRC[k]}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'">`;
}
function vGoals() {
  const today = C.ymd();
  const cards = S().goals.map((g) => {
    const st = C.goalStats(g, today);
    const hint = st.done ? t('goal_done') : st.overdue ? t('goal_overdue') : st.perMonth != null ? t('goal_permonth', { a: money(st.perMonth), n: st.monthsLeft }) : st.etaMonths != null ? t('goal_eta', { n: st.etaMonths }) : t('goal_nohint');
    const dl = g.deadline ? ` · ${t('goal_until')} ${esc(dfmt(g.deadline, { day: 'numeric', month: 'short', year: 'numeric' }))}` : '';
    const adds = [...(g.adds || [])].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3)
      .map((a) => `<div class="pr"><span>${esc(dfmt(a.date, { day: 'numeric', month: 'short' }))}${a.source === 'invest' ? ' · ' + esc(BNAME('invest')) : ''}</span><b>${money(a.amount)}</b><button class="x" data-act="delGoalAdd" data-id="${esc(g.id)}" data-add="${esc(a.id)}" aria-label="${esc(t('remove'))}">×</button></div>`).join('');
    return `<section class="card goal"><div class="goalHead">${goalTree(st.pct, st.done)}<div><h3>${esc(g.name)}${st.done ? ` <span class="tag">${t('goal_reached')}</span>` : ''}</h3><div class="muted small">${money(st.saved)} / ${money(st.target)}${dl}</div></div></div>${bar(st.pct, 'b-invest')}<p class="muted small">${esc(hint)}</p>${adds}
<div class="mini3"><button class="btn primary" data-act="openGoalAdd" data-id="${esc(g.id)}">${t('goal_add')}</button><button class="btn ghost" data-act="openGoal" data-id="${esc(g.id)}">${t('goal_edit')}</button><button class="btn ghost danger" data-act="delGoal" data-id="${esc(g.id)}">✕</button></div></section>`;
  }).join('');
  return `<button class="x back" data-act="nav" data-v="more">← ${t('back')}</button><h2 class="h">${t('goals_title')}</h2><p class="muted small">${t('goals_hint')}</p>${cards || `<p class="muted center">${t('goals_empty')}</p>`}<button class="btn primary" data-act="openGoal">+ ${t('goal_new')}</button>`;
}

// ---------- напоминания о платежах: внутри приложения, без push ----------
function payWhen(x) {
  if (x.overdue) return t('rem_overdue', { n: -x.days });
  return x.days === 0 ? t('rem_today') : x.days === 1 ? t('rem_tomorrow') : t('rem_in', { n: x.days });
}
function payRow(x) {
  const btn = x.kind === 'custom' ? `<button class="btn ghost" data-act="remPaid" data-id="${esc(x.id)}">${t('rem_paid')}</button>`
    : x.kind === 'loan' ? `<button class="btn ghost" data-act="openRepay" data-id="${esc(x.id)}">${t('loan_got')}</button>` : `<button class="btn ghost" data-act="openPay">${t('pay')}</button>`;
  return `<div class="pr remrow"><span><b>${esc(x.name)}</b>${x.incoming ? ` <small class="tag">${t('loan_back')}</small>` : ''}<br><small class="${x.overdue ? 'amber' : 'muted'}">${esc(payWhen(x))} · ${esc(dfmt(x.date, { day: 'numeric', month: 'short' }))}</small></span><b>${x.amount > 0 ? money(x.amount) : ''}</b>${btn}</div>`;
}
function payCard(today) {
  const items = C.upcomingPayments(S(), today, 3);
  if (!items.length) return '';
  return `<section class="card"><h3>${t('rem_soon')}</h3>${items.slice(0, 3).map(payRow).join('')}<button class="btn ghost" data-act="nav" data-v="reminders">${t('rem_all')}</button></section>`;
}
function vReminders() {
  const today = C.ymd();
  const rows = C.upcomingPayments(S(), today, 45).map(payRow).join('');
  const mine = S().reminders.map((r) => `<div class="pr"><span>${esc(r.name)} · ${esc(String(r.day))}</span><b>${r.amount > 0 ? money(r.amount) : ''}</b><button class="x" data-act="delReminder" data-id="${esc(r.id)}" aria-label="${esc(t('remove'))}">×</button></div>`).join('');
  return `<button class="x back" data-act="nav" data-v="more">← ${t('back')}</button><h2 class="h">${t('rem_title')}</h2><p class="muted small">${t('rem_hint')}</p>
<section class="card">${rows || `<p class="muted">${t('rem_none')}</p>`}</section>
<section class="card"><h3>${t('rem_mine')}</h3>${mine || `<p class="muted small">${t('rem_mine_empty')}</p>`}<button class="btn" data-act="openReminder">+ ${t('rem_add')}</button></section>`;
}

// ---------- рынок: цены монет, металлов, валют и акций (окно на главном экране и раздел «Рынок») ----------
// Без ключей: крипта (CoinGecko, топ-100), золото, серебро и платина (gold-api.com), курсы валют (ЕЦБ через Frankfurter).
// Акции: Twelve Data по бесплатному ключу самого человека, пачками по 8. Всё кэшируется на устройстве, при ошибке показываем последние сохранённые цены.
const MK_TTL = { crypto: 3 * 60e3, metals: 5 * 60e3, fx: 60 * 60e3, stocks: 15 * 60e3 };
const mk = { crypto: null, metals: null, fx: null, stocks: {}, q: '', busy: {}, failTs: 0, err: '' };
function mkInit() {
  const c = P.cacheRead();
  if (c.crypto && Array.isArray(c.crypto.rows)) mk.crypto = c.crypto;
  if (c.metals && c.metals.items) mk.metals = c.metals;
  if (c.fx && Array.isArray(c.fx.rows)) mk.fx = c.fx;
  if (c.stocks && c.stocks.map) mk.stocks = c.stocks.map;
}
const mkSave = () => P.cacheWrite({ crypto: mk.crypto, metals: mk.metals, fx: mk.fx, stocks: { map: mk.stocks } });
const mkTime = (ts) => { try { return new Intl.DateTimeFormat(loc(), { hour: '2-digit', minute: '2-digit' }).format(new Date(ts)); } catch { return ''; } };
const mkSyms = () => [...P.STOCK_PRESET, ...P.getWatch().filter((x) => !P.STOCK_PRESET.includes(x))];
const mkFresh = (rec, ttl) => Boolean(rec) && Date.now() - rec.ts < ttl;
async function mkLoad(kind, force) { // kind: crypto | metals | fx
  if (mk.busy[kind] || (!force && mkFresh(mk[kind], MK_TTL[kind]))) return;
  mk.busy[kind] = true;
  try {
    const cur = S().profile.currency;
    if (kind === 'crypto') { const r = await P.marketCrypto(cur); mk.crypto = { cur: r.cur, rows: r.rows, ts: Date.now() }; }
    else if (kind === 'metals') { const r = await P.marketMetals(cur); mk.metals = { cur: r.cur, items: r.items, ts: Date.now() }; }
    else { const r = await P.marketFx(cur); mk.fx = { base: r.base, rows: r.rows, ts: Date.now() }; }
    mk.err = ''; mkSave();
  } catch { mk.failTs = Date.now(); mk.err = 'fail'; }
  mk.busy[kind] = false; mkPaint();
}
async function mkLoadStocks(symbols, force) {
  const key = P.getTdKey();
  if (!key || mk.busy.stocks) return;
  const need = symbols.filter((s) => force || !mkFresh(mk.stocks[s], MK_TTL.stocks)).slice(0, P.STOCK_BATCH);
  if (!need.length) return;
  mk.busy.stocks = true;
  try {
    const r = await P.marketStocks(need, key);
    const ts = Date.now();
    need.forEach((s) => { mk.stocks[s] = r[s] ? { ...r[s], ts } : { bad: true, ts }; }); // тикер, которого нет у источника, помечаем, чтобы не спрашивать снова
    mk.err = ''; mkSave();
  } catch (e) { mk.failTs = Date.now(); mk.err = e && e.message === 'rate' ? 'rate' : e && e.message === 'key' ? 'key' : 'fail'; }
  mk.busy.stocks = false; mkPaint();
}
function mkAuto() {
  if (Date.now() - mk.failTs < 60000) return;
  mkLoad('crypto', false); mkLoad('metals', false); mkLoad('fx', false);
  mkLoadStocks(P.STOCK_PRESET.slice(0, 4), false);
}
function mkOpenLoad() {
  mk.failTs = 0;
  if (ui.mktTab === 'stocks') mkLoadStocks(mkSyms(), false);
  else if (ui.mktTab === 'metals') { mkLoad('metals', false); mkLoad('fx', false); } else mkLoad('crypto', false);
}
// Точечное обновление без полной перерисовки: окно на главном экране и список в разделе (чтобы не терять ввод в поиске)
function mkPaint() {
  if (ui.tour) return;
  if (ui.screen === 'today') { const card = document.querySelector('.card.market'); if (card) card.outerHTML = marketCard(); }
  if (ui.screen === 'market') { const st = document.getElementById('mkt_status'); if (st) st.innerHTML = mkStatus(); mkList(); }
}
function mkList() { const el = document.getElementById('mkt_list'); if (el) el.innerHTML = ui.mktTab === 'stocks' ? stocksList() : ui.mktTab === 'metals' ? metalsList() : cryptoList(); }
function mkRow(sym, name, price, change, cur, extra = '') {
  const ch = Number.isFinite(change) ? `<small class="${change >= 0 ? 'good' : 'amber'}">${change >= 0 ? '+' : ''}${change.toFixed(2).replace('.', ',')}%</small>` : '<small></small>';
  return `<div class="mkrow"><span class="mksym"><b>${esc(sym)}</b><small class="muted">${esc(name)}</small></span><b class="mkpx">${price == null ? '—' : esc(P.fmtPrice(price, cur, loc()))}</b>${ch}${extra}</div>`;
}
const MK_METAL_KEY = { XAU: 'mkt_gold', XAG: 'mkt_silver', XPT: 'mkt_platinum' };
function mkMetalRow(sym) {
  const m = mk.metals && mk.metals.items[sym];
  const sub = m ? `≈ ${P.fmtPrice(m.price / P.OZ_GRAMS, mk.metals.cur, loc())} ${t('mkt_per_gram')}` : '';
  return mkRow(t(MK_METAL_KEY[sym]), sub, m ? m.price : null, null, m ? mk.metals.cur : 'USD');
}
function mkCurName(code) { try { return new Intl.DisplayNames([loc()], { type: 'currency' }).of(code) || code; } catch { return code; } }
function mkFxRow(r, base) { return mkRow(r.code, mkCurName(r.code), r.per, r.change, base); }
function marketCard() {
  const m = mk.crypto;
  const loading = `<p class="muted small">${t('mkt_loading')}</p>`;
  const coins = m ? m.rows.filter((r) => !P.STABLES.includes(r.symbol)).slice(0, 4).map((r) => mkRow(r.symbol, r.name, r.price, r.change, m.cur)).join('') : loading;
  const metals = mk.metals ? ['XAU', 'XAG'].map(mkMetalRow).join('') : loading;
  const fx = mk.fx ? mk.fx.rows.slice(0, 2).map((r) => mkFxRow(r, mk.fx.base)).join('') : loading;
  const stocks = P.getTdKey()
    ? `<div class="mkgrp">${t('mkt_stocks')}</div>${P.STOCK_PRESET.slice(0, 4).map((s) => { const q = mk.stocks[s]; const ok = q && !q.bad; return mkRow(s, ok ? q.name : '', ok ? q.price : null, ok ? q.change : null, ok ? q.cur : 'USD'); }).join('')}`
    : '';
  return `<section class="card market"><div class="between"><h3>${t('mkt_title')}</h3><small class="muted">${m ? t('mkt_updated', { t: mkTime(m.ts) }) : ''}</small></div><div class="mkgrp">${t('mkt_crypto')}</div>${coins}<div class="mkgrp">${t('mkt_metals_short')}</div>${metals}<div class="mkgrp">${t('mkt_fx')}</div>${fx}${stocks}<button class="btn" data-act="openMarket">${t('mkt_more')} →</button></section>`;
}
function mkStatus() {
  const tab = ui.mktTab === 'stocks' ? 'stocks' : ui.mktTab === 'metals' ? 'metals' : 'crypto';
  const ts = tab === 'stocks' ? Math.max(0, ...Object.values(mk.stocks).map((q) => q.ts || 0))
    : tab === 'metals' ? Math.max(mk.metals ? mk.metals.ts : 0, mk.fx ? mk.fx.ts : 0) : (mk.crypto ? mk.crypto.ts : 0);
  let s = ts ? t('mkt_updated', { t: mkTime(ts) }) : t('mkt_loading');
  if (mk.err === 'rate') s += ` · ${t('mkt_rate')}`; else if (mk.err === 'key') s += ` · ${t('mkt_badkey')}`; else if (mk.err === 'fail') s += ` · ${t('mkt_fail')}`;
  const rec = tab === 'crypto' ? mk.crypto : tab === 'metals' ? mk.metals : null;
  if (rec && rec.cur !== S().profile.currency) s += ` · ${t('mkt_cur_usd')}`;
  return esc(s);
}
function cryptoList() {
  const m = mk.crypto;
  if (!m) return `<p class="muted center">${t('mkt_loading')}</p>`;
  const q = mk.q.trim().toLowerCase();
  const rows = m.rows.filter((r) => !q || r.name.toLowerCase().includes(q) || r.symbol.toLowerCase().includes(q));
  return rows.length ? rows.map((r) => mkRow(`${r.rank ? r.rank + '. ' : ''}${r.symbol}`, r.name, r.price, r.change, m.cur)).join('') : `<p class="muted center">${t('mkt_empty')}</p>`;
}
function metalsList() {
  const metals = mk.metals ? ['XAU', 'XAG', 'XPT'].map(mkMetalRow).join('') : `<p class="muted center">${t('mkt_loading')}</p>`;
  const fx = mk.fx ? mk.fx.rows.map((r) => mkFxRow(r, mk.fx.base)).join('') : `<p class="muted center">${t('mkt_loading')}</p>`;
  return `<div class="mkgrp">${t('mkt_metals_short')}</div><p class="muted small">${t('mkt_metals_note')}</p>${metals}<div class="mkgrp">${t('mkt_fx')}</div><p class="muted small">${t('mkt_fx_note', { c: mk.fx ? mk.fx.base : S().profile.currency })}</p>${fx}`;
}
function stocksList() {
  const q = mk.q.trim().toLowerCase();
  const watch = P.getWatch();
  const syms = mkSyms().filter((s) => { const d = mk.stocks[s]; return !q || s.toLowerCase().includes(q) || (d && d.name && d.name.toLowerCase().includes(q)); });
  const rows = syms.map((s) => {
    const d = mk.stocks[s]; const ok = d && !d.bad;
    const del = !P.STOCK_PRESET.includes(s) && watch.includes(s) ? `<button class="x" data-act="mktDelTicker" data-v="${esc(s)}" aria-label="${esc(t('remove'))}">×</button>` : '';
    return mkRow(s, ok ? d.name : '', ok ? d.price : null, ok ? d.change : null, ok ? d.cur : 'USD', del);
  }).join('');
  const more = mkSyms().some((s) => !mkFresh(mk.stocks[s], MK_TTL.stocks)) ? `<button class="btn ghost" data-act="mktMore">${t('mkt_load_more')}</button>` : '';
  return (rows || `<p class="muted center">${t('mkt_empty')}</p>`) + more;
}
function vMarket() {
  const tab = ui.mktTab === 'stocks' ? 'stocks' : ui.mktTab === 'metals' ? 'metals' : 'crypto';
  const search = `<input id="mkt_q" type="search" autocomplete="off" placeholder="${esc(t('mkt_search_ph'))}" value="${esc(mk.q)}">`;
  let body;
  if (tab === 'crypto') body = `${search}<div id="mkt_list">${cryptoList()}</div>`;
  else if (tab === 'metals') body = `<div id="mkt_list">${metalsList()}</div>`;
  else if (!P.getTdKey()) body = `<section class="card"><p>${t('mkt_nokey')}</p><form data-submit="mktSaveKey"><input id="mkt_key" type="password" autocomplete="off" placeholder="${esc(t('mkt_key_ph'))}"><button class="btn primary" type="submit">${t('mkt_key_save')}</button></form></section>`;
  else body = `${search}<div id="mkt_list">${stocksList()}</div><form class="mini" data-submit="mktAddTicker"><input id="mkt_t" maxlength="12" autocomplete="off" placeholder="${esc(t('mkt_ticker_ph'))}"><button class="btn" type="submit">${t('mkt_add_ticker')}</button></form>`;
  const tb = (k, label) => `<button class="btn ${tab === k ? 'primary' : 'ghost'}" data-act="mktTab" data-v="${k}">${label}</button>`;
  return `<button class="x back" data-act="nav" data-v="today">← ${t('back')}</button><h2 class="h">${t('mkt_title')}</h2>
<div class="seg">${tb('crypto', t('mkt_crypto'))}${tb('metals', t('mkt_metals_tab'))}${tb('stocks', t('mkt_stocks'))}</div>
<div class="between mkbar"><p class="muted small" id="mkt_status">${mkStatus()}</p><button class="btn ghost" data-act="mktRefresh">${t('mkt_refresh')}</button></div>${body}<p class="muted small">${t('mkt_note')}</p><p class="warnbox">${t('risk')}</p>
<button class="btn" data-act="openLearn">${t('learn_title')} →</button>`;
}
// «Азбука инвестора»: раскрывающиеся уроки. Текст берётся на языке человека (если нет, то русский)
function vLearn() {
  const l = getLang();
  const items = LEARN.map((x) => {
    const d = x[l] || x.ru;
    const row = (k, v) => `<p><b>${t(k)}.</b> ${esc(v)}</p>`;
    return `<details class="learnItem"><summary><span aria-hidden="true">${x.icon}</span> ${esc(d.t)}</summary><div class="lbody">${row('learn_what', d.what)}${row('learn_how', d.how)}${row('learn_risk', d.risk)}${row('learn_tip', d.tip)}</div></details>`;
  }).join('');
  return `<button class="x back" data-act="learnBack">← ${t('back')}</button><h2 class="h">${t('learn_title')}</h2><p class="muted small">${t('learn_intro')}</p>${items}<p class="warnbox">${t('learn_disc')}</p><p class="warnbox">${t('risk')}</p>`;
}

// Автоцены: монеты (CoinGecko) и акции (Twelve Data по своему ключу). Цена кладётся в само вложение, расчёты берут её оттуда
const hasLive = () => S().holdings.some((h) => h.live && h.live.kind);
function liveLine(h) {
  const l = h.live;
  if (!l || !l.kind) return '';
  let when = '';
  try { when = l.priceAt ? new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(l.priceAt)) : ''; } catch { when = ''; }
  const txt = l.price > 0 ? `${esc(l.name || l.id)}: ${esc(String(l.units).replace('.', ','))} × ${money(l.price)}${when ? ' · ' + esc(when) : ''}` : esc(t('px_wait'));
  return `<div class="muted small">${txt}</div>`;
}
async function refreshLive(silent) {
  const hs = S().holdings.filter((h) => h.live && h.live.kind);
  if (!hs.length) return;
  ui.priceTs = Date.now();
  const cur = S().profile.currency;
  const res = {};
  let fail = 0;
  const coins = hs.filter((h) => h.live.kind === 'crypto');
  try { if (coins.length) Object.assign(res, await P.cryptoPrices(coins.map((h) => h.live.id), cur)); } catch { fail++; }
  for (const h of hs.filter((x) => x.live.kind === 'stock')) {
    try { res['s:' + h.id] = await P.stockPrice(h.live.id, P.getTdKey(), cur); } catch { fail++; }
  }
  store.update((s) => {
    s.holdings.forEach((h) => {
      if (!h.live || !h.live.kind) return;
      const p = h.live.kind === 'crypto' ? res[h.live.id] : res['s:' + h.id];
      if (p > 0) { h.live.price = p; h.live.priceAt = Date.now(); h.live.cur = cur; }
    });
  });
  render();
  if (!silent) toast(fail ? t('px_fail') : t('px_updated'), !!fail);
}
// Обновляем цены при заходе на экран инвестиций, но не чаще раза в 5 минут
function maybeRefreshPrices() {
  if (hasLive() && (!ui.priceTs || Date.now() - ui.priceTs > 5 * 60 * 1000)) refreshLive(true);
}

function vInvest() {
  const today = C.ymd();
  const ps = C.portfolioStats(S(), today);
  const av = C.investAvailable(S());
  const gcls = ps.gain >= 0 ? 'good' : 'amber';
  const sign = (n) => (n > 0 ? '+' : '');
  const types = Object.keys(ps.byType).map((k) => {
    const b = ps.byType[k];
    const g = b.invested > 0 ? C.round2(((b.value - b.invested) / b.invested) * 100) : 0;
    return `<div class="prow"><span>${t('ty_' + k)}</span><b>${money(b.value)} <small class="${g >= 0 ? 'good' : 'amber'}">${sign(g)}${g}%</small></b>${bar(ps.value > 0 ? b.value / ps.value : 0, 'b-invest')}</div>`;
  }).join('');
  const cards = S().holdings.map((h) => {
    const inv = C.holdingInvested(h); const v = C.holdingValue(h, today); const g = C.round2(v - inv);
    const gp = inv > 0 ? C.round2((g / inv) * 100) : 0;
    const since = (h.lots || []).reduce((m, l) => (!m || l.date < m ? l.date : m), '');
    return `<section class="card"><div class="between"><h3>${esc(h.name)} <span class="tag">${t('ty_' + h.type)}</span></h3><b>${money(v)}</b></div>
${kv(t('inv_invested'), money(inv))}${kv(t('inv_growth'), `${sign(g)}${money(g)} (${sign(gp)}${gp}%)`, g >= 0 ? 'good' : 'amber')}${liveLine(h)}<div class="muted small">${C.round2(h.rate)}% ${t('rate_pa').replace('%', '').trim()} · ${t('inv_since')} ${esc(dfmt(since, { day: 'numeric', month: 'short', year: 'numeric' }))}</div>
<div class="mini3"><button class="btn ghost" data-act="openTopup" data-id="${esc(h.id)}">${t('inv_topup')}</button><button class="btn ghost" data-act="openHvalue" data-id="${esc(h.id)}">${t('inv_update')}</button><button class="btn ghost danger" data-act="delHolding" data-id="${esc(h.id)}">✕</button></div><button class="btn ghost" data-act="openLive" data-id="${esc(h.id)}">${t('live_btn')}</button></section>`;
  }).join('');
  return `<button class="x back" data-act="nav" data-v="more">← ${t('back')}</button><h2 class="h">${t('invest_title')}</h2>
<section class="card"><div class="label">${t('inv_networth')}</div><div class="big">${money(C.netWorth(S(), today))}</div><div class="muted small">${t('inv_networth_hint')}</div></section>
<section class="card">${kv(t('inv_invested'), money(ps.invested))}${kv(t('inv_value'), money(ps.value))}${kv(t('inv_growth'), `${sign(ps.gain)}${money(ps.gain)} (${sign(ps.gainPct)}${ps.gainPct}%)`, gcls)}${kv(t('inv_available'), money(av), av < 0 ? 'amber' : '')}${av < 0 ? `<p class="muted small">${t('inv_over')}</p>` : ''}</section>
${types ? `<section class="card"><h3>${t('inv_by_type')}</h3>${types}</section>` : ''}
${hasLive() ? `<button class="btn ghost" data-act="refreshPrices">${t('px_refresh')}</button><p class="muted small">${t('px_note')}</p>` : ''}
${cards || `<p class="muted center">${t('inv_empty')}</p>`}
<button class="btn primary" data-act="openHolding">+ ${t('inv_add')}</button>
<p class="muted small">${t('inv_note')}</p><p class="warnbox">${t('risk')}</p>`;
}

function modeLeft() {
  const p = S().profile;
  if (!p.modeChangedAt) return 0;
  const since = Math.floor((Date.parse(C.ymd()) - Date.parse(p.modeChangedAt)) / 864e5);
  return Math.max(0, 30 - since);
}
// Карточка «Мои расходы и доход»: текущие значения, ближайшее запланированное изменение и кнопка правки
function budgetCard() {
  const today = C.ymd();
  const ep = C.effProfile(S(), today);
  const pend = C.pendingChange(S(), today);
  const inc = ep.incomeType === 'hour' ? ep.incomeEstimate : ep.incomeAmount;
  const note = pend ? `<p class="muted small">${t('bud_pending', { m: dfmt(pend.from + '-01', { month: 'long', year: 'numeric' }), n: money(C.needsMonthly(pend)) })}</p>` : '';
  return `<section class="card"><h3>${t('bud_title')}</h3>${kv(t('bud_needs'), money(C.needsMonthly(ep)))}${kv(t('bud_income'), money(Number(inc) || 0))}${note}<button class="btn" data-act="openBudget">${t('bud_edit')}</button></section>`;
}

// Уведомления: включение на этом телефоне и выбор, о чём напоминать. Присылает их серверная функция tgm-push.
const PUSH_KINDS = ['payday', 'evening', 'bills', 'weekly'];
function pushCard() {
  if (!store.cloud.enabled) return '';
  if (!ui.pushInfo) {
    ui.pushInfo = { loading: true };
    pushInfo().then((i) => { ui.pushInfo = i; if (ui.screen === 'more' && !ui.modal) render(); });
  }
  const i = ui.pushInfo;
  const pr = S().profile.push || {};
  let body = '';
  if (i.loading) body = '';
  else if (!i.supported) body = `<p class="muted small">${t('nf_unsupported')}</p>`;
  else if (!store.cloud.user) body = `<p class="muted small">${t('nf_need_account')}</p>`;
  else if (i.subscribed && i.permission === 'granted') {
    body = `<p class="small">${t('nf_on')}</p>${PUSH_KINDS.map((k) => `<label class="check2"><input type="checkbox" data-change="setPushPref" data-k="${k}" ${pr[k] === false ? '' : 'checked'}><span>${t('nf_' + k)}</span></label>`).join('')}<button class="btn" data-act="testPush">${t('nf_test')}</button><button class="btn ghost" data-act="disablePush">${t('nf_disable')}</button>`;
  } else if (i.permission === 'denied') body = `<p class="warnbox">${t('nf_denied')}</p>`;
  else body = `<button class="btn primary" data-act="enablePush">${t('nf_enable')}</button>`;
  return `<section class="card"><h3>${t('nf_title')}</h3><p class="muted small">${t('nf_text')}</p>${body}</section>`;
}

function vMore() {
  const p = S().profile;
  const left = modeLeft();
  const c = store.cloud;
  const account = c.enabled
    ? (c.user
      ? `<p class="small">${t('sec_as', { id: esc(A.displayId(c.user, AUTH_DOMAIN)) })}</p>${!A.hasRealEmail(c.user, AUTH_DOMAIN) && !A.hasGoogle(c.user) ? `<p class="warnbox">${t('sec_nudge')}</p>` : ''}<button class="btn" data-act="openSecurity">${t('sec_btn')}</button><button class="btn ghost" data-act="signOut">${t('set_signout')}</button>`
      : `<button class="btn primary" data-act="openAccount">${t('acc_open')}</button>`)
    : `<p class="muted small">${t('ob_cloud_off')}</p>`;
  const legal = c.enabled ? `<button class="btn ghost" data-act="openPrivacy">${t('legal_title')}</button>` : '';
  const sel = (id, change, opts, cur, dis) => `<select id="${id}" data-change="${change}" ${dis ? 'disabled' : ''}>${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  let zones = [];
  try { zones = Intl.supportedValuesOf('timeZone'); } catch { zones = []; }
  if (!zones.includes(p.tz)) zones = [p.tz, ...zones];
  return `<h2 class="h">${t('set_title')}</h2>
<section class="card"><button class="btn primary" data-act="meetGnomes">${t('set_meet')}</button><button class="btn" data-act="goInvest">${t('invest_title')} →</button><button class="btn ghost" data-act="openPilot">${t('pilot_btn')}</button><button class="btn ghost" data-act="openWeek">${t('wk_title')}</button><button class="btn ghost" data-act="openTeacher">${t('tch_btn')}</button><button class="btn" data-act="nav" data-v="goals">${t('goals_title')} →</button><button class="btn" data-act="nav" data-v="reminders">${t('rem_title')} →</button><button class="btn" data-act="openMarket">${t('mkt_title')} →</button><button class="btn" data-act="openLearn">${t('learn_title')} →</button><button class="btn ghost" data-act="startTour">${t('tour_replay')}</button><button class="btn ghost" data-act="openNews">${t('news_btn')}</button></section>
${budgetCard()}
<section class="card">${field(t('set_lang'), sel('s_lang', 'setLangS', LANGS.map((l) => [l, LANG_NAMES[l]]), p.lang))}
${field(t('set_cur'), sel('s_cur', 'setCur', CURRENCIES.map((x) => [x, x]), p.currency))}
${field(t('set_mode'), sel('s_mode', 'setModeS', C.MODES.map((m) => [m, t('mode_' + m)]), p.mode, left > 0))}${left > 0 ? `<p class="muted small">${t('set_mode_locked', { n: left })}</p>` : ''}
${field(t('set_incmode'), sel('s_im', 'setIncomeMode', [['auto', t('im_auto')], ['manual', t('im_manual')]], p.incomeMode || 'auto'))}<p class="muted small">${t('set_incmode_hint')}</p>
${field(t('set_rollover'), sel('s_ro', 'setRollover', [['split', t('ro_split')], ['joy', t('ro_joy')], ['priority', t('ro_priority')]], p.rolloverRule || 'split'))}
${field(t('set_sound'), sel('s_snd', 'setSoundS', [['off', t('snd_off')], ['fx', t('snd_fx')], ['all', t('snd_all')]], p.sound || 'fx'))}
${field(t('set_grumpy'), sel('s_gr', 'setGrumpy', [['on', t('opt_on')], ['off', t('opt_off')]], p.grumpy === false ? 'off' : 'on'))}
${field(t('set_theme'), sel('s_theme', 'setTheme', [['dark', t('theme_dark')], ['light', t('theme_light')]], S().theme))}
${field(t('set_payday'), sel('s_pd', 'setPayDay', [['0', t('set_payday_auto')], ...Array.from({ length: 31 }, (_, i) => [String(i + 1), String(i + 1)])], String(Number(p.payDay) || 0)))}<p class="muted small">${t('set_payday_hint')}</p>
${field(t('set_tz'), sel('s_tz', 'setTzS', zones.map((z) => [z, z]), p.tz))}
${kv(t('set_start'), esc(longDate(p.startDate || C.ymd())))}</section>
${pushCard()}
<section class="card"><h3>${t('set_account')}</h3><p class="muted small">${syncText()}</p>${account}${legal}</section>
<section class="card"><button class="btn" data-act="exportCsv">${t('set_export')}</button><button class="btn danger" data-act="wipe">${t('set_delete')}</button></section>
<p class="muted small center">${t('set_version')}: ${APP_VERSION}</p><p class="center"><button class="btn ghost" data-act="checkUpdateNow">${t('upd_check')}</button></p>
<p class="warnbox">${t('risk')}</p>`;
}

function vMain() {
  const scr = { today: vToday, calendar: vCalendar, baskets: vBaskets, debts: vDebts, invest: vInvest, goals: vGoals, reminders: vReminders, market: vMarket, learn: vLearn, more: vMore }[ui.screen] || vToday;
  const nav = ['today', 'calendar', 'baskets', 'debts', 'more'].map((k) => [k, NAV_ICONS[k]]);
  const active = ['invest', 'goals', 'reminders', 'learn'].includes(ui.screen) ? 'more' : ui.screen === 'market' ? 'today' : ui.screen;
  return `<header class="top"><div class="brand">${BRAND_ICON}<span>TGM</span><small>${t('app_tag')}</small></div><div class="clock"><span id="clock"></span><small>${esc(C.getTz())} · v${APP_VERSION.split(' ')[0]}</small></div></header>
<main class="screen">${scr()}</main>
<nav class="nav">${nav.map(([k, ic]) => `<button class="${active === k ? 'on' : ''}" data-act="nav" data-v="${k}"><span aria-hidden="true">${ic}</span>${t('nav_' + k)}</button>`).join('')}</nav>`;
}

// ---------- окна ----------
const footBtns = (save = true) => `<div class="foot"><button type="button" class="btn ghost" data-act="closeModal">${t('cancel')}</button>${save ? `<button class="btn primary" type="submit">${t('save')}</button>` : ''}</div>`;
const dateField = (d) => field(t('date'), `<input id="m_date" type="date" value="${esc(d)}" max="${C.ymd()}" min="2000-01-01">`);
const holdSelect = (sel) => `<select id="m_hold">${S().holdings.map((h) => `<option value="${esc(h.id)}" ${h.id === sel ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select>`;
const basketCheck = () => `<label class="check2"><input type="checkbox" id="m_fb" ${C.investAvailable(S()) > 0 ? 'checked' : ''}><span>${t('inv_from_basket')} (${money(C.investAvailable(S()))})</span></label>`;

function vPilotBody() {
  const today = C.ymd();
  const sm = C.pilotSummary(S(), today);
  const st = C.pilotStatus(S(), today);
  const rows = sm.rows.filter((r) => r.est > 0 || r.actual > 0).map((r) => `<div class="pr"><span>${t('n_' + r.key)}</span><span>${money(r.est)}</span><b class="${r.est > 0 && r.actual > r.est ? 'amber' : ''}">${money(r.actual)}</b></div>`).join('');
  const food = `<div class="pr"><span>${t('food_week')}</span><span>${money(sm.foodWeekEst)}</span><b class="${sm.foodWeekEst > 0 && sm.foodWeekActual > sm.foodWeekEst ? 'amber' : ''}">${money(sm.foodWeekActual)}</b></div>`;
  const wants = `<div class="pr"><span>${t('pilot_wants')}</span><span>${money(S().profile.monthlyFun || 0)}</span><b>${money(sm.wantsMonth)}</b></div>`;
  const canApply = sm.enough && sm.hasData && st !== 'done';
  return `<h3>${t('pilot_sum_title')}</h3><div class="pr head"><span></span><span>${t('pilot_est')}</span><span>${t('pilot_act')}</span></div>${rows}${food}${wants}
${!sm.hasData ? `<p class="muted small">${t('pilot_nodata')}</p>` : ''}${!sm.enough ? `<p class="muted small">${t('pilot_early', { n: sm.elapsed })}</p>` : ''}
<div class="foot"><button class="btn ghost" data-act="closeModal">${t('close')}</button><button class="btn primary" data-act="applyPilot" ${canApply ? '' : 'disabled'}>${t('pilot_apply')}</button></div>`;
}

// Сколько можно потратить из горшка на оплату долга (для «Долгов» это то, что пришло в горшок и не выплачено)
function payAvail(src, date) {
  const st = C.basketStats(S(), date);
  if (src === 'debts') return Math.max(0, C.round2(st.debts.allocated - st.debts.spent));
  if (src === 'needs') return st.needs.left;
  if (src === 'joy') return st.joy.left;
  if (src === 'cushion') return C.cushionTotal(S());
  if (src === 'invest') return C.investAvailable(S());
  return C.unallocTotal(S());
}
function paySourceField(date) {
  const opts = C.PAY_SOURCES.map((k) => [k, payAvail(k, date)]).filter(([k, a]) => k === 'debts' || a > 0.004);
  const first = opts.find(([k, a]) => k === 'debts' && a > 0.004) || opts.find(([k, a]) => a > 0.004) || opts[0];
  return field(t('pay_from'), `<select id="m_from">${opts.map(([k, a]) => `<option value="${k}" ${first && first[0] === k ? 'selected' : ''}>${esc(BNAME(k))} · ${esc(t('pay_from_have', { a: money(a) }))}</option>`).join('')}</select>`);
}
const incomeAuto = () => (S().profile.incomeMode || 'auto') === 'auto';
// Окно «Куда пошёл доход»: галочка кладёт долю по плану в горшок, всё неотмеченное остаётся в «Не распределено»
function incomeAssignBody(inc, pc, today, m) {
  const A = inc.assigned || {};
  const rest = C.round2(inc.amount - C.assignedSum(inc));
  const rows = C.BASKETS.map((k) => `<label class="check"><input type="checkbox" data-change="toggleAssign" data-id="${esc(inc.id)}" data-b="${k}" ${inc.alloc[k] > 0 && (Number(A[k]) || 0) >= inc.alloc[k] - 0.004 ? 'checked' : ''} ${inc.alloc[k] > 0 ? '' : 'disabled'}><span>${BNAME(k)} · ${Math.round((inc.alloc[k] / (inc.amount || 1)) * 100)}%</span><b>${money(inc.alloc[k])}</b></label>`).join('');
  const late = C.monthOf(inc.date) !== C.monthOf(today) ? `<p class="warnbox">${t('inc_past_warn')}</p><button class="btn primary" data-act="moveIncomeToday" data-id="${esc(inc.id)}">${t('inc_move_today')}</button>` : '';
  return `<h3>${t('inc_got_title')}: ${money(inc.amount)}</h3>${m.note ? `<p class="warnbox">${esc(m.note)}</p>` : ''}${late}<p class="muted small">${t('inc_assign_hint')}</p>${rows}
${C.fixedNeeds(S(), today) > 0 && !inc.alloc.needs ? `<p class="muted small">${t('needs_full')}</p>` : ''}${pc.noSurplus ? `<p class="warnbox">${t('plan_none')}</p>` : ''}
<div class="kv unrest ${rest > 0.004 ? 'hot' : ''}"><span>${t('inc_assign_rest')}</span><b>${money(rest)}</b></div>
<div class="foot wrap"><button class="btn" data-act="assignAllPlan" data-id="${esc(inc.id)}">${t('inc_plan_all')}</button><button class="btn" data-act="openAllocate">${t('inc_manual')}</button><button class="btn primary" data-act="closeModal">${t('close')}</button></div>`;
}

// Пока вводишь суммы в окне распределения, показываем, сколько ещё осталось в «Не распределено»
function allocLive() {
  const pool = C.unallocTotal(S());
  const used = C.round2(C.BASKETS.reduce((a, k) => a + (C.parseNonNeg(val('al_' + k)) || 0), 0));
  const left = C.round2(pool - used);
  const el = document.getElementById('al_left');
  if (el) el.innerHTML = `<span>${t('alloc_left')}</span><b class="${left < 0 ? 'amber' : ''}">${money(left)}</b>`;
}

function vModal() {
  const m = ui.modal;
  const today = C.ymd();
  let inner = '';
  if (m.type === 'expense') {
    const ed = m.edit ? S().expenses.find((x) => x.id === m.edit) : null;
    inner = `<h3>${t(ed ? 'edit_entry' : 'exp_title')}</h3><form data-submit="saveExpense"><input type="hidden" id="m_edit" value="${esc(ed ? ed.id : '')}">${dateField(ed ? ed.date : (m.date || today))}${field(t('amount'), `<input id="m_amount" inputmode="decimal" data-af autocomplete="off" value="${esc(ed ? String(ed.amount).replace('.', ',') : '')}">`)}
<div class="chips">${CATS.map((c, i) => `<label><input type="radio" name="cat" value="${c}" data-change="catKind" ${(ed ? ed.category === c : i === 0) ? 'checked' : ''}><span>${t('cat_' + c)}</span></label>`).join('')}</div>
<div class="chips two"><label><input type="radio" name="kind" value="need" ${!ed || ed.kind === 'need' ? 'checked' : ''}><span>${t('kind_need')}</span></label><label><input type="radio" name="kind" value="want" ${ed && ed.kind === 'want' ? 'checked' : ''}><span>${t('kind_want')}</span></label></div>
${field(t('note'), `<input id="m_note" maxlength="120" autocomplete="off" value="${esc(ed ? (ed.note || '') : '')}">`)}${footBtns()}</form>`;
  } else if (m.type === 'income') {
    const edi = m.edit ? S().incomes.find((x) => x.id === m.edit) : null;
    const unpaid = edi ? 0 : C.unpaidEarned(S());
    const unpaidPrev = edi ? 0 : C.unpaidBefore(S(), C.monthOf(m.date || today));
    const twoScopes = unpaidPrev > 0 && unpaidPrev < unpaid;
    const scopeHtml = unpaid > 0
      ? (twoScopes
        ? field(t('pay_scope_label'), `<select id="m_scope"><option value="prev" data-amt="${unpaidPrev}" selected>${esc(t('pay_scope_prev', { a: money(unpaidPrev) }))}</option><option value="all" data-amt="${unpaid}">${esc(t('pay_scope_all', { a: money(unpaid) }))}</option></select>`)
        : `<input type="hidden" id="m_scope" value="all">`)
      : '';
    inner = `<h3>${t(edi ? 'edit_entry' : 'inc_title')}</h3><form data-submit="saveIncome"><input type="hidden" id="m_edit" value="${esc(edi ? edi.id : '')}">${dateField(edi ? edi.date : (m.date || today))}<p class="muted small">${t('inc_date_hint')}</p>${field(t('amount'), `<input id="m_amount" inputmode="decimal" data-af autocomplete="off" value="${esc(edi ? String(edi.amount).replace('.', ',') : '')}">`)}${field(t('source'), `<input id="m_source" maxlength="60" placeholder="${esc(t('salary'))}" autocomplete="off" value="${esc(edi ? edi.source : '')}">`)}
${unpaid > 0 ? `<label class="check2"><input type="checkbox" id="m_paid" checked><span>${t('shift_paid')}</span></label>${scopeHtml}<button type="button" class="btn ghost" data-act="fillEarned" data-v="${twoScopes ? unpaidPrev : unpaid}">${t('fill_earned')}</button>` : ''}${footBtns()}</form>`;
  } else if (m.type === 'loan') {
    const l = m.id ? S().loans.find((x) => x.id === m.id) : null;
    const src = l ? '' : field(t('loan_src'), `<select id="m_src"><option value="own">${esc(t('loan_src_own'))}</option><option value="cushion">${esc(BNAME('cushion'))} · ${esc(money(C.purchaseAvailable(S(), 'cushion')))}</option><option value="invest">${esc(BNAME('invest'))} · ${esc(money(C.purchaseAvailable(S(), 'invest')))}</option></select>`);
    const fixedFields = l ? '' : field(t('loan_amount'), '<input id="m_amount" inputmode="decimal" autocomplete="off">') + dateField(today);
    inner = `<h3>${t(l ? 'goal_edit' : 'loan_add')}</h3>${l ? `<p class="muted small">${t('loan_edit_hint')}</p>` : ''}<form data-submit="saveLoan"><input type="hidden" id="m_id" value="${esc(l ? l.id : '')}">${field(t('loan_person'), `<input id="m_name" data-af maxlength="60" placeholder="${esc(t('loan_person_ph'))}" autocomplete="off" value="${esc(l ? l.person : '')}">`)}${fixedFields}${field(t('loan_due'), `<input id="m_due" type="date" min="2000-01-01" value="${esc(l && l.due ? l.due : '')}">`)}${field(t('loan_rate'), `<input id="m_rate" inputmode="decimal" autocomplete="off" value="${esc(l && l.rate ? String(l.rate).replace('.', ',') : '')}">`)}${field(t('loan_note'), `<input id="m_note" maxlength="120" autocomplete="off" value="${esc(l && l.note ? l.note : '')}">`)}${src}${footBtns()}</form>`;
  } else if (m.type === 'repay') {
    const l = S().loans.find((x) => x.id === m.id);
    if (!l) { ui.modal = null; return ''; }
    const st = C.loanStats(l, today);
    inner = `<h3>${t('loan_repay_title')}: ${esc(l.person)}</h3><p class="muted small">${t('loan_owed')}: ${esc(money(st.owed))}</p><form data-submit="saveRepay"><input type="hidden" id="m_id" value="${esc(l.id)}">${field(t('amount'), `<input id="m_amount" inputmode="decimal" data-af autocomplete="off" value="${esc(String(st.owed).replace('.', ','))}">`)}${dateField(today)}${footBtns()}</form>`;
  } else if (m.type === 'goal') {
    const g = m.id ? S().goals.find((x) => x.id === m.id) : null;
    inner = `<h3>${t(g ? 'goal_edit' : 'goal_new')}</h3><form data-submit="saveGoal"><input type="hidden" id="m_id" value="${esc(g ? g.id : '')}">${field(t('goal_name'), `<input id="m_name" data-af maxlength="60" placeholder="${esc(t('goal_name_ph'))}" autocomplete="off" value="${esc(g ? g.name : '')}">`)}${field(t('goal_target'), `<input id="m_amount" inputmode="decimal" autocomplete="off" value="${esc(g ? String(g.target).replace('.', ',') : '')}">`)}${field(t('goal_deadline'), `<input id="m_deadline" type="date" min="${esc(today)}" value="${esc(g && g.deadline ? g.deadline : '')}">`)}<p class="muted small">${t('goal_deadline_hint')}</p>${footBtns()}</form>`;
  } else if (m.type === 'goalAdd') {
    const g = S().goals.find((x) => x.id === m.id);
    if (!g) { ui.modal = null; return ''; }
    const src = `<select id="m_src"><option value="own">${esc(t('goal_src_own'))}</option><option value="invest">${esc(BNAME('invest'))} · ${esc(money(C.purchaseAvailable(S(), 'invest')))}</option></select>`;
    inner = `<h3>${t('goal_add_title')}: ${esc(g.name)}</h3><form data-submit="saveGoalAdd"><input type="hidden" id="m_id" value="${esc(g.id)}">${field(t('amount'), '<input id="m_amount" inputmode="decimal" data-af autocomplete="off">')}${dateField(today)}${field(t('goal_src'), src)}${footBtns()}</form>`;
  } else if (m.type === 'reminder') {
    inner = `<h3>${t('rem_add')}</h3><form data-submit="saveReminder">${field(t('rem_name'), `<input id="m_name" data-af maxlength="60" placeholder="${esc(t('rem_name_ph'))}" autocomplete="off">`)}${field(t('rem_amount'), '<input id="m_amount" inputmode="decimal" autocomplete="off">')}${field(t('rem_day'), '<input id="m_day" inputmode="numeric" autocomplete="off">')}${footBtns()}</form>`;
  } else if (m.type === 'teacher') {
    const it = m.id ? LIBRARY.find((x) => x.id === m.id) : null;
    const done = `<div class="foot"><span></span><button class="btn primary" data-act="closeModal">${t('close')}</button></div>`;
    if (!it) {
      inner = `<h3>${t('tch_title')}</h3><div class="wkRow"><div class="wkGnome">${gnomeSvg('teacher')}</div><p class="wkBubble">${esc(t('tch_none'))}</p></div>${done}`;
    } else {
      const tag = C.teacherTags(S(), today).find((x) => it.tags.includes(x)) || it.tags[0];
      inner = `<h3>${t('tch_title')}</h3><div class="wkRow"><div class="wkGnome">${gnomeSvg('teacher')}</div><p class="wkBubble">${esc(t('tch_' + tag))}</p></div>
<div class="lesson"><div class="muted small">${esc(t('tch_k_' + it.kind))}${it.author ? ' · ' + esc(it.author) : ''}</div><h3>${esc(it.title)}</h3><p class="muted small">${esc(it.why || '')}</p><button class="btn primary" data-act="teacherOpen" data-id="${esc(it.id)}">${t('tch_open')}</button></div>
<p class="muted small">${t('tch_note')}${tag === 'debts' || tag === 'invest' ? ' ' + t('tch_local') : ''}</p><div class="foot"><button class="btn ghost" data-act="teacherNext" data-id="${esc(it.id)}">${t('tch_next')}</button><button class="btn" data-act="closeModal">${t('close')}</button></div>`;
    }
  } else if (m.type === 'week') {
    const w = C.weekSummary(S(), C.lastWeekEnd(today));
    const dm = (d) => dfmt(d, { day: 'numeric', month: 'short' });
    const rows = w.hasData
      ? kv(t('wk_income'), money(w.incomeTotal)) + kv(t('wk_want'), money(w.spentWants), w.spentWants > w.joyWeek ? 'amber' : 'good') + kv(t('wk_limit'), money(w.joyWeek))
        + kv(t('wk_need'), money(w.spentNeeds)) + kv(t('wk_debt'), money(w.debtPaid), w.debtPaid > 0 ? 'good' : '') + kv(t('wk_saved'), money(w.saved), w.saved > 0 ? 'good' : '')
        + kv(t('wk_nospend'), String(w.nospend)) + kv(t('wk_days'), `${w.activeDays} / 7`)
      : '';
    inner = `<h3>${t('wk_title')}</h3><p class="muted small">${esc(dm(w.start))} — ${esc(dm(w.end))}</p><div class="wkRow"><div class="wkGnome">${gnomeSvg('gardener')}</div><p class="wkBubble">${esc(t('wk_' + w.verdict, { n: w.activeDays }))}</p></div>${rows}<p class="muted small">${t('wk_note')}</p><div class="foot"><span></span><button class="btn primary" data-act="weekDone">${t('wk_done')}</button></div>`;
  } else if (m.type === 'purchase') {
    const cush = C.cushionTotal(S());
    const months = C.cushionMonths(S(), today);
    const src = `<select id="m_src"><option value="cushion">${esc(BNAME('cushion'))} · ${esc(money(C.purchaseAvailable(S(), 'cushion')))}</option><option value="invest">${esc(BNAME('invest'))} · ${esc(money(C.purchaseAvailable(S(), 'invest')))}</option></select>`;
    inner = `<h3>${t('pur_add')}</h3><p class="muted small">${t('pur_hint2')}</p><form data-submit="savePurchase">${field(t('pur_name'), `<input id="m_name" data-af maxlength="60" placeholder="${esc(t('pur_name_ph'))}" autocomplete="off">`)}${field(t('amount'), '<input id="m_amount" inputmode="decimal" autocomplete="off">')}${dateField(today)}${field(t('pur_from'), src)}${months != null ? `<p class="muted small">${t('pur_cushion_now', { a: money(cush), n: monthsFmt(months) })}</p>` : ''}<p class="muted small">${t('pur_credit')}</p>${footBtns()}</form>`;
  } else if (m.type === 'budget') {
    const ep = C.effProfile(S(), today);
    const n = ep.needs || {};
    const hour = ep.incomeType === 'hour';
    const inp = (id, v) => `<input id="${id}" inputmode="decimal" autocomplete="off" value="${esc(Number(v) ? String(v).replace('.', ',') : '')}">`;
    const incomeFields = hour ? field(t('q_rate'), inp('b_rate', ep.hourlyRate)) + field(t('q_estimate'), inp('b_est', ep.incomeEstimate)) : field(t('q_amount'), inp('b_inc', ep.incomeAmount));
    const fromBox = S().profile.pilotApplied
      ? field(t('bud_from'), `<select id="b_from"><option value="next">${t('bud_next')}</option><option value="now">${t('bud_now')}</option></select>`)
      : `<p class="muted small">${t('bud_pilot')}</p>`;
    inner = `<h3>${t('bud_title')}</h3><p class="muted small">${t('bud_hint')}</p><form data-submit="saveBudget">${C.NEED_KEYS.map((k) => field(t('n_' + k), inp('b_' + k, n[k]))).join('')}${field(t('food_week'), inp('b_foodWeek', n.foodWeek))}${incomeFields}${fromBox}${footBtns()}</form>`;
  } else if (m.type === 'incomeDone') {
    const inc = S().incomes.find((i) => i.id === m.id);
    if (!inc) { ui.modal = null; return ''; }
    const pc = C.plan(S(), today);
    if (inc.assigned) { inner = incomeAssignBody(inc, pc, today, m); } else {
    inner = `<h3>${t('inc_done_title')}: ${money(inc.amount)}</h3>${m.note ? `<p class="warnbox">${esc(m.note)}</p>` : ''}${C.monthOf(inc.date) !== C.monthOf(today) ? `<p class="warnbox">${t('inc_past_warn')}</p><button class="btn primary" data-act="moveIncomeToday" data-id="${esc(inc.id)}">${t('inc_move_today')}</button>` : ''}<p class="muted small">${t('inc_check')}</p>
${C.BASKETS.map((k) => `<label class="check"><input type="checkbox" data-change="toggleDone" data-id="${esc(inc.id)}" data-b="${k}" ${inc.done && inc.done[k] ? 'checked' : ''}><span>${BNAME(k)} · ${Math.round((inc.alloc[k] / (inc.amount || 1)) * 100)}%</span><b>${money(inc.alloc[k])}</b></label>`).join('')}
${C.fixedNeeds(S(), today) > 0 && !inc.alloc.needs ? `<p class="muted small">${t('needs_full')}</p>` : ''}${pc.noSurplus ? `<p class="warnbox">${t('plan_none')}</p>` : ''}<div class="foot"><span></span><button class="btn primary" data-act="closeModal">${t('close')}</button></div>`;
    }
  } else if (m.type === 'allocate') {
    const pool = C.unallocTotal(S());
    const pc = C.plan(S(), today);
    const rows = C.BASKETS.map((k) => `<label class="field"><span>${BNAME(k)} <small class="muted">${t('alloc_plan_hint', { a: money(Math.max(0, C.round2(pool * pc[k]))) })}</small></span><input id="al_${k}" data-live="alloc" inputmode="decimal" autocomplete="off" placeholder="0"></label>`).join('');
    inner = `<h3>${t('alloc_title')}</h3><div class="kv"><span>${t('unalloc')}</span><b>${money(pool)}</b></div><p class="muted small">${t('alloc_hint')}</p><form data-submit="saveAllocate">${rows}<div class="kv unrest" id="al_left"><span>${t('alloc_left')}</span><b>${money(pool)}</b></div><div class="foot wrap"><button type="button" class="btn" data-act="allocFillPlan">${t('alloc_fill_plan')}</button><button type="button" class="btn ghost" data-act="closeModal">${t('cancel')}</button><button class="btn primary" type="submit">${t('alloc_save')}</button></div></form>`;
  } else if (m.type === 'debt') {
    inner = `<h3>${t('debt_title')}</h3><form data-submit="saveDebt">${debtFields('md_')}${footBtns()}</form>`;
  } else if (m.type === 'pay') {
    const open = S().debts.filter((d) => d.balance > 0).sort((a, b) => b.rate - a.rate);
    inner = `<h3>${t('pay_title')}</h3><form data-submit="savePay">${field(t('pay_pick'), `<select id="m_debt">${open.map((d) => `<option value="${esc(d.id)}">${esc(d.name)} · ${esc(money(d.balance))}</option>`).join('')}</select>`)}${paySourceField(today)}${dateField(today)}${field(t('amount'), '<input id="m_amount" inputmode="decimal" data-af autocomplete="off">')}${footBtns()}</form>`;
  } else if (m.type === 'paySrc') {
    inner = `<h3>${t('pay_src_title')}</h3><p class="warnbox">${t('pay_src_hint', { n: money(m.short) })}</p><form data-submit="savePaySrc">${field(t('pay_src_label'), `<input id="m_source" data-af autocomplete="off" maxlength="60" placeholder="${esc(t('pay_src_ph'))}">`)}${footBtns()}</form>`;
  } else if (m.type === 'work') {
    const ws = m.edit ? S().shifts.find((x) => x.id === m.edit && x.end) : null;
    inner = `<h3>${t(ws ? 'work_edit_title' : 'work_day_title')}</h3><form data-submit="saveWork"><input type="hidden" id="m_edit" value="${esc(ws ? ws.id : '')}">${dateField(ws ? ws.date : (m.date || today))}<p class="muted small">${t('work_day_hint')}</p>${field(t('hours'), `<input id="m_hours" inputmode="decimal" data-af placeholder="${esc(t('hours_ph'))}" autocomplete="off" value="${esc(ws ? String(ws.hours).replace('.', ',') : '')}">`)}${footBtns()}</form>`;
  } else if (m.type === 'pilot') {
    inner = vPilotBody();
  } else if (m.type === 'holding') {
    inner = `<h3>${t('inv_add')}</h3><form data-submit="saveHolding">${field(t('inv_name'), `<input id="m_name" data-af maxlength="60" placeholder="${esc(t('inv_name_ph'))}" autocomplete="off">`)}
<div class="chips">${C.HOLD_TYPES.map((k, i) => `<label><input type="radio" name="hty" value="${k}" ${i === 0 ? 'checked' : ''}><span>${t('ty_' + k)}</span></label>`).join('')}</div>
${field(t('inv_amount'), '<input id="m_amount" inputmode="decimal" autocomplete="off">')}${dateField(today)}${field(t('inv_rate'), '<input id="m_rate" inputmode="decimal" autocomplete="off" placeholder="0">')}<p class="muted small">${t('inv_rate_hint')}</p>${basketCheck()}${footBtns()}</form>`;
  } else if (m.type === 'topup') {
    inner = `<h3>${t('inv_topup')}</h3><form data-submit="saveTopup">${field(t('inv_pick'), holdSelect(m.id))}${field(t('inv_amount'), '<input id="m_amount" inputmode="decimal" data-af autocomplete="off">')}${dateField(today)}${basketCheck()}${footBtns()}</form>`;
  } else if (m.type === 'help') {
    if (!C.BASKETS.includes(m.k)) { ui.modal = null; return ''; }
    const pc = C.plan(S(), today);
    inner = `<h3>${BNAME(m.k)} <small class="muted">${C.roundedPercents(pc)[m.k]}%</small></h3><p>${t('help_' + m.k)}</p><div class="foot"><span></span><button class="btn primary" data-act="closeModal">${t('close')}</button></div>`;
  } else if (m.type === 'whatsnew') {
    inner = newsBody(m.seen);
  } else if (m.type === 'closing') {
    const rule = S().profile.rolloverRule || 'split';
    const rows = m.list.map((r) => `<div class="cl"><b>${esc(dfmt(r.month + '-01', { month: 'long', year: 'numeric' }))}</b>${kv(t('close_joy'), money(r.joyLeft))}${kv(t('close_kept'), money(r.keep))}${kv(t('close_needs'), money(r.needsLeft))}${kv(t('close_moved', { b: BNAME(r.basket) }), money(r.moved), 'good')}${r.debtsLeft > 0 ? kv(t('close_debtskept'), money(r.debtsLeft)) : ''}${r.deficit > 0 ? kv(t('close_deficit'), '−' + money(r.deficit), 'amber') : ''}</div>`).join('');
    inner = `<h3>${t('close_title')}</h3>${rows}<p class="muted small">${t('set_rollover')}: ${t('ro_' + rule)}</p><div class="foot"><span></span><button class="btn primary" data-act="closeModal">${t('close_ok')}</button></div>`;
  } else if (m.type === 'live') {
    const h = S().holdings.find((x) => x.id === m.id);
    if (!h) { ui.modal = null; return ''; }
    const l = h.live || {};
    const opt = (v, label) => `<option value="${v}" ${(l.kind || 'none') === v ? 'selected' : ''}>${esc(label)}</option>`;
    inner = `<h3>${esc(h.name)}: ${t('live_title')}</h3><p class="muted small">${t('live_hint')}</p><form data-submit="saveLive"><input type="hidden" id="m_id" value="${esc(h.id)}">
${field(t('live_kind'), `<select id="m_kind">${opt('none', t('live_manual'))}${opt('crypto', t('live_crypto'))}${opt('stock', t('live_stock'))}</select>`)}
${field(t('live_query'), `<input id="m_live" maxlength="40" autocomplete="off" placeholder="${esc(t('live_query_ph'))}" value="${esc(l.kind ? (l.id || '') : '')}">`)}
${field(t('live_units'), `<input id="m_units" inputmode="decimal" autocomplete="off" value="${esc(l.units ? String(l.units).replace('.', ',') : '')}">`)}
${field(t('px_key_title'), `<input id="m_tdkey" type="password" autocomplete="off" placeholder="${esc(P.getTdKey() ? t('px_key_have') : t('px_key_ph'))}">`)}<p class="muted small">${t('px_key_hint')}</p>${footBtns()}</form>`;
  } else if (m.type === 'forgot') {
    inner = mForgot();
  } else if (m.type === 'recovery') {
    inner = mRecovery();
  } else if (m.type === 'security') {
    inner = mSecurity();
  } else if (m.type === 'newpw') {
    inner = mNewPw();
  } else if (m.type === 'account') {
    inner = `<h3>${t('acc_open')}</h3>${accCard(true)}<div class="foot"><span></span><button type="button" class="btn ghost" data-act="closeModal">${t('cancel')}</button></div>`;
  } else if (m.type === 'hvalue') {
    inner = `<h3>${t('inv_update_title')}</h3><form data-submit="saveHvalue">${field(t('inv_pick'), holdSelect(m.id))}${field(t('inv_cur_value'), '<input id="m_value" inputmode="decimal" data-af autocomplete="off">')}${footBtns()}</form>`;
  }
  return `<div class="backdrop" data-act="backdrop"><div class="modal" role="dialog" aria-modal="true">${inner}</div></div>`;
}

// ---------- отрисовка ----------
function tickClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  try { el.textContent = new Intl.DateTimeFormat(loc(), { timeZone: C.getTz(), weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date()); } catch { el.textContent = ''; }
}
function tickTimer() {
  const el = document.getElementById('shiftTimer');
  if (!el) return;
  const s = Math.max(0, Math.floor((Date.now() - Number(el.dataset.start)) / 1000));
  el.textContent = `${C.pad(Math.floor(s / 3600))}:${C.pad(Math.floor((s % 3600) / 60))}:${C.pad(s % 60)}`;
}
function render() {
  document.documentElement.lang = getLang();
  $app.setAttribute('data-ok', '1');
  const gate = ui.screen !== 'onboarding' && gateOn();
  if (gate) { ui.afterAuth = true; ui.tour = null; if (ui.modal && ui.modal.block) ui.modal = null; }
  // Обязательные окна: новый пароль после письма, код восстановления. Не мешаем анкете, обучению и открытым окнам.
  if (!gate && !ui.modal && !ui.tour && ui.screen !== 'onboarding' && S().profile.onboarded) {
    if (store.cloud.pwRecovery && store.cloud.user) ui.modal = { type: 'newpw', block: true };
    else if (needRecovery()) ui.modal = { type: 'recovery', block: true };
  }
  $app.innerHTML =(ui.screen === 'onboarding' ? vOnboarding() : gate ? vGate() : vMain()) + (ui.modal ? vModal() : '');
  tickClock(); tickTimer();
  const af = $app.querySelector('[data-af]');
  if (af) af.focus({ preventScroll: true });
  bindParallax();
  if (ui.tour) requestAnimationFrame(tourPlace); // экран перерисовался: подсветка и подсказка встают заново на свою кнопку
  if (ui.screen === 'today' && !ui.modal && !ui.tour) mkAuto(); // цены на главном экране подтягиваются сами (с кэшем)
}
const openModal = (type, extra) => { ui.modal = { type, ...extra }; render(); };
const closeModal = () => {
  if (ui.modal && ui.modal.block) return; // обязательные окна (код восстановления, новый пароль) закрываются только по делу
  const m = ui.modal;
  ui.modal = null;
  if (m && m.type === 'whatsnew') { setSeen(APP_VER); render(); setTimeout(greetToday, 250); return; }
  if (m && m.type === 'incomeDone') {
    // Доход разнесён по корзинам: гномы несут удобрение к дереву
    ui.screen = 'today'; ui.anim = { type: 'fertilize', at: Date.now() };
    render(); window.scrollTo(0, 0);
    snd.play('coins'); setTimeout(() => snd.play('grow'), 2900);
    gnomeSay([{ type: 'gardener', text: t('gn_income'), ms: 6500 }]);
    return;
  }
  render();
  setTimeout(() => { if (!ui.modal && !ui.tour) { maybeNews(); checkUpdate(); } }, 400); // окно «Что нового» ждало, пока закроется другое окно
};

// ---------- обучение: подсвечивает кнопки по одной и объясняет, за что каждая отвечает ----------
function tourTarget(s) {
  if (!s.sel) return null;
  let el = document.querySelector(s.sel);
  if (el && s.closest) el = el.closest(s.closest);
  return el;
}
function startTour() {
  ui.modal = null; ui.tour = { i: 0 };
  if (!document.getElementById('tour')) {
    const d = document.createElement('div'); d.id = 'tour'; document.body.appendChild(d);
    d.addEventListener('click', tourClick);
  }
  tourGo(0, 1);
}
// Переходит к шагу i; шаги, у которых на экране нет кнопки (например, нет долгов), пропускаются
function tourGo(i, dir) {
  const tr = ui.tour;
  if (!tr) return;
  let k = i;
  while (k >= 0 && k < TOUR_STEPS.length) {
    const s = TOUR_STEPS[k];
    ui.screen = s.screen; ui.debtTab = s.tab || 'mine'; ui.modal = null;
    render(); window.scrollTo(0, 0);
    const el = tourTarget(s);
    if (!s.sel || el) { tr.i = k; tourShow(s, el); return; }
    k += dir;
  }
  if (dir < 0) tourGo(0, 1); else tourEnd();
}
function tourShow(s, el) {
  const tr = ui.tour;
  const box = document.getElementById('tour');
  if (!tr || !box) return;
  const n = TOUR_STEPS.length;
  const last = tr.i === n - 1;
  box.innerHTML = `<div class="tourShield"></div><div class="tourHole"></div><div class="tourTip" role="dialog" aria-live="polite"><div class="tourBar"><i style="width:${Math.round(((tr.i + 1) / n) * 100)}%"></i></div>
<h4>${esc(t(s.title || `tour_${s.id}_t`))}</h4><p>${esc(t(`tour_${s.id}`))}</p>
<div class="tourBtns">${tr.i > 0 ? `<button class="btn ghost" data-tour="back">${t('tour_back')}</button>` : ''}<button class="btn primary" data-tour="${last ? 'done' : 'next'}">${last ? t('tour_done') : t('tour_next')}</button></div></div>`;
  if (el && !el.closest('.nav')) { try { el.scrollIntoView({ block: 'center' }); } catch (e) { /* ничего */ } }
  requestAnimationFrame(tourPlace);
  setTimeout(tourPlace, 150);
}
function tourPlace() {
  const tr = ui.tour;
  const box = document.getElementById('tour');
  if (!tr || !box) return;
  const hole = box.querySelector('.tourHole');
  const tip = box.querySelector('.tourTip');
  const shield = box.querySelector('.tourShield');
  if (!hole || !tip) return;
  const s = TOUR_STEPS[tr.i];
  const el = tourTarget(s);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let r = null;
  if (el) {
    const b = el.getBoundingClientRect();
    r = { left: b.left, top: b.top, width: b.width, height: b.height };
    if (s.frac) { const [a, c, d, e] = s.frac; r = { left: b.left + b.width * a, top: b.top + b.height * c, width: b.width * (d - a), height: b.height * (e - c) }; }
  }
  if (r) {
    const pad = 6;
    hole.style.display = 'block'; shield.classList.remove('dim');
    const hl = Math.max(4, r.left - pad); const hr = Math.min(vw - 4, r.left + r.width + pad); // не выходим за край экрана
    hole.style.left = `${Math.round(hl)}px`; hole.style.top = `${Math.round(r.top - pad)}px`;
    hole.style.width = `${Math.round(hr - hl)}px`; hole.style.height = `${Math.round(r.height + pad * 2)}px`;
  } else { hole.style.display = 'none'; shield.classList.add('dim'); }
  const pos = tipPosition(r, { w: tip.offsetWidth, h: tip.offsetHeight }, vw, vh);
  tip.style.left = `${Math.round(pos.left)}px`; tip.style.top = `${Math.round(pos.top)}px`;
}
function tourEnd() {
  const box = document.getElementById('tour');
  if (box) box.remove();
  ui.tour = null; ui.debtTab = 'mine'; ui.screen = 'today'; ui.modal = null;
  store.update((s) => { s.profile.tourDone = true; });
  render(); window.scrollTo(0, 0);
  greetToday();
}
function tourClick(e) {
  const b = e.target.closest('[data-tour]');
  const tr = ui.tour;
  if (!b || !tr) return;
  const a = b.dataset.tour;
  if (a === 'next') tourGo(tr.i + 1, 1);
  else if (a === 'back') tourGo(tr.i - 1, -1);
  else if (a === 'done') tourEnd();
}
window.addEventListener('resize', () => { if (ui.tour) tourPlace(); });

// ---------- действия ----------
function finishOnboarding() {
  const pr = norm(ui.draft.profile);
  const debts = ui.draft.debts.map((d) => ({ ...d }));
  const today = C.ymd();
  store.update((s) => {
    // tourDone: false = обучение обязательно: если закрыть приложение посреди него, при следующем запуске оно продолжится
    s.profile = { ...s.profile, ...pr, onboarded: true, modeChangedAt: today, startDate: today, pilotApplied: false, tourDone: false, incomeMode: 'manual' };
    s.debts = debts;
  });
  setLang(S().profile.lang); applyTz();
  try { localStorage.removeItem(OB); } catch { /* ignore */ }
  setSeen(APP_VER); // новичку «Что нового» не нужно
  ui.screen = 'today';
  render();
  if (gateOn()) return; // сначала аккаунт: обучение начнётся сразу после входа (proceedAfterAuth)
  if (S().profile.tourDone) greetToday(); else startTour(); // новичку сначала обучение, приветствие гнома после него
}
function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function exportCsv() {
  const s = S();
  const rows = [['type', 'date', 'amount', 'category_or_source', 'kind', 'note']];
  s.incomes.forEach((i) => rows.push(['income', i.date, i.amount, i.source, '', '']));
  s.expenses.forEach((e) => rows.push(['expense', e.date, e.amount, e.category, e.kind, e.note]));
  s.payments.forEach((p) => { const d = s.debts.find((x) => x.id === p.debtId); rows.push(['debt_payment', p.date, p.amount, d ? d.name : '', '', '']); });
  s.debts.forEach((d) => rows.push(['debt', '', d.balance, d.name, `rate ${d.rate}%`, `min ${d.minPay}, day ${d.day}`]));
  s.shifts.filter((x) => x.end).forEach((x) => rows.push(['shift', x.date, x.amount, `${x.hours} h`, `rate ${x.rate}`, x.paidBy ? 'paid' : 'waiting']));
  s.holdings.forEach((h) => (h.lots || []).forEach((l) => rows.push(['investment', l.date, l.amount, h.name, `${h.type}, ${h.rate}% per year`, l.fromBasket ? 'from basket' : ''])));
  s.transfers.forEach((x) => rows.push(['rollover', x.date, x.amount, `${x.from}->${x.to}`, '', x.month]));
  (s.purchases || []).forEach((p) => rows.push(['purchase', p.date, p.amount, p.name, `from ${p.source}`, '']));
  (s.loans || []).forEach((l) => { rows.push(['loan_given', l.date, l.amount, l.person, `from ${l.source}, rate ${l.rate || 0}%`, l.due ? 'due ' + l.due : '']); (l.repay || []).forEach((r) => rows.push(['loan_repayment', r.date, r.amount, l.person, '', ''])); });
  rows.push(['profile', s.profile.startDate || '', s.profile.incomeType === 'hour' ? s.profile.hourlyRate : s.profile.incomeAmount, s.profile.incomeType, `currency ${s.profile.currency}, mode ${s.profile.mode}`, `cushion at start ${s.profile.cushion || 0}, fun ${s.profile.monthlyFun || 0}`]);
  Object.entries(s.profile.needs || {}).forEach(([k, v]) => rows.push(['profile_need', '', v, k, '', '']));
  s.noSpendDays.forEach((day) => rows.push(['no_spend_day', day, '', '', '', '']));
  s.holdings.forEach((h) => { if (h.currentValue != null) rows.push(['investment_value', h.valueDate || '', h.currentValue, h.name, '', '']); });
  (s.goals || []).forEach((g) => { rows.push(['goal', '', g.target, g.name, g.deadline ? 'deadline ' + g.deadline : '', '']); (g.adds || []).forEach((a) => rows.push(['goal_contribution', a.date, a.amount, g.name, `from ${a.source}`, ''])); });
  (s.reminders || []).forEach((r) => rows.push(['reminder', '', r.amount, r.name, `day ${r.day}`, r.active === false ? 'off' : 'active']));
  const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'tgm-data.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function shiftCal(delta) {
  const [y, m] = ui.cal.month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  ui.cal.month = `${d.getUTCFullYear()}-${C.pad(d.getUTCMonth() + 1)}`;
  render();
}

// Закрывает прошедшие месяцы: непотраченное делится по правилу (по умолчанию 50/50)
function runClosings() {
  if (!S().profile.onboarded) return [];
  const months = C.pendingMonths(S(), C.ymd());
  if (!months.length) return [];
  const shown = [];
  store.update((st) => {
    months.forEach((m) => {
      const r = C.planClosing(st, m);
      st.transfers.push(...r.transfers);
      st.closings.push(r.record);
      if (!r.record.skipped) shown.push(r.record);
    });
  });
  return shown;
}
function checkClosings() {
  if (ui.screen === 'onboarding') return;
  const d = runClosings();
  if (d.length) { ui.modal = { type: 'closing', list: d }; render(); }
}

const actions = {
  // опрос
  pickLang(el) {
    const first = !ui.draft.langPicked;
    ui.draft.profile.lang = el.dataset.v; ui.draft.langPicked = true; setLang(el.dataset.v);
    if (first && ui.step === 0) ui.step = 1; // первый выбор сразу ведёт дальше, на «Назад» язык можно сменить
    saveOb(); render(); window.scrollTo(0, 0);
  },
  pickCur(el) { ui.draft.profile.currency = el.dataset.v; saveOb(); render(); },
  incType(el) { ui.draft.profile.incomeType = el.dataset.v; saveOb(); render(); },
  pickMode(el) { ui.draft.profile.mode = el.dataset.v; saveOb(); render(); },
  addDebtDraft() {
    const r = readDebt('dd_');
    if (r.err) return toast(r.err, true);
    ui.draft.debts.push(r.debt); saveOb(); render();
  },
  rmDebtDraft(el) { ui.draft.debts = ui.draft.debts.filter((d) => d.id !== el.dataset.id); saveOb(); render(); },
  next() {
    const err = validateStep(STEPS[ui.step]);
    if (err) return toast(err, true);
    if (ui.step < STEPS.length - 1) { ui.step += 1; saveOb(); render(); } else finishOnboarding();
  },
  back() { if (ui.step > 0) { ui.step -= 1; saveOb(); render(); } },
  // ---- аккаунт ----
  accTab(el) { ui.acc = { tab: el.dataset.v === 'signin' ? 'signin' : 'signup' }; render(); },
  openAccount() { ui.acc = { tab: 'signin' }; openModal('account'); },
  openPrivacy() { window.open(privacyUrl(), '_blank', 'noopener'); },
  async accSubmit() {
    if (ui.busy) return;
    const mode = val('acc_mode'); const id = val('acc_id'); const pw = val('acc_pw');
    let k = A.checkIdent(id);
    if (k) return toast(t(k), true);
    let hint = '';
    if (mode === 'signup') {
      k = A.checkPassword(pw, id);
      if (k) return toast(t(k), true);
      if (pw !== val('acc_pw2')) return toast(t('err_pw_match'), true);
      const agree = document.getElementById('acc_agree');
      if (!agree || !agree.checked) return toast(t('err_agree'), true);
      hint = val('acc_hint').trim();
      k = A.checkHint(hint, pw);
      if (k) return toast(t(k), true);
    } else if (!pw) return toast(t('err_bad_login'), true);
    ui.busy = true; toast(t('acc_wait'));
    const r = mode === 'signup' ? await store.signUp(id, pw) : await store.signInPw(id, pw);
    ui.busy = false;
    if (r.error) return toast(t(A.authErrorKey(r.error) || 'err_generic'), true);
    A.setLastIdent(id);
    if (mode === 'signup') A.setHint(id, hint);
    if (r.confirm) { ui.acc = { tab: 'signin', sent: A.normIdent(id) }; render(); return; }
    if (ui.modal && ui.modal.type === 'account') { ui.modal = null; render(); }
  },
  async accGoogle() {
    const r = await store.signInGoogle();
    if (r.error) toast(t(A.authErrorKey(r.error) || 'err_generic'), true);
  },
  openForgot() { ui.fg = { method: 'code', ident: val('acc_id') || A.getLastIdent() }; openModal('forgot'); },
  fgMethod(el) { ui.fg = { ...ui.fg, ident: val('fm_id'), method: el.dataset.v === 'answer' ? 'answer' : 'code' }; render(); },
  async fgQuestion() {
    const ident = A.normIdent(val('fm_id'));
    if (A.checkIdent(ident)) return toast(t('err_login'), true);
    const r = await store.fn('question', { ident });
    if (r.error) return toast(t(A.authErrorKey(r.error) || 'err_generic'), true);
    ui.fg = { ...ui.fg, ident, asked: true, question: (r.data && r.data.question) || '' };
    render();
  },
  async fgSubmit() {
    if (ui.busy) return;
    const method = ui.fg.method === 'answer' ? 'answer' : 'code';
    const ident = A.normIdent(val('fm_id')); const secret = val('fm_secret'); const pw = val('fm_pw');
    if (A.checkIdent(ident)) return toast(t('err_login'), true);
    if (method === 'code' && !A.validCode(secret)) return toast(t('err_code'), true);
    if (method === 'answer' && A.normAnswer(secret).length < 4) return toast(t('err_a_short'), true);
    const k = A.checkPassword(pw, ident);
    if (k) return toast(t(k), true);
    ui.busy = true; toast(t('acc_wait'));
    const r = await store.fn('reset', { ident, method, secret, newPassword: pw });
    ui.busy = false;
    if (r.error) return toast(t(A.authErrorKey(r.error) || 'err_generic'), true);
    A.setLastIdent(ident);
    ui.fg = { ...ui.fg, ident, done: true, codeUsed: Boolean(r.data && r.data.codeUsed) };
    render();
  },
  async fgMail() {
    const email = A.normIdent(val('fm_id'));
    if (!A.isEmail(email)) return toast(t('err_email'), true);
    const r = await store.mailReset(email);
    toast(r.error ? t(A.authErrorKey(r.error) || 'err_generic') : t('fg_mail_sent'), Boolean(r.error));
  },
  async rcCopy() {
    const txt = A.formatCode(ui.rc.code || '');
    try { await navigator.clipboard.writeText(txt); toast(t('rc_copied')); } catch {
      // Буфер недоступен (например, файл открыт без https): выделяем код, чтобы скопировать вручную
      const el = document.getElementById('rc_code');
      if (el && window.getSelection) { const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
      toast(t('rc_copy'));
    }
  },
  async rcDone() {
    if (ui.busy) return;
    const ack = document.getElementById('rc_ack');
    if (!ack || !ack.checked) return toast(t('rc_need_ack'), true);
    const body = { code: ui.rc.code };
    const q = val('rc_q').trim(); const a = val('rc_a');
    if (q || a) { const k = A.checkQuestion(q, a); if (k) return toast(t(k), true); body.question = q; body.answer = a; }
    ui.busy = true;
    const r = await store.setRecovery(body);
    ui.busy = false;
    if (r.error) return toast(t(A.authErrorKey(r.error) || 'err_generic'), true);
    ui.rc = {}; ui.modal = null; render(); toast(t('rc_saved'));
    proceedAfterAuth();
  },
  openSecurity() { openModal('security'); if (!store.cloud.recovery) store.refreshRecovery(); },
  secNewCode() { ui.rc = {}; ui.modal = { type: 'recovery', manual: true }; render(); },
  async secEmail() {
    const email = A.normIdent(val('sec_email'));
    if (!A.isEmail(email)) return toast(t('err_email'), true);
    const r = await store.linkEmail(email);
    toast(r.error ? t(A.authErrorKey(r.error) || 'err_generic') : t('sec_email_sent'), Boolean(r.error));
  },
  async secGoogle() {
    const r = await store.linkGoogle();
    if (r.error) toast(t(A.authErrorKey(r.error) || 'err_generic'), true);
  },
  async pwSubmit() {
    if (ui.busy) return;
    const pw = val('np_pw');
    const k = A.checkPassword(pw, A.displayId(store.cloud.user, AUTH_DOMAIN));
    if (k) return toast(t(k), true);
    if (pw !== val('np_pw2')) return toast(t('err_pw_match'), true);
    ui.busy = true;
    const r = await store.changePassword(pw);
    ui.busy = false;
    if (r.error) return toast(t(A.authErrorKey(r.error) || 'err_generic'), true);
    ui.modal = null; render(); toast(t('sec_pw_done'));
  },
  async secQ() {
    const q = val('sq_q').trim(); const a = val('sq_a');
    const k = A.checkQuestion(q, a);
    if (k) return toast(t(k), true);
    const r = await store.setRecovery({ question: q, answer: a });
    if (r.error) return toast(t(A.authErrorKey(r.error) || 'err_generic'), true);
    toast(t('sec_q_saved')); render();
  },
  async secClearQ() {
    const r = await store.setRecovery({ clearQuestion: true });
    if (r.error) return toast(t(A.authErrorKey(r.error) || 'err_generic'), true);
    render();
  },
  secHint() {
    const id = A.displayId(store.cloud.user, AUTH_DOMAIN);
    const h = val('sec_hint').trim();
    A.setHint(id, h);
    toast(t('sec_hint_saved'));
  },
  // навигация и окна
  nav(el) { ui.screen = el.dataset.v; render(); window.scrollTo(0, 0); if (ui.screen === 'invest') maybeRefreshPrices(); },
  goInvest() { ui.screen = 'invest'; ui.modal = null; render(); window.scrollTo(0, 0); maybeRefreshPrices(); },
  openExpense() { openModal('expense'); },
  openIncome() { openModal('income'); },
  openDebt() { openModal('debt'); },
  openPay() { openModal('pay'); },
  openWork() { openModal('work'); },
  openPilot() { openModal('pilot'); },
  openHolding() { openModal('holding'); },
  openHelp(el) { openModal('help', { k: el.dataset.v }); },
  gnomeNext,
  gnomeForced(el) {
    const id = el.dataset.v;
    store.update((s) => { const e = s.expenses.find((x) => x.id === id); if (e) { e.kind = 'need'; e.forced = true; } });
    toast(t('toast_forced')); gnomeNext(); render();
  },
  gnomeWanted() { toast(t('toast_wanted')); gnomeNext(); },
  talkGnome() {
    const lim = C.todayLimit(S(), C.ymd());
    const stage = Math.max(S().progress.stage || 0, C.treeState(S(), C.ymd()).stage);
    const goal = stage >= C.TREE_MAX ? t('tree_max') : t('goal_' + (stage + 1));
    const text = lim.joyBudget <= 0 || lim.over ? tipText() : t('gn_tip', { n: money(lim.left), goal });
    gnomeSay([{ type: 'gardener', text, ms: 9000 }]);
  },
  meetGnomes() {
    ui.screen = 'today'; ui.modal = null; render(); window.scrollTo(0, 0);
    gnomeSay(['gardener', 'grumpy', 'comforter', 'teacher', 'investor'].map((k) => ({ type: k, text: t('gn_meet_' + k) })));
  },
  setGrumpy(el) { store.update((s) => { s.profile.grumpy = el.value !== 'off'; }); render(); },
  setSoundS(el) { store.update((s) => { s.profile.sound = el.value; }); snd.setMode(el.value); snd.unlock(); snd.play('pop'); render(); },
  cycleSound() { const order = ['off', 'fx', 'all']; const next = order[(order.indexOf(S().profile.sound || 'fx') + 1) % 3]; store.update((s) => { s.profile.sound = next; }); snd.setMode(next); snd.unlock(); snd.play('pop'); render(); },
  openTopup(el) { if (S().holdings.length) openModal('topup', { id: el.dataset.id }); },
  openHvalue(el) { if (S().holdings.length) openModal('hvalue', { id: el.dataset.id }); },
  closeModal,
  backdrop(el, e) { if (e.target === el) closeModal(); },
  // календарь
  calPrev() { shiftCal(-1); },
  calNext() { shiftCal(1); },
  calSel(el) { ui.cal.sel = el.dataset.v; render(); },
  calAddExp() { openModal('expense', { date: ui.cal.sel }); },
  calAddInc() { openModal('income', { date: ui.cal.sel }); },
  // траты и доходы
  catKind(el) {
    const want = el.value === 'fun' || el.value === 'shopping';
    if (NEED_CATS.has(el.value) || want) { const r = document.querySelector(`input[name="kind"][value="${want ? 'want' : 'need'}"]`); if (r) r.checked = true; }
  },
  saveExpense() {
    const amount = C.parseMoney(val('m_amount'));
    if (!amount) return toast(t('err_amount'), true);
    const category = CATS.includes(checked('cat')) ? checked('cat') : 'other';
    const kind = checked('kind') === 'want' ? 'want' : 'need';
    const note = val('m_note').trim().slice(0, 120);
    const date = readDate('m_date');
    const editId = val('m_edit');
    if (editId) {
      store.update((s) => { const x = s.expenses.find((y) => y.id === editId); if (x) { x.amount = amount; x.category = category; x.kind = kind; x.note = note; x.date = date; s.noSpendDays = s.noSpendDays.filter((n) => n !== date); } });
      ui.modal = null; render(); toast(t('toast_saved'));
      return;
    }
    const id = uid();
    snd.play('coin');
    store.update((s) => { s.expenses.push({ id, ts: Date.now(), date, amount, category, kind, note }); s.noSpendDays = s.noSpendDays.filter((n) => n !== date); });
    const today = C.ymd();
    const over = kind === 'want' && date === today && C.todayLimit(S(), today).over;
    ui.modal = null; render();
    if (over && grumpyAllowed()) {
      // Вышел за лимит: ворчун, потом утешитель (трата не блокируется и не наказывается)
      store.update((s) => { s.gnome.grumpyDays.push(today); });
      toast(t('toast_saved'));
      gnomeSay([
        { type: 'grumpy', text: t('gn_grumpy_' + (1 + Math.floor(Math.random() * 5))), ms: 3300 },
        { type: 'comforter', text: t('gn_comfort'), buttons: [{ act: 'gnomeForced', v: id, label: t('gn_forced') }, { act: 'gnomeWanted', v: id, label: t('gn_wanted') }] },
      ]);
    } else {
      toast(over ? t('toast_over') : t('toast_saved'), over);
      if (isWaste(category, note)) gnomeSay([{ type: 'gardener', text: t('gn_waste'), ms: 7500 }]);
    }
  },
  fillEarned(el) {
    const a = document.getElementById('m_amount');
    const sel = document.getElementById('m_scope');
    const opt = sel && sel.selectedOptions && sel.selectedOptions[0];
    const amt = opt && opt.dataset.amt ? opt.dataset.amt : el.dataset.v;
    if (a && amt) a.value = String(amt).replace('.', ',');
  },
  saveIncome() {
    const amount = C.parseMoney(val('m_amount'));
    if (!amount) return toast(t('err_amount'), true);
    const source = val('m_source').trim().slice(0, 60) || t('salary');
    const date = readDate('m_date');
    const editId = val('m_edit');
    if (editId) {
      const cur = S().incomes.find((x) => x.id === editId);
      if (cur) {
        let alloc = cur.alloc;
        if (amount !== cur.amount || C.monthOf(date) !== C.monthOf(cur.date)) {
          const rest = { ...S(), incomes: S().incomes.filter((x) => x.id !== editId) };
          alloc = C.allocateIncome(rest, amount, date, C.ymd());
        }
        store.update((s) => { const x = s.incomes.find((y) => y.id === editId); if (x) { x.amount = amount; x.date = date; x.source = source; if (alloc !== cur.alloc && x.assigned) x.assigned = incomeAuto() ? { ...alloc } : {}; x.alloc = alloc; } });
      }
      ui.modal = null; render(); toast(t('toast_saved'));
      return;
    }
    const paidBox = document.getElementById('m_paid');
    const scopeEl = document.getElementById('m_scope');
    const scope = scopeEl && scopeEl.value === 'prev' ? 'prev' : 'all';
    // «за прошлые месяцы» = смены до месяца, в котором стоит дата дохода; смены этого месяца остаются ждать своей выплаты
    const inScope = (x) => x.end && !x.paidBy && (scope === 'all' || C.monthOf(x.date) < C.monthOf(date));
    const unpaid = C.round2(S().shifts.filter(inScope).reduce((a, x) => a + (Number(x.amount) || 0), 0));
    const markPaid = Boolean(paidBox && paidBox.checked && unpaid > 0);
    const alloc = C.allocateIncome(S(), amount, date, C.ymd());
    const id = uid();
    store.update((s) => {
      s.incomes.push({ id, ts: Date.now(), date, amount, source, alloc, assigned: incomeAuto() ? { ...alloc } : {}, done: {} });
      if (markPaid) s.shifts.forEach((x) => { if (inScope(x)) x.paidBy = id; });
    });
    snd.play('whoosh');
    openModal('incomeDone', { id, note: markPaid ? t('expected_vs', { a: money(unpaid), b: money(amount) }) : '' });
  },
  // Деньги пришли в этом месяце, а дата стояла в прошлом: переносим доход на сегодня и заново делим по корзинам
  moveIncomeToday(el) {
    const id = el.dataset.id;
    const cur = S().incomes.find((x) => x.id === id);
    if (!cur) return;
    const today = C.ymd();
    const rest = { ...S(), incomes: S().incomes.filter((x) => x.id !== id) };
    const alloc = C.allocateIncome(rest, cur.amount, today, today);
    store.update((s) => { const x = s.incomes.find((y) => y.id === id); if (x) { x.date = today; x.alloc = alloc; x.done = {}; if (x.assigned) x.assigned = incomeAuto() ? { ...alloc } : {}; } });
    ui.modal = { type: 'incomeDone', id };
    render(); toast(t('inc_moved'));
  },
  toggleDone(el) {
    store.update((s) => { const i = s.incomes.find((x) => x.id === el.dataset.id); if (i) { i.done = i.done || {}; i.done[el.dataset.b] = el.checked; } });
  },
  saveDebt() {
    const r = readDebt('md_');
    if (r.err) return toast(r.err, true);
    store.update((s) => { s.debts.push(r.debt); });
    ui.modal = null; render(); toast(t('toast_saved'));
  },
  savePay() {
    const debt = S().debts.find((d) => d.id === val('m_debt'));
    if (!debt || !(debt.balance > 0)) return toast(t('no_debts_pick'), true);
    const entered = C.parseMoney(val('m_amount'));
    if (!entered) return toast(t('err_amount'), true);
    const amount = Math.min(entered, debt.balance);
    const date = readDate('m_date');
    const from = C.PAY_SOURCES.includes(val('m_from')) ? val('m_from') : 'debts';
    if (from !== 'debts') {
      const have = payAvail(from, date);
      if (amount > have + 0.004) return toast(t('err_pay_short', { a: money(Math.max(0, have)) }), true);
      this.finishPay(debt.id, amount, date, null, from);
      return;
    }
    // Денег в корзине «Долги» не хватает (доход не вписан или забыт): спрашиваем, откуда деньги, и записываем их как доход
    const st = C.basketStats(S(), date).debts;
    const short = C.round2(amount - Math.max(0, C.round2(st.allocated - st.spent)));
    if (short > 0.004) { openModal('paySrc', { debtId: debt.id, amount, date, short }); return; }
    this.finishPay(debt.id, amount, date, null);
  },
  savePaySrc() {
    const m = ui.modal;
    const source = val('m_source').trim().slice(0, 60);
    if (!m || m.type !== 'paySrc') return;
    if (!source) return toast(t('pay_src_need'), true);
    this.finishPay(m.debtId, m.amount, m.date, { source, short: m.short });
  },
  finishPay(debtId, amount, date, inc, source) {
    const debt = S().debts.find((d) => d.id === debtId);
    if (!debt) return;
    store.update((s) => {
      const d = s.debts.find((x) => x.id === debtId);
      if (inc) {
        const alloc = Object.fromEntries(C.BASKETS.map((k) => [k, k === 'debts' ? inc.short : 0]));
        s.incomes.push({ id: uid(), ts: Date.now(), date, amount: inc.short, source: inc.source, alloc, done: { debts: true } });
      }
      d.balance = C.round2(d.balance - amount);
      s.payments.push({ id: uid(), ts: Date.now(), date, debtId: d.id, amount, ...(source && source !== 'debts' ? { source } : {}) });
    });
    const closed = C.round2(debt.balance - amount) <= 0.004;
    if (closed) { ui.anim = { type: 'salute', at: Date.now() }; snd.play('levelup'); }
    ui.modal = null; ui.screen = closed ? 'today' : ui.screen; render(); toast(t('toast_saved'));
    if (closed) gnomeSay([{ type: 'gardener', text: t('gn_debt_closed', { d: debt.name }), ms: 6500 }]);
  },
  noSpend() {
    const d = C.ymd();
    if (S().expenses.some((e) => e.date === d)) return toast(t('nospend_has_exp'), true);
    if (!S().noSpendDays.includes(d)) store.update((s) => { s.noSpendDays.push(d); });
    snd.play('comfort'); render(); toast(t('toast_nospend'));
  },
  delEntry(el) {
    const { k, id } = el.dataset;
    store.update((s) => {
      if (k === 'income') { s.incomes = s.incomes.filter((x) => x.id !== id); s.shifts.forEach((x) => { if (x.paidBy === id) delete x.paidBy; }); }
      else if (k === 'expense') s.expenses = s.expenses.filter((x) => x.id !== id);
      else if (k === 'nospend') s.noSpendDays = s.noSpendDays.filter((x) => x !== id);
      else if (k === 'shift') s.shifts = s.shifts.filter((x) => x.id !== id);
      else if (k === 'payment') {
        const p = s.payments.find((x) => x.id === id);
        if (p) { const d = s.debts.find((x) => x.id === p.debtId); if (d) d.balance = C.round2(d.balance + p.amount); s.payments = s.payments.filter((x) => x.id !== id); }
      }
    });
    render();
  },
  // рабочий день
  startWork() {
    if (S().shifts.some((x) => !x.end)) return;
    store.update((s) => { s.shifts.push({ id: uid(), start: Date.now(), end: null, date: C.ymd(), rate: Number(s.profile.hourlyRate) || 0 }); });
    render();
  },
  endWork() {
    const a = S().shifts.find((x) => !x.end);
    if (!a) return;
    const end = Date.now();
    const hours = Math.max(0.01, C.round2((end - a.start) / 36e5));
    const amount = C.round2(hours * a.rate);
    store.update((s) => { const x = s.shifts.find((y) => y.id === a.id); x.end = end; x.hours = hours; x.amount = amount; });
    render();
    toast(hours > 16 ? t('long_shift_warn') : `+${money(amount)} · ${fmtHours(hours)}`, hours > 16);
  },
  saveWork() {
    const hours = parseHours(val('m_hours'));
    if (!hours) return toast(t('err_hours2'), true);
    const date = readDate('m_date');
    const rate = Number(S().profile.hourlyRate) || 0;
    const editId = val('m_edit');
    if (editId) {
      // правка: меняем день и часы, сумма считается по той ставке, что была у смены
      store.update((s) => { const x = s.shifts.find((y) => y.id === editId); if (x) { x.date = date; x.hours = hours; x.amount = C.round2(hours * (Number(x.rate) || rate)); } });
    } else {
      store.update((s) => { s.shifts.push({ id: uid(), start: null, end: Date.now(), date, hours, rate, amount: C.round2(hours * rate), manual: true }); });
    }
    ui.modal = null; render(); toast(t('toast_saved'));
  },
  editEntry(el) {
    const { k, id } = el.dataset;
    if (k === 'expense') openModal('expense', { edit: id });
    else if (k === 'income') openModal('income', { edit: id });
    else if (k === 'shift') openModal('work', { edit: id });
  },
  // «Мне должны»: займы другим людям
  setDebtTab(el) { ui.debtTab = el.dataset.v === 'owed' ? 'owed' : 'mine'; render(); window.scrollTo(0, 0); },
  openLoan(el) { openModal('loan', { id: el && el.dataset ? el.dataset.id || null : null }); },
  saveLoan() {
    const id = val('m_id');
    const person = val('m_name').trim().slice(0, 60);
    if (!person) return toast(t('err_name'), true);
    const due = val('m_due').trim();
    const rate = C.parseNonNeg(val('m_rate'));
    if (rate === null || rate > 1000) return toast(t('err_pct'), true);
    const note = val('m_note').trim().slice(0, 120);
    if (id) {
      const cur = S().loans.find((x) => x.id === id);
      if (!cur) return;
      if (due && due < cur.date) return toast(t('loan_err_due'), true);
      store.update((s) => { const x = s.loans.find((y) => y.id === id); if (x) { x.person = person; x.due = due || null; x.rate = rate; x.note = note; } });
      ui.modal = null; render(); return toast(t('toast_saved'));
    }
    const amount = C.parseMoney(val('m_amount'));
    if (!amount) return toast(t('err_amount'), true);
    const date = readDate('m_date');
    if (due && due < date) return toast(t('loan_err_due'), true);
    const sv = val('m_src');
    const source = C.LOAN_SOURCES.includes(sv) ? sv : 'own';
    if (source !== 'own') {
      const avail = C.purchaseAvailable(S(), source);
      if (amount > avail) return toast(t('pur_exceeds', { a: money(avail) }), true);
    }
    store.update((s) => { s.loans.push({ id: uid(), person, amount, date, due: due || null, rate, source, note, repay: [] }); });
    ui.modal = null; render(); snd.play('pop'); toast(t('toast_saved'));
  },
  openRepay(el) { openModal('repay', { id: el.dataset.id }); },
  saveRepay() {
    const id = val('m_id');
    const l = S().loans.find((x) => x.id === id);
    if (!l) return;
    const amount = C.parseMoney(val('m_amount'));
    if (!amount) return toast(t('err_amount'), true);
    const date = readDate('m_date');
    const owed = C.loanStats(l, date).owed;
    if (amount > owed + 0.009) return toast(t('loan_over', { a: money(owed) }), true);
    let fin = false;
    store.update((s) => {
      const x = s.loans.find((y) => y.id === id);
      if (!x) return;
      x.repay.push({ id: uid(), date, amount });
      if (C.loanStats(x, date).paid) { x.closed = date; fin = true; }
    });
    ui.modal = null; render(); snd.play(fin ? 'levelup' : 'coin');
    toast(fin ? t('loan_returned') : t('toast_saved'));
  },
  delLoan(el) {
    if (!window.confirm(t('loan_delete_q'))) return;
    store.update((s) => { s.loans = s.loans.filter((x) => x.id !== el.dataset.id); });
    render();
  },
  delRepay(el) {
    store.update((s) => { const l = s.loans.find((x) => x.id === el.dataset.id); if (l) { l.repay = l.repay.filter((r) => r.id !== el.dataset.rep); delete l.closed; } });
    render();
  },
  // цели накоплений
  openGoal(el) { openModal('goal', { id: el && el.dataset ? el.dataset.id || null : null }); },
  saveGoal() {
    const id = val('m_id');
    const name = val('m_name').trim().slice(0, 60);
    if (!name) return toast(t('err_name'), true);
    const target = C.parseMoney(val('m_amount'));
    if (!target) return toast(t('err_amount'), true);
    const dl = val('m_deadline').trim();
    if (dl && dl < C.ymd()) return toast(t('goal_err_deadline'), true);
    store.update((s) => {
      const g = id ? s.goals.find((x) => x.id === id) : null;
      if (g) { g.name = name; g.target = target; g.deadline = dl || null; }
      else s.goals.push({ id: uid(), name, target, deadline: dl || null, adds: [] });
    });
    ui.modal = null; render(); toast(t('toast_saved'));
  },
  openGoalAdd(el) { openModal('goalAdd', { id: el.dataset.id }); },
  saveGoalAdd() {
    const id = val('m_id');
    const g = S().goals.find((x) => x.id === id);
    if (!g) return;
    const amount = C.parseMoney(val('m_amount'));
    if (!amount) return toast(t('err_amount'), true);
    const date = readDate('m_date');
    const source = val('m_src') === 'invest' ? 'invest' : 'own';
    if (source === 'invest') {
      const avail = C.purchaseAvailable(S(), 'invest');
      if (amount > avail) return toast(t('pur_exceeds', { a: money(avail) }), true);
    }
    const wasDone = C.goalStats(g, C.ymd()).done;
    store.update((s) => { const x = s.goals.find((y) => y.id === id); if (x) x.adds.push({ id: uid(), date, amount, source }); });
    const nowDone = C.goalStats(S().goals.find((y) => y.id === id), C.ymd()).done;
    ui.modal = null; render(); snd.play(nowDone && !wasDone ? 'levelup' : 'coin');
    if (nowDone && !wasDone) gnomeSay([{ type: 'gardener', text: t('goal_celebrate', { n: g.name }), ms: 9000 }]);
    else toast(t('toast_saved'));
  },
  delGoal(el) {
    if (!window.confirm(t('goal_delete_q'))) return;
    store.update((s) => { s.goals = s.goals.filter((x) => x.id !== el.dataset.id); });
    render();
  },
  delGoalAdd(el) {
    store.update((s) => { const g = s.goals.find((x) => x.id === el.dataset.id); if (g) g.adds = g.adds.filter((a) => a.id !== el.dataset.add); });
    render();
  },
  // напоминания о платежах
  openReminder() { openModal('reminder'); },
  saveReminder() {
    const name = val('m_name').trim().slice(0, 60);
    if (!name) return toast(t('err_name'), true);
    const amount = C.parseNonNeg(val('m_amount'));
    if (amount === null) return toast(t('err_number'), true);
    const day = parseInt(val('m_day').trim(), 10);
    if (!(day >= 1 && day <= 31)) return toast(t('rem_err_day'), true);
    store.update((s) => { s.reminders.push({ id: uid(), name, amount, day, active: true, paidMonths: [], since: C.ymd() }); });
    ui.modal = null; render(); toast(t('toast_saved'));
  },
  remPaid(el) {
    const mk = C.monthOf(C.ymd());
    store.update((s) => { const r = s.reminders.find((x) => x.id === el.dataset.id); if (r) { r.paidMonths = r.paidMonths || []; if (!r.paidMonths.includes(mk)) r.paidMonths.push(mk); } });
    snd.play('coin'); render(); toast(t('toast_saved'));
  },
  delReminder(el) {
    if (!window.confirm(t('rem_delete_q'))) return;
    store.update((s) => { s.reminders = s.reminders.filter((x) => x.id !== el.dataset.id); });
    render();
  },
  // гном-учитель
  openTeacher() { const p = teacherPick(false) || teacherPick(true); openModal('teacher', { id: p ? p.item.id : null }); },
  teacherShow(el) { gnomeNext(); openModal('teacher', { id: el.dataset.v }); },
  teacherOpen(el) {
    const it = LIBRARY.find((x) => x.id === el.dataset.id);
    if (!it || !/^https:\/\//.test(it.url)) return;
    teacherMarkSeen(it.id);
    try { window.open(it.url, '_blank', 'noopener,noreferrer'); } catch (e) { /* ничего */ }
  },
  teacherNext(el) {
    teacherMarkSeen(el.dataset.id);
    const p = teacherPick(false);
    ui.modal = { type: 'teacher', id: p ? p.item.id : null }; render();
  },
  startTour() { startTour(); },
  checkUpdateNow() { checkUpdate(true); },
  openNews() { ui.modal = { type: 'whatsnew', seen: '' }; render(); },
  // рынок
  openMarket() { ui.screen = 'market'; mk.q = ''; render(); window.scrollTo(0, 0); mkOpenLoad(); },
  openLearn() { ui.learnFrom = ui.screen === 'market' ? 'market' : 'more'; ui.screen = 'learn'; render(); window.scrollTo(0, 0); },
  learnBack() { if (ui.learnFrom === 'market') actions.openMarket(); else { ui.screen = 'more'; render(); window.scrollTo(0, 0); } },
  mktTab(el) { ui.mktTab = ['stocks', 'metals'].includes(el.dataset.v) ? el.dataset.v : 'crypto'; mk.q = ''; render(); mkOpenLoad(); },
  mktRefresh() {
    toast(t('mkt_loading')); mk.failTs = 0;
    if (ui.mktTab === 'stocks') { const have = mkSyms().filter((s) => mk.stocks[s]).slice(0, P.STOCK_BATCH); mkLoadStocks(have.length ? have : mkSyms(), true); } else if (ui.mktTab === 'metals') { mkLoad('metals', true); mkLoad('fx', true); } else mkLoad('crypto', true);
  },
  mktMore() { mk.failTs = 0; mkLoadStocks(mkSyms().filter((s) => !mkFresh(mk.stocks[s], MK_TTL.stocks)), false); },
  mktAddTicker() {
    const s = P.cleanTicker(val('mkt_t'));
    if (!s) return toast(t('err_name'), true);
    const w = P.getWatch();
    if (!P.STOCK_PRESET.includes(s) && !w.includes(s)) { w.unshift(s); P.setWatch(w); }
    mk.q = ''; delete mk.stocks[s]; mkLoadStocks([s], true); mkPaint();
    const i = document.getElementById('mkt_t'); if (i) i.value = '';
  },
  mktDelTicker(el) { P.setWatch(P.getWatch().filter((x) => x !== el.dataset.v)); mkPaint(); },
  mktSaveKey() {
    const k = val('mkt_key').trim();
    if (!k) return toast(t('err_name'), true);
    P.setTdKey(k); toast(t('mkt_key_saved')); mk.failTs = 0; render(); mkLoadStocks(mkSyms(), true);
  },
  // итог недели
  openWeek() { openModal('week'); },
  weekDone() {
    const end = C.lastWeekEnd(C.ymd());
    store.update((s) => { s.progress.weekSeen = end; });
    ui.modal = null; render();
  },
  // крупная покупка из подушки или корзины инвестиций
  openPurchase() { openModal('purchase'); },
  savePurchase() {
    const name = val('m_name').trim().slice(0, 60);
    if (!name) return toast(t('err_name'), true);
    const amount = C.parseMoney(val('m_amount'));
    if (!amount) return toast(t('err_amount'), true);
    const date = readDate('m_date');
    const source = val('m_src') === 'invest' ? 'invest' : 'cushion';
    const avail = C.purchaseAvailable(S(), source);
    if (amount > avail) return toast(t('pur_exceeds', { a: money(avail) }), true);
    store.update((s) => { s.purchases.push({ id: uid(), ts: Date.now(), date, name, amount, source }); });
    const months = C.cushionMonths(S(), C.ymd());
    ui.modal = null; render(); snd.play('pop');
    if (source === 'cushion' && months != null && months < 3) toast(t('pur_low', { n: monthsFmt(months) }), true);
    else toast(t('toast_saved'));
  },
  delPurchase(el) {
    if (!window.confirm(t('pur_delete_q'))) return;
    store.update((s) => { s.purchases = s.purchases.filter((p) => p.id !== el.dataset.id); });
    render();
  },
  // расходы и доход: правка с историей по месяцам
  openBudget() { openModal('budget'); },
  saveBudget() {
    const needs = {};
    for (const k of [...C.NEED_KEYS, 'foodWeek']) {
      const v = C.parseNonNeg(val('b_' + k));
      if (v === null) return toast(t('err_number'), true);
      needs[k] = v;
    }
    const ch = { needs };
    let rate = null;
    if (S().profile.incomeType === 'hour') {
      rate = C.parseMoney(val('b_rate'));
      const est = C.parseNonNeg(val('b_est'));
      if (!rate) return toast(t('err_rate'), true);
      if (est === null) return toast(t('err_number'), true);
      ch.incomeEstimate = est;
    } else {
      const inc = C.parseMoney(val('b_inc'));
      if (!inc) return toast(t('err_amount'), true);
      ch.incomeAmount = inc;
    }
    const sel = document.getElementById('b_from');
    const mode = sel && sel.value === 'now' ? 'now' : 'next';
    store.update((s) => { C.applyBudgetChange(s, ch, mode, C.ymd()); if (rate) s.profile.hourlyRate = rate; });
    ui.modal = null; render(); toast(t('toast_saved'));
  },
  // пилот
  applyPilot() {
    store.update((s) => {
      const sm = C.pilotSummary(s, C.ymd());
      sm.rows.forEach((r) => { if (r.actual > 0) s.profile.needs[r.key] = r.actual; });
      if (sm.foodWeekActual > 0) s.profile.needs.foodWeek = sm.foodWeekActual;
      if (sm.wantsMonth > 0) s.profile.monthlyFun = sm.wantsMonth;
      s.profile.pilotApplied = true;
    });
    ui.modal = null; render(); toast(t('pilot_done'));
  },
  // вложения
  saveHolding() {
    const name = val('m_name').trim().slice(0, 60);
    if (!name) return toast(t('err_name'), true);
    const type = C.HOLD_TYPES.includes(checked('hty')) ? checked('hty') : 'other';
    const amount = C.parseMoney(val('m_amount'));
    if (!amount) return toast(t('err_amount'), true);
    const rate = C.parseNonNeg(val('m_rate'));
    if (rate === null || rate > 1000) return toast(t('err_pct'), true);
    const date = readDate('m_date');
    const fromBasket = Boolean(document.getElementById('m_fb') && document.getElementById('m_fb').checked);
    if (fromBasket && amount > C.investAvailable(S())) return toast(t('inv_exceeds', { a: money(Math.max(0, C.investAvailable(S()))) }), true);
    store.update((s) => { s.holdings.push({ id: uid(), name, type, rate, lots: [{ date, amount, fromBasket }] }); });
    ui.modal = null; render(); toast(t('toast_saved'));
  },
  saveTopup() {
    const amount = C.parseMoney(val('m_amount'));
    if (!amount) return toast(t('err_amount'), true);
    const id = val('m_hold');
    const date = readDate('m_date');
    const fromBasket = Boolean(document.getElementById('m_fb') && document.getElementById('m_fb').checked);
    if (fromBasket && amount > C.investAvailable(S())) return toast(t('inv_exceeds', { a: money(Math.max(0, C.investAvailable(S()))) }), true);
    store.update((s) => { const h = s.holdings.find((x) => x.id === id); if (h) h.lots.push({ date, amount, fromBasket }); });
    ui.modal = null; render(); toast(t('toast_saved'));
  },
  saveHvalue() {
    const v = C.parseNonNeg(val('m_value'));
    if (v === null || String(val('m_value')).trim() === '') return toast(t('err_amount'), true);
    const id = val('m_hold');
    store.update((s) => { const h = s.holdings.find((x) => x.id === id); if (h) { h.currentValue = v; h.valueDate = C.ymd(); } });
    ui.modal = null; render(); toast(t('toast_saved'));
  },
  openLive(el) { openModal('live', { id: el.dataset.id }); },
  refreshPrices() { refreshLive(false); },
  async saveLive() {
    const id = val('m_id');
    const kind = val('m_kind');
    if (!S().holdings.some((x) => x.id === id)) return;
    if (kind !== 'crypto' && kind !== 'stock') {
      store.update((s) => { const x = s.holdings.find((y) => y.id === id); if (x) delete x.live; });
      ui.modal = null; render(); return toast(t('live_off'));
    }
    const units = Number(String(val('m_units')).replace(/\s/g, '').replace(',', '.'));
    if (!(units > 0 && units < 1e12)) return toast(t('err_amount'), true);
    const q = val('m_live').trim();
    if (!q) return toast(t('err_name'), true);
    const cur = S().profile.currency;
    toast(t('px_loading'));
    try {
      let live;
      if (kind === 'crypto') {
        const found = await P.searchCrypto(q);
        if (!found.length) return toast(t('live_notfound'), true);
        const c = found[0];
        const prices = await P.cryptoPrices([c.id], cur);
        if (!(prices[c.id] > 0)) return toast(t('px_fail'), true);
        live = { kind, id: c.id, name: `${c.name} (${c.symbol})`, units: Math.round(units * 1e8) / 1e8, price: prices[c.id], priceAt: Date.now(), cur };
      } else {
        const keyNew = val('m_tdkey').trim();
        if (keyNew) P.setTdKey(keyNew);
        const key = P.getTdKey();
        if (!key) return toast(t('px_key_need'), true);
        const sym = q.toUpperCase();
        const price = await P.stockPrice(sym, key, cur);
        live = { kind, id: sym, name: sym, units: Math.round(units * 1e8) / 1e8, price, priceAt: Date.now(), cur };
      }
      store.update((s) => { const x = s.holdings.find((y) => y.id === id); if (x) x.live = live; });
      ui.modal = null; render(); toast(t('live_linked', { n: live.name }));
    } catch (e) { toast(t('px_fail'), true); }
  },
  delHolding(el) {
    if (!window.confirm(t('inv_delete_q'))) return;
    store.update((s) => { s.holdings = s.holdings.filter((h) => h.id !== el.dataset.id); });
    render();
  },
  // настройки
  setLangS(el) { store.update((s) => { s.profile.lang = el.value; }); setLang(el.value); render(); },
  setCur(el) { store.update((s) => { s.profile.currency = el.value; }); render(); },
  setModeS(el) {
    if (modeLeft() > 0) return;
    store.update((s) => { s.profile.mode = el.value; s.profile.modeChangedAt = C.ymd(); });
    render();
  },
  setTheme(el) { store.update((s) => { s.theme = el.value === 'light' ? 'light' : 'dark'; }); applyTheme(); render(); },
  setTzS(el) { store.update((s) => { s.profile.tz = el.value; }); applyTz(); render(); },
  setRollover(el) { store.update((s) => { s.profile.rolloverRule = ['split', 'joy', 'priority'].includes(el.value) ? el.value : 'split'; }); render(); },
  // ---- «Не распределено» ----
  toggleAssign(el) {
    store.update((s) => { const i = s.incomes.find((x) => x.id === el.dataset.id); if (i && i.assigned) i.assigned[el.dataset.b] = el.checked ? (Number(i.alloc[el.dataset.b]) || 0) : 0; });
    render();
  },
  assignAllPlan(el) {
    store.update((s) => { const i = s.incomes.find((x) => x.id === el.dataset.id); if (i && i.assigned) i.assigned = { ...i.alloc }; });
    render();
  },
  openAllocate() { openModal('allocate'); },
  allocFillPlan() {
    const pool = C.unallocTotal(S());
    const pc = C.plan(S(), C.ymd());
    const parts = C.splitAmount(Math.max(0, pool), pc);
    C.BASKETS.forEach((k) => { const el = document.getElementById('al_' + k); if (el) el.value = parts[k] > 0 ? String(parts[k]).replace('.', ',') : ''; });
    allocLive();
  },
  saveAllocate() {
    const parts = {};
    C.BASKETS.forEach((k) => { const v = C.parseNonNeg(val('al_' + k)); if (v === null) parts.__bad = true; else parts[k] = v; });
    if (parts.__bad) return toast(t('err_amount'), true);
    const r = C.planAllocation(S(), parts, C.ymd());
    if (r.error === 'empty') return toast(t('err_alloc_empty'), true);
    if (r.error === 'too_much') return toast(t('err_alloc_much', { a: money(r.pool) }), true);
    store.update((s) => { r.transfers.forEach((x) => s.transfers.push({ id: uid(), ts: Date.now(), ...x })); });
    snd.play('coins'); ui.modal = null; render(); toast(t('toast_alloc'));
  },
  setIncomeMode(el) { store.update((s) => { s.profile.incomeMode = el.value === 'manual' ? 'manual' : 'auto'; }); render(); },
  setPayDay(el) { const n = Number(el.value); store.update((s) => { if (n >= 1 && n <= 31) s.profile.payDay = n; else delete s.profile.payDay; }); render(); },
  setPushPref(el) { const k = el.dataset.k; if (!PUSH_KINDS.includes(k)) return; store.update((s) => { s.profile.push = { ...(s.profile.push || {}), [k]: el.checked }; }); },
  async enablePush() {
    if (!store.cloud.user) return toast(t('nf_need_account'), true);
    const r = await pushSubscribe(VAPID_PUBLIC);
    if (r.error) { toast(t(r.error === 'denied' ? 'nf_denied' : r.error === 'unsupported' ? 'nf_unsupported' : 'nf_failed'), true); ui.pushInfo = null; return render(); }
    const k = r.sub.keys || {};
    const res = await store.fn('subscribe', { endpoint: r.sub.endpoint, p256dh: k.p256dh, auth: k.auth }, 'tgm-push');
    if (res.error) { await pushUnsubscribe(); toast(t('nf_server'), true); ui.pushInfo = null; return render(); }
    ui.pushInfo = null; toast(t('nf_on')); render();
  },
  async disablePush() {
    const endpoint = await pushUnsubscribe();
    if (endpoint) await store.fn('unsubscribe', { endpoint }, 'tgm-push');
    ui.pushInfo = null; toast(t('nf_off')); render();
  },
  async testPush() {
    const res = await store.fn('test', {}, 'tgm-push');
    toast(res.error ? t('nf_server') : t('nf_sent'), Boolean(res.error));
  },
  exportCsv,
  async wipe() {
    if (!window.confirm(t('set_delete_q'))) return;
    await store.wipe();
    location.reload();
  },
  async signOut() {
    try { const ep = await pushUnsubscribe(); if (ep) await store.fn('unsubscribe', { endpoint: ep }, 'tgm-push'); } catch { /* не мешаем выходу */ }
    const r = await store.signOut(false);
    if (r && r.unsynced) { if (!window.confirm(t('so_unsynced'))) return; await store.signOut(true); }
    location.reload();
  },
};

document.addEventListener('click', (e) => {
  snd.unlock();
  if (e.target.closest('.btn, .opt, .nav button, .day, .chips label, .x, .help, .gbtn, .buddy, .sndbtn')) snd.play('tap');
  const el = e.target.closest('[data-act]');
  if (el && actions[el.dataset.act]) actions[el.dataset.act](el, e);
});
document.addEventListener('submit', (e) => {
  e.preventDefault();
  const a = e.target.dataset.submit;
  if (a && actions[a]) actions[a](e.target, e);
});
document.addEventListener('change', (e) => {
  const a = e.target.dataset && e.target.dataset.change;
  if (a && actions[a]) actions[a](e.target, e);
});
document.addEventListener('input', (e) => {
  const b = e.target.dataset && e.target.dataset.bind;
  if (b && ui.screen === 'onboarding') { setPath(ui.draft.profile, b, e.target.value); saveOb(); }
  if (e.target.dataset && e.target.dataset.live === 'alloc') allocLive();
  if (e.target.id === 'mkt_q') { mk.q = e.target.value; mkList(); } // поиск по рынку: обновляем только список, чтобы не терять ввод
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.modal) closeModal();
  if (e.key === 'Enter' && ui.screen === 'onboarding' && e.target.tagName === 'INPUT' && !e.target.closest('form')) { e.preventDefault(); actions.next(); }
});

store.subscribe((reason) => {
  if (reason === 'local') { setTimeout(notifyGrowth, 0); return; }
  if (ui.screen === 'onboarding' && S().profile.onboarded) {
    ui.screen = 'today'; ui.modal = null; setLang(S().profile.lang); applyTheme(); applyTz();
    try { localStorage.removeItem(OB); } catch { /* ignore */ }
    render(); return;
  }
  if (ui.screen === 'onboarding') { if (STEPS[ui.step] === 'auth') render(); return; }
  if (ui.modal) return;
  setLang(S().profile.lang); applyTheme(); applyTz(); render();
  checkClosings();
  proceedAfterAuth();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (!ui.modal && !ui.tour) store.refresh(); // вернулись в приложение: подтягиваем правки с других устройств
  if (!ui.modal) checkClosings();
  checkUpdate();
});

// ---------- запуск ----------
// Слабый телефон (мало памяти или 2 ядра): постоянные анимации сцены выключаются классом lite. ?lite=1 включает, ?lite=0 выключает для проверки.
try {
  const lq = new URLSearchParams(location.search).get('lite');
  const lite = lq === '1' ? true : lq === '0' ? false : !!((navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2));
  if (lite) document.documentElement.classList.add('lite');
} catch (e) { /* ничего */ }
makeNoise(); snd.setMode(S().profile.sound);
mkInit(); // последние цены рынка из кэша, чтобы окно на главном экране не было пустым
// Тем, кто уже пользуется приложением, обучение не навязываем (его можно позвать в «Ещё»)
if (S().profile.onboarded && S().profile.tourDone === undefined) store.update((s) => { s.profile.tourDone = true; });
applyTheme(); applyTz();
if (!S().profile.onboarded) { ui.screen = 'onboarding'; loadOb(); setLang(ui.draft.profile.lang); } else {
  setLang(S().profile.lang);
  const closed = runClosings();
  if (closed.length) ui.modal = { type: 'closing', list: closed };
  // Стадию, достигнутую до обновления, фиксируем молча, без салюта
  const ts0 = C.treeState(S(), C.ymd());
  if (ts0.stage > (S().progress.stage || 0)) store.update((s) => { s.progress.stage = ts0.stage; });
}
const gbox = document.createElement('div');
gbox.id = 'gnomeBox';
document.body.appendChild(gbox);
render();
if (store.cloud.enabled && REQUIRE_ACCOUNT && S().profile.onboarded) ui.afterAuth = true; // сначала вход, потом обучение или приветствие (proceedAfterAuth)
else {
  if (S().profile.onboarded && S().profile.tourDone === false) startTour(); // обучение не закончено: продолжаем с начала
  greetToday();
}
loadAssets();
setInterval(tickClock, 15000);
setTimeout(checkUpdate, 2500); setInterval(checkUpdate, 20 * 60 * 1000);
setInterval(tickTimer, 1000);
store.init();
// Сервис-воркер есть не везде (файл с телефона, закрытые просмотрщики): без него приложение работает так же
try {
  if ('serviceWorker' in navigator) {
    if (location.protocol === 'https:') navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
    else {
      // На своём компьютере и по Wi-Fi сервис-воркер не нужен: убираем старые, чтобы не показывались прошлые версии
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      if (window.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
    }
  }
} catch { /* ignore */ }
