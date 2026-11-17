// Список изменений по версиям: показывается в окне «Что нового» при первом запуске после обновления.
// Новые версии добавляй В НАЧАЛО списка. v: номер версии, date: ГГГГ-ММ-ДД, items: по языкам короткие пункты простыми словами.
export const CHANGELOG = [
  {
    v: '0.9.10', date: '2026-11-17',
    items: {
      ru: ['Автообновление: приложение само проверяет, вышла ли новая версия, и обновляется, когда ты его открываешь. Принудительно проверить можно в «Ещё», кнопка «Проверить обновления».'],
      en: ['Auto-update: the app checks for a new version by itself and updates when you open it. You can check manually in "More", "Check for updates".'],
      pl: ['Automatyczna aktualizacja: aplikacja sama sprawdza, czy jest nowa wersja, i aktualizuje się po otwarciu. Ręcznie sprawdzisz w „Więcej”, „Sprawdź aktualizacje”.'],
      es: ['Actualización automática: la app busca sola una versión nueva y se actualiza al abrirla. Puedes comprobarlo a mano en «Más», «Buscar actualizaciones».'],
    },
  },  {
    v: '0.9.9', date: '2026-11-17',
    items: {
      ru: [
        'Новая корзина «Не распределено»: деньги, которые пришли, но ты ещё не решил, куда их положить, ждут там и видны в капитале. Ничего больше не теряется по дороге.',
        'Новый доход: отметь галочкой, что куда пошло. Всё неотмеченное остаётся в «Не распределено». Кнопка «Всё по плану» ставит все галочки сразу.',
        'Распределить вручную: сам выбираешь, в какой горшок и сколько. Само ничего не разложится.',
        'Долг можно платить из любой корзины: при оплате выбери «Откуда платить».',
        'В «Ещё», «Новый доход» можно выбрать, делить доход сразу по плану (как раньше) или оставлять в «Не распределено». У новых пользователей по умолчанию ручной режим.',
      ],
      en: [
        'New jar "Unallocated": money that has arrived but that you have not assigned yet waits there and counts in your capital. Nothing gets lost on the way.',
        'New income: tick where it goes. Whatever you leave unticked stays in "Unallocated". The "All by plan" button ticks everything at once.',
        'Allocate manually: you choose which jar and how much. Nothing is split by itself.',
        'You can pay a debt from any jar: choose "Pay from" when you make the payment.',
        'In "More", "New income" you can choose to split income by plan right away (as before) or keep it in "Unallocated". New users start in manual mode.',
      ],
      pl: [
        'Nowy słoik „Nierozdzielone”: pieniądze, które wpłynęły, ale jeszcze ich nie przypisałeś, czekają tam i liczą się w kapitale. Nic nie ginie po drodze.',
        'Nowy przychód: zaznacz, dokąd trafia. Czego nie zaznaczysz, zostaje w „Nierozdzielone”. Przycisk „Wszystko wg planu” zaznacza wszystko naraz.',
        'Rozdziel ręcznie: sam wybierasz słoik i kwotę. Nic nie dzieli się samo.',
        'Dług możesz spłacić z dowolnego słoika: przy płatności wybierz „Skąd zapłacić”.',
        'W „Więcej”, „Nowy przychód” wybierzesz, czy dzielić od razu wg planu (jak dotąd), czy zostawiać w „Nierozdzielone”. Nowi użytkownicy zaczynają w trybie ręcznym.',
      ],
      es: [
        'Nuevo tarro «Sin asignar»: el dinero que ha llegado y que aún no asignaste espera allí y cuenta en tu capital. Nada se pierde por el camino.',
        'Ingreso nuevo: marca adónde va. Lo que no marques se queda en «Sin asignar». El botón «Todo según el plan» marca todo de golpe.',
        'Repartir a mano: tú eliges el tarro y la cantidad. Nada se reparte solo.',
        'Puedes pagar una deuda desde cualquier tarro: al pagar elige «Pagar desde».',
        'En «Más», «Ingreso nuevo» puedes elegir repartir al instante según el plan (como antes) o dejarlo en «Sin asignar». Los usuarios nuevos empiezan en modo manual.',
      ],
    },
  },  {
    v: '0.9.8', date: '2026-11-16',
    items: {
      ru: [
        'Забыл внести зарплату или трату? Внеси позже, с нужной датой: закрытые месяцы пересчитаются сами, и деньги не потеряются.',
        'Закрытие месяца стало честнее: остаток «Долгов» не пропадает, перерасход переносится на следующий месяц, а деньги по плану, которых не было, больше не переносятся.',
        'В окне закрытия месяца видно, сколько отложено на долги и сколько перерасхода перенесено.',
      ],
      en: [
        'Forgot to log a salary or an expense? Add it later with the right date: closed months recalculate by themselves and no money gets lost.',
        'Month closing is more honest: leftover Debts money no longer disappears, overspending carries into the next month, and planned money that never arrived is no longer carried over.',
        'The month-closing window now shows how much was set aside for debts and how much overspending was carried.',
      ],
      pl: [
        'Zapomniałeś wpisać wypłatę lub wydatek? Dodaj później z właściwą datą: zamknięte miesiące przeliczą się same i pieniądze nie zginą.',
        'Zamykanie miesiąca jest uczciwsze: reszta w „Długach” nie znika, przekroczenie przechodzi na następny miesiąc, a planowane pieniądze, które nie wpłynęły, nie są już przenoszone.',
        'W oknie zamknięcia miesiąca widać, ile odłożono na długi i ile przekroczenia przeniesiono.',
      ],
      es: [
        '¿Olvidaste anotar un sueldo o un gasto? Añádelo después con la fecha correcta: los meses cerrados se recalculan solos y no se pierde dinero.',
        'El cierre de mes es más honesto: lo que sobra en Deudas ya no desaparece, el gasto de más pasa al mes siguiente y el dinero previsto que nunca llegó ya no se traslada.',
        'La ventana de cierre muestra cuánto se reservó para deudas y cuánto gasto de más se trasladó.',
      ],
    },
  },  {
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
