// Правила входа без облака: логин или почта, пароль, код восстановления, секретный вопрос, подсказка.
// Здесь только чистые функции (их проверяют тесты). Запросы к Supabase делает js/store.js, а проверку кода и сброс пароля делает серверная функция supabase/functions/tgm-recovery.
// Пароль нигде не хранится и не логируется: он живёт в поле ввода и уходит на сервер входа Supabase по защищённому каналу.

// Для логина без почты Supabase всё равно требует адрес: делаем скрытый вида логин@домен. Письма на него не уходят.
// Домен должен совпадать с тем, что в серверной функции (AUTH_DOMAIN). Меняется в config.js.
export const DEFAULT_DOMAIN = 'login.tgm-app.example';

export const LOGIN_RE = /^[a-z0-9][a-z0-9._-]{2,23}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PW_MIN = 8;
export const PW_MAX = 72; // у bcrypt в Supabase предел 72 байта
const COMMON = ['12345678', '123456789', '1234567890', '87654321', 'password', 'password1', 'qwertyui', 'qwerty123', 'qwertyuiop', '11111111', '00000000', 'iloveyou', 'abc12345', '1q2w3e4r', 'йцукенгш', 'пароль12'];

export const normIdent = (s) => String(s ?? '').normalize('NFKC').trim().toLowerCase();
export const isEmail = (s) => EMAIL_RE.test(normIdent(s));

// Ошибка проверки: ключ перевода или '' если всё хорошо
export function checkIdent(s) {
  const v = normIdent(s);
  if (isEmail(v)) return v.length <= 254 ? '' : 'err_login';
  return LOGIN_RE.test(v) ? '' : 'err_login';
}

export function checkPassword(pw, ident = '') {
  const p = String(pw ?? '');
  if (p.length < PW_MIN) return 'err_pw_short';
  if (new TextEncoder().encode(p).length > PW_MAX) return 'err_pw_long';
  if (/^(.)\1+$/.test(p) || COMMON.includes(p.toLowerCase())) return 'err_pw_weak';
  const id = normIdent(ident);
  if (id && (p.toLowerCase() === id || p.toLowerCase() === id.split('@')[0])) return 'err_pw_same';
  return '';
}

// Адрес, под которым человек известен Supabase: настоящая почта как есть, а логин превращается в скрытый адрес
export function identToEmail(ident, domain = DEFAULT_DOMAIN) {
  const v = normIdent(ident);
  return isEmail(v) ? v : `${v}@${domain}`;
}
export const isHiddenEmail = (email, domain = DEFAULT_DOMAIN) => normIdent(email).endsWith('@' + domain);
// Как показывать человека в приложении: логин или почта
export function displayId(user, domain = DEFAULT_DOMAIN) {
  if (!user) return '';
  const m = user.user_metadata && user.user_metadata.login;
  const e = normIdent(user.email);
  if (isHiddenEmail(e, domain)) return m || e.slice(0, e.length - domain.length - 1);
  return user.email || m || '';
}
// Вошёл ли человек паролем (а не только через Google)
export function hasPassword(user) {
  const prov = (user && user.app_metadata && user.app_metadata.providers) || [];
  return !user || prov.length === 0 || prov.includes('email');
}
export const hasRealEmail = (user, domain = DEFAULT_DOMAIN) => Boolean(user && user.email && !isHiddenEmail(user.email, domain));
export const hasGoogle = (user) => Boolean(user && user.app_metadata && (user.app_metadata.providers || []).includes('google'));

