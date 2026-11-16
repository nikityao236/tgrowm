// Push-уведомления на стороне телефона: разрешение, подписка, отписка. Саму отправку делает серверная функция tgm-push.
export const pushSupported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window;

export function keyBytes(b64url) {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob((b64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// { supported, permission: 'default'|'granted'|'denied', subscribed }
export async function pushInfo() {
  if (!pushSupported()) return { supported: false, permission: 'denied', subscribed: false };
  let subscribed = false;
  try { const reg = await navigator.serviceWorker.getRegistration(); subscribed = Boolean(reg && (await reg.pushManager.getSubscription())); } catch { /* нет воркера */ }
  return { supported: true, permission: Notification.permission, subscribed };
}

// Спрашивает разрешение и подписывает телефон. Возвращает { sub } (JSON подписки) или { error: 'unsupported' | 'denied' | 'failed' }
export async function pushSubscribe(vapidPublic) {
  if (!pushSupported()) return { error: 'unsupported' };
  try {
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') return { error: 'denied' };
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublic) }));
    return { sub: sub.toJSON() };
  } catch (e) { return { error: 'failed', message: String((e && e.message) || e) }; }
}

// Отписывает телефон, возвращает адрес подписки (чтобы сервер её удалил) или ''
export async function pushUnsubscribe() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (!sub) return '';
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    return endpoint;
  } catch { return ''; }
}