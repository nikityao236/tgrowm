// Список изменений по версиям: показывается в окне «Что нового» при первом запуске после обновления.
// Новые версии добавляй В НАЧАЛО списка. v: номер версии, date: ГГГГ-ММ-ДД, items: по языкам короткие пункты простыми словами.
export const CHANGELOG = [
  {
    v: '0.9.7', date: '2026-11-16',
    items: {
      ru: ['Окно «Что нового»: после обновления приложение само расскажет, что изменилось. Открыть его снова можно в «Ещё».'],
      en: ['"What\'s new" window: after an update the app tells you what changed. You can reopen it in "More".'],
      pl: ['Okno „Co nowego”: po aktualizacji aplikacja sama opowie, co się zmieniło. Otworzysz je ponownie w „Więcej”.'],
      es: ['Ventana «Novedades»: tras una actualización la app te cuenta qué cambió. Puedes abrirla de nuevo en «Más».'],
    },
  },
  {
    v: '0.9.6', date: '2026-11-16',
    items: {
      ru: [
        'Общий капитал на главном экране: все горшки плюс «мне должны» минус долги. Нажми «По горшкам», чтобы увидеть, сколько в каждом.',
        'День зарплаты: приложение подсказывает, когда ждать деньги, и напоминает, если зарплата задерживается. Число можно задать в «Ещё».',
        'Цель «Закрыть долги»: полоса прогресса и примерный срок, когда долги закончатся.',
        'Лимит до воскресенья: сколько ещё можно потратить на «Радость», чтобы один дорогой день не ломал всю неделю.',
        'Push-уведомления (в «Ещё»): про зарплату, про траты вечером, про платежи за день до срока и итог недели.',
        'Первый месяц теперь тоже закрывается: остатки не пропадают 1-го числа.',
        'Исправлено: платёж по долгу больше суммы в горшке «Долги» больше не завышает капитал.',
      ],
      en: [
        'Total capital on the main screen: all jars plus money owed to you minus debts. Tap "By jar" to see each one.',
        'Payday: the app shows when money is expected and reminds you if your salary is late. You can set the day in "More".',
        'Goal "Pay off debts": a progress bar and an estimate of when you will be debt-free.',
        'Limit until Sunday: how much more you can spend on Joy, so one expensive day does not break the whole week.',
        'Push notifications (in "More"): salary, evening spending log, payments a day before they are due, and the weekly summary.',
        'The first month is now closed too: leftovers no longer vanish on the 1st.',
        'Fixed: a debt payment larger than the Debts jar no longer inflates your capital.',
      ],
      pl: [
        'Kapitał ogółem na głównym ekranie: wszystkie słoiki plus należności minus długi. Dotknij „Wg słoików”, by zobaczyć każdy z nich.',
        'Dzień wypłaty: aplikacja podpowiada, kiedy czekać na pieniądze, i przypomina, gdy wypłata się spóźnia. Dzień ustawisz w „Więcej”.',
        'Cel „Spłać długi”: pasek postępu i szacowany termin, kiedy długi znikną.',
        'Limit do niedzieli: ile jeszcze możesz wydać na „Radość”, żeby jeden drogi dzień nie zepsuł całego tygodnia.',
        'Powiadomienia push (w „Więcej”): o wypłacie, o wydatkach wieczorem, o płatnościach dzień wcześniej i podsumowanie tygodnia.',
        'Pierwszy miesiąc też się zamyka: reszta nie znika 1. dnia.',
        'Naprawiono: spłata długu większa niż kwota w słoiku „Długi” nie zawyża już kapitału.',
      ],
      es: [
        'Capital total en la pantalla principal: todos los tarros más lo que te deben menos las deudas. Toca «Por tarro» para ver cada uno.',
        'Día de cobro: la app indica cuándo esperar el dinero y avisa si el sueldo se retrasa. Puedes fijar el día en «Más».',
        'Meta «Liquidar las deudas»: barra de progreso y fecha estimada en que te quedarás sin deudas.',
        'Límite hasta el domingo: cuánto más puedes gastar en Alegría, para que un día caro no arruine toda la semana.',
        'Notificaciones push (en «Más»): sueldo, gastos por la tarde, pagos un día antes y resumen semanal.',
        'El primer mes también se cierra: lo que sobra ya no desaparece el día 1.',
        'Corregido: un pago de deuda mayor que el tarro «Deudas» ya no infla tu capital.',
      ],
    },
  },
  {
    v: '0.9.3', date: '2026-11-15',
    items: {
      ru: [
        'Проверка всех функций и синхронизации: правки с двух телефонов больше не затирают друг друга, а при плохой сети отправка повторяется сама.',
        'Исправлены: проценты в сумме давали 99%, «день без трат» можно было поставить при тратах, ложное «просрочено» у новых платежей, суммы вида «1,234.56», неполный CSV.',
      ],
      en: [
        'Full check of every feature and sync: edits from two phones no longer overwrite each other, and sending retries by itself on a bad connection.',
        'Fixed: percentages added up to 99%, "no-spend day" could be set despite spending, false "overdue" on new payments, amounts like "1,234.56", incomplete CSV.',
      ],
      pl: [
        'Pełne sprawdzenie funkcji i synchronizacji: zmiany z dwóch telefonów już się nie nadpisują, a przy słabym zasięgu wysyłka ponawia się sama.',
        'Naprawiono: procenty dawały razem 99%, „dzień bez wydatków” dało się ustawić mimo wydatków, fałszywe „po terminie” przy nowych płatnościach, kwoty typu „1,234.56”, niepełny CSV.',
      ],
      es: [
        'Revisión completa de funciones y sincronización: los cambios de dos teléfonos ya no se pisan y, con mala conexión, el envío se repite solo.',
        'Corregido: los porcentajes sumaban 99%, se podía marcar «día sin gastos» habiendo gastado, falso «vencido» en pagos nuevos, importes como «1,234.56», CSV incompleto.',
      ],
    },
  },
  {
    v: '0.9.2', date: '2026-11-14',
    items: {
      ru: ['Почасовая работа: часы можно добавить за выбранный день, смены можно править, а в карточке видно «Заработано за прошлый месяц» и «в этом месяце».', 'Выплата за прошлые месяцы отмечается отдельно от текущего месяца.'],
      en: ['Hourly work: add hours for any day, edit shifts, and see "Earned last month" and "this month" on the card.', 'Payout for previous months is marked separately from the current month.'],
      pl: ['Praca godzinowa: godziny można dodać za wybrany dzień, zmiany można edytować, a na karcie widać „Zarobione w zeszłym miesiącu” i „w tym miesiącu”.', 'Wypłata za poprzednie miesiące jest oznaczana osobno od bieżącego miesiąca.'],
      es: ['Trabajo por horas: añade horas de cualquier día, edita turnos y ve «Ganado el mes pasado» y «este mes» en la tarjeta.', 'El pago de meses anteriores se marca aparte del mes actual.'],
    },
  },
];

const vnum = (v) => String(v || '0').split('.').map((x) => Number(x) || 0);
export function cmpVersion(a, b) {
  const x = vnum(a); const y = vnum(b);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1; }
  return 0;
}
// Что показать: записи новее версии, которую человек уже видел. Если не видел ничего, две последние. Остальное (до 2 записей) идёт в «Раньше».
export function newsFor(seen, list = CHANGELOG) {
  const fresh = seen ? list.filter((e) => cmpVersion(e.v, seen) > 0) : list.slice(0, 2);
  const shown = fresh.length ? fresh : list.slice(0, 1);
  const older = list.filter((e) => !shown.includes(e)).slice(0, 2);
  return { shown, older };
}
