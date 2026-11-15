// Хранилище: всегда сохраняет локально, а если облако подключено и человек вошёл, синхронизирует с Supabase.
import { SUPABASE_URL, SUPABASE_ANON_KEY, AUTH_DOMAIN } from '../config.js?v=0.9.1';
import { ymd } from './calc.js?v=0.9.1';
import { identToEmail, normIdent, isEmail } from './auth.js?v=0.9.1';

const LS = 'tgm_state_v1';
const SUPABASE_ESM = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const listeners = new Set();
let client = null;
let pushTimer = null;

function guessLang() {
  const l = (navigator.language || 'en').slice(0, 2);
  return ['ru', 'en', 'pl', 'es'].includes(l) ? l : 'en';
}

export function defaults() {
  return {
    version: 1,
    updatedAt: 0,
    theme: 'dark',
    profile: {
      lang: guessLang(), currency: 'PLN', mode: null, modeChangedAt: null, onboarded: false,
      incomeType: 'month', incomeAmount: 0, hourlyRate: 0, incomeEstimate: 0,
      needs: { home: 0, utilities: 0, transport: 0, comm: 0, health: 0, other: 0, foodWeek: 0 },
      monthlyFun: 0, wasteText: '', cushion: 0,
      startDate: null, tz: detectTz(), pilotApplied: false, rolloverRule: 'split', grumpy: true, sound: 'fx',
    },
    progress: { stage: 0 }, gnome: { grumpyDays: [] },
    debts: [], incomes: [], expenses: [], payments: [], noSpendDays: [], shifts: [], holdings: [], closings: [], transfers: [], purchases: [], goals: [], reminders: [], loans: [],
  };
}

function detectTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

// Собирает состояние и переносит данные из старых версий (этап 1) в новую форму
function merge(d, s) {
  const out = { ...d, ...s, profile: { ...d.profile, ...(s.profile || {}) } };
  const p = out.profile;
  const sp = s.profile || {};
  const legacyNeeds = Number(sp.monthlyNeeds) || 0;
  p.needs = { ...d.profile.needs, ...(sp.needs || (legacyNeeds ? { other: legacyNeeds } : {})) };
  if (p.incomeType === 'hour' && !sp.hourlyRate) {
    p.hourlyRate = Number(sp.incomeAmount) || 0;
    if (!p.incomeEstimate && sp.hoursPerWeek) p.incomeEstimate = Math.round((p.hourlyRate * sp.hoursPerWeek * 52) / 12);
  }
  if (!p.tz) p.tz = detectTz();
  if (!Array.isArray(out.shifts)) out.shifts = [];
  if (!Array.isArray(out.holdings)) out.holdings = [];
  if (!Array.isArray(out.closings)) out.closings = [];
  if (!Array.isArray(out.transfers)) out.transfers = [];
  if (!Array.isArray(p.timeline)) p.timeline = [];
  if (!Array.isArray(out.purchases)) out.purchases = [];
  if (!Array.isArray(out.goals)) out.goals = [];
  if (!Array.isArray(out.reminders)) out.reminders = [];
  if (!Array.isArray(out.loans)) out.loans = [];
  if (!p.rolloverRule) p.rolloverRule = 'split';
  if (p.grumpy === undefined) p.grumpy = true;
  if (!['off', 'fx', 'all'].includes(p.sound)) p.sound = 'fx';
  if (!out.progress || typeof out.progress.stage !== 'number') out.progress = { stage: 0 };
  if (!out.gnome || !Array.isArray(out.gnome.grumpyDays)) out.gnome = { grumpyDays: [] };
  if (p.onboarded && !p.startDate) {
    const dates = [...out.incomes, ...out.expenses, ...out.payments].map((x) => x.date).filter(Boolean).sort();
    p.startDate = dates[0] || ymd();
  }
  return out;
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) return merge(defaults(), JSON.parse(raw));
  } catch { /* повреждённые данные: начинаем с чистого листа */ }
  return defaults();
}

function writeLocal() {
  try { localStorage.setItem(LS, JSON.stringify(store.state)); } catch { /* память переполнена или запрещена */ }
}

function notify(reason) { listeners.forEach((fn) => fn(reason)); }
// Чьи данные лежат на телефоне: id аккаунта, с которым их в последний раз синхронизировали
const OWNER_LS = 'tgm_owner';
function ownerRead() { try { return localStorage.getItem(OWNER_LS) || ''; } catch { return ''; } }
function ownerWrite(id) { try { localStorage.setItem(OWNER_LS, id); } catch { /* ничего */ } }

