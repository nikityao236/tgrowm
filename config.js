// Настройки облака. Пока строки пустые, приложение работает локально (данные только на этом телефоне), вход не требуется.
// Чтобы включить вход и облако, пройди инструкцию ОБЛАКО-инструкция.md (около 40 минут):
// 1. Создай бесплатный проект на supabase.com.
// 2. В SQL Editor выполни файл supabase-setup.sql и разверни функцию из supabase/functions/tgm-recovery.
// 3. Project Settings → API: скопируй Project URL и anon public key и вставь сюда САМ.
//    (anon-ключ публичный по задумке, защита данных делается правилами в базе. Секретный service_role сюда НЕ вставлять никогда.)
export const SUPABASE_URL = 'https://pjhizbzmtmghhqtnvflv.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqaGl6YnptdG1naGhxdG52Zmx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NjMyMjYsImV4cCI6MjExMDMzOTIyNn0.BUlQZO1Y9tJjRUdhMzegni_AXIiDB6NYTUzK9_uUYiI';
// Требовать аккаунт после анкеты (работает только когда облако подключено). false: вход необязателен.
export const REQUIRE_ACCOUNT = true;
// Адрес сайта с политикой конфиденциальности, например 'https://togrowmoney.com/'. Пусто: ссылка относительная (работает, когда приложение открыто с сайта).
export const SITE_URL = 'https://tgrowm.online/';
// Скрытый домен для логинов без почты. Должен совпадать с секретом AUTH_DOMAIN у функции tgm-recovery.
// Если Supabase отвергает такой адрес при регистрации, замени на домен, которым владеешь (письма на него не отправляются).
export const AUTH_DOMAIN = 'login.tgm-app.example';
// Публичный ключ для push-уведомлений (VAPID). Парный секретный ключ лежит только в настройках Supabase.
export const VAPID_PUBLIC = 'BHJZi8QFGF25KVL0BiNAloJdu36iUKvot9LMPUDVPPShxjimIVTzwCDOShNRebn-29JjfswYWs3tOAeMYByvFrs';