// ---------- код восстановления ----------
// 31 знак без похожих (нет 0, O, 1, I, L): 16 знаков дают около 79 бит случайности, угадать нельзя
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LEN = 16;
export function randomBytes(n) {
  const c = globalThis.crypto;
  if (!c || !c.getRandomValues) throw new Error('no crypto');
  return c.getRandomValues(new Uint8Array(n));
}
// rand(n) → Uint8Array случайных байтов (подмена для тестов). Отбрасываем «хвост» байтов, чтобы знаки выпадали равномерно.
export function makeRecoveryCode(rand = randomBytes) {
  const lim = 256 - (256 % CODE_ALPHABET.length);
  let out = '';
  while (out.length < CODE_LEN) {
    for (const b of rand(32)) { if (b < lim && out.length < CODE_LEN) out += CODE_ALPHABET[b % CODE_ALPHABET.length]; }
  }
  return out;
}
export const formatCode = (c) => String(c).replace(/(.{4})(?=.)/g, '$1-');
export const normCode = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const validCode = (s) => { const c = normCode(s); return c.length === CODE_LEN && [...c].every((ch) => CODE_ALPHABET.includes(ch)); };

// ---------- секретный вопрос ----------
// Ответ сравниваем без регистра, пробелов и знаков: «Рекс!» и «рекс» дают один результат
export const normAnswer = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export function checkQuestion(q, a) {
  const qq = String(q ?? '').trim();
  if (qq.length < 8 || qq.length > 80) return 'err_q_len';
  const na = normAnswer(a);
  if (na.length < 4) return 'err_a_short';
  if (normAnswer(qq).includes(na)) return 'err_a_in_q';
  return '';
}

// ---------- подсказка к паролю: только на этом телефоне ----------
const HINT_LS = 'tgm_hint_v1';
export function getHint(ident) {
  try { const m = JSON.parse(localStorage.getItem(HINT_LS)) || {}; return m[normIdent(ident)] || ''; } catch { return ''; }
}
export function setHint(ident, hint) {
  try {
    const m = JSON.parse(localStorage.getItem(HINT_LS)) || {};
    const k = normIdent(ident);
    if (hint) m[k] = String(hint).slice(0, 80); else delete m[k];
    localStorage.setItem(HINT_LS, JSON.stringify(m));
    return true;
  } catch { return false; }
}
// Последний логин на этом телефоне: подставляем на экран входа
const LAST_LS = 'tgm_last_ident';
export function getLastIdent() { try { return localStorage.getItem(LAST_LS) || ''; } catch { return ''; } }
export function setLastIdent(ident) { try { if (ident) localStorage.setItem(LAST_LS, normIdent(ident)); else localStorage.removeItem(LAST_LS); } catch { /* ничего */ } }
// Подсказка не должна выдавать пароль
export function checkHint(hint, pw) {
  const h = normAnswer(hint); const p = normAnswer(pw);
  if (!h) return '';
  return p.length >= 4 && h.includes(p) ? 'err_hint_leak' : '';
}

// ---------- ошибки облака → ключи перевода ----------
export function authErrorKey(err) {
  if (!err) return '';
  const msg = String(err.message || err.msg || err.error_description || err.error || err).toLowerCase();
  const code = String(err.code || err.error_code || '').toLowerCase();
  const st = Number(err.status) || 0;
  const SERVER = { taken: 'err_taken', rate: 'err_rate', locked: 'fg_locked', bad: 'fg_bad', login: 'err_login', password: 'err_pw_weak', auth: 'err_bad_login' }; // коды нашей серверной функции
  if (SERVER[code]) return SERVER[code];
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) return 'err_bad_login';
  if (code === 'email_not_confirmed' || msg.includes('not confirmed')) return 'err_unconfirmed';
  if (code === 'user_already_exists' || code === 'email_exists' || msg.includes('already registered') || msg.includes('already been registered') || msg.includes('taken')) return 'err_taken';
  if (code === 'weak_password' || msg.includes('weak')) return 'err_pw_weak';
  if (st === 429 || code.includes('rate_limit') || msg.includes('rate limit') || msg.includes('too many')) return 'err_rate';
  if (code === 'locked' || msg.includes('locked')) return 'fg_locked';
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed') || st === 0 && msg.includes('fetch')) return 'err_net';
  if (code === 'email_address_invalid' || msg.includes('invalid email') || msg.includes('email address') && msg.includes('invalid')) return 'err_email';
  return 'err_generic';
}
