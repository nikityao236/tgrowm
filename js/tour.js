// Обучение после первичной анкеты: по шагам подсвечивает кнопки и рассказывает, за что каждая отвечает.
// Здесь только данные шагов и расчёт места для подсказки (чистые функции). Показ на экране делает js/app.js.
// Шаг: { id, screen, sel? (CSS-селектор цели), closest? (подняться к родителю), title? (ключ перевода), frac? ([x0,y0,x1,y1] доли цели), tab? ('owed' на вкладке «Долги») }
// Текст шага лежит в переводе по ключу `tour_<id>`, заголовок по `title` или `tour_<id>_t`. Если цели нет на экране (например, нет долгов), шаг пропускается.
export const TOUR_STEPS = [
  { id: 'welcome', screen: 'today' },
  // Экран «Сегодня»
  { id: 'tree', screen: 'today', sel: '.sceneArt', title: 'tour_tree_t', frac: [0, 0, 1, 0.64] },
  { id: 'sign', screen: 'today', sel: '.sign', title: 'today_can' },
  { id: 'jars', screen: 'today', sel: '.sceneArt', title: 'tour_jars_t', frac: [0, 0.64, 1, 1] },
  { id: 'buddy', screen: 'today', sel: '.buddy', title: 'tour_buddy_t' },
  { id: 'sound', screen: 'today', sel: '.sndbtn', title: 'set_sound' },
  { id: 'stage', screen: 'today', sel: '.card.stagebox', title: 'tour_stage_t' },
  { id: 'expense', screen: 'today', sel: 'main .actions [data-act="openExpense"]', title: 'btn_expense' },
  { id: 'income', screen: 'today', sel: 'main .actions [data-act="openIncome"]', title: 'btn_income' },
  { id: 'nospend', screen: 'today', sel: 'main .actions [data-act="noSpend"]', title: 'btn_nospend' },
  { id: 'capital', screen: 'today', sel: '.card.capital', title: 'cap_title' },
  { id: 'work', screen: 'today', sel: '.card.work', title: 'tour_work_t' },
  { id: 'pilot', screen: 'today', sel: '.card.pilot', title: 'pilot_title' },
  { id: 'market', screen: 'today', sel: '.card.market', title: 'mkt_title' },
  { id: 'recent', screen: 'today', sel: 'main > section.card:last-of-type', title: 'recent' },
  // Календарь
  { id: 'cal', screen: 'calendar', sel: '.nav button[data-v="calendar"]', title: 'nav_calendar' },
  { id: 'months', screen: 'calendar', sel: '.calnav', title: 'tour_months_t' },
  { id: 'day', screen: 'calendar', sel: '.cal', title: 'tour_day_t' },
  { id: 'dayadd', screen: 'calendar', sel: 'main .actions', title: 'tour_dayadd_t' },
  // Корзины
  { id: 'baskets', screen: 'baskets', sel: '.nav button[data-v="baskets"]', title: 'nav_baskets' },
  { id: 'bcard', screen: 'baskets', sel: '.card.basket', title: 'tour_bcard_t' },
  { id: 'help', screen: 'baskets', sel: '.card.basket .help', title: 'tour_help_t' },
  { id: 'purchase', screen: 'baskets', sel: '[data-act="openPurchase"]', title: 'pur_add' },
  // Долги
  { id: 'debts', screen: 'debts', sel: '.nav button[data-v="debts"]', title: 'nav_debts' },
  { id: 'seg', screen: 'debts', sel: '.seg', title: 'tour_seg_t' },
  { id: 'debt', screen: 'debts', sel: '[data-act="openDebt"]', title: 'd_add' },
  { id: 'pay', screen: 'debts', sel: '[data-act="openPay"]', title: 'pay' },
  { id: 'loan', screen: 'debts', tab: 'owed', sel: '[data-act="openLoan"]:not([data-id])', title: 'loan_add' },
  // Ещё
  { id: 'more', screen: 'more', sel: '.nav button[data-v="more"]', title: 'nav_more' },
  { id: 'gnomes', screen: 'more', sel: '[data-act="meetGnomes"]', title: 'set_meet' },
  { id: 'invest', screen: 'more', sel: '[data-act="goInvest"]', title: 'invest_title' },
  { id: 'pilotbtn', screen: 'more', sel: '[data-act="openPilot"]', title: 'pilot_btn' },
  { id: 'week', screen: 'more', sel: '[data-act="openWeek"]', title: 'wk_title' },
  { id: 'teacher', screen: 'more', sel: '[data-act="openTeacher"]', title: 'tch_btn' },
  { id: 'goals', screen: 'more', sel: '[data-act="nav"][data-v="goals"]', title: 'goals_title' },
  { id: 'rems', screen: 'more', sel: '[data-act="nav"][data-v="reminders"]', title: 'rem_title' },
  { id: 'learn', screen: 'more', sel: '[data-act="openLearn"]', title: 'learn_title' },
  { id: 'budget', screen: 'more', sel: '[data-act="openBudget"]', title: 'bud_title' },
  { id: 'settings', screen: 'more', sel: '#s_lang', closest: '.field', title: 'set_title' },
  { id: 'export', screen: 'more', sel: '[data-act="exportCsv"]', title: 'set_export' },
  { id: 'wipe', screen: 'more', sel: '[data-act="wipe"]', title: 'set_delete' },
  { id: 'finish', screen: 'today' },
];

// Куда поставить подсказку. r: прямоугольник цели { left, top, width, height } или null (тогда по центру),
// tip: { w, h } размер подсказки, vw/vh: размер экрана. Подсказка под целью, а если там нет места, над ней.
export function tipPosition(r, tip, vw, vh, gap = 14, margin = 12) {
  const clampX = (x) => Math.max(margin, Math.min(x, vw - tip.w - margin));
  const clampY = (y) => Math.max(margin, Math.min(y, vh - tip.h - margin));
  if (!r) return { left: clampX((vw - tip.w) / 2), top: clampY((vh - tip.h) / 2) };
  const below = vh - (r.top + r.height);
  const above = r.top;
  let top;
  if (below >= tip.h + gap + margin) top = r.top + r.height + gap;
  else if (above >= tip.h + gap + margin) top = r.top - gap - tip.h;
  else top = below >= above ? vh - tip.h - margin : margin; // цель очень большая: к краю с большим запасом
  return { left: clampX(r.left + r.width / 2 - tip.w / 2), top: clampY(top) };
}