async function pull() {
  try {
    const { data, error } = await client.from('tgm_state').select('data,updated_at').eq('user_id', store.cloud.user.id).maybeSingle();
    if (error) throw error;
    const local = store.state;
    const uid = store.cloud.user.id;
    // Данные на телефоне могли принадлежать другому аккаунту (или никому, если их вели до входа). Если в облаке этого аккаунта уже что-то есть,
    // а телефон его ещё не синхронизировал, берём облако: чужие данные не должны перезаписать чужой аккаунт.
    const foreign = ownerRead() !== uid;
    if (data && data.data && (foreign || (data.data.updatedAt || 0) > (local.updatedAt || 0))) {
      // Старую локальную копию сохраняем про запас
      if (local.updatedAt) { try { localStorage.setItem(LS + '_backup', JSON.stringify(local)); } catch { /* ignore */ } }
      store.replace(data.data);
      ownerWrite(uid);
      store.cloud.status = 'synced';
      return;
    }
    await push();
  } catch { store.cloud.status = 'pending'; }
}

async function push() {
  if (!client || !store.cloud.user) return;
  if (!navigator.onLine) { store.cloud.status = 'pending'; notify('cloud'); return; }
  try {
    const { error } = await client.from('tgm_state').upsert({
      user_id: store.cloud.user.id, data: store.state, updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    ownerWrite(store.cloud.user.id);
    store.cloud.status = 'synced';
  } catch { store.cloud.status = 'pending'; }
  notify('cloud');
}

function schedulePush() {
  if (!client || !store.cloud.user) return;
  store.cloud.status = 'pending';
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 1000);
}

async function setUser(u) {
  const changed = (store.cloud.user && store.cloud.user.id) !== (u && u.id);
  store.cloud.user = u;
  if (changed) store.cloud.recovery = null;
  if (u && changed) { await pull(); store.refreshRecovery(); }
  notify('cloud');
}

export const store = {
  state: readLocal(),
  // ready: облако уже ответило, вошёл человек или нет. recovery: { code, question } с сервера (есть ли код восстановления). pwRecovery: человек пришёл по письму «сбросить пароль».
  cloud: { enabled: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY), user: null, status: 'local', ready: false, recovery: null, pwRecovery: false },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  update(fn) {
    fn(this.state);
    this.state.updatedAt = Date.now();
    writeLocal();
    notify('local');
    schedulePush();
  },
  replace(s) {
    this.state = merge(defaults(), s);
    writeLocal();
    notify('remote');
  },
  async init() {
    window.addEventListener('online', () => push());
    if (!this.cloud.enabled) { this.cloud.ready = true; return; }
    try {
      const { createClient } = await import(SUPABASE_ESM);
      client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      const { data } = await client.auth.getSession();
      await setUser((data.session && data.session.user) || null);
      this.cloud.ready = true;
      notify('cloud');
      // Не ждём запросы к Supabase внутри самого колбэка, иначе возможна взаимоблокировка
      client.auth.onAuthStateChange((ev, session) => {
        if (ev === 'PASSWORD_RECOVERY') { this.cloud.pwRecovery = true; }
        setTimeout(() => setUser((session && session.user) || null), 0);
      });
    } catch {
      this.cloud.status = 'error';
      this.cloud.enabled = false;
      this.cloud.ready = true;
      notify('cloud');
    }
  },
  // Для тестов: подставить поддельного клиента облака вместо настоящего
  _useClient(c) { client = c; this.cloud.enabled = Boolean(c); this.cloud.ready = true; },
  // Вызов серверной функции tgm-recovery. Возвращает { data } или { error: { code, status } }; код ошибки приходит с сервера
  async fn(action, body = {}) {
    if (!client) return { error: { code: 'cloud_off', message: 'cloud off' } };
    try {
      const { data, error } = await client.functions.invoke('tgm-recovery', { body: { action, ...body } });
      if (error) {
        let info = {};
        try { info = await error.context.json(); } catch { /* тела нет: сеть или функция не развёрнута */ }
        return { error: { code: info.error || 'generic', message: error.message, status: error.context && error.context.status } };
      }
      if (data && data.error) return { error: { code: data.error } };
      return { data: data || {} };
    } catch (e) { return { error: { code: 'generic', message: String(e && e.message || e) } }; }
  },
  // Регистрация. Почта: Supabase шлёт письмо подтверждения (confirm: true, пока человек не нажмёт ссылку). Логин: аккаунт создаёт серверная функция без письма.
  async signUp(ident, password) {
    if (!client) return { error: { code: 'cloud_off' } };
    const id = normIdent(ident);
    if (isEmail(id)) {
      const { data, error } = await client.auth.signUp({ email: id, password, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) return { error };
      return { confirm: !(data && data.session) };
    }
    const r = await this.fn('register', { ident: id, password });
    if (r.error) return r;
    return this.signInPw(id, password);
  },
  async signInPw(ident, password) {
    if (!client) return { error: { code: 'cloud_off' } };
    const { error } = await client.auth.signInWithPassword({ email: identToEmail(ident, AUTH_DOMAIN), password });
    return error ? { error } : { ok: true };
  },
  async signInGoogle() {
    if (!client) return { error: { code: 'cloud_off' } };
    const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    return error ? { error } : { ok: true };
  },
  async linkGoogle() {
    if (!client) return { error: { code: 'cloud_off' } };
    const { error } = await client.auth.linkIdentity({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    return error ? { error } : { ok: true };
  },
  // Привязать почту к аккаунту: на новый адрес придёт письмо подтверждения
  async linkEmail(email) {
    if (!client) return { error: { code: 'cloud_off' } };
    const { error } = await client.auth.updateUser({ email: normIdent(email) }, { emailRedirectTo: location.origin + location.pathname });
    return error ? { error } : { ok: true };
  },
  async changePassword(password) {
    if (!client) return { error: { code: 'cloud_off' } };
    const { error } = await client.auth.updateUser({ password });
    if (!error) this.cloud.pwRecovery = false;
    return error ? { error } : { ok: true };
  },
  async mailReset(email) {
    if (!client) return { error: { code: 'cloud_off' } };
    const { error } = await client.auth.resetPasswordForEmail(normIdent(email), { redirectTo: location.origin + location.pathname });
    return error ? { error } : { ok: true };
  },
  // Есть ли у аккаунта код восстановления и вопрос (спрашиваем у сервера, результат кладём в cloud.recovery)
  async refreshRecovery() {
    if (!client || !this.cloud.user) return;
    const r = await this.fn('status');
    // Если функция не развёрнута, не пристаём к человеку с кодом, который всё равно не сохранить
    this.cloud.recovery = r.data ? { code: Boolean(r.data.code), question: r.data.question || null } : { code: true, question: null, unavailable: true };
    notify('cloud');
  },
  async setRecovery(body) {
    const r = await this.fn('set', body);
    if (!r.error) await this.refreshRecovery();
    return r;
  },
  // Выход. Сначала отправляем в облако всё, что не успело уйти. Если не вышло, возвращаем { unsynced: true } (force: true выходит всё равно).
  // После выхода данные этого аккаунта с телефона убираются: они в облаке, а следующий вход не должен с ними смешаться.
  async signOut(force = false) {
    if (client && this.cloud.user) {
      clearTimeout(pushTimer);
      await push();
      if (this.cloud.status !== 'synced' && !force) return { unsynced: true };
    }
    if (client) { try { await client.auth.signOut(); } catch { /* ignore */ } }
    this.cloud.user = null;
    this.cloud.recovery = null;
    this.cloud.status = 'local';
    try { localStorage.removeItem(LS); localStorage.removeItem(LS + '_backup'); localStorage.removeItem(OWNER_LS); localStorage.removeItem('tgm_ob'); } catch { /* ignore */ }
    this.state = defaults();
    notify('cloud');
    return { ok: true };
  },
  // Полное удаление данных человека (в облаке и на телефоне), включая сам аккаунт
  async wipe() {
    if (client && this.cloud.user) {
      try { await client.from('tgm_state').delete().eq('user_id', this.cloud.user.id); } catch { /* ignore */ }
      try { await this.fn('delete'); } catch { /* функция не развёрнута: данные уже стёрты */ }
      try { await client.auth.signOut(); } catch { /* ignore */ }
    }
    // На телефоне стираем всё, что связано с аккаунтом: данные, метку владельца, подсказки и последний логин
    try { ['tgm_ob', LS + '_backup', LS, OWNER_LS, 'tgm_last_ident', 'tgm_hint_v1'].forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
    this.state = defaults();
  },
};
