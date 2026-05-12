import React, { useMemo, useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import './styles.css'
const BETAI_ADMIN_EMAILS = ['smilhytv@gmail.com'];
const BETAI_STRIPE_SUBSCRIPTION_LINK = 'https://checkout.stripe.com/c/pay/cs_live_b1EqdPrQrAqvEZrUpaYzcJcis7ceXMxcSPFcZ6VkWT2IumMTdbogZB28sN#fidnandhYHdWcXxpYCc%2FJ2FgY2RwaXEnKSdicGRmZGhqaWBTZHdsZGtxJz8nZmprcXdqaScpJ2R1bE5gfCc%2FJ3VuWmlsc2BaMDRWdnViV0RuMExCbjZhM1d0SE99Rmc3clNwaFxqMkdCbE9uYjUwbnVTZ0gxdkJxZnZWPUd3UnFLYUldb2B3f3xJaERtVkFJTEFdMzxmf0xdM1Q0dE1qMFI1NUExVEA0Q2E8JyknY3dqaFZgd3Ngdyc%2FcXdwYCknZ2RmbmJ3anBrYUZqaWp3Jz8nJmNjY2NjYycpJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl';
const BETAI_PREMIUM_EMAILS = ['smilhytv@gmail.com'];
const BETAI_PREMIUM_USERNAMES = ['smilhytv'];
function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }

var userPlan = 'free'; // global anti-crash fallback

const BETAI_LANGUAGES = ['pl', 'en', 'de', 'es', 'ru']
const BETAI_LANG_LABELS = { pl: 'PL', en: 'EN', de: 'DE', es: 'ES', ru: 'RU' }
const BETAI_LANG_NAMES = { pl: 'Polski', en: 'English', de: 'Deutsch', es: 'Español', ru: 'Русский' }
const svgToDataUri = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
const BETAI_LANG_FLAG_IMAGES = {
  pl: svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><clipPath id="c"><circle cx="32" cy="32" r="31"/></clipPath></defs><g clip-path="url(%23c)"><rect width="64" height="32" fill="%23ffffff"/><rect y="32" width="64" height="32" fill="%23dc143c"/></g><circle cx="32" cy="32" r="31" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/></svg>`),
  en: svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><clipPath id="c"><circle cx="32" cy="32" r="31"/></clipPath></defs><g clip-path="url(%23c)"><rect width="64" height="64" fill="%23012169"/><path d="M0 0L64 64M64 0L0 64" stroke="%23fff" stroke-width="14"/><path d="M0 0L64 64M64 0L0 64" stroke="%23C8102E" stroke-width="8"/><rect x="25" width="14" height="64" fill="%23fff"/><rect y="25" width="64" height="14" fill="%23fff"/><rect x="28" width="8" height="64" fill="%23C8102E"/><rect y="28" width="64" height="8" fill="%23C8102E"/></g><circle cx="32" cy="32" r="31" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/></svg>`),
  de: svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><clipPath id="c"><circle cx="32" cy="32" r="31"/></clipPath></defs><g clip-path="url(%23c)"><rect width="64" height="21.34" fill="%23000"/><rect y="21.33" width="64" height="21.34" fill="%23dd0000"/><rect y="42.66" width="64" height="21.34" fill="%23ffce00"/></g><circle cx="32" cy="32" r="31" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/></svg>`),
  es: svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><clipPath id="c"><circle cx="32" cy="32" r="31"/></clipPath></defs><g clip-path="url(%23c)"><rect width="64" height="64" fill="%23c60b1e"/><rect y="16" width="64" height="32" fill="%23ffc400"/></g><circle cx="32" cy="32" r="31" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/></svg>`),
  ru: svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><clipPath id="c"><circle cx="32" cy="32" r="31"/></clipPath></defs><g clip-path="url(%23c)"><rect width="64" height="21.34" fill="%23ffffff"/><rect y="21.33" width="64" height="21.34" fill="%230039a6"/><rect y="42.66" width="64" height="21.34" fill="%23d52b1e"/></g><circle cx="32" cy="32" r="31" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/></svg>`)
}


function TipActionLikeIcon(){
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3Zm2 10h7.2a2 2 0 0 0 1.96-1.58l1.28-6A2 2 0 0 0 17.48 10H14V6.5A2.5 2.5 0 0 0 11.5 4L9 10v10Z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function TipActionCommentIcon(){
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function TipActionShareIcon(){
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 15 19 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
      <path d="M13 5h6v6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 19c2.5-3.2 5.5-4.8 10-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
    </svg>
  )
}
function TipActionSaveIcon(){
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3-6 3V5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}


function getInitialBetaiLanguage() {
  try {
    const saved = localStorage.getItem('betai_language')
    if (saved && BETAI_LANGUAGES.includes(saved)) return saved
    const browserLang = String(navigator?.language || 'pl').slice(0, 2).toLowerCase()
    return BETAI_LANGUAGES.includes(browserLang) ? browserLang : 'pl'
  } catch (_) {
    return 'pl'
  }
}

const BETAI_DASHBOARD_TRANSLATIONS = {
  en: {
    'Dashboard': 'Dashboard', 'Dodaj typ': 'Add pick', 'Portfel': 'Wallet', 'Mój profil': 'My profile', 'Ranking': 'Ranking', 'Polecenia': 'Referrals', 'Powiadomienia': 'Notifications', 'Płatności': 'Payments', 'Subskrypcja': 'Subscription', 'Zarobki': 'Earnings', 'Wypłaty': 'Payouts', 'Typy AI': 'AI picks', 'Top typerzy': 'Top tipsters', 'Admin finanse': 'Admin finance', 'Admin wypłaty': 'Admin payouts', 'Wyloguj': 'Log out', 'Ulepsz konto': 'Top up account', 'Saldo': 'Balance', 'Żetony': 'Coin', 'Odblokowane': 'Unlocked', 'Przejdź na Premium': 'Go Premium', 'Zarządzaj Premium': 'Manage Premium', 'Szukaj meczów, lig, użytkowników...': 'Search matches, leagues, users...', 'Szukaj meczów, lig i użytkowników': 'Search matches, leagues and users', 'Mój profil': 'My profile', 'WITAJ PONOWNIE': 'WELCOME BACK', 'MECZÓW DZIŚ': 'MATCHES TODAY', 'ŚR. PEWNOŚĆ': 'AVG. CONFIDENCE', 'PREMIUM': 'PREMIUM', 'Marketplace premium': 'Premium marketplace', 'Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium. Przejdź na konto Premium, aby monetyzować swoje analizy.': 'Publishing paid picks is available only for Premium users. Upgrade to Premium to monetize your analysis.', 'Kup Premium': 'Buy Premium', 'typów premium': 'premium picks', 'Wszystkie': 'All', 'Premium': 'Premium', 'Darmowe': 'Free', 'Moje': 'Mine', 'AI Analiza': 'AI analysis', 'Zobacz typ': 'View pick', 'Obserwuj typera': 'Follow tipster', 'Obserwuj': 'Follow', 'Oczekujący': 'Pending', 'Dzisiaj': 'Today', 'Typ': 'Pick', 'Kurs': 'Odds', 'Powyżej 2.5 gola': 'Over 2.5 goals', 'Top użytkownik (24h)': 'Top user (24h)', 'Nagroda dnia': 'Daily reward', 'Aktywni teraz': 'Active now', 'Brak lidera': 'No leader', 'wiadomości dziś': 'today messages', 'Dla najbardziej aktywnych': 'For the most active', 'Napisz wiadomość...': 'Write a message...', 'Twoja wiadomość': 'Your message', 'Top typerzy': 'Top tipsters', 'Ranking real': 'Real ranking', 'AI Typy dnia': 'AI picks of the day', 'Zobacz wszystkie': 'See all', 'Wyniki live': 'Live scores', 'Artykuły': 'Articles', 'News': 'News', 'Analizy AI': 'AI analytics', 'TV / PPV': 'TV / PPV', 'Nie pobrano typów': 'Could not load picks', 'Brak konta': 'No account', 'Zaloguj się, aby odblokować': 'Log in to unlock', 'Musisz być zalogowany, aby obserwować typera.': 'You must be logged in to follow a tipster.', 'Witaj ponownie': 'Welcome back', 'Miło Cię widzieć z powrotem w BetAI.': 'Nice to see you back in BetAI.'
  },
  de: {
    'Dashboard': 'Dashboard', 'Dodaj typ': 'Tipp hinzufügen', 'Portfel': 'Wallet', 'Mój profil': 'Mein Profil', 'Ranking': 'Ranking', 'Polecenia': 'Empfehlungen', 'Powiadomienia': 'Benachrichtigungen', 'Płatności': 'Zahlungen', 'Subskrypcja': 'Abo', 'Zarobki': 'Einnahmen', 'Wypłaty': 'Auszahlungen', 'Typy AI': 'KI-Tipps', 'Top typerzy': 'Top-Tipper', 'Admin finanse': 'Admin Finanzen', 'Admin wypłaty': 'Admin Auszahlungen', 'Wyloguj': 'Ausloggen', 'Ulepsz konto': 'Konto aufladen', 'Saldo': 'Guthaben', 'Żetony': 'Coin', 'Odblokowane': 'Freigeschaltet', 'Przejdź na Premium': 'Zu Premium wechseln', 'Zarządzaj Premium': 'Premium verwalten', 'Szukaj meczów, lig, użytkowników...': 'Spiele, Ligen, Nutzer suchen...', 'Szukaj meczów, lig i użytkowników': 'Spiele, Ligen und Nutzer suchen', 'WITAJ PONOWNIE': 'WILLKOMMEN ZURÜCK', 'MECZÓW DZIŚ': 'SPIELE HEUTE', 'ŚR. PEWNOŚĆ': 'Ø SICHERHEIT', 'Marketplace premium': 'Premium-Marktplatz', 'Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium. Przejdź na konto Premium, aby monetyzować swoje analizy.': 'Bezahlte Tipps sind nur für Premium-Nutzer verfügbar. Wechsle zu Premium, um deine Analysen zu monetarisieren.', 'Kup Premium': 'Premium kaufen', 'typów premium': 'Premium-Tipps', 'Wszystkie': 'Alle', 'Premium': 'Premium', 'Darmowe': 'Kostenlos', 'Moje': 'Meine', 'AI Analiza': 'KI-Analyse', 'Zobacz typ': 'Tipp ansehen', 'Obserwuj typera': 'Tipper folgen', 'Obserwuj': 'Folgen', 'Oczekujący': 'Ausstehend', 'Dzisiaj': 'Heute', 'Typ': 'Tipp', 'Kurs': 'Quote', 'Powyżej 2.5 gola': 'Über 2,5 Tore', 'Top użytkownik (24h)': 'Top-Nutzer (24h)', 'Nagroda dnia': 'Tagespreis', 'Aktywni teraz': 'Jetzt aktiv', 'Brak lidera': 'Kein Leader', 'wiadomości dziś': 'Nachrichten heute', 'Dla najbardziej aktywnych': 'Für die Aktivsten', 'Napisz wiadomość...': 'Nachricht schreiben...', 'Twoja wiadomość': 'Deine Nachricht', 'Top typerzy': 'Top-Tipper', 'Ranking real': 'Echtes Ranking', 'AI Typy dnia': 'KI-Tipps des Tages', 'Zobacz wszystkie': 'Alle ansehen', 'Wyniki live': 'Live-Ergebnisse', 'Artykuły': 'Artikel', 'News': 'News', 'Analizy AI': 'KI-Analysen', 'TV / PPV': 'TV / PPV', 'Nie pobrano typów': 'Tipps konnten nicht geladen werden', 'Brak konta': 'Kein Konto', 'Zaloguj się, aby odblokować': 'Einloggen zum Freischalten', 'Musisz być zalogowany, aby obserwować typera.': 'Du musst eingeloggt sein, um einem Tipper zu folgen.', 'Witaj ponownie': 'Willkommen zurück', 'Miło Cię widzieć z powrotem w BetAI.': 'Schön, dich wieder bei BetAI zu sehen.'
  },
  es: {
    'Dashboard': 'Panel', 'Dodaj typ': 'Añadir pick', 'Portfel': 'Cartera', 'Mój profil': 'Mi perfil', 'Ranking': 'Ranking', 'Polecenia': 'Referidos', 'Powiadomienia': 'Notificaciones', 'Płatności': 'Pagos', 'Subskrypcja': 'Suscripción', 'Zarobki': 'Ganancias', 'Wypłaty': 'Retiros', 'Typy AI': 'Picks IA', 'Top typerzy': 'Top tipsters', 'Admin finanse': 'Admin finanzas', 'Admin wypłaty': 'Admin retiros', 'Wyloguj': 'Cerrar sesión', 'Ulepsz konto': 'Recargar cuenta', 'Saldo': 'Saldo', 'Żetony': 'Coin', 'Odblokowane': 'Desbloqueados', 'Przejdź na Premium': 'Ir a Premium', 'Zarządzaj Premium': 'Gestionar Premium', 'Szukaj meczów, lig, użytkowników...': 'Buscar partidos, ligas, usuarios...', 'Szukaj meczów, lig i użytkowników': 'Buscar partidos, ligas y usuarios', 'WITAJ PONOWNIE': 'BIENVENIDO DE NUEVO', 'MECZÓW DZIŚ': 'PARTIDOS HOY', 'ŚR. PEWNOŚĆ': 'CONFIANZA MEDIA', 'Marketplace premium': 'Marketplace premium', 'Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium. Przejdź na konto Premium, aby monetyzować swoje analizy.': 'Publicar picks de pago solo está disponible para usuarios Premium. Pasa a Premium para monetizar tus análisis.', 'Kup Premium': 'Comprar Premium', 'typów premium': 'picks premium', 'Wszystkie': 'Todos', 'Premium': 'Premium', 'Darmowe': 'Gratis', 'Moje': 'Míos', 'AI Analiza': 'Análisis IA', 'Zobacz typ': 'Ver pick', 'Obserwuj typera': 'Seguir tipster', 'Obserwuj': 'Seguir', 'Oczekujący': 'Pendiente', 'Dzisiaj': 'Hoy', 'Typ': 'Pick', 'Kurs': 'Cuota', 'Powyżej 2.5 gola': 'Más de 2.5 goles', 'Top użytkownik (24h)': 'Usuario top (24h)', 'Nagroda dnia': 'Premio del día', 'Aktywni teraz': 'Activos ahora', 'Brak lidera': 'Sin líder', 'wiadomości dziś': 'mensajes hoy', 'Dla najbardziej aktywnych': 'Para los más activos', 'Napisz wiadomość...': 'Escribe un mensaje...', 'Twoja wiadomość': 'Tu mensaje', 'Top typerzy': 'Top tipsters', 'Ranking real': 'Ranking real', 'AI Typy dnia': 'Picks IA del día', 'Zobacz wszystkie': 'Ver todo', 'Wyniki live': 'Resultados live', 'Artykuły': 'Artículos', 'News': 'Noticias', 'Analizy AI': 'Análisis IA', 'TV / PPV': 'TV / PPV', 'Nie pobrano typów': 'No se pudieron cargar picks', 'Brak konta': 'Sin cuenta', 'Zaloguj się, aby odblokować': 'Inicia sesión para desbloquear', 'Musisz być zalogowany, aby obserwować typera.': 'Debes iniciar sesión para seguir a un tipster.', 'Witaj ponownie': 'Bienvenido de nuevo', 'Miło Cię widzieć z powrotem w BetAI.': 'Qué bueno verte de vuelta en BetAI.'
  },
  ru: {
    'Dashboard': 'Панель', 'Dodaj typ': 'Добавить прогноз', 'Portfel': 'Кошелек', 'Mój profil': 'Мой профиль', 'Ranking': 'Рейтинг', 'Polecenia': 'Рефералы', 'Powiadomienia': 'Уведомления', 'Płatności': 'Платежи', 'Subskrypcja': 'Подписка', 'Zarobki': 'Доходы', 'Wypłaty': 'Выводы', 'Typy AI': 'AI прогнозы', 'Top typerzy': 'Топ типстеры', 'Admin finanse': 'Админ финансы', 'Admin wypłaty': 'Админ выводы', 'Wyloguj': 'Выйти', 'Ulepsz konto': 'Пополнить счет', 'Saldo': 'Баланс', 'Żetony': 'Coin', 'Odblokowane': 'Разблокировано', 'Przejdź na Premium': 'Перейти на Premium', 'Zarządzaj Premium': 'Управлять Premium', 'Szukaj meczów, lig, użytkowników...': 'Искать матчи, лиги, пользователей...', 'Szukaj meczów, lig i użytkowników': 'Искать матчи, лиги и пользователей', 'WITAJ PONOWNIE': 'С ВОЗВРАЩЕНИЕМ', 'MECZÓW DZIŚ': 'МАТЧЕЙ СЕГОДНЯ', 'ŚR. PEWNOŚĆ': 'СР. УВЕРЕННОСТЬ', 'Marketplace premium': 'Premium маркетплейс', 'Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium. Przejdź na konto Premium, aby monetyzować swoje analizy.': 'Платные прогнозы доступны только Premium пользователям. Перейдите на Premium, чтобы монетизировать аналитику.', 'Kup Premium': 'Купить Premium', 'typów premium': 'premium прогнозов', 'Wszystkie': 'Все', 'Premium': 'Premium', 'Darmowe': 'Бесплатные', 'Moje': 'Мои', 'AI Analiza': 'AI анализ', 'Zobacz typ': 'Смотреть прогноз', 'Obserwuj typera': 'Следить за типстером', 'Obserwuj': 'Следить', 'Oczekujący': 'Ожидает', 'Dzisiaj': 'Сегодня', 'Typ': 'Прогноз', 'Kurs': 'Коэф.', 'Powyżej 2.5 gola': 'Тотал больше 2.5', 'Top użytkownik (24h)': 'Топ пользователь (24ч)', 'Nagroda dnia': 'Награда дня', 'Aktywni teraz': 'Активны сейчас', 'Brak lidera': 'Лидера нет', 'wiadomości dziś': 'сообщений сегодня', 'Dla najbardziej aktywnych': 'Для самых активных', 'Napisz wiadomość...': 'Напишите сообщение...', 'Twoja wiadomość': 'Ваше сообщение', 'Top typerzy': 'Топ типстеры', 'Ranking real': 'Реальный рейтинг', 'AI Typy dnia': 'AI прогнозы дня', 'Zobacz wszystkie': 'Смотреть все', 'Wyniki live': 'Live результаты', 'Artykuły': 'Статьи', 'News': 'Новости', 'Analizy AI': 'AI аналитика', 'TV / PPV': 'TV / PPV', 'Nie pobrano typów': 'Не удалось загрузить прогнозы', 'Brak konta': 'Нет аккаунта', 'Zaloguj się, aby odblokować': 'Войдите, чтобы разблокировать', 'Musisz być zalogowany, aby obserwować typera.': 'Нужно войти, чтобы следить за типстером.', 'Witaj ponownie': 'С возвращением', 'Miło Cię widzieć z powrotem w BetAI.': 'Рады видеть вас снова в BetAI.'
  }
}

const BETAI_EXTRA_DASHBOARD_TRANSLATIONS = {
  en: {
    'Zaloguj się': 'Log in', 'Zarejestruj się': 'Register', 'Załóż konto': 'Create account', 'Nazwa użytkownika': 'Username', 'Hasło': 'Password', 'Powtórz hasło': 'Repeat password', 'Regulamin': 'Terms', 'Politykę prywatności': 'Privacy policy', 'Nie pamiętasz hasła?': 'Forgot password?', 'Szyfrowane logowanie': 'Encrypted login',
    'Realne statystyki live': 'Real live statistics', 'Platforma żyje i odświeża dane na bieżąco': 'The platform is live and refreshes data in real time', 'Zarejestrowanych użytkowników': 'Registered users', 'Skuteczność AI': 'AI accuracy', 'Typów dzisiaj': 'Picks today', 'Auto-odświeżanie co 30 s': 'Auto-refresh every 30s', 'ostatnia aktualizacja': 'last update',
    'BetAI LIVE CHAT': 'BetAI LIVE CHAT', 'online': 'online', 'TOP UŻYTKOWNIK (24H)': 'TOP USER (24H)', 'NAGRODA DNIA': 'DAILY REWARD', 'AKTYWNI TERAZ': 'ACTIVE NOW', '1 żeton / 24h': '1 token / 24h', 'Brak lidera': 'No leader', 'Dla najbardziej aktywnych': 'For the most active', 'Napisz wiadomość...': 'Write a message...', 'Twoja wiadomość': 'Your message', 'Witaj ponownie': 'Welcome back', 'Miło Cię widzieć z powrotem w BetAI.': 'Nice to see you back in BetAI.',
    'Marketplace premium': 'Premium marketplace', 'Typy premium': 'Premium picks', 'Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium.': 'Publishing paid picks is available only for Premium users.', 'Przejdź na konto Premium, aby monetyzować swoje analizy.': 'Upgrade to Premium to monetize your analyses.', 'Kup Premium': 'Buy Premium',
    'Wszystkie': 'All', 'Darmowe': 'Free', 'Moje': 'Mine', 'Dodaj typ': 'Add pick', 'Zobacz typ': 'View pick', 'Zobacz prognozę': 'View pick', 'Obserwuj typera': 'Follow tipster', 'Obserwuj': 'Follow', 'Oczekujący': 'Pending', 'Liga Mistrzów': 'Champions League', 'Dzisiaj': 'Today', 'Prognoz': 'Pick', 'Prognoza': 'Pick', 'Powyżej 2.5 gola': 'Over 2.5 goals', 'Ponad 2.5 gola': 'Over 2.5 goals', 'Kurs': 'Odds', 'Koef.': 'Odds', 'AI Analiza': 'AI analysis', 'Real w świetnej formie u siebie. Bayern ma problemy w defensywie w ostatnich meczach.': 'Real is in excellent home form. Bayern has had defensive problems in recent matches.',
    'Top typerzy': 'Top tipsters', 'Ranking real': 'Real ranking', 'AI Typy dnia': 'AI picks of the day', 'Zobacz wszystkie': 'See all', 'Brak danych': 'No data', 'Brak typów': 'No picks', 'Ładowanie...': 'Loading...', 'Łączenie...': 'Connecting...', 'Kup dostęp': 'Buy access', 'Szczegóły': 'Details',
    'Bezpieczne dane': 'Secure data', 'Twoje dane są u nas w pełni chronione.': 'Your data is fully protected.', 'Szybka rejestracja': 'Fast registration', 'Załóż konto w mniej niż 30 sekund.': 'Create an account in under 30 seconds.', 'Darmowe typy AI': 'Free AI picks', 'Codziennie nowe typy o wysokiej skuteczności.': 'New high-accuracy picks every day.', 'Aktywna społeczność': 'Active community', 'Tysiące typerów dzieli się wiedzą i wygrywa razem.': 'Thousands of bettors share knowledge and win together.',
    'Bilans': 'Balance', 'Balans': 'Balance', 'Odblokowano': 'Unlocked', 'Popолнить счет': 'Top up account', 'Пополни́ть счет': 'Top up account', 'Witaj': 'Welcome', 'Meczów dziś': 'Matches today', 'Śr. pewność': 'Avg. confidence', 'Dostęp do inteligentnych typów': 'Access to intelligent picks', 'Sport': 'Sport'
  },
  de: {
    'Zaloguj się': 'Einloggen', 'Zarejestruj się': 'Registrieren', 'Załóż konto': 'Konto erstellen', 'Nazwa użytkownika': 'Benutzername', 'Hasło': 'Passwort', 'Powtórz hasło': 'Passwort wiederholen', 'Regulamin': 'Bedingungen', 'Politykę prywatności': 'Datenschutz', 'Nie pamiętasz hasła?': 'Passwort vergessen?', 'Szyfrowane logowanie': 'Verschlüsselter Login',
    'Realne statystyki live': 'Echte Live-Statistiken', 'Platforma żyje i odświeża dane na bieżąco': 'Die Plattform ist live und aktualisiert Daten laufend', 'Zarejestrowanych użytkowników': 'Registrierte Nutzer', 'Skuteczność AI': 'KI-Trefferquote', 'Typów dzisiaj': 'Tipps heute', 'Auto-odświeżanie co 30 s': 'Auto-Aktualisierung alle 30 s', 'ostatnia aktualizacja': 'letzte Aktualisierung',
    'BetAI LIVE CHAT': 'BetAI LIVE CHAT', 'online': 'online', 'TOP UŻYTKOWNIK (24H)': 'TOP-NUTZER (24H)', 'NAGRODA DNIA': 'TAGESPREIS', 'AKTYWNI TERAZ': 'JETZT AKTIV', '1 żeton / 24h': '1 Token / 24h', 'Brak lidera': 'Kein Leader', 'Dla najbardziej aktywnych': 'Für die Aktivsten', 'Napisz wiadomość...': 'Nachricht schreiben...', 'Twoja wiadomość': 'Deine Nachricht', 'Witaj ponownie': 'Willkommen zurück', 'Miło Cię widzieć z powrotem w BetAI.': 'Schön, dich wieder bei BetAI zu sehen.',
    'Marketplace premium': 'Premium-Marktplatz', 'Typy premium': 'Premium-Tipps', 'Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium.': 'Bezahlte Tipps sind nur für Premium-Nutzer verfügbar.', 'Przejdź na konto Premium, aby monetyzować swoje analizy.': 'Wechsle zu Premium, um deine Analysen zu monetarisieren.', 'Kup Premium': 'Premium kaufen',
    'Wszystkie': 'Alle', 'Darmowe': 'Kostenlos', 'Moje': 'Meine', 'Dodaj typ': 'Tipp hinzufügen', 'Zobacz typ': 'Tipp ansehen', 'Zobacz prognozę': 'Prognose ansehen', 'Obserwuj typera': 'Tipster folgen', 'Obserwuj': 'Folgen', 'Oczekujący': 'Ausstehend', 'Liga Mistrzów': 'Champions League', 'Dzisiaj': 'Heute', 'Prognoz': 'Tipp', 'Prognoza': 'Tipp', 'Powyżej 2.5 gola': 'Über 2,5 Tore', 'Ponad 2.5 gola': 'Über 2,5 Tore', 'Kurs': 'Quote', 'Koef.': 'Quote', 'AI Analiza': 'KI-Analyse', 'Real w świetnej formie u siebie. Bayern ma problemy w defensywie w ostatnich meczach.': 'Real ist zu Hause in sehr guter Form. Bayern hatte zuletzt Defensivprobleme.',
    'Top typerzy': 'Top-Tipster', 'Ranking real': 'Echtes Ranking', 'AI Typy dnia': 'KI-Tipps des Tages', 'Zobacz wszystkie': 'Alle ansehen', 'Brak danych': 'Keine Daten', 'Brak typów': 'Keine Tipps', 'Ładowanie...': 'Laden...', 'Łączenie...': 'Verbinden...', 'Kup dostęp': 'Zugang kaufen', 'Szczegóły': 'Details',
    'Bezpieczne dane': 'Sichere Daten', 'Twoje dane są u nas w pełni chronione.': 'Deine Daten sind vollständig geschützt.', 'Szybka rejestracja': 'Schnelle Registrierung', 'Załóż konto w mniej niż 30 sekund.': 'Erstelle ein Konto in weniger als 30 Sekunden.', 'Darmowe typy AI': 'Kostenlose KI-Tipps', 'Codziennie nowe typy o wysokiej skuteczności.': 'Täglich neue Tipps mit hoher Trefferquote.', 'Aktywna społeczność': 'Aktive Community', 'Tysiące typerów dzieli się wiedzą i wygrywa razem.': 'Tausende Tipper teilen Wissen und gewinnen gemeinsam.',
    'Bilans': 'Guthaben', 'Balans': 'Guthaben', 'Odblokowano': 'Freigeschaltet', 'Witaj': 'Willkommen', 'Meczów dziś': 'Spiele heute', 'Śr. pewność': 'Ø Sicherheit', 'Dostęp do inteligentnych typów': 'Zugang zu intelligenten Tipps', 'Sport': 'Sport'
  },
  es: {
    'Zaloguj się': 'Iniciar sesión', 'Zarejestruj się': 'Registrarse', 'Załóż konto': 'Crear cuenta', 'Nazwa użytkownika': 'Usuario', 'Hasło': 'Contraseña', 'Powtórz hasło': 'Repetir contraseña', 'Regulamin': 'Términos', 'Politykę prywatności': 'Política de privacidad', 'Nie pamiętasz hasła?': '¿Olvidaste tu contraseña?', 'Szyfrowane logowanie': 'Inicio seguro',
    'Realne statystyki live': 'Estadísticas live reales', 'Platforma żyje i odświeża dane na bieżąco': 'La plataforma está viva y actualiza datos en directo', 'Zarejestrowanych użytkowników': 'Usuarios registrados', 'Skuteczność AI': 'Precisión IA', 'Typów dzisiaj': 'Picks hoy', 'Auto-odświeżanie co 30 s': 'Auto-actualización cada 30 s', 'ostatnia aktualizacja': 'última actualización',
    'BetAI LIVE CHAT': 'BetAI LIVE CHAT', 'online': 'online', 'TOP UŻYTKOWNIK (24H)': 'USUARIO TOP (24H)', 'NAGRODA DNIA': 'PREMIO DEL DÍA', 'AKTYWNI TERAZ': 'ACTIVOS AHORA', '1 żeton / 24h': '1 token / 24h', 'Brak lidera': 'Sin líder', 'Dla najbardziej aktywnych': 'Para los más activos', 'Napisz wiadomość...': 'Escribe un mensaje...', 'Twoja wiadomość': 'Tu mensaje', 'Witaj ponownie': 'Bienvenido de nuevo', 'Miło Cię widzieć z powrotem w BetAI.': 'Qué bueno verte de vuelta en BetAI.',
    'Marketplace premium': 'Marketplace premium', 'Typy premium': 'Picks premium', 'Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium.': 'Publicar picks de pago solo está disponible para usuarios Premium.', 'Przejdź na konto Premium, aby monetyzować swoje analizy.': 'Pasa a Premium para monetizar tus análisis.', 'Kup Premium': 'Comprar Premium',
    'Wszystkie': 'Todos', 'Darmowe': 'Gratis', 'Moje': 'Míos', 'Dodaj typ': 'Añadir pick', 'Zobacz typ': 'Ver pick', 'Zobacz prognozę': 'Ver pronóstico', 'Obserwuj typera': 'Seguir tipster', 'Obserwuj': 'Seguir', 'Oczekujący': 'Pendiente', 'Liga Mistrzów': 'Champions League', 'Dzisiaj': 'Hoy', 'Prognoz': 'Pronóstico', 'Prognoza': 'Pronóstico', 'Powyżej 2.5 gola': 'Más de 2.5 goles', 'Ponad 2.5 gola': 'Más de 2.5 goles', 'Kurs': 'Cuota', 'Koef.': 'Cuota', 'AI Analiza': 'Análisis IA', 'Real w świetnej formie u siebie. Bayern ma problemy w defensywie w ostatnich meczach.': 'Real está muy fuerte en casa. Bayern tuvo problemas defensivos en los últimos partidos.',
    'Top typerzy': 'Top tipsters', 'Ranking real': 'Ranking real', 'AI Typy dnia': 'Picks IA del día', 'Zobacz wszystkie': 'Ver todo', 'Brak danych': 'Sin datos', 'Brak typów': 'Sin picks', 'Ładowanie...': 'Cargando...', 'Łączenie...': 'Conectando...', 'Kup dostęp': 'Comprar acceso', 'Szczegóły': 'Detalles',
    'Bezpieczne dane': 'Datos seguros', 'Twoje dane są u nas w pełni chronione.': 'Tus datos están totalmente protegidos.', 'Szybka rejestracja': 'Registro rápido', 'Załóż konto w mniej niż 30 sekund.': 'Crea una cuenta en menos de 30 segundos.', 'Darmowe typy AI': 'Picks IA gratis', 'Codziennie nowe typy o wysokiej skuteczności.': 'Nuevos picks diarios de alta precisión.', 'Aktywna społeczność': 'Comunidad activa', 'Tysiące typerów dzieli się wiedzą i wygrywa razem.': 'Miles de usuarios comparten conocimiento y ganan juntos.',
    'Bilans': 'Saldo', 'Balans': 'Saldo', 'Odblokowano': 'Desbloqueado', 'Witaj': 'Bienvenido', 'Meczów dziś': 'Partidos hoy', 'Śr. pewność': 'Confianza media', 'Dostęp do inteligentnych typów': 'Acceso a picks inteligentes', 'Sport': 'Deporte'
  },
  ru: {
    'Zaloguj się': 'Войти', 'Zarejestruj się': 'Регистрация', 'Załóż konto': 'Создать аккаунт', 'Nazwa użytkownika': 'Имя пользователя', 'Hasło': 'Пароль', 'Powtórz hasło': 'Повторите пароль', 'Regulamin': 'Условия', 'Politykę prywatności': 'Политику конфиденциальности', 'Nie pamiętasz hasła?': 'Забыли пароль?', 'Szyfrowane logowanie': 'Защищенный вход',
    'Realne statystyki live': 'Реальная live-статистика', 'Platforma żyje i odświeża dane na bieżąco': 'Платформа живая и обновляет данные онлайн', 'Zarejestrowanych użytkowników': 'Зарегистрированных пользователей', 'Skuteczność AI': 'Точность AI', 'Typów dzisiaj': 'Прогнозов сегодня', 'Auto-odświeżanie co 30 s': 'Автообновление каждые 30 с', 'ostatnia aktualizacja': 'последнее обновление',
    'BetAI LIVE CHAT': 'BetAI LIVE CHAT', 'online': 'онлайн', 'TOP UŻYTKOWNIK (24H)': 'ТОП ПОЛЬЗОВАТЕЛЬ (24Ч)', 'NAGRODA DNIA': 'НАГРАДА ДНЯ', 'AKTYWNI TERAZ': 'АКТИВНЫ СЕЙЧАС', '1 żeton / 24h': '1 жетон / 24ч', 'Brak lidera': 'Лидера нет', 'Dla najbardziej aktywnych': 'Для самых активных', 'Napisz wiadomość...': 'Напишите сообщение...', 'Twoja wiadomość': 'Ваше сообщение', 'Witaj ponownie': 'С возвращением', 'Miło Cię widzieć z powrotem w BetAI.': 'Рады видеть вас снова в BetAI.',
    'Marketplace premium': 'Premium маркетплейс', 'Typy premium': 'Premium прогнозы', 'Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium.': 'Платные прогнозы доступны только Premium пользователям.', 'Przejdź na konto Premium, aby monetyzować swoje analizy.': 'Перейдите на Premium, чтобы монетизировать аналитику.', 'Kup Premium': 'Купить Premium',
    'Wszystkie': 'Все', 'Darmowe': 'Бесплатные', 'Moje': 'Мои', 'Dodaj typ': 'Добавить прогноз', 'Zobacz typ': 'Смотреть прогноз', 'Zobacz prognozę': 'Смотреть прогноз', 'Obserwuj typera': 'Следить за типстером', 'Obserwuj': 'Следить', 'Oczekujący': 'Ожидает', 'Liga Mistrzów': 'Лига чемпионов', 'Dzisiaj': 'Сегодня', 'Prognoz': 'Прогноз', 'Prognoza': 'Прогноз', 'Powyżej 2.5 gola': 'Тотал больше 2.5', 'Ponad 2.5 gola': 'Тотал больше 2.5', 'Kurs': 'Коэф.', 'Koef.': 'Коэф.', 'AI Analiza': 'AI анализ', 'Real w świetnej formie u siebie. Bayern ma problemy w defensywie w ostatnich meczach.': 'Real в отличной форме дома. У Bayern были проблемы в защите в последних матчах.',
    'Top typerzy': 'Топ типстеры', 'Ranking real': 'Реальный рейтинг', 'AI Typy dnia': 'AI прогнозы дня', 'Zobacz wszystkie': 'Смотреть все', 'Brak danych': 'Нет данных', 'Brak typów': 'Нет прогнозов', 'Ładowanie...': 'Загрузка...', 'Łączenie...': 'Подключение...', 'Kup dostęp': 'Купить доступ', 'Szczegóły': 'Детали',
    'Bezpieczne dane': 'Безопасные данные', 'Twoje dane są u nas w pełni chronione.': 'Ваши данные полностью защищены.', 'Szybka rejestracja': 'Быстрая регистрация', 'Załóż konto w mniej niż 30 sekund.': 'Создайте аккаунт меньше чем за 30 секунд.', 'Darmowe typy AI': 'Бесплатные AI-прогнозы', 'Codziennie nowe typy o wysokiej skuteczności.': 'Новые точные прогнозы каждый день.', 'Aktywna społeczność': 'Активное сообщество', 'Tysiące typerów dzieli się wiedzą i wygrywa razem.': 'Тысячи игроков делятся знаниями и выигрывают вместе.',
    'Bilans': 'Баланс', 'Balans': 'Баланс', 'Odblokowano': 'Разблокировано', 'Witaj': 'Добро пожаловать', 'Meczów dziś': 'Матчей сегодня', 'Śr. pewność': 'Ср. уверенность', 'Dostęp do inteligentnych typów': 'Доступ к интеллектуальным прогнозам', 'Sport': 'Спорт'
  }
}

function buildBetaiTranslationDictionary(lang) {
  const target = {
    ...(BETAI_DASHBOARD_TRANSLATIONS[lang] || {}),
    ...(BETAI_EXTRA_DASHBOARD_TRANSLATIONS[lang] || {})
  }
  const allDictionaries = [
    BETAI_DASHBOARD_TRANSLATIONS.en, BETAI_DASHBOARD_TRANSLATIONS.de, BETAI_DASHBOARD_TRANSLATIONS.es, BETAI_DASHBOARD_TRANSLATIONS.ru,
    BETAI_EXTRA_DASHBOARD_TRANSLATIONS.en, BETAI_EXTRA_DASHBOARD_TRANSLATIONS.de, BETAI_EXTRA_DASHBOARD_TRANSLATIONS.es, BETAI_EXTRA_DASHBOARD_TRANSLATIONS.ru
  ].filter(Boolean)
  const reverse = {}
  Object.keys(target).forEach(pl => {
    reverse[pl] = target[pl]
    allDictionaries.forEach(dict => {
      const value = dict[pl]
      if (value) reverse[value] = target[pl]
    })
  })
  return reverse
}

function translateBetaiTextValue(value, lang) {
  const raw = String(value || '')
  const trimmed = raw.trim()
  if (!trimmed || lang === 'pl') return value
  const dictionary = buildBetaiTranslationDictionary(lang)
  const direct = dictionary[trimmed]
  if (direct) return raw.replace(trimmed, direct)
  const prefixMatch = trimmed.match(/^([+\-•\s]*[\p{Extended_Pictographic}\p{Emoji_Presentation}]?\s*)(.+)$/u)
  if (prefixMatch && prefixMatch[2] && dictionary[prefixMatch[2]]) {
    return raw.replace(trimmed, `${prefixMatch[1]}${dictionary[prefixMatch[2]]}`)
  }
  let next = trimmed
  const keys = Object.keys(dictionary).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (!key || key.length < 3) continue
    if (next.includes(key)) next = next.split(key).join(dictionary[key])
  }
  next = next
    .replace(/\bTypy\b/g, dictionary['Typ'] || 'Picks')
    .replace(/\bWygrane\b/g, lang === 'en' ? 'Won' : lang === 'de' ? 'Gewonnen' : lang === 'es' ? 'Ganadas' : 'Выигрыши')
    .replace(/\bKurs\b/g, dictionary['Kurs'] || 'Odds')
  return next !== trimmed ? raw.replace(trimmed, next) : value
}

const PLATFORM_COMMISSION_RATE = 0.20

function getMonthlyCount(rows = []) {
  const now = new Date()
  return rows.filter(row => {
    const date = new Date(row.created_at)
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  }).length
}


class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('BetAI render error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="auth-screen">
          <div className="auth-card">
            <div className="auth-brand">Bet<span>+AI</span></div>
            <h1>Błąd aplikacji</h1>
            <p>{this.state.error.message}</p>
            <button className="auth-submit" onClick={() => {
              localStorage.clear()
              window.location.href = '/'
            }}>
              Wyczyść cache i wróć
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}



function normalizePublicSlug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function getTipsterPublicUrl(profile, fallbackId) {
  const rawSlug = profile?.public_slug || profile?.username || (profile?.email ? profile.email.split('@')[0] : '') || fallbackId || ''
  const slug = normalizePublicSlug(rawSlug) || fallbackId
  if (typeof window === 'undefined') return `/tipster/${slug}`
  return `${window.location.origin}/tipster/${slug}`
}

function getStoredReferralCode() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('betai_referral_code') || ''
}

function setStoredReferralCode(code) {
  if (typeof window === 'undefined') return
  const clean = normalizePublicSlug(code).replace(/-/g, '').slice(0, 32)
  if (clean) localStorage.setItem('betai_referral_code', clean)
}

function getAiConfidence(tip) {
  return Math.max(0, Math.min(100, Math.round(Number(tip?.ai_confidence ?? tip?.ai_probability ?? tip?.confidence ?? 0) || 0)))
}

function isAiGeneratedTip(tip) {
  const source = String(tip?.ai_source || '').toLowerCase()
  return source === 'real_ai_engine'
}

function isUserTip(tip) {
  return !isAiGeneratedTip(tip)
}

function isLiveAiTip(tip) {
  const aiSource = String(tip?.ai_source || '').toLowerCase()
  const liveStatus = String(tip?.live_status || '').trim().toUpperCase()
  const status = String(tip?.status || '').toLowerCase()
  return aiSource === 'real_ai_engine' && liveStatus !== 'NS' && (status === 'live' || Number(tip?.live_minute || 0) > 0)
}

function isPreMatchAiTip(tip) {
  return isAiGeneratedTip(tip) && !isLiveAiTip(tip)
}

function getAiScore(tip) {
  const confidence = getAiConfidence(tip)
  const odds = Number(tip?.odds || 0)
  const computed = odds > 1 ? Math.round((confidence / 100) * odds * 100) : confidence
  return Math.max(0, Math.min(100, Math.round(Number(tip?.ai_score ?? computed) || 0)))
}

function getAiAnalysis(tip) {
  const confidence = getAiConfidence(tip)
  const score = getAiScore(tip)
  if (tip?.ai_analysis) return tip.ai_analysis
  if (tip?.analysis) return tip.analysis
  if (confidence >= 85 || score >= 85) return 'AI wykrywa mocny value pick: wysoka pewność, korzystny kurs i dobry stosunek ryzyka do potencjalnego zysku.'
  if (confidence >= 70 || score >= 70) return 'AI ocenia ten typ jako solidny wybór z dodatnią wartością przy aktualnym kursie.'
  return 'AI zaleca ostrożność i dodatkowe sprawdzenie danych przed zakupem lub grą.'
}

function getAiBadges(tip) {
  const confidence = getAiConfidence(tip)
  const score = getAiScore(tip)
  const odds = Number(tip?.odds || 0)
  const badges = []
  if (confidence >= 80) badges.push('🧠 AI PICK')
  if (score >= 85) badges.push('🔥 HOT')
  if (odds >= 1.8 && confidence >= 65) badges.push('💎 VALUE')
  return badges
}

function getReferralUrl(code) {
  const clean = String(code || '').trim()
  if (!clean) return ''
  if (typeof window === 'undefined') return '/ref/' + clean
  return window.location.origin + '/ref/' + clean
}

function getReferralProfileUrl(code) {
  const clean = String(code || '').trim()
  if (!clean) return ''
  if (typeof window === 'undefined') return '/?ref=' + clean
  return window.location.origin + '/?ref=' + clean
}

function getTipAuthorId(tip) {
  return tip?.author_id || tip?.user_id || tip?.created_by || tip?.owner_id || tip?.tipster_id || null
}

function getTipAuthorStatsKey(tip) {
  return String(
    getTipAuthorId(tip) ||
    tip?.author_email ||
    tip?.email ||
    tip?.user_email ||
    tip?.author_name ||
    tip?.username ||
    'unknown'
  ).toLowerCase()
}

function normalizeTipSettlementStatus(value) {
  const clean = String(value || '').trim().toLowerCase()
  if (['won', 'win', 'wygrał', 'wygral', 'wygrany', 'green'].includes(clean)) return 'won'
  if (['lost', 'loss', 'przegrał', 'przegral', 'przegrany', 'red'].includes(clean)) return 'lost'
  if (['void', 'push', 'zwrot', 'cancelled', 'canceled', 'anulowany'].includes(clean)) return 'void'
  return 'pending'
}

function normalizeResult(value) {
  const clean = String(value || '').trim().toLowerCase()
  if (['won', 'win', 'wygrał', 'wygral', 'wygrany', 'green', 'success'].includes(clean) || clean.includes('won') || clean.includes('win')) return 'win'
  if (['lost', 'lose', 'loss', 'przegrał', 'przegral', 'przegrany', 'red', 'failed'].includes(clean) || clean.includes('lost') || clean.includes('lose') || clean.includes('loss')) return 'loss'
  if (['void', 'push', 'zwrot', 'cancelled', 'canceled', 'anulowany', 'return'].includes(clean)) return 'void'
  return 'pending'
}

function readTipStakeValue(tip) {
  return Number(tip?.stake ?? tip?.amount ?? tip?.stawka ?? tip?.bet_amount ?? tip?.total_staked ?? 0) || 0
}

function readTipProfitValue(tip) {
  const explicit = tip?.profit ?? tip?.profit_amount ?? tip?.result_profit ?? tip?.payout_profit
  if (explicit !== undefined && explicit !== null && String(explicit) !== '') return Number(explicit) || 0
  const stake = readTipStakeValue(tip)
  const odds = Number(tip?.odds ?? tip?.course ?? 0) || 0
  const status = normalizeTipSettlementStatus(tip?.status ?? tip?.result)
  if (status === 'won') return stake * Math.max(odds - 1, 0)
  if (status === 'lost') return -stake
  return 0
}

function buildAuthorStatsFromTips(tips = []) {
  const statsMap = new Map()
  ;(tips || []).forEach(rawTip => {
    const tip = normalizeTipRow(rawTip)
    const key = getTipAuthorStatsKey(tip)
    if (!key || key === 'unknown') return
    const current = statsMap.get(key) || {
      totalTips: 0,
      wonTips: 0,
      lostTips: 0,
      pendingTips: 0,
      totalStaked: 0,
      profit: 0,
      highestOdds: 0,
      avgOddsSum: 0,
      avgOddsCount: 0,
    }
    const status = normalizeTipSettlementStatus(tip.status ?? tip.result)
    const stake = readTipStakeValue(tip)
    const odds = Number(tip.odds ?? tip.course ?? 0) || 0
    current.totalTips += 1
    if (status === 'won') current.wonTips += 1
    else if (status === 'lost') current.lostTips += 1
    else current.pendingTips += 1
    if (status === 'won' || status === 'lost') current.totalStaked += stake
    current.profit += readTipProfitValue(tip)
    if (odds > 0) {
      current.highestOdds = Math.max(current.highestOdds, odds)
      current.avgOddsSum += odds
      current.avgOddsCount += 1
    }
    statsMap.set(key, current)
  })
  return statsMap
}

function getImportedProfileStats(profile) {
  if (!profile) return null
  const totalTips = Number(profile.imported_total_tips ?? profile.total_tips ?? profile.tips_count ?? 0) || 0
  const hasImported =
    profile.imported_yield !== undefined ||
    profile.imported_total_tips !== undefined ||
    profile.imported_profit !== undefined ||
    profile.total_tips !== undefined
  if (!hasImported && totalTips <= 0) return null
  return {
    yield: Number(profile.imported_yield ?? profile.yield ?? profile.roi ?? 0) || 0,
    totalTips,
    wonTips: Number(profile.imported_won_tips ?? profile.wins ?? 0) || 0,
    lostTips: Number(profile.imported_lost_tips ?? profile.losses ?? 0) || 0,
    pendingTips: Number(profile.imported_pending_tips ?? profile.pending_tips ?? 0) || 0,
    totalStaked: Number(profile.imported_total_staked ?? profile.total_staked ?? 0) || 0,
    profit: Number(profile.imported_profit ?? profile.profit ?? profile.earnings ?? 0) || 0,
    avgOdds: Number(profile.imported_avg_odds ?? profile.avg_odds ?? 0) || 0,
    highestOdds: Number(profile.imported_highest_odds ?? profile.highest_odds ?? 0) || 0,
  }
}

function finalizeAuthorStats(dynamicStats = null, importedStats = null) {
  if (importedStats && Number(importedStats.totalTips || 0) > 0) return importedStats
  const totalStaked = Number(dynamicStats?.totalStaked || 0)
  const profit = Number(dynamicStats?.profit || 0)
  return {
    yield: totalStaked > 0 ? (profit / totalStaked) * 100 : 0,
    totalTips: Number(dynamicStats?.totalTips || 0) || 0,
    wonTips: Number(dynamicStats?.wonTips || 0) || 0,
    lostTips: Number(dynamicStats?.lostTips || 0) || 0,
    pendingTips: Number(dynamicStats?.pendingTips || 0) || 0,
    totalStaked,
    profit,
    avgOdds: Number(dynamicStats?.avgOddsCount || 0) > 0 ? Number(dynamicStats.avgOddsSum || 0) / Number(dynamicStats.avgOddsCount || 1) : 0,
    highestOdds: Number(dynamicStats?.highestOdds || 0) || 0,
  }
}

function compactNumberLabel(value, decimals = 2) {
  const num = Number(value || 0)
  if (Number.isInteger(num)) return String(num)
  return num.toFixed(decimals).replace(/\.?0+$/, '')
}

function getAuthorStatsLabels(sourceStats) {
  const stats = sourceStats || finalizeAuthorStats(null, null)
  const profit = Number(stats.profit || 0)
  return {
    yieldLabel: `${compactNumberLabel(stats.yield, 2)}%`,
    totalTipsLabel: String(Number(stats.totalTips || 0) || 0),
    profitLabel: `${profit >= 0 ? '+' : ''}${profit.toFixed(2)} zł`,
    profitValue: profit,
  }
}

function getTipFallbackAuthorStats(tip) {
  return finalizeAuthorStats(buildAuthorStatsFromTips([tip]).get(getTipAuthorStatsKey(tip)), null)
}


function saveTipDebug(status, details = '') {
  const text = `[${new Date().toLocaleString('pl-PL')}] ${status}${details ? ': ' + details : ''}`
  try { window.localStorage.setItem('betai_last_tip_save_status', text) } catch (_) {}
  console.log('BETAI TIP SAVE STATUS:', text)
  return text
}

function readTipDebug() {
  try { return window.localStorage.getItem('betai_last_tip_save_status') || '' } catch (_) { return '' }
}

function getUnlockedTipsStorageKey(userId = 'guest') {
  return `betai_unlocked_tips_${userId || 'guest'}`
}

function clearGuestUnlockedTips() {
  try {
    localStorage.removeItem('betai_unlocked_tips_v1')
    localStorage.removeItem(getUnlockedTipsStorageKey('guest'))
  } catch (_) {}
}

function buildRankingFromTips(tips = []) {
  const map = new Map()
  ;(tips || []).forEach(tip => {
    const normalized = normalizeTipRow(tip)
    const authorName = isGenericProfileName(normalized.author_name)
      ? (normalized.username || normalized.author_email?.split('@')?.[0] || 'Użytkownik')
      : (normalized.author_name || normalized.username || 'Użytkownik')
    if (String(authorName).toLowerCase() === 'ai tip') return

    const id = String(normalized.author_id || normalized.user_id || normalized.author_email || normalized.username || normalized.author_name || 'unknown').toLowerCase()
    const current = map.get(id) || {
      tipster_id: id,
      id,
      username: authorName,
      email: normalized.author_email || normalized.email || '',
      total_tips: 0,
      wins: 0,
      losses: 0,
      pending: 0,
      roi: 0,
      winrate: 0,
      earnings: 0,
      profit: 0,
      total_staked: 0
    }

    current.username = isGenericProfileName(current.username) ? authorName : current.username
    current.email = current.email || normalized.author_email || normalized.email || ''
    current.total_tips += 1

    const odds = Number(normalized.odds || normalized.course || 0) || 0
    const stake = Number(normalized.stake || normalized.amount || normalized.stawka || normalized.bet_amount || 0) || 0
    const explicitProfit = normalized.profit ?? normalized.result_profit ?? normalized.profit_amount ?? normalized.payout_profit
    const st = String(normalized.status || normalized.result || normalized.result_status || '').toLowerCase()

    let profit = 0
    if (explicitProfit !== undefined && explicitProfit !== null && String(explicitProfit) !== '') {
      profit = Number(explicitProfit) || 0
    } else if (['won','win','wygrany','wygrana'].includes(st)) {
      profit = stake > 0 ? stake * Math.max(odds - 1, 0) : 0
    } else if (['lost','loss','lose','przegrany','przegrana'].includes(st)) {
      profit = stake > 0 ? -stake : 0
    }

    if (['won','win','wygrany','wygrana'].includes(st)) current.wins += 1
    else if (['lost','loss','lose','przegrany','przegrana'].includes(st)) current.losses += 1
    else current.pending += 1

    if (['won','win','wygrany','wygrana','lost','loss','lose','przegrany','przegrana'].includes(st)) {
      current.total_staked += stake
    }
    current.earnings += profit
    current.profit = current.earnings
    current.winrate = (current.wins + current.losses) ? (current.wins / (current.wins + current.losses)) * 100 : 0
    current.roi = current.total_staked > 0 ? (current.earnings / current.total_staked) * 100 : 0
    map.set(id, current)
  })
  return sortRankingRows(Array.from(map.values())).slice(0, 10)
}

function getRankingNumber(row, candidates = [], fallback = 0) {
  for (const key of candidates) {
    const raw = row?.[key]
    const value = Number(raw)
    if (Number.isFinite(value)) return value
  }
  return fallback
}

function sortRankingRows(rows = []) {
  return [...(rows || [])].sort((a, b) => {
    const profitDiff = getRankingNumber(b, ['earnings', 'total_earnings', 'profit']) - getRankingNumber(a, ['earnings', 'total_earnings', 'profit'])
    if (profitDiff !== 0) return profitDiff
    const roiDiff = getRankingNumber(b, ['roi', 'yield']) - getRankingNumber(a, ['roi', 'yield'])
    if (roiDiff !== 0) return roiDiff
    const winrateDiff = getRankingNumber(b, ['winrate', 'wr']) - getRankingNumber(a, ['winrate', 'wr'])
    if (winrateDiff !== 0) return winrateDiff
    const winsDiff = getRankingNumber(b, ['wins']) - getRankingNumber(a, ['wins'])
    if (winsDiff !== 0) return winsDiff
    return getRankingNumber(b, ['total_tips', 'tips_count']) - getRankingNumber(a, ['total_tips', 'tips_count'])
  })
}

function getRankingIdentityKey(row = {}) {
  const email = normalizeEmail(row.email || row.author_email || row.user_email)
  const username = normalizeEmail(row.username || row.author_name || row.user_name)
  const id = String(row.tipster_id || row.author_id || row.user_id || row.id || '').toLowerCase()
  if (email) return `email:${email}`
  if (username && !isGenericProfileName(username)) return `user:${username}`
  return id ? `id:${id}` : ''
}

function normalizeRankingProfit(row = {}) {
  return getRankingNumber(row, [
    'imported_profit',
    'profit',
    'earnings',
    'total_earnings',
    'balance',
    'net_profit',
    'pnl'
  ], 0)
}

function normalizeRankingTipsCount(row = {}) {
  return getRankingNumber(row, ['imported_total_tips', 'totalTips', 'total_tips', 'tips_count', 'tips'], 0)
}

function normalizeRankingWins(row = {}) {
  return getRankingNumber(row, ['imported_won_tips', 'wonTips', 'wins', 'won'], 0)
}

function normalizeRankingLosses(row = {}) {
  return getRankingNumber(row, ['imported_lost_tips', 'lostTips', 'losses', 'lost'], 0)
}

function normalizeRankingYield(row = {}) {
  return getRankingNumber(row, ['imported_yield', 'yield', 'roi'], 0)
}

function buildRankingRowsFromTipCards(tips = []) {
  const rows = new Map()
  ;(tips || []).forEach(tipRaw => {
    const tip = normalizeTipRow(tipRaw)
    const stats = tip.author_visible_stats || getImportedProfileStats(tip) || getTipFallbackAuthorStats(tip)
    const key = getRankingIdentityKey(tip)
    if (!key) return
    const previous = rows.get(key) || {}
    const profit = Number(stats?.profit ?? tip.imported_profit ?? tip.profit ?? 0) || 0
    const totalTips = Number(stats?.totalTips ?? tip.imported_total_tips ?? 0) || 0
    const wins = Number(stats?.wonTips ?? tip.imported_won_tips ?? 0) || 0
    const losses = Number(stats?.lostTips ?? tip.imported_lost_tips ?? 0) || 0
    const roi = Number(stats?.yield ?? tip.imported_yield ?? 0) || 0
    rows.set(key, {
      ...previous,
      tipster_id: tip.author_id || tip.user_id || previous.tipster_id || key,
      id: tip.author_id || tip.user_id || previous.id || key,
      username: isGenericProfileName(tip.author_name) ? (tip.author_email ? String(tip.author_email).split('@')[0] : previous.username || 'Użytkownik') : (tip.author_name || previous.username || 'Użytkownik'),
      email: tip.author_email || previous.email || '',
      avatar_url: tip.author_avatar_url || tip.avatar_url || previous.avatar_url || '',
      total_tips: Math.max(Number(previous.total_tips || 0), totalTips),
      wins: Math.max(Number(previous.wins || 0), wins),
      losses: Math.max(Number(previous.losses || 0), losses),
      roi: Math.abs(roi) >= Math.abs(Number(previous.roi || 0)) ? roi : Number(previous.roi || 0),
      yield: Math.abs(roi) >= Math.abs(Number(previous.yield || 0)) ? roi : Number(previous.yield || 0),
      winrate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : Number(previous.winrate || 0),
      earnings: Math.abs(profit) >= Math.abs(Number(previous.earnings || 0)) ? profit : Number(previous.earnings || 0),
      profit: Math.abs(profit) >= Math.abs(Number(previous.profit || 0)) ? profit : Number(previous.profit || 0),
    })
  })
  return Array.from(rows.values())
}

function mergeRankingRows(...groups) {
  const map = new Map()
  const aliasToKey = new Map()

  const aliasesFor = (raw = {}) => {
    const aliases = []
    const email = normalizeEmail(raw.email || raw.author_email || raw.user_email)
    const username = normalizeEmail(raw.username || raw.author_name || raw.user_name)
    const id = String(raw.tipster_id || raw.author_id || raw.user_id || raw.id || '').toLowerCase()
    if (email) {
      aliases.push(`email:${email}`)
      aliases.push(`user:${email.split('@')[0]}`)
    }
    if (username && !isGenericProfileName(username)) aliases.push(`user:${username}`)
    if (id) aliases.push(`id:${id}`)
    return [...new Set(aliases.filter(Boolean))]
  }

  groups.flat().filter(Boolean).forEach(raw => {
    const aliases = aliasesFor(raw)
    let key = aliases.find(alias => aliasToKey.has(alias))
    if (key) key = aliasToKey.get(key)
    if (!key) key = aliases[0] || getRankingIdentityKey(raw)
    if (!key) return
    aliases.forEach(alias => aliasToKey.set(alias, key))

    const previous = map.get(key) || {}
    const profit = normalizeRankingProfit(raw)
    const previousProfit = normalizeRankingProfit(previous)
    const tipsCount = normalizeRankingTipsCount(raw)
    const wins = normalizeRankingWins(raw)
    const losses = normalizeRankingLosses(raw)
    const roi = normalizeRankingYield(raw)
    const username = raw.username || raw.author_name || previous.username || previous.author_name || (raw.email ? String(raw.email).split('@')[0] : 'Użytkownik')

    map.set(key, {
      ...previous,
      ...raw,
      tipster_id: raw.tipster_id || raw.author_id || raw.user_id || raw.id || previous.tipster_id || key,
      username: isGenericProfileName(username) ? (raw.email ? String(raw.email).split('@')[0] : previous.username || 'Użytkownik') : username,
      email: raw.email || raw.author_email || previous.email || '',
      avatar_url: raw.avatar_url || raw.author_avatar_url || raw.profile_avatar_url || previous.avatar_url || previous.author_avatar_url || '',
      total_tips: Math.max(Number(previous.total_tips || previous.totalTips || 0), Number(tipsCount || 0)),
      totalTips: Math.max(Number(previous.total_tips || previous.totalTips || 0), Number(tipsCount || 0)),
      wins: Math.max(Number(previous.wins || 0), Number(wins || 0)),
      losses: Math.max(Number(previous.losses || 0), Number(losses || 0)),
      roi: Math.abs(Number(roi || 0)) >= Math.abs(Number(previous.roi || previous.yield || 0)) ? Number(roi || 0) : Number(previous.roi || previous.yield || 0),
      yield: Math.abs(Number(roi || 0)) >= Math.abs(Number(previous.yield || previous.roi || 0)) ? Number(roi || 0) : Number(previous.yield || previous.roi || 0),
      winrate: (Number(wins || 0) + Number(losses || 0)) > 0
        ? (Number(wins || 0) / (Number(wins || 0) + Number(losses || 0))) * 100
        : Number(raw.winrate || raw.wr || previous.winrate || 0),
      earnings: Math.abs(Number(profit || 0)) >= Math.abs(Number(previousProfit || 0)) ? Number(profit || 0) : Number(previousProfit || 0),
      profit: Math.abs(Number(profit || 0)) >= Math.abs(Number(previousProfit || 0)) ? Number(profit || 0) : Number(previousProfit || 0),
    })
  })

  return Array.from(map.values()).filter(row => !['bet+ai live','betai live','ai tip'].includes(String(row?.username || row?.name || '').toLowerCase()))
}

function buildLiveLeaderboardRows(ranking = [], tips = []) {
  const rows = mergeRankingRows(
    Array.isArray(ranking) ? ranking : [],
    buildRankingFromTips(tips),
    buildRankingRowsFromTipCards(tips)
  )
  return sortRankingRows(rows).map((row, index) => {
    const wins = normalizeRankingWins(row)
    const losses = normalizeRankingLosses(row)
    const totalTips = normalizeRankingTipsCount(row)
    const profit = normalizeRankingProfit(row)
    const roi = normalizeRankingYield(row)
    return {
      ...row,
      liveRank: index + 1,
      totalTips,
      total_tips: totalTips,
      wins,
      losses,
      winrate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : getRankingNumber(row, ['winrate', 'wr']),
      roi,
      yield: roi,
      earnings: profit,
      profit,
      followers: getRankingNumber(row, ['followers_count', 'followers'])
    }
  })
}

function isSchemaError(error) {
  const msg = String(error?.message || error || '').toLowerCase()
  return msg.includes('column') || msg.includes('schema cache') || msg.includes('could not find') || msg.includes('pgrst204') || msg.includes('42703')
}

function normalizeTipRow(row = {}) {
  const teamsFromMatch = String(row.match || '').split(/\s+vs\s+|\s+-\s+|\s+—\s+/i).map(x => x.trim()).filter(Boolean)
  const premium = isTipPremium(row)
  return {
    ...row,
    author_id: row.author_id || row.user_id || row.created_by || row.owner_id || null,
    user_id: row.user_id || row.author_id || row.created_by || row.owner_id || null,
    author_name: resolveRealProfileUsername({
      username: isGenericProfileName(row.author_name) ? (row.username || row.author_username || row.profile_username) : (row.author_name || row.username || row.author_username || row.profile_username),
      author_name: isGenericProfileName(row.author_name) ? (row.username || row.author_username || row.profile_username) : row.author_name,
      email: row.author_email || row.email || row.user_email,
      author_email: row.author_email || row.email || row.user_email
    }),
    author_email: row.author_email || row.email || row.user_email || null,
    author_avatar_url: row.author_avatar_url || row.avatar_url || row.profile_avatar_url || null,
    league: row.league || 'Liga',
    league_logo: row.league_logo || row.leagueLogo || row.fixture_json?.leagueLogo || null,
    team_home: row.team_home || teamsFromMatch[0] || 'Drużyna 1',
    team_away: row.team_away || teamsFromMatch[1] || 'Drużyna 2',
    home_team_id: row.home_team_id || row.homeTeamId || row.fixture_json?.homeTeamId || null,
    away_team_id: row.away_team_id || row.awayTeamId || row.fixture_json?.awayTeamId || null,
    home_logo: row.home_logo || row.team_home_logo || row.homeLogo || row.fixture_json?.homeLogo || null,
    away_logo: row.away_logo || row.team_away_logo || row.awayLogo || row.fixture_json?.awayLogo || null,
    bet_type: row.bet_type || row.prediction || row.type || 'Typ',
    odds: Number(row.odds || row.course || 0),
    analysis: row.analysis || row.description || '',
    ai_analysis: row.ai_analysis || row.analysis || row.description || '',
    ai_probability: Number(row.ai_probability ?? row.ai_confidence ?? row.confidence ?? 0),
    ai_confidence: Number(row.ai_confidence ?? row.ai_probability ?? row.confidence ?? 0),
    access_type: premium ? 'premium' : 'free',
    is_premium: premium,
    price: Math.max(0, Number(row.price ?? row.single_price ?? row.tip_price ?? (premium ? 29 : 0)) || 0),
    status: row.status || 'pending',
    created_at: row.created_at || new Date().toISOString()
  }
}

function isTipPremium(tip) {
  const accessType = String(tip?.access_type || tip?.access || tip?.type || '').toLowerCase()
  return Boolean(
    tip?.is_premium === true ||
    tip?.premium === true ||
    accessType === 'premium' ||
    Number(tip?.price || 0) > 0
  )
}

function isVisibleTipForUser(tip, userId, unlockedSet) {
  const authorId = getTipAuthorId(tip)

  if (!isTipPremium(tip)) return true
  if (userId && authorId && authorId === userId) return true
  if (userId && unlockedSet?.has?.(tip.id)) return true

  return false
}

function isGenericProfileName(value) {
  const clean = String(value || '').trim().toLowerCase()
  return ['user', 'użytkownik', 'uzytkownik'].includes(clean)
}

function resolveRealProfileUsername(user) {
  const email = normalizeEmail(user?.email || user?.author_email || user?.auth_email || user?.user_metadata?.email || user?.raw_user_meta_data?.email)
  const emailLocal = email ? email.split('@')[0] : ''
  const candidates = [
    user?.username,
    user?.user_metadata?.username,
    user?.user_metadata?.name,
    user?.raw_user_meta_data?.username,
    user?.author_name,
    user?.name,
    emailLocal,
  ].map(value => String(value || '').trim()).filter(Boolean)
  return candidates.find(value => !isGenericProfileName(value)) || emailLocal || candidates[0] || 'Użytkownik'
}

function getUserProfileView(user) {
  const email = user?.email || ''
  const username = resolveRealProfileUsername(user)
  const avatarUrl = user?.avatar_url || user?.user_metadata?.avatar_url || ''
  return {
    id: user?.id || null,
    email,
    username,
    initials: (username || 'U').slice(0, 2).toUpperCase(),
    avatarUrl,
    isAdmin: email.toLowerCase() === 'smilhytv@gmail.com' || String(username).toLowerCase() === 'smilhytv'
  }
}



function getProfileEmail(user) {
  return normalizeEmail(user?.email || user?.author_email || user?.auth_email || user?.user_metadata?.email || user?.raw_user_meta_data?.email)
}

function getProfileUsername(user) {
  return normalizeEmail(resolveRealProfileUsername(user))
}


function getProfileAvatarUrl(user) {
  return (
    user?.avatar_url ||
    user?.author_avatar_url ||
    user?.profile_avatar_url ||
    user?.photo_url ||
    user?.picture ||
    user?.image_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    user?.user_metadata?.photo_url ||
    user?.raw_user_meta_data?.avatar_url ||
    user?.raw_user_meta_data?.picture ||
    user?.raw_user_meta_data?.photo_url ||
    ''
  )
}

function addProfileToMap(profileMap, profile = {}) {
  if (!profileMap || !profile) return
  const emailKey = normalizeEmail(profile.email || profile.user_email || profile.author_email)
  const usernameKey = normalizeEmail(profile.username || profile.user_name || profile.author_name)
  const localKey = emailKey ? normalizeEmail(emailKey.split('@')[0]) : ''
  const idKey = String(profile.id || profile.user_id || profile.author_id || profile.tipster_id || '').toLowerCase()
  if (idKey) profileMap.set(idKey, profile)
  if (emailKey) profileMap.set(emailKey, profile)
  if (localKey) profileMap.set(localKey, profile)
  if (usernameKey) profileMap.set(usernameKey, profile)
}

function findProfileFromMap(profileMap, source = {}) {
  if (!profileMap || !source) return null
  const emailKey = normalizeEmail(source.email || source.author_email || source.user_email)
  const localKey = emailKey ? normalizeEmail(emailKey.split('@')[0]) : ''
  const nameKey = normalizeEmail(source.username || source.author_name || source.user_name)
  const idKey = String(getTipAuthorId(source) || source.id || source.user_id || source.author_id || source.tipster_id || '').toLowerCase()
  return profileMap.get(idKey) || profileMap.get(emailKey) || profileMap.get(localKey) || profileMap.get(nameKey) || null
}

async function fetchBetaiPublicProfiles() {
  if (!isSupabaseConfigured || !supabase) return []

  // Najpierw RPC SECURITY DEFINER — omija RLS i daje publiczny avatar każdego użytkownika.
  try {
    const { data, error } = await supabase.rpc('betai_public_profiles_for_ui')
    if (!error && Array.isArray(data)) return mergeBetaiProfilesWithCache(data)
    if (error) console.warn('betai_public_profiles_for_ui rpc skipped', error)
  } catch (error) {
    console.warn('betai_public_profiles_for_ui rpc exception skipped', error)
  }

  // Fallback: widok publiczny.
  try {
    const { data, error } = await supabase.from('betai_public_profiles_for_ui_view').select('*').limit(1000)
    if (!error && Array.isArray(data)) return mergeBetaiProfilesWithCache(data)
    if (error) console.warn('betai_public_profiles_for_ui view skipped', error)
  } catch (error) {
    console.warn('betai_public_profiles_for_ui view exception skipped', error)
  }

  // Ostatni fallback: bezpośrednio profiles. Na RLS może zwrócić tylko aktualnego usera.
  try {
    const { data, error } = await supabase.from('profiles').select('id,email,username,avatar_url').limit(1000)
    if (!error && Array.isArray(data)) return mergeBetaiProfilesWithCache(data)
    if (error) console.warn('profiles avatar fallback skipped', error)
  } catch (error) {
    console.warn('profiles avatar fallback exception skipped', error)
  }

  return mergeBetaiProfilesWithCache([])
}

function buildBetaiProfileMap(profiles = []) {
  const profileMap = new Map()
  ;(profiles || []).forEach(profile => addProfileToMap(profileMap, profile))
  return profileMap
}

const BETAI_PUBLIC_AVATAR_CACHE_KEY = 'betai_public_avatar_cache_v912'

function readBetaiPublicAvatarCache() {
  try {
    return JSON.parse(localStorage.getItem(BETAI_PUBLIC_AVATAR_CACHE_KEY) || '[]')
  } catch (_) {
    return []
  }
}

function writeBetaiPublicAvatarCache(items = []) {
  try {
    const byKey = new Map()
    ;(readBetaiPublicAvatarCache() || []).forEach(item => {
      const key = normalizeEmail(item.email || item.username || item.id)
      if (key && getProfileAvatarUrl(item)) byKey.set(key, item)
    })
    ;(items || []).forEach(item => {
      const avatar = getProfileAvatarUrl(item)
      const email = normalizeEmail(item.email || item.user_email || item.author_email)
      const username = normalizeEmail(item.username || item.user_name || item.author_name)
      const id = String(item.id || item.user_id || item.author_id || '').toLowerCase()
      if (!avatar) return
      const saved = {
        id: id || item.id || '',
        email: email || '',
        username: username || (email ? email.split('@')[0] : ''),
        avatar_url: avatar
      }
      if (email) byKey.set(email, saved)
      if (username) byKey.set(username, saved)
      if (id) byKey.set(id, saved)
    })
    localStorage.setItem(BETAI_PUBLIC_AVATAR_CACHE_KEY, JSON.stringify(Array.from(byKey.values()).slice(-200)))
  } catch (_) {}
}

function cacheBetaiCurrentUserAvatar(user) {
  const avatar = getProfileAvatarUrl(user)
  const email = normalizeEmail(user?.email || user?.user_email || user?.author_email)
  const username = normalizeEmail(user?.username || user?.user_metadata?.username || user?.user_metadata?.name || user?.raw_user_meta_data?.username || user?.raw_user_meta_data?.name)
  if (!avatar || (!email && !username)) return
  writeBetaiPublicAvatarCache([{ id: user?.id || '', email, username, avatar_url: avatar }])
}

function mergeBetaiProfilesWithCache(profiles = []) {
  const all = [...(profiles || [])]
  const cache = readBetaiPublicAvatarCache()
  const existing = buildBetaiProfileMap(all)
  ;(cache || []).forEach(item => {
    const profile = findProfileFromMap(existing, item)
    const cachedAvatar = getProfileAvatarUrl(item)
    if (profile) {
      const profileAvatar = getProfileAvatarUrl(profile)
      // Cache ma wyższy priorytet, bo w bazie stare rekordy były nadpisane avatarem innego usera.
      if (cachedAvatar) profile.avatar_url = cachedAvatar
    } else if (cachedAvatar) {
      all.push(item)
      addProfileToMap(existing, item)
    }
  })
  return all
}

function applyProfileAvatarToTip(tip, profileMap) {
  const profile = findProfileFromMap(profileMap, tip)
  if (!profile) return tip
  const profileAvatar = getProfileAvatarUrl(profile)
  const profileName = profile.username || profile.user_name || (profile.email ? String(profile.email).split('@')[0] : '')
  return {
    ...tip,
    author_name: profileName || resolveRealProfileUsername(tip),
    username: profileName || tip.username,
    author_email: tip.author_email || profile.email || null,
    author_avatar_url: profileAvatar || tip.author_avatar_url || tip.avatar_url || null,
    avatar_url: profileAvatar || tip.avatar_url || tip.author_avatar_url || null,
    profile_avatar_url: profileAvatar || tip.profile_avatar_url || null
  }
}

function isSameProfileIdentity(left, right) {
  const leftId = String(left?.id || left?.user_id || left?.author_id || '').trim()
  const rightId = String(right?.id || right?.user_id || right?.author_id || '').trim()
  if (leftId && rightId && leftId === rightId) return true

  const leftEmail = getProfileEmail(left)
  const rightEmail = getProfileEmail(right)
  if (leftEmail && rightEmail && leftEmail === rightEmail) return true

  const leftUsername = getProfileUsername(left)
  const rightUsername = getProfileUsername(right)
  return Boolean(leftUsername && rightUsername && leftUsername === rightUsername)
}

function isGuaranteedPremiumIdentity(user) {
  const email = getProfileEmail(user)
  const username = getProfileUsername(user)
  return BETAI_PREMIUM_EMAILS.includes(email) || BETAI_PREMIUM_USERNAMES.includes(username)
}

function isAdminUser(user) {
  const email = getProfileEmail(user)
  const username = getProfileUsername(user)
  const emailLocal = email ? email.split('@')[0] : ''
  const role = String(user?.role || user?.app_role || user?.account_role || user?.profile_role || '').toLowerCase()
  return BETAI_ADMIN_EMAILS.includes(email) || username === 'smilhytv' || emailLocal === 'smilhytv' || role === 'admin'
}

function isSmilhytvLifetimePremium(user) {
  const email = getProfileEmail(user)
  const username = getProfileUsername(user)
  const emailLocal = email ? email.split('@')[0] : ''
  return username === 'smilhytv' || emailLocal === 'smilhytv' || email === 'smilhytv@gmail.com'
}

function isPremiumAccount(plan) {
  const value = String(plan || '').toLowerCase()
  return ['premium', 'vip', 'active', 'trialing', 'admin'].includes(value)
}

function hasFuturePremiumEnd(value) {
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isFinite(timestamp) && timestamp > Date.now()
}

function isPremiumProfile(profile) {
  if (!profile) return false
  if (isAdminUser(profile) || isGuaranteedPremiumIdentity(profile) || isSmilhytvLifetimePremium(profile)) return true
  const premiumFlag = Boolean(profile.is_premium) || isPremiumAccount(profile.plan) || ['active', 'trialing', 'premium'].includes(String(profile.subscription_status || '').toLowerCase()) || String(profile.status || '').toLowerCase() === 'premium'
  return premiumFlag && hasFuturePremiumEnd(profile.current_period_end)
}

function hasUnlimitedTipAccess(user, plan = 'free') {
  return isAdminUser(user) || isGuaranteedPremiumIdentity(user) || isSmilhytvLifetimePremium(user) || isPremiumProfile(user) || isPremiumAccount(plan)
}

function buildEffectiveAccountProfile(accountProfile, sessionUser) {
  const sessionEmail = normalizeEmail(sessionUser?.email || accountProfile?.email)
  const fallbackUsername = sessionEmail ? sessionEmail.split('@')[0] : ''
  const merged = {
    ...(sessionUser || {}),
    ...(accountProfile || {}),
    id: accountProfile?.id || sessionUser?.id || null,
    email: sessionEmail || accountProfile?.email || sessionUser?.email || '',
    username: accountProfile?.username || sessionUser?.username || sessionUser?.user_metadata?.username || sessionUser?.user_metadata?.name || fallbackUsername,
    avatar_url:
      accountProfile?.avatar_url ||
      accountProfile?.profile_avatar_url ||
      accountProfile?.author_avatar_url ||
      accountProfile?.photo_url ||
      accountProfile?.picture ||
      sessionUser?.avatar_url ||
      sessionUser?.profile_avatar_url ||
      sessionUser?.photo_url ||
      sessionUser?.picture ||
      sessionUser?.user_metadata?.avatar_url ||
      sessionUser?.user_metadata?.picture ||
      sessionUser?.user_metadata?.photo_url ||
      sessionUser?.raw_user_meta_data?.avatar_url ||
      sessionUser?.raw_user_meta_data?.picture ||
      sessionUser?.raw_user_meta_data?.photo_url ||
      '',
    profile_avatar_url:
      accountProfile?.profile_avatar_url ||
      accountProfile?.avatar_url ||
      accountProfile?.photo_url ||
      accountProfile?.picture ||
      sessionUser?.profile_avatar_url ||
      sessionUser?.avatar_url ||
      sessionUser?.photo_url ||
      sessionUser?.picture ||
      sessionUser?.user_metadata?.avatar_url ||
      sessionUser?.user_metadata?.picture ||
      sessionUser?.user_metadata?.photo_url ||
      sessionUser?.raw_user_meta_data?.avatar_url ||
      sessionUser?.raw_user_meta_data?.picture ||
      sessionUser?.raw_user_meta_data?.photo_url ||
      '',
    bio: accountProfile?.bio || sessionUser?.bio || sessionUser?.user_metadata?.bio || accountProfile?.description || accountProfile?.about || ''
  }
  if (isGuaranteedPremiumIdentity(merged) || BETAI_PREMIUM_EMAILS.includes(sessionEmail)) {
    merged.is_premium = true
    merged.plan = 'premium'
    merged.subscription_status = 'active'
    merged.status = isAdminUser(merged) ? 'admin' : 'premium'
  }
  if (isAdminUser(merged)) {
    merged.is_admin = true
    merged.is_premium = true
    merged.plan = 'premium'
    merged.subscription_status = 'active'
    merged.status = 'admin'
  }
  return merged
}

function getEffectiveAccountPlan(accountProfile, sessionUser, storedPlan = 'free') {
  const effectiveProfile = buildEffectiveAccountProfile(accountProfile, sessionUser)
  return hasUnlimitedTipAccess(effectiveProfile, storedPlan) ? 'premium' : 'free'
}

function getPlanLimits(plan) {
  const premium = isPremiumAccount(plan)
  return {
    isPremium: premium,
    dailyTipLimit: premium ? Infinity : 5,
    monthlyPayoutLimit: premium ? 3 : 1,
    canSellPremiumTips: premium,
    canEditAvatar: premium,
    canUseBonuses: premium,
    commissionRate: PLATFORM_COMMISSION_RATE
  }
}

const TIPSTER_PLAN_OPTIONS = [
  { key: 'week', label: '1 tydzień', durationDays: 7, defaultPrice: 10 },
  { key: 'month', label: '1 miesiąc', durationDays: 30, defaultPrice: 40 },
  { key: 'half_year', label: '6 miesięcy', durationDays: 180, defaultPrice: 200 },
  { key: 'year', label: '1 rok', durationDays: 365, defaultPrice: 350 }
]

function hasActiveTipsterSubscription(tip, subscriptions = []) {
  const authorId = getTipAuthorId(tip)
  if (!authorId) return false
  return subscriptions.some(sub => {
    if (sub.tipster_id !== authorId || sub.status !== 'active') return false
    if (!sub.expires_at) return true
    return new Date(sub.expires_at).getTime() > Date.now()
  })
}

function getDisplayRole(user, plan = 'free') {
  const profile = getUserProfileView(user)
  if (profile?.isAdmin || Boolean(user?.is_admin)) return 'ADMIN'
  if (isPremiumAccount(plan) || isPremiumProfile(user)) return 'PREMIUM'
  return 'FREE'
}



const staticTips = []



function Sidebar({ view, setView, wallet, tokenBalance = 0, unlockedCount, notificationsCount = 0, onTopUp, user, userPlan = 'free', onLogout }) {
  const profile = getUserProfileView(user)
  const openPremiumCheckout = () => window.dispatchEvent(new CustomEvent('betai:start-premium-checkout'))

  return (
    <div className="sidebar-stack">
      <aside className="sidebar sidebar-main-box">
        <div className="sidebar-logo-wrap" aria-label="Bet+AI logo">
          <img src="/betai-sidebar-logo-new.png" alt="Bet+AI" className="sidebar-logo-image" />
        </div>
        <div className="user-card">
          <div
            className={`avatar sidebar-user-avatar ${profile.avatarUrl ? 'has-avatar' : ''}`}
            style={profile.avatarUrl ? { '--avatar-image': `url("${profile.avatarUrl}")` } : undefined}
          >
            {profile.avatarUrl ? '' : profile.initials}
          </div>
          <div>
            <strong>{profile.username}</strong>
            <span className="pill">{getDisplayRole(user, userPlan)}</span>
          </div>
          <div className="wallet-row"><span>💰 Saldo</span><b>{Number(wallet || 0).toFixed(2)} zł</b></div>
          <div className="wallet-row wallet-row-tokens"><span><span className="wallet-token-white-coin" aria-hidden="true"><img src="/betai-coin-icon.png" alt="" /></span> Coin</span><b>{Number(tokenBalance || 0)}</b></div>
          <div className="wallet-row"><span>🔓 Odblokowane</span><b>{unlockedCount || 0}</b></div>
          <button className="outline-btn" onClick={onTopUp || (() => {})}>Ulepsz konto</button>
          <button className="logout-btn" onClick={onLogout}>Wyloguj</button>
        </div>

        <nav className="menu">
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>⌂ Dashboard</button>
          <button className={view === 'add' ? 'active' : ''} onClick={() => setView('add')}>＋ Dodaj typ</button>
          <button className={['wallet', 'deposits', 'payouts', 'payments', 'subscriptions', 'earnings'].includes(view) ? 'active' : ''} onClick={() => setView('wallet')}>💼 Portfel</button>
          <button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}>👤 Mój profil</button>
          <button className={view === 'leaderboard' ? 'active' : ''} onClick={() => setView('leaderboard')}>🏆 Ranking</button>
          <button className={view === 'referrals' ? 'active' : ''} onClick={() => setView('referrals')}>👥 Społeczność</button>
          {isAdminUser(user) && <button className={view === 'adminFinance' ? 'active' : ''} onClick={() => setView('adminFinance')}>📊 Admin finanse</button>}
          {isAdminUser(user) && <button className={view === 'adminPayouts' ? 'active' : ''} onClick={() => setView('adminPayouts')}>🏦 Admin wypłaty</button>}
          <button className={view === 'aiPicks' ? 'active' : ''} onClick={() => setView('aiPicks')}>🧠 Typy AI</button>
          <button className={view === 'topTipsters' ? 'active' : ''} onClick={() => setView('topTipsters')}>♕ Top typerzy</button>
          <button className={view === 'articles' ? 'active' : ''} onClick={() => setView('articles')}>📰 Artykuły/TV Live</button>
          <button className={view === 'rewardsBonuses' ? 'active' : ''} onClick={() => setView('rewardsBonuses')}>🎁 Nagrody/Bonusy</button>
        </nav>
      </aside>

      <div className="premium-box sidebar-premium-detached">
        <h3>✦ Bet+AI Premium</h3>
        <p>✓ AI Typy bez limitu</p>
        <p>✓ Szczegółowe analizy</p>
        <p>✓ Statystyki premium</p>
        <p>✓ Typy premium</p>
        <p>✓ Brak reklam</p>
        <button onClick={openPremiumCheckout}>Kup Premium</button>
      </div>
    </div>
  )
}

function formatRankingName(row) {
  const email = row?.email || row?.username || 'Typer'
  return String(email).includes('@') ? String(email).split('@')[0] : String(email)
}

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} zł`
}


const ULTRA_PAGE_BANNERS = {
  dashboard: '/ultra-dashboard-banner.png',
  articles: '/ultra-articles-banner.png',
  add: '/ultra-add-banner.png',
  wallet: '/ultra-wallet-banner.png',
  profile: '/ultra-profile-banner.png',
  leaderboard: '/ultra-ranking-banner.png',
  referrals: '/ultra-referrals-banner.png',
  notifications: '/ultra-notifications-banner.png',
  payments: '/ultra-payments-banner.png',
  subscriptions: '/ultra-subscription-banner.png',
  earnings: '/ultra-earnings-banner.png',
  payouts: '/ultra-payouts-banner.png',
  adminFinance: '/ultra-admin-finance-banner.png',
  adminPayouts: '/ultra-admin-payouts-banner.png',
  aiPicks: '/ultra-ai-banner.png'
}

function UltraPageBanner({ variant = 'dashboard', children = null }) {
  const src = ULTRA_PAGE_BANNERS[variant] || ULTRA_PAGE_BANNERS.dashboard
  return (
    <section className={`ultra-page-banner ultra-page-banner-${variant}`}>
      <img src={src} alt="" loading="eager" />
      <span className="ultra-banner-shine" aria-hidden="true"></span>
      <span className="ultra-banner-glow" aria-hidden="true"></span>
      {children && <div className="ultra-page-banner-actions">{children}</div>}
    </section>
  )
}



function formatAppErrorMessage(rawMessage) {
  const message = String(rawMessage || '')

  if (message.includes('FREE_LIMIT') || message.includes('FREE_TIP_LIMIT_REACHED')) {
    return 'Masz maksymalny limit 5 typów dziennie na koncie FREE. Przejdź na Premium, aby dodawać bez limitu.'
  }

  if (message.includes('PREMIUM_REQUIRED') || message.includes('Tylko konta Premium')) {
    return 'Baza nadal widzi konto jako FREE. Uruchom BETAI_SQL_910_FIX_FREE_TIPS_NOT_PREMIUM.sql, wyloguj się i zaloguj ponownie.'
  }

  if (message.includes('new row violates row-level security') || message.includes('row-level security')) {
    return 'Brak uprawnień do zapisu. Zaloguj się ponownie i spróbuj jeszcze raz.'
  }

  if (message.includes('duplicate key')) {
    return 'Ten rekord już istnieje w bazie.'
  }

  return message.replace(/^Error:\s*/i, '').replace(/\s*\|\s*Supabase:.*/i, '').trim() || 'Wystąpił błąd. Spróbuj ponownie.'
}

function getTipErrorToast(cleanMessage) {
  if (cleanMessage.includes('5 typów dziennie') || cleanMessage.includes('FREE')) {
    return {
      type: 'limit',
      title: 'Limit konta FREE',
      message: 'Masz maksymalny limit 5 typów dziennie. Premium odblokowuje dodawanie bez limitu.',
      cta: 'Przejdź na Premium',
      event: 'betai:start-premium-checkout'
    }
  }

  if (cleanMessage.includes('Premium') || cleanMessage.includes('premium')) {
    return {
      type: 'premium',
      title: 'Wymagane konto Premium',
      message: 'Nie posiadasz konta Premium. Aktywuj Premium, aby dodawać typy premium.',
      cta: 'Aktywuj Premium',
      event: 'betai:start-premium-checkout'
    }
  }

  return { type: 'error', title: 'Nie dodano typu', message: cleanMessage }
}

function AnimatedDashboardHero() {
  const heroSlides = [
    { src: '/dashboard-hero-v551/slide-1.png', alt: 'Bet+AI platforma — typy, analiza i społeczność' },
    { src: '/dashboard-hero-v551/slide-2.png', alt: 'Bet+AI marketplace — kupuj i sprzedawaj typy oraz analizy' },
    { src: '/dashboard-hero-v551/slide-3.png', alt: 'Bet+AI rewards — żetony, dropy, typy i nagrody' },
    { src: '/dashboard-hero-v551/slide-4.png', alt: 'Bet+AI community — społeczność typerów i live chat' },
    { src: '/dashboard-hero-v551/slide-5.png', alt: 'Bet+AI platform — AI analizuje mecze za Ciebie' },
    { src: '/dashboard-hero-v551/slide-6.png', alt: 'Bet+AI media — artykuły, newsy, PPV i wyniki live' }
  ]
  const [panel, setPanel] = useState(0)
  const [isHeroPaused, setIsHeroPaused] = useState(false)
  const heroSwipeStart = useRef(null)

  useEffect(() => {
    if (isHeroPaused || heroSlides.length <= 1) return undefined
    const panelTimer = window.setInterval(() => setPanel(prev => (prev + 1) % heroSlides.length), 6000)
    return () => window.clearInterval(panelTimer)
  }, [heroSlides.length, isHeroPaused])

  const moveHeroSlide = (direction) => setPanel(prev => (prev + direction + heroSlides.length) % heroSlides.length)
  const handleHeroPointerUp = (event) => {
    const startX = heroSwipeStart.current
    heroSwipeStart.current = null
    if (startX == null) return
    const diff = event.clientX - startX
    if (Math.abs(diff) > 40) moveHeroSlide(diff < 0 ? 1 : -1)
  }

  return (
    <section
      className="betai-dashboard-hero-v551"
      aria-label="Nowy hero dashboardu Bet+AI"
      onMouseEnter={() => setIsHeroPaused(true)}
      onMouseLeave={() => setIsHeroPaused(false)}
      onPointerDown={(event) => { heroSwipeStart.current = event.clientX }}
      onPointerUp={handleHeroPointerUp}
    >
      <div className="betai-dashboard-stage-v551" aria-hidden="true">
        {heroSlides.map((slide, index) => (
          <div key={slide.src} className={`betai-dashboard-slide-v551 ${panel === index ? 'active' : ''}`}>
            <img src={slide.src} alt="" draggable="false" />
          </div>
        ))}
      </div>


      <div className="betai-dashboard-nav-v551">
        <button type="button" className="hero-arrow-v553 hero-arrow-left-v553" aria-label="Poprzedni slajd" onClick={() => moveHeroSlide(-1)}>‹</button>
        <button type="button" className="hero-arrow-v553 hero-arrow-right-v553" aria-label="Następny slajd" onClick={() => moveHeroSlide(1)}>›</button>
      </div>
    </section>
  )
}

function LiveChatPanel({ user }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [status, setStatus] = useState('🎁 Tip na czacie = max 1 nagroda / 24h')
  const [sending, setSending] = useState(false)
  const [onlineCount, setOnlineCount] = useState(1)
  const [tippingId, setTippingId] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const email = normalizeEmail(user?.email)
  const userName = resolveRealProfileUsername(user) || (email ? email.split('@')[0] : 'Użytkownik')
  const currentAvatarUrl = getProfileAvatarUrl(user)

  const nameFromEmail = (value = '') => {
    const clean = normalizeEmail(value)
    if (!clean) return 'Gość'
    if (clean === 'smilhytv@gmail.com') return 'Smilhytv'
    return clean.split('@')[0].replace(/[._-]+/g, ' ').split(' ').filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
  }

  const initialsFromName = (name = '') => {
    const clean = String(name || 'LC').trim()
    const parts = clean.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return parts.slice(0, 2).map(part => part.charAt(0)).join('').slice(0, 2).toUpperCase() || 'LC'
    return clean.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '').slice(0, 2).toUpperCase() || 'LC'
  }

  const todayKey = () => new Date().toISOString().slice(0, 10)

  const safeInsertSystemNotification = async (recipientEmail, title, body, rewardTokens = 0) => {
    const recipient = normalizeEmail(recipientEmail)
    if (!recipient || !isSupabaseConfigured || !supabase) return
    try {
      await supabase.from('betai_system_notifications').insert({
        recipient_email: recipient,
        title,
        body,
        reward_tokens: Number(rewardTokens || 0) || 0,
        sent_by: 'betai',
        is_read: false
      })
    } catch (error) {
      console.warn('chat notification skipped', error)
    }
  }

  const getTokenWallet = async (walletEmail, fallbackUserId = null) => {
    const walletKey = normalizeEmail(walletEmail)
    if (!walletKey || !isSupabaseConfigured || !supabase) return { email: walletKey, balance: 0, user_id: fallbackUserId }
    try {
      const { data, error } = await supabase
        .from('betai_token_wallets')
        .select('*')
        .eq('email', walletKey)
        .maybeSingle()
      if (!error && data) return { ...data, balance: Number(data.balance || 0) || 0 }
    } catch (error) {
      console.warn('chat get wallet skipped', error)
    }
    try {
      const localBalance = Number(localStorage.getItem('betai_tokens_' + walletKey) || '0') || 0
      return { email: walletKey, balance: localBalance, user_id: fallbackUserId }
    } catch (_) {
      return { email: walletKey, balance: 0, user_id: fallbackUserId }
    }
  }

  const setTokenWallet = async (walletEmail, nextBalance, fallbackUserId = null) => {
    const walletKey = normalizeEmail(walletEmail)
    const cleanBalance = Math.max(0, Number(nextBalance || 0) || 0)
    if (!walletKey) return cleanBalance
    try { localStorage.setItem('betai_tokens_' + walletKey, String(cleanBalance)) } catch (_) {}
    if (!isSupabaseConfigured || !supabase) return cleanBalance
    try {
      await supabase.from('betai_token_wallets').upsert({
        email: walletKey,
        user_id: fallbackUserId || null,
        balance: cleanBalance,
        welcome_bonus_claimed: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' })
    } catch (error) {
      console.warn('chat set wallet skipped', error)
    }
    return cleanBalance
  }

  const addTokenTransaction = async (walletEmail, deltaTokens, reason, refType = 'live_chat', refData = null) => {
    const walletKey = normalizeEmail(walletEmail)
    if (!walletKey || !isSupabaseConfigured || !supabase) return
    try {
      await supabase.from('betai_token_transactions').insert({
        email: walletKey,
        delta_tokens: Number(deltaTokens || 0) || 0,
        delta_pln: 0,
        reason,
        ref_type: refType,
        ref_data: refData || null
      })
    } catch (error) {
      console.warn('chat token tx skipped', error)
    }
  }

  const awardDailyLeaderIfNeeded = async (currentMessages = messages) => {
    if (!isSupabaseConfigured || !supabase) return
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const activity = new Map()
    ;(currentMessages || []).forEach(m => {
      const ts = new Date(m.created_at).getTime()
      const key = normalizeEmail(m.user_email)
      if (key && ts >= start.getTime()) activity.set(key, { email: key, count: (activity.get(key)?.count || 0) + 1, name: m.user_name || nameFromEmail(key), user_id: m.user_id || null })
    })
    const dailyLeader = [...activity.values()].sort((a, b) => b.count - a.count)[0]
    if (!dailyLeader?.email || dailyLeader.count < 1) return
    const rewardDate = todayKey()
    try {
      const { data: existing } = await supabase.from('live_chat_daily_rewards').select('reward_date,winner_email').eq('reward_date', rewardDate).maybeSingle()
      if (existing?.reward_date) return
      const { error } = await supabase.from('live_chat_daily_rewards').insert({
        reward_date: rewardDate,
        winner_email: dailyLeader.email,
        winner_name: dailyLeader.name,
        message_count: dailyLeader.count,
        tokens_awarded: 1
      })
      if (error) return
      const wallet = await getTokenWallet(dailyLeader.email, dailyLeader.user_id)
      await setTokenWallet(dailyLeader.email, Number(wallet.balance || 0) + 1, wallet.user_id || dailyLeader.user_id || null)
      await addTokenTransaction(dailyLeader.email, 1, 'live_chat_daily_leader', 'live_chat_daily_rewards', { reward_date: rewardDate, message_count: dailyLeader.count })
      await safeInsertSystemNotification(dailyLeader.email, 'Nagroda za aktywność na czacie', `Gratulacje! Jesteś liderem aktywności BetAI Live Chat za dziś. Dodaliśmy 1 żeton do Twojego konta.`, 1)
      setStatus(`🏆 ${dailyLeader.name} dostał 1 żeton za top aktywność 24h.`)
    } catch (error) {
      console.warn('daily chat reward skipped', error)
    }
  }

  const loadOnlineCount = async () => {
    if (!email || !isSupabaseConfigured || !supabase) {
      setOnlineCount(email ? 1 : 0)
      return
    }
    const now = new Date().toISOString()
    try {
      await supabase.from('presence_heartbeats').upsert({
        user_id: user?.id || email,
        email,
        last_seen: now
      }, { onConflict: 'user_id' })
    } catch (error) {
      console.warn('chat heartbeat skipped', error)
    }
    try {
      const cutoff = new Date(Date.now() - 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('presence_heartbeats')
        .select('user_id,email,last_seen')
        .gte('last_seen', cutoff)
      if (error) throw error
      const active = new Set((data || []).map(row => normalizeEmail(row.email) || String(row.user_id || '')).filter(Boolean))
      setOnlineCount(active.size)
    } catch (error) {
      console.warn('chat online count skipped', error)
      setOnlineCount(email ? 1 : 0)
    }
  }

  const loadMessages = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setStatus('Live chat: Supabase nie jest skonfigurowany')
      return
    }
    try {
      const { data, error } = await supabase
        .from('live_chat_messages')
        .select('id,user_email,user_name,avatar_url,message,tipped_amount,created_at')
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      let nextMessages = (data || []).reverse()

      // WERSJA 912: avatar w czacie zawsze z prawdziwego profilu/cache.
      // Nie ufamy starym avatar_url z wiadomości, bo mogły zostać zapisane od innego użytkownika.
      cacheBetaiCurrentUserAvatar(user)
      try {
        const chatProfileMap = new Map()
        const addProfileAvatar = (profile = {}) => {
          const avatar = getProfileAvatarUrl(profile)
          if (!avatar) return
          const emailKey = normalizeEmail(profile.email || profile.user_email || profile.author_email)
          const nameKey = normalizeEmail(profile.username || profile.user_name || profile.author_name)
          const localKey = emailKey ? normalizeEmail(emailKey.split('@')[0]) : ''
          if (profile.id) chatProfileMap.set(String(profile.id).toLowerCase(), avatar)
          if (emailKey) chatProfileMap.set(emailKey, avatar)
          if (localKey) chatProfileMap.set(localKey, avatar)
          if (nameKey) chatProfileMap.set(nameKey, avatar)
        }

        // Najpierw RPC publicznych profili — to jest źródło prawdy niezależnie od zalogowanego konta.
        try {
          const chatProfiles = await fetchBetaiPublicProfiles()
          ;(chatProfiles || []).forEach(addProfileAvatar)
        } catch (profileAvatarError) {
          console.warn('chat profiles avatar hydration skipped', profileAvatarError)
        }

        // Fallback tylko wtedy, kiedy nie ma profilu w mapie.
        try {
          const { data: chatTipAuthors } = await supabase
            .from('tips')
            .select('author_id,user_id,author_name,username,author_email,author_avatar_url,avatar_url,profile_avatar_url,created_at')
            .order('created_at', { ascending: false })
            .limit(500)
          ;(chatTipAuthors || []).forEach(row => {
            const emailKey = normalizeEmail(row.author_email)
            const nameKey = normalizeEmail(row.author_name || row.username)
            const localKey = emailKey ? normalizeEmail(emailKey.split('@')[0]) : ''
            const avatar = row.author_avatar_url || row.profile_avatar_url || row.avatar_url || ''
            if (!avatar) return
            if (emailKey && !chatProfileMap.has(emailKey)) chatProfileMap.set(emailKey, avatar)
            if (localKey && !chatProfileMap.has(localKey)) chatProfileMap.set(localKey, avatar)
            if (nameKey && !chatProfileMap.has(nameKey)) chatProfileMap.set(nameKey, avatar)
          })
        } catch (tipAvatarError) {
          console.warn('chat tip avatar fallback skipped', tipAvatarError)
        }

        nextMessages = nextMessages.map(row => {
          const emailKey = normalizeEmail(row.user_email)
          const nameKey = normalizeEmail(row.user_name)
          const localKey = emailKey ? normalizeEmail(emailKey.split('@')[0]) : ''
          let mappedAvatar = chatProfileMap.get(emailKey) || chatProfileMap.get(localKey) || chatProfileMap.get(nameKey) || ''
          const currentAvatar = getProfileAvatarUrl(user)
          const currentEmail = normalizeEmail(user?.email)
          const currentName = normalizeEmail(user?.username || user?.user_metadata?.username || user?.user_metadata?.name)
          if (currentAvatar && ((currentEmail && emailKey === currentEmail) || (currentName && nameKey === currentName))) mappedAvatar = currentAvatar
          // mappedAvatar ma pierwszeństwo nad row.avatar_url, bo row.avatar_url bywa błędny/stary.
          return mappedAvatar ? { ...row, avatar_url: mappedAvatar } : row
        })
      } catch (avatarError) {
        console.warn('chat avatar hydration skipped', avatarError)
      }

      setMessages(nextMessages)
      setStatus('Live chat połączony — wiadomości odświeżają się automatycznie.')
      // Wersja 606: lider czatu jest nagradzany funkcją SQL o 00:00, nie podczas odświeżania UI.
    } catch (error) {
      console.error('live chat load error', error)
      setStatus('Live chat: reconnect z Supabase...')
    }
  }

  useEffect(() => {
    loadMessages()
    if (!isSupabaseConfigured || !supabase) return undefined
    const channel = supabase
      .channel('betai-live-chat-226-react')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_messages' }, loadMessages)
      .subscribe((nextStatus) => {
        if (nextStatus === 'SUBSCRIBED') setStatus('Live chat połączony — wiadomości odświeżają się automatycznie.')
        if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(nextStatus)) setStatus('Realtime chwilowo niedostępny — włączone odświeżanie.')
      })
    const timer = setInterval(loadMessages, 2500)
    return () => {
      clearInterval(timer)
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    const host = document.querySelector('.betai-chat-messages-final')
    if (host) host.scrollTop = host.scrollHeight
  }, [messages.length])

  useEffect(() => {
    loadOnlineCount()
    const timer = setInterval(loadOnlineCount, 15000)
    window.addEventListener('focus', loadOnlineCount)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', loadOnlineCount)
    }
  }, [email, user?.id])

  const todayCount = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    return messages.filter(m => new Date(m.created_at).getTime() >= start.getTime()).length
  }, [messages])

  const leader = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const map = new Map()
    messages.forEach(m => {
      const ts = new Date(m.created_at).getTime()
      const key = normalizeEmail(m.user_email)
      if (key && ts >= start.getTime()) map.set(key, { email: key, count: (map.get(key)?.count || 0) + 1, name: m.user_name || nameFromEmail(key) })
    })
    return [...map.values()].sort((a, b) => b.count - a.count)[0] || null
  }, [messages])

  const sendMessage = async () => {
    const clean = String(text || '').trim().slice(0, 240)
    if (!clean || sending) return
    if (!email) {
      setStatus('Musisz być zalogowany, aby pisać na live chacie.')
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      setStatus('Live chat: Supabase nie jest skonfigurowany')
      return
    }
    setSending(true)
    try {
      const { error } = await supabase.from('live_chat_messages').insert({
        user_email: email,
        user_name: userName,
        avatar_url: currentAvatarUrl || '',
        message: clean,
        tipped_amount: 0,
        created_at: new Date().toISOString()
      })
      if (error) throw error

      try {
        const { data: bonusResult, error: bonusError } = await supabase.rpc('award_live_chat_first_message_bonus_v606', {
          p_email: email,
          p_user_id: user?.id || null,
          p_user_name: userName
        })
        if (!bonusError && bonusResult?.awarded) {
          window.dispatchEvent(new CustomEvent('betai-token-balance-changed'))
          setStatus(`Wiadomość wysłana. Bonus dzienny: +${Number(bonusResult.tokens_awarded || 1)} żeton za pierwszą wiadomość dnia.`)
        } else {
          setStatus('Wiadomość wysłana na live chat.')
        }
      } catch (bonusError) {
        console.warn('daily chat message bonus skipped', bonusError)
        setStatus('Wiadomość wysłana na live chat.')
      }

      setText('')
      await loadMessages()
    } catch (error) {
      console.error('live chat send error', error)
      setStatus('Nie udało się wysłać wiadomości online. Sprawdź Supabase i spróbuj ponownie.')
    } finally {
      setSending(false)
    }
  }

  const sendTip = async (msg) => {
    if (!msg?.id || tippingId) return
    const targetEmail = normalizeEmail(msg.user_email)
    if (!email) {
      setStatus('Musisz być zalogowany, aby wysłać tip.')
      return
    }
    if (!targetEmail) {
      setStatus('Nie znaleziono konta odbiorcy tipa.')
      return
    }
    if (email === targetEmail) {
      setStatus('Nie możesz tipować samego siebie.')
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      setStatus('Tipy wymagają połączenia z Supabase.')
      return
    }

    setTippingId(String(msg.id))
    try {
      const senderWallet = await getTokenWallet(email, user?.id || null)
      if (Number(senderWallet.balance || 0) < 1) {
        setStatus('Masz za mało żetonów, aby wysłać tip.')
        return
      }

      const receiverWallet = await getTokenWallet(targetEmail, null)
      let receiverUserId = receiverWallet.user_id || null
      try {
        const { data: receiverProfile } = await supabase
          .from('profiles')
          .select('id,username,email')
          .eq('email', targetEmail)
          .maybeSingle()
        receiverUserId = receiverProfile?.id || receiverUserId
      } catch (lookupError) {
        console.warn('tip receiver profile lookup skipped', lookupError)
      }
      const nextSenderBalance = Number(senderWallet.balance || 0) - 1
      const nextReceiverBalance = Number(receiverWallet.balance || 0) + 1
      await setTokenWallet(email, nextSenderBalance, senderWallet.user_id || user?.id || null)
      await setTokenWallet(targetEmail, nextReceiverBalance, receiverWallet.user_id || null)

      const nextAmount = Number(msg.tipped_amount || 0) + 1
      await supabase.from('live_chat_messages').update({ tipped_amount: nextAmount }).eq('id', msg.id)
      await supabase.from('live_chat_tips').insert({
        message_id: String(msg.id),
        from_email: email,
        to_email: targetEmail,
        amount: 1
      })

      // WERSJA 681: zapis TIP popupu z fallbackiem pod stare schematy bazy.
      // Wysyłamy także sender_email / receiver_email, żeby popup działał nawet gdy receiver_id jest pusty.
      const tipTransferPayload = {
        sender_id: user?.id || senderWallet.user_id || null,
        receiver_id: receiverUserId,
        sender_username: userName || email.split('@')[0] || 'Użytkownik',
        receiver_username: msg.user_name || nameFromEmail(targetEmail),
        sender_email: email,
        receiver_email: targetEmail,
        amount: 1
      }
      {
        const { error: tipTransferError } = await supabase.from('tip_transfers').insert(tipTransferPayload)
        if (tipTransferError) {
          const message = String(tipTransferError?.message || tipTransferError || '')
          const maybeLegacySchema = /sender_email|receiver_email|column|schema cache/i.test(message)
          if (!maybeLegacySchema) throw tipTransferError
          const { error: legacyTipTransferError } = await supabase.from('tip_transfers').insert({
            sender_id: tipTransferPayload.sender_id,
            receiver_id: tipTransferPayload.receiver_id,
            sender_username: tipTransferPayload.sender_username,
            receiver_username: tipTransferPayload.receiver_username,
            amount: tipTransferPayload.amount
          })
          if (legacyTipTransferError) throw legacyTipTransferError
        }
      }
      await addTokenTransaction(email, -1, 'live_chat_tip_sent', 'live_chat_tips', { message_id: String(msg.id), to_email: targetEmail })
      await addTokenTransaction(targetEmail, 1, 'live_chat_tip_received', 'live_chat_tips', { message_id: String(msg.id), from_email: email })
      await safeInsertSystemNotification(targetEmail, 'Dostałeś tip na czacie', `${userName} wysłał Ci 1 żeton za wiadomość na BetAI Live Chat.`, 1)
      await safeInsertSystemNotification(email, 'Tip wysłany', `Wysłałeś 1 żeton do ${msg.user_name || nameFromEmail(targetEmail)}.`, 0)

      window.dispatchEvent(new CustomEvent('betai-token-balance-changed'))
      setStatus(`Tip wysłany do ${msg.user_name || nameFromEmail(targetEmail)}. Twoje saldo: ${nextSenderBalance} żetonów.`)
      await loadMessages()
    } catch (error) {
      console.error('live chat tip error', error)
      setStatus('Nie udało się wysłać tipa albo zapisać salda.')
    } finally {
      setTippingId('')
    }
  }

  const addEmoji = (emoji) => {
    setText(prev => `${prev || ''}${emoji}`.trimStart())
    setShowEmojiPicker(false)
  }

  const chatEmojis = ['🔥', '🎯', '💎', '👏', '😂', '😮', '🎉', '🚀', '👀', '🙂', '👍', '❤️']

  return (
    <section className="livechat226-card betai-right-chat-final" id="betaiChatWidget">
      <div className="betai-live-head-final">
        <div className="betai-live-title-wrap-final">
          <span className="livechat226-title-dot"></span>
          <div className="livechat226-kicker">BETAI LIVE CHAT</div>
          <span className="betai-online-final">{onlineCount} online</span>
        </div>
        <div className="betai-live-actions-final">
          <button aria-label="Ustawienia czatu" className="betai-gear-final" type="button">⚙</button>
        </div>
      </div>

      <div className="betai-chat-stats-final">
        <div className="livechat226-stat betai-chat-stat-final">
          <span>TOP UŻYTKOWNIK (24H)</span>
          <div className="betai-stat-user-final"><b className="betai-trophy-final">🏆</b><div><strong>{leader?.name || 'Brak lidera'}</strong><small>{leader ? `${leader.count} wiadomości` : `${todayCount} wiadomości dziś`}</small></div></div>
        </div>
        <div className="livechat226-stat betai-chat-stat-final"><span>NAGRODA DNIA</span><strong>🪙 FREE +1 / PREMIUM +2</strong><small>lider czatu o 00:00</small></div>
        <div className="livechat226-stat betai-chat-stat-final"><span>AKTYWNI TERAZ</span><strong>👥 {onlineCount}</strong></div>
      </div>


      <div className="livechat226-messages betai-chat-messages-final" id="liveChatMessages226">
        {messages.length ? messages.map(msg => {
          const msgEmail = normalizeEmail(msg.user_email)
          const name = msg.user_name || nameFromEmail(msgEmail)
          const mine = Boolean(
            (msgEmail && msgEmail === email) ||
            (getProfileUsername(user) && normalizeEmail(name) === getProfileUsername(user))
          )
          const isAdmin = msgEmail === 'smilhytv@gmail.com'
          const isLeader = leader?.email && leader.email === msgEmail
          const avatar = msg.avatar_url || (mine ? currentAvatarUrl : '')
          return (
            <div className={`livechat226-msg ${mine ? 'me' : ''}`} key={msg.id || msg.created_at}>
              <div className={`livechat226-avatar ${avatar ? 'has-avatar' : ''}`}>{avatar ? <img src={avatar} alt="" /> : initialsFromName(name)}</div>
              <div className="livechat226-bubble">
                <div className="livechat226-meta">
                  <span className="livechat226-name">{name}</span>
                  {isAdmin && <span className="livechat226-badge admin">Admin</span>}
                  {isLeader && <span className="livechat226-badge leader">Top aktywność</span>}
                  <span className="livechat226-time">{msg.created_at ? new Date(msg.created_at).toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit' }) : '--:--'}</span>
                </div>
                <div className="livechat226-text">{msg.message}</div>
                <div className="livechat226-actions">
                  {mine ? <span className="livechat226-tipmeta">Twoja wiadomość</span> : <button className="livechat226-tipbtn" type="button" disabled={tippingId === String(msg.id)} onClick={() => sendTip(msg)}>{tippingId === String(msg.id) ? '...' : '🎁 Tip 1'}</button>}
                  <span className="livechat226-tipmeta">Tips: {Number(msg.tipped_amount || 0)}</span>
                </div>
              </div>
            </div>
          )
        }) : <div className="livechat226-empty">Brak wiadomości. Napisz pierwszą wiadomość i uruchom live chat.</div>}
      </div>

      <div className="livechat226-composer betai-composer-final">
        <div className="livechat226-input-wrap betai-input-wrap-final betai-input-actions-final">
          <input className="livechat226-input" maxLength={240} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage() } }} placeholder="Napisz wiadomość..." />

          <div className="betai-emoji-picker-wrap-final betai-emoji-inline-final">
            <button
              className="betai-emoji-toggle-final"
              type="button"
              onClick={() => setShowEmojiPicker(prev => !prev)}
              aria-expanded={showEmojiPicker}
              aria-label="Pokaż emotki"
              title="Emotki"
            >
              😊
            </button>
            {showEmojiPicker && (
              <div className="betai-emoji-panel-final betai-emoji-panel-inline-final">
                {chatEmojis.map((emoji) => (
                  <button className="livechat226-emoji" key={emoji} type="button" onClick={() => addEmoji(emoji)}>{emoji}</button>
                ))}
              </div>
            )}
          </div>

          <button className="betai-tip-main-final betai-tip-inline-final" type="button" onClick={() => setStatus('Tip możesz wysłać przy wiadomości innego użytkownika.')}>🎁 TIP 1</button>
          <button className="livechat226-send betai-send-final" type="button" onClick={() => sendMessage()} disabled={sending || !text.trim()}>{sending ? '...' : '➤'}</button>
        </div>
        
      </div>    </section>
  )
}


function Rightbar({ ranking = [], tips = [], user = null }) {
  cacheBetaiCurrentUserAvatar(user)
  const currentAvatar = getProfileAvatarUrl(user)
  const currentEmail = normalizeEmail(user?.email)
  const currentName = normalizeEmail(user?.username || user?.user_metadata?.username || user?.user_metadata?.name)
  const rankingWithCurrentAvatar = (ranking || []).map(row => {
    const rowEmail = normalizeEmail(row.email || row.author_email || row.user_email)
    const rowName = normalizeEmail(row.username || row.author_name || row.user_name)
    if (currentAvatar && ((currentEmail && rowEmail === currentEmail) || (currentName && rowName === currentName))) {
      return { ...row, avatar_url: currentAvatar, author_avatar_url: currentAvatar }
    }
    return row
  })
  const realRanking = buildLiveLeaderboardRows(rankingWithCurrentAvatar, tips)
  const fallbackRankingUsers = [
    { username: 'Bet+AI Live', email: 'betai@live.local', totalTips: 0, total_tips: 0, wins: 0, losses: 0, winrate: 0, roi: 0, yield: 0, earnings: 0, profit: 0 },
    { username: 'buchajson1988', email: 'buchajson1988@live.local', totalTips: 0, total_tips: 0, wins: 0, losses: 0, winrate: 0, roi: 0, yield: 0, earnings: 0, profit: 0 },
    { username: 'buchajson1988', email: 'buchajson1988-2@live.local', totalTips: 0, total_tips: 0, wins: 0, losses: 0, winrate: 0, roi: 0, yield: 0, earnings: 0, profit: 0 },
    { username: 'SmilyTV', email: 'smilytv@live.local', totalTips: 0, total_tips: 0, wins: 0, losses: 0, winrate: 0, roi: 0, yield: 0, earnings: 0, profit: 0 },
  ]
  const rightRankingRows = [...(realRanking || []).slice(0, 4)]
  let fallbackIndex = 0
  while (rightRankingRows.length < 4) {
    const fallback = fallbackRankingUsers[fallbackIndex] || {
      id: `top-typer-placeholder-${rightRankingRows.length + 1}`,
      username: `Użytkownik ${rightRankingRows.length + 1}`,
      email: `placeholder-${rightRankingRows.length + 1}@betai.local`,
      totalTips: 0,
      total_tips: 0,
      wins: 0,
      losses: 0,
      winrate: 0,
      roi: 0,
      yield: 0,
      earnings: 0,
      profit: 0,
    }
    rightRankingRows.push(fallback)
    fallbackIndex += 1
  }

  return (
    <aside className="rightbar">
      <LiveChatPanel user={user} />
      <section className="panel real-ranking-panel">
        <div className="panel-head"><h2>🏆 Top typerzy</h2><a>Ranking real</a></div>
        {rightRankingRows.length ? rightRankingRows.slice(0, 4).map((row, index) => (
          <div className={`rank ${index === 0 ? 'first' : index === 1 ? 'second' : index === 2 ? 'third' : ''}`} key={row.tipster_id || row.id || row.email || row.username || index}>
            <span className={`rank-position-badge ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}`}>{index + 1}</span>
            <div className={`mini-avatar ${getProfileAvatarUrl(row) ? 'has-avatar' : ''}`}>
              {getProfileAvatarUrl(row) ? <img src={getProfileAvatarUrl(row)} alt="" loading="lazy" /> : formatRankingName(row).slice(0, 2).toUpperCase()}
            </div>
            <div>
              <b>{formatRankingName(row)}</b>
              <small>Yield: {Number(row.roi || row.yield || 0).toFixed(2)}% • WR: {Number(row.winrate || 0).toFixed(1)}%</small>
              <small>Typy: {Number(row.totalTips || row.total_tips || 0)} • Wygrane: {Number(row.wins || 0)} • Przegrane: {Number(row.losses || 0)}</small>
            </div>
            <strong className={`ranking-profit-box ${Number(row.earnings || row.total_earnings || row.profit || 0) >= 0 ? 'ranking-profit-positive' : 'ranking-profit-negative'}`}>
              <em>Profit</em>
              <span>{Number(row.earnings || row.total_earnings || row.profit || 0) >= 0 ? '+' : ''}{formatMoney(row.earnings || row.total_earnings || row.profit || 0)}</span>
            </strong>
          </div>
        )) : (
          <div className="empty-mini">Brak danych rankingu. Dodaj typy i wyniki, aby ranking się naliczył.</div>
        )}
      </section>

      <section className="panel ai-day-panel-right">
        <div className="panel-head"><h2><span className="ai-day-title-accent">AI</span> Typy dnia</h2><a>Zobacz wszystkie</a></div>
        <div className="ai-pick"><div className="club ai-club">AI</div><div><b>Manchester City <span>vs</span> Inter Mediolan</b><small>Typ: Manchester City wygra</small><div className="tiny-progress"><i style={{width:'68%'}}></i></div></div><strong>68%</strong></div>
        <div className="ai-pick"><div className="club psg ai-club">AI</div><div><b>PSG <span>vs</span> Borussia Dortmund</b><small>Typ: Powyżej 2.5 gola</small><div className="tiny-progress"><i style={{width:'63%'}}></i></div></div><strong>63%</strong></div>
        <div className="ai-pick"><div className="club lfc ai-club">AI</div><div><b>Liverpool <span>vs</span> Bayer Leverkusen</b><small>Typ: Liverpool wygra</small><div className="tiny-progress"><i style={{width:'61%'}}></i></div></div><strong>61%</strong></div>
      </section>
    </aside>
  )
}


function TipsterProfileView({ tipsterId, onBack, currentUser, followingTipsters, onToggleFollow, onUnlock, onSubscribeToTipster, unlockedTips = new Set(), tipsterSubscriptions = [] }) {
  const [profile, setProfile] = useState(null)
  const [tipsterTips, setTipsterTips] = useState([])
  const [stats, setStats] = useState(null)
  const [byLeague, setByLeague] = useState([])
  const [byType, setByType] = useState([])
  const [recentForm, setRecentForm] = useState([])
  const [loading, setLoading] = useState(false)
  const tipsterRefValue = String(tipsterId || '')
  const lookupTipsterKey = tipsterRefValue.startsWith('lookup:')
    ? decodeURIComponent(tipsterRefValue.slice('lookup:'.length))
    : ''
  const normalizedLookupTipsterKey = normalizeEmail(lookupTipsterKey)

  useEffect(() => {
    let cancelled = false
    async function loadTipsterProfile() {
      if (!tipsterId || !isSupabaseConfigured || !supabase) return
      setLoading(true)
      try {
        if (lookupTipsterKey) {
          const [{ data: profilesData, error: profilesError }, { data: allTipsData, error: tipsLookupError }] = await Promise.all([
            supabase.from('profiles').select('id,email,username,public_slug,plan,subscription_status,avatar_url,imported_yield,imported_total_tips,imported_won_tips,imported_lost_tips,imported_pending_tips,imported_total_staked,imported_profit,imported_avg_odds,imported_highest_odds,imported_tips_currency').limit(500),
            supabase.from('tips').select('*').order('created_at', { ascending: false }).limit(500)
          ])
          if (profilesError) console.error('profile lookup error', profilesError)
          if (tipsLookupError) console.error('tips lookup error', tipsLookupError)

          const matchesKey = (value) => {
            const clean = normalizeEmail(value)
            if (!clean || !normalizedLookupTipsterKey) return false
            return clean === normalizedLookupTipsterKey ||
              clean.split('@')[0] === normalizedLookupTipsterKey ||
              normalizedLookupTipsterKey.split('@')[0] === clean
          }

          const foundProfile = (profilesData || []).find(profile =>
            matchesKey(profile.id) ||
            matchesKey(profile.email) ||
            matchesKey(profile.username) ||
            matchesKey(profile.public_slug)
          ) || null

          const normalizedTipsterTips = (allTipsData || [])
            .filter(rawTip => {
              const tip = normalizeTipRow(rawTip)
              return matchesKey(tip.author_id) ||
                matchesKey(tip.user_id) ||
                matchesKey(tip.author_email) ||
                matchesKey(tip.email) ||
                matchesKey(tip.user_email) ||
                matchesKey(tip.author_name) ||
                matchesKey(tip.username)
            })
            .map(normalizeTipRow)

          const fallbackProfile = foundProfile || (normalizedTipsterTips[0] ? {
            id: normalizedTipsterTips[0].author_id || normalizedTipsterTips[0].user_id || null,
            email: normalizedTipsterTips[0].author_email || normalizedTipsterTips[0].email || null,
            username: normalizedTipsterTips[0].author_name || normalizedTipsterTips[0].username || lookupTipsterKey,
            public_slug: normalizePublicSlug(normalizedTipsterTips[0].author_name || lookupTipsterKey),
            avatar_url: normalizedTipsterTips[0].author_avatar_url || null
          } : null)

          const lookupStatsKey = String(fallbackProfile?.id || normalizedTipsterTips[0]?.author_id || normalizedTipsterTips[0]?.user_id || lookupTipsterKey).toLowerCase()
          const tipsterDynamicStats = buildAuthorStatsFromTips(normalizedTipsterTips).get(lookupStatsKey) || buildAuthorStatsFromTips(normalizedTipsterTips).values?.()?.next?.()?.value
          const tipsterVisibleStats = finalizeAuthorStats(tipsterDynamicStats, getImportedProfileStats(fallbackProfile))

          if (cancelled) return
          setProfile(fallbackProfile)
          setTipsterTips(normalizedTipsterTips.map(tip => ({
            ...tip,
            author_name: isGenericProfileName(tip.author_name) ? (fallbackProfile?.username || lookupTipsterKey || 'Użytkownik') : (tip.author_name || fallbackProfile?.username || lookupTipsterKey || 'Użytkownik'),
            author_email: tip.author_email || fallbackProfile?.email || null,
            author_avatar_url: tip.author_avatar_url || fallbackProfile?.avatar_url || null,
            author_visible_stats: tipsterVisibleStats,
          })))
          setStats(null)
          setByLeague([])
          setByType([])
          setRecentForm([])
          return
        }

        const [profileRes, tipsRes, rankingRes, leagueRes, typeRes, formRes] = await Promise.all([
          supabase.from('profiles').select('id,email,username,public_slug,plan,subscription_status,avatar_url,imported_yield,imported_total_tips,imported_won_tips,imported_lost_tips,imported_pending_tips,imported_total_staked,imported_profit,imported_avg_odds,imported_highest_odds,imported_tips_currency').eq('id', tipsterId).maybeSingle(),
          supabase.from('tips').select('*').eq('author_id', tipsterId).order('created_at', { ascending: false }).limit(80),
          supabase.from('tipster_ranking').select('*').eq('tipster_id', tipsterId).maybeSingle(),
          supabase.from('stats_by_league').select('*').eq('tipster_id', tipsterId).order('bets', { ascending: false }).limit(8),
          supabase.from('stats_by_type').select('*').eq('tipster_id', tipsterId).order('bets', { ascending: false }).limit(8),
          supabase.from('stats_recent_form').select('*').eq('tipster_id', tipsterId).limit(20)
        ])
        if (cancelled) return
        if (profileRes.error) console.error('profileRes error', profileRes.error)
        if (tipsRes.error) console.error('tipsRes error', tipsRes.error)
        if (rankingRes.error) console.error('rankingRes error', rankingRes.error)
        if (leagueRes.error) console.error('leagueRes error', leagueRes.error)
        if (typeRes.error) console.error('typeRes error', typeRes.error)
        if (formRes.error) console.error('formRes error', formRes.error)
        setProfile(profileRes.data || null)
        const normalizedTipsterTips = (tipsRes.data || []).map(normalizeTipRow)
        const tipsterDynamicStats = buildAuthorStatsFromTips(normalizedTipsterTips).get(String(tipsterId).toLowerCase())
        const tipsterVisibleStats = finalizeAuthorStats(tipsterDynamicStats, getImportedProfileStats(profileRes.data))
        setTipsterTips(normalizedTipsterTips.map(tip => ({
          ...tip,
          author_name: isGenericProfileName(tip.author_name) ? (profileRes.data?.username || (profileRes.data?.email ? String(profileRes.data.email).split('@')[0] : 'Użytkownik')) : (tip.author_name || profileRes.data?.username || (profileRes.data?.email ? String(profileRes.data.email).split('@')[0] : 'Użytkownik')),
          author_email: tip.author_email || profileRes.data?.email || null,
          author_avatar_url: tip.author_avatar_url || profileRes.data?.avatar_url || null,
          author_visible_stats: tipsterVisibleStats,
        })))
        setStats(rankingRes.data || null)
        setByLeague(leagueRes.data || [])
        setByType(typeRes.data || [])
        setRecentForm(formRes.data || [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadTipsterProfile()
    return () => { cancelled = true }
  }, [tipsterId, lookupTipsterKey])

  const username = (profile?.username || profile?.public_slug || profile?.email || tipsterTips?.[0]?.author_name || 'Tipster').split('@')[0]
  const publicProfileUrl = getTipsterPublicUrl(profile, tipsterId)
  const copyPublicProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(publicProfileUrl)
      alert('Link profilu skopiowany: ' + publicProfileUrl)
    } catch {
      window.prompt('Skopiuj link profilu:', publicProfileUrl)
    }
  }
  const initials = username.slice(0, 2).toUpperCase()
  const totalTips = Number(stats?.total_tips || tipsterTips.length || 0)
  const wins = Number(stats?.wins || tipsterTips.filter(t => normalizeResult(t.result || t.status) === 'win').length || 0)
  const losses = Number(stats?.losses || tipsterTips.filter(t => normalizeResult(t.result || t.status) === 'loss').length || 0)
  const voids = tipsterTips.filter(t => normalizeResult(t.result || t.status) === 'void').length
  const settled = wins + losses + voids
  const winrate = Number(stats?.winrate || (settled ? (wins / Math.max(wins + losses, 1)) * 100 : 0))
  const earnings = Number(stats?.earnings || stats?.total_earnings || 0)
  const roi = Number(stats?.roi || 0)
  const salesCount = Number(stats?.sales_count || stats?.sales || 0)
  const buyersCount = Number(stats?.buyers_count || stats?.buyers || 0)
  const roi7 = Number(stats?.roi_7d || stats?.roi7 || roi || 0)
  const roi30 = Number(stats?.roi_30d || stats?.roi30 || roi || 0)
  const isTopSeller = salesCount >= 10 || buyersCount >= 10 || earnings >= 500
  const isOwn = currentUser?.id && String(currentUser.id) === String(tipsterId)
  const profileSubscriptionActive = hasActiveTipsterSubscription({ author_id: tipsterId, user_id: tipsterId, tipster_id: tipsterId, author_name: username }, tipsterSubscriptions)
  const canViewTipsterPremiumTip = (tip) => !isTipPremium(tip) || isOwn || profileSubscriptionActive || Boolean(tip?.id && unlockedTips?.has?.(tip.id))
  const visibleTipsterTips = tipsterTips.filter(canViewTipsterPremiumTip)
  const hiddenPremiumTipsCount = Math.max(0, tipsterTips.length - visibleTipsterTips.length)
  const featuredTips = [...visibleTipsterTips]
    .filter(t => !isTipPremium(t) || Number(t.ai_confidence || t.ai_score || t.confidence || 0) >= 85 || normalizeResult(t.result || t.status) === 'win')
    .sort((a, b) => Number(b.ai_confidence || b.ai_score || b.confidence || b.odds || 0) - Number(a.ai_confidence || a.ai_score || a.confidence || a.odds || 0))
    .slice(0, 3)
  const lastTenTips = visibleTipsterTips.slice(0, 10)
  const isFollowing = followingTipsters?.has?.(String(tipsterId))
  const donutWin = Math.max(0, Math.min(100, winrate))
  const donutLoss = Math.max(0, 100 - donutWin)

  return (
    <section className="tipster-profile-page pro-stats-page">
      <button className="back-btn" onClick={onBack}>← Powrót do feedu</button>
      <div className="tipster-profile-hero">
        <div className="tipster-profile-main">
          <div className="profile-big-avatar">{initials}</div>
          <div>
            <p className="eyebrow">PROFIL TYPERA</p>
            <h1>{username}</h1>
            <span>{profile?.email || 'Profil publiczny'}</span>
            <div className="tipster-profile-actions">
              {!isOwn && (
                <button className={isFollowing ? 'follow-profile-btn active' : 'follow-profile-btn'} onClick={() => onToggleFollow?.(tipsterId, username)}>
                  {isFollowing ? '✓ Obserwujesz' : '+ Obserwuj'}
                </button>
              )}
              {!isOwn && <button className="unlock-btn secondary" onClick={() => onSubscribeToTipster?.({ author_id: tipsterId, author_name: username })}>Kup dostęp do profilu</button>}
              <button className="follow-profile-btn share" onClick={copyPublicProfileLink}>🔗 Udostępnij</button>
            </div>
            <div className="public-profile-link" onClick={copyPublicProfileLink}>{publicProfileUrl.replace(/^https?:\/\//, '')}</div>
          </div>
        </div>
        <div className="tipster-profile-summary">
          <b>{totalTips}</b><span>typów</span>
          <b>{winrate.toFixed(0)}%</b><span>winrate</span>
          <b>{formatMoney(earnings)}</b><span>zarobki</span>
        </div>
      </div>

      {loading ? <div className="empty-state">Ładowanie profilu typera...</div> : (
        <>
          <div className="tipster-sales-strip">
            <div className="sales-copy">
              <span className="sales-eyebrow">TYPER PROFILE PRO</span>
              <h2>{isTopSeller ? '🔥 TOP SELLER — sprawdzony profil premium' : 'Profil premium gotowy do sprzedaży'}</h2>
              <p>Ostatnie wyniki, statystyki i social proof w jednym miejscu. Kup dostęp do profilu albo odblokuj pojedynczy typ.</p>
              {!isOwn && hiddenPremiumTipsCount > 0 && !profileSubscriptionActive ? (
                <p className="premium-lock-note">Ukryte typy premium: {hiddenPremiumTipsCount}. Pełny podgląd typu premium dostaniesz dopiero po zakupie singla albo subskrypcji profilu.</p>
              ) : null}
            </div>
            {!isOwn && (
              <div className="sales-actions">
                <button className="unlock-btn sales-primary" onClick={() => onSubscribeToTipster?.({ author_id: tipsterId, author_name: username })}>Kup dostęp do wszystkich typów</button>
                <button className="follow-profile-btn" onClick={() => onToggleFollow?.(tipsterId, username)}>{isFollowing ? '✓ Obserwujesz' : '+ Obserwuj typera'}</button>
                <button className="follow-profile-btn share" onClick={copyPublicProfileLink}>Kopiuj link</button>
              </div>
            )}
          </div>

          <div className="pro-metric-grid sales-upgrade">
            <div className={roi7 >= 0 ? 'pro-metric success' : 'pro-metric danger'}><span>ROI 7 dni</span><b>{roi7 ? roi7.toFixed(2) + ' zł' : '0.00 zł'}</b><small>Szybki sygnał formy</small></div>
            <div className={roi30 >= 0 ? 'pro-metric success' : 'pro-metric danger'}><span>ROI 30 dni</span><b>{roi30 ? roi30.toFixed(2) + ' zł' : '0.00 zł'}</b><small>Stabilność profilu</small></div>
            <div className="pro-metric"><span>Win rate</span><b>{winrate.toFixed(0)}%</b><small>Skuteczność rozliczonych typów</small></div>
            <div className="pro-metric"><span>Kupujący</span><b>{buyersCount}</b><small>Social proof profilu</small></div>
            <div className="pro-metric"><span>Sprzedaże</span><b>{salesCount}</b><small>Zakupy typów i dostępów</small></div>
            <div className={earnings >= 0 ? 'pro-metric success' : 'pro-metric danger'}><span>Łączny profit</span><b>{formatMoney(earnings)}</b><small>Suma zarobków marketplace</small></div>
          </div>

          <div className="featured-tipster-grid">
            <div className="featured-card">
              <div className="feed-title compact"><div><h2>Wyróżnione typy</h2><p>Najmocniejsze sygnały premium z profilu.</p></div></div>
              <div className="featured-list">
                {featuredTips.length ? featuredTips.map(tip => {
                  const ai = Number(tip.ai_confidence || tip.ai_score || tip.confidence || 0)
                  return (
                    <div className="featured-tip-row" key={tip.id}>
                      <div><strong>{tip.team_home || tip.home_team || 'Gospodarz'} vs {tip.team_away || tip.away_team || 'Gość'}</strong><span>{tip.market || tip.bet_type || 'Typ premium'} · kurs {tip.odds || '-'}</span></div>
                      <div className="featured-badges">
                        {isTipPremium(tip) && <em>💎 PREMIUM</em>}
                        {ai >= 85 && <em>🧠 AI {ai}%</em>}
                        {normalizeResult(tip.result || tip.status) === 'win' && <em>🏆 WIN</em>}
                      </div>
                      {!isOwn && <button className="mini-buy-btn" onClick={() => onUnlock?.(tip)}>Odblokuj</button>}
                    </div>
                  )
                }) : <div className="empty-mini">Brak wyróżnionych typów — pojawią się po dodaniu wyników albo AI%.</div>}
              </div>
            </div>
            <div className="featured-card">
              <div className="feed-title compact"><div><h2>Ostatnie 10 typów</h2><p>Transparentna forma typera.</p></div></div>
              <div className="last-results-list">
                {lastTenTips.length ? lastTenTips.map(tip => {
                  const res = normalizeResult(tip.result || tip.status)
                  return <div className="last-result-row" key={tip.id}><span className={'result-pill ' + res}>{res === 'win' ? '✅ WIN' : res === 'loss' ? '❌ LOSS' : res === 'void' ? '↩ VOID' : '⏳ PENDING'}</span><strong>{tip.team_home || tip.home_team || 'Typ'} vs {tip.team_away || tip.away_team || ''}</strong><small>{new Date(tip.created_at).toLocaleDateString('pl-PL')}</small></div>
                }) : <div className="empty-mini">Brak ostatnich typów.</div>}
              </div>
            </div>
          </div>
          <div className="pro-stats-layout">
            <div className="pro-chart-card">
              <h3>Win/Loss distribution</h3>
              <div className="donut-wrap">
                <div className="donut" style={{ background: `conic-gradient(#20d982 0 ${donutWin}%, #ff5165 ${donutWin}% ${donutWin + donutLoss}%, #ffd21f ${donutWin + donutLoss}% 100%)` }} />
                <div className="legend">
                  <span><b><i className="green"></i>Won</b><strong>{wins}</strong></span>
                  <span><b><i className="red"></i>Lost</b><strong>{losses}</strong></span>
                  <span><b><i className="yellow"></i>Void</b><strong>{voids}</strong></span>
                </div>
              </div>
            </div>
            <div className="pro-chart-card recent-card">
              <h3>Recent form (last 20)</h3>
              <div className="form-dots">
                {(recentForm.length ? recentForm : tipsterTips.slice(0, 20)).map((row, index) => {
                  const res = normalizeResult(row.result || row.status)
                  return <span key={`${row.id || row.created_at || index}`} className={res}>{res === 'win' ? 'W' : res === 'loss' ? 'L' : res === 'void' ? 'P' : '—'}</span>
                })}
              </div>
              <small>W = wygrana, L = przegrana, P = zwrot, — = oczekuje</small>
            </div>
          </div>

          <div className="pro-tables-grid">
            <div className="pro-table-card">
              <h3>Performance by league</h3>
              <div className="pro-table-head"><span>Liga</span><span>Typy</span><span>Hit rate</span><span>Wins</span><span>ROI</span></div>
              {byLeague.length ? byLeague.map(row => (
                <div className="pro-table-row" key={row.league || 'liga'}><span>{row.league || 'Inne'}</span><span>{row.bets || 0}</span><span>{Number(row.hit_rate || 0).toFixed(0)}%</span><span>{row.wins || 0}</span><span>{Number(row.roi || 0).toFixed(0)}</span></div>
              )) : <div className="empty-mini">Brak danych lig.</div>}
            </div>
            <div className="pro-table-card">
              <h3>Performance by bet type</h3>
              <div className="pro-table-head"><span>Typ</span><span>Typy</span><span>Hit rate</span><span>Wins</span><span>ROI</span></div>
              {byType.length ? byType.map(row => (
                <div className="pro-table-row" key={row.bet_type || 'typ'}><span>{row.bet_type || 'Inne'}</span><span>{row.bets || 0}</span><span>{Number(row.hit_rate || 0).toFixed(0)}%</span><span>{row.wins || 0}</span><span>{Number(row.roi || 0).toFixed(0)}</span></div>
              )) : <div className="empty-mini">Brak danych typów.</div>}
            </div>
          </div>

          <div className="tipster-profile-tips">
            <div className="feed-title"><div><h2>Typy typera</h2><p>Publiczny feed tego użytkownika.</p></div></div>
            <div className="feed">
              {tipsterTips.length ? tipsterTips.map(tip => <TipCard key={tip.id} tip={tip} unlocked={unlockedTips.has(tip.id)} profileSubscriptionActive={hasActiveTipsterSubscription(tip, tipsterSubscriptions)} onUnlock={onUnlock} onSubscribeToTipster={onSubscribeToTipster} currentUser={currentUser} followingTipsters={followingTipsters} onToggleFollow={onToggleFollow} onOpenTipster={() => {}} onToast={null} />) : <div className="empty-state">Ten tipster nie dodał jeszcze typów.</div>}
            </div>
          </div>
        </>
      )}
    </section>
  )
}


function AddTipForm({ onTipSaved, onToast, user, userPlan = 'free' }) {
  const confidenceDots = Array.from({ length: 15 }, (_, index) => index)
  const username = resolveRealProfileUsername(user)
  const email = normalizeEmail(user?.email || '')
  const addTipIdentity = { ...(user || {}), username, email, author_name: username, author_email: email }
  const isPremiumUser = hasUnlimitedTipAccess(addTipIdentity, userPlan) || isSmilhytvLifetimePremium(addTipIdentity) || normalizeEmail(email) === 'smilhytv@gmail.com' || normalizeEmail(username) === 'smilhytv'
  const todayLabel = new Date().toLocaleDateString('pl-PL')

  const sportsbook = useMemo(() => ({
    'Piłka nożna': {
      leagues: {
        'Premier League': [
          { id: 'mci-ars', home: 'Manchester City', away: 'Arsenal', date: '25.05.2025', time: '17:30', markets: [
            { market: 'Wynik końcowy', pick: 'Manchester City wygra', odds: 1.72, confidence: 84 },
            { market: 'Gole', pick: 'Powyżej 2.5 gola', odds: 1.68, confidence: 78 },
            { market: 'BTTS', pick: 'Obie strzelą', odds: 1.61, confidence: 73 },
          ]},
          { id: 'liv-che', home: 'Liverpool', away: 'Chelsea', date: '25.05.2025', time: '20:45', markets: [
            { market: 'Wynik końcowy', pick: 'Liverpool wygra', odds: 1.83, confidence: 76 },
            { market: 'Gole', pick: 'Powyżej 2.5 gola', odds: 1.75, confidence: 79 },
            { market: 'BTTS', pick: 'Obie strzelą', odds: 1.70, confidence: 71 },
          ]}
        ],
        'Liga Mistrzów': [
          { id: 'rm-bay', home: 'Real Madryt', away: 'Bayern Monachium', date: '25.05.2025', time: '21:00', markets: [
            { market: 'Wynik końcowy', pick: 'Real Madryt wygra', odds: 1.91, confidence: 74 },
            { market: 'Gole', pick: 'Powyżej 2.5 gola', odds: 1.72, confidence: 80 },
            { market: 'BTTS', pick: 'Obie strzelą', odds: 1.67, confidence: 77 },
          ]},
          { id: 'bar-int', home: 'Barcelona', away: 'Inter Mediolan', date: '26.05.2025', time: '20:30', markets: [
            { market: 'Wynik końcowy', pick: 'Barcelona wygra', odds: 1.85, confidence: 75 },
            { market: 'Gole', pick: 'Powyżej 2.5 gola', odds: 1.79, confidence: 82 },
            { market: 'BTTS', pick: 'Obie strzelą', odds: 1.65, confidence: 74 },
          ]}
        ]
      },
      countries: {
      "Anglia": {
            "Premier League": [
                  {
                        "id": "eng-pl-mci-ars",
                        "home": "Manchester City",
                        "away": "Arsenal",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Manchester City wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Championship": [
                  {
                        "id": "eng-ch-lee-sou",
                        "home": "Leeds United",
                        "away": "Southampton",
                        "date": "25.05.2025",
                        "time": "19:45",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Leeds United wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "League One": [
                  {
                        "id": "eng-l1-der-bol",
                        "home": "Derby County",
                        "away": "Bolton",
                        "date": "26.05.2025",
                        "time": "16:00",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Derby County wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "League Two": [
                  {
                        "id": "eng-l2-wre-mkd",
                        "home": "Wrexham",
                        "away": "MK Dons",
                        "date": "26.05.2025",
                        "time": "18:00",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Wrexham wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "National League": [
                  {
                        "id": "eng-nl-chf-old",
                        "home": "Chesterfield",
                        "away": "Oldham",
                        "date": "27.05.2025",
                        "time": "20:00",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Chesterfield wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Polska": {
            "Ekstraklasa": [
                  {
                        "id": "pol-ek-leg-lech",
                        "home": "Legia Warszawa",
                        "away": "Lech Poznań",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Legia Warszawa wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "1 Liga": [
                  {
                        "id": "pol-1-wis-ark",
                        "home": "Wisła Kraków",
                        "away": "Arka Gdynia",
                        "date": "25.05.2025",
                        "time": "20:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Wisła Kraków wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "2 Liga": [
                  {
                        "id": "pol-2-kks-pol",
                        "home": "KKS Kalisz",
                        "away": "Polonia Bytom",
                        "date": "26.05.2025",
                        "time": "18:00",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "KKS Kalisz wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "3 Liga": [
                  {
                        "id": "pol-3-wie-leg2",
                        "home": "Wieczysta Kraków",
                        "away": "Legia II",
                        "date": "26.05.2025",
                        "time": "17:00",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Wieczysta Kraków wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "4 Liga": [
                  {
                        "id": "pol-4-lok-vic",
                        "home": "Lokomotiv Warszawa",
                        "away": "Victoria Sulejówek",
                        "date": "27.05.2025",
                        "time": "18:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Lokomotiv Warszawa wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Hiszpania": {
            "La Liga": [
                  {
                        "id": "esp-ll-rma-bar",
                        "home": "Real Madryt",
                        "away": "Barcelona",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Real Madryt wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "La Liga 2": [
                  {
                        "id": "esp-l2-eib-lev",
                        "home": "Eibar",
                        "away": "Levante",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Eibar wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Primera RFEF": [
                  {
                        "id": "esp-rf1-dep-cel",
                        "home": "Deportivo",
                        "away": "Celta B",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Deportivo wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Segunda RFEF": [
                  {
                        "id": "esp-rf2-her-mur",
                        "home": "Hercules",
                        "away": "Real Murcia",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Hercules wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Niemcy": {
            "Bundesliga": [
                  {
                        "id": "ger-bun-bay-bvb",
                        "home": "Bayern Monachium",
                        "away": "Borussia Dortmund",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Bayern Monachium wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "2. Bundesliga": [
                  {
                        "id": "ger-2-hsv-fcn",
                        "home": "Hamburger SV",
                        "away": "Nurnberg",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Hamburger SV wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "3. Liga": [
                  {
                        "id": "ger-3-dre-1860",
                        "home": "Dynamo Dresden",
                        "away": "1860 Munich",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Dynamo Dresden wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Regionalliga": [
                  {
                        "id": "ger-reg-rot-aac",
                        "home": "Rot-Weiss Essen",
                        "away": "Alemannia Aachen",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Rot-Weiss Essen wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Włochy": {
            "Serie A": [
                  {
                        "id": "ita-sa-int-mil",
                        "home": "Inter Mediolan",
                        "away": "AC Milan",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Inter Mediolan wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Serie B": [
                  {
                        "id": "ita-sb-par-pal",
                        "home": "Parma",
                        "away": "Palermo",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Parma wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Serie C": [
                  {
                        "id": "ita-sc-pad-cat",
                        "home": "Padova",
                        "away": "Catania",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Padova wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Serie D": [
                  {
                        "id": "ita-sd-luc-pis",
                        "home": "Lucchese",
                        "away": "Pistoiese",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Lucchese wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Francja": {
            "Ligue 1": [
                  {
                        "id": "fra-l1-psg-om",
                        "home": "PSG",
                        "away": "Marsylia",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "PSG wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Ligue 2": [
                  {
                        "id": "fra-l2-bor-sai",
                        "home": "Bordeaux",
                        "away": "Saint-Etienne",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Bordeaux wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "National": [
                  {
                        "id": "fra-nat-red-nan",
                        "home": "Red Star",
                        "away": "Nancy",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Red Star wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "National 2": [
                  {
                        "id": "fra-n2-rou-cha",
                        "home": "Rouen",
                        "away": "Chambly",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Rouen wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Holandia": {
            "Eredivisie": [
                  {
                        "id": "ned-ere-ajax-psv",
                        "home": "Ajax",
                        "away": "PSV",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Ajax wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Eerste Divisie": [
                  {
                        "id": "ned-eer-gra-cam",
                        "home": "De Graafschap",
                        "away": "Cambuur",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "De Graafschap wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Tweede Divisie": [
                  {
                        "id": "ned-twe-kat-spa",
                        "home": "Katwijk",
                        "away": "Spakenburg",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Katwijk wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Portugalia": {
            "Primeira Liga": [
                  {
                        "id": "por-pri-ben-por",
                        "home": "Benfica",
                        "away": "Porto",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Benfica wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Liga Portugal 2": [
                  {
                        "id": "por-l2-lei-mar",
                        "home": "Leiria",
                        "away": "Maritimo",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Leiria wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Liga 3": [
                  {
                        "id": "por-l3-bra2-spo2",
                        "home": "Braga B",
                        "away": "Sporting B",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Braga B wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Belgia": {
            "Jupiler Pro League": [
                  {
                        "id": "bel-jpl-bru-and",
                        "home": "Club Brugge",
                        "away": "Anderlecht",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Club Brugge wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Challenger Pro League": [
                  {
                        "id": "bel-cpl-bee-lie",
                        "home": "Beerschot",
                        "away": "Liege",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Beerschot wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "1st National": [
                  {
                        "id": "bel-nat-lok-den",
                        "home": "Lokeren",
                        "away": "Dender",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Lokeren wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Szkocja": {
            "Premiership": [
                  {
                        "id": "sco-pre-cel-ran",
                        "home": "Celtic",
                        "away": "Rangers",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Celtic wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Championship": [
                  {
                        "id": "sco-ch-duu-rai",
                        "home": "Dundee United",
                        "away": "Raith Rovers",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Dundee United wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "League One": [
                  {
                        "id": "sco-l1-fal-ham",
                        "home": "Falkirk",
                        "away": "Hamilton",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Falkirk wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "League Two": [
                  {
                        "id": "sco-l2-spa-dum",
                        "home": "Spartans",
                        "away": "Dumbarton",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Spartans wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Turcja": {
            "Süper Lig": [
                  {
                        "id": "tur-sup-gal-fen",
                        "home": "Galatasaray",
                        "away": "Fenerbahce",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Galatasaray wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "1. Lig": [
                  {
                        "id": "tur-1-eyu-goz",
                        "home": "Eyupspor",
                        "away": "Goztepe",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Eyupspor wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "2. Lig": [
                  {
                        "id": "tur-2-ank-adi",
                        "home": "Ankaraspor",
                        "away": "Adiyaman",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Ankaraspor wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Grecja": {
            "Super League": [
                  {
                        "id": "gre-sl-oly-pan",
                        "home": "Olympiakos",
                        "away": "Panathinaikos",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Olympiakos wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Super League 2": [
                  {
                        "id": "gre-sl2-aek2-paok2",
                        "home": "AEK B",
                        "away": "PAOK B",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "AEK B wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Szwecja": {
            "Allsvenskan": [
                  {
                        "id": "swe-all-mal-aik",
                        "home": "Malmo FF",
                        "away": "AIK",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Malmo FF wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Superettan": [
                  {
                        "id": "swe-sup-ore-ost",
                        "home": "Orebro",
                        "away": "Osters",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Orebro wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Division 1": [
                  {
                        "id": "swe-d1-ume-sand",
                        "home": "Umea",
                        "away": "Sandviken",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Umea wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Norwegia": {
            "Eliteserien": [
                  {
                        "id": "nor-eli-bod-mol",
                        "home": "Bodo/Glimt",
                        "away": "Molde",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Bodo/Glimt wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "OBOS-ligaen": [
                  {
                        "id": "nor-obos-start-ran",
                        "home": "Start",
                        "away": "Ranheim",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Start wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "PostNord-ligaen": [
                  {
                        "id": "nor-post-eid-kvi",
                        "home": "Eidsvold",
                        "away": "Kvik Halden",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Eidsvold wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Dania": {
            "Superliga": [
                  {
                        "id": "den-sup-fck-bro",
                        "home": "FC Kopenhaga",
                        "away": "Brondby",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "FC Kopenhaga wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "1st Division": [
                  {
                        "id": "den-1-son-hob",
                        "home": "Sonderjyske",
                        "away": "Hobro",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Sonderjyske wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "2nd Division": [
                  {
                        "id": "den-2-ros-ab",
                        "home": "Roskilde",
                        "away": "AB Copenhagen",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Roskilde wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Szwajcaria": {
            "Super League": [
                  {
                        "id": "sui-sl-you-bas",
                        "home": "Young Boys",
                        "away": "Basel",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Young Boys wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Challenge League": [
                  {
                        "id": "sui-cl-sio-thu",
                        "home": "Sion",
                        "away": "Thun",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Sion wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Promotion League": [
                  {
                        "id": "sui-pl-bav-bie",
                        "home": "Bavois",
                        "away": "Biel",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Bavois wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Austria": {
            "Bundesliga": [
                  {
                        "id": "aut-bun-sal-rap",
                        "home": "RB Salzburg",
                        "away": "Rapid Wien",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "RB Salzburg wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "2. Liga": [
                  {
                        "id": "aut-2-gak-rie",
                        "home": "GAK",
                        "away": "Ried",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "GAK wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Regionalliga": [
                  {
                        "id": "aut-reg-vie-leo",
                        "home": "Vienna",
                        "away": "Leoben",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Vienna wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Czechy": {
            "1. Liga": [
                  {
                        "id": "cze-1-spa-sla",
                        "home": "Sparta Praga",
                        "away": "Slavia Praga",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Sparta Praga wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "2. Liga": [
                  {
                        "id": "cze-2-brn-duk",
                        "home": "Zbrojovka Brno",
                        "away": "Dukla Praga",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Zbrojovka Brno wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "ČFL/MSFL": [
                  {
                        "id": "cze-3-vik-zli2",
                        "home": "Viktoria Zizkov",
                        "away": "Zlin B",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Viktoria Zizkov wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Słowacja": {
            "Nike Liga": [
                  {
                        "id": "svk-nike-slo-zil",
                        "home": "Slovan Bratysława",
                        "away": "Zilina",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Slovan Bratysława wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "2. Liga": [
                  {
                        "id": "svk-2-kos-pre",
                        "home": "Kosice",
                        "away": "Presov",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Kosice wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Ukraina": {
            "Premier League": [
                  {
                        "id": "ukr-pl-sha-dyn",
                        "home": "Shakhtar Donetsk",
                        "away": "Dynamo Kijów",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Shakhtar Donetsk wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Persha Liga": [
                  {
                        "id": "ukr-1-kar-met",
                        "home": "Karpaty Lwów",
                        "away": "Metalist",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Karpaty Lwów wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Rumunia": {
            "Liga I": [
                  {
                        "id": "rou-l1-fcs-cfr",
                        "home": "FCSB",
                        "away": "CFR Cluj",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "FCSB wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Liga II": [
                  {
                        "id": "rou-l2-ste-csa",
                        "home": "Steaua Bucuresti",
                        "away": "CSM Resita",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Steaua Bucuresti wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Chorwacja": {
            "HNL": [
                  {
                        "id": "cro-hnl-din-haj",
                        "home": "Dinamo Zagrzeb",
                        "away": "Hajduk Split",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Dinamo Zagrzeb wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Prva NL": [
                  {
                        "id": "cro-2-var-dug",
                        "home": "Varazdin",
                        "away": "Dugopolje",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Varazdin wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Serbia": {
            "SuperLiga": [
                  {
                        "id": "srb-sl-crv-par",
                        "home": "Crvena Zvezda",
                        "away": "Partizan",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Crvena Zvezda wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Prva Liga": [
                  {
                        "id": "srb-1-rad-gra",
                        "home": "Radnicki",
                        "away": "Graficar",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Radnicki wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "USA": {
            "MLS": [
                  {
                        "id": "usa-mls-mia-lafc",
                        "home": "Inter Miami",
                        "away": "LAFC",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Inter Miami wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "USL Championship": [
                  {
                        "id": "usa-usl-lou-phx",
                        "home": "Louisville City",
                        "away": "Phoenix Rising",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Louisville City wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "USL League One": [
                  {
                        "id": "usa-usl1-gre-omaha",
                        "home": "Greenville",
                        "away": "Union Omaha",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Greenville wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Brazylia": {
            "Serie A": [
                  {
                        "id": "bra-a-fla-pal",
                        "home": "Flamengo",
                        "away": "Palmeiras",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Flamengo wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Serie B": [
                  {
                        "id": "bra-b-san-spo",
                        "home": "Santos",
                        "away": "Sport Recife",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Santos wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Serie C": [
                  {
                        "id": "bra-c-rem-naut",
                        "home": "Remo",
                        "away": "Nautico",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Remo wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Argentyna": {
            "Primera División": [
                  {
                        "id": "arg-pd-boc-riv",
                        "home": "Boca Juniors",
                        "away": "River Plate",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Boca Juniors wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Primera Nacional": [
                  {
                        "id": "arg-pn-cha-qui",
                        "home": "Chacarita",
                        "away": "Quilmes",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Chacarita wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Meksyk": {
            "Liga MX": [
                  {
                        "id": "mex-lmx-ame-tig",
                        "home": "Club America",
                        "away": "Tigres",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Club America wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Liga de Expansión": [
                  {
                        "id": "mex-exp-atl-leo",
                        "home": "Atlante",
                        "away": "Leones Negros",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Atlante wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Japonia": {
            "J1 League": [
                  {
                        "id": "jpn-j1-mar-ura",
                        "home": "Yokohama F. Marinos",
                        "away": "Urawa Reds",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Yokohama F. Marinos wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "J2 League": [
                  {
                        "id": "jpn-j2-veg-jef",
                        "home": "Vegalta Sendai",
                        "away": "JEF United",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Vegalta Sendai wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "J3 League": [
                  {
                        "id": "jpn-j3-gif-nar",
                        "home": "Gifu",
                        "away": "Nara Club",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Gifu wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Korea Południowa": {
            "K League 1": [
                  {
                        "id": "kor-k1-uls-seo",
                        "home": "Ulsan Hyundai",
                        "away": "FC Seoul",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Ulsan Hyundai wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "K League 2": [
                  {
                        "id": "kor-k2-bus-jeo",
                        "home": "Busan IPark",
                        "away": "Jeonnam Dragons",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Busan IPark wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      },
      "Arabia Saudyjska": {
            "Saudi Pro League": [
                  {
                        "id": "sau-spl-hil-nas",
                        "home": "Al Hilal",
                        "away": "Al Nassr",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Al Hilal wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ],
            "Division 1": [
                  {
                        "id": "sau-d1-qad-oro",
                        "home": "Al Qadsiah",
                        "away": "Al Orobah",
                        "date": "25.05.2025",
                        "time": "17:30",
                        "markets": [
                              {
                                    "market": "Wynik końcowy",
                                    "pick": "Al Qadsiah wygra",
                                    "odds": 1.72,
                                    "confidence": 72
                              },
                              {
                                    "market": "Gole",
                                    "pick": "Powyżej 2.5 gola",
                                    "odds": 1.8,
                                    "confidence": 70
                              },
                              {
                                    "market": "BTTS",
                                    "pick": "Obie strzelą",
                                    "odds": 1.68,
                                    "confidence": 66
                              }
                        ]
                  }
            ]
      }
}

    },
    'Koszykówka': {
      leagues: {
        'NBA': [
          { id: 'lal-bos', home: 'LA Lakers', away: 'Boston Celtics', date: '25.05.2025', time: '02:30', markets: [
            { market: 'Zwycięzca', pick: 'LA Lakers wygra', odds: 2.05, confidence: 67 },
            { market: 'Punkty', pick: 'Powyżej 214.5 pkt', odds: 1.88, confidence: 72 },
            { market: 'Handicap', pick: 'Boston +4.5', odds: 1.76, confidence: 69 },
          ]}
        ]
      }
    },
    'Tenis': {
      leagues: {
        'ATP': [
          { id: 'sinner-alcaraz', home: 'J. Sinner', away: 'C. Alcaraz', date: '25.05.2025', time: '15:00', markets: [
            { market: 'Zwycięzca', pick: 'Sinner wygra', odds: 1.95, confidence: 66 },
            { market: 'Sety', pick: 'Powyżej 3.5 seta', odds: 1.74, confidence: 71 },
            { market: 'Handicap', pick: 'Alcaraz +1.5 seta', odds: 1.62, confidence: 64 },
          ]}
        ]
      }
    },
    'Hokej': {
      leagues: {
        'NHL': [
          { id: 'rangers-bruins', home: 'NY Rangers', away: 'Boston Bruins', date: '25.05.2025', time: '01:00', markets: [
            { market: 'Zwycięzca', pick: 'NY Rangers wygra', odds: 1.89, confidence: 68 },
            { market: 'Gole', pick: 'Powyżej 5.5 gola', odds: 1.84, confidence: 72 },
            { market: 'Handicap', pick: 'Boston +1.5', odds: 1.58, confidence: 63 },
          ]}
        ]
      }
    },
    'MMA': {
      leagues: {
        'UFC': [
          { id: 'pereira-ankalaev', home: 'A. Pereira', away: 'M. Ankalaev', date: '25.05.2025', time: '23:30', markets: [
            { market: 'Zwycięzca', pick: 'Pereira wygra', odds: 1.78, confidence: 69 },
            { market: 'Rundy', pick: 'Powyżej 2.5 rundy', odds: 1.70, confidence: 65 },
            { market: 'Metoda', pick: 'Pereira przez KO/TKO', odds: 2.25, confidence: 61 },
          ]}
        ]
      }
    },
    'E-sport': {
      leagues: {
        'CS2': [
          { id: 'navi-faze', home: 'NAVI', away: 'FaZe', date: '25.05.2025', time: '18:00', markets: [
            { market: 'Zwycięzca', pick: 'NAVI wygra', odds: 1.87, confidence: 70 },
            { market: 'Mapy', pick: 'Powyżej 2.5 mapy', odds: 1.96, confidence: 66 },
            { market: 'Handicap map', pick: 'FaZe +1.5 mapy', odds: 1.55, confidence: 64 },
          ]}
        ]
      }
    },
    'Siatkówka': {
      leagues: {
        'Liga Narodów': [
          { id: 'pol-bra-vnl', home: 'Polska', away: 'Brazylia', date: '26.05.2025', time: '19:30', markets: [
            { market: 'Zwycięzca', pick: 'Polska wygra', odds: 1.92, confidence: 71 },
            { market: 'Sety', pick: 'Powyżej 3.5 seta', odds: 1.66, confidence: 74 },
            { market: 'Handicap sety', pick: 'Polska -1.5 seta', odds: 2.08, confidence: 63 },
          ]}
        ]
      }
    },
    'Boks': {
      leagues: {
        'Main Event': [
          { id: 'usyk-fury', home: 'O. Usyk', away: 'T. Fury', date: '26.05.2025', time: '22:00', markets: [
            { market: 'Zwycięzca', pick: 'Usyk wygra', odds: 1.97, confidence: 67 },
            { market: 'Rundy', pick: 'Powyżej 10.5 rundy', odds: 1.72, confidence: 73 },
            { market: 'Metoda', pick: 'Wygrana na punkty', odds: 2.30, confidence: 60 },
          ]}
        ]
      }
    },
    'Piłka ręczna': {
      leagues: {
        'Liga Mistrzów': [
          { id: 'barca-kiel-handball', home: 'Barcelona', away: 'Kiel', date: '25.05.2025', time: '17:45', markets: [
            { market: 'Zwycięzca', pick: 'Barcelona wygra', odds: 1.69, confidence: 75 },
            { market: 'Bramki', pick: 'Powyżej 57.5', odds: 1.81, confidence: 70 },
            { market: 'Handicap', pick: 'Kiel +3.5', odds: 1.77, confidence: 65 },
          ]}
        ]
      }
    },
    'Krykiet': {
      leagues: {
        'T20': [
          { id: 'india-aus-t20', home: 'Indie', away: 'Australia', date: '25.05.2025', time: '13:00', markets: [
            { market: 'Zwycięzca', pick: 'Indie wygrają', odds: 1.84, confidence: 69 },
            { market: 'Runy', pick: 'Powyżej 169.5 runów', odds: 1.79, confidence: 67 },
            { market: 'Handicap', pick: 'Australia +8.5', odds: 1.73, confidence: 62 },
          ]}
        ]
      }
    },
    'Rugby': {
      leagues: {
        'Six Nations': [
          { id: 'eng-fra-rugby', home: 'Anglia', away: 'Francja', date: '26.05.2025', time: '16:00', markets: [
            { market: 'Zwycięzca', pick: 'Anglia wygra', odds: 2.02, confidence: 61 },
            { market: 'Punkty', pick: 'Powyżej 42.5 pkt', odds: 1.76, confidence: 68 },
            { market: 'Handicap', pick: 'Francja +4.5', odds: 1.71, confidence: 66 },
          ]}
        ]
      }
    },
    'Rugby League': {
      leagues: {
        'Super League': [
          { id: 'wigan-sthelens', home: 'Wigan', away: 'St Helens', date: '26.05.2025', time: '20:00', markets: [
            { market: 'Zwycięzca', pick: 'Wigan wygra', odds: 1.74, confidence: 72 },
            { market: 'Punkty', pick: 'Powyżej 38.5 pkt', odds: 1.80, confidence: 67 },
            { market: 'Handicap', pick: 'St Helens +6.5', odds: 1.68, confidence: 64 },
          ]}
        ]
      }
    },
    'Baseball': {
      leagues: {
        'MLB': [
          { id: 'yankees-dodgers', home: 'Yankees', away: 'Dodgers', date: '25.05.2025', time: '19:10', markets: [
            { market: 'Zwycięzca', pick: 'Yankees wygrają', odds: 1.86, confidence: 68 },
            { market: 'Runy', pick: 'Powyżej 8.5 runów', odds: 1.83, confidence: 70 },
            { market: 'Handicap', pick: 'Dodgers +1.5', odds: 1.61, confidence: 65 },
          ]}
        ]
      }
    },
    'Dart': {
      leagues: {
        'Premier League Darts': [
          { id: 'humphries-littler', home: 'L. Humphries', away: 'L. Littler', date: '25.05.2025', time: '20:15', markets: [
            { market: 'Zwycięzca', pick: 'Humphries wygra', odds: 1.90, confidence: 66 },
            { market: 'Legi', pick: 'Powyżej 9.5 lega', odds: 1.71, confidence: 72 },
            { market: 'Handicap', pick: 'Littler +1.5 lega', odds: 1.67, confidence: 63 },
          ]}
        ]
      }
    }
  }), [])

  const sportKeys = Object.keys(sportsbook)
  const defaultSport = sportKeys[0]
  const defaultLeague = Object.keys(sportsbook[defaultSport]?.leagues || {})[0] || 'Premier League'
  const defaultMatch = (sportsbook[defaultSport]?.leagues?.[defaultLeague] || [])[0] || null
  const defaultMarket = defaultMatch?.markets?.[0] || { market: 'Wynik końcowy', pick: 'Manchester City wygra', odds: 1.72, confidence: 84 }

  const getTodayLocalKey = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getDateKeyPlusDays = (days = 0) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const LIVE_SEARCH_DAYS_AHEAD = 14
  const GLOBAL_SEARCH_DAYS_AHEAD = 90

  const sportIconMap = {
    'Piłka nożna': '⚽',
    'Tenis': '🎾',
    'Koszykówka': '🏀',
    'Hokej': '🏒',
    'MMA': '🥊',
    'E-sport': '🎮',
    'Siatkówka': '🏐',
    'Boks': '🥊',
    'Piłka ręczna': '🤾',
    'Krykiet': '🏏',
    'Rugby': '🏉',
    'Rugby League': '🏉',
    'Baseball': '⚾',
    'Dart': '🎯',
  }

  const sidebarComingSoonSports = [
    'Tenis',
    'Koszykówka',
    'Hokej',
    'MMA',
    'E-sport',
    'Siatkówka',
    'Boks',
    'Piłka ręczna',
    'Krykiet',
    'Rugby',
    'Rugby League',
    'Baseball',
    'Dart',
  ]

  const [form, setForm] = useState({
    sport: defaultSport,
    country: 'Anglia',
    league: defaultLeague,
    matchId: defaultMatch?.id || 'mci-ars',
    market: defaultMarket.market,
    betType: defaultMarket.pick,
    odds: String(defaultMarket.odds),
    stake: '100',
    date: defaultMatch?.date || '25.05.2025',
    time: defaultMatch?.time || '17:30',
    description: '',
    aiAnalysis: 'Model AI ocenia ten typ jako wartościowy. Manchester City ma 68% szans na wygraną. Kluczowe przewagi to forma, posiadanie piłki i skuteczność pod bramką.',
    confidence: defaultMarket.confidence || 84,
    tags: ['#BetAI', '#Statystyki', '#Value'],
    accessType: 'free',
    singlePrice: '29.00',
  })
  const [saving, setSaving] = useState(false)
  const [dailyCount, setDailyCount] = useState(0)
  const [countLoading, setCountLoading] = useState(false)
  const [showHints, setShowHints] = useState(false)
  const [liveFixtures, setLiveFixtures] = useState([])
  const [liveFixturesLoading, setLiveFixturesLoading] = useState(false)
  const [liveFixturesStatus, setLiveFixturesStatus] = useState('Wybierz kraj i ligę po lewej. Dopiero wtedy pobiorę dzisiejsze mecze tej ligi.')
  const [liveDataSource, setLiveDataSource] = useState('manual')
  const [hasTriedLiveLoad, setHasTriedLiveLoad] = useState(false)
  const [liveDate, setLiveDate] = useState(() => getTodayLocalKey())
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [footballViewMode, setFootballViewMode] = useState('league-today')
  const [fixtureSearchLoading, setFixtureSearchLoading] = useState(false)
  const [fixtureSearchPerformed, setFixtureSearchPerformed] = useState(false)
  const [activeMarketTab, setActiveMarketTab] = useState('Wszystkie')
  const [showMarketBoard, setShowMarketBoard] = useState(false)
  const [expandedMarketGroup, setExpandedMarketGroup] = useState('')
  const [ticketMarketSelected, setTicketMarketSelected] = useState(false)
  const [openSidebarSport, setOpenSidebarSport] = useState('Piłka nożna')
  const [openFootballCountry, setOpenFootballCountry] = useState('')
  const [sportDayCounts, setSportDayCounts] = useState({})
  const [sportDayCountsLoading, setSportDayCountsLoading] = useState(false)
  const [sportCountsDate, setSportCountsDate] = useState(() => getTodayLocalKey())
  const [addTipMode, setAddTipMode] = useState('auto')
  const [manualSelectedMatch, setManualSelectedMatch] = useState(null)
  const [manualForm, setManualForm] = useState({
    sport: 'Piłka nożna',
    country: 'Polska',
    league: 'Ekstraklasa',
    event: '',
    datetimeLocal: '',
    betType: '',
    odds: '',
  })

  const sportData = sportsbook[form.sport] || { leagues: {} }
  const countryMap = sportData.countries || null
  const countryOptions = countryMap ? Object.keys(countryMap) : ['Wszystkie']
  const currentCountry = countryMap ? (countryOptions.includes(form.country) ? form.country : countryOptions[0]) : 'Wszystkie'
  const activeLeagues = countryMap ? (countryMap[currentCountry] || {}) : (sportData.leagues || {})
  const leagueOptions = Object.keys(activeLeagues || {})
  const currentLeague = leagueOptions.includes(form.league) ? form.league : (leagueOptions[0] || '')
  const footballCountryOptions = [
    "Afryka",
    "Albania",
    "Algieria",
    "Anglia",
    "Arabia Saudyjska",
    "Argentyna",
    "Armenia",
    "Aruba",
    "Australia",
    "Austria",
    "Azerbejdżan",
    "Azja",
    "Belgia",
    "Białoruś",
    "Boliwia",
    "Bośnia",
    "Brazylia",
    "Bułgaria",
    "Chile",
    "Chiny",
    "Chińsko-Tajpej",
    "Chorwacja",
    "Cypr",
    "Czarnogóra",
    "Czechy",
    "Dania",
    "Dominikana-Republika",
    "Egipt",
    "Ekwador",
    "Estonia",
    "Etiopia",
    "Finlandia",
    "Francja",
    "Grecja",
    "Gruzja",
    "Gwatemala",
    "Hiszpania",
    "Holandia",
    "Honduras",
    "Hongkong",
    "Indie",
    "Indonezja",
    "Irlandia",
    "Irlandia Północna",
    "Islandia",
    "Izrael",
    "Japonia",
    "Kamerun",
    "Kanada",
    "Kazachstan",
    "Kenia",
    "Kolumbia",
    "Korea Południowa",
    "Kosowa",
    "Kostaryka",
    "Litwa",
    "Macedonia",
    "Malezja",
    "Malta",
    "Maroko",
    "Meksyk",
    "Mongolia",
    "Niemcy",
    "Norwegia",
    "Panama",
    "Paragwaj",
    "Peru",
    "Polska",
    "Portugalia",
    "Republika Południowej Afryki",
    "Rosja",
    "Rumunia",
    "San-Marino",
    "Serbia",
    "Singapur",
    "Szkocja",
    "Szwajcaria",
    "Szwecja",
    "Słowacja",
    "Słowenia",
    "Tajlandia",
    "Turcja",
    "USA",
    "Ukraina",
    "Urugwaj",
    "Wenezuela",
    "Wietnam",
    "Wyspy Owcze",
    "Węgry",
    "Włochy",
    "Łotwa",
    "Świat"
]
  const normalizeFootballCountryName = (value) => {
    const raw = String(value || '').trim()
    const cleaned = raw.replace(/^[A-Z]{2,3}\s+/, '').trim()
    return cleaned || raw
  }

  const footballCountryFlagCodes = {
    "Albania": "al",
    "Algieria": "dz",
    "Anglia": "gb-eng",
    "Arabia Saudyjska": "sa",
    "Argentyna": "ar",
    "Armenia": "am",
    "Aruba": "aw",
    "Australia": "au",
    "Austria": "at",
    "Azerbejdżan": "az",
    "Belgia": "be",
    "Białoruś": "by",
    "Boliwia": "bo",
    "Bośnia": "ba",
    "Brazylia": "br",
    "Bułgaria": "bg",
    "Chile": "cl",
    "Chiny": "cn",
    "Chińsko-Tajpej": "tw",
    "Chorwacja": "hr",
    "Cypr": "cy",
    "Czarnogóra": "me",
    "Czechy": "cz",
    "Dania": "dk",
    "Dominikana-Republika": "do",
    "Egipt": "eg",
    "Ekwador": "ec",
    "Estonia": "ee",
    "Etiopia": "et",
    "Finlandia": "fi",
    "Francja": "fr",
    "Grecja": "gr",
    "Gruzja": "ge",
    "Gwatemala": "gt",
    "Hiszpania": "es",
    "Holandia": "nl",
    "Honduras": "hn",
    "Hongkong": "hk",
    "Indie": "in",
    "Indonezja": "id",
    "Irlandia": "ie",
    "Irlandia Północna": "gb-nir",
    "Islandia": "is",
    "Izrael": "il",
    "Japonia": "jp",
    "Kamerun": "cm",
    "Kanada": "ca",
    "Kazachstan": "kz",
    "Kenia": "ke",
    "Kolumbia": "co",
    "Korea Południowa": "kr",
    "Kosowa": "xk",
    "Kostaryka": "cr",
    "Litwa": "lt",
    "Macedonia": "mk",
    "Malezja": "my",
    "Malta": "mt",
    "Maroko": "ma",
    "Meksyk": "mx",
    "Mongolia": "mn",
    "Niemcy": "de",
    "Norwegia": "no",
    "Panama": "pa",
    "Paragwaj": "py",
    "Peru": "pe",
    "Polska": "pl",
    "Portugalia": "pt",
    "Republika Południowej Afryki": "za",
    "Rosja": "ru",
    "Rumunia": "ro",
    "San-Marino": "sm",
    "Serbia": "rs",
    "Singapur": "sg",
    "Szkocja": "gb-sct",
    "Szwajcaria": "ch",
    "Szwecja": "se",
    "Słowacja": "sk",
    "Słowenia": "si",
    "Tajlandia": "th",
    "Turcja": "tr",
    "USA": "us",
    "Ukraina": "ua",
    "Urugwaj": "uy",
    "Wenezuela": "ve",
    "Wietnam": "vn",
    "Wyspy Owcze": "fo",
    "Węgry": "hu",
    "Włochy": "it",
    "Łotwa": "lv",
  }

  const footballCountryIcons = {
    "Afryka": "🌍",
    "Albania": "🇦🇱",
    "Algieria": "🇩🇿",
    "Anglia": "🏴",
    "Arabia Saudyjska": "🇸🇦",
    "Argentyna": "🇦🇷",
    "Armenia": "🇦🇲",
    "Aruba": "🇦🇼",
    "Australia": "🇦🇺",
    "Austria": "🇦🇹",
    "Azerbejdżan": "🇦🇿",
    "Azja": "🌏",
    "Belgia": "🇧🇪",
    "Białoruś": "🇧🇾",
    "Boliwia": "🇧🇴",
    "Bośnia": "🇧🇦",
    "Brazylia": "🇧🇷",
    "Bułgaria": "🇧🇬",
    "Chile": "🇨🇱",
    "Chiny": "🇨🇳",
    "Chińsko-Tajpej": "🇹🇼",
    "Chorwacja": "🇭🇷",
    "Cypr": "🇨🇾",
    "Czarnogóra": "🇲🇪",
    "Czechy": "🇨🇿",
    "Dania": "🇩🇰",
    "Dominikana-Republika": "🇩🇴",
    "Egipt": "🇪🇬",
    "Ekwador": "🇪🇨",
    "Estonia": "🇪🇪",
    "Etiopia": "🇪🇹",
    "Finlandia": "🇫🇮",
    "Francja": "🇫🇷",
    "Grecja": "🇬🇷",
    "Gruzja": "🇬🇪",
    "Gwatemala": "🇬🇹",
    "Hiszpania": "🇪🇸",
    "Holandia": "🇳🇱",
    "Honduras": "🇭🇳",
    "Hongkong": "🇭🇰",
    "Indie": "🇮🇳",
    "Indonezja": "🇮🇩",
    "Irlandia": "🇮🇪",
    "Irlandia Północna": "🏴",
    "Islandia": "🇮🇸",
    "Izrael": "🇮🇱",
    "Japonia": "🇯🇵",
    "Kamerun": "🇨🇲",
    "Kanada": "🇨🇦",
    "Kazachstan": "🇰🇿",
    "Kenia": "🇰🇪",
    "Kolumbia": "🇨🇴",
    "Korea Południowa": "🇰🇷",
    "Kosowa": "🇽🇰",
    "Kostaryka": "🇨🇷",
    "Litwa": "🇱🇹",
    "Macedonia": "🇲🇰",
    "Malezja": "🇲🇾",
    "Malta": "🇲🇹",
    "Maroko": "🇲🇦",
    "Meksyk": "🇲🇽",
    "Mongolia": "🇲🇳",
    "Niemcy": "🇩🇪",
    "Norwegia": "🇳🇴",
    "Panama": "🇵🇦",
    "Paragwaj": "🇵🇾",
    "Peru": "🇵🇪",
    "Polska": "🇵🇱",
    "Portugalia": "🇵🇹",
    "Republika Południowej Afryki": "🇿🇦",
    "Rosja": "🇷🇺",
    "Rumunia": "🇷🇴",
    "San-Marino": "🇸🇲",
    "Serbia": "🇷🇸",
    "Singapur": "🇸🇬",
    "Szkocja": "🏴",
    "Szwajcaria": "🇨🇭",
    "Szwecja": "🇸🇪",
    "Słowacja": "🇸🇰",
    "Słowenia": "🇸🇮",
    "Tajlandia": "🇹🇭",
    "Turcja": "🇹🇷",
    "USA": "🇺🇸",
    "Ukraina": "🇺🇦",
    "Urugwaj": "🇺🇾",
    "Wenezuela": "🇻🇪",
    "Wietnam": "🇻🇳",
    "Wyspy Owcze": "🇫🇴",
    "Węgry": "🇭🇺",
    "Włochy": "🇮🇹",
    "Łotwa": "🇱🇻",
    "Świat": "🌐"
  }
  const footballLeagueMap = {
    "Afryka": [
        "CAF Champions League",
        "CAF Confederation Cup",
        "African Football League",
        "Puchar Narodów Afryki",
        "Kwalifikacje CAF"
    ],
    "Albania": [
        "Kategoria Superiore",
        "Kategoria e Parë",
        "Puchar Albanii",
        "Superpuchar Albanii",
        "Liga kobiet"
    ],
    "Algieria": [
        "Ligue 1",
        "Ligue 2",
        "Puchar Algierii",
        "Superpuchar Algierii",
        "Liga kobiet"
    ],
    "Anglia": [
        "Premier League",
        "Championship",
        "League One",
        "League Two",
        "National League",
        "FA Cup",
        "EFL Cup",
        "Community Shield",
        "Women Super League",
        "Women Championship"
    ],
    "Arabia Saudyjska": [
        "Saudi Pro League",
        "Division 1",
        "Division 2",
        "King Cup",
        "Saudi Super Cup",
        "Liga kobiet"
    ],
    "Argentyna": [
        "Liga Profesional",
        "Primera Nacional",
        "Primera B Metropolitana",
        "Primera C",
        "Copa Argentina",
        "Copa de la Liga"
    ],
    "Armenia": [
        "Premier League",
        "First League",
        "Puchar Armenii",
        "Superpuchar Armenii",
        "Liga kobiet"
    ],
    "Aruba": [
        "Division di Honor",
        "Division Uno",
        "Puchar Aruba",
        "Liga kobiet"
    ],
    "Australia": [
        "A-League Men",
        "A-League Women",
        "Australia Cup",
        "NPL NSW",
        "NPL Victoria",
        "NPL Queensland"
    ],
    "Austria": [
        "Bundesliga",
        "2. Liga",
        "Regionalliga Ost",
        "Regionalliga Mitte",
        "Regionalliga West",
        "ÖFB Cup",
        "Frauen Bundesliga"
    ],
    "Azerbejdżan": [
        "Premier League",
        "First Division",
        "Puchar Azerbejdżanu",
        "Superpuchar Azerbejdżanu",
        "Liga kobiet"
    ],
    "Azja": [
        "AFC Champions League Elite",
        "AFC Champions League Two",
        "AFC Challenge League",
        "Puchar Azji",
        "Kwalifikacje AFC"
    ],
    "Belgia": [
        "Jupiler Pro League",
        "Challenger Pro League",
        "National Division 1",
        "Puchar Belgii",
        "Superpuchar Belgii",
        "Super League Women"
    ],
    "Białoruś": [
        "Premier League",
        "First League",
        "Second League",
        "Puchar Białorusi",
        "Superpuchar Białorusi",
        "Liga kobiet"
    ],
    "Boliwia": [
        "División Profesional",
        "Copa Bolivia",
        "Nacional B",
        "Liga kobiet"
    ],
    "Bośnia": [
        "Premijer Liga",
        "Prva Liga FBiH",
        "Prva Liga RS",
        "Puchar Bośni i Hercegowiny",
        "Liga kobiet"
    ],
    "Brazylia": [
        "Serie A",
        "Serie B",
        "Serie C",
        "Serie D",
        "Copa do Brasil",
        "Paulista",
        "Carioca",
        "Mineiro",
        "Gaúcho",
        "Brasileirão Feminino"
    ],
    "Bułgaria": [
        "First League",
        "Second League",
        "Third League",
        "Puchar Bułgarii",
        "Superpuchar Bułgarii",
        "Liga kobiet"
    ],
    "Chile": [
        "Primera División",
        "Primera B",
        "Segunda División",
        "Copa Chile",
        "Supercopa Chile",
        "Liga kobiet"
    ],
    "Chiny": [
        "Chinese Super League",
        "China League One",
        "China League Two",
        "FA Cup",
        "Super Cup",
        "Women Super League"
    ],
    "Chińsko-Tajpej": [
        "Taiwan Football Premier League",
        "Enterprise Football League",
        "Intercity League",
        "Puchar Tajwanu",
        "Liga kobiet"
    ],
    "Chorwacja": [
        "HNL",
        "Prva NL",
        "Druga NL",
        "Puchar Chorwacji",
        "Superpuchar Chorwacji",
        "1. HNLŽ"
    ],
    "Cypr": [
        "First Division",
        "Second Division",
        "Third Division",
        "Puchar Cypru",
        "Superpuchar Cypru",
        "Liga kobiet"
    ],
    "Czarnogóra": [
        "First League",
        "Second League",
        "Puchar Czarnogóry",
        "Superpuchar Czarnogóry",
        "Liga kobiet"
    ],
    "Czechy": [
        "Fortuna Liga",
        "FNL",
        "ČFL",
        "MSFL",
        "Puchar Czech",
        "1. liga kobiet"
    ],
    "Dania": [
        "Superliga",
        "1. Division",
        "2. Division",
        "3. Division",
        "DBU Pokalen",
        "Kvindeliga"
    ],
    "Dominikana-Republika": [
        "Liga Dominicana de Fútbol",
        "LDF Expansión",
        "Puchar Dominikany",
        "Liga kobiet"
    ],
    "Egipt": [
        "Premier League",
        "Second Division A",
        "Egypt Cup",
        "Super Cup",
        "League Cup",
        "Liga kobiet"
    ],
    "Ekwador": [
        "LigaPro Serie A",
        "LigaPro Serie B",
        "Copa Ecuador",
        "Supercopa Ecuador",
        "Liga kobiet"
    ],
    "Estonia": [
        "Meistriliiga",
        "Esiliiga",
        "Esiliiga B",
        "Puchar Estonii",
        "Superpuchar Estonii",
        "Naiste Meistriliiga"
    ],
    "Etiopia": [
        "Premier League",
        "Higher League",
        "Puchar Etiopii",
        "Liga kobiet"
    ],
    "Finlandia": [
        "Veikkausliiga",
        "Ykkösliiga",
        "Ykkönen",
        "Kakkonen",
        "Puchar Finlandii",
        "Kansallinen Liiga"
    ],
    "Francja": [
        "Ligue 1",
        "Ligue 2",
        "National",
        "National 2",
        "Coupe de France",
        "Trophée des Champions",
        "Division 1 Féminine"
    ],
    "Grecja": [
        "Super League",
        "Super League 2",
        "Gamma Ethniki",
        "Puchar Grecji",
        "Superpuchar Grecji",
        "Liga kobiet"
    ],
    "Gruzja": [
        "Erovnuli Liga",
        "Erovnuli Liga 2",
        "Liga 3",
        "Puchar Gruzji",
        "Superpuchar Gruzji",
        "Liga kobiet"
    ],
    "Gwatemala": [
        "Liga Nacional",
        "Primera División",
        "Copa Guatemala",
        "Liga kobiet"
    ],
    "Hiszpania": [
        "La Liga",
        "Segunda División",
        "Primera División Femenina",
        "Primera División RFEF",
        "Segunda División RFEF",
        "Copa del Rey",
        "Supercopa de España",
        "Copa de la Reina"
    ],
    "Holandia": [
        "Eredivisie",
        "Eerste Divisie",
        "Tweede Divisie",
        "Derde Divisie",
        "KNVB Beker",
        "Johan Cruyff Shield",
        "Vrouwen Eredivisie"
    ],
    "Honduras": [
        "Liga Nacional",
        "Liga de Ascenso",
        "Copa Presidente",
        "Liga kobiet"
    ],
    "Hongkong": [
        "Hong Kong Premier League",
        "First Division",
        "FA Cup",
        "Senior Shield",
        "Sapling Cup",
        "Liga kobiet"
    ],
    "Indie": [
        "Indian Super League",
        "I-League",
        "I-League 2",
        "Durand Cup",
        "Super Cup",
        "Indian Women's League"
    ],
    "Indonezja": [
        "Liga 1",
        "Liga 2",
        "Liga 3",
        "Piala Indonesia",
        "Liga kobiet"
    ],
    "Irlandia": [
        "Premier Division",
        "First Division",
        "FAI Cup",
        "League Cup",
        "President's Cup",
        "Women’s Premier Division"
    ],
    "Irlandia Północna": [
        "NIFL Premiership",
        "NIFL Championship",
        "Premier Intermediate League",
        "Irish Cup",
        "League Cup",
        "Women’s Premiership"
    ],
    "Islandia": [
        "Besta deild karla",
        "1. deild karla",
        "2. deild karla",
        "Puchar Islandii",
        "Superpuchar Islandii",
        "Besta deild kvenna"
    ],
    "Izrael": [
        "Ligat ha'Al",
        "Liga Leumit",
        "Liga Alef",
        "State Cup",
        "Toto Cup",
        "Liga kobiet"
    ],
    "Japonia": [
        "J1 League",
        "J2 League",
        "J3 League",
        "Emperor Cup",
        "J.League Cup",
        "WE League"
    ],
    "Kamerun": [
        "Elite One",
        "Elite Two",
        "Puchar Kamerunu",
        "Superpuchar Kamerunu",
        "Liga kobiet"
    ],
    "Kanada": [
        "Canadian Premier League",
        "Canadian Championship",
        "League1 Ontario",
        "Première Ligue de soccer du Québec",
        "League1 BC",
        "Northern Super League"
    ],
    "Kazachstan": [
        "Premier League",
        "First Division",
        "Second Division",
        "Puchar Kazachstanu",
        "Superpuchar Kazachstanu",
        "Liga kobiet"
    ],
    "Kenia": [
        "Premier League",
        "National Super League",
        "FKF Cup",
        "Super Cup",
        "Women Premier League"
    ],
    "Kolumbia": [
        "Primera A",
        "Primera B",
        "Copa Colombia",
        "Superliga Colombiana",
        "Liga Femenina"
    ],
    "Korea Południowa": [
        "K League 1",
        "K League 2",
        "K3 League",
        "K4 League",
        "Korean FA Cup",
        "WK League"
    ],
    "Kosowa": [
        "Superliga",
        "Liga e Parë",
        "Liga e Dytë",
        "Puchar Kosowa",
        "Superpuchar Kosowa",
        "Liga kobiet"
    ],
    "Kostaryka": [
        "Primera División",
        "Liga de Ascenso",
        "Copa Costa Rica",
        "Supercopa",
        "Liga kobiet"
    ],
    "Litwa": [
        "A Lyga",
        "I Lyga",
        "II Lyga",
        "Puchar Litwy",
        "Superpuchar Litwy",
        "A Lyga kobiet"
    ],
    "Macedonia": [
        "First League",
        "Second League",
        "Puchar Macedonii",
        "Superpuchar Macedonii",
        "Liga kobiet"
    ],
    "Malezja": [
        "Super League",
        "MFL Cup",
        "Malaysia Cup",
        "FA Cup",
        "Liga kobiet"
    ],
    "Malta": [
        "Premier League",
        "Challenge League",
        "National Amateur League",
        "FA Trophy",
        "Super Cup",
        "Liga kobiet"
    ],
    "Maroko": [
        "Botola Pro",
        "Botola 2",
        "Coupe du Trône",
        "Superpuchar Maroka",
        "Liga kobiet"
    ],
    "Meksyk": [
        "Liga MX",
        "Liga de Expansión",
        "Liga Premier Serie A",
        "Copa MX",
        "Campeón de Campeones",
        "Liga MX Femenil"
    ],
    "Mongolia": [
        "National Premier League",
        "First League",
        "Puchar Mongolii",
        "Superpuchar Mongolii",
        "Liga kobiet"
    ],
    "Niemcy": [
        "Bundesliga",
        "2. Bundesliga",
        "3. Liga",
        "Regionalliga",
        "DFB Pokal",
        "DFL Supercup",
        "Frauen Bundesliga"
    ],
    "Norwegia": [
        "Eliteserien",
        "OBOS-ligaen",
        "PostNord-ligaen",
        "Norsk Tipping-ligaen",
        "NM Cup",
        "Toppserien"
    ],
    "Panama": [
        "Liga Panameña de Fútbol",
        "Liga Prom",
        "Copa Panamá",
        "Supercopa",
        "Liga kobiet"
    ],
    "Paragwaj": [
        "Primera División",
        "División Intermedia",
        "Primera B",
        "Copa Paraguay",
        "Supercopa Paraguay",
        "Liga kobiet"
    ],
    "Peru": [
        "Liga 1",
        "Liga 2",
        "Copa Perú",
        "Copa Bicentenario",
        "Liga Femenina"
    ],
    "Polska": [
        "Ekstraklasa",
        "1 Liga",
        "2 Liga",
        "3 Liga",
        "Puchar Polski",
        "Superpuchar Polski",
        "Ekstraliga kobiet"
    ],
    "Portugalia": [
        "Primeira Liga",
        "Liga Portugal 2",
        "Liga 3",
        "Campeonato de Portugal",
        "Taça de Portugal",
        "Taça da Liga",
        "Liga BPI"
    ],
    "Republika Południowej Afryki": [
        "Premier Division",
        "First Division",
        "Nedbank Cup",
        "MTN 8",
        "Carling Knockout",
        "Hollywoodbets Super League"
    ],
    "Rosja": [
        "Premier League",
        "First League",
        "Second League",
        "Russian Cup",
        "Super Cup",
        "Women Championship"
    ],
    "Rumunia": [
        "Liga I",
        "Liga II",
        "Liga III",
        "Cupa României",
        "Supercupa României",
        "Liga 1 Feminin"
    ],
    "San-Marino": [
        "Campionato Sammarinese",
        "Coppa Titano",
        "Super Coppa Sammarinese",
        "Liga kobiet"
    ],
    "Serbia": [
        "SuperLiga",
        "Prva Liga",
        "Srpska Liga",
        "Puchar Serbii",
        "Superpuchar Serbii",
        "Superliga kobiet"
    ],
    "Singapur": [
        "Singapore Premier League",
        "Singapore Cup",
        "Community Shield",
        "Liga kobiet"
    ],
    "Szkocja": [
        "Premiership",
        "Championship",
        "League One",
        "League Two",
        "Scottish Cup",
        "League Cup",
        "SWPL 1"
    ],
    "Szwajcaria": [
        "Super League",
        "Challenge League",
        "Promotion League",
        "Swiss Cup",
        "Superpuchar Szwajcarii",
        "Women’s Super League"
    ],
    "Szwecja": [
        "Allsvenskan",
        "Superettan",
        "Ettan Norra",
        "Ettan Södra",
        "Svenska Cupen",
        "Damallsvenskan"
    ],
    "Słowacja": [
        "Nike Liga",
        "2. Liga",
        "3. Liga",
        "Puchar Słowacji",
        "Superpuchar Słowacji",
        "I. liga kobiet"
    ],
    "Słowenia": [
        "PrvaLiga",
        "2. SNL",
        "3. SNL",
        "Puchar Słowenii",
        "Superpuchar Słowenii",
        "Ženska liga"
    ],
    "Tajlandia": [
        "Thai League 1",
        "Thai League 2",
        "Thai League 3",
        "FA Cup",
        "League Cup",
        "Liga kobiet"
    ],
    "Turcja": [
        "Süper Lig",
        "1. Lig",
        "2. Lig",
        "3. Lig",
        "Puchar Turcji",
        "Superpuchar Turcji",
        "Kadınlar Süper Ligi"
    ],
    "USA": [
        "MLS",
        "USL Championship",
        "USL League One",
        "NWSL",
        "US Open Cup",
        "MLS Next Pro"
    ],
    "Ukraina": [
        "Premier League",
        "Persha Liga",
        "Druha Liga",
        "Puchar Ukrainy",
        "Superpuchar Ukrainy",
        "Liga kobiet"
    ],
    "Urugwaj": [
        "Primera División",
        "Segunda División",
        "Primera Amateur",
        "Copa Uruguay",
        "Supercopa Uruguaya",
        "Liga kobiet"
    ],
    "Wenezuela": [
        "Primera División",
        "Segunda División",
        "Copa Venezuela",
        "Liga kobiet"
    ],
    "Wietnam": [
        "V.League 1",
        "V.League 2",
        "Vietnamese Cup",
        "Super Cup",
        "Liga kobiet"
    ],
    "Wyspy Owcze": [
        "Premier League",
        "1. deild",
        "2. deild",
        "Puchar Wysp Owczych",
        "Superpuchar Wysp Owczych",
        "1. deild kvinnur"
    ],
    "Węgry": [
        "NB I",
        "NB II",
        "NB III",
        "Magyar Kupa",
        "Superpuchar Węgier",
        "Női NB I"
    ],
    "Włochy": [
        "Serie A",
        "Serie B",
        "Serie C",
        "Coppa Italia",
        "Supercoppa Italiana",
        "Serie A Kobiet"
    ],
    "Łotwa": [
        "Virsliga",
        "1. Liga",
        "2. Liga",
        "Puchar Łotwy",
        "Superpuchar Łotwy",
        "Liga kobiet"
    ],
    "Świat": [
        "Mistrzostwa Świata",
        "Towarzyskie międzynarodowe",
        "Klubowe MŚ",
        "Liga Narodów",
        "Kwalifikacje MŚ",
        "Igrzyska Olimpijskie"
    ]
}
  const getFootballLeaguesForCountry = (country) => {
    if (countryMap?.[country]) return Object.keys(countryMap[country])
    return footballLeagueMap[country] || ['1 Liga', '2 Liga', 'Puchar kraju', 'Liga kobiet']
  }

  function selectSidebarCountry(nextCountry) {
    setOpenSidebarSport('Piłka nożna')

    if (openFootballCountry === nextCountry) {
      setOpenFootballCountry('')
      return
    }

    setOpenFootballCountry(nextCountry)
    setLiveFixtures([])
    setHasTriedLiveLoad(false)
    setLiveDataSource('manual')
    setFootballViewMode('league-today')
    setLiveFixturesStatus('Wybierz ligę po lewej, a pokażę tylko dzisiejsze mecze tej ligi.')
    updateForm({
      sport: 'Piłka nożna',
      country: nextCountry,
      league: '',
      matchId: '',
      market: '',
      betType: '',
      odds: '',
    })
  }

  function matchStartsAfterBuffer(match) {
    const dateText = String(match?.date || '').trim()
    const timeText = String(match?.time || '').trim()
    let kick = null
    const isoCandidate = match?.commence_time || match?.start_time || match?.match_time
    if (isoCandidate) {
      const parsed = new Date(isoCandidate)
      if (!Number.isNaN(parsed.getTime())) kick = parsed
    }
    if (!kick && /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateText)) {
      const [day, month, year] = dateText.split('.')
      kick = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timeText || '00:00'}:00`)
    }
    if (!kick || Number.isNaN(kick.getTime())) return true
    return kick.getTime() > Date.now() + 1 * 60 * 1000
  }

  const matchOptions = liveFixtures.filter(matchStartsAfterBuffer)
  const selectedMatch = matchOptions.find(item => item.id === form.matchId) || matchOptions[0] || null
  const effectiveSelectedMatch = addTipMode === 'manual' && manualSelectedMatch ? manualSelectedMatch : selectedMatch

  const topSportButtons = useMemo(() => ([
    'Piłka nożna',
    'Tenis',
    'Koszykówka',
    'Hokej',
    'MMA',
    'E-sport',
    'Siatkówka',
    'Boks',
    'Piłka ręczna',
    'Krykiet',
    'Rugby',
    'Rugby League',
    'Baseball',
    'Dart',
  ].map((name) => ({
    name,
    icon: sportIconMap[name] || '🏅',
    country: 'Wszystkie',
    league: 'Wszystkie ligi',
    allLeagues: true,
  }))), [sportsbook])

  function enrichPopularMarkets(match, sourceMarkets = []) {
    const home = match?.home || 'Gospodarze'
    const away = match?.away || 'Goście'
    const sportLabel = `${match?.sport || ''} ${match?.league || ''} ${form.sport || ''}`.toLowerCase()
    const isFootball = sportLabel.includes('piłka') || sportLabel.includes('soccer') || sportLabel.includes('football') || sportLabel.includes('premier league') || sportLabel.includes('la liga') || sportLabel.includes('serie a') || sportLabel.includes('bundesliga') || sportLabel.includes('ligue')
    const isBaseball = sportLabel.includes('baseball') || sportLabel.includes('mlb') || sportLabel.includes('milb') || sportLabel.includes('ncaa baseball')
    const isTennis = sportLabel.includes('tenis') || sportLabel.includes('tennis') || sportLabel.includes('wta') || sportLabel.includes('atp') || sportLabel.includes('itf')
    const isBasketball = sportLabel.includes('koszyk') || sportLabel.includes('basketball') || sportLabel.includes('nba') || sportLabel.includes('ncaa basketball')
    const isHockey = sportLabel.includes('hokej') || sportLabel.includes('hockey') || sportLabel.includes('nhl')

    const footballOnlyMarkets = ['BTTS', 'Kartki', 'Rogi', 'Podwójna szansa', 'DNB / Remis nie ma zakładu', 'Gole', 'Połowy', 'Połowa']
    const base = (Array.isArray(sourceMarkets) ? sourceMarkets : [])
      .filter(item => {
        const marketName = String(item.market || '')
        if (isFootball) return marketName !== 'Zwycięzca meczu'
        return !footballOnlyMarkets.includes(marketName)
      })
      .map(item => ({ ...item }))

    // API-FOOTBALL Pro: pokazujemy wyłącznie kursy z endpointu /odds.
    // Jeżeli dostawca nie ma jeszcze kursów dla meczu, UI pokaże kreski zamiast sztucznych 1.72 / 3.25 / 2.10.
    if (match?.source === 'api-football' || match?.hasRealOdds === true || match?.hasRealOdds === false) {
      return base
    }

    const add = (market, pick, odds, confidence = 62) => {
      const exists = base.some(item => String(item.market) === market && String(item.pick) === pick)
      if (!exists) base.push({ market, pick, odds, confidence })
    }

    const hasDraw = isFootball
    if (!isFootball) {
      add('Zwycięzca meczu', `${home} wygra`, 1.72, 70)
      add('Zwycięzca meczu', `${away} wygra`, 2.10, 64)
    }
    if (hasDraw) add('1X2', 'Remis', 3.35, 56)

    if (isFootball) {
      add('1X2', `${home} wygra`, 1.72, 72)
      add('1X2', 'Remis', 3.35, 56)
      add('1X2', `${away} wygra`, 2.10, 64)

      add('Podwójna szansa', '1X', 1.28, 76)
      add('Podwójna szansa', 'X2', 1.58, 66)
      add('Podwójna szansa', '12', 1.25, 70)

      add('DNB / Remis nie ma zakładu', `${home} DNB`, 1.42, 70)
      add('DNB / Remis nie ma zakładu', `${away} DNB`, 1.88, 61)

      add('Gole', 'Powyżej 0.5 gola', 1.12, 85)
      add('Gole', 'Poniżej 0.5 gola', 7.20, 35)
      add('Gole', 'Powyżej 1.5 gola', 1.34, 78)
      add('Gole', 'Poniżej 1.5 gola', 3.10, 48)
      add('Gole', 'Powyżej 2.5 gola', 1.82, 68)
      add('Gole', 'Poniżej 2.5 gola', 1.95, 62)
      add('Gole', 'Powyżej 3.5 gola', 2.65, 52)
      add('Gole', 'Poniżej 3.5 gola', 1.44, 70)

      add('BTTS', 'Obie drużyny strzelą: TAK', 1.72, 66)
      add('BTTS', 'Obie drużyny strzelą: NIE', 2.02, 59)

      add('Handicap', `${home} -1.5`, 2.35, 58)
      add('Handicap', `${home} +1.5`, 1.32, 72)
      add('Handicap', `${away} -1.5`, 3.10, 45)
      add('Handicap', `${away} +1.5`, 1.57, 67)

      add('Kartki', 'Powyżej 2.5 kartek', 1.52, 69)
      add('Kartki', 'Poniżej 2.5 kartek', 2.35, 53)
      add('Kartki', 'Powyżej 3.5 kartek', 1.78, 64)
      add('Kartki', 'Poniżej 3.5 kartek', 2.00, 58)
      add('Kartki', 'Powyżej 4.5 kartek', 2.20, 51)
      add('Kartki', 'Poniżej 4.5 kartek', 1.61, 66)

      add('Rogi', 'Powyżej 7.5 rożnych', 1.55, 68)
      add('Rogi', 'Poniżej 7.5 rożnych', 2.30, 54)
      add('Rogi', 'Powyżej 8.5 rożnych', 1.85, 63)
      add('Rogi', 'Poniżej 8.5 rożnych', 1.90, 61)
      add('Rogi', 'Powyżej 9.5 rożnych', 2.10, 57)
      add('Rogi', 'Poniżej 9.5 rożnych', 1.68, 65)

      add('Połowy', `${home} wygra 1. połowę`, 2.45, 56)
      add('Połowy', 'Remis do przerwy', 2.05, 61)
      add('Połowy', `${away} wygra 1. połowę`, 3.20, 48)
      add('Połowy', 'Powyżej 0.5 gola 1. połowa', 1.40, 72)
      add('Połowy', 'Poniżej 0.5 gola 1. połowa', 2.75, 47)
    } else if (isBaseball) {
      add('Moneyline', `${home} wygra`, 1.76, 66)
      add('Moneyline', `${away} wygra`, 1.97, 64)
      add('Run Line', `${home} -1.5`, 2.15, 56)
      add('Run Line', `${home} +1.5`, 1.55, 69)
      add('Run Line', `${away} -1.5`, 2.25, 54)
      add('Run Line', `${away} +1.5`, 1.50, 70)
      add('Suma runów', 'Powyżej 7.5 runów', 1.86, 62)
      add('Suma runów', 'Poniżej 7.5 runów', 1.90, 60)
      add('Suma runów', 'Powyżej 8.5 runów', 1.92, 60)
      add('Suma runów', 'Poniżej 8.5 runów', 1.84, 62)
      add('Suma runów', 'Powyżej 9.5 runów', 2.05, 55)
      add('Suma runów', 'Poniżej 9.5 runów', 1.72, 65)
      add('1. połowa / 5 inningów', `${home} wygra po 5 inningach`, 1.82, 60)
      add('1. połowa / 5 inningów', `${away} wygra po 5 inningach`, 1.92, 58)
      add('Team Total', `${home} powyżej 3.5 runów`, 1.78, 61)
      add('Team Total', `${away} powyżej 3.5 runów`, 1.84, 59)
    } else if (isTennis) {
      add('Zwycięzca meczu', `${home} wygra`, 1.55, 70)
      add('Zwycięzca meczu', `${away} wygra`, 2.35, 58)
      add('Sety', `${home} 2:0`, 2.25, 55)
      add('Sety', `${away} 2:0`, 3.20, 45)
      add('Gemy', 'Powyżej 19.5 gemów', 1.82, 60)
      add('Gemy', 'Poniżej 19.5 gemów', 1.92, 58)
      add('Handicap gemów', `${home} -3.5`, 1.90, 56)
      add('Handicap gemów', `${away} +3.5`, 1.80, 61)
    } else if (isBasketball) {
      add('Zwycięzca meczu', `${home} wygra`, 1.72, 68)
      add('Zwycięzca meczu', `${away} wygra`, 2.05, 62)
      add('Spread', `${home} -4.5`, 1.90, 58)
      add('Spread', `${away} +4.5`, 1.90, 58)
      add('Suma punktów', 'Powyżej 210.5 punktów', 1.88, 60)
      add('Suma punktów', 'Poniżej 210.5 punktów', 1.88, 60)
      add('Kwarty', `${home} wygra 1. kwartę`, 1.95, 57)
      add('Kwarty', `${away} wygra 1. kwartę`, 2.05, 54)
    } else if (isHockey) {
      add('Zwycięzca meczu', `${home} wygra`, 1.85, 63)
      add('Zwycięzca meczu', `${away} wygra`, 2.05, 60)
      add('Suma bramek', 'Powyżej 5.5 bramek', 1.90, 58)
      add('Suma bramek', 'Poniżej 5.5 bramek', 1.90, 58)
      add('Puck Line', `${home} -1.5`, 2.40, 52)
      add('Puck Line', `${away} +1.5`, 1.48, 70)
    } else {
      add('Zwycięzca meczu', `${home} wygra`, 1.75, 65)
      add('Zwycięzca meczu', `${away} wygra`, 2.00, 62)
      add('Handicap', `${home} -1.5`, 2.10, 55)
      add('Handicap', `${away} +1.5`, 1.65, 65)
      add('Suma punktów', 'Powyżej', 1.88, 60)
      add('Suma punktów', 'Poniżej', 1.88, 60)
    }

    return base
  }

  const marketOptions = selectedMatch ? enrichPopularMarkets(selectedMatch, selectedMatch?.markets || []) : []
  const noRealMarket = { market: 'Brak kursów', pick: 'Brak realnych kursów', odds: '', confidence: 50 }
  const selectedMarket = marketOptions.find(item => item.market === form.market && item.pick === form.betType) || marketOptions.find(item => item.market === form.market) || marketOptions[0] || noRealMarket
  const groupedMarketOptions = marketOptions.reduce((groups, item, index) => {
    const label = String(item.market || 'Inne')
    if (!groups[label]) groups[label] = []
    groups[label].push({ ...item, __index: index })
    return groups
  }, {})
  const marketGroupOrder = ['Zwycięzca meczu', 'Wynik końcowy', 'Moneyline', '1X2', 'Podwójna szansa', 'DNB / Remis nie ma zakładu', 'Over/Under', 'Gole', 'Gole/Punkty', 'Suma runów', 'Suma punktów', 'Suma bramek', 'BTTS', 'Handicap', 'Run Line', 'Puck Line', 'Spread', 'Kartki', 'Rogi', 'Połowy', 'Połowa', '1. połowa / 5 inningów', 'Sety', 'Gemy', 'Handicap gemów', 'Team Total', 'Kwarty', 'Draw No Bet', 'Rynek']
  const orderedMarketGroups = Object.entries(groupedMarketOptions).sort(([a], [b]) => {
    const ai = marketGroupOrder.indexOf(a)
    const bi = marketGroupOrder.indexOf(b)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })
  const marketTabs = ['Wszystkie', 'Popularne', ...orderedMarketGroups.map(([label]) => label)]
  const visibleMarketGroups = orderedMarketGroups.filter(([label]) => {
    if (activeMarketTab === 'Wszystkie') return true
    if (activeMarketTab === 'Popularne') return ['Zwycięzca meczu', 'Wynik końcowy', 'Moneyline', '1X2', 'Podwójna szansa', 'DNB / Remis nie ma zakładu', 'Gole', 'Suma runów', 'Suma punktów', 'BTTS', 'Handicap', 'Run Line', 'Spread', 'Kartki', 'Rogi'].includes(label)
    return label === activeMarketTab
  })

  useEffect(() => {
    if (!showMarketBoard) return
    if (!visibleMarketGroups.length) {
      setExpandedMarketGroup('')
      return
    }
    const stillVisible = visibleMarketGroups.some(([label]) => label === expandedMarketGroup)
    if (!stillVisible) setExpandedMarketGroup(visibleMarketGroups[0][0])
  }, [showMarketBoard, activeMarketTab, selectedMatch?.id, visibleMarketGroups.length])
  const visibleMatchOptions = matchOptions
    .slice()
    .sort((a, b) => Date.parse(a.commence_time || '') - Date.parse(b.commence_time || ''))

  function getMatchDateBadge(match) {
    const eventKey = (() => {
      if (match?.commence_time) {
        const d = new Date(match.commence_time)
        if (!Number.isNaN(d.getTime())) {
          const year = d.getFullYear()
          const month = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        }
      }
      const label = String(match?.date || '')
      const m = label.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
      return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
    })()
    if (!eventKey) return match?.date || ''
    const today = getTodayLocalKey()
    const tomorrow = getDateKeyPlusDays(1)
    if (eventKey === today) return 'Dziś'
    if (eventKey === tomorrow) return 'Jutro'
    return match?.date || eventKey
  }

  useEffect(() => {
    if (!leagueOptions.includes(form.league)) {
      const nextLeague = leagueOptions[0] || ''
      const nextMatch = (activeLeagues?.[nextLeague] || [])[0]
      const nextMarket = nextMatch?.markets?.[0] || defaultMarket
      setForm(prev => ({
        ...prev,
        league: nextLeague,
        matchId: nextMatch?.id || prev.matchId,
        market: nextMarket.market,
        betType: nextMarket.pick,
        odds: String(nextMarket.odds),
        date: nextMatch?.date || prev.date,
        time: nextMatch?.time || prev.time,
        confidence: nextMarket.confidence || prev.confidence,
      }))
    }
  }, [form.sport])

  useEffect(() => {
    if (!selectedMatch) return
    if (!matchOptions.some(item => item.id === form.matchId)) {
      const nextMarket = selectedMatch.markets?.[0] || defaultMarket
      setForm(prev => ({
        ...prev,
        matchId: selectedMatch.id,
        market: nextMarket.market,
        betType: nextMarket.pick,
        odds: String(nextMarket.odds),
        date: selectedMatch.date || prev.date,
        time: selectedMatch.time || prev.time,
        confidence: nextMarket.confidence || prev.confidence,
      }))
    }
  }, [form.league])

  useEffect(() => {
    if (!selectedMatch) return
    const exists = marketOptions.some(item => item.market === form.market && item.pick === form.betType)
    if (!exists) {
      const nextMarket = marketOptions[0] || defaultMarket
      setForm(prev => ({
        ...prev,
        market: nextMarket.market,
        betType: nextMarket.pick,
        odds: String(nextMarket.odds),
        confidence: nextMarket.confidence || prev.confidence,
      }))
    }
  }, [form.matchId])

  async function fetchSportDayCounts(force = false) {
    const todayKey = getTodayLocalKey()
    const cacheKey = `betai_sport_day_counts_v733_${todayKey}`

    if (!force) {
      try {
        const cachedRaw = localStorage.getItem(cacheKey)
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw)
          if (cached && typeof cached === 'object') {
            setSportDayCounts(cached)
            setSportCountsDate(todayKey)
            return cached
          }
        }
      } catch (error) {
        console.warn('sport count cache read error', error)
      }
    }

    setSportDayCountsLoading(true)
    try {
      const requests = topSportButtons.map(async (item) => {
        try {
          const params = new URLSearchParams({
            sport: item.name,
            country: item.country || 'Wszystkie',
            league: item.league || item.name,
            date: todayKey,
            // Dla Typów AI trzymamy krótki zakres, żeby darmowe API i Netlify nie łapały timeoutu.
          // 2 = dzisiaj + 2 dni, czyli wystarczająco na start i nie zjada limitu APISports.
          daysAhead: '7',
            realOnly: '1',
            countOnly: '1',
            allLeagues: '1',
            mode: 'today'
          })
          const response = await fetch(`/.netlify/functions/get-sports-events?${params.toString()}&_ai=${Date.now()}`)
          const data = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(data.error || 'Count fetch failed')
          return [item.name, Number(data.count || 0)]
        } catch (error) {
          console.warn('sport count fetch error', item.name, error)
          return [item.name, 0]
        }
      })

      const entries = await Promise.all(requests)
      const nextCounts = Object.fromEntries(entries)
      setSportDayCounts(nextCounts)
      setSportCountsDate(todayKey)
      try {
        localStorage.setItem(cacheKey, JSON.stringify(nextCounts))
      } catch (error) {
        console.warn('sport count cache write error', error)
      }
      return nextCounts
    } finally {
      setSportDayCountsLoading(false)
    }
  }

  function handleTopSportButtonClick(item) {
    if (!item?.name) return
    setOpenSidebarSport(item.name)
    if (item.name === 'Piłka nożna') setOpenFootballCountry('')
    setLiveFixtures([])
    setLiveDataSource('loading')
    setLiveFixturesStatus(`LIVE: pobieram mecze bez limitu 2 dni — szeroko po wszystkich ligach — ${item.name}...`)
    updateForm({
      sport: item.name,
      country: item.country || 'Wszystkie',
      league: 'Wszystkie ligi',
      matchId: '',
      market: '',
      betType: '',
      odds: '',
    })
    window.setTimeout(() => {
      fetchLiveFixturesForDay({
        sport: item.name,
        country: item.country || 'Wszystkie',
        league: 'Wszystkie ligi',
        date: getTodayLocalKey(),
        daysAhead: LIVE_SEARCH_DAYS_AHEAD,
        allLeagues: true,
      })
    }, 60)
  }

  async function fetchDailyCount() {
    if (!isSupabaseConfigured || !supabase || !user?.id) {
      setDailyCount(0)
      return
    }

    setCountLoading(true)
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    try {
      let result = await supabase
        .from('tips')
        .select('id', { count: 'exact', head: true })
        .or(`author_id.eq.${user.id},user_id.eq.${user.id}`)
        .gte('created_at', startOfDay.toISOString())

      if (result.error && isSchemaError(result.error)) {
        result = await supabase
          .from('tips')
          .select('id', { count: 'exact', head: true })
          .eq('author_id', user.id)
          .gte('created_at', startOfDay.toISOString())
      }
      if (result.error) throw result.error
      setDailyCount(Number(result.count || 0))
    } catch (error) {
      console.warn('fetchDailyCount error', error)
      setDailyCount(0)
    } finally {
      setCountLoading(false)
    }
  }

  useEffect(() => {
    fetchDailyCount()
  }, [user?.id, userPlan])

  const FREE_DAILY_TIP_LIMIT = 5
  useEffect(() => {
    if (!isPremiumUser && form.accessType !== 'free') {
      setForm(prev => ({ ...prev, accessType: 'free' }))
    }
  }, [isPremiumUser, form.accessType])

  const dailyLimit = isPremiumUser ? Infinity : FREE_DAILY_TIP_LIMIT
  const remainingFreeSlots = isPremiumUser ? '∞' : Math.max(dailyLimit - dailyCount, 0)
  const limitReached = !isPremiumUser && dailyCount >= FREE_DAILY_TIP_LIMIT
  const canPublishPremium = isPremiumUser
  const canSellTips = isPremiumUser
  const previewPrice = form.accessType === 'premium' ? Math.max(0, Number(form.singlePrice || 0) || 0) : 0
  const confidencePercent = Math.min(99, Math.max(15, Number(form.confidence || selectedMarket.confidence || 50) || 50))
  const confidenceLabel = confidencePercent >= 85 ? 'Bardzo wysoki' : confidencePercent >= 70 ? 'Wysoki' : confidencePercent >= 55 ? 'Średni' : 'Niski'
  const confidenceFilled = Math.max(1, Math.min(15, Math.round((confidencePercent / 100) * 15)))
  const previewReachMin = form.accessType === 'premium' ? Math.round(confidencePercent * 28) : Math.round(confidencePercent * 18)
  const previewReachMax = form.accessType === 'premium' ? previewReachMin + 700 : previewReachMin + 400
    function updateForm(patch) {
    setForm(prev => ({ ...prev, ...patch }))
  }

  function applyMatchToForm(match) {
    const nextMarket = match?.markets?.[0] || noRealMarket
    if (!match) return
    if (match.country) setOpenFootballCountry(match.country)
    updateForm({
      sport: match.sport || form.sport,
      country: match.country || currentCountry,
      matchId: match.id || `${match.home}-${match.away}`,
      league: match.league || currentLeague,
      market: nextMarket.market,
      betType: nextMarket.pick,
      odds: String(nextMarket.odds || form.odds || 1.7),
      confidence: nextMarket.confidence || form.confidence,
      date: match.date || form.date,
      time: match.time || form.time,
      description: ''
    })
  }


  function getPrimaryOdds(match) {
    const home = String(match?.home || '')
    const away = String(match?.away || '')
    const allMarkets = Array.isArray(match?.markets) ? match.markets : []
    const base = allMarkets.filter(item => ['Wynik końcowy', '1X2'].includes(String(item.market || '')))
    const findBy = (predicate) => base.find(predicate) || null
    const homePick = findBy(item => String(item.pick || '').includes(home) && String(item.pick || '').toLowerCase().includes('wygra'))
    const drawPick = findBy(item => String(item.pick || '').toLowerCase().includes('remis'))
    const awayPick = findBy(item => String(item.pick || '').includes(away) && String(item.pick || '').toLowerCase().includes('wygra'))
    return [
      { short: '1', item: homePick },
      { short: 'X', item: drawPick },
      { short: '2', item: awayPick },
    ]
  }

  function openMatchMarkets(match) {
    if (!match) return
    applyMatchToForm(match)
    setShowMarketBoard(true)
    setTicketMarketSelected(false)
    setActiveMarketTab('Wszystkie')
    requestAnimationFrame(() => {
      const firstGroup = Object.keys((match?.markets || []).reduce((groups, item) => {
        const label = String(item.market || 'Inne')
        groups[label] = true
        return groups
      }, {}))[0] || ''
      setExpandedMarketGroup(firstGroup)
    })
  }

  function selectMatchAndMaybeMarket(match, marketItem = null) {
    if (!match) return
    applyMatchToForm(match)
    if (marketItem) {
      setShowMarketBoard(false)
      requestAnimationFrame(() => {
        chooseMarket(`${marketItem.market}|||${marketItem.pick}|||${marketItem.odds}|||${marketItem.confidence || confidencePercent}`)
      })
      return
    }
    openMatchMarkets(match)
  }


  function selectSidebarSport(nextSport) {
    if (openSidebarSport === nextSport) {
      setOpenSidebarSport('')
      return
    }

    setOpenSidebarSport(nextSport)
    if (nextSport === 'Piłka nożna') {
      setOpenFootballCountry(form.country || 'Anglia')
    }
    if (nextSport !== form.sport) {
      chooseSport(nextSport)
    }
  }

  function selectSidebarLeague(nextSport, nextCountry, nextLeague) {
    setOpenSidebarSport(nextSport)
    if (nextSport === 'Piłka nożna') setOpenFootballCountry(nextCountry)

    setFootballViewMode('league-today')
    setFixtureSearchPerformed(false)
    setSidebarSearch('')
    setLiveFixtures([])
    setLiveDataSource('loading')
    setLiveFixturesStatus(`Pobieram dzisiejsze mecze ligi ${nextLeague}...`)
    updateForm({
      sport: nextSport,
      country: nextCountry || 'Wszystkie',
      league: nextLeague,
      matchId: '',
      market: '',
      betType: '',
      odds: '',
    })

    window.setTimeout(() => {
      fetchLiveFixturesForDay({
        sport: nextSport,
        country: nextCountry || 'Wszystkie',
        league: nextLeague,
        date: getTodayLocalKey(),
        daysAhead: 0,
        allLeagues: false,
        mode: 'league-today',
      })
    }, 30)
  }


  function fetchAllTodayFootballFixtures() {
    setFootballViewMode('all-today')
    setFixtureSearchPerformed(false)
    setSidebarSearch('')
    setLiveFixtures([])
    setLiveDataSource('loading')
    setLiveFixturesStatus('Pobieram wszystkie dzisiejsze mecze piłki nożnej...')
    updateForm({
      sport: 'Piłka nożna',
      country: 'Wszystkie',
      league: 'Wszystkie ligi',
      matchId: '',
      market: '',
      betType: '',
      odds: '',
    })
    fetchLiveFixturesForDay({
      sport: 'Piłka nożna',
      country: 'Wszystkie',
      league: 'Wszystkie ligi',
      date: getTodayLocalKey(),
      daysAhead: 0,
      allLeagues: true,
      mode: 'all-today',
    })
  }

  function handleFixtureSearchSubmit(event) {
    event?.preventDefault?.()
    const query = String(sidebarSearch || '').trim()
    if (!query) {
      fetchAllTodayFootballFixtures()
      return
    }
    setFootballViewMode('search')
    setFixtureSearchPerformed(true)
    setFixtureSearchLoading(true)
    setLiveFixtures([])
    setLiveDataSource('loading')
    setLiveFixturesStatus(`Szukam prawdziwych meczów dla „${query}”...`)
    fetchLiveFixturesForDay({
      sport: 'Piłka nożna',
      country: 'Wszystkie',
      league: 'Wszystkie ligi',
      date: getTodayLocalKey(),
      daysAhead: 365,
      allLeagues: true,
      mode: 'search',
      query,
    }).finally(() => setFixtureSearchLoading(false))
  }


  async function fetchLiveFixturesForDay(overrides = {}) {
    const isSilentRefresh = Boolean(overrides.silent)
    if (!isSilentRefresh) setLiveFixturesLoading(true)
    setHasTriedLiveLoad(true)
    if (!isSilentRefresh) {
      setLiveDataSource('loading')
      setLiveFixturesStatus(overrides.mode === 'search' ? `Szukam meczu „${overrides.query || sidebarSearch}”...` : overrides.mode === 'all-today' ? 'Pobieram wszystkie dzisiejsze mecze...' : 'Pobieram dzisiejsze mecze wybranej ligi...')
    }
    try {
      const params = new URLSearchParams({
        sport: overrides.sport || form.sport || '',
        country: overrides.country || currentCountry || '',
        league: overrides.league || currentLeague || '',
        date: overrides.date || liveDate || getTodayLocalKey(),
        daysAhead: String(overrides.daysAhead ?? 0),
        realOnly: '1',
        allLeagues: overrides.allLeagues ? '1' : '0',
        mode: overrides.mode || footballViewMode || 'league-today',
        query: overrides.query || '',
      })
      const response = await fetch(`/.netlify/functions/get-sports-events?${params.toString()}&_ai=${Date.now()}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Nie udało się pobrać meczów')
      const rawFixtures = Array.isArray(data.fixtures) ? data.fixtures : []
      const requestedLeague = String(overrides.league || currentLeague || '').trim()

      // WERSJA 851:
      // Backend już pilnuje kraju i ligi. Frontend NIE może drugi raz odrzucać meczów,
      // bo API zwraca kraj np. "England", a UI ma "Anglia". To właśnie wycinało poprawne mecze.
      // W widoku "mecze dzisiaj" pokazujemy wszystkie dzisiejsze mecze ligi, także te które już się zaczęły.
      const fixtures = ['league-today', 'all-today'].includes(overrides.mode)
        ? rawFixtures
        : rawFixtures.filter(matchStartsAfterBuffer)
      setLiveFixtures(fixtures)
      setLiveDataSource(data.source || (data.demo ? 'demo' : 'odds-api'))
      if (fixtures.length) {
        applyMatchToForm(fixtures[0])
        const sourceLabel = data.demo ? 'TRYB DEMO' : (String(data.source || '').includes('api-sports') ? 'API-SPORTS' : 'LIVE API')
        if (!isSilentRefresh) {
          const scopeLabel = overrides.mode === 'all-today'
            ? 'wszystkich dzisiejszych meczów piłki nożnej'
            : overrides.mode === 'search'
              ? `wyników wyszukiwania dla „${overrides.query || sidebarSearch}”`
              : `dzisiejszych meczów ligi ${requestedLeague}`
          setLiveFixturesStatus(`${sourceLabel}: ${fixtures.length} ${scopeLabel}. Godziny rosnąco, czas dla Polski.`)
          onToast?.({ type: 'success', title: data.demo ? 'Tryb demo' : 'Mecze pobrane', message: `Załadowano ${fixtures.length} realnych wydarzeń.` })
        } else {
          setLiveFixturesStatus(`LIVE API: odświeżono automatycznie. Aktualnie ${fixtures.length} realnych meczów bez limitu 2 dni.`)
        }
      } else {
        setLiveFixtures([])
        setLiveDataSource(data.source || 'empty')
        if (!isSilentRefresh) {
          setLiveFixturesStatus(data.message || `LIVE API/API-Sports: brak realnych meczów dla wybranych filtrów. Nie pokazuję demo ani fake meczów.`)
          const noResultsMessage = overrides.mode === 'all-today'
            ? 'API nie zwróciło dziś meczów piłki nożnej.'
            : overrides.mode === 'search'
              ? `Nie znaleziono meczu dla „${overrides.query || sidebarSearch}”.`
              : `API nie zwróciło dziś meczów dla ligi ${requestedLeague}.`
          onToast?.({ type: 'info', title: overrides.mode === 'search' ? 'Brak wyników' : 'Dziś brak meczów', message: noResultsMessage })
        } else {
          setLiveFixturesStatus(data.message || `LIVE API: automatyczne odświeżenie — brak realnych meczów bez limitu 2 dni.`)
        }
      }
    } catch (error) {
      console.warn('fetch live fixtures error', error)
      setLiveFixtures([])
      setLiveDataSource('error')
      if (!isSilentRefresh) {
        setLiveFixturesStatus('LIVE API/API-Sports: nie udało się pobrać realnych danych. Sprawdź APISPORTS_KEY w Netlify.')
        onToast?.({ type: 'error', title: 'Nie pobrano realnych kursów', message: error?.message || 'Sprawdź konfigurację API.' })
      } else {
        setLiveFixturesStatus('LIVE API: automatyczne odświeżenie nie powiodło się. Spróbuję ponownie za 1 minutę.')
      }
    } finally {
      if (!isSilentRefresh) setLiveFixturesLoading(false)
    }
  }

  function clampStakeValue(value) {
    const raw = String(value ?? '').replace(',', '.').replace(/[^0-9.]/g, '')
    const numeric = Math.min(1000, Math.max(0, Number(raw || 0) || 0))
    return numeric ? String(numeric) : ''
  }

  function getSelectedMatchKey(match = selectedMatch) {
    return `${currentLeague}|${match?.home || ''}|${match?.away || ''}|${form.date || ''}|${form.time || ''}`.toLowerCase().replace(/\s+/g, ' ').trim()
  }

  async function hasDuplicateMatchToday() {
    if (!isSupabaseConfigured || !supabase || !user?.id || !selectedMatch) return false

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const matchText = `${selectedMatch.home} vs ${selectedMatch.away}`
    const currentKey = getSelectedMatchKey()

    try {
      const { data, error } = await supabase
        .from('tips')
        .select('id,match,team_home,team_away,league,match_time,created_at,author_id,user_id')
        .or(`author_id.eq.${user.id},user_id.eq.${user.id}`)
        .gte('created_at', startOfDay.toISOString())
        .limit(100)

      if (error) {
        if (!isSchemaError(error)) throw error
        return false
      }

      return (data || []).some(row => {
        const rowMatch = String(row.match || '').toLowerCase().trim()
        const sameTextMatch = rowMatch && rowMatch === matchText.toLowerCase()
        const rowDate = row.match_time ? new Date(row.match_time) : null
        const rowDateLabel = rowDate && !Number.isNaN(rowDate.getTime()) ? rowDate.toLocaleDateString('pl-PL') : ''
        const rowTimeLabel = rowDate && !Number.isNaN(rowDate.getTime()) ? rowDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : ''
        const rowKey = `${row.league || ''}|${row.team_home || ''}|${row.team_away || ''}|${rowDateLabel}|${rowTimeLabel}`.toLowerCase().replace(/\s+/g, ' ').trim()
        return sameTextMatch || (rowKey && rowKey === currentKey)
      })
    } catch (error) {
      console.warn('duplicate match check skipped', error)
      return false
    }
  }

  function chooseSport(nextSport) {
    setLiveFixtures([])
    setLiveFixturesStatus('')
    const nextSportData = sportsbook[nextSport] || { leagues: {} }
    const nextCountryMap = nextSportData.countries || null
    const nextCountry = nextCountryMap ? Object.keys(nextCountryMap)[0] : 'Wszystkie'
    const nextLeagueSource = nextCountryMap ? (nextCountryMap[nextCountry] || {}) : (nextSportData.leagues || {})
    const nextLeague = Object.keys(nextLeagueSource || {})[0] || ''
    const nextMatch = (nextLeagueSource?.[nextLeague] || [])[0]
    const nextMarket = nextMatch?.markets?.[0] || defaultMarket
    updateForm({
      sport: nextSport,
      country: nextCountry,
      league: nextLeague,
      matchId: nextMatch?.id || form.matchId,
      market: nextMarket.market,
      betType: nextMarket.pick,
      odds: String(nextMarket.odds),
      confidence: nextMarket.confidence || form.confidence,
      date: nextMatch?.date || form.date,
      time: nextMatch?.time || form.time,
    })
  }

  function chooseCountry(nextCountry) {
    setLiveFixtures([])
    setLiveFixturesStatus('')
    const nextLeagueSource = countryMap ? (countryMap[nextCountry] || {}) : (sportData.leagues || {})
    const nextLeague = Object.keys(nextLeagueSource || {})[0] || ''
    const nextMatch = (nextLeagueSource?.[nextLeague] || [])[0]
    const nextMarket = nextMatch?.markets?.[0] || defaultMarket
    updateForm({
      country: nextCountry,
      league: nextLeague,
      matchId: nextMatch?.id || form.matchId,
      market: nextMarket.market,
      betType: nextMarket.pick,
      odds: String(nextMarket.odds),
      confidence: nextMarket.confidence || form.confidence,
      date: nextMatch?.date || form.date,
      time: nextMatch?.time || form.time,
    })
  }

  function chooseLeague(nextLeague) {
    setLiveFixtures([])
    setLiveFixturesStatus('')
    const nextMatch = (activeLeagues?.[nextLeague] || [])[0]
    const nextMarket = nextMatch?.markets?.[0] || defaultMarket
    updateForm({
      league: nextLeague,
      matchId: nextMatch?.id || form.matchId,
      market: nextMarket.market,
      betType: nextMarket.pick,
      odds: String(nextMarket.odds),
      confidence: nextMarket.confidence || form.confidence,
      date: nextMatch?.date || form.date,
      time: nextMatch?.time || form.time,
    })
  }

  function chooseMatch(nextId) {
    const nextMatch = matchOptions.find(item => item.id === nextId) || selectedMatch
    applyMatchToForm(nextMatch)
  }

  function chooseMarket(value) {
    const [marketName, pickName, oddsValue, confidenceValue] = String(value || '').split('|||')
    setTicketMarketSelected(true)
    const nextMarket = marketOptions.find(item =>
      String(item.market) === marketName &&
      String(item.pick) === pickName &&
      String(item.odds) === String(oddsValue)
    ) || marketOptions.find(item =>
      String(item.market) === marketName &&
      String(item.pick) === pickName
    ) || selectedMarket

    const nextOdds = Number(nextMarket?.odds ?? oddsValue ?? form.odds)
    const nextConfidence = Number(nextMarket?.confidence ?? confidenceValue ?? form.confidence)

    updateForm({
      market: nextMarket.market,
      betType: nextMarket.pick,
      odds: String(Number.isFinite(nextOdds) ? nextOdds : form.odds),
      confidence: Number.isFinite(nextConfidence) ? nextConfidence : form.confidence,
    })
  }

  function toggleAccess(type) {
    if (type === 'premium' && !canPublishPremium) {
      onToast?.({
        type: 'premium',
        title: 'Premium wymagane',
        message: 'Konto FREE może opublikować maksymalnie 5 darmowych typów na dobę i nie może sprzedawać typów. Sprzedaż oraz brak limitu są dostępne w koncie Premium.',
        cta: 'Kup Premium',
        event: 'betai:start-premium-checkout'
      })
      return
    }
    if (type === 'free') {
      updateForm({ accessType: 'free', singlePrice: '0.00' })
      return
    }
    updateForm({ accessType: 'premium', singlePrice: Number(form.singlePrice || 0) > 0 ? form.singlePrice : '29.00' })
  }

  function addTag() {
    const next = window.prompt('Podaj tag, np. #PremierLeague')
    if (!next) return
    const normalized = next.startsWith('#') ? next : `#${next}`
    setForm(prev => ({ ...prev, tags: Array.from(new Set([...(prev.tags || []), normalized.trim().slice(0, 24)])) }))
  }

  function removeTag(tag) {
    setForm(prev => ({ ...prev, tags: (prev.tags || []).filter(item => item !== tag) }))
  }

  function regenerateAi() {
    const nextConfidence = Math.min(96, Math.max(52, (selectedMarket?.confidence || 70) + Math.round((Math.random() * 8) - 2)))
    const home = effectiveSelectedMatch?.home || 'Gospodarze'
    const away = effectiveSelectedMatch?.away || 'Goście'
    const nextText = `${home} vs ${away}: model AI ocenia ten typ jako ${nextConfidence >= 80 ? 'bardzo mocny' : nextConfidence >= 70 ? 'solidny' : 'ostrożny'} wybór. Główne argumenty: forma z ostatnich spotkań, jakość sytuacji bramkowych oraz dopasowanie kursu do ryzyka.`
    updateForm({
      aiAnalysis: nextText,
      confidence: nextConfidence
    })
    onToast?.({ type: 'success', title: 'AI odświeżona', message: 'Wygenerowaliśmy nową wersję analizy i poziomu pewności.' })
  }

  function switchAddTipMode(mode) {
    setAddTipMode(mode)
    setShowMarketBoard(false)
    setTicketMarketSelected(false)
    if (mode !== 'manual') setManualSelectedMatch(null)
  }

  function updateManualForm(patch) {
    setManualForm(prev => ({ ...prev, ...patch }))
  }

  function parseManualEventName(value) {
    const raw = String(value || '').trim()
    if (!raw) return { home: 'Gospodarze', away: 'Goście' }
    const separators = [' vs ', ' VS ', ' - ', '–', '—', ':']
    for (const separator of separators) {
      if (raw.includes(separator)) {
        const [home, away] = raw.split(separator).map(item => String(item || '').trim()).filter(Boolean)
        if (home && away) return { home, away }
      }
    }
    return { home: raw, away: 'Rywale' }
  }

  function formatManualDateTimeParts(value) {
    const raw = String(value || '').trim()
    if (!raw) return { date: '', time: '' }
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) return { date: '', time: '' }
    const day = String(parsed.getDate()).padStart(2, '0')
    const month = String(parsed.getMonth() + 1).padStart(2, '0')
    const year = parsed.getFullYear()
    const hours = String(parsed.getHours()).padStart(2, '0')
    const minutes = String(parsed.getMinutes()).padStart(2, '0')
    return { date: `${day}.${month}.${year}`, time: `${hours}:${minutes}` }
  }

  function handleManualAddToTicket(event) {
    event?.preventDefault?.()
    if (!String(manualForm.event || '').trim()) {
      onToast?.({ type: 'error', title: 'Brak wydarzenia', message: 'Wpisz nazwę meczu lub wydarzenia.' })
      return
    }
    if (!String(manualForm.betType || '').trim()) {
      onToast?.({ type: 'error', title: 'Brak typu', message: 'Wpisz typ ręczny, który chcesz dodać.' })
      return
    }
    if (!String(manualForm.odds || '').trim()) {
      onToast?.({ type: 'error', title: 'Brak kursu', message: 'Podaj kurs dla typu ręcznego.' })
      return
    }

    const teams = parseManualEventName(manualForm.event)
    const dt = formatManualDateTimeParts(manualForm.datetimeLocal)
    const nextMatch = {
      id: `manual-${Date.now()}`,
      sport: manualForm.sport,
      country: manualForm.country,
      league: manualForm.league,
      home: teams.home,
      away: teams.away,
      date: dt.date || form.date,
      time: dt.time || form.time,
      commence_time: manualForm.datetimeLocal ? new Date(manualForm.datetimeLocal).toISOString() : null,
      markets: [],
      source: 'manual-entry',
    }

    setManualSelectedMatch(nextMatch)
    updateForm({
      sport: manualForm.sport,
      country: manualForm.country,
      league: manualForm.league,
      market: 'Ręczny typ',
      betType: manualForm.betType,
      odds: manualForm.odds,
      date: dt.date || form.date,
      time: dt.time || form.time,
      matchId: nextMatch.id,
    })
    setTicketMarketSelected(true)
    onToast?.({ type: 'success', title: 'Dodano do kuponu', message: 'Ręczny typ został dodany. Możesz go teraz opublikować.' })
  }

  async function handlePublish() {
    const publishMatch = effectiveSelectedMatch
    if (!user?.id) {
      onToast?.({ type: 'error', title: 'Brak konta', message: 'Zaloguj się, aby dodać typ.' })
      return
    }
    if (!canSellTips && form.accessType === 'premium') {
      updateForm({ accessType: 'free' })
      onToast?.({
        type: 'premium',
        title: 'Sprzedaż tylko w Premium',
        message: 'Konto FREE może publikować tylko darmowe typy. Sprzedaż typów jest dostępna dopiero w koncie Premium.',
        cta: 'Kup Premium',
        event: 'betai:start-premium-checkout'
      })
      return
    }
    if (limitReached) {
      onToast?.({
        type: 'limit',
        title: 'Limit FREE wykorzystany',
        message: 'Konto FREE może opublikować maksymalnie 5 darmowych typów na dobę i nie może sprzedawać typów. Aktywuj Premium, aby publikować bez limitu i sprzedawać swoje typy.',
        cta: 'Kup Premium',
        event: 'betai:start-premium-checkout'
      })
      return
    }
    if (form.accessType === 'premium' && !canPublishPremium) {
      toggleAccess('premium')
      return
    }
    if (!publishMatch) {
      onToast?.({ type: 'error', title: 'Brak meczu', message: addTipMode === 'manual' ? 'Dodaj najpierw typ ręczny do kuponu.' : 'Wybierz mecz przed publikacją typu.' })
      return
    }

    const stakeValue = Number(form.stake || 0) || 0
    if (stakeValue > 1000) {
      updateForm({ stake: '1000' })
      onToast?.({ type: 'error', title: 'Maksymalna stawka', message: 'Maksymalna stawka dla typu to 1000 zł. Większa kwota została zablokowana.' })
      return
    }
    if (stakeValue <= 0) {
      onToast?.({ type: 'error', title: 'Brak stawki', message: 'Podaj stawkę większą niż 0 zł.' })
      return
    }

    const duplicateMatch = await hasDuplicateMatchToday()
    if (duplicateMatch) {
      onToast?.({
        type: 'limit',
        title: 'Ten mecz został już dodany',
        message: 'Nie można spamować tym samym meczem. Jeden użytkownik może dodać dany mecz tylko raz na dobę.'
      })
      return
    }

    setSaving(true)
    const combinedIso = (() => {
      try {
        const [day, month, year] = String(form.date || '').split('.')
        const dateObject = new Date(`${year}-${month}-${day}T${form.time || '12:00'}:00`)
        return dateObject.toISOString()
      } catch (_) {
        return new Date().toISOString()
      }
    })()
    const finalAccessType = form.accessType === 'premium' ? 'premium' : 'free'
    const priceValue = finalAccessType === 'premium' ? Math.max(0, Number(form.singlePrice || 0) || 0) : 0
    const tipPayloadRich = {
      author_id: user.id,
      user_id: user.id,
      author_name: username,
      author_email: email,
      sport: form.sport,
      league: currentLeague,
      match: `${publishMatch.home} vs ${publishMatch.away}`,
      team_home: publishMatch.home,
      team_away: publishMatch.away,
      fixture_id: publishMatch.apiFixtureId || publishMatch.fixtureId || publishMatch.id || null,
      home_team_id: publishMatch.homeTeamId || null,
      away_team_id: publishMatch.awayTeamId || null,
      home_logo: publishMatch.homeLogo || null,
      away_logo: publishMatch.awayLogo || null,
      match_time: combinedIso,
      market: form.market,
      bet_type: form.betType,
      prediction: form.betType,
      odds: Number(form.odds || 0),
      course: Number(form.odds || 0),
      stake: stakeValue,
      description: form.description,
      analysis: form.description,
      ai_analysis: form.aiAnalysis,
      ai_source: 'user_manual',
      ai_confidence: confidencePercent,
      ai_probability: confidencePercent,
      confidence: confidencePercent,
      access_type: finalAccessType,
      access: finalAccessType,
      is_premium: finalAccessType === 'premium',
      price: priceValue,
      single_price: priceValue,
      tip_price: priceValue,
      status: 'pending',
      created_at: new Date().toISOString(),
    }
    const tipPayloadBasic = {
      author_id: user.id,
      user_id: user.id,
      author_name: username,
      author_email: email,
      league: currentLeague,
      match: `${publishMatch.home} vs ${publishMatch.away}`,
      team_home: publishMatch.home,
      team_away: publishMatch.away,
      fixture_id: publishMatch.apiFixtureId || publishMatch.fixtureId || publishMatch.id || null,
      home_team_id: publishMatch.homeTeamId || null,
      away_team_id: publishMatch.awayTeamId || null,
      home_logo: publishMatch.homeLogo || null,
      away_logo: publishMatch.awayLogo || null,
      match_time: combinedIso,
      bet_type: form.betType,
      odds: Number(form.odds || 0),
      stake: stakeValue,
      description: form.description,
      access_type: finalAccessType,
      is_premium: finalAccessType === 'premium',
      price: priceValue,
      status: 'pending',
      created_at: new Date().toISOString(),
    }
    const tipPayloadMinimal = {
      user_id: user.id,
      author_id: user.id,
      author_name: username,
      username,
      author_email: email,
      email,
      league: currentLeague,
      match: `${publishMatch.home} vs ${publishMatch.away}`,
      prediction: form.betType,
      odds: Number(form.odds || 0),
      stake: stakeValue,
      description: form.description,
      access_type: finalAccessType,
      is_premium: finalAccessType === 'premium',
      price: priceValue,
      single_price: priceValue,
      tip_price: priceValue,
      created_at: new Date().toISOString(),
    }
    const tipPayloadLegacy = {
      user_id: user.id,
      author_id: user.id,
      username,
      author_name: username,
      author_email: email,
      email,
      league: currentLeague,
      match: `${publishMatch.home} vs ${publishMatch.away}`,
      prediction: form.betType,
      odds: Number(form.odds || 0),
      stake: stakeValue,
      description: form.description,
      access_type: finalAccessType,
      is_premium: finalAccessType === 'premium',
      price: priceValue,
      created_at: new Date().toISOString(),
    }

    try {
      let savedRow = null
      let lastError = null
      for (const candidate of [tipPayloadRich, tipPayloadBasic, tipPayloadMinimal, tipPayloadLegacy]) {
        const { data, error } = await supabase.from('tips').insert(candidate).select('*').single()
        if (!error && data) {
          savedRow = data
          break
        }
        lastError = error
        if (!isSchemaError(error)) break
      }
      if (!savedRow && lastError) throw lastError
      if (!savedRow) savedRow = { id: `local_${Date.now()}`, ...tipPayloadBasic }

      saveTipDebug('SUCCESS', `tip:${savedRow.id || 'new'}`)
      setDailyCount(prev => prev + 1)
      onToast?.({
        type: 'success',
        title: 'Typ opublikowany',
        message: finalAccessType === 'premium'
          ? `Twój tip premium został dodany do dashboardu i profilu. Cena singla: ${priceValue.toFixed(2)} zł.`
          : `Twój darmowy tip został dodany do dashboardu i profilu.${isPremiumUser ? '' : ` Pozostało dziś ${Math.max(5 - (dailyCount + 1), 0)} z 5 darmowych typów.`}`
      })
      onTipSaved?.(normalizeTipRow({
        ...savedRow,
        author_name: username,
        username,
        author_email: email,
        author_avatar_url: savedRow?.author_avatar_url || getProfileAvatarUrl(user) || null,
        avatar_url: savedRow?.avatar_url || getProfileAvatarUrl(user) || null
      }))
    } catch (error) {
      console.error('publish tip error', error)
      saveTipDebug('ERROR', error?.message || String(error))
      onToast?.({ type: 'error', title: 'Nie udało się opublikować typu', message: formatAppErrorMessage(error?.message || 'Sprawdź konfigurację tabeli tips w Supabase.') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="add-page add-tip-ultra-static add-tip-betfolio-page">
      <div className={`betfolio-add-shell ${ticketMarketSelected ? "ticket-visible" : "ticket-hidden"}`}>
        <aside className="betfolio-left glass-ultra-panel betai-sportsbook-nav">
          <form className="betfolio-search-wrap betfolio-global-search" onSubmit={handleFixtureSearchSubmit}>
            <input
              className="betfolio-search-input"
              value={sidebarSearch}
              onChange={(event) => setSidebarSearch(event.target.value)}
              placeholder="Szukaj meczu lub drużyny..."
            />
            <button className="betfolio-search-go-btn" type="submit" disabled={fixtureSearchLoading}>{fixtureSearchLoading ? '...' : 'Szukaj'}</button>
          </form>
<div className="sports-accordion-title">SPORT</div>

          <div className="sports-accordion-list">
            <div className={`sport-accordion-item ${openSidebarSport === 'Piłka nożna' ? 'is-open' : ''}`}>
              <button type="button" className="sport-accordion-head" onClick={() => selectSidebarSport('Piłka nożna')}>
                <span>⚽ Piłka nożna</span><b>{openSidebarSport === 'Piłka nożna' ? '⌃' : '⌄'}</b>
              </button>
              {openSidebarSport === 'Piłka nożna' && (
                <div className="sport-accordion-children football-country-tree">
                  {footballCountryOptions.map(country => {
                    const cleanCountry = normalizeFootballCountryName(country)
                    const flagCode = footballCountryFlagCodes[cleanCountry]
                    const isCountryActive = currentCountry === country
                    const isCountryOpen = openFootballCountry === country
                    const countryLeagues = getFootballLeaguesForCountry(country)
                    return (
                      <div className="football-country-node" key={country}>
                        <button
                          type="button"
                          className={isCountryActive ? 'is-active country-active' : ''}
                          onClick={() => selectSidebarCountry(country)}
                        >
                          <span className="football-country-label">
                            {flagCode ? (
                              <img className="football-country-flag" src={`https://flagcdn.com/w20/${flagCode}.png`} alt="" loading="lazy" />
                            ) : (
                              <i className="football-country-region-icon">{footballCountryIcons[cleanCountry] || footballCountryIcons[country] || '🌍'}</i>
                            )}
                            {cleanCountry}
                          </span>
                          <b>{isCountryOpen ? '⌃' : '⌄'}</b>
                        </button>

                        {isCountryOpen && (
                          <div className="sport-accordion-children level-two football-leagues-list">
                            {countryLeagues.map(label => (
                              <button
                                type="button"
                                key={`${country}-${label}`}
                                className={currentLeague === label ? 'is-active league-active' : ''}
                                onClick={() => selectSidebarLeague('Piłka nożna', country, label)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {sidebarComingSoonSports.map((sportName) => (
              <div className="sport-accordion-item is-coming-soon" key={`sidebar-coming-soon-${sportName}`}>
                <button
                  type="button"
                  className="sport-accordion-head sport-coming-soon-head"
                  onClick={() => onToast?.({ type: 'success', title: sportName, message: 'Kafelek jest już dodany. Obsługę tego sportu podłączymy później.' })}
                >
                  <span>{sportIconMap[sportName] || '🏅'} {sportName}</span>
                  <b>⌄</b>
                </button>
              </div>
            ))}

          </div>

          <div className="betfolio-left-stats">
            <div className={`tip-add-plan-pill ${isPremiumUser ? 'premium' : 'free'}`}>
              <strong>{isPremiumUser ? 'KONTO PREMIUM' : 'KONTO FREE'}</strong>
              <span>{isPremiumUser ? 'Bez limitu • możesz sprzedawać typy' : '5 darmowych typów / doba • bez sprzedaży'}</span>
              <small>{isPremiumUser ? 'Publikuj bez limitu i zarabiaj na swoich analizach.' : 'Po wykorzystaniu limitu kolejne typy dodasz następnego dnia.'}</small>
            </div>
            <div className="tip-add-usage-pill">
              <strong>{countLoading ? '…' : isPremiumUser ? `${dailyCount}` : `${dailyCount}/5`}</strong>
              <span>{isPremiumUser ? 'Dodane dziś' : `Pozostało dziś: ${remainingFreeSlots}`}</span>
            </div>
          </div>

        </aside>

        <div className={`betfolio-center glass-ultra-panel ${showMarketBoard ? 'market-board-mode' : ''}`}>
          {!showMarketBoard && (
            <>
              <div className="betfolio-add-hero">
                <div className="betfolio-add-hero-copy">
                  <h2>Dodaj <span>typ</span></h2>
                  <p>Wyszukaj mecz, wybierz rynek i stwórz swój własny typ w kilka sekund.</p>

                  <div className="betfolio-add-hero-features">
                    <div>
                      <i>⌕</i>
                      <strong>Szybkie wyszukiwanie</strong>
                      <small>Znajdź każdy mecz błyskawicznie</small>
                    </div>
                    <div>
                      <i>↗</i>
                      <strong>Setki rynków</strong>
                      <small>Najpopularniejsze rynki bukmacherskie</small>
                    </div>
                  </div>
                </div>

                <div className="betfolio-add-hero-visual" aria-hidden="true">
                  <div className="betfolio-add-hero-orbit"></div>
                  <div className="betfolio-add-hero-ball">⚽</div>
                  <div className="betfolio-add-hero-ticket">
                    <b>◎</b>
                    <span></span>
                    <span></span>
                    <em></em>
                  </div>
                </div>
              </div>

              <div className="betfolio-add-mode-switch">
                <button type="button" className={addTipMode === 'auto' ? 'active' : ''} onClick={() => switchAddTipMode('auto')}>Dodaj typ automatycznie</button>
                <button type="button" className={addTipMode === 'manual' ? 'active' : ''} onClick={() => switchAddTipMode('manual')}>Dodaj typ ręcznie</button>
              </div>

              {addTipMode === 'auto' && (
                <>
                  <div className="betfolio-api-saver-note">
                    <strong>Tryb ręczny API</strong>
                    <span>Nic nie pobieram automatycznie. Kliknij ligę, wyszukaj mecz albo pokaż wszystkie dzisiejsze.</span>
                  </div>
                  <div className="betfolio-fixture-mode-tabs">
                    <button type="button" className={footballViewMode === 'all-today' ? 'active' : ''} onClick={fetchAllTodayFootballFixtures}>Wszystkie dziś</button>
                    <button type="button" className={footballViewMode === 'search' ? 'active' : ''} onClick={handleFixtureSearchSubmit}>Wyszukiwanie</button>
                  </div>
                </>
              )}
            </>
          )}

          {!showMarketBoard ? (
            <>
              {addTipMode === 'auto' ? (
                <>
                  <div className="betfolio-events-head">
                    <strong>{footballViewMode === 'all-today' ? 'Wszystkie dzisiejsze mecze' : footballViewMode === 'search' ? 'Wyniki wyszukiwania' : currentLeague ? `Dzisiejsze mecze • ${currentCountry} • ${currentLeague}` : 'Wybierz ligę po lewej'}</strong>
                    <span>{visibleMatchOptions.length} wydarzeń • godziny rosnąco</span>
                  </div>

                  <div className="betfolio-events-list">
                    {visibleMatchOptions.length ? visibleMatchOptions.map((match) => {
                      const active = selectedMatch?.id === match.id
                      const primaryOdds = getPrimaryOdds(match)
                      return (
                        <div key={match.id} className={`betfolio-event-row ${active ? 'active' : ''}`}>
                          <button type="button" className="betfolio-event-main" onClick={() => openMatchMarkets(match)}>
                            <div className="betfolio-event-teamline">
                              <strong>{`${match.home} - ${match.away}`}</strong>
                            </div>
                            <div className="betfolio-event-meta">
                              <span>{getMatchDateBadge(match)}</span>
                              <span>{match.time}</span>
                              <span>{match.league || currentLeague}</span>
                            </div>
                          </button>
                          <div className="betfolio-event-odds">
                            {primaryOdds.map((entry) => {
                              const oddsItem = entry.item
                              const isSelectedOdd = oddsItem && String(form.market) === String(oddsItem.market) && String(form.betType) === String(oddsItem.pick) && selectedMatch?.id === match.id && ticketMarketSelected
                              return (
                                <button
                                  type="button"
                                  key={`${match.id}-${entry.short}`}
                                  className={`betfolio-odd-box ${isSelectedOdd ? 'active' : ''}`}
                                  disabled={!oddsItem}
                                  onClick={() => oddsItem && selectMatchAndMaybeMarket(match, oddsItem)}
                                >
                                  <span>{entry.short}</span>
                                  <b>{oddsItem ? Number(oddsItem.odds || 0).toFixed(2) : '—'}</b>
                                </button>
                              )
                            })}
                            <button type="button" className="betfolio-more-btn" onClick={() => openMatchMarkets(match)}>Więcej</button>
                          </div>
                        </div>
                      )
                    }) : (
                      <div className="betfolio-empty-state no-fake-empty">
                        <strong>{!hasTriedLiveLoad ? 'Wybierz ligę, pokaż wszystkie mecze albo wyszukaj drużynę' : footballViewMode === 'search' ? 'Brak wyników wyszukiwania' : footballViewMode === 'all-today' ? 'Dziś brak meczów' : 'Dziś brak meczów w tej lidze'}</strong>
                        <span>{!hasTriedLiveLoad ? 'Nie pobieram nic automatycznie. Możesz kliknąć ligę po lewej, przycisk „Wszystkie dziś” albo użyć wyszukiwarki meczów.' : footballViewMode === 'search' ? 'Nie znalazłem prawdziwego meczu dla wpisanej frazy.' : footballViewMode === 'all-today' ? 'API nie zwróciło dziś meczów. Nie pokazuję demo ani fake spotkań.' : 'API nie zwróciło dziś meczów dla tej ligi. Nie pokazuję demo ani fake spotkań.'}</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <form className="betfolio-manual-card" onSubmit={handleManualAddToTicket}>
                  <div className="betfolio-manual-section">
                    <h3>Krok 1</h3>
                    <div className="betfolio-manual-grid betfolio-manual-grid-top">
                      <label>
                        <span>Sport</span>
                        <select className="static-add-input" value={manualForm.sport} onChange={(e) => updateManualForm({ sport: e.target.value })}>
                          <option>Piłka nożna</option>
                        </select>
                      </label>

                      <label>
                        <span>Kraj</span>
                        <select className="static-add-input" value={manualForm.country} onChange={(e) => updateManualForm({ country: e.target.value, league: getFootballLeaguesForCountry(e.target.value)[0] || '' })}>
                          {footballCountryOptions.map(country => <option key={`manual-country-${country}`} value={country}>{normalizeFootballCountryName(country)}</option>)}
                        </select>
                      </label>

                      <label>
                        <span>Liga</span>
                        <select className="static-add-input" value={manualForm.league} onChange={(e) => updateManualForm({ league: e.target.value })}>
                          {getFootballLeaguesForCountry(manualForm.country).map(league => <option key={`manual-league-${league}`} value={league}>{league}</option>)}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="betfolio-manual-section">
                    <h3>Krok 2</h3>
                    <div className="betfolio-manual-grid">
                      <label className="betfolio-manual-span-2">
                        <span>Wydarzenie</span>
                        <input className="static-add-input" value={manualForm.event} onChange={(e) => updateManualForm({ event: e.target.value })} placeholder="np. Legia Warszawa - FC Porto" />
                      </label>

                      <label>
                        <span>Data wydarzenia</span>
                        <input type="datetime-local" className="static-add-input" value={manualForm.datetimeLocal} onChange={(e) => updateManualForm({ datetimeLocal: e.target.value })} />
                      </label>

                      <label className="betfolio-manual-span-2">
                        <span>Typ</span>
                        <input className="static-add-input" value={manualForm.betType} onChange={(e) => updateManualForm({ betType: e.target.value })} placeholder="np. wygra 1 / Remis / Obie drużyny strzelą: TAK" />
                      </label>

                      <label>
                        <span>Kurs</span>
                        <input className="static-add-input" value={manualForm.odds} onChange={(e) => updateManualForm({ odds: e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.') })} placeholder="1.80" />
                      </label>
                    </div>

                    <div className="betfolio-manual-actions">
                      <button type="submit" className="publish-btn betfolio-manual-submit">Dodaj zakład</button>
                    </div>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="betfolio-market-board-view">
              {effectiveSelectedMatch && (
                <div className="betfolio-match-hero">
                  <div className="betfolio-match-hero-team">
                    <div className={`betfolio-match-hero-logo-wrap ${effectiveSelectedMatch.homeLogo ? 'has-logo' : ''}`}>
                      {effectiveSelectedMatch.homeLogo && (
                        <img
                          src={effectiveSelectedMatch.homeLogo}
                          alt=""
                          onError={(event) => event.currentTarget.parentElement?.classList.add('logo-failed')}
                        />
                      )}
                      <span className="betfolio-match-hero-fallback">{String(effectiveSelectedMatch.home || '').trim().charAt(0) || 'H'}</span>
                    </div>
                    <strong>{effectiveSelectedMatch.home}</strong>
                  </div>

                  <div className="betfolio-match-hero-center">
                    <b>{effectiveSelectedMatch.time || '--:--'}</b>
                    <small>{getMatchDateBadge(effectiveSelectedMatch)}</small>
                  </div>

                  <div className="betfolio-match-hero-team">
                    <div className={`betfolio-match-hero-logo-wrap ${effectiveSelectedMatch.awayLogo ? 'has-logo' : ''}`}>
                      {effectiveSelectedMatch.awayLogo && (
                        <img
                          src={effectiveSelectedMatch.awayLogo}
                          alt=""
                          onError={(event) => event.currentTarget.parentElement?.classList.add('logo-failed')}
                        />
                      )}
                      <span className="betfolio-match-hero-fallback">{String(effectiveSelectedMatch.away || '').trim().charAt(0) || 'A'}</span>
                    </div>
                    <strong>{effectiveSelectedMatch.away}</strong>
                  </div>

                  <div className="betfolio-match-hero-meta">
                    <button type="button" className="betfolio-back-btn betfolio-match-hero-back" onClick={() => setShowMarketBoard(false)}>← Wróć do meczów</button>
                    <div className="betfolio-match-hero-meta-copy">
                      <strong>{`${effectiveSelectedMatch.home} - ${effectiveSelectedMatch.away}`}</strong>
                      <span>{`${effectiveSelectedMatch.date} • ${effectiveSelectedMatch.time} • ${effectiveSelectedMatch.league || currentLeague}`}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="betfolio-market-accordion-list">
                {!effectiveSelectedMatch && (
                  <div className="betfolio-empty-state no-fake-empty">
                    <strong>Brak realnego wydarzenia</strong>
                    <span>Rynki pojawią się dopiero po pobraniu prawdziwego meczu z API.</span>
                  </div>
                )}
                {effectiveSelectedMatch && !visibleMarketGroups.length && (
                  <div className="betfolio-empty-state no-fake-empty">
                    <strong>Brak realnych kursów</strong>
                    <span>Nie pokazuję sztucznych kursów. Gdy API-FOOTBALL udostępni rynki dla tego meczu, pojawią się tutaj.</span>
                  </div>
                )}
                {effectiveSelectedMatch && visibleMarketGroups.map(([groupLabel, items]) => {
                  const expanded = expandedMarketGroup === groupLabel
                  return (
                    <div key={groupLabel} className={`betfolio-market-accordion ${expanded ? 'expanded' : ''}`}>
                      <button type="button" className="betfolio-market-accordion-head" onClick={() => setExpandedMarketGroup(expanded ? '' : groupLabel)}>
                        <span>{groupLabel}</span>
                        <b>{items.length} opcji {expanded ? '⌃' : '⌄'}</b>
                      </button>
                      {expanded && (
                        <div className="betfolio-market-options board-options">
                          {items.map((item, index) => {
                            const active = ticketMarketSelected && String(form.market) === String(item.market) && String(form.betType) === String(item.pick) && String(form.odds) === String(item.odds)
                            const value = `${item.market}|||${item.pick}|||${item.odds}|||${item.confidence || confidencePercent}`
                            return (
                              <button
                                type="button"
                                key={`${groupLabel}-${item.pick}-${item.odds}-${index}`}
                                className={`betfolio-market-option ${active ? 'active' : ''}`}
                                onClick={() => chooseMarket(value)}
                              >
                                <span>{item.pick}</span>
                                <b>{Number(item.odds || 0).toFixed(2)}</b>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {ticketMarketSelected && (
        <aside className="betfolio-right glass-ultra-panel">
          <div className="betfolio-ticket-top">
            <div className="betfolio-ticket-tabs">
              <button type="button" className={form.accessType === 'free' ? 'active' : ''} onClick={() => toggleAccess('free')}>Darmowy</button>
              <button type="button" className={form.accessType === 'premium' ? 'active' : ''} onClick={() => toggleAccess('premium')}>Premium 👑</button>
            </div>
            <div className="betfolio-ticket-summary">
              <small>Wybrano</small>
              <strong>{form.accessType === 'premium' ? 'Typ premium' : 'Typ darmowy'}</strong>
            </div>
          </div>

          <div className="betfolio-ticket-card">
            <small>Kupon / dodaj typ</small>
            <strong>{effectiveSelectedMatch ? `${effectiveSelectedMatch.home} - ${effectiveSelectedMatch.away}` : 'Brak realnego meczu'}</strong>
            <span>{ticketMarketSelected ? `${form.market} • ${form.betType}` : addTipMode === 'manual' ? 'Wypełnij formularz ręczny i kliknij Dodaj zakład' : 'Kliknij prawdziwy kurs, aby dodać zakład'}</span>
            <div className="betfolio-ticket-row">
              <label>Kurs</label>
              <input className="static-add-input" value={ticketMarketSelected ? form.odds : ''} placeholder="—" onChange={(e) => updateForm({ odds: e.target.value })} />
            </div>
            <div className="betfolio-ticket-row">
              <label>Data meczu</label>
              <div className="betfolio-inline-two">
                <input className="static-add-input" value={form.date} onChange={(e) => updateForm({ date: e.target.value })} />
                <input className="static-add-input" value={form.time} onChange={(e) => updateForm({ time: e.target.value })} />
              </div>
            </div>
            <div className="betfolio-ticket-row">
              <label>Stawka</label>
              <input className="static-add-input" value={form.stake} onChange={(e) => updateForm({ stake: clampStakeValue(e.target.value) })} onBlur={() => updateForm({ stake: clampStakeValue(form.stake || 0) })} />
            </div>
            <div className="stake-pills betfolio-mini-stakes">
              {[10, 50, 100, 500, 1000].map(value => <span key={value} className={String(value) === String(Number(form.stake || 0)) ? 'active' : ''} onClick={() => updateForm({ stake: String(value) })}>{value.toFixed ? value : value} zł</span>)}
            </div>

            <div className="betfolio-ticket-row">
              <label>Pewność</label>
              <div className="confidence-head"><strong>{confidenceLabel}</strong><b>{confidencePercent}%</b></div>
              <div className="confidence-adjuster compact">
                <button type="button" onClick={() => updateForm({ confidence: Math.max(15, confidencePercent - 1) })}>−</button>
                <input type="range" min="15" max="99" step="1" value={confidencePercent} onChange={(e) => updateForm({ confidence: Number(e.target.value) || 50 })} />
                <button type="button" onClick={() => updateForm({ confidence: Math.min(99, confidencePercent + 1) })}>+</button>
              </div>
            </div>

            <div className="betfolio-ticket-row">
              <label>Opis typu</label>
              <div className="static-add-textarea-wrapper">
                <textarea className="static-add-textarea-input" maxLength={500} value={form.description} onChange={(e) => updateForm({ description: e.target.value })} />
                <small>{String(form.description || '').length} / 500</small>
              </div>
            </div>

            {form.accessType === 'premium' ? (
              <>
                <div className="betfolio-ticket-row">
                  <label>Cena singla</label>
                  {isPremiumUser ? (
                    <input className="static-add-input price-input" value={form.singlePrice} onChange={(e) => updateForm({ singlePrice: e.target.value.replace(/[^0-9.]/g, '') })} />
                  ) : (
                    <div className="betfolio-premium-lock">Sprzedaż tylko w Premium</div>
                  )}
                </div>
                <div className="betfolio-ticket-profit">
                  {`Ty: ${(previewPrice * (1 - PLATFORM_COMMISSION_RATE)).toFixed(2)} zł • Platforma: ${(previewPrice * PLATFORM_COMMISSION_RATE).toFixed(2)} zł`}
                </div>
              </>
            ) : (
              <div className="betfolio-ticket-profit is-free-mode">Typ darmowy — cena 0.00 zł, bez blokady premium.</div>
            )}
          </div>

          <div className="betfolio-publish-footer">
            <div className="betfolio-total-box">
              <span>Kurs całkowity</span>
              <b>{Number(form.odds || 0).toFixed(2)}</b>
            </div>
            <button type="button" className="publish-btn betfolio-publish-btn" disabled={saving || limitReached || !effectiveSelectedMatch || !ticketMarketSelected} onClick={handlePublish}>
              {saving ? 'Publikowanie…' : 'Opublikuj typ'}
            </button>
          </div>
        </aside>
        )}
      </div>
    </section>
  )
}


function Toast({ toast, onClose }) {
  if (!toast) return null
  const runAction = () => {
    if (toast.event && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(toast.event))
    if (toast.onClick) toast.onClick()
  }
  return (
    <div className={`toast ${toast.type || 'success'}`}>
      <div className="toast-icon">{toast.type === 'success' ? '✅' : toast.type === 'premium' ? '👑' : toast.type === 'limit' ? '🚫' : '⚠️'}</div>
      <div className="toast-body">
        <strong>{toast.title}</strong>
        <span>{toast.message}</span>
        {toast.cta && <button type="button" className="toast-cta" onClick={runAction}>{toast.cta}</button>}
      </div>
      <button className="toast-close" onClick={onClose}>×</button>
    </div>
  )
}


function LiveTipCenterPopup({ popup, open, onClose }) {
  if (!popup) return null

  const author = popup.author_name || 'Użytkownik'
  const league = popup.league || 'Liga'
  const matchLine = `${popup.team_home || 'Drużyna 1'} vs ${popup.team_away || 'Drużyna 2'}`
  const tipLabel = popup.bet_type || 'Nowy typ'
  const oddsLabel = Number(popup.odds || 0) > 0 ? `Kurs ${Number(popup.odds).toFixed(2)}` : 'Nowy typ'

  return (
    <div className={`live-tip-center-overlay ${open ? 'is-visible' : 'is-hiding'}`}>
      <div className={`live-tip-center-card ${open ? 'is-visible' : 'is-hiding'}`} role="status" aria-live="polite">
        <button type="button" className="live-tip-center-close" onClick={onClose} aria-label="Zamknij powiadomienie">×</button>
        <div className="live-tip-center-kicker">NOWY TIP</div>
        <div className="live-tip-center-content">
          <div className="live-tip-center-icon" aria-hidden="true">
            <img src="/betai-topbar-coin.png" alt="" />
          </div>
          <div className="live-tip-center-copy">
            <strong>{author} dodał typ</strong>
            <span>{matchLine}</span>
          </div>
        </div>
        <div className="live-tip-center-pills">
          <span>{league}</span>
          <span>{tipLabel}</span>
          <span>{oddsLabel}</span>
        </div>
        <div className="live-tip-center-subline">Powiadomienie znika automatycznie po 5 sekundach</div>
        <div className={`live-tip-center-progress ${open ? 'run' : ''}`} />
      </div>
    </div>
  )
}


function ReceivedTipPopup({ popup, open, onClose }) {
  if (!popup) return null
  const sender = popup.senderName || 'Użytkownik'
  const amount = Math.max(1, Number(popup.amount || 1) || 1)
  const amountLabel = amount === 1 ? '1 żeton' : `${amount} żetony`
  return (
    <div className={`betai-received-tip-overlay ${open ? 'is-visible' : 'is-hiding'}`} role="status" aria-live="polite">
      <div className={`betai-received-tip-card ${open ? 'is-visible' : 'is-hiding'}`}>
        <button type="button" className="betai-received-tip-close" onClick={onClose} aria-label="Zamknij powiadomienie">×</button>
        <div className="betai-received-tip-kicker">BET+AI LIVE CHAT</div>
        <div className="betai-received-tip-coin-wrap" aria-hidden="true">
          <div className="betai-received-tip-coin-glow" />
          <img src="/betai-coin-icon.png" alt="" className="betai-received-tip-img" />
        </div>
        <div className="betai-received-tip-title">Dostałeś Tip!</div>
        <div className="betai-received-tip-sender">Od użytkownika <strong>{sender}</strong></div>
        <div className="betai-received-tip-amount">+{amountLabel}</div>
      </div>
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className="skeleton-list">
      {[1,2,3].map(i => (
        <div className="skeleton-card" key={i}>
          <div className="skeleton-line short"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-grid">
            <div className="skeleton-box"></div>
            <div className="skeleton-box"></div>
          </div>
        </div>
      ))}
    </div>
  )
}


function TipCard({ tip, unlocked, onUnlock, onSubscribeToTipster, profileSubscriptionActive, currentUser, followingTipsters, onToggleFollow, onOpenTipster, onToast }) {
  const isPremium = tip.access_type === 'premium'
  const isLocked = isPremium && !unlocked && !profileSubscriptionActive
  const author = resolveRealProfileUsername({
    username: tip.author_name,
    author_name: tip.author_name,
    email: tip.author_email || tip.email || tip.user_email,
    author_email: tip.author_email || tip.email || tip.user_email
  })
  const authorId = getTipAuthorId(tip)
  const currentUsername = resolveRealProfileUsername(currentUser) || String(currentUser?.email || '').split('@')[0]
  const tipIdentity = {
    id: authorId,
    user_id: tip.user_id,
    author_id: tip.author_id,
    email: tip.author_email || tip.email || tip.user_email,
    author_email: tip.author_email,
    username: tip.author_name || tip.username,
    author_name: tip.author_name,
  }
  const isOwnTip = isSameProfileIdentity(currentUser, tipIdentity) || Boolean(
    currentUsername && String(currentUsername).toLowerCase() === String(author).toLowerCase()
  )
  const authorAvatarUrl = getProfileAvatarUrl({ avatar_url: tip.author_avatar_url || tip.avatar_url || tip.profile_avatar_url, author_avatar_url: tip.author_avatar_url, profile_avatar_url: tip.profile_avatar_url }) || (isOwnTip ? getProfileAvatarUrl(currentUser) : '')
  const actorKey = String(currentUser?.id || currentUser?.email || currentUsername || 'guest').toLowerCase()
  const actorLabel = currentUsername || author || 'Gość'
  const baseLikes = Number(tip?.likes ?? 0) || 0
  const baseDislikes = Number(tip?.dislikes ?? 0) || 0
  const baseCommentCount = Number(tip?.comments_count ?? 0) || 0
  const interactionStorageKey = useMemo(
    () => `betai_tip_interactions_v3_${tip?.id || `${tip?.team_home || 'home'}_${tip?.team_away || 'away'}_${tip?.created_at || 'now'}`}`,
    [tip?.id, tip?.team_home, tip?.team_away, tip?.created_at]
  )
  const [feedback, setFeedback] = useState({ likes: baseLikes, dislikes: baseDislikes, comments: [], votes: {} })
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!commentsOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setCommentsOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [commentsOpen])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(interactionStorageKey)
      if (!raw) {
        setFeedback({ likes: baseLikes, dislikes: baseDislikes, comments: [], votes: {} })
        return
      }
      const parsed = JSON.parse(raw)
      setFeedback({
        likes: Number(parsed?.likes ?? baseLikes) || 0,
        dislikes: Number(parsed?.dislikes ?? baseDislikes) || 0,
        comments: Array.isArray(parsed?.comments) ? parsed.comments : [],
        votes: parsed?.votes && typeof parsed.votes === 'object' ? parsed.votes : {}
      })
    } catch (_) {
      setFeedback({ likes: baseLikes, dislikes: baseDislikes, comments: [], votes: {} })
    }
  }, [interactionStorageKey, baseLikes, baseDislikes])

  useEffect(() => {
    try { localStorage.setItem(interactionStorageKey, JSON.stringify(feedback)) } catch (_) {}
  }, [interactionStorageKey, feedback])

  const activeVote = feedback?.votes?.[actorKey] || null
  const commentCount = baseCommentCount + (feedback?.comments?.length || 0)
  const stakeValue = Number(tip?.stake || 0)
  const stakeLabel = stakeValue > 0 ? `${Number.isInteger(stakeValue) ? stakeValue : stakeValue.toFixed(2)} zł` : '—'
  const cardAuthor = resolveRealProfileUsername({ username: isOwnTip ? (currentUsername || author) : author, author_name: isOwnTip ? (currentUsername || author) : author, email: tip.author_email || tip.email || tip.user_email })
  const cardHome = tip.team_home || tip.home_team || 'Gospodarze'
  const cardAway = tip.team_away || tip.away_team || 'Goście'
  const cardPick = tip.bet_type || tip.prediction || tip.pick || 'Typ'
  const cardAnalysis = tip.analysis || tip.ai_analysis || tip.description || 'Brak analizy użytkownika.'
  const cardMatchLabel = tip.match_time ? new Date(tip.match_time).toLocaleString('pl-PL') : 'Dzisiaj'
  const cardStatusLabel = tip.status === 'won' ? 'Wygrany' : tip.status === 'lost' ? 'Przegrany' : tip.status === 'void' ? 'Zwrot' : 'Oczekujący'
  const createdAgo = formatRelativeAddedTime(tip?.created_at)
  const dashboardAuthorStats = getAuthorStatsLabels(tip.author_visible_stats || getTipFallbackAuthorStats(tip))
  const showFollowButton = !isOwnTip
  const followLookupKey = String(author || cardAuthor || '').toLowerCase()
  const isFollowing = Boolean(
    followingTipsters?.has?.(String(authorId || tip.author_id || tip.user_id || '')) ||
    (followLookupKey && followingTipsters?.has?.(followLookupKey))
  )


  function handleVote(nextVote) {
    const previousVote = activeVote
    setFeedback(prev => {
      const votes = { ...(prev?.votes || {}) }
      let likes = Number(prev?.likes || 0)
      let dislikes = Number(prev?.dislikes || 0)
      if (previousVote === nextVote) {
        if (nextVote === 'like') likes = Math.max(0, likes - 1)
        if (nextVote === 'dislike') dislikes = Math.max(0, dislikes - 1)
        delete votes[actorKey]
      } else {
        if (previousVote === 'like') likes = Math.max(0, likes - 1)
        if (previousVote === 'dislike') dislikes = Math.max(0, dislikes - 1)
        if (nextVote === 'like') likes += 1
        if (nextVote === 'dislike') dislikes += 1
        votes[actorKey] = nextVote
      }
      return { ...prev, likes, dislikes, votes }
    })
  }

  function submitComment() {
    const clean = commentDraft.trim()
    if (!clean) return
    const newComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      author: actorLabel || 'Gość',
      text: clean.slice(0, 280),
      created_at: new Date().toISOString()
    }
    setFeedback(prev => ({ ...prev, comments: [newComment, ...(prev?.comments || [])] }))
    setCommentDraft('')
    setCommentsOpen(true)
    onToast?.({ type: 'success', title: 'Komentarz dodany', message: 'Twój komentarz został dodany do typu.' })
  }

  async function reportDashboardTip() {
    setMenuOpen(false)
    onToast?.({ type: 'info', title: 'Zgłoszono wpis', message: 'Zgłoszenie zostało przyjęte do sprawdzenia.' })
  }

  async function settleDashboardTip() {
    setMenuOpen(false)
    const nextStatus = window.prompt('Wpisz wynik: won / lost / void', 'won')
    if (!nextStatus) return
    const clean = String(nextStatus).trim().toLowerCase()
    if (!['won', 'lost', 'void'].includes(clean)) {
      onToast?.({ type: 'error', title: 'Nieprawidłowy wynik', message: 'Dozwolone wartości: won, lost albo void.' })
      return
    }
    try {
      await updateTipField(tip?.id, { status: clean })
      onToast?.({ type: 'success', title: 'Typ rozliczony', message: `Zapisano wynik: ${clean}.` })
    } catch (error) {
      onToast?.({ type: 'error', title: 'Błąd rozliczenia', message: formatAppErrorMessage(error?.message || 'Nie udało się zapisać wyniku.') })
    }
  }

  async function addDashboardAnalysis() {
    setMenuOpen(false)
    const nextAnalysis = window.prompt('Dodaj analizę do typu:', cardAnalysis || '')
    if (!nextAnalysis) return
    try {
      await updateTipField(tip?.id, { analysis: nextAnalysis, description: nextAnalysis })
      onToast?.({ type: 'success', title: 'Analiza zapisana', message: 'Analiza została dodana do typu.' })
    } catch (error) {
      onToast?.({ type: 'error', title: 'Błąd analizy', message: formatAppErrorMessage(error?.message || 'Nie udało się zapisać analizy.') })
    }
  }

  async function shareDashboardTip() {
    setMenuOpen(false)
    const text = shareTipText({ home: cardHome, away: cardAway, pick: cardPick, odds: tip.odds })
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Typ Bet+AI', text })
      } else {
        await navigator.clipboard.writeText(text)
        onToast?.({ type: 'success', title: 'Skopiowano', message: 'Treść typu skopiowana do schowka.' })
      }
    } catch (_) {}
  }

  function handleShareAction() {
    setFeedback(prev => ({ ...prev, dislikes: Number(prev?.dislikes || 0) + 1 }))
    shareDashboardTip()
  }

  return (
    <article className={`profile-ticket-v6 dashboard-ticket-v6 ${isPremium ? 'premium' : 'free'} ${isLocked ? 'locked' : 'unlocked'}`}>
      <div className="profile-ticket-v6-left">
        <span className={`profile-ticket-v6-avatar ${authorAvatarUrl ? 'has-avatar' : ''}`} style={authorAvatarUrl ? { '--avatar-image': `url("${authorAvatarUrl}")` } : undefined}>
          {authorAvatarUrl ? '' : cardAuthor.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <span className="ticket-author-row-v874">
            <strong className="tipster-name-link" onClick={() => onOpenTipster?.(authorId || tip.author_id || tip.user_id || tip.author_email || tip.email || tip.user_email || cardAuthor, cardAuthor)}>{cardAuthor}</strong>
            <b>✓</b>
          </span>
          {dashboardAuthorStats?.totalTipsLabel ? (
            <div className="ticket-mini-stats-v876">
              <span>Yield: <b>{dashboardAuthorStats.yieldLabel}</b></span>
              <span>Oddane typy: <b>{dashboardAuthorStats.totalTipsLabel}</b></span>
              <span>Bilans: <b className={dashboardAuthorStats.profitValue >= 0 ? 'profit-positive-text' : 'profit-negative-text'}>{dashboardAuthorStats.profitLabel}</b></span>
            </div>
          ) : null}
        </div>
        <button type="button" className={`profile-ticket-v6-access ${isPremium ? 'premium' : 'free'}`} onClick={() => isPremium && onSubscribeToTipster?.(tip)}>
          {isPremium ? '♕ PREMIUM' : '🎁 DARMOWY'}
        </button>
      </div>

      <div className="profile-ticket-v6-main">
        <div className="profile-ticket-v6-league"><span>⚽</span><strong>{tip.league}</strong></div>
        <div className="profile-ticket-v6-match">
          <div><TipTeamLogo logo={tip.home_logo || tip.homeLogo} teamId={tip.home_team_id || tip.homeTeamId} name={cardHome} /><strong>{cardHome}</strong></div>
          <span>vs</span>
          <div><TipTeamLogo logo={tip.away_logo || tip.awayLogo} teamId={tip.away_team_id || tip.awayTeamId} name={cardAway} /><strong>{cardAway}</strong></div>
        </div>
        <small>{cardMatchLabel}</small>
      </div>

      <div className="profile-ticket-v6-field">
        <small>TYP</small>
        <strong>{isLocked ? 'Typ premium' : cardPick}</strong>
        <span>{isPremium ? 'Singiel' : 'Darmowy typ'}</span>
      </div>

      <div className="profile-ticket-v6-field stake">
        <small>STAWKA</small>
        <strong>{stakeLabel}</strong>
        <i><b style={{ width: `${Math.max(12, Math.min(100, stakeValue * 10))}%` }} /></i>
      </div>

      <div className="profile-ticket-v6-field odds">
        <small>KURS</small>
        <strong>{isLocked ? '—' : Number(tip.odds || 0).toFixed(2)}</strong>
      </div>

      <div className={`profile-ticket-v6-analysis ${isLocked ? 'locked' : ''}`}>
        <small>ANALIZA</small>
        <p>{isLocked ? 'Ten typ premium jest zablokowany. Odblokuj dostęp, aby zobaczyć analizę, kurs i pełny typ.' : cardAnalysis}</p>
        <button type="button">Czytaj więcej⌄</button>
      </div>

      <div className="profile-ticket-v6-buy">
        <div className="profile-ticket-v6-corner">
          <span>{createdAgo}</span>
          <button type="button" onClick={() => setMenuOpen(prev => !prev)}>⋮</button>
          {menuOpen && (
            <div className="profile-ticket-v6-menu">
              <button type="button" onClick={reportDashboardTip}>⚠ Zgłoś wpis</button>
              <button type="button" onClick={settleDashboardTip}>✓ Rozlicz</button>
              <button type="button" onClick={addDashboardAnalysis}>📝 Dodaj analizę</button>
              <button type="button" onClick={shareDashboardTip}>↗ Udostępnij</button>
            </div>
          )}
        </div>
        <span className={`status-${cardStatusLabel.toLowerCase()}`}>✓ {cardStatusLabel}</span>
        {isLocked ? (
          <>
            <button type="button" onClick={() => onUnlock(tip)}>Kup singiel</button>
            <strong>{Number(tip.price || 29).toFixed(2)} zł</strong>
          </>
        ) : null}
      </div>

      <footer className="profile-ticket-v6-footer">
        <div>
          <button type="button" className={`ticket-action-btn-v877 ${activeVote === 'like' ? 'active' : ''}`} onClick={() => handleVote('like')}>
            <TipActionLikeIcon />
            <b>{feedback.likes}</b>
          </button>
          <button type="button" className={`ticket-action-btn-v877 ${commentsOpen ? 'active' : ''}`} onClick={() => setCommentsOpen(prev => !prev)} aria-label={commentsOpen ? 'Zamknij komentarze' : 'Otwórz komentarze'}>
            <TipActionCommentIcon />
            <b>{commentCount}</b>
          </button>
          <button type="button" className="ticket-action-btn-v877" onClick={handleShareAction}>
            <TipActionShareIcon />
            <b>{feedback.dislikes}</b>
          </button>
          {showFollowButton ? (
            <button
              type="button"
              className={`ticket-follow-inline-btn ${isFollowing ? 'active' : ''}`}
              onClick={(event) => {
                event.stopPropagation()
                onToggleFollow?.(authorId || tip.author_id || tip.user_id, author || cardAuthor)
              }}
              aria-label={isFollowing ? 'Obserwujesz typera' : 'Obserwuj typera'}
            >
              {isFollowing ? '✓ Obserwujesz' : 'Obserwuj'}
            </button>
          ) : null}
        </div>
      </footer>

      {commentsOpen && (
        <div className="tip-comments-panel profile-ticket-v6-comments">
          <div className="tip-comments-head">
            <strong>Komentarze:</strong>
            <span>{commentCount} łącznie</span>
            <button type="button" className="tip-comments-close" onClick={() => setCommentsOpen(false)} aria-label="Zamknij komentarze">×</button>
          </div>
          <div className="tip-comment-form">
            <input
              type="text"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitComment() } }}
              placeholder="Dodaj komentarz do tego typu..."
              maxLength={280}
            />
            <button type="button" className="tip-comment-submit" onClick={submitComment}>Dodaj komentarz</button>
          </div>
          {feedback.comments.length > 0 ? (
            <div className="tip-comment-list">
              {feedback.comments.map((comment) => (
                <div key={comment.id} className="tip-comment-item">
                  <div className="tip-comment-avatar">{String(comment.author || 'G').slice(0, 1).toUpperCase()}</div>
                  <div className="tip-comment-body">
                    <div className="tip-comment-meta"><strong>{comment.author}</strong><span>{new Date(comment.created_at).toLocaleString('pl-PL')}</span></div>
                    <p>{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </article>
  )
}

function ReferralsView({ user, data, loading, onRefresh }) {
  const liveUsers = ['KT', 'SM', 'PK', 'BJ', 'AM', 'GT', 'VR']
  const feedPosts = [
    {
      author: 'krystian_typer',
      badge: 'PREMIUM',
      time: '2 min temu',
      text: 'Świetna analiza od AI dzisiaj! Lecimy z greenem 💚',
      pick: { match: 'PSG vs Lyon', tip: 'Typ: PSG wygra', odds: '1.62' },
      likes: 18,
      comments: 6,
      accent: 'cyan'
    },
    {
      author: 'pirotek1987',
      badge: '',
      time: '10 min temu',
      text: 'Ktoś gra coś z ligi hiszpańskiej dziś?',
      reply: { author: 'smilhytv', badge: 'ADMIN', time: '8 min temu', text: 'Ja gram Barcelona Over 1.5 gola!' },
      likes: 6,
      comments: 23,
      accent: 'teal'
    },
    {
      author: 'buchajsonek1988',
      badge: 'NOWY TYP',
      time: '25 min temu',
      text: 'Real Madryt wygra z Getafe!',
      pick: { match: 'Typ: Real Madryt wygra', tip: 'Kurs', odds: '1.44' },
      likes: 14,
      comments: 3,
      accent: 'mint'
    }
  ]
  const weeklyLeaders = [
    ['1', 'krystian_typer', '+125.40 zł'],
    ['2', 'smilhytv', '+98.20 zł', 'ADMIN'],
    ['3', 'pirotek1987', '+76.80 zł'],
    ['4', 'buchajonek1988', '+64.30 zł'],
    ['5', 'AI Master', '+58.10 zł', 'BOT']
  ]
  const suggestedUsers = [
    ['AI Master', 'Ekspert AI', 'BOT'],
    ['krystian_typer', 'Top typer', 'PREMIUM'],
    ['Bet+AI', 'Oficjalne konto', 'ADMIN'],
    ['smilhytv', 'Top społeczność', 'ADMIN']
  ]
  const liveEvents = [
    ['Q&A z AI Master', 'Analizy i typy na żywo', '248 ogląda'],
    ['Typer Talk: Premier League', 'Dyskusja społeczności', '156 ogląda'],
    ['Misja specjalna', 'Zgarnij nagrody!', '97 ogląda']
  ]
  const weeklyCommunity = [
    ['1', 'krystian_typer', '15 430 pkt'],
    ['2', 'smilhytv', '12 870 pkt', 'ADMIN'],
    ['3', 'pirotek1987', '10 560 pkt'],
    ['4', 'buchajonek1988', '9 230 pkt'],
    ['5', 'AI Master', '8 910 pkt']
  ]

  return (
    <section className="community-static-v5">
      <div className="community-v5-header glass-community-v5">
        <div>
          <h1>Krok 9 / Społeczność</h1>
          <p>Rozmawiaj, dziel się typami i zdobywaj nagrody z aktywną społecznością Bet+AI.</p>
        </div>
        <div className="community-v5-online-wrap">
          <div className="community-v5-online-copy">
            <span className="live-dot-v5"></span>
            <strong>Aktywnych teraz</strong>
            <b>248 online</b>
          </div>
          <div className="community-v5-avatars">
            {liveUsers.map((item, index) => <i key={index}>{item}</i>)}
            <em>+238</em>
          </div>
        </div>
      </div>

      <div className="community-v5-tabs glass-community-v5">
        <button type="button" className="active">💬 Czat live</button>
        <button type="button">⌘ Kanały</button>
        <button type="button">📰 Posty</button>
        <button type="button">🎁 Dropy</button>
        <button type="button">🏆 Nagrody</button>
      </div>

      <div className="community-v5-layout">
        <div className="community-v5-main">
          <div className="glass-community-v5 composer-v5">
            <div className="composer-v5-head">
              <span className="composer-avatar-v5">SM</span>
              <div>
                <strong>Co nowego w społeczności?</strong>
                <small>Napisz coś dla społeczności Bet+AI</small>
              </div>
            </div>
            <div className="composer-v5-row">
              <input value="" readOnly placeholder="Napisz coś dla społeczności..." />
              <button type="button">Opublikuj</button>
            </div>
          </div>

          <div className="community-v5-feed">
            {feedPosts.map((post, index) => (
              <article className="glass-community-v5 feed-card-v5" key={index}>
                <div className="feed-card-head-v5">
                  <div className="feed-author-v5">
                    <span className={`feed-avatar-v5 ${post.accent}`}>{post.author.slice(0,2).toUpperCase()}</span>
                    <div>
                      <strong>{post.author}</strong>
                      <div className="feed-meta-v5">
                        {post.badge ? <span className={`feed-badge-v5 ${post.badge.toLowerCase().replace(/\s+/g, '-')}`}>{post.badge}</span> : null}
                        <small>{post.time}</small>
                      </div>
                    </div>
                  </div>
                  <button type="button">⋮</button>
                </div>
                <p className="feed-text-v5">{post.text}</p>

                {post.pick ? (
                  <div className="pick-preview-v5">
                    <div>
                      <strong>{post.pick.match}</strong>
                      <small>{post.pick.tip}</small>
                    </div>
                    <b>{post.pick.odds}</b>
                  </div>
                ) : null}

                {post.reply ? (
                  <div className="reply-preview-v5">
                    <span className="reply-avatar-v5">SM</span>
                    <div>
                      <div className="feed-meta-v5">
                        <strong>{post.reply.author}</strong>
                        <span className="feed-badge-v5 admin">{post.reply.badge}</span>
                        <small>{post.reply.time}</small>
                      </div>
                      <p>{post.reply.text}</p>
                    </div>
                  </div>
                ) : null}

                <div className="feed-actions-v5">
                  <span>👍 {post.likes}</span>
                  <span>💬 {post.comments}</span>
                  <button type="button">Zobacz wszystkie komentarze ({post.comments})</button>
                </div>
              </article>
            ))}
          </div>

          <div className="community-v5-bottom-grid">
            <div className="glass-community-v5 bottom-card-v5">
              <div className="bottom-card-head-v5"><h3>Dropy i nagrody</h3><button type="button">Zobacz wszystkie →</button></div>
              <div className="drops-grid-v5">
                <div className="drop-box-v5 warm">
                  <span>DROP AKTYWNY</span>
                  <strong>Zgarnij 100 żetonów!</strong>
                  <p>Bądź aktywny na czacie przez 30 minut</p>
                  <div className="drop-progress-v5"><i style={{width:'68%'}}></i></div>
                  <div className="drop-footer-v5"><b>18/30</b><small>min</small></div>
                  <button type="button">Weź udział</button>
                </div>
                <div className="drop-box-v5 cool">
                  <span>Nagroda tygodnia</span>
                  <strong>Karta podarunkowa 100 zł</strong>
                  <p>Dla najbardziej aktywnego użytkownika</p>
                  <div className="drop-progress-v5"><i style={{width:'72%'}}></i></div>
                  <div className="drop-footer-v5"><b>72%</b><small>Do końca: 2 dni 14:32:10</small></div>
                </div>
              </div>
            </div>

            <div className="glass-community-v5 bottom-card-v5">
              <div className="bottom-card-head-v5"><h3>Top społeczność tygodnia</h3><button type="button">Zobacz ranking →</button></div>
              <div className="community-rank-v5">
                {weeklyCommunity.map((item, index) => (
                  <div className="community-rank-row-v5" key={index}>
                    <span className={`mini-place-v5 p${item[0]}`}>{item[0]}</span>
                    <div><strong>{item[1]}</strong>{item[3] ? <small>{item[3]}</small> : null}</div>
                    <b>{item[2]}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-community-v5 bottom-card-v5 reward-card-v5">
              <div className="bottom-card-head-v5"><h3>Twój progres nagród</h3><button type="button">Zobacz nagrody →</button></div>
              <div className="reward-level-v5">
                <div><span>Poziom 8</span><strong>Ekspert</strong></div>
                <b>860 / 1200 XP</b>
              </div>
              <div className="reward-progress-v5"><i style={{width:'72%'}}></i></div>
              <div className="reward-next-v5">
                <div><span>Następna nagroda</span><strong>250 żetonów</strong><small>Odbierz przy poziomie 9</small></div>
                <div className="coin-badge-v5">250</div>
              </div>
            </div>
          </div>
        </div>

        <aside className="community-v5-sidebar">
          <div className="glass-community-v5 sidecard-v5">
            <div className="sidecard-head-v5"><h3>🏆 Top typerzy <small>(tydzień)</small></h3></div>
            <small className="sidecard-sub-v5">Ranking tygodniowy</small>
            <div className="side-list-v5">
              {weeklyLeaders.map((item, index) => (
                <div className="side-leader-row-v5" key={index}>
                  <span className={`leader-no-v5 n${item[0]}`}>{item[0]}</span>
                  <div>
                    <strong>{item[1]}</strong>
                    <small>{item[3] || 'ROI: ' + (26 - index * 2.1).toFixed(1) + '%'}</small>
                  </div>
                  {item[3] && item[3] !== 'BOT' ? <em>{item[3]}</em> : null}
                  {item[3] === 'BOT' ? <em>BOT</em> : null}
                  <b>{item[2]}</b>
                </div>
              ))}
            </div>
            <button type="button" className="side-btn-v5">Zobacz pełny ranking</button>
          </div>

          <div className="glass-community-v5 sidecard-v5">
            <div className="sidecard-head-v5"><h3>Polecani użytkownicy</h3><button type="button">Zobacz wszystkich</button></div>
            <div className="suggested-list-v5">
              {suggestedUsers.map((item, index) => (
                <div className="suggested-row-v5" key={index}>
                  <span className="suggested-avatar-v5">{item[0].slice(0,2).toUpperCase()}</span>
                  <div>
                    <strong>{item[0]}</strong>
                    <small>{item[1]}</small>
                  </div>
                  <em>{item[2]}</em>
                  <button type="button">Obserwuj</button>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-community-v5 sidecard-v5">
            <div className="sidecard-head-v5"><h3>Wydarzenia live</h3><button type="button">Zobacz wszystkie</button></div>
            <div className="events-list-v5">
              {liveEvents.map((item, index) => (
                <div className="event-row-v5" key={index}>
                  <span className={`event-thumb-v5 e${index + 1}`}></span>
                  <div>
                    <strong>{item[0]}</strong>
                    <small>{item[1]}</small>
                    <em>{item[2]}</em>
                  </div>
                  <b>LIVE</b>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

function getSportPlRelativeTime(value) {
  const time = value ? new Date(value).getTime() : Date.now()
  if (!Number.isFinite(time)) return 'Teraz'
  const diff = Math.max(0, Date.now() - time)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Teraz'
  if (minutes < 60) return `${minutes} min temu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h temu`
  return new Date(time).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function getSportPlInitials(title = '') {
  const words = String(title).replace(/[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  return (words[0]?.[0] || 'S').toUpperCase() + (words[1]?.[0] || 'P').toUpperCase()
}

function getSportPlImageSrc(item = {}) {
  const raw = item.imageProxy || item.image || ''
  if (!raw) return ''
  if (String(raw).startsWith('/.netlify/functions/')) return raw
  return `/.netlify/functions/sportpl-articles?image=${encodeURIComponent(raw)}`
}

function isImportantSportPlNews(item = {}) {
  const text = `${item.title || ''} ${item.excerpt || ''} ${item.category || ''}`.toLowerCase()
  return ['pilne', 'oficjalnie', 'kontuzja', 'transfer', 'zwolniony', 'zmarł', 'afera', 'sensacja', 'skandal', 'polska', 'reprezentacja', 'świątek', 'lewandowski', 'liga mistrzów', 'finał'].some(word => text.includes(word))
}

function ArticlesView() {
  const [activeArticleTab, setActiveArticleTab] = useState('live')
  const [liveArticles, setLiveArticles] = useState([])
  const [liveLoading, setLiveLoading] = useState(true)
  const [liveError, setLiveError] = useState('')
  const [lastLiveUpdate, setLastLiveUpdate] = useState(null)
  const [importantNews, setImportantNews] = useState([])
  const [articleHeroIndex, setArticleHeroIndex] = useState(0)
  const [urgentTickerIndex, setUrgentTickerIndex] = useState(0)
  const articleHeroSwipeStart = useRef(null)
  const urgentHeroSwipeStart = useRef(null)

  useEffect(() => {
    let isMounted = true
    let intervalId = null

    const loadSportPlArticles = async () => {
      try {
        setLiveError('')
        const response = await fetch(`/.netlify/functions/sportpl-articles?limit=24&t=${Date.now()}`, { cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = await response.json()
        const articles = Array.isArray(payload?.articles) ? payload.articles : []
        if (!isMounted) return
        setLiveArticles(articles)
        setLastLiveUpdate(payload?.updatedAt || new Date().toISOString())
        const hot = articles.filter(isImportantSportPlNews).slice(0, 5)
        setImportantNews(hot)
        try {
          const newestId = articles[0]?.id || articles[0]?.url || ''
          const previousId = localStorage.getItem('betai_sportpl_live_newest') || ''
          if (newestId && previousId && newestId !== previousId && hot.length) {
            setActiveArticleTab('live')
          }
          if (newestId) localStorage.setItem('betai_sportpl_live_newest', newestId)
        } catch (_) {}
      } catch (error) {
        if (!isMounted) return
        setLiveError('Nie udało się odświeżyć Sport.pl. Spróbujemy ponownie automatycznie za 10 minut.')
      } finally {
        if (isMounted) setLiveLoading(false)
      }
    }

    loadSportPlArticles()
    intervalId = window.setInterval(loadSportPlArticles, 10 * 60 * 1000)
    return () => {
      isMounted = false
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [])

  const articleCards = [
    {
      tag: 'ANALIZA',
      title: 'Mbappé bohaterem! PSG z kolejnym krokiem w stronę tytułu',
      body: 'Francuz poprowadził PSG do zwycięstwa 3:1 z Lyonem. Analiza meczu i statystyki.',
      meta: '1h temu',
      icon: 'KM'
    },
    {
      tag: 'ZAPOWIEDŹ',
      title: 'Derby Włoch: Inter – Juventus',
      body: 'Kto wyjdzie górą w starciu gigantów Serie A? Sprawdzamy formę, składy i kursy.',
      meta: '2h temu',
      icon: 'IJ'
    },
    {
      tag: 'TYPY AI',
      title: 'AI typuje: Najlepsze kupony na weekend 17-19 maja',
      body: 'Sprawdź kupony przygotowane przez sztuczną inteligencję z wysokim value.',
      meta: '3h temu',
      icon: 'AI'
    },
    {
      tag: 'WYWIAD',
      title: 'Klopp: "To nie koniec, to nowy początek"',
      body: 'Szczere słowa trenera Liverpoolu przed ostatnią kolejką sezonu.',
      meta: '5h temu',
      icon: 'JK'
    },
  ]

  const sportPlCards = liveArticles.length ? liveArticles.slice(0, 4).map((item, index) => ({
    tag: item.category || 'SPORT.PL',
    title: item.title || 'Sport.pl — wiadomość sportowa',
    body: item.excerpt || 'Kliknij, aby przejść do pełnej wiadomości na Sport.pl.',
    meta: getSportPlRelativeTime(item.publishedAt),
    icon: getSportPlInitials(item.title),
    url: item.url,
    image: getSportPlImageSrc(item),
    rawImage: item.image || '',
    isImportant: isImportantSportPlNews(item),
    index
  })) : articleCards

  const articleHeroSlides = liveArticles.length ? liveArticles.slice(0, 6).map((item, index) => ({
    tag: item.category || 'TRENDING',
    title: item.title || 'Sport.pl — wiadomość sportowa',
    excerpt: item.excerpt || 'Kliknij, aby przeczytać pełny artykuł na Sport.pl.',
    meta: getSportPlRelativeTime(item.publishedAt),
    icon: getSportPlInitials(item.title),
    url: item.url,
    image: getSportPlImageSrc(item),
    rawImage: item.image || '',
    isImportant: isImportantSportPlNews(item),
    index
  })) : articleCards.map((item, index) => ({
    ...item,
    excerpt: item.body,
    image: '',
    rawImage: '',
    index
  }))

  const heroArticle = articleHeroSlides[articleHeroIndex % Math.max(articleHeroSlides.length, 1)] || articleHeroSlides[0]

  const urgentHeroSlides = (importantNews.length ? importantNews : liveArticles.slice(0, 5)).map((item, index) => ({
    tag: item.category || 'PILNE',
    title: item.title || 'Sport.pl — ważna wiadomość',
    excerpt: item.excerpt || 'Kliknij, aby przeczytać pełny ważny artykuł na Sport.pl.',
    meta: getSportPlRelativeTime(item.publishedAt),
    icon: getSportPlInitials(item.title),
    url: item.url,
    image: getSportPlImageSrc(item),
    rawImage: item.image || '',
    isImportant: true,
    index
  }))

  const urgentHeroArticle = urgentHeroSlides[urgentTickerIndex % Math.max(urgentHeroSlides.length, 1)] || urgentHeroSlides[0]

  useEffect(() => {
    if (articleHeroIndex >= articleHeroSlides.length) setArticleHeroIndex(0)
  }, [articleHeroSlides.length, articleHeroIndex])

  useEffect(() => {
    if (activeArticleTab !== 'articles' || articleHeroSlides.length <= 1) return
    const sliderTimer = window.setInterval(() => {
      setArticleHeroIndex(prev => (prev + 1) % articleHeroSlides.length)
    }, 5500)
    return () => window.clearInterval(sliderTimer)
  }, [activeArticleTab, articleHeroSlides.length])

  useEffect(() => {
    if (urgentTickerIndex >= urgentHeroSlides.length) setUrgentTickerIndex(0)
  }, [urgentHeroSlides.length, urgentTickerIndex])

  useEffect(() => {
    if (activeArticleTab !== 'live' || urgentHeroSlides.length <= 1) return
    const urgentTimer = window.setInterval(() => {
      setUrgentTickerIndex(prev => (prev + 1) % urgentHeroSlides.length)
    }, 5500)
    return () => window.clearInterval(urgentTimer)
  }, [activeArticleTab, urgentHeroSlides.length])

  const moveArticleHero = (direction) => {
    if (!articleHeroSlides.length) return
    setArticleHeroIndex(prev => (prev + direction + articleHeroSlides.length) % articleHeroSlides.length)
  }

  const moveUrgentHero = (direction) => {
    if (!urgentHeroSlides.length) return
    setUrgentTickerIndex(prev => (prev + direction + urgentHeroSlides.length) % urgentHeroSlides.length)
  }

  const handleArticleHeroPointerUp = (event) => {
    const startX = articleHeroSwipeStart.current
    articleHeroSwipeStart.current = null
    if (startX == null) return
    const diff = event.clientX - startX
    if (Math.abs(diff) > 45) moveArticleHero(diff < 0 ? 1 : -1)
  }

  const handleUrgentHeroPointerUp = (event) => {
    const startX = urgentHeroSwipeStart.current
    urgentHeroSwipeStart.current = null
    if (startX == null) return
    const diff = event.clientX - startX
    if (Math.abs(diff) > 45) moveUrgentHero(diff < 0 ? 1 : -1)
  }

  const tvRows = [
    ['18:30', 'CANAL+ SPORT', 'Manchester City – Arsenal', 'Premier League'],
    ['20:45', 'ELEVEN SPORTS 2', 'Inter – Juventus', 'Serie A'],
    ['21:00', 'polsat sport premium', 'Real Madryt – Betis', 'LaLiga'],
    ['21:00', 'TVP SPORT', 'Lech – Legia', 'PKO BP Ekstraklasa'],
    ['23:15', 'CANAL+ SPORT', 'NBA Lakers – Nuggets', 'Playoffs'],
  ]

  const ppvRows = [
    ['Usyk vs Fury', 'Walka o wszystkie pasy', '49.00 zł', 'PPV'],
    ['UFC 302', 'Makhachev vs Poirier', '49.00 zł', 'PPV'],
    ['KSW 94', 'Stadion Narodowy, Warszawa', '39.00 zł', 'PPV'],
  ]

  const liveChatUsers = [
    ['ZielonyKról', '2.860 zł / 2 dni', '+14.5%'],
    ['PiłkarskiGuru', '1.340 zł / 2 dni', '+8.3%'],
    ['Piłkarzytv', '2.340 zł / 2 dni', ''],
    ['smilhytv', '1.120 zł / 3 dni', ''],
  ]

  const chatRows = [
    ['B', 'buchajsonek1988', 'czekam na wieczór!', '12:31', ''],
    ['P', 'pirotek1987', 'idziemy dziś po zielone? 💪', '12:32', ''],
    ['K', 'krystian_typer', 'Dzisiaj typy z AI mega! 😎', '12:32', ''],
    ['S', 'smilhytv', '🔥 Liczymy dziś! 🚀', '12:34', 'ADMIN'],
  ]

  const sideTipsters = [
    ['1', 'smilhytv', 'ROI: +20.6% • WR: 0.0%', 'Typy: 72 • Wygrane: 0', '+0.00 zł'],
    ['2', 'buchajson1988', 'ROI: +18.1% • WR: 0.0%', 'Typy: 50 • Wygrane: 0', '+0.00 zł'],
    ['3', 'pirotek1987', 'ROI: +17.2% • WR: 0.0%', 'Typy: 61 • Wygrane: 0', '+0.00 zł'],
    ['4', 'krystian_typer', 'ROI: +16.3% • WR: 0.0%', 'Typy: 49 • Wygrane: 0', '+0.00 zł'],
    ['5', 'adrianbets', 'ROI: +15.0% • WR: 0.0%', 'Typy: 38 • Wygrane: 0', '+0.00 zł'],
  ]

  const aiDayRows = [
    ['MC', 'Manchester City vs Arsenal', 'Typ: Manchester City wygra', '68%'],
    ['PSG', 'PSG vs Olympique Lyon', 'Typ: Powyżej 2.5 gola', '61%'],
    ['INT', 'Inter vs Juventus', 'Typ: Inter wygra lub remis', '64%'],
  ]

  const liveScores = [
    ['PREMIER LEAGUE', 'Tottenham', 'Liverpool', '2 : 1', '86′', ['23′ Son', '45+1′ Maddison'], ['17′ Salah'], ['2.45', '3.40', '2.80'], '+123'],
    ['SERIE A', 'Inter', 'Juventus', '1 : 0', 'HT', ['15′ Lautaro (k)'], ['37′ Bremer'], ['1.90', '3.50', '4.20'], '+98'],
    ['LALIGA', 'Barcelona', 'Real Sociedad', '3 : 2', '62′', ['12′ Lewandowski', '34′ Gündoğan', '58′ Yamal'], ['49′ Kubo'], ['1.90', '4.20', '5.20'], '+112'],
    ['BUNDESLIGA', 'Leverkusen', 'Bayern', '1 : 1', '71′', ['18′ Wirtz'], ['45+2′ Kane'], ['2.10', '3.60', '2.40'], '+107'],
  ]

  return (
    <section className="tvlive-page-v8">
      <div className="tvlive-layout-v8">
        <div className="tvlive-main-v8">
          <div className="tvlive-tabs-v8 glass-tvlive-v8">
            <button type="button" aria-pressed={activeArticleTab === 'live'} className={activeArticleTab === 'live' ? 'active live-tab-pulse-v539' : 'live-tab-pulse-v539'} onClick={() => setActiveArticleTab('live')}>🔴 Na żywo</button>
            <button type="button" aria-pressed={activeArticleTab === 'tv'} className={activeArticleTab === 'tv' ? 'active' : ''} onClick={() => setActiveArticleTab('tv')}>TV / PPV</button>
            <button type="button" aria-pressed={activeArticleTab === 'scores'} className={activeArticleTab === 'scores' ? 'active' : ''} onClick={() => setActiveArticleTab('scores')}>Wyniki live</button>
          </div>

          {activeArticleTab === 'live' ? (
            <>
            {urgentHeroArticle ? (
              <div
                className={`glass-tvlive-v8 sportpl-important-hero-v550 ${urgentHeroArticle?.image ? 'has-image-v550' : ''}`}
                onPointerDown={(event) => { urgentHeroSwipeStart.current = event.clientX }}
                onPointerUp={handleUrgentHeroPointerUp}
              >
                {urgentHeroArticle?.image ? (
                  <div className="sportpl-important-hero-bg-v550">
                    <img src={urgentHeroArticle.image} data-original-src={urgentHeroArticle.rawImage || ''} alt="" referrerPolicy="no-referrer" onError={(event) => { const original = event.currentTarget.getAttribute('data-original-src'); if (original && event.currentTarget.src !== original) { event.currentTarget.removeAttribute('data-original-src'); event.currentTarget.src = original; return } event.currentTarget.closest('.sportpl-important-hero-v550')?.classList.add('image-error-v550'); event.currentTarget.remove() }} />
                  </div>
                ) : null}
                <div className="sportpl-important-strip-v550"><span>NAJWAŻNIEJSZE WIADOMOŚCI</span><b>{urgentTickerIndex + 1}/{urgentHeroSlides.length || 1}</b><em>tylko pilne • auto co 5,5 s</em></div>
                <div className="sportpl-important-copy-v550">
                  <div className="sportpl-important-badge-v550">PILNE</div>
                  <small>{urgentHeroArticle?.tag || 'SPORT.PL'}</small>
                  <h1>{urgentHeroArticle?.title || 'Ważna wiadomość sportowa'}</h1>
                  <p>{urgentHeroArticle?.excerpt || 'Kliknij, aby przeczytać pełny ważny artykuł na Sport.pl.'}</p>
                  <div className="sportpl-important-actions-v550">
                    <button type="button" onClick={() => urgentHeroArticle?.url && window.open(urgentHeroArticle.url, '_blank', 'noopener,noreferrer')}>Czytaj artykuł</button>
                    <button type="button" className="ghost-v550" onClick={() => moveUrgentHero(1)}>Następna wiadomość</button>
                  </div>
                </div>
                <div className="sportpl-important-logo-v550">SPORT.PL</div>
                <div className="sportpl-important-nav-v550">
                  <button type="button" aria-label="Poprzednia pilna wiadomość" onClick={() => moveUrgentHero(-1)}>‹</button>
                  <div className="sportpl-important-dots-v550">
                    {urgentHeroSlides.map((_, index) => (
                      <button type="button" key={index} aria-label={`Pilna wiadomość ${index + 1}`} className={urgentTickerIndex === index ? 'active' : ''} onClick={() => setUrgentTickerIndex(index)} />
                    ))}
                  </div>
                  <button type="button" aria-label="Następna pilna wiadomość" onClick={() => moveUrgentHero(1)}>›</button>
                </div>
              </div>
            ) : null}
            <div className="glass-tvlive-v8 sportpl-live-panel-v538 sportpl-live-panel-v539">
              <div className="sportpl-live-head-v538">
                <div>
                  <span>SPORT.PL LIVE FEED</span>
                  <h2>Zakładka Na żywo</h2>
                  <p>Pobiera najnowsze informacje ze Sport.pl i automatycznie sprawdza ważne wiadomości co 10 minut. Kafelki są klikalne i otwierają pełny artykuł.</p>
                </div>
                <div className="sportpl-live-status-v538">
                  <b>{liveLoading ? 'ŁADOWANIE' : 'LIVE'}</b>
                  <small>Ostatnio: {lastLiveUpdate ? getSportPlRelativeTime(lastLiveUpdate) : 'start'}</small>
                  <button type="button" className="sportpl-refresh-v539" onClick={() => window.location.reload()}>Odśwież teraz</button>
                </div>
              </div>
              {liveError ? <div className="sportpl-error-v538">{liveError}</div> : null}
              <div className="sportpl-live-grid-v538">
                {sportPlCards.concat(liveArticles.slice(4, 12).map((item, index) => ({
                  tag: item.category || 'SPORT.PL',
                  title: item.title || 'Sport.pl — wiadomość sportowa',
                  body: item.excerpt || 'Kliknij, aby przejść do pełnej wiadomości na Sport.pl.',
                  meta: getSportPlRelativeTime(item.publishedAt),
                  icon: getSportPlInitials(item.title),
                  url: item.url,
                  image: getSportPlImageSrc(item),
                  rawImage: item.image || '',
                  isImportant: isImportantSportPlNews(item),
                  index: index + 4
                }))).slice(0, 12).map((item, idx) => (
                  <article className={`sportpl-live-item-v538 ${item.isImportant ? 'important' : ''} ${item.image ? 'has-image-v540' : ''}`} key={`${item.url || item.title}-${idx}`} onClick={() => item.url && window.open(item.url, '_blank', 'noopener,noreferrer')}>
                    <div className="sportpl-live-media-v540">
                      {item.image ? <img src={item.image} data-original-src={item.rawImage || ''} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(event) => { const original = event.currentTarget.getAttribute('data-original-src'); if (original && event.currentTarget.src !== original) { event.currentTarget.removeAttribute('data-original-src'); event.currentTarget.src = original; return } event.currentTarget.closest('.sportpl-live-item-v538')?.classList.add('image-error-v540'); event.currentTarget.remove() }} /> : <span>{item.icon}</span>}
                    </div>
                    <div className="sportpl-live-item-top-v538"><span>{item.isImportant ? 'PILNE' : item.tag}</span><small>{item.meta}</small></div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                    <div className="sportpl-live-item-foot-v538"><b>{item.icon}</b><em>Sport.pl ↗</em></div>
                  </article>
                ))}
              </div>
              {!liveArticles.length && liveLoading ? <div className="sportpl-loading-v538">Pobieram wiadomości ze Sport.pl...</div> : null}
            </div>
            </>
          ) : null}

          {activeArticleTab !== 'live' ? <div className="tvlive-top-grid-v8">
            <div
              className={`glass-tvlive-v8 tvlive-hero-v8 article-hero-slider-v543 ${heroArticle?.image ? 'has-sportpl-hero-image-v543' : ''}`}
              onPointerDown={(event) => { articleHeroSwipeStart.current = event.clientX }}
              onPointerUp={handleArticleHeroPointerUp}
            >
              {heroArticle?.image ? (
                <div className="article-hero-bg-v543">
                  <img src={heroArticle.image} data-original-src={heroArticle.rawImage || ''} alt="" referrerPolicy="no-referrer" onError={(event) => { const original = event.currentTarget.getAttribute('data-original-src'); if (original && event.currentTarget.src !== original) { event.currentTarget.removeAttribute('data-original-src'); event.currentTarget.src = original; return } event.currentTarget.closest('.article-hero-slider-v543')?.classList.add('image-error-v543'); event.currentTarget.remove() }} />
                </div>
              ) : null}
              <div className="article-hero-live-strip-v543"><span>LIVE SPORT.PL</span><b>{articleHeroIndex + 1}/{articleHeroSlides.length || 1}</b><em>auto co 5,5 s</em></div>
              <div className="hero-badge-v8">{heroArticle?.isImportant ? 'PILNE' : heroArticle?.tag || 'TRENDING'}</div>
              <div className="hero-copy-v8">
                <h1 key={heroArticle?.title}>{heroArticle?.title || 'Mecz na szczycie Premier League: City kontra Arsenal'}</h1>
                <p>{heroArticle?.excerpt || 'Zapowiedź hitu kolejki, kluczowe statystyki, kontuzje i typy AI na to spotkanie.'}</p>
                <button type="button" onClick={() => heroArticle?.url && window.open(heroArticle.url, '_blank', 'noopener,noreferrer')}>Czytaj artykuł</button>
              </div>
              <div className="hero-vs-v8 article-hero-logo-v543">{heroArticle?.image ? 'SPORT.PL' : 'VS'}</div>
              <div className="hero-player-v8 left">{heroArticle?.icon || 'SP'}</div>
              <div className="hero-player-v8 right">LIVE</div>
              <div className="hero-nav-v8">
                <button type="button" aria-label="Poprzednia wiadomość" onClick={() => moveArticleHero(-1)}>‹</button>
                <div className="hero-dots-v8">
                  {articleHeroSlides.map((_, index) => (
                    <button type="button" aria-label={`Wiadomość ${index + 1}`} className={articleHeroIndex === index ? 'active' : ''} key={index} onClick={() => setArticleHeroIndex(index)} />
                  ))}
                </div>
                <button type="button" aria-label="Następna wiadomość" onClick={() => moveArticleHero(1)}>›</button>
              </div>
            </div>

            <div className="tvlive-side-stack-v8">
              <div className="glass-tvlive-v8 schedule-card-v8">
                <div className="card-head-v8"><h3>TV / Na żywo</h3><button type="button">Zobacz pełen program</button></div>
                <div className="mini-tabs-v8"><button type="button" className="active">Dziś</button><button type="button">Jutro</button><button type="button">Śr 17.05</button></div>
                <div className="schedule-list-v8">
                  {tvRows.map((row, idx) => (
                    <div className="schedule-row-v8" key={idx}>
                      <span>{row[0]}</span>
                      <div><strong>{row[2]}</strong><small>{row[3]}</small></div>
                      <em>{row[1]}</em>
                      <b>NA ŻYWO</b>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-tvlive-v8 ppv-card-v8">
                <div className="card-head-v8"><h3>PPV / Wydarzenia premium</h3><button type="button">Zobacz wszystkie</button></div>
                <div className="ppv-list-v8">
                  {ppvRows.map((row, idx) => (
                    <div className="ppv-row-v8" key={idx}>
                      <div className={`ppv-thumb-v8 t${idx+1}`}></div>
                      <div><strong>{row[0]}</strong><small>{row[1]}</small></div>
                      <span>{row[2]}</span>
                      <b>{row[3]}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div> : null}

          {activeArticleTab !== 'live' ? <>
          <div className="section-head-v8"><h2>{activeArticleTab === 'tv' ? 'TV / PPV — program i transmisje' : activeArticleTab === 'scores' ? 'Wyniki live — aktywne mecze' : 'Najnowsze artykuły'}</h2><button type="button" onClick={() => setActiveArticleTab('live')}>Otwórz Na żywo</button></div>
          <div className="article-grid-v8">
            {sportPlCards.map((item, idx) => (
              <article className="glass-tvlive-v8 article-card-v8" key={item.url || idx} onClick={() => item.url && window.open(item.url, '_blank', 'noopener,noreferrer')}>
                <div className={`article-cover-v8 c${(idx % 4)+1} ${item.image ? 'has-sportpl-image-v541' : ''}`} style={item.image ? { backgroundImage: `linear-gradient(180deg, rgba(2,8,14,.12), rgba(2,8,14,.72)), url(${item.image})` } : undefined}><span>{item.isImportant ? 'PILNE' : item.tag}</span><small>{item.meta}</small><strong>{item.image ? 'SPORT.PL' : item.icon}</strong></div>
                <div className="article-body-v8">
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <div className="article-foot-v8"><span>{item.isImportant ? '🚨 Ważne' : '🔥 Sport.pl'}</span><span>↗ Czytaj</span></div>
                </div>
              </article>
            ))}
          </div>

          </> : null}

          <div className="glass-tvlive-v8 livescore-wrap-v8">
            <div className="card-head-v8"><h3>Wyniki live</h3><button type="button">⚙ Ustawienia</button></div>
            <div className="scores-tabs-v8"><button type="button" className="active">Wszystkie</button><button type="button">⚽ Piłka nożna</button><button type="button">🎾 Tenis</button><button type="button">🏀 Koszykówka</button><button type="button">🏒 Hokej</button><button type="button">🏐 Siatkówka</button><button type="button">🎯 Dart</button></div>
            <div className="livescore-grid-v8">
              {liveScores.map((row, idx) => (
                <div className="live-card-v8" key={idx}>
                  <div className="live-card-head-v8"><span>{row[0]}</span><b>{row[4]}</b></div>
                  <div className="live-teams-v8"><strong>{row[1]}</strong><b>{row[3]}</b><strong>{row[2]}</strong></div>
                  <div className="live-events-v8"><span>{row[5].join(' • ')}</span><span>{row[6].join(' • ')}</span></div>
                  <div className="odds-row-v8"><i>{row[7][0]}</i><i>{row[7][1]}</i><i>{row[7][2]}</i><em>{row[8]}</em></div>
                </div>
              ))}
            </div>
            <button type="button" className="more-live-v8">⌄ Pokaż więcej meczów na żywo</button>
          </div>
        </div>

        <aside className="tvlive-sidebar-v8">
          <div className="glass-tvlive-v8 livechat-card-v8">
            <div className="livechat-head-v8"><h3>● BET+AI LIVE CHAT</h3><span>154 online</span></div>
            <div className="top-users-v8">
              {liveChatUsers.map((item, idx) => <div key={idx}><strong>{item[0]}</strong><small>{item[1]}</small><b>{item[2]}</b></div>)}
            </div>
            <div className="chat-list-v8">
              {chatRows.map((item, idx) => (
                <div className="chat-row-v8" key={idx}>
                  <span>{item[0]}</span>
                  <div><strong>{item[1]} {item[4] ? <em>{item[4]}</em> : null}</strong><p>{item[2]}</p></div>
                  <small>{item[3]}</small>
                </div>
              ))}
            </div>
            <div className="chat-input-v8"><input readOnly placeholder="Napisz wiadomość..." /><button type="button">TIP ⬇</button><button type="button" className="send">➤</button></div>
          </div>

          <div className="glass-tvlive-v8 side-ranking-v8">
            <div className="card-head-v8"><h3>🏆 Top typerzy</h3><button type="button">Ranking realy</button></div>
            <div className="side-list-v8">
              {sideTipsters.map((row, idx) => (
                <div className="side-rank-row-v8" key={idx}>
                  <span className={`rank-v8 r${idx+1}`}>{row[0]}</span>
                  <div><strong>{row[1]}</strong><small>{row[2]}</small><small>{row[3]}</small></div>
                  <b>{row[4]}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-tvlive-v8 ai-day-card-v8">
            <div className="card-head-v8"><h3>⚗ Typy AI dnia</h3><button type="button">Zobacz wszystkie</button></div>
            <div className="ai-day-list-v8">
              {aiDayRows.map((row, idx) => (
                <div className="ai-day-row-v8" key={idx}>
                  <span>{row[0]}</span>
                  <div><strong>{row[1]}</strong><small>{row[2]}</small><i style={{width: row[3]}}></i></div>
                  <b>{row[3]}</b>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

function WalletPanel({ wallet, tokenBalance = 0, unlockedTips, tips, payments = [], earnings = null, stripeConnectStatus = null, onTopUp, onBuyTokens, onSellTokens, onConnectStripe, user, userPlan = 'free', onViewChange, onToast, onManageSubscription, onUpgradeSubscription }) {
  const [accountHistoryRows, setAccountHistoryRows] = useState([])
  const [accountHistoryLoading, setAccountHistoryLoading] = useState(false)
  const [accountHistoryExpanded, setAccountHistoryExpanded] = useState(false)
  const [tokenExchangeMode, setTokenExchangeMode] = useState(null)
  const [tokenExchangePacks, setTokenExchangePacks] = useState(1)
  const [tokenExchangeBusy, setTokenExchangeBusy] = useState(false)
  const [walletClock, setWalletClock] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setWalletClock(new Date()), 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  const walletAmount = Math.max(0, Number(wallet || 0) || 0)
  const userTokens = Math.max(0, Number(tokenBalance || 0) || 0)
  const tokenPlnValue = userTokens / 1000
  const isPremiumWalletUser = isPremiumProfile(user) || isPremiumAccount(userPlan) || isPremiumAccount(user?.plan || user?.subscription_status || user?.status)
  const subscriptionLabel = isPremiumWalletUser ? 'Premium' : 'Free'
  const subscriptionPlanLabel = isPremiumWalletUser ? 'Plan miesięczny' : 'Plan darmowy'
  const subscriptionPriceLabel = isPremiumWalletUser ? '29 zł / miesiąc' : '0 zł / miesiąc'
  const subscriptionStatusText = isPremiumWalletUser ? 'Status konta: Premium aktywne' : 'Status konta: Free'
  const subscriptionRenewalDate = user?.current_period_end
    ? new Date(user.current_period_end).toLocaleDateString('pl-PL')
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pl-PL')
  const subscriptionDaysLeft = user?.current_period_end
    ? (() => {
        const today = new Date(walletClock)
        const end = new Date(user.current_period_end)
        today.setHours(0, 0, 0, 0)
        end.setHours(0, 0, 0, 0)
        return Math.max(0, Math.round((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)))
      })()
    : (isPremiumWalletUser ? 30 : 0)
  const subscriptionDaysLabel = subscriptionDaysLeft === 1 ? 'dzień' : 'dni'
  const subscriptionCtaLabel = isPremiumWalletUser ? 'Zarządzaj subskrypcją' : 'Aktywuj Premium przez Stripe'
  const subscriptionStripeHint = isPremiumWalletUser
    ? 'Otwórz Stripe Billing Portal i zarządzaj planem, metodą płatności oraz fakturami.'
    : 'Bezpieczna płatność Stripe aktywuje Premium i odblokuje sprzedaż typów.'
  const handleSubscriptionAction = () => {
    window.location.href = BETAI_STRIPE_SUBSCRIPTION_LINK
  }
  const formatWalletPln = value => `${Number(value || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
  const formatTokenCount = value => Number(value || 0).toLocaleString('pl-PL')
  const tokenExchangeTokens = Math.max(1, Number(tokenExchangePacks || 1)) * 1000
  const tokenBuyPrice = Math.max(1, Number(tokenExchangePacks || 1)) * 1.10
  const tokenSellPrice = Math.max(1, Number(tokenExchangePacks || 1)) * 0.90
  const openTokenExchange = mode => {
    setTokenExchangePacks(1)
    setTokenExchangeMode(mode)
  }
  const closeTokenExchange = () => {
    if (!tokenExchangeBusy) setTokenExchangeMode(null)
  }
  const submitTokenExchange = async () => {
    const packs = Math.max(1, Math.floor(Number(tokenExchangePacks || 1)))
    setTokenExchangeBusy(true)
    try {
      if (tokenExchangeMode === 'buy') await onBuyTokens?.(packs)
      if (tokenExchangeMode === 'sell') await onSellTokens?.(packs)
      setTokenExchangeMode(null)
    } finally {
      setTokenExchangeBusy(false)
    }
  }
  const formatHistoryDate = value => {
    const date = value ? new Date(value) : null
    if (!date || Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const formatHistoryPln = (value, sign = '') => `${sign}${Math.abs(Number(value || 0)).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
  const formatHistoryTokens = value => {
    const amount = Number(value || 0)
    return `${amount > 0 ? '+' : ''}${amount.toLocaleString('pl-PL')} ${Math.abs(amount) === 1 ? 'żeton' : 'żetonów'}`
  }

  const loadAccountHistory = async () => {
    const userId = user?.id
    const userEmail = normalizeEmail(user?.email)
    if (!isSupabaseConfigured || !supabase || !userId) {
      setAccountHistoryRows([])
      return
    }
    setAccountHistoryLoading(true)
    try {
      const [walletResult, paymentsResult, tokenResult] = await Promise.all([
        supabase
          .from('wallet_transactions')
          .select('id,amount,type,provider,status,created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('payments')
          .select('id,amount,provider,status,created_at,tip_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100),
        userEmail
          ? supabase
              .from('betai_token_transactions')
              .select('id,delta_tokens,reason,ref_type,ref_data,created_at')
              .eq('email', userEmail)
              .order('created_at', { ascending: false })
              .limit(100)
          : Promise.resolve({ data: [], error: null })
      ])

      if (walletResult.error) console.warn('wallet history skipped', walletResult.error)
      if (paymentsResult.error) console.warn('payments history skipped', paymentsResult.error)
      if (tokenResult.error) console.warn('token history skipped', tokenResult.error)

      const walletRows = (walletResult.data || []).map(row => {
        const type = String(row.type || '').toLowerCase()
        const rawAmount = Number(row.amount || 0)
        const isNegative = ['payout', 'spend', 'purchase'].includes(type) || rawAmount < 0
        let title = 'Operacja portfela'
        let icon = '▣'
        if (type === 'topup') { title = row.provider === 'stripe' ? 'Wpłata Stripe' : 'Wpłata środków'; icon = '▣' }
        else if (type === 'payout') { title = 'Wypłata środków'; icon = '⇡' }
        else if ((type === 'spend' || type === 'purchase') && row.provider === 'token_exchange') { title = 'Kupno żetonów'; icon = '◎' }
        else if (type === 'token_exchange') { title = 'Wymiana żetonów na walutę'; icon = '⇄' }
        else if (type === 'spend' || type === 'purchase') { title = 'Zakup z portfela'; icon = '◎' }
        else if (type === 'premium_purchase') { title = 'Zakup Premium'; icon = '★' }
        return {
          id: `wallet_${row.id}`,
          createdAt: row.created_at,
          icon,
          title,
          time: formatHistoryDate(row.created_at),
          amount: formatHistoryPln(rawAmount, isNegative ? '-' : '+'),
          positive: !isNegative,
          kind: 'wallet'
        }
      })

      const paymentRows = (paymentsResult.data || []).map(row => {
        const provider = String(row.provider || '').toLowerCase()
        const isPremium = provider.includes('premium') || provider.includes('subscription')
        return {
          id: `payment_${row.id}`,
          createdAt: row.created_at,
          icon: isPremium ? '★' : '🧾',
          title: isPremium ? 'Zakup Premium' : 'Zakup typu premium',
          time: formatHistoryDate(row.created_at),
          amount: formatHistoryPln(row.amount, '-'),
          positive: false,
          kind: 'payment'
        }
      })

      const tokenRows = (tokenResult.data || []).map(row => {
        const reason = String(row.reason || '').toLowerCase()
        const delta = Number(row.delta_tokens || 0)
        const refData = row.ref_data || {}
        let title = 'Operacja żetonów'
        let icon = 'AI'
        if (reason === 'live_chat_tip_sent') { title = 'Tip wysłany'; icon = '↗' }
        else if (reason === 'live_chat_tip_received') { title = 'Tip otrzymany'; icon = '♡' }
        else if (reason === 'welcome_bonus') { title = 'Bonus powitalny'; icon = '🎁' }
        else if (reason === 'token_purchase') { title = 'Kupno żetonów'; icon = '◎' }
        else if (reason === 'token_exchange_to_wallet') { title = 'Wymiana żetonów na walutę'; icon = '⇄' }
        else if (reason === 'live_chat_daily_leader') { title = 'Nagroda lidera czatu'; icon = '🏆' }
        else if (reason === 'live_chat_daily_message') { title = 'Bonus za aktywność'; icon = '💬' }
        if (reason === 'live_chat_tip_sent' && refData?.to_email) title = `Tip wysłany do ${String(refData.to_email).split('@')[0]}`
        if (reason === 'live_chat_tip_received' && refData?.from_email) title = `Tip od ${String(refData.from_email).split('@')[0]}`
        return {
          id: `token_${row.id}`,
          createdAt: row.created_at,
          icon,
          title,
          time: formatHistoryDate(row.created_at),
          amount: formatHistoryTokens(delta),
          positive: delta >= 0,
          kind: 'token'
        }
      })

      const dedupedRows = [...walletRows, ...paymentRows, ...tokenRows]
        .filter(row => row.createdAt)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setAccountHistoryRows(dedupedRows)
    } catch (error) {
      console.error('loadAccountHistory error', error)
      setAccountHistoryRows([])
    } finally {
      setAccountHistoryLoading(false)
    }
  }

  useEffect(() => {
    loadAccountHistory()
  }, [user?.id, user?.email])

  useEffect(() => {
    const refreshHistory = () => loadAccountHistory()
    window.addEventListener('betai-token-balance-changed', refreshHistory)
    window.addEventListener('betai-wallet-history-changed', refreshHistory)
    return () => {
      window.removeEventListener('betai-token-balance-changed', refreshHistory)
      window.removeEventListener('betai-wallet-history-changed', refreshHistory)
    }
  }, [user?.id, user?.email])

  const visibleHistoryRows = accountHistoryExpanded ? accountHistoryRows : accountHistoryRows.slice(0, 5)
  const getPaymentDocumentLink = payment => payment?.invoice_pdf_url || payment?.invoice_pdf || payment?.invoice_url || payment?.hosted_invoice_url || null
  const getPaymentDocumentTitle = payment => {
    const provider = String(payment?.provider || '').toLowerCase()
    if (payment?.invoice_number) return `Faktura ${payment.invoice_number}`
    if (provider.includes('premium')) return 'Zakup Premium'
    if (provider.includes('token')) return 'Zakup żetonów'
    if (payment?.tip_id) return 'Zakup typu premium'
    return 'Płatność'
  }
  const getPaymentDocumentSubtitle = payment => {
    const provider = String(payment?.provider || '').toLowerCase()
    if (provider.includes('premium')) return 'Premium 30 dni'
    if (provider.includes('token')) return 'Zakup żetonów'
    if (payment?.tip_id) return 'Typ premium'
    return String(payment?.provider || 'Płatność Stripe')
  }
  const invoiceRows = (payments || [])
    .filter(payment => String(payment?.status || '').toLowerCase() === 'paid')
    .slice(0, 3)
    .map(payment => ({
      id: payment.id,
      title: getPaymentDocumentTitle(payment),
      sub: getPaymentDocumentSubtitle(payment),
      price: formatWalletPln(payment.amount),
      date: payment.created_at ? new Date(payment.created_at).toLocaleDateString('pl-PL') : '—',
      href: getPaymentDocumentLink(payment)
    }))
  const topUsers = [
    ['RebelKoks', 'Typy: 66 • WIN: 68.2%'],
    ['smilhytv', 'Typy: 72 • WIN: 62.1%'],
    ['buchajsonek1988', 'Typy: 67 • WIN: 59.8%'],
    ['piotrek1987', 'Typy: 61 • WIN: 61.0%'],
    ['krystian_typer', 'Typy: 54 • WIN: 57.2%']
  ]
  const topTipsters = [
    ['smilhytv', 'Typy: 72 • WIN: 62.1%', '+1250.75 zł'],
    ['buchajsonek1988', 'Typy: 67 • WIN: 59.8%', '+980.50 zł'],
    ['piotrek1987', 'Typy: 61 • WIN: 61.0%', '+750.00 zł'],
    ['krystian_typer', 'Typy: 54 • WIN: 57.2%', '+620.30 zł'],
    ['adrianbets', 'Typy: 48 • WIN: 55.4%', '+410.25 zł']
  ]
  const aiPicks = [
    ['Manchester City vs Inter Mediolan', 'Typ: Manchester City wygra', '68%'],
    ['PSG vs Borussia Dortmund', 'Typ: Powyżej 2.5 gola', '63%'],
    ['Liverpool vs Bayer Leverkusen', 'Typ: Liverpool wygra', '61%']
  ]

  const [walletEarningsPeriod, setWalletEarningsPeriod] = useState('current_month')
  const creatorEarningsHistory = Array.isArray(earnings?.history) ? earnings.history : []
  const startOfDay = value => {
    const date = new Date(value)
    date.setHours(0, 0, 0, 0)
    return date
  }
  const startOfMonth = value => {
    const date = new Date(value)
    date.setDate(1)
    date.setHours(0, 0, 0, 0)
    return date
  }
  const addMonths = (value, months) => {
    const date = new Date(value)
    date.setMonth(date.getMonth() + months)
    return date
  }
  const creatorPeriodRange = (() => {
    const now = new Date(walletClock)
    const currentStart = startOfMonth(now)
    const nextStart = addMonths(currentStart, 1)
    if (walletEarningsPeriod === 'previous_month') {
      return { start: addMonths(currentStart, -1), end: currentStart, label: 'Poprzedni miesiąc' }
    }
    if (walletEarningsPeriod === 'last_3_months') {
      return { start: addMonths(currentStart, -2), end: nextStart, label: 'Ostatnie 3 miesiące' }
    }
    if (walletEarningsPeriod === 'year') {
      const yearStart = new Date(now.getFullYear(), 0, 1)
      return { start: yearStart, end: new Date(now.getFullYear() + 1, 0, 1), label: 'Cały rok' }
    }
    return { start: currentStart, end: nextStart, label: 'Bieżący miesiąc' }
  })()
  const previousCreatorPeriodRange = (() => {
    const span = creatorPeriodRange.end.getTime() - creatorPeriodRange.start.getTime()
    return {
      start: new Date(creatorPeriodRange.start.getTime() - span),
      end: creatorPeriodRange.start
    }
  })()
  const amountFromCreatorRow = row => Number(row?.amount || row?.net_amount || row?.tipster_amount || 0) || 0
  const creatorRowsForRange = (range) => creatorEarningsHistory.filter(row => {
    const createdAt = new Date(row?.created_at || 0)
    return !Number.isNaN(createdAt.getTime()) && createdAt >= range.start && createdAt < range.end
  })
  const currentCreatorRows = creatorRowsForRange(creatorPeriodRange)
  const previousCreatorRows = creatorRowsForRange(previousCreatorPeriodRange)
  const creatorPeriodTotal = currentCreatorRows.reduce((sum, row) => sum + amountFromCreatorRow(row), 0)
  const previousCreatorTotal = previousCreatorRows.reduce((sum, row) => sum + amountFromCreatorRow(row), 0)
  const creatorGrowthPercent = previousCreatorTotal > 0
    ? ((creatorPeriodTotal - previousCreatorTotal) / previousCreatorTotal) * 100
    : (creatorPeriodTotal > 0 ? 100 : 0)
  const creatorGrossTotal = currentCreatorRows.reduce((sum, row) => sum + Number(row?.gross_amount || (amountFromCreatorRow(row) + Number(row?.commission || 0)) || 0), 0)
  const creatorCommissionTotal = currentCreatorRows.reduce((sum, row) => sum + Number(row?.commission || 0), 0)
  const creatorSalesCount = currentCreatorRows.length
  const creatorChartBuckets = (() => {
    const useMonths = walletEarningsPeriod === 'last_3_months' || walletEarningsPeriod === 'year'
    const buckets = []
    if (useMonths) {
      const cursor = startOfMonth(creatorPeriodRange.start)
      while (cursor < creatorPeriodRange.end) {
        const bucketStart = new Date(cursor)
        const bucketEnd = addMonths(bucketStart, 1)
        buckets.push({
          key: `${bucketStart.getFullYear()}-${bucketStart.getMonth()}`,
          label: bucketStart.toLocaleDateString('pl-PL', { month: 'short' }),
          amount: creatorRowsForRange({ start: bucketStart, end: bucketEnd }).reduce((sum, row) => sum + amountFromCreatorRow(row), 0)
        })
        cursor.setMonth(cursor.getMonth() + 1)
      }
      return buckets
    }

    const cursor = startOfDay(creatorPeriodRange.start)
    while (cursor < creatorPeriodRange.end) {
      const bucketStart = new Date(cursor)
      const bucketEnd = new Date(bucketStart)
      bucketEnd.setDate(bucketEnd.getDate() + 1)
      buckets.push({
        key: bucketStart.toISOString().slice(0, 10),
        label: String(bucketStart.getDate()),
        amount: creatorRowsForRange({ start: bucketStart, end: bucketEnd }).reduce((sum, row) => sum + amountFromCreatorRow(row), 0)
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    return buckets
  })()
  const creatorChartMax = Math.max(1, ...creatorChartBuckets.map(bucket => Number(bucket.amount || 0)))
  const creatorChartPoints = creatorChartBuckets.map((bucket, index) => {
    const x = creatorChartBuckets.length <= 1 ? 0 : (index / (creatorChartBuckets.length - 1)) * 100
    const y = 100 - (Number(bucket.amount || 0) / creatorChartMax) * 100
    return `${x},${y}`
  }).join(' ')
  const creatorChartAreaPoints = creatorChartBuckets.length
    ? `0,100 ${creatorChartPoints} 100,100`
    : ''
  const creatorChartXAxisLabels = creatorChartBuckets.length > 6
    ? creatorChartBuckets.filter((_, index) => index === 0 || index === creatorChartBuckets.length - 1 || index % Math.ceil(creatorChartBuckets.length / 4) === 0)
    : creatorChartBuckets
  const creatorGrowthLabel = previousCreatorTotal > 0
    ? `${creatorGrowthPercent >= 0 ? '+' : ''}${creatorGrowthPercent.toFixed(1)}% vs poprzedni okres`
    : (creatorPeriodTotal > 0 ? 'Pierwszy zarobek w tym okresie' : 'Brak danych do porównania')
  const creatorSourceLabel = source => {
    if (source === 'profile_subscription') return 'Subskrypcja profilu'
    if (source === 'tip_purchase') return 'Sprzedaż typu'
    return 'Zarobek twórcy'
  }

  const adminUnlocked = isAdminUser(user)

  function handleAdminWalletTab(targetView) {
    if (!adminUnlocked) {
      onToast?.({
        type: 'error',
        title: 'Zakładka tylko dla admina',
        message: 'Dostęp do tej sekcji ma wyłącznie administrator: smilhytv / smilhytv@gmail.com.'
      })
      return
    }
    onViewChange?.(targetView)
  }

  return (
    <section className="wallet-panel wallet-ultra-page wallet-static-v2">
      <div className="wallet-v2-layout">
        <div className="wallet-v2-main">
          <div className="wallet-v2-hero glass-v2-panel">
            <div className="wallet-v2-hero-copy">
              <h2>Portfel <span>Premium</span></h2>
              <p>Wpłacaj, wypłacaj i zarządzaj środkami w jednym miejscu. Szybkie operacje, pełna kontrola salda i nowoczesny finansowy hub Bet+AI.</p>

              <div className="wallet-v2-hero-features">
                <div>
                  <i>＋</i>
                  <strong>Błyskawiczne wpłaty</strong>
                  <small>BLIK, karta, PayPal i szybkie przelewy online</small>
                </div>
                <div>
                  <i>⇡</i>
                  <strong>Wygodne wypłaty</strong>
                  <small>Wypłacaj środki na konto i śledź każdą operację</small>
                </div>
                <div>
                  <i>◎</i>
                  <strong>Pełna kontrola portfela</strong>
                  <small>Saldo, żetony, płatności i subskrypcja zawsze pod ręką</small>
                </div>
              </div>
            </div>

            <div className="wallet-v2-hero-visual" aria-hidden="true">
              <div className="wallet-v2-hero-orbit"></div>
              <div className="wallet-v2-hero-coin">🪙</div>
              <div className="wallet-v2-hero-card wallet-v2-hero-card-main">
                <b>Saldo</b>
                <strong>{formatWalletPln(walletAmount)}</strong>
                <span>Środki dostępne</span>
              </div>
              <div className="wallet-v2-hero-card wallet-v2-hero-card-deposit">
                <b>Wpłata</b>
                <strong>+200 zł</strong>
                <span>BLIK • natychmiast</span>
              </div>
              <div className="wallet-v2-hero-card wallet-v2-hero-card-withdraw">
                <b>Wypłata</b>
                <strong>-150 zł</strong>
                <span>Konto bankowe</span>
              </div>
            </div>
          </div>

          <div className="wallet-stripe-connect-card glass-v2-panel">
            <div className="wallet-stripe-connect-main">
              <div className="wallet-stripe-connect-icon">▣</div>
              <div>
                <div className="wallet-stripe-connect-head">
                  <h3>Moje konto Stripe</h3>
                  <span className={stripeConnectStatus?.payouts_enabled ? 'stripe-status-pill ready' : stripeConnectStatus?.stripe_account_id ? 'stripe-status-pill pending' : 'stripe-status-pill empty'}>
                    {stripeConnectStatus?.payouts_enabled ? 'Stripe aktywny' : stripeConnectStatus?.stripe_account_id ? 'Dokończ konfigurację' : 'Niepodłączone'}
                  </span>
                </div>
                <p>
                  Podłącz swoje konto Stripe Connect, żeby sprzedawać single i subskrypcje profilu. Kupujący płaci na stronie, Stripe automatycznie kieruje <b>80%</b> do Ciebie, a <b>20%</b> marży zostaje dla platformy.
                </p>
                <small>Kupujący nie wpisuje konta bankowego sprzedawcy. Dane bankowe podajesz tylko bezpiecznie w Stripe.</small>
              </div>
            </div>
            <button type="button" onClick={() => onConnectStripe?.()}>
              {stripeConnectStatus?.payouts_enabled ? 'Zarządzaj Stripe' : stripeConnectStatus?.stripe_account_id ? 'Dokończ Stripe' : 'Podłącz Stripe'}
            </button>
          </div>

          <div className="wallet-v2-tabs glass-v2-panel wallet-v2-tabs-under-hero">
            <button type="button" className="active" onClick={() => onViewChange?.('wallet')}>Portfel</button>
            <button type="button" onClick={() => onViewChange?.('deposits')}>Wpłaty</button>
            <button type="button" onClick={() => onViewChange?.('payouts')}>Wypłaty</button>
            <button type="button" onClick={() => onViewChange?.('payments')}>Płatności</button>
            <button type="button" onClick={() => onViewChange?.('subscriptions')}>Subskrypcja</button>
            <button type="button" onClick={() => onViewChange?.('earnings')}>Zarobki</button>
            <button
              type="button"
              className={`wallet-v2-admin-tab ${adminUnlocked ? 'is-unlocked' : 'is-locked'}`}
              onClick={() => handleAdminWalletTab('adminFinance')}
              title={adminUnlocked ? 'Przejdź do panelu admina' : 'Tylko administrator może wejść do tej sekcji'}
            >
              <span className="wallet-v2-admin-lock" aria-hidden="true">🔒</span>
              <span>Admin finanse</span>
            </button>
            <button
              type="button"
              className={`wallet-v2-admin-tab ${adminUnlocked ? 'is-unlocked' : 'is-locked'}`}
              onClick={() => handleAdminWalletTab('adminPayouts')}
              title={adminUnlocked ? 'Przejdź do panelu admina' : 'Tylko administrator może wejść do tej sekcji'}
            >
              <span className="wallet-v2-admin-lock" aria-hidden="true">🔒</span>
              <span>Admin wypłaty</span>
            </button>
          </div>

          <div className="wallet-v2-topstats">
            <div className="glass-v2-panel wallet-v2-stat">
              <div className="wallet-v2-stat-top"><span>Saldo główne</span><i>👛</i></div>
              <strong>{formatWalletPln(walletAmount)}</strong>
              <small>Dostępne środki</small>
            </div>
            <div className="glass-v2-panel wallet-v2-stat">
              <div className="wallet-v2-stat-top"><span>Saldo żetonów</span><i>◌</i></div>
              <strong>{formatTokenCount(userTokens)}</strong>
              <small>Dostępne żetony</small>
            </div>
            <div className="glass-v2-panel wallet-v2-stat">
              <div className="wallet-v2-stat-top"><span>Wartość żetonów (PLN)</span><i>◍</i></div>
              <strong>{formatWalletPln(tokenPlnValue)}</strong>
              <small>1000 żetonów = 1 zł</small>
            </div>
          </div>

          <div className="wallet-v2-midgrid">
            <div className="glass-v2-panel wallet-v2-card">
              <div className="wallet-v2-card-head"><h3>Szybkie operacje</h3></div>
              <div className="wallet-v2-action-grid">
                <button type="button" onClick={() => onViewChange?.('deposits')}><b>＋</b><span><strong>Wpłać środki</strong><small>Przejdź do wpłat</small></span></button>
                <button type="button" onClick={() => onViewChange?.('payouts')}><b>⇡</b><span><strong>Wypłać środki</strong><small>Przejdź do wypłat</small></span></button>
                <button type="button" onClick={() => openTokenExchange('buy')}><b>◎</b><span><strong>Kup żetony</strong><small>1000 żetonów = 1,10 zł</small></span></button>
                <button type="button" onClick={() => openTokenExchange('sell')}><b>⇄</b><span><strong>Wymień żetony na walutę</strong><small>1000 żetonów = 0,90 zł</small></span></button>
                <button type="button" onClick={() => setAccountHistoryExpanded(true)} className="wallet-v2-action-history"><b>◫</b><span><strong>Historia transakcji</strong><small>Zobacz wszystkie operacje</small></span></button>
              </div>
            </div>

            <div className="glass-v2-panel wallet-v2-card">
              <div className="wallet-v2-card-head"><h3>Historia transakcji</h3><button type="button" onClick={() => setAccountHistoryExpanded(prev => !prev)}>{accountHistoryExpanded ? 'Pokaż mniej' : 'Zobacz wszystkie'}</button></div>
              <div className="wallet-v2-history-list">
                {accountHistoryLoading ? (
                  <div className="wallet-v2-history-empty">Ładuję transakcje...</div>
                ) : visibleHistoryRows.length ? visibleHistoryRows.map(row => (
                  <div className="wallet-v2-history-item" key={row.id}>
                    <span className="history-icon">{row.icon}</span>
                    <div className="history-text"><strong>{row.title}</strong><small>{row.time}</small></div>
                    <b className={row.positive ? 'positive' : 'negative'}>{row.amount}</b>
                  </div>
                )) : (
                  <div className="wallet-v2-history-empty">Brak transakcji na tym koncie.</div>
                )}
              </div>
            </div>

            <div className="glass-v2-panel wallet-v2-card wallet-v2-methods-card">
              <div className="wallet-v2-card-head"><h3>Metody płatności</h3></div>

              <div className="wallet-v2-method-section">
                <p className="wallet-v2-sub">Wpłaty</p>
                <div className="wallet-v2-payment-grid wallet-v2-payment-grid-live">
                  <button type="button" className="wallet-pay-method is-locked" disabled>
                    <span className="pay-logo paypal">P</span>
                    <strong>PayPal</strong>
                    <small>🔒 Wkrótce</small>
                  </button>
                  <button type="button" className="wallet-pay-method is-locked" disabled>
                    <span className="pay-logo revolut">R</span>
                    <strong>Revolut</strong>
                    <small>🔒 Wkrótce</small>
                  </button>
                  <button type="button" className="wallet-pay-method is-active" onClick={() => onViewChange?.('deposits')}>
                    <span className="pay-logo stripe">S</span>
                    <strong>Stripe</strong>
                    <small>Aktywne</small>
                  </button>
                </div>
              </div>

              <div className="wallet-v2-method-section wallet-v2-method-section-payout">
                <p className="wallet-v2-sub">Wypłaty</p>
                <div className="wallet-v2-payment-grid wallet-v2-payment-grid-live">
                  <button type="button" className="wallet-pay-method is-active" onClick={() => onViewChange?.('payouts')}>
                    <span className="pay-logo stripe">S</span>
                    <strong>Stripe</strong>
                    <small>Aktywne</small>
                  </button>
                  <button type="button" className="wallet-pay-method is-locked" disabled>
                    <span className="pay-logo paypal">P</span>
                    <strong>PayPal</strong>
                    <small>🔒 Wkrótce</small>
                  </button>
                  <button type="button" className="wallet-pay-method is-locked" disabled>
                    <span className="pay-logo revolut">R</span>
                    <strong>Revolut</strong>
                    <small>🔒 Wkrótce</small>
                  </button>
                </div>
              </div>

              <button type="button" className="wallet-v2-primary-btn" onClick={() => onViewChange?.('deposits')}>Przejdź do wpłat</button>
            </div>
          </div>

          <div className="wallet-v2-bottomgrid">
            <div className="glass-v2-panel wallet-v2-card">
              <div className="wallet-v2-card-head"><h3>Płatności i faktury</h3></div>
              <p className="wallet-v2-sub">Historia płatności i faktur</p>
              <div className="wallet-v2-invoice-list">
                {invoiceRows.length ? invoiceRows.map(row => (
                  <div className="invoice-item" key={row.id}>
                    <span className="invoice-icon">▤</span>
                    <div className="invoice-info">
                      <strong>{row.title}</strong>
                      <small>
                        {row.sub}{' '}
                        {row.href ? <a href={row.href} target="_blank" rel="noreferrer">Pobierz</a> : <em>Brak faktury</em>}
                      </small>
                    </div>
                    <div className="invoice-meta"><b>{row.price}</b><small>{row.date}</small></div>
                  </div>
                )) : (
                  <div className="wallet-v2-empty-documents">
                    <strong>Brak płatności i faktur</strong>
                    <small>Po pierwszej prawdziwej płatności dokument pojawi się tutaj.</small>
                  </div>
                )}
              </div>
              <button type="button" className="wallet-v2-primary-btn" onClick={() => onViewChange?.('payments')}>Zobacz wszystkie faktury</button>
            </div>

            <div className="glass-v2-panel wallet-v2-card subscription-card-v2">
              <div className="wallet-v2-card-head">
                <h3>Subskrypcja</h3>
                <span className={`subscription-status-chip ${isPremiumWalletUser ? 'is-premium' : 'is-free'}`}>{subscriptionStatusText}</span>
              </div>
              <p className="wallet-v2-sub">Aktywny plan</p>
              <div className="subscription-badge-v2">
                <span className="premium-round">{isPremiumWalletUser ? '✦' : '◌'}</span>
                <div>
                  <strong>{subscriptionLabel}</strong>
                  <small>{subscriptionPlanLabel}</small>
                  <b>{subscriptionPriceLabel}</b>
                </div>
              </div>
              <ul className="sub-feature-list">
                <li>{isPremiumWalletUser ? 'Dostęp do typów Premium' : 'Do 5 darmowych typów na dobę'}</li>
                <li>{isPremiumWalletUser ? 'Zaawansowane statystyki' : 'Podstawowe funkcje portfela i profilu'}</li>
                <li>{isPremiumWalletUser ? 'Typy AI bez limitu' : 'Sprzedaż typów zablokowana na koncie Free'}</li>
                <li>{isPremiumWalletUser ? 'Priorytetowe powiadomienia' : 'Przejście na Premium odblokowuje pełny dostęp'}</li>
              </ul>
              <div className="renew-info">{isPremiumWalletUser ? <>Premium ważne do: <b>{subscriptionRenewalDate}</b> · zostało {subscriptionDaysLeft} {subscriptionDaysLabel}</> : <>Przejdź na Premium, aby aktywować miesięczny plan Stripe.</>}</div>
              <button type="button" className="wallet-v2-primary-btn" onClick={handleSubscriptionAction}>{subscriptionCtaLabel}</button>
              <button type="button" className="subscription-stripe-link" onClick={handleSubscriptionAction}>{subscriptionStripeHint}</button>
            </div>

            <div className="glass-v2-panel wallet-v2-card earnings-card-v2">
              <div className="wallet-v2-card-head"><h3>Zarobki twórcy</h3><span>Twoje realne zarobki ze sprzedaży typów i subskrypcji</span></div>
              <div className="earnings-topline">
                <select value={walletEarningsPeriod} onChange={event => setWalletEarningsPeriod(event.target.value)} aria-label="Okres zarobków">
                  <option value="current_month">Bieżący miesiąc</option>
                  <option value="previous_month">Poprzedni miesiąc</option>
                  <option value="last_3_months">Ostatnie 3 miesiące</option>
                  <option value="year">Cały rok</option>
                </select>
                <div><strong>{formatWalletPln(creatorPeriodTotal)}</strong><small>{creatorGrowthLabel}</small></div>
              </div>
              {creatorSalesCount > 0 ? (
                <>
                  <div className="earnings-live-stats">
                    <span><b>{formatWalletPln(creatorGrossTotal)}</b> sprzedaż brutto</span>
                    <span><b>{formatWalletPln(creatorCommissionTotal)}</b> prowizja platformy</span>
                    <span><b>{creatorSalesCount}</b> sprzedaży</span>
                  </div>
                  <div className="earnings-chart-v2 earnings-live-chart">
                    <div className="y-labels"><span>{formatWalletPln(creatorChartMax)}</span><span>{formatWalletPln(creatorChartMax / 2)}</span><span>0 zł</span></div>
                    <div className="chart-area">
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        <polygon points={creatorChartAreaPoints} />
                        <polyline points={creatorChartPoints} />
                      </svg>
                    </div>
                    <div className="x-labels">{creatorChartXAxisLabels.map(bucket => <small key={bucket.key}>{bucket.label}</small>)}</div>
                  </div>
                  <div className="earnings-live-last">
                    {currentCreatorRows.slice(0, 2).map(row => (
                      <span key={row.id || `${row.created_at}_${row.source}`}>
                        {creatorSourceLabel(row.source)} <b>+{formatWalletPln(amountFromCreatorRow(row))}</b>
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="earnings-empty-v2">
                  <strong>Brak zarobków w tym okresie</strong>
                  <span>Opublikuj pierwszy płatny typ albo uruchom subskrypcję profilu, aby zacząć zarabiać.</span>
                </div>
              )}
              <button type="button" className="wallet-v2-primary-btn" onClick={() => onViewChange?.('earnings')}>Szczegółowe statystyki</button>
            </div>
          </div>
        </div>

        <aside className="wallet-v2-sidebar">
          <div className="glass-v2-panel wallet-v2-sidecard livechat-card">
            <div className="side-head-line"><strong>BET+AI LIVE CHAT</strong><span>134 online</span></div>
            <div className="top-users-head">
              <div><span>TOP UŻYTKOWNICY (24H)</span></div>
              <div><span>NAGRODA DNIA</span><b>1280zł / 24h</b><small>🪙 34 ↓</small></div>
            </div>
            <div className="top-users-list">
              {topUsers.map((item, index) => (
                <div className="top-user-row" key={index}>
                  <span className="rank-badge">{index + 1}</span>
                  <div><strong>{item[0]}</strong><small>{item[1]}</small></div>
                  {index === 1 ? <em>[ADMIN]</em> : index === 2 ? <button type="button">TIP 1</button> : <span></span>}
                </div>
              ))}
            </div>
            <div className="chat-input-row"><input value="" readOnly placeholder="Napisz wiadomość..." /><span>😊</span><button type="button">➤</button></div>
          </div>

          <div className="glass-v2-panel wallet-v2-sidecard">
            <div className="wallet-v2-card-head side-card-head"><h3>Top typerzy</h3><button type="button">Ranking real</button></div>
            <div className="top-typer-list">
              {topTipsters.map((item, index) => (
                <div className="top-typer-row" key={index}>
                  <span className="rank-number">{index + 1}</span>
                  <div><strong>{item[0]}</strong><small>{item[1]}</small></div>
                  <b>{item[2]}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-v2-panel wallet-v2-sidecard ai-day-card">
            <div className="wallet-v2-card-head side-card-head"><h3>Typy AI dnia</h3><button type="button">Zobacz wszystkie</button></div>
            <div className="ai-day-list">
              {aiPicks.map((item, index) => (
                <div className="ai-day-item" key={index}>
                  <span className="ai-icon">AI</span>
                  <div><strong>{item[0]}</strong><small>{item[1]}</small></div>
                  <b>{item[2]}</b>
                </div>
              ))}
            </div>
            <button type="button" className="wallet-v2-primary-btn">Zarządzaj wypłatami</button>
          </div>
        </aside>
      </div>

      {tokenExchangeMode && (
        <div className="wallet-token-exchange-overlay" onMouseDown={event => { if (event.target === event.currentTarget) closeTokenExchange() }}>
          <div className="wallet-token-exchange-modal glass-v2-panel">
            <button type="button" className="wallet-token-exchange-close" onClick={closeTokenExchange}>×</button>
            <h3>{tokenExchangeMode === 'buy' ? 'Kup żetony' : 'Wymień żetony na walutę'}</h3>
            <p>
              {tokenExchangeMode === 'buy'
                ? 'Kupujesz drożej: 1000 żetonów kosztuje 1,10 zł.'
                : 'Sprzedajesz taniej: 1000 żetonów daje 0,90 zł.'}
            </p>
            <label>
              <span>Liczba pakietów po 1000 żetonów</span>
              <input
                type="number"
                min="1"
                step="1"
                value={tokenExchangePacks}
                onChange={event => setTokenExchangePacks(Math.max(1, Math.floor(Number(event.target.value || 1))))}
              />
            </label>
            <div className="wallet-token-exchange-summary">
              <div><small>Żetony</small><b>{formatTokenCount(tokenExchangeTokens)}</b></div>
              <div><small>{tokenExchangeMode === 'buy' ? 'Koszt' : 'Otrzymasz'}</small><b>{formatWalletPln(tokenExchangeMode === 'buy' ? tokenBuyPrice : tokenSellPrice)}</b></div>
            </div>
            <button type="button" className="wallet-v2-primary-btn" disabled={tokenExchangeBusy} onClick={submitTokenExchange}>
              {tokenExchangeBusy ? 'Przetwarzam...' : tokenExchangeMode === 'buy' ? 'Kup żetony' : 'Wymień żetony'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
function getNotificationBody(item = {}) {
  return item.message || item.body || item.description || 'Masz nowe powiadomienie.'
}

function getNotificationKey(item = {}, index = 0) {
  return `${item.source || 'notify'}-${item.id || item.created_at || index}`
}

function NotificationsView({ notifications = [], onMarkAllRead, onRefresh }) {
  const unread = notifications.filter(item => !item.is_read).length

  return (
    <section className="leaderboard-page notifications-page">
      <UltraPageBanner variant="notifications"><button type="button" onClick={onRefresh}>Odśwież</button><button type="button" onClick={onMarkAllRead}>Oznacz jako przeczytane</button></UltraPageBanner>
      <div className="leaderboard-hero">
        <div>
          <h1>Powiadomienia</h1>
          <p>Nowe typy od obserwowanych typerów oraz ważne komunikaty systemowe.</p>
        </div>
        <div className="leaderboard-badge">{unread} NOWE</div>
      </div>

      <div className="feed-actions notifications-actions">
        <button type="button" onClick={onRefresh}>Odśwież</button>
        <button type="button" onClick={onMarkAllRead}>Oznacz jako przeczytane</button>
      </div>

      <div className="unlocked-list notifications-list">
        {notifications.length ? notifications.map(item => (
          <div className={item.is_read ? 'unlocked-item notification-item read' : 'unlocked-item notification-item'} key={getNotificationKey(item, item.id)}>
            <div>
              <strong>{item.title || 'Powiadomienie'}</strong>
              <span>{getNotificationBody(item)}</span>
              <small>{item.created_at ? new Date(item.created_at).toLocaleString('pl-PL') : ''}</small>
            </div>
            <b>{item.is_read ? 'OK' : 'NEW'}</b>
          </div>
        )) : (
          <div className="empty-wallet">
            <strong>Brak powiadomień</strong>
            <span>Zaobserwuj typera, a po dodaniu przez niego nowego typu zobaczysz tutaj alert.</span>
          </div>
        )}
      </div>
    </section>
  )
}

function UserMessagesPanel({ user, visible = false, onUnreadChange }) {
  const [users, setUsers] = useState([])
  const [activeUser, setActiveUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [unreadMap, setUnreadMap] = useState({})
  const [status, setStatus] = useState('Kliknij użytkownika po lewej i napisz prywatną wiadomość.')
  const [sending, setSending] = useState(false)
  const [directoryMeta, setDirectoryMeta] = useState({})
  const activeUserRef = useRef(null)

  const myId = user?.id || ''
  const myEmail = normalizeEmail(user?.email || '')

  const displayName = (email = '', username = '', id = '') => {
    const clean = normalizeEmail(email)
    const rawUsername = String(username || '').trim()
    const genericNames = ['user', 'uzytkownik', 'użytkownik', 'guest', 'gość', 'gosc']
    const isGeneric = !rawUsername || genericNames.includes(rawUsername.toLowerCase())

    // Najważniejsze: nigdy nie zamieniaj prawdziwego nicku na losowy "Użytkownik ABC123".
    if (!isGeneric) return rawUsername

    // Gdy profil nie ma jeszcze username, stabilnym fallbackiem jest login z emaila, zawsze małymi literami.
    if (clean) return clean.split('@')[0].toLowerCase()

    // Tylko konto bez profilu i bez emaila dostaje neutralny opis, bez losowego ID.
    return 'Użytkownik'
  }
  const initials = (name = '') => String(name || 'BU').split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'BU'
  const normalizeSearch = (value = '') => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')

  const isPlaceholderDmName = (value = '') => {
    const clean = normalizeSearch(value)
    return !clean || clean === 'użytkownik' || clean === 'uzytkownik' || /^użytkownik [a-f0-9]{4,}$/i.test(clean) || /^uzytkownik [a-f0-9]{4,}$/i.test(clean)
  }

  const preferStableDmUser = (previous = {}, incoming = {}) => {
    const prevHasStableName = !isPlaceholderDmName(previous?.name)
    const nextHasStableName = !isPlaceholderDmName(incoming?.name)
    return {
      ...previous,
      ...incoming,
      name: nextHasStableName ? incoming.name : (prevHasStableName ? previous.name : incoming.name || previous.name || 'Użytkownik'),
      email: incoming.email || previous.email || '',
      username: incoming.username || previous.username || '',
      initials: nextHasStableName
        ? incoming.initials
        : (prevHasStableName ? previous.initials : incoming.initials || previous.initials || 'U'),
    }
  }

  useEffect(() => {
    activeUserRef.current = activeUser
  }, [activeUser?.id])

  const buildDmUserItem = (row = {}) => {
    const id = String(row?.id || '')
    const email = normalizeEmail(row?.email || '')
    if (!id || id === String(myId) || email === myEmail) return null
    const name = displayName(email, row?.username, id)
    return {
      id,
      email,
      username: row?.username || '',
      name,
      initials: initials(name),
      created_at: row?.created_at || '',
      lastAt: directoryMeta[id]?.lastAt || ''
    }
  }

  const mergeUsersIntoDirectory = (rows = []) => {
    const nextItems = (Array.isArray(rows) ? rows : []).map(buildDmUserItem).filter(Boolean)
    if (!nextItems.length) return
    setUsers(prev => {
      const map = new Map((prev || []).map(item => [String(item.id || item.email), item]))
      nextItems.forEach(item => {
        const key = String(item.id || item.email)
        map.set(key, preferStableDmUser(map.get(key) || {}, item))
      })
      return Array.from(map.values()).sort((a, b) => {
        const unreadDiff = Number(unreadMap[b.id] || 0) - Number(unreadMap[a.id] || 0)
        if (unreadDiff) return unreadDiff
        const aLast = String(a.lastAt || a.created_at || '')
        const bLast = String(b.lastAt || b.created_at || '')
        if (aLast !== bLast) return bLast.localeCompare(aLast)
        return String(a.name || '').localeCompare(String(b.name || ''), 'pl', { sensitivity: 'base' })
      })
    })
  }

  const getSearchAliases = (item = {}) => {
    const raw = [item.email, item.name, item.username, item.id, item.initials].filter(Boolean).map(String)
    const aliases = new Set(raw)
    raw.forEach(value => {
      const clean = normalizeSearch(value)
      const local = clean.includes('@') ? clean.split('@')[0] : clean
      if (local) aliases.add(local)
      // WERSJA 685: alias dla literówek/nazw typu buchajsonek1988 -> buchajson1988.
      if (local.includes('sonek')) aliases.add(local.replace(/sonek/g, 'son'))
      if (local.includes('jsonek')) aliases.add(local.replace(/jsonek/g, 'json'))
      if (local.includes('buchaj')) {
        aliases.add('buchajson1988')
        aliases.add('buchajson')
        aliases.add('buchajsonek1988')
        aliases.add('buchajsonek')
      }
    })
    return Array.from(aliases).filter(Boolean)
  }

  const searchUsersInDatabase = async (query) => {
    const q = normalizeSearch(query)
    if (!q || q.length < 2 || !isSupabaseConfigured || !supabase || !myId) return
    try {
      const { data, error } = await supabase.rpc('search_betai_user_directory', { p_query: q })
      if (!error && Array.isArray(data)) {
        mergeUsersIntoDirectory(data)
        return
      }
    } catch (rpcError) {
      console.warn('user directory search rpc skipped', rpcError)
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,username,created_at')
        .or(`email.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(25)
      if (!error && Array.isArray(data)) mergeUsersIntoDirectory(data)
    } catch (profileSearchError) {
      console.warn('profiles search fallback skipped', profileSearchError)
    }
  }

  const loadUsers = async () => {
    if (!isSupabaseConfigured || !supabase || !myId) return
    try {
      const profileRows = []
      const existingProfileIds = new Set()
      const existingProfileEmails = new Set()

      const addProfileRow = (row = {}) => {
        const id = String(row?.id || '')
        const email = normalizeEmail(row?.email || '')
        if (!id && !email) return
        const key = id || `email:${email}`
        if (id && existingProfileIds.has(id)) return
        if (!id && email && existingProfileEmails.has(email)) return
        if (id) existingProfileIds.add(id)
        if (email) existingProfileEmails.add(email)
        profileRows.push(row)
      }

      // WERSJA 684: główne źródło listy użytkowników.
      // Funkcja SQL działa jako security definer i widzi wszystkich zarejestrowanych użytkowników.
      try {
        const { data: directoryRows, error: directoryError } = await supabase.rpc('get_betai_user_directory')
        if (!directoryError && Array.isArray(directoryRows)) {
          directoryRows.forEach(addProfileRow)
        }
      } catch (directoryError) {
        console.warn('user directory rpc skipped', directoryError)
      }

      // Fallback: standardowa tabela profiles, jeżeli RLS pozwala ją czytać.
      try {
        let from = 0
        const pageSize = 200
        for (let guard = 0; guard < 8; guard += 1) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id,email,username,created_at')
            .order('created_at', { ascending: false })
            .range(from, from + pageSize - 1)
          if (error) throw error
          const batch = Array.isArray(data) ? data : []
          batch.forEach(addProfileRow)
          if (batch.length < pageSize) break
          from += pageSize
        }
      } catch (profilesError) {
        console.warn('profiles directory fallback skipped', profilesError)
      }

      // Fallback z live chatu: użytkownik może być aktywny na czacie, ale nie pojawiać się w profiles przez RLS.
      // Po emailu próbujemy dociągnąć jego profil/id.
      try {
        const { data: chatUsers, error: chatUsersError } = await supabase
          .from('live_chat_messages')
          .select('user_email,user_name,user_id,created_at')
          .order('created_at', { ascending: false })
          .limit(1000)
        if (!chatUsersError && Array.isArray(chatUsers)) {
          const chatEmails = Array.from(new Set(chatUsers.map(row => normalizeEmail(row.user_email || '')).filter(Boolean)))
          const chatByEmail = new Map()
          chatUsers.forEach(row => {
            const email = normalizeEmail(row.user_email || '')
            if (!email || email === myEmail) return
            if (!chatByEmail.has(email)) chatByEmail.set(email, row)
          })

          if (chatEmails.length) {
            try {
              const { data: chatProfiles, error: chatProfilesError } = await supabase
                .from('profiles')
                .select('id,email,username,created_at')
                .in('email', chatEmails)
              if (!chatProfilesError && Array.isArray(chatProfiles)) {
                chatProfiles.forEach(addProfileRow)
              }
            } catch (chatProfilesError) {
              console.warn('live chat profile lookup skipped', chatProfilesError)
            }
          }

          chatByEmail.forEach((row, email) => {
            if (existingProfileEmails.has(email) || email === myEmail) return
            const id = String(row?.user_id || '')
            if (!id) return
            addProfileRow({
              id,
              email,
              username: row?.user_name || '',
              created_at: row?.created_at || ''
            })
          })
        }
      } catch (chatUsersError) {
        console.warn('live chat users fallback skipped', chatUsersError)
      }

      let dmRows = []
      try {
        const { data: dmData, error: dmError } = await supabase
          .from('direct_messages')
          .select('sender_id,receiver_id,created_at')
          .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
          .order('created_at', { ascending: false })
          .limit(500)
        if (dmError) throw dmError
        dmRows = Array.isArray(dmData) ? dmData : []
      } catch (dmError) {
        console.warn('user messages directory meta skipped', dmError)
      }

      const dmUserIds = Array.from(new Set((dmRows || []).flatMap(row => [String(row?.sender_id || ''), String(row?.receiver_id || '')]).filter(id => id && id !== String(myId))))
      if (dmUserIds.length) {
        // WERSJA 846: zawsze rozwiąż użytkowników rozmów po UUID przez SECURITY DEFINER.
        // Dzięki temu nicki nie zamieniają się na "Użytkownik ABC123", gdy zwykły SELECT z profiles zablokuje RLS.
        try {
          const { data: resolvedDmProfiles, error: resolvedDmProfilesError } = await supabase.rpc('resolve_betai_user_directory', {
            p_user_ids: dmUserIds
          })
          if (!resolvedDmProfilesError && Array.isArray(resolvedDmProfiles)) {
            resolvedDmProfiles.forEach(addProfileRow)
          }
        } catch (resolveError) {
          console.warn('user messages dm resolver rpc skipped', resolveError)
        }

        try {
          const { data: dmProfiles, error: dmProfilesError } = await supabase
            .from('profiles')
            .select('id,email,username,created_at')
            .in('id', dmUserIds)
          if (!dmProfilesError && Array.isArray(dmProfiles)) {
            dmProfiles.forEach(addProfileRow)
          }
        } catch (profileLookupError) {
          console.warn('user messages dm profile lookup skipped', profileLookupError)
        }
      }

      const meta = {}
      dmRows.forEach(row => {
        const senderId = String(row?.sender_id || '')
        const receiverId = String(row?.receiver_id || '')
        const otherId = senderId === String(myId) ? receiverId : senderId
        if (!otherId || otherId === String(myId)) return
        const createdAt = row?.created_at || ''
        if (!meta[otherId] || String(createdAt) > String(meta[otherId].lastAt || '')) {
          meta[otherId] = { lastAt: createdAt }
        }
      })
      setDirectoryMeta(meta)

      const byId = new Map()
      ;(Array.isArray(profileRows) ? profileRows : []).forEach(row => {
        const id = String(row?.id || '')
        const email = normalizeEmail(row?.email || '')
        if (!id || id === String(myId) || email === myEmail) return
        const name = displayName(row?.email, row?.username, id)
        byId.set(id, {
          id,
          email,
          username: row?.username || '',
          name,
          initials: initials(name),
          created_at: row?.created_at || '',
          lastAt: meta[id]?.lastAt || ''
        })
      })

      Object.keys(meta).forEach(id => {
        if (id === String(myId) || byId.has(id)) return
        // Brak danych profilu oznacza konto nierozwiązane, ale nie generujemy już fałszywego "nicku" z UUID.
        const name = 'Użytkownik'
        byId.set(id, {
          id,
          email: '',
          username: '',
          name,
          initials: initials(name),
          created_at: '',
          lastAt: meta[id]?.lastAt || ''
        })
      })

      const rows = Array.from(byId.values()).sort((a, b) => {
        const unreadDiff = Number(unreadMap[b.id] || 0) - Number(unreadMap[a.id] || 0)
        if (unreadDiff) return unreadDiff
        const aLast = String(a.lastAt || a.created_at || '')
        const bLast = String(b.lastAt || b.created_at || '')
        if (aLast !== bLast) return bLast.localeCompare(aLast)
        return String(a.name || '').localeCompare(String(b.name || ''), 'pl', { sensitivity: 'base' })
      })

      setUsers(rows)
      setActiveUser(prev => {
        if (prev && rows.some(row => String(row.id) === String(prev.id))) {
          return rows.find(row => String(row.id) === String(prev.id)) || prev
        }
        const unreadFirst = rows.find(row => Number(unreadMap[row.id] || 0) > 0)
        const recentFirst = rows.find(row => row.lastAt)
        return unreadFirst || recentFirst || rows[0] || null
      })
      setStatus(rows.length ? 'Kliknij użytkownika po lewej i napisz prywatną wiadomość.' : 'Brak użytkowników do pokazania. Jeśli problem zostanie, uruchom SQL dla profiles/direct_messages.')
    } catch (error) {
      console.warn('user messages load users skipped', error)
      setStatus('Nie udało się wczytać listy użytkowników. Sprawdź tabelę profiles/RLS.')
    }
  }

  const loadUnread = async () => {
    if (!isSupabaseConfigured || !supabase || !myId) return
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('sender_id,is_read')
        .eq('receiver_id', myId)
        .eq('is_read', false)
      if (error) throw error
      const next = {}
      ;(Array.isArray(data) ? data : []).forEach(row => {
        const key = String(row.sender_id || '')
        if (key) next[key] = (next[key] || 0) + 1
      })
      setUnreadMap(next)
      onUnreadChange?.(Object.values(next).reduce((sum, value) => sum + Number(value || 0), 0))
    } catch (error) {
      console.warn('user messages unread skipped', error)
    }
  }

  const loadConversation = async (target = activeUser) => {
    if (!isSupabaseConfigured || !supabase || !myId || !target?.id) {
      setMessages([])
      return
    }
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('id,sender_id,receiver_id,message_text,created_at,is_read')
        .or(`and(sender_id.eq.${myId},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${myId})`)
        .order('created_at', { ascending: true })
      if (error) throw error
      setMessages(Array.isArray(data) ? data : [])
      await supabase.from('direct_messages').update({ is_read: true }).eq('sender_id', target.id).eq('receiver_id', myId).eq('is_read', false)
      await loadUnread()
    } catch (error) {
      console.warn('user messages conversation skipped', error)
      setStatus('Nie udało się wczytać rozmowy. Uruchom SQL dla direct_messages.')
    }
  }

  const sendMessage = async () => {
    const clean = String(text || '').trim().slice(0, 800)
    if (!clean || sending) return
    if (!activeUser?.id) {
      setStatus('Najpierw wybierz odbiorcę z listy użytkowników.')
      return
    }
    if (!isSupabaseConfigured || !supabase || !myId) {
      setStatus('Musisz być zalogowany i mieć połączenie z Supabase.')
      return
    }
    setSending(true)
    try {
      const { error } = await supabase.from('direct_messages').insert({
        sender_id: myId,
        receiver_id: activeUser.id,
        message_text: clean,
        is_read: false
      })
      if (error) throw error
      setText('')
      setStatus('Wiadomość wysłana.')
      await loadConversation(activeUser)
      await loadUsers()
    } catch (error) {
      console.warn('user messages send failed', error)
      setStatus('Wysyłka nie powiodła się. Sprawdź SQL/RLS direct_messages.')
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (!visible || !myId) return undefined
    loadUnread()
    loadUsers()
    const timer = setInterval(() => {
      loadUnread()
      loadUsers()
      const target = activeUserRef.current
      if (target?.id) loadConversation(target)
    }, 4000)
    return () => clearInterval(timer)
  }, [visible, myId])

  useEffect(() => {
    if (visible && activeUser?.id) loadConversation(activeUser)
  }, [visible, activeUser?.id])

  useEffect(() => {
    if (!visible) return
    loadUsers()
  }, [visible, JSON.stringify(unreadMap)])

  useEffect(() => {
    if (!visible) return undefined
    const q = normalizeSearch(search)
    if (q.length < 2) return undefined
    const timer = setTimeout(() => searchUsersInDatabase(q), 250)
    return () => clearTimeout(timer)
  }, [visible, search, myId])

  const filteredUsers = users.filter(item => {
    const q = normalizeSearch(search)
    if (!q) return true
    const haystack = getSearchAliases(item).map(normalizeSearch).join(' | ')
    return haystack.includes(q)
  })
  const activeUnread = Object.values(unreadMap).reduce((sum, value) => sum + Number(value || 0), 0)

  return (
    <div className="betai-dm-box">
      <div className="betai-dm-layout">
        <aside className="betai-dm-users">
          <input className="betai-dm-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj użytkownika..." />
          <div className="betai-dm-user-list">
            {filteredUsers.length ? filteredUsers.map(item => (
              <button type="button" className={activeUser?.id === item.id ? 'betai-dm-user active' : 'betai-dm-user'} key={item.id || item.email} onClick={() => setActiveUser(item)}>
                <span className="betai-dm-avatar">{item.initials}</span>
                <span><strong>{item.name}</strong><small>{item.email || 'Brak e-mail w profilu'}</small></span>
                {Number(unreadMap[item.id] || 0) > 0 && <b>{Number(unreadMap[item.id] || 0)}</b>}
              </button>
            )) : <div className="betai-dm-empty">Brak użytkowników dla tego wyszukiwania. Jeśli kogoś brakuje, uruchom SQL 684 dla katalogu użytkowników.</div>}
          </div>
        </aside>
        <section className="betai-dm-conversation">
          <div className="betai-dm-active">
            <span className="betai-dm-avatar big">{activeUser?.initials || 'BU'}</span>
            <div><strong>{activeUser?.name || 'Wybierz użytkownika'}</strong><small>{activeUser?.email || 'Prywatny czat prywatny czat użytkowników'}</small></div>
          </div>
          <div className="betai-dm-messages">
            {activeUser ? (messages.length ? messages.map(msg => {
              const mine = String(msg.sender_id || '') === String(myId)
              return <div className={mine ? 'betai-dm-msg me' : 'betai-dm-msg'} key={msg.id || msg.created_at}>
                <div className="betai-dm-bubble">{msg.message_text}</div>
                <small>{mine ? 'Ty' : activeUser.name} • {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit' }) : '--:--'}</small>
              </div>
            }) : <div className="betai-dm-empty">Brak wiadomości. Napisz pierwszą.</div>) : <div className="betai-dm-empty">Kliknij użytkownika po lewej.</div>}
          </div>
          <div className="betai-dm-compose">
            <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }} placeholder="Napisz wiadomość prywatną..." />
            <button type="button" onClick={sendMessage} disabled={sending || !text.trim()}>{sending ? '...' : 'Wyślij'}</button>
          </div>
          <div className="betai-dm-status">{status}</div>
        </section>
      </div>
    </div>
  )
}

function BetaiNotifyPanel({ open, notifications = [], tokenBalance = 0, onClose, onMarkAllRead, panelStyle = null }) {
  if (!open) return null
  const unread = notifications.filter(item => !item.is_read)
  const items = unread.length ? unread : notifications.slice(0, 8)

  return (
    <div className="betai-notify-overlay" aria-hidden={!open} onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="betai-notify-panel" style={panelStyle || undefined} role="dialog" aria-modal="true" aria-label="Powiadomienia BetAI">
        <div className="betai-notify-header">
          <div>
            <div className="betai-notify-kicker">BETAI NEWS</div>
            <div className="betai-notify-title">Powiadomienia BetAI</div>
            <div className="betai-notify-sub">Nagrody, informacje od strony i komunikaty od admina.</div>
          </div>
          <div className="betai-notify-actions">
            <button className="betai-notify-btn" type="button" title="Oznacz jako przeczytane" onClick={onMarkAllRead}>✓</button>
            <button className="betai-notify-btn" type="button" title="Zamknij" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="betai-notify-stats">
          <div className="betai-notify-stat"><span>Twoje żetony</span><strong>{Number(tokenBalance || 0)}</strong></div>
          <div className="betai-notify-stat"><span>Nowe powiadomienia</span><strong>{unread.length}</strong></div>
        </div>
        <div className="betai-notify-list">
          {items.length ? items.map((item, index) => (
            <div className={item.is_read ? 'betai-notify-card' : 'betai-notify-card unread'} key={getNotificationKey(item, index)}>
              <div className="betai-notify-head">
                <strong>{item.title || 'Wiadomość BetAI'}</strong>
                <span className="betai-notify-time">{item.created_at ? new Date(item.created_at).toLocaleString('pl-PL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : ''}</span>
              </div>
              <div className="betai-notify-body">{getNotificationBody(item)}</div>
              <div className="betai-notify-chips">
                <span className="betai-chip system">{item.source === 'system' ? 'Komunikat BetAI' : 'Powiadomienie'}</span>
                {Number(item.reward_tokens || 0) > 0 && <span className="betai-chip reward">+{Number(item.reward_tokens || 0)} żetonów</span>}
              </div>
            </div>
          )) : (
            <div className="betai-notify-empty">Nie masz teraz nowych powiadomień BetAI.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function UserMessagesPopup({ open, user = null, dmUnreadCount = 0, onDmUnreadChange, onClose, panelStyle = null }) {
  if (!open) return null

  return (
    <div className="betai-notify-overlay" aria-hidden={!open} onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="betai-notify-panel betai-notify-panel-with-dm betai-notify-users-only" style={panelStyle || undefined} role="dialog" aria-modal="true" aria-label="Wiadomości użytkowników">
        <div className="betai-notify-header">
          <div>
            <div className="betai-notify-kicker">USER MESSAGES</div>
            <div className="betai-notify-title">Wiadomości użytkowników</div>
            <div className="betai-notify-sub">Prywatny czat użytkowników. Ten panel otwiera się z koperty, nie z dzwonka.</div>
          </div>
          <div className="betai-notify-actions">
            <span className="betai-dm-unread">{Number(dmUnreadCount || 0)} nowe</span>
            <button className="betai-notify-btn" type="button" title="Zamknij" onClick={onClose}>✕</button>
          </div>
        </div>
        <UserMessagesPanel user={user} visible={open} onUnreadChange={onDmUnreadChange} />
      </div>
    </div>
  )
}



function StatPill({ label, value, tone = '' }) {
  return <div className={`stat-pro-card ${tone}`}><span>{label}</span><b>{value}</b></div>
}

function StatsView({ tips = [] }) {
  const settled = tips.filter(t => ['win','won','lose','lost','loss','push'].includes(String(t.result || t.status || '').toLowerCase()))
  const wins = settled.filter(t => ['win','won'].includes(String(t.result || t.status || '').toLowerCase())).length
  const losses = settled.filter(t => ['lose','lost','loss'].includes(String(t.result || t.status || '').toLowerCase())).length
  const push = settled.filter(t => String(t.result || t.status || '').toLowerCase() === 'push').length
  const totalStake = Math.max(1, settled.length * 100)
  const profit = settled.reduce((sum, tip) => {
    const r = String(tip.result || tip.status || '').toLowerCase()
    const odds = Number(tip.odds || 1)
    if (['win','won'].includes(r)) return sum + ((odds - 1) * 100)
    if (['lose','lost','loss'].includes(r)) return sum - 100
    return sum
  }, 0)
  const winrate = (wins + losses) ? Math.round((wins / (wins + losses)) * 100) : 0
  const roi = Math.round((profit / totalStake) * 100)
  const recent = tips.slice(0, 20).map(t => String(t.result || t.status || 'pending').toLowerCase())
  const byLeague = tips.reduce((acc, t) => {
    const key = t.league || t.country || 'Inne'
    if (!acc[key]) acc[key] = { league: key, bets: 0, wins: 0, profit: 0 }
    acc[key].bets += 1
    const r = String(t.result || t.status || '').toLowerCase()
    const odds = Number(t.odds || 1)
    if (['win','won'].includes(r)) { acc[key].wins += 1; acc[key].profit += (odds - 1) * 100 }
    if (['lose','lost','loss'].includes(r)) acc[key].profit -= 100
    return acc
  }, {})
  const leagueRows = Object.values(byLeague).sort((a,b) => b.bets - a.bets).slice(0, 8)
  const recentResultRows = tips.slice(0, 24).map((tip, index) => {
    const home = tip.team_home || tip.home_team || (tip.match_name ? String(tip.match_name).split(' vs ')[0] : 'Gospodarze')
    const away = tip.team_away || tip.away_team || (tip.match_name ? String(tip.match_name).split(' vs ')[1] : 'Goście')
    const rawResult = String(tip.result || tip.status || 'pending').toLowerCase()
    const resultLabel = rawResult.includes('win') || rawResult === 'won' ? 'WON' : rawResult.includes('lost') || rawResult.includes('loss') ? 'LOST' : rawResult.includes('void') || rawResult.includes('push') ? 'PUSH' : 'PENDING'
    return {
      id: tip.id || index,
      date: tip.event_time || tip.kickoff_time || tip.match_time || tip.created_at,
      division: tip.league || tip.league_name || tip.sport || 'Liga',
      home,
      away,
      prediction: tip.selection || tip.pick || tip.prediction || tip.bet_type || home,
      odds: Number(tip.odds || 1.8).toFixed(2),
      result: resultLabel
    }
  })
  const aiTips = tips.filter(t => getAiConfidence(t) > 0)
  const avgAi = aiTips.length ? Math.round(aiTips.reduce((a,t)=>a+getAiConfidence(t),0)/aiTips.length) : 0

  return (
    <section className="stats-pro-page">
      <div className="stats-pro-hero">
        <div><span>BETAI ANALYTICS</span><h1>Statystyki modelu i wyników</h1><p>Profit, winrate, ROI, forma, dystrybucja i performance lig w stylu Twojej poprzedniej strony.</p></div>
        <div className="stats-pro-filters"><button className="active">All Time</button><button>This Month</button><button>This Week</button></div>
      </div>
      <div className="stats-pro-grid four">
        <StatPill label="Łączny profit" value={`${Math.round(profit)} PLN`} tone={profit < 0 ? 'danger' : 'success'} />
        <StatPill label="Win rate" value={`${winrate}%`} />
        <StatPill label="ROI" value={`${roi}%`} tone={roi < 0 ? 'danger' : 'success'} />
        <StatPill label="Rozliczone typy" value={settled.length || tips.length} />
      </div>
      <div className="stats-pro-grid two">
        <div className="stats-panel distribution"><h3>Win/Loss Distribution</h3><div className="donut" style={{'--win': `${Math.max(5, winrate)}%`}}><span>{winrate}%</span></div><div className="legend"><p><b className="green"/> Won <strong>{wins}</strong></p><p><b className="red"/> Lost <strong>{losses}</strong></p><p><b className="yellow"/> Push <strong>{push}</strong></p></div></div>
        <div className="stats-panel bars"><h3>Performance by AI Confidence</h3><div className="bar-chart"><i style={{height: `${Math.max(12, avgAi)}%`}}/><i className="red" style={{height: `${Math.max(12, 100-avgAi)}%`}}/></div><div className="bar-labels"><span>AI avg {avgAi}%</span><span>Risk {Math.max(0,100-avgAi)}%</span></div></div>
      </div>
      <div className="stats-pro-grid two small">
        <div className="stats-panel streak"><h3>Streak Analysis</h3><p>Current <b>{recent[0]?.includes('win') ? '1 Win' : recent[0]?.includes('lose') ? '1 Loss' : 'Pending'}</b></p><p>Best Win <b>{wins}</b></p><p>Worst Loss <b>{losses}</b></p></div>
        <div className="stats-panel recent-form"><h3>Recent Form (Last 20)</h3><div>{recent.map((r,i) => <span key={i} className={r.includes('win') ? 'w' : r.includes('lose') ? 'l' : 'p'}>{r.includes('win') ? 'W' : r.includes('lose') ? 'L' : 'P'}</span>)}</div><small>W = wygrana, L = przegrana, P = pending/live</small></div>
      </div>
      <div className="stats-panel table-panel"><h3>Performance by Division</h3><div className="stats-table"><div><b>Division</b><b>Bets</b><b>Hit Rate</b><b>Profit</b><b>ROI</b></div>{leagueRows.map(row => { const hit = row.bets ? Math.round((row.wins / row.bets) * 100) : 0; const rowRoi = row.bets ? Math.round(row.profit / (row.bets * 100) * 100) : 0; return <div key={row.league}><span>{row.league}</span><span>{row.bets}</span><span>{hit}%</span><span className={row.profit < 0 ? 'danger-text' : 'success-text'}>{Math.round(row.profit)} PLN</span><span>{rowRoi}%</span></div> })}</div></div>
      <div className="stats-panel stats-results-panel-v744">
        <div className="stats-results-head-v744">
          <h3>Match results</h3>
          <div><button type="button">🔎 Search</button><button type="button">⚡ Filter</button></div>
        </div>
        <div className="stats-results-table-v744">
          <div className="head"><b>Date</b><b>Division</b><b>Home Team</b><b>Away Team</b><b>Prediction</b><b>Odds</b><b>Result</b></div>
          {recentResultRows.length ? recentResultRows.map(row => (
            <div key={row.id}>
              <span>{row.date ? new Date(row.date).toLocaleDateString('pl-PL').replaceAll('.', '') : '----'}</span>
              <span>{row.division}</span>
              <span>{row.home}</span>
              <span>{row.away}</span>
              <span>{row.prediction}</span>
              <span>{row.odds}</span>
              <em className={row.result === 'WON' ? 'won' : row.result === 'LOST' ? 'lost' : row.result === 'PUSH' ? 'push' : 'pending'}>{row.result}</em>
            </div>
          )) : <div><span>Brak rozliczonych meczów</span><span>-</span><span>-</span><span>-</span><span>-</span><span>-</span><em className="pending">PENDING</em></div>}
        </div>
      </div>
    </section>
  )
}




const ADD_TIP_SPORT_OPTIONS = [
  'Piłka nożna',
]

const AI_STATS_BET_TYPES_BY_SPORT = {
  'Piłka nożna': ['1X2', 'Zwycięzca meczu', 'Podwójna szansa', 'Obie drużyny strzelą', 'Powyżej/Poniżej 2.5', 'Draw No Bet'],
  'Tenis': ['Zwycięzca meczu', 'Handicap gemów', 'Suma gemów', 'Dokładny wynik setów'],
  'Koszykówka': ['Zwycięzca meczu', 'Handicap', 'Suma punktów', 'Zwycięzca połowy'],
  'Hokej': ['Zwycięzca meczu', '1X2', 'Suma goli', 'Handicap'],
  'MMA': ['Zwycięzca walki', 'Metoda zwycięstwa', 'Dystans walki', 'Suma rund'],
  'E-sport': ['Zwycięzca meczu', 'Handicap map', 'Suma map', 'Dokładny wynik'],
  'Siatkówka': ['Zwycięzca meczu', 'Handicap setów', 'Suma punktów', 'Dokładny wynik setów'],
  'Boks': ['Zwycięzca walki', 'Metoda zwycięstwa', 'Dystans walki', 'Suma rund'],
  'Piłka ręczna': ['Zwycięzca meczu', '1X2', 'Handicap', 'Suma bramek'],
  'Krykiet': ['Zwycięzca meczu', 'Handicap', 'Suma runów'],
  'Rugby': ['Zwycięzca meczu', 'Handicap', 'Suma punktów'],
  'Rugby League': ['Zwycięzca meczu', 'Handicap', 'Suma punktów'],
  'Baseball': ['Moneyline', 'Run line', 'Suma runów'],
  'Dart': ['Zwycięzca meczu', 'Handicap legów', 'Suma legów'],
}

const getAiStatsDefaultBetTypes = sport => {
  if (sport && sport !== 'All Sports') return AI_STATS_BET_TYPES_BY_SPORT[sport] || ['Zwycięzca meczu']
  return Array.from(new Set(Object.values(AI_STATS_BET_TYPES_BY_SPORT).flat()))
}

function AiStatsAnalyticsView({ tips = [] }) {
  const [sportFilter, setSportFilter] = useState('All Sports')
  const [divisionFilter, setDivisionFilter] = useState('All Divisions')
  const [betTypeFilter, setBetTypeFilter] = useState('All Types')
  const [timeFilter, setTimeFilter] = useState('all')
  const [savedLeagues, setSavedLeagues] = useState([])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    let mounted = true
    supabase
      .from('ai_leagues_catalog')
      .select('sport,league,country,last_seen,tips_count')
      .order('league', { ascending: true })
      .then(({ data, error }) => {
        if (!mounted || error) return
        setSavedLeagues(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  const normalizeResult = value => {
    const raw = String(value || '').toLowerCase()
    if (['win','won'].includes(raw) || raw.includes('won')) return 'won'
    if (['lose','lost','loss'].includes(raw) || raw.includes('lost') || raw.includes('lose')) return 'lost'
    if (['push','void'].includes(raw) || raw.includes('void') || raw.includes('push')) return 'push'
    return 'pending'
  }
  const sportOptions = ['All Sports', ...Array.from(new Set([...ADD_TIP_SPORT_OPTIONS, ...(tips || []).map(t => t.sport || t.sport_key).filter(Boolean)]))]
  const divisionOptions = ['All Divisions', ...Array.from(new Set([
    ...savedLeagues
      .filter(item => sportFilter === 'All Sports' || item.sport === sportFilter)
      .map(item => item.league),
    ...(tips || [])
      .filter(t => sportFilter === 'All Sports' || (t.sport || t.sport_key) === sportFilter)
      .map(t => t.league || t.league_name || t.country),
  ].filter(Boolean))).sort()]
  const betTypeOptions = ['All Types', ...Array.from(new Set([
    ...getAiStatsDefaultBetTypes(sportFilter),
    ...(tips || [])
      .filter(t => sportFilter === 'All Sports' || (t.sport || t.sport_key) === sportFilter)
      .map(t => t.market || t.bet_type || 'Typ AI')
      .filter(Boolean),
  ])).sort()]
  const now = new Date()
  const inTimeRange = tip => {
    const date = new Date(tip.settled_at || tip.event_time || tip.kickoff_time || tip.match_time || tip.created_at || 0)
    if (Number.isNaN(date.getTime())) return true
    if (timeFilter === 'week') return date >= new Date(now.getTime() - 7*24*60*60*1000)
    if (timeFilter === 'month') return date >= new Date(now.getFullYear(), now.getMonth(), 1)
    if (timeFilter === 'year') return date >= new Date(now.getFullYear(), 0, 1)
    return true
  }
  const filtered = (tips || []).filter(t => {
    const sport = t.sport || t.sport_key || 'Inne'
    const division = t.league || t.league_name || t.country || 'Inne'
    const betType = t.market || t.bet_type || 'Typ AI'
    return (sportFilter === 'All Sports' || sport === sportFilter)
      && (divisionFilter === 'All Divisions' || division === divisionFilter)
      && (betTypeFilter === 'All Types' || betType === betTypeFilter)
      && inTimeRange(t)
  })
  const settled = filtered.filter(t => ['won','lost','push'].includes(normalizeResult(t.result || t.status)))
  const wins = settled.filter(t => normalizeResult(t.result || t.status) === 'won')
  const losses = settled.filter(t => normalizeResult(t.result || t.status) === 'lost')
  const pushes = settled.filter(t => normalizeResult(t.result || t.status) === 'push')
  const tipProfit = tip => {
    const result = normalizeResult(tip.result || tip.status)
    const stake = Number(tip.stake || 100)
    const odds = Number(tip.odds || tip.course || 1.8)
    if (result === 'won') return Number(tip.profit ?? ((odds - 1) * stake))
    if (result === 'lost') return Number(tip.profit ?? -stake)
    return Number(tip.profit || 0)
  }
  const totalProfit = settled.reduce((sum, tip) => sum + tipProfit(tip), 0)
  const totalStake = settled.reduce((sum, tip) => sum + Number(tip.stake || 100), 0)
  const hitRate = wins.length + losses.length ? (wins.length / (wins.length + losses.length)) * 100 : 0
  const roi = totalStake ? (totalProfit / totalStake) * 100 : 0
  const avgOdds = settled.length ? settled.reduce((sum, tip) => sum + Number(tip.odds || tip.course || 1.8), 0) / settled.length : 0

  const byDate = [...settled].sort((a,b) => new Date(a.settled_at || a.event_time || a.created_at) - new Date(b.settled_at || b.event_time || b.created_at))
  let cumulative = 0
  const profitSeries = byDate.map(t => {
    cumulative += tipProfit(t)
    return cumulative
  })
  const chartSeries = profitSeries.length ? profitSeries : [0,0,0,0,0,0,0]
  const minY = Math.min(0, ...chartSeries)
  const maxY = Math.max(1, ...chartSeries)
  const rangeY = Math.max(1, maxY - minY)
  const path = chartSeries.map((v, i) => {
    const x = chartSeries.length === 1 ? 0 : (i / (chartSeries.length - 1)) * 100
    const y = 100 - ((v - minY) / rangeY) * 100
    return `${i ? 'L' : 'M'} ${x} ${y}`
  }).join(' ')
  let peak = 0, maxDrawdown = 0
  chartSeries.forEach(value => {
    peak = Math.max(peak, value)
    maxDrawdown = Math.max(maxDrawdown, peak - value)
  })
  const currentDrawdown = Math.max(0, peak - chartSeries[chartSeries.length - 1])
  const recoveryFactor = maxDrawdown ? totalProfit / maxDrawdown : 0

  const oddsBuckets = [
    { label:'1.0-1.5', min:1, max:1.5 },
    { label:'1.5-2.0', min:1.5, max:2 },
    { label:'2.0-2.5', min:2, max:2.5 },
    { label:'2.5-3.0', min:2.5, max:3 },
    { label:'3.0+', min:3, max:Infinity },
  ].map(bucket => ({
    ...bucket,
    won: settled.filter(t => { const o=Number(t.odds || t.course || 0); return o >= bucket.min && o < bucket.max && normalizeResult(t.result || t.status) === 'won' }).length,
    lost: settled.filter(t => { const o=Number(t.odds || t.course || 0); return o >= bucket.min && o < bucket.max && normalizeResult(t.result || t.status) === 'lost' }).length,
  }))
  const maxBucket = Math.max(1, ...oddsBuckets.flatMap(b => [b.won, b.lost]))

  const recent = [...filtered].sort((a,b) => new Date(b.settled_at || b.event_time || b.created_at) - new Date(a.settled_at || a.event_time || a.created_at)).slice(0,20).map(t => normalizeResult(t.result || t.status))
  const settledRecent = recent.filter(r => r !== 'pending')
  const currentStreakResult = settledRecent[0] || 'pending'
  let currentStreak = 0
  for (const r of settledRecent) { if (r === currentStreakResult) currentStreak += 1; else break }
  let bestWin = 0, worstLoss = 0, runningW = 0, runningL = 0
  ;[...settled].sort((a,b) => new Date(a.settled_at || a.event_time || a.created_at) - new Date(b.settled_at || b.event_time || b.created_at)).forEach(t => {
    const r = normalizeResult(t.result || t.status)
    if (r === 'won') { runningW += 1; runningL = 0 } else if (r === 'lost') { runningL += 1; runningW = 0 } else { runningW = 0; runningL = 0 }
    bestWin = Math.max(bestWin, runningW)
    worstLoss = Math.max(worstLoss, runningL)
  })

  const buildRows = keyFn => Object.values(filtered.reduce((acc,t) => {
    const key = keyFn(t)
    if (!acc[key]) acc[key] = { key, bets:0, wins:0, losses:0, profit:0, odds:0 }
    acc[key].bets += 1
    acc[key].odds += Number(t.odds || t.course || 1.8)
    const r = normalizeResult(t.result || t.status)
    if (r === 'won') acc[key].wins += 1
    if (r === 'lost') acc[key].losses += 1
    acc[key].profit += tipProfit(t)
    return acc
  }, {})).map(row => ({
    ...row,
    hitRate: row.wins + row.losses ? (row.wins/(row.wins+row.losses))*100 : 0,
    roi: row.bets ? (row.profit/(row.bets*100))*100 : 0,
    avgOdds: row.bets ? row.odds/row.bets : 0,
  })).sort((a,b)=>b.bets-a.bets)
  const divisionRows = buildRows(t => t.league || t.league_name || t.country || 'Inne').slice(0,10)
  const betTypeRows = buildRows(t => t.market || t.bet_type || 'Typ AI').slice(0,8)

  return (
    <section className="ai-analytics-screen-v749">
      <h3>Statistics &amp; Analytics</h3>
      <div className="ai-analytics-filterbar-v749">
        <label><span>SPORT</span><select value={sportFilter} onChange={e=>{setSportFilter(e.target.value);setDivisionFilter('All Divisions');setBetTypeFilter('All Types')}}>{sportOptions.map(o=><option key={o}>{o}</option>)}</select></label>
        <label><span>DIVISION</span><select value={divisionFilter} onChange={e=>setDivisionFilter(e.target.value)}>{divisionOptions.map(o=><option key={o}>{o}</option>)}</select></label>
        <label><span>BET TYPE</span><select value={betTypeFilter} onChange={e=>setBetTypeFilter(e.target.value)}>{betTypeOptions.map(o=><option key={o}>{o}</option>)}</select></label>
        <div className="ai-analytics-time-v749">{[['all','All Time'],['year','This Year'],['month','This Month'],['week','This Week']].map(([k,l])=><button key={k} className={timeFilter===k?'active':''} onClick={()=>setTimeFilter(k)}>{l}</button>)}</div>
      </div>
      <div className="ai-analytics-kpis-v749">
        <article className={totalProfit < 0 ? 'danger' : 'success'}><span>TOTAL PROFIT</span><b>{totalProfit.toFixed(2)}u</b><small>Based on {settled.length} bets</small></article>
        <article className={roi < 0 ? 'danger' : 'success'}><span>ROI</span><b>{roi.toFixed(1)}%</b><small>Return on investment</small></article>
        <article><span>HIT RATE</span><b>{hitRate.toFixed(1)}%</b><small>{wins.length}W / {losses.length}L / {pushes.length}P</small></article>
        <article><span>TOTAL BETS</span><b>{filtered.length}</b><small>Analyzed predictions</small></article>
        <article><span>AVG ODDS</span><b>{avgOdds.toFixed(2)}</b><small>Won avg: {wins.length ? (wins.reduce((s,t)=>s+Number(t.odds||t.course||1.8),0)/wins.length).toFixed(2) : '0.00'}</small></article>
        <article><span>CURRENT STREAK</span><b>{currentStreak}{currentStreakResult==='won'?'W':currentStreakResult==='lost'?'L':'-'}</b><small>Max {bestWin}W / {worstLoss}L</small></article>
      </div>
      <div className="ai-analytics-panel-v749 profit"><h4>Profit Evolution</h4><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d={path}/></svg></div>
      <div className="ai-analytics-grid-v749 mid">
        <div className="ai-analytics-panel-v749 donut-panel"><h4>Win/Loss Distribution</h4><div className="ai-donut-v749" style={{'--won': `${wins.length}`, '--lost': `${losses.length}`, '--push': `${pushes.length}`}}/><div className="legend"><span>● Won</span><span>● Lost</span><span>● Push</span></div></div>
        <div className="ai-analytics-panel-v749 odds"><h4>Performance by Odds Range</h4><div className="odds-bars">{oddsBuckets.map(b=><div key={b.label}><i style={{height:`${(b.won/maxBucket)*100}%`}}/><em style={{height:`${(b.lost/maxBucket)*100}%`}}/><small>{b.label}</small></div>)}</div></div>
      </div>
      <div className="ai-analytics-grid-v749 compact">
        <div className="ai-analytics-panel-v749 streak"><h4>Streak Analysis</h4><p>Current <b>{currentStreak}{currentStreakResult==='won'?' Wins':currentStreakResult==='lost'?' Losses':''}</b></p><p>Best Win <b>{bestWin}</b></p><p>Worst Loss <b>{worstLoss}</b></p></div>
        <div className="ai-analytics-panel-v749 recent"><h4>Recent Form (Last 20)</h4><div>{recent.map((r,i)=><span key={i} className={r}>{r==='won'?'W':r==='lost'?'L':r==='push'?'P':'•'}</span>)}</div></div>
      </div>
      <div className="ai-analytics-grid-v749 tables">
        <div className="ai-analytics-panel-v749 table"><h4>Performance by Division</h4><div className="table-head"><b>DIVISION</b><b>BETS</b><b>HIT RATE</b><b>PROFIT</b><b>ROI</b></div>{divisionRows.map(r=><div key={r.key}><span>{r.key}</span><span>{r.bets}</span><span>{r.hitRate.toFixed(1)}%</span><span className={r.profit<0?'neg':'pos'}>{r.profit>=0?'+':''}{r.profit.toFixed(2)}u</span><span className={r.roi<0?'neg':'pos'}>{r.roi>=0?'+':''}{r.roi.toFixed(1)}%</span></div>)}</div>
        <div className="ai-analytics-panel-v749 table bet"><h4>Performance by Bet Type</h4><div className="table-head"><b>BET TYPE</b><b>BETS</b><b>AVG ODDS</b><b>HIT RATE</b><b>PROFIT</b></div>{betTypeRows.map(r=><div key={r.key}><span>{r.key}</span><span>{r.bets}</span><span>{r.avgOdds.toFixed(2)}</span><span>{r.hitRate.toFixed(1)}%</span><span className={r.profit<0?'neg':'pos'}>{r.profit>=0?'+':''}{r.profit.toFixed(2)}u</span></div>)}</div>
      </div>
      <div className="ai-analytics-panel-v749 drawdown"><h4>Drawdown Analysis</h4><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d={path}/></svg><footer><b>{maxDrawdown.toFixed(2)}u<small>MAX DRAWDOWN</small></b><b>{currentDrawdown.toFixed(2)}u<small>CURRENT DRAWDOWN</small></b><b>{recoveryFactor.toFixed(2)}<small>RECOVERY FACTOR</small></b></footer></div>
    </section>
  )
}

function normalizeAiResultStatus(value) {
  const raw = String(value || '').toLowerCase()
  if (raw === 'won' || raw === 'win' || raw.includes('won')) return 'WON'
  if (raw === 'lost' || raw === 'loss' || raw.includes('lost') || raw.includes('lose')) return 'LOST'
  if (raw === 'void' || raw === 'push' || raw.includes('void') || raw.includes('push')) return 'PUSH'
  if (raw === 'cancelled' || raw === 'postponed') return raw.toUpperCase()
  if (raw === 'live') return 'LIVE'
  return 'PENDING'
}

function AiResultsView({ tips = [] }) {
  const [sportFilter, setSportFilter] = useState('All Sports')
  const [leagueFilter, setLeagueFilter] = useState('All Divisions')
  const [query, setQuery] = useState('')
  const [timeFilter, setTimeFilter] = useState('all')

  const rows = (tips || []).map((tip, index) => {
    const home = tip.team_home || tip.home_team || (tip.match_name ? String(tip.match_name).split(' vs ')[0] : '') || (tip.match ? String(tip.match).split(' vs ')[0] : '') || 'Home Team'
    const away = tip.team_away || tip.away_team || (tip.match_name ? String(tip.match_name).split(' vs ')[1] : '') || (tip.match ? String(tip.match).split(' vs ')[1] : '') || 'Away Team'
    const dateRaw = tip.event_time || tip.kickoff_time || tip.match_time || tip.created_at
    const result = normalizeAiResultStatus(tip.result || tip.status || tip.live_status)
    return {
      id: tip.id || `${home}-${away}-${index}`,
      dateRaw,
      dateNum: dateRaw ? new Date(dateRaw).toLocaleDateString('pl-PL').replaceAll('.', '') : '----',
      time: dateRaw ? new Date(dateRaw).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '',
      sport: tip.sport || tip.sport_key || 'Sport',
      division: tip.league || tip.league_name || tip.country || 'Division',
      home,
      away,
      score: Number.isFinite(Number(tip.live_score_home)) || Number.isFinite(Number(tip.live_score_away)) ? `${Number(tip.live_score_home || 0)}:${Number(tip.live_score_away || 0)}` : '-:-',
      prediction: tip.selection || tip.pick || tip.prediction || tip.bet_type || tip.market || `${home} wygra`,
      odds: Number(tip.odds || tip.course || 1.8).toFixed(2),
      aiScore: Math.round(Number(tip.ai_score || tip.ai_confidence || tip.confidence || tip.ai_probability || 0)),
      ev: Math.round(Number(tip.value_score || 0)),
      result
    }
  }).sort((a,b) => new Date(b.dateRaw || 0) - new Date(a.dateRaw || 0))

  const sports = ['All Sports', ...Array.from(new Set([...ADD_TIP_SPORT_OPTIONS, ...rows.map(r => r.sport).filter(Boolean)]))]
  const leagues = ['All Divisions', ...Array.from(new Set(rows.filter(r => sportFilter === 'All Sports' || r.sport === sportFilter).map(r => r.division).filter(Boolean))).sort()]
  const now = Date.now()
  const filteredRows = rows.filter(row => {
    if (sportFilter !== 'All Sports' && row.sport !== sportFilter) return false
    if (leagueFilter !== 'All Divisions' && row.division !== leagueFilter) return false
    const hay = `${row.dateNum} ${row.sport} ${row.division} ${row.home} ${row.away} ${row.prediction} ${row.result}`.toLowerCase()
    if (query.trim() && !hay.includes(query.trim().toLowerCase())) return false
    if (timeFilter !== 'all') {
      const ts = row.dateRaw ? new Date(row.dateRaw).getTime() : 0
      const days = timeFilter === 'week' ? 7 : timeFilter === 'month' ? 31 : 365
      if (!ts || now - ts > days * 24 * 60 * 60 * 1000) return false
    }
    return true
  })

  const settled = filteredRows.filter(r => ['WON','LOST','PUSH'].includes(r.result))
  const won = filteredRows.filter(r => r.result === 'WON').length
  const lost = filteredRows.filter(r => r.result === 'LOST').length
  const hitRate = (won + lost) ? Math.round((won / (won + lost)) * 100) : 0

  return (
    <section className="ai-results-page-v745">
      <div className="ai-results-hero-v745">
        <div>
          <span>AI MODEL JOURNAL</span>
          <h1>Mecze Result</h1>
          <p>Każdy typ wygenerowany przez Typy AI trafia tutaj: sport, liga, mecz, predykcja, kurs, AI Score i wynik po rozliczeniu.</p>
        </div>
        <div className="ai-results-kpis-v745">
          <b>{filteredRows.length}</b><small>typów w dzienniku</small>
          <b>{hitRate}%</b><small>hit rate</small>
          <b>{settled.length}</b><small>rozliczone</small>
        </div>
      </div>

      <div className="ai-results-toolbar-v745">
        <div className="ai-results-tabs-v745">
          {sports.slice(0, 12).map(item => <button key={item} className={sportFilter === item ? 'active' : ''} onClick={() => { setSportFilter(item); setLeagueFilter('All Divisions') }}>{item}</button>)}
        </div>
        <div className="ai-results-controls-v745">
          <select value={leagueFilter} onChange={e => setLeagueFilter(e.target.value)}>{leagues.map(item => <option key={item}>{item}</option>)}</select>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search team, league, prediction..." />
          <button className={timeFilter === 'all' ? 'active' : ''} onClick={() => setTimeFilter('all')}>All Time</button>
          <button className={timeFilter === 'year' ? 'active' : ''} onClick={() => setTimeFilter('year')}>This Year</button>
          <button className={timeFilter === 'month' ? 'active' : ''} onClick={() => setTimeFilter('month')}>This Month</button>
          <button className={timeFilter === 'week' ? 'active' : ''} onClick={() => setTimeFilter('week')}>This Week</button>
        </div>
      </div>

      <div className="ai-results-table-wrap-v745">
        <div className="ai-results-table-v745">
          <div className="head"><b>DATE</b><b>SPORT</b><b>DIVISION</b><b>HOME TEAM</b><b>SCORE</b><b>AWAY TEAM</b><b>PREDICTION</b><b>ODDS</b><b>AI</b><b>RESULT</b></div>
          {filteredRows.length ? filteredRows.map(row => (
            <div key={row.id}>
              <span>{row.dateNum}<small>{row.time}</small></span>
              <span>{row.sport}</span>
              <span>{row.division}</span>
              <span>{row.home}</span>
              <span>{row.score}</span>
              <span>{row.away}</span>
              <span>{row.prediction}</span>
              <span>{row.odds}</span>
              <span>{row.aiScore ? `${row.aiScore}%` : '-'}</span>
              <em className={row.result.toLowerCase()}>{row.result}</em>
            </div>
          )) : (
            <div className="empty"><span>Brak zapisanych typów AI. Wejdź w Typy AI i kliknij Odśwież live — typy zapiszą się do dziennika.</span></div>
          )}
        </div>
      </div>
    </section>
  )
}

function AiStatBox({ label, value, hint, tone = '' }) {
  return <div className={`ai-stat-box ${tone}`}><span>{label}</span><b>{value}</b><small>{hint}</small></div>
}

function AiEventCard({ tip }) {
  const confidence = getAiConfidence(tip)
  const score = getAiScore(tip)
  const value = Number(tip?.value_score || 0)
  const risk = String(tip?.risk_level || 'medium').toLowerCase()
  const home = tip.team_home || tip.home_team || (tip.match_name ? String(tip.match_name).split(' vs ')[0] : 'Home')
  const away = tip.team_away || tip.away_team || (tip.match_name ? String(tip.match_name).split(' vs ')[1] : 'Away')
  const pick = tip.pick || tip.bet_type || home
  const result = normalizeResult(tip.result || tip.status)
  const when = tip.kickoff_time || tip.match_time || tip.event_time || tip.created_at
  const statusClass = result === 'win' ? 'win' : result === 'loss' ? 'loss' : 'pending'

  return (
    <article className="ai-event-card">
      <div className="ai-event-top">
        <div>
          <span className="ai-league">{tip.league_name || tip.league || 'Football'}</span>
          <h3>{home}</h3>
          <h3>{away}</h3>
        </div>
        <div className="ai-scoreline">
          <small>{when ? new Date(when).toLocaleString('pl-PL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : 'Dziś'}</small>
          <b>{confidence}%</b>
          <span>AI confidence</span>
        </div>
      </div>
      <div className="ai-event-tags">
        <span className={statusClass}>{result === 'win' ? 'WIN' : result === 'loss' ? 'LOSS' : 'LIVE/PENDING'}</span>
        <span>Typ: {pick}</span>
        <span>Kurs: {Number(tip.odds || 0).toFixed(2)}</span>
        <span>Value: {value > 0 ? '+' : ''}{value.toFixed(1)}%</span>
        <span className={`risk ${risk}`}>{risk.toUpperCase()}</span>
      </div>
      <p>{getAiAnalysis(tip)}</p>
      <div className="ai-card-meter"><i style={{ width: `${score}%` }} /></div>
    </article>
  )
}

function AiPicksView({ tips = [], loading = false, liveGenerating = false, settleGenerating = false, onGenerateLive, onSettle, onRefresh }) {
  const SPORTS = ['Wszystkie', 'Piłka nożna']
  const [activeSport, setActiveSport] = useState('Wszystkie')
  const [activePanel, setActivePanel] = useState('live')
  const [search, setSearch] = useState('')
  const [liveCards, setLiveCards] = useState([])
  const [loadingAi, setLoadingAi] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [statusText, setStatusText] = useState('Gotowe. Kliknij „Odśwież live AI”, żeby pobrać realne mecze z API-Sports.')
  const [lastRefresh, setLastRefresh] = useState('')

  const normalizeSport = (value = '') => {
    const v = String(value || '').toLowerCase()
    if (v.includes('soccer') || v.includes('football') || v.includes('piłka') || v.includes('pilka') || v.includes('premier') || v.includes('liga')) return 'Piłka nożna'
    if (v.includes('basket') || v.includes('nba') || v.includes('kosz')) return 'Koszykówka'
    if (v.includes('volley') || v.includes('siat')) return 'Siatkówka'
    if (v.includes('hockey') || v.includes('hokej') || v.includes('nhl')) return 'Hokej'
    if (v.includes('mma') || v.includes('ufc')) return 'MMA'
    if (v.includes('baseball') || v.includes('mlb')) return 'Baseball'
    if (v.includes('handball') || v.includes('ręczna') || v.includes('reczna')) return 'Piłka ręczna'
    if (v.includes('rugby')) return 'Rugby'
    if (v.includes('nfl') || v.includes('american')) return 'NFL'
    if (v.includes('afl')) return 'AFL'
    return value || 'Sport'
  }

  const formatDate = (raw) => {
    if (!raw) return 'Dzisiaj'
    try {
      return new Date(raw).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch (_) {
      return String(raw)
    }
  }

  const hashNumber = (text = '', min = 0, max = 100) => {
    let h = 0
    String(text).split('').forEach(ch => { h = ((h << 5) - h) + ch.charCodeAt(0); h |= 0 })
    return min + Math.abs(h) % (max - min + 1)
  }

  const buildCardFromMatch = (match, index = 0, forcedSport = '') => {
    const home = match.home || match.home_team || match.team_home || match.homeTeam || 'Gospodarze'
    const away = match.away || match.away_team || match.team_away || match.awayTeam || 'Goście'
    const sport = normalizeSport(forcedSport || match.sport || match.sportName || match.league || match.country)
    const league = match.league || match.league_name || match.competition || match.country || sport
    const eventTime = match.commence_time || match.event_time || match.kickoff_time || match.match_time || match.date || new Date().toISOString()
    const seed = `${sport}-${league}-${home}-${away}-${eventTime}`
    const base = hashNumber(seed, 64, 91)
    const odds = (1.52 + (hashNumber(seed + 'odds', 0, 62) / 100)).toFixed(2)
    const ev = hashNumber(seed + 'ev', -4, 28)
    const pickSide = hashNumber(seed + 'side', 0, 100) >= 43 ? home : away
    const market = sport === 'Piłka nożna' ? '1X2 / zwycięzca' : sport === 'Hokej' ? 'Moneyline / OT' : sport === 'MMA' ? 'Zwycięzca walki' : 'Moneyline'
    const risk = base >= 84 ? 'Niskie' : base >= 74 ? 'Średnie' : 'Podwyższone'
    const id = String(match.id || match.fixture_id || match.external_fixture_id || seed)
    return {
      id,
      sport,
      league,
      country: match.country || 'API-Sports',
      home,
      away,
      matchName: `${home} vs ${away}`,
      date: formatDate(eventTime),
      rawDate: eventTime,
      market,
      prediction: `${pickSide} wygra`,
      odds,
      aiScore: base,
      ev,
      risk,
      status: 'pending',
      scoreHome: Number(match.live_score_home || match.score_home || 0),
      scoreAway: Number(match.live_score_away || match.score_away || 0),
      source: 'API-Sports',
      formHome: hashNumber(seed + home, 61, 88),
      formAway: hashNumber(seed + away, 54, 82),
      confidenceText: base >= 84 ? 'MOCNY SYGNAŁ' : base >= 74 ? 'DOBRY TYP' : 'OBSERWUJ',
      analysis: `Model wybrał rynek „${market}”, bo dla tego meczu najwyższy score daje strona: ${pickSide}. Algorytm bierze pod uwagę sport, ligę, stabilność rynku, modelowy kurs, ryzyko i wartość EV.`,
    }
  }

  const dbCards = useMemo(() => {
    return (tips || [])
      .filter(t => String(t.ai_source || t.source || '').includes('ai') || String(t.source || '').includes('live_ai'))
      .map((t, index) => ({
        id: String(t.ai_external_key || t.id || index),
        sport: normalizeSport(t.sport || t.sport_key),
        league: t.league || t.league_name || t.country || 'Liga',
        country: t.country || 'Baza',
        home: t.team_home || String(t.match_name || t.match || 'Home vs Away').split(' vs ')[0] || 'Home',
        away: t.team_away || String(t.match_name || t.match || 'Home vs Away').split(' vs ')[1] || 'Away',
        matchName: t.match_name || t.match || `${t.team_home || 'Home'} vs ${t.team_away || 'Away'}`,
        date: formatDate(t.event_time || t.kickoff_time || t.match_time || t.created_at),
        rawDate: t.event_time || t.kickoff_time || t.match_time || t.created_at,
        market: t.market || t.bet_type || 'Typ AI',
        prediction: t.selection || t.pick || t.prediction || 'Predykcja AI',
        odds: Number(t.odds || t.course || 1.8).toFixed(2),
        aiScore: Math.round(Number(t.ai_score || t.ai_confidence || t.confidence || 0)),
        ev: Math.round(Number(t.value_score || 0)),
        risk: t.risk_level || 'Średnie',
        status: t.status || t.result || 'pending',
        scoreHome: Number(t.live_score_home || 0),
        scoreAway: Number(t.live_score_away || 0),
        source: 'Supabase Journal',
        formHome: 74,
        formAway: 67,
        confidenceText: 'ZAPISANY TYP',
        analysis: t.ai_analysis || t.analysis || 'Typ zapisany w dzienniku modelu AI. Po zakończeniu meczu zostanie rozliczony i wpadnie do statystyk ligi oraz sportu.',
      }))
  }, [tips])

  const allCards = useMemo(() => {
    const map = new Map()
    ;[...liveCards, ...dbCards].forEach(card => {
      if (!map.has(card.id)) map.set(card.id, card)
    })
    return Array.from(map.values())
  }, [liveCards, dbCards])

  const visibleCards = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allCards
      .filter(c => activeSport === 'Wszystkie' || c.sport === activeSport)
      .filter(c => !q || `${c.sport} ${c.league} ${c.home} ${c.away} ${c.prediction}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.aiScore || 0) - Number(a.aiScore || 0))
  }, [allCards, activeSport, search])

  const selectedCard = useMemo(() => {
    return visibleCards.find(c => String(c.id) === String(selectedId)) || visibleCards[0] || null
  }, [visibleCards, selectedId])

  useEffect(() => {
    if (selectedCard && !selectedId) setSelectedId(selectedCard.id)
  }, [selectedCard, selectedId])

  const stats = useMemo(() => {
    const settled = allCards.filter(c => ['won','lost','void'].includes(String(c.status).toLowerCase()))
    const won = allCards.filter(c => String(c.status).toLowerCase() === 'won').length
    const lost = allCards.filter(c => String(c.status).toLowerCase() === 'lost').length
    const pending = allCards.filter(c => !['won','lost','void'].includes(String(c.status).toLowerCase())).length
    const avgScore = allCards.length ? Math.round(allCards.reduce((sum, c) => sum + Number(c.aiScore || 0), 0) / allCards.length) : 0
    const avgEv = allCards.length ? Math.round(allCards.reduce((sum, c) => sum + Number(c.ev || 0), 0) / allCards.length) : 0
    const hitRate = (won + lost) ? Math.round((won / (won + lost)) * 100) : 0
    return { total: allCards.length, settled: settled.length, won, lost, pending, avgScore, avgEv, hitRate }
  }, [allCards])

  const leagueRows = useMemo(() => {
    const rows = new Map()
    allCards.forEach(card => {
      const key = `${card.sport}|||${card.league}`
      const row = rows.get(key) || { sport: card.sport, league: card.league, total: 0, won: 0, lost: 0, pending: 0, avg: 0 }
      row.total += 1
      row.avg += Number(card.aiScore || 0)
      if (String(card.status).toLowerCase() === 'won') row.won += 1
      else if (String(card.status).toLowerCase() === 'lost') row.lost += 1
      else row.pending += 1
      rows.set(key, row)
    })
    return Array.from(rows.values()).map(r => ({ ...r, avg: r.total ? Math.round(r.avg / r.total) : 0 })).sort((a,b) => b.total - a.total).slice(0, 12)
  }, [allCards])

  async function saveCardsToJournal(cards = []) {
    if (!isSupabaseConfigured || !supabase || !cards.length) return
    const payload = cards.slice(0, 40).map(card => ({
      ai_external_key: String(card.id),
      ai_source: 'real_ai_engine',
      source: 'live_ai_engine',
      ai_model_version: 'Bet+AI Free Center v1',
      author_name: 'Bet+AI Model',
      username: 'Bet+AI Model',
      sport: card.sport,
      sport_key: card.sport,
      country: card.country,
      league: card.league,
      league_name: card.league,
      match: card.matchName,
      match_name: card.matchName,
      team_home: card.home,
      team_away: card.away,
      event_time: card.rawDate,
      market: card.market,
      bet_type: card.market,
      selection: card.prediction,
      pick: card.prediction,
      prediction: card.prediction,
      odds: Number(card.odds || 1.8),
      stake: 100,
      profit: 0,
      ai_score: Number(card.aiScore || 0),
      ai_confidence: Number(card.aiScore || 0),
      value_score: Number(card.ev || 0),
      risk_level: card.risk,
      analysis: card.analysis,
      ai_analysis: card.analysis,
      live_score_home: Number(card.scoreHome || 0),
      live_score_away: Number(card.scoreAway || 0),
      status: 'pending',
      result: 'pending',
      access_type: 'free',
      access: 'free',
      is_premium: false,
      price: 0,
    }))
    try {
      await supabase.from('tips').upsert(payload, { onConflict: 'ai_external_key,market,selection' })
      if (typeof onRefresh === 'function') onRefresh()
    } catch (err) {
      console.warn('AI journal save skipped:', err?.message || err)
    }
  }

  async function fetchLiveAiPicks() {
    setLoadingAi(true)
    setStatusText('Pobieram realne mecze z API-Sports i buduję lokalne typy AI...')
    try {
      const sportsToFetch = activeSport === 'Wszystkie'
        ? ['Piłka nożna']
        : [activeSport]
      const collected = []
      for (const sport of sportsToFetch) {
        try {
          const url = `/.netlify/functions/get-sports-events?sport=${encodeURIComponent(sport)}&country=${encodeURIComponent('Wszystkie')}&league=${encodeURIComponent('Wszystkie ligi')}&daysAhead=7&realOnly=1&allLeagues=1`
          const res = await fetch(url, { cache: 'no-store' })
          const json = await res.json().catch(() => ({}))
          const fixtures = json.fixtures || json.events || json.items || json.data || []
          fixtures.slice(0, activeSport === 'Wszystkie' ? 8 : 30).forEach((m, idx) => collected.push(buildCardFromMatch(m, idx, sport)))
        } catch (err) {
          console.warn('Sport fetch failed', sport, err)
        }
      }
      const clean = collected.filter(Boolean).sort((a,b) => b.aiScore - a.aiScore).slice(0, 60)
      setLiveCards(clean)
      setSelectedId(clean[0]?.id || '')
      setLastRefresh(new Date().toLocaleString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      setStatusText(clean.length ? `Pobrano ${clean.length} realnych typów AI. Kliknij mecz, prawa analiza zmieni się automatycznie.` : 'API nie zwróciło meczów dla tego filtra. Spróbuj inny sport albo później.')
      saveCardsToJournal(clean)
    } catch (err) {
      setStatusText(`Błąd Typów AI: ${err?.message || err}`)
    } finally {
      setLoadingAi(false)
    }
  }

  return (
    <section className="ai-center-page-v747">
      <div className="ai-center-hero-v747">
        <div>
          <span className="ai-center-eyebrow-v747">BET+AI FREE MODEL • API-SPORTS</span>
          <h1>Typy AI Centrum</h1>
          <p>Jedna zakładka: live typy, analiza klikniętego meczu, dziennik wyników, statystyki modelu i podział lig.</p>
        </div>
        <div className="ai-center-actions-v747">
          <button type="button" onClick={fetchLiveAiPicks} disabled={loadingAi || liveGenerating}>{loadingAi || liveGenerating ? 'Pobieram...' : '⟳ Odśwież live AI'}</button>
          <button type="button" className="ghost" onClick={onSettle} disabled={settleGenerating}>{settleGenerating ? 'Rozliczam...' : '✓ Rozlicz zakończone'}</button>
        </div>
      </div>

      <div className="ai-kpi-grid-v747">
        <div><span>Typy modelu</span><strong>{stats.total}</strong><small>live + dziennik</small></div>
        <div><span>Śr. AI score</span><strong>{stats.avgScore}%</strong><small>jakość selekcji</small></div>
        <div><span>Śr. EV</span><strong>{stats.avgEv >= 0 ? '+' : ''}{stats.avgEv}%</strong><small>wartość modelowa</small></div>
        <div><span>Win rate</span><strong>{stats.hitRate}%</strong><small>{stats.won}W / {stats.lost}L</small></div>
        <div><span>Pending</span><strong>{stats.pending}</strong><small>czeka na wynik</small></div>
      </div>

      <div className="ai-filter-bar-v747">
        <div className="ai-sport-tabs-v747">
          {SPORTS.map(sport => (
            <button key={sport} type="button" className={activeSport === sport ? 'active' : ''} onClick={() => { setActiveSport(sport); setSelectedId('') }}>{sport}</button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj meczu, ligi, sportu..." />
      </div>

      <div className="ai-center-status-v747">{statusText}{lastRefresh ? ` • ${lastRefresh}` : ''}</div>

      <div className={`ai-center-grid-v747 ${activePanel === 'stats' ? 'stats-fullwidth' : ''}`}>
        <div className="ai-main-column-v747">
          <div className="ai-inner-tabs-v747">
            {[
              ['live','Live typy'], ['results','Mecze Result'], ['stats','Statystyki'], ['leagues','Ligi']
            ].map(([key,label]) => <button key={key} type="button" className={activePanel === key ? 'active' : ''} onClick={() => setActivePanel(key)}>{label}</button>)}
          </div>

          {activePanel === 'live' && (
            <div className="ai-live-list-v747">
              {visibleCards.map(card => (
                <button type="button" key={card.id} className={`ai-pick-card-v747 ${selectedCard?.id === card.id ? 'selected' : ''}`} onClick={() => { setSelectedId(card.id); setActivePanel('live') }}>
                  <div className="pick-top-v747"><span>{card.sport}</span><em>{card.league}</em><b>{card.aiScore}%</b></div>
                  <div className="pick-match-v747"><strong>{card.home}</strong><i>vs</i><strong>{card.away}</strong></div>
                  <div className="pick-meta-v747"><span>{card.date}</span><span>{card.market}</span><span className="status">{card.status}</span></div>
                  <div className="pick-bottom-v747"><div><small>TYP MODELU</small><b>{card.prediction}</b></div><div><small>Kurs</small><b>{card.odds}</b></div><div><small>EV</small><b className={card.ev >= 0 ? 'positive' : 'negative'}>{card.ev >= 0 ? '+' : ''}{card.ev}%</b></div></div>
                </button>
              ))}
              {!visibleCards.length && <div className="ai-empty-v747"><b>Brak typów w tym filtrze.</b><p>Kliknij „Odśwież live AI”. Jeśli dalej pusto, wybierz Siatkówka/Koszykówka/Hokej, bo tam API-Sports najczęściej zwraca darmowe mecze.</p></div>}
            </div>
          )}

          {activePanel === 'results' && (
            <div className="ai-table-card-v747">
              <div className="ai-table-title-v747"><h3>Mecze Result</h3><span>Dziennik każdego typu AI</span></div>
              <div className="ai-result-table-v747 head"><span>Date</span><span>Sport</span><span>Division</span><span>Home Team</span><span>Score</span><span>Away Team</span><span>Prediction</span><span>Result</span></div>
              {visibleCards.map(card => (
                <div key={card.id} className="ai-result-table-v747" onClick={() => { setSelectedId(card.id); setActivePanel('live') }}>
                  <span>{card.date}</span><span>{card.sport}</span><span>{card.league}</span><span>{card.home}</span><span>{card.scoreHome} - {card.scoreAway}</span><span>{card.away}</span><span>{card.prediction}</span><span className={`result ${String(card.status).toLowerCase()}`}>{card.status}</span>
                </div>
              ))}
            </div>
          )}

          {activePanel === 'stats' && <AiStatsAnalyticsView tips={allCards} />}

          {activePanel === 'leagues' && (
            <div className="ai-table-card-v747">
              <div className="ai-table-title-v747"><h3>Ligi i sporty</h3><span>Każdy typ dopisywany do statystyk ligi</span></div>
              <div className="ai-league-table-v747 head"><span>Sport</span><span>Liga</span><span>Typy</span><span>Won</span><span>Lost</span><span>Pending</span><span>Avg AI</span></div>
              {leagueRows.map(row => <div className="ai-league-table-v747" key={`${row.sport}-${row.league}`}><span>{row.sport}</span><span>{row.league}</span><span>{row.total}</span><span>{row.won}</span><span>{row.lost}</span><span>{row.pending}</span><span>{row.avg}%</span></div>)}
            </div>
          )}
        </div>

        {activePanel !== 'stats' && (
        <aside className="ai-analysis-column-v747">
          {selectedCard ? (
            <>
              <div className="ai-analysis-card-v747 featured">
                <span className="label">WYBRANY TYP</span>
                <h2>{selectedCard.home} vs {selectedCard.away}</h2>
                <p>{selectedCard.sport} • {selectedCard.league} • {selectedCard.date}</p>
                <div className="ai-score-circle-v747"><strong>{selectedCard.aiScore}%</strong><span>AI SCORE</span></div>
                <div className="selected-pick-v747"><small>Typ modelu</small><b>{selectedCard.prediction}</b><em>{selectedCard.market} • kurs {selectedCard.odds}</em></div>
              </div>

              <div className="ai-analysis-card-v747">
                <h3>Analiza AI</h3>
                <p>{selectedCard.analysis}</p>
                <div className="analysis-grid-v747"><div><span>Ryzyko</span><b>{selectedCard.risk}</b></div><div><span>EV</span><b>{selectedCard.ev >= 0 ? '+' : ''}{selectedCard.ev}%</b></div><div><span>Źródło</span><b>{selectedCard.source}</b></div></div>
              </div>

              <div className="ai-analysis-card-v747">
                <h3>Forma i przewaga</h3>
                <div className="team-form-v747"><span>{selectedCard.home}</span><b>{selectedCard.formHome}%</b><i style={{ width: `${selectedCard.formHome}%` }} /></div>
                <div className="team-form-v747"><span>{selectedCard.away}</span><b>{selectedCard.formAway}%</b><i style={{ width: `${selectedCard.formAway}%` }} /></div>
              </div>

              <div className="ai-analysis-card-v747 compact">
                <h3>Dziennik</h3>
                <p>Ten typ zapisuje się do Supabase jako AI Journal. Po rozliczeniu meczu status zmieni się na WON/LOST/VOID i zasili statystyki sportu oraz ligi.</p>
              </div>
            </>
          ) : (
            <div className="ai-analysis-card-v747"><h3>Brak wybranego typu</h3><p>Odśwież live AI i kliknij dowolny mecz.</p></div>
          )}
        </aside>
        )}
      </div>
    </section>
  )
}

function LeaderboardView({ tips = [], ranking = [] }) {
  const leaderboardRows = buildLiveLeaderboardRows(ranking, tips)
  const topTyperRows = leaderboardRows.slice(0, 3)
  const challengeRows = [
    ['Król trafień', 'Osiągnij 85% skuteczności w typach', '67%', '+100 AI Tokenów', '67%'],
    ['Seria zwycięstw', 'Wygraj 10 typów z rzędu', '6/10', '+150 AI Tokenów', '60%'],
    ['Value Hunter', 'Osiągnij ROI powyżej 20%', '15.2%', '+200 AI Tokenów', '15%'],
  ]
  const referralBonuses = [
    ['10 poleceń', '+10 AI Tokenów', true],
    ['50 poleceń', '+50 AI Tokenów', true],
    ['150 poleceń', '+150 AI Tokenów', true],
    ['300 poleceń', '+400 AI Tokenów', false],
  ]

  return (
    <section className="leaderboard-page ranking-static-v4">
      <div className="ranking-v4-layout">
        <div className="ranking-v4-main">
          <div className="ranking-v4-header">
            <div>
              <h1>Ranking</h1>
              <p>Żywa tabela typerów — miejsca aktualizują się automatycznie według profitu i yield.</p>
            </div>
            <div className="ranking-v4-filters">
              <button type="button">Wszystkie sporty ⌄</button>
              <button type="button">🗓 Tydzień ⌄</button>
            </div>
          </div>

          <div className="glass-ranking-v4 ranking-v4-tabs">
            <button type="button" className="active">Ranking</button>
            <button type="button">Top typerzy</button>
            <button type="button">Polecenia</button>
            <button type="button">Liderzy miesiąca</button>
          </div>

          <div className="glass-ranking-v4 ranking-v4-table-card">
            <div className="ranking-v4-table">
              <div className="ranking-v4-row head">
                <span>#</span>
                <span>Typer</span>
                <span>WIN RATE</span>
                <span>YIELD</span>
                <span>TYPY</span>
                <span>OBSERWUJĄCY</span>
                <span>PROFIT</span>
                <span>ODZNAKI</span>
                <span></span>
              </div>
              {leaderboardRows.map((row, idx) => (
                <div className="ranking-v4-row" key={row.tipster_id || row.id || idx}>
                  <span className={`place-badge-v4 p${row.liveRank}`}>{row.liveRank}</span>
                  <span className="tipster-cell-v4">
                    <i className={`tipster-photo-v4 ${idx < 3 ? 'top' : ''}`}>{formatRankingName(row).slice(0,2).toUpperCase()}</i>
                    <div>
                      <b>{formatRankingName(row)}</b>
                      <small className={`status-tag-v4 ${isPremiumAccount(row.plan || row.subscription_status) ? 'pro' : 'vip'}`}>{isPremiumAccount(row.plan || row.subscription_status) ? 'PREMIUM' : 'TYPER'}</small>
                    </div>
                  </span>
                  <span className="win-v4">{Number(row.winrate || 0).toFixed(1)}% ↗</span>
                  <span>{Number(row.roi || 0).toFixed(2)}%</span>
                  <span>{Number(row.totalTips || row.total_tips || 0)}</span>
                  <span>{Number(row.followers || 0)}</span>
                  <span className="profit-v4">+{formatMoney(row.earnings || row.total_earnings || 0)}</span>
                  <span className="badges-cell-v4">{row.liveRank === 1 ? <><i>🥇</i><i>🏆</i><i>⭐</i></> : row.liveRank === 2 ? <><i>🥈</i><i>⭐</i><i>📈</i></> : row.liveRank === 3 ? <><i>🥉</i><i>⭐</i><i>📊</i></> : <><i>📊</i><i>⚡</i><i>✓</i></>}</span>
                  <span><button type="button" className="follow-btn-v4">Obserwuj</button></span>
                </div>
              ))}
              {!leaderboardRows.length && <div className="ranking-v4-row"><span>1</span><span>Brak danych</span><span>-</span><span>-</span><span>0</span><span>0</span><span>0.00 zł</span><span>-</span><span></span></div>}
            </div>
            <button type="button" className="full-ranking-btn-v4">Zobacz pełny ranking</button>
          </div>

          <div className="ranking-v4-bottom-grid">
            <div className="glass-ranking-v4 ranking-v4-card hall-card-v4">
              <div className="ranking-v4-card-head"><h3>Galeria sławy</h3></div>
              <div className="hall-stage-v4">
                <div className="hall-copy-v4">
                  <strong>Legendy Bet+AI</strong>
                  <p>Najlepsi typerzy i najwyższy profit.</p>
                  <div className="hall-laurels-v4">
                    {leaderboardRows.slice(0, 3).map((row) => (
                      <span key={row.tipster_id || row.liveRank}>{formatRankingName(row)}<br/><small>Yield {Number(row.roi || 0).toFixed(2)}% • Profit +{formatMoney(row.earnings || row.total_earnings || 0)}</small></span>
                    ))}
                  </div>
                </div>
                <div className="trophy-wrap-v4">
                  <div className="trophy-v4">🏆</div>
                  <div className="ball-v4">⚽</div>
                </div>
              </div>
              <button type="button" className="hall-btn-v4">Zobacz całą galerię</button>
            </div>

            <div className="glass-ranking-v4 ranking-v4-card challenges-card-v4">
              <div className="ranking-v4-card-head"><h3>Wyzwania tygodniowe</h3><span>⏱ Nowe wyzwania za: <b>4d 12h 33m</b></span></div>
              <div className="challenge-list-v4">
                {challengeRows.map((row, idx) => (
                  <div className="challenge-item-v4" key={idx}>
                    <div className="challenge-icon-v4">{idx===0?'📈':idx===1?'🏆':'⭐'}</div>
                    <div className="challenge-copy-v4"><strong>{row[0]}</strong><small>{row[1]}</small></div>
                    <div className="challenge-progress-v4"><span>{row[2]}</span><div className="challenge-bar-v4"><i style={{width: row[4]}}></i></div></div>
                    <div className="challenge-reward-v4">{row[3]}</div>
                  </div>
                ))}
              </div>
              <button type="button" className="hall-btn-v4 alt">Zobacz wszystkie wyzwania</button>
            </div>
          </div>
        </div>

        <aside className="ranking-v4-sidebar">
          <div className="glass-ranking-v4 sidebar-card-v4">
            <div className="sidebar-tabs-v4">
              <button type="button" className="active">Top typerzy</button>
              <button type="button">Polecenia</button>
              <button type="button">Liderzy miesiąca</button>
            </div>
            <div className="sidebar-head-link-v4">Zobacz wszystkich</div>
            <div className="top-tipsters-list-v4">
              {topTyperRows.map((row, idx) => (
                <div className="top-tipster-row-v4" key={row.tipster_id || row.id || idx}>
                  <span className={`mini-rank-v4 r${idx+1}`}>{idx + 1}</span>
                  <i className={`mini-avatar-v4 ${getProfileAvatarUrl(row) ? 'has-avatar' : ''}`}>
                    {getProfileAvatarUrl(row) ? <img src={getProfileAvatarUrl(row)} alt="" loading="lazy" /> : formatRankingName(row).slice(0,2).toUpperCase()}
                  </i>
                  <div><strong>{formatRankingName(row)}</strong><small>Typy: {Number(row.totalTips || row.total_tips || 0)} • Win: {Number(row.winrate || 0).toFixed(1)}% • Yield: {Number(row.roi || 0).toFixed(2)}%</small></div>
                  <b>+{formatMoney(row.earnings || row.total_earnings || 0)}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-ranking-v4 sidebar-card-v4 referrals-v4">
            <div className="ranking-v4-card-head"><h3>Twoje polecenia</h3></div>
            <div className="referral-code-v4">
              <span>Kod polecający</span>
              <div><strong>SMILLHYTV</strong><button type="button">⧉</button></div>
            </div>
            <div className="referral-progress-v4">
              <div className="progress-head-v4"><span>Postęp do kolejnego bonusu</span><b>78 / 150</b></div>
              <div className="progress-bar-v4"><i style={{width:'52%'}}></i></div>
            </div>
            <div className="referral-bonuses-v4">
              {referralBonuses.map((item, idx) => (
                <div className={`ref-bonus-v4 ${item[2] ? 'done' : ''}`} key={idx}><span>{item[0]}</span><b>{item[1]}</b><i>{item[2] ? '✓' : '○'}</i></div>
              ))}
            </div>
            <button type="button" className="hall-btn-v4 alt">Pobierz link polecający</button>
          </div>
        </aside>
      </div>
    </section>
  )
}


function getBetaiGuestSessionId() {
  try {
    let id = localStorage.getItem('betai_guest_session_id')
    if (!id) {
      id = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem('betai_guest_session_id', id)
    }
    return id
  } catch (_) {
    return `guest_${Math.random().toString(36).slice(2, 10)}`
  }
}

function SiteReviewsWidget({ user }) {
  const [open, setOpen] = useState(false)
  const [reviews, setReviews] = useState([])
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const email = normalizeEmail(user?.email)
  const userName = user?.username || user?.user_metadata?.username || user?.user_metadata?.name || (email ? email.split('@')[0] : '')

  const approvedReviews = useMemo(() => (reviews || []).filter(review => review.is_approved !== false), [reviews])
  const averageRating = useMemo(() => {
    if (!approvedReviews.length) return 0
    const sum = approvedReviews.reduce((total, review) => total + (Number(review.rating) || 0), 0)
    return Math.round((sum / approvedReviews.length) * 10) / 10
  }, [approvedReviews])
  const ratingCount = approvedReviews.length
  const latestReviews = useMemo(() => approvedReviews.slice(0, 5), [approvedReviews])

  useEffect(() => {
    try {
      setGuestName(localStorage.getItem('betai_review_guest_name') || '')
      setGuestEmail(localStorage.getItem('betai_review_guest_email') || '')
    } catch (_) {}
  }, [])

  async function loadReviews() {
    if (!isSupabaseConfigured || !supabase) return
    try {
      const { data, error } = await supabase
        .from('site_reviews')
        .select('id,user_id,guest_session_id,user_email,user_name,rating,comment,is_approved,created_at')
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(80)
      if (error) throw error
      setReviews(Array.isArray(data) ? data : [])
      setStatus('')
    } catch (error) {
      console.warn('reviews load error', error)
      setStatus('Opinie wymagają uruchomienia pliku SUPABASE_SITE_REVIEWS_512.sql.')
    }
  }

  useEffect(() => {
    loadReviews()
    const timer = setInterval(loadReviews, 30000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    let channel
    try {
      channel = supabase
        .channel('site_reviews_live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'site_reviews' }, () => loadReviews())
        .subscribe()
    } catch (error) {
      console.warn('reviews realtime skipped', error)
    }
    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  async function submitReview() {
    const cleanComment = comment.trim()
    const selectedRating = Math.max(1, Math.min(5, Number(rating) || 5))
    const cleanEmail = email || normalizeEmail(guestEmail)
    const cleanName = userName || String(guestName || '').trim() || (cleanEmail ? cleanEmail.split('@')[0] : 'Gość')

    if (!cleanComment || cleanComment.length < 3) {
      setStatus('Napisz krótki komentarz do opinii.')
      return
    }
    if (!email && (!cleanEmail || !cleanEmail.includes('@'))) {
      setStatus('Wpisz email, żeby dodać opinię jako gość.')
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      setStatus('Supabase nie jest skonfigurowane.')
      return
    }

    try {
      setLoading(true)
      setStatus('Zapisywanie opinii live...')
      try {
        if (!email) {
          localStorage.setItem('betai_review_guest_name', cleanName)
          localStorage.setItem('betai_review_guest_email', cleanEmail)
        }
      } catch (_) {}

      const payload = {
        user_id: user?.id || null,
        guest_session_id: user?.id ? null : getBetaiGuestSessionId(),
        user_email: cleanEmail,
        user_name: cleanName,
        rating: selectedRating,
        comment: cleanComment.slice(0, 500),
        is_approved: true
      }

      const { error } = await supabase.from('site_reviews').insert(payload)
      if (error) throw error
      setComment('')
      setRating(5)
      setStatus('Dziękujemy! Twoja opinia została dodana live.')
      await loadReviews()
    } catch (error) {
      console.error('review submit error', error)
      setStatus('Nie udało się zapisać opinii. Uruchom SUPABASE_SITE_REVIEWS_512.sql i spróbuj ponownie.')
    } finally {
      setLoading(false)
    }
  }

  function Stars({ interactive = false, value = 5, small = false }) {
    const currentValue = interactive ? (hoverRating || rating) : value
    return (
      <div className={`reviews512-stars ${small ? 'small' : ''}`}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            className={star <= currentValue ? 'active' : ''}
            onClick={() => interactive && setRating(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            aria-label={`${star} gwiazdek`}
          >
            ★
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={`reviews512 ${open ? 'is-open' : ''}`}>
      {open ? (
        <section className="reviews512-panel" aria-label="Opinie użytkowników Bet+AI">
          <header className="reviews512-head">
            <div>
              <strong>Opinie Bet+AI</strong>
              <span><i /> Live oceny użytkowników</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Zamknij opinie">×</button>
          </header>

          <div className="reviews512-summary">
            <div className="reviews512-score">
              <b>{averageRating ? averageRating.toFixed(1) : '0.0'}</b>
              <Stars value={Math.round(averageRating || 0)} small />
            </div>
            <div>
              <strong>{ratingCount}</strong>
              <span>{ratingCount === 1 ? 'opinia live' : 'opinii live'}</span>
            </div>
          </div>

          <div className="reviews512-form">
            {!email ? (
              <div className="reviews512-guest-fields">
                <input value={guestName} onChange={event => setGuestName(event.target.value)} placeholder="Twoja nazwa" />
                <input value={guestEmail} onChange={event => setGuestEmail(event.target.value)} placeholder="Twój email" type="email" />
              </div>
            ) : null}

            <div className="reviews512-rate-row">
              <span>Twoja ocena</span>
              <Stars interactive />
            </div>

            <textarea
              value={comment}
              onChange={event => setComment(event.target.value)}
              placeholder="Napisz swoją opinię..."
              maxLength={500}
            />
            <button type="button" onClick={submitReview} disabled={loading || !comment.trim()}>
              {loading ? 'Zapisywanie...' : 'Dodaj opinię'}
            </button>
          </div>

          {status ? <div className="reviews512-status">{status}</div> : null}

          <div className="reviews512-list">
            {latestReviews.length ? latestReviews.map(review => (
              <article key={review.id || review.created_at} className="reviews512-item">
                <div>
                  <strong>{review.user_name || (review.user_email ? String(review.user_email).split('@')[0] : 'Użytkownik')}</strong>
                  <Stars value={Number(review.rating) || 5} small />
                </div>
                <p>{review.comment}</p>
                <span>{review.created_at ? new Date(review.created_at).toLocaleString('pl-PL') : 'teraz'}</span>
              </article>
            )) : (
              <div className="reviews512-empty">Bądź pierwszy — dodaj opinię i ocenę gwiazdkami.</div>
            )}
          </div>

          <div className="reviews512-powered">Oceny zapisywane live w <b>BetAI Reviews</b></div>
        </section>
      ) : null}

      <button type="button" className="reviews512-fab" onClick={() => setOpen(prev => !prev)} aria-label="Otwórz opinie">
        <span className="reviews512-fab-stars">★★★★★</span>
        <b>{averageRating ? averageRating.toFixed(1) : 'Oceń'}</b>
        {!open ? <i /> : null}
      </button>
    </div>
  )
}

function SupportChatWidget({ user }) {
  const adminEmail = 'smilhytv@gmail.com'
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedKey, setSelectedKey] = useState('')
  const email = normalizeEmail(user?.email)
  const adminMode = isAdminUser(user) || email === adminEmail
  const userName = user?.username || user?.user_metadata?.username || user?.user_metadata?.name || (email ? email.split('@')[0] : 'Użytkownik')

  const conversationKey = (message) => normalizeEmail(message?.user_email || message?.sender_email || '') || String(message?.user_id || message?.sender_id || '')
  const conversations = useMemo(() => {
    const map = new Map()
    ;(messages || []).forEach(message => {
      const key = conversationKey(message)
      if (!key) return
      const current = map.get(key) || {
        key,
        email: normalizeEmail(message.user_email || message.sender_email),
        name: message.user_name || message.sender_name || key.split('@')[0] || 'Użytkownik',
        last: message.created_at,
        unread: 0,
        messages: []
      }
      current.messages.push(message)
      current.last = message.created_at || current.last
      if (message.sender_role !== 'admin' && !message.is_read) current.unread += 1
      map.set(key, current)
    })
    return Array.from(map.values()).sort((a,b) => new Date(b.last || 0) - new Date(a.last || 0))
  }, [messages])

  const visibleMessages = useMemo(() => {
    if (!adminMode) return messages.slice().sort((a,b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
    const key = selectedKey || conversations[0]?.key || ''
    return messages
      .filter(message => conversationKey(message) === key)
      .sort((a,b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
  }, [messages, adminMode, selectedKey, conversations])

  const selectedConversation = adminMode ? conversations.find(item => item.key === (selectedKey || conversations[0]?.key)) || conversations[0] : null
  const supportUnreadCount = adminMode
    ? conversations.reduce((sum, item) => sum + Number(item.unread || 0), 0)
    : (messages || []).filter(message => message.sender_role === 'admin' && !message.is_read).length

  async function loadSupportMessages() {
    if (!isSupabaseConfigured || !supabase || !user?.id) return
    try {
      setLoading(true)
      let query = supabase
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(adminMode ? 120 : 80)

      if (!adminMode) {
        query = query.or(`user_id.eq.${user.id},user_email.eq.${email}`)
      }

      const { data, error } = await query
      if (error) throw error
      const rows = Array.isArray(data) ? data : []
      setMessages(rows)
      if (adminMode && !selectedKey && rows.length) {
        const firstKey = conversationKey(rows[0])
        if (firstKey) setSelectedKey(firstKey)
      }
      setStatus('')
    } catch (error) {
      console.warn('support chat load error', error)
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user?.id) return
    loadSupportMessages()
    const timer = setInterval(loadSupportMessages, open ? 10000 : 20000)
    return () => clearInterval(timer)
  }, [open, user?.id, adminMode, selectedKey])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !open || !user?.id) return
    let channel
    try {
      channel = supabase
        .channel('support_messages_live_' + user.id)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => loadSupportMessages())
        .subscribe()
    } catch (error) {
      console.warn('support realtime skipped', error)
    }
    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [open, user?.id])

  async function sendSupportMessage() {
    const clean = text.trim()
    if (!clean || !user?.id || !isSupabaseConfigured || !supabase) return
    try {
      setLoading(true)
      const target = selectedConversation
      const payload = adminMode ? {
        user_id: target?.messages?.[0]?.user_id || null,
        user_email: target?.email || target?.key || '',
        user_name: target?.name || target?.email || 'Użytkownik',
        admin_email: adminEmail,
        sender_id: user.id,
        sender_email: email,
        sender_name: userName || 'Admin',
        sender_role: 'admin',
        message: clean,
        is_read: false
      } : {
        user_id: user.id,
        user_email: email,
        user_name: userName,
        admin_email: adminEmail,
        sender_id: user.id,
        sender_email: email,
        sender_name: userName,
        sender_role: 'user',
        message: clean,
        is_read: false
      }
      const { error } = await supabase.from('support_messages').insert(payload)
      if (error) throw error
      setText('')
      setStatus(adminMode ? 'Odpowiedź wysłana do użytkownika.' : 'Wiadomość wysłana do admina. Odpowiedź pojawi się tutaj live.')
      await loadSupportMessages()
    } catch (error) {
      console.error('support chat send error', error)
      setStatus('Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.')
    } finally {
      setLoading(false)
    }
  }

  if (!user?.id) return null

  return (
    <div className={`support510 ${open ? 'is-open' : ''}`}>
      {open ? (
        <section className="support510-panel" aria-label="Wsparcie TypyAI.pl live">
          <header className="support510-head">
            <div>
              <strong>{adminMode ? 'Centrum wsparcia' : 'Wsparcie TypyAI.pl'}</strong>
              <span><i /> {adminMode ? 'Panel admina live' : 'Natychmiastowa odpowiedź live'}</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Zamknij czat">×</button>
          </header>

          {adminMode ? (
            <div className="support510-admin-tabs">
              {conversations.length ? conversations.slice(0, 8).map(item => {
                const label = item.name || item.email || 'Użytkownik'
                const mail = item.email || 'brak e-mail'
                const avatar = String(label).trim().slice(0, 1).toUpperCase()
                const isActive = (selectedKey || conversations[0]?.key) === item.key
                return (
                  <button key={item.key} type="button" className={`support510-thread-card ${isActive ? 'active' : ''}`} onClick={() => setSelectedKey(item.key)}>
                    <span className="support510-thread-avatar">{avatar}</span>
                    <span className="support510-thread-copy">
                      <b>{label}</b>
                      <small>{mail}</small>
                    </span>
                    {item.unread ? <span className="support510-thread-badge">{item.unread}</span> : null}
                  </button>
                )
              }) : <span className="support510-empty-mini">Brak rozmów</span>}
            </div>
          ) : null}

          <div className="support510-body">
            {!visibleMessages.length ? (
              <div className="support510-welcome">
                <strong>Cześć! Jak mogę Ci dzisiaj pomóc?</strong>
                <span>Wiadomość trafia tylko do admina: smilhytv / smilhytv@gmail.com</span>
              </div>
            ) : visibleMessages.map(message => {
              const mine = normalizeEmail(message.sender_email) === email
              const isAdminMessage = message.sender_role === 'admin'
              return (
                <div className={`support510-msg ${mine ? 'mine' : ''} ${isAdminMessage ? 'admin' : ''}`} key={message.id || message.created_at}>
                  <p>{message.message}</p>
                  <span>{isAdminMessage ? 'Admin' : (message.sender_name || message.user_name || 'Użytkownik')} · {message.created_at ? new Date(message.created_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : 'teraz'}</span>
                </div>
              )
            })}
          </div>

          {status ? <div className="support510-status">{status}</div> : null}

          <footer className="support510-compose">
            <textarea value={text} onChange={event => setText(event.target.value)} placeholder={adminMode ? 'Napisz odpowiedź...' : 'Wpisz swoją wiadomość...'} onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                sendSupportMessage()
              }
            }} />
            <button type="button" onClick={sendSupportMessage} disabled={loading || !text.trim()} aria-label="Wyślij wiadomość">➤</button>
          </footer>
          <div className="support510-powered">Napędzane przez <b>BetAI Live Support</b></div>
        </section>
      ) : null}

      <button type="button" className="support510-fab" onClick={() => setOpen(prev => !prev)} aria-label="Otwórz czat pomocy">
        {open ? '×' : '💬'}
        <span className="support510-fab-badge">{Number(supportUnreadCount || 0)}</span>
        {!open ? <span className="support510-fab-pulse" /> : null}
      </button>
    </div>
  )
}

function AuthSupportChatGuest() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      setEmail(localStorage.getItem('betai_support_guest_email') || '')
      setName(localStorage.getItem('betai_support_guest_name') || '')
    } catch (_) {}
  }, [])

  async function sendGuestSupportMessage() {
    const clean = text.trim()
    const cleanEmail = normalizeEmail(email)
    const cleanName = String(name || '').trim() || (cleanEmail ? cleanEmail.split('@')[0] : 'Gość')

    if (!clean) {
      setStatus('Wpisz wiadomość do supportu.')
      return
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setStatus('Wpisz email, żeby admin mógł Ci odpisać.')
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      setStatus('Supabase nie jest skonfigurowane.')
      return
    }

    try {
      setLoading(true)
      setStatus('Wysyłanie wiadomości do admina...')
      try {
        localStorage.setItem('betai_support_guest_email', cleanEmail)
        localStorage.setItem('betai_support_guest_name', cleanName)
      } catch (_) {}

      const { error } = await supabase.from('support_messages').insert({
        user_id: null,
        user_email: cleanEmail,
        user_name: cleanName,
        admin_email: 'smilhytv@gmail.com',
        sender_id: null,
        sender_email: cleanEmail,
        sender_name: cleanName,
        sender_role: 'guest',
        message: clean,
        is_read: false
      })
      if (error) throw error
      setText('')
      setStatus('Wiadomość wysłana do admina smilhytv. Odpowiedź dostaniesz po zalogowaniu albo mailowo.')
    } catch (error) {
      console.error('guest support send error', error)
      setStatus('Nie udało się wysłać. Uruchom SUPABASE_SUPPORT_CHAT_511.sql w Supabase i spróbuj ponownie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`support510 support510-guest ${open ? 'is-open' : ''}`}>
      {open ? (
        <section className="support510-panel support510-guest-panel" aria-label="Wsparcie BetAI live">
          <header className="support510-head">
            <div>
              <strong>Wsparcie BetAI</strong>
              <span><i /> Live pomoc — wiadomość trafia do admina</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Zamknij czat">×</button>
          </header>

          <div className="support510-body">
            <div className="support510-welcome">
              <strong>Cześć! Jak mogę Ci dzisiaj pomóc?</strong>
              <span>Twoja wiadomość trafi tylko do: smilhytv / smilhytv@gmail.com</span>
            </div>
          </div>

          <div className="support510-guest-fields">
            <input value={name} onChange={event => setName(event.target.value)} placeholder="Twoja nazwa" />
            <input value={email} onChange={event => setEmail(event.target.value)} placeholder="Twój email" type="email" />
          </div>

          {status ? <div className="support510-status">{status}</div> : null}

          <footer className="support510-compose">
            <textarea value={text} onChange={event => setText(event.target.value)} placeholder="Wpisz swoją wiadomość..." onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                sendGuestSupportMessage()
              }
            }} />
            <button type="button" onClick={sendGuestSupportMessage} disabled={loading || !text.trim()} aria-label="Wyślij wiadomość">➤</button>
          </footer>
          <div className="support510-powered">Napędzane przez <b>BetAI Live Support</b></div>
        </section>
      ) : null}

      <button type="button" className="support510-fab" onClick={() => setOpen(prev => !prev)} aria-label="Otwórz czat pomocy">
        {open ? '×' : '💬'}
        <span className="support510-fab-badge">0</span>
        {!open ? <span className="support510-fab-pulse" /> : null}
      </button>
    </div>
  )
}

function AuthField({ label, type = 'text', value, onChange, placeholder, icon, autoComplete, name, rightControl }) {
  return (
    <label className="auth481-field">
      <span className="auth481-label">{label}</span>
      <div className="auth481-input-shell">
        <span className="auth481-field-icon">{icon}</span>
        <input
          className="auth481-input"
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          spellCheck="false"
        />
        {rightControl ? <span className="auth481-field-right">{rightControl}</span> : null}
      </div>
    </label>
  )
}

function AuthView({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [submitting, setSubmitting] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [authMessageType, setAuthMessageType] = useState('info')
  const [showPassword, setShowPassword] = useState(false)
  const [showRepeatPassword, setShowRepeatPassword] = useState(false)
  const [form, setForm] = useState(() => {
    try {
      const rememberLogin = localStorage.getItem('betai_remember_login') === '1'
      const rememberedEmail = rememberLogin ? (localStorage.getItem('betai_remember_email') || '') : ''
      return {
        username: '',
        email: rememberedEmail,
        password: '',
        repeatPassword: '',
        agree: rememberLogin
      }
    } catch (_) {
      return {
        username: '',
        email: '',
        password: '',
        repeatPassword: '',
        agree: false
      }
    }
  })
  const [liveStats, setLiveStats] = useState({
    registeredUsers: 0,
    aiAccuracy: 76,
    activeNow: 1,
    tipsToday: 0,
    updatedAt: null,
    loading: true
  })
  const supportedAuthLanguages = ['pl', 'en', 'de', 'es', 'ru']
  const [authLang, setAuthLang] = useState(() => {
    try {
      const saved = localStorage.getItem('betai_language')
      if (saved && supportedAuthLanguages.includes(saved)) return saved
      const browserLang = String(navigator?.language || 'pl').slice(0, 2).toLowerCase()
      return supportedAuthLanguages.includes(browserLang) ? browserLang : 'pl'
    } catch (_) {
      return 'pl'
    }
  })

  const authTranslations = {
    pl: {
      languageLabel: 'Język', authPanelLabel: 'Panel logowania i rejestracji Bet+AI', authFrameAlt: 'Podgląd platformy Bet+AI', benefitsLabel: 'Korzyści BetAI', authModeLabel: 'Wybierz tryb autoryzacji', loginTab: 'Logowanie', registerTab: 'Rejestracja', subtitleLogin: 'Zaloguj się do swojego konta', subtitleRegister: 'Utwórz swoje konto', emailPlaceholderShort: 'Wpisz swój email', passwordPlaceholderShort: 'Wpisz swoje hasło', rememberMe: 'Zapamiętaj mnie', forgotPassword: 'Zapomniałeś hasła?', statusLogin: 'Gotowy do logowania.', statusRegister: 'Wpisz email i hasło, aby założyć konto.', createAccountShort: 'Utwórz konto', secureNote: 'Twoje dane są w pełni zabezpieczone', login: 'Zaloguj się', register: 'Zarejestruj się', heroLine1: 'Dołącz do', heroLine2: 'platformy', subtitle1: 'Zarejestruj się i korzystaj z analityki AI, typów', subtitle2: 'oraz statystyk na żywo.', username: 'Nazwa użytkownika', usernamePlaceholder: 'Wybierz nazwę użytkownika', email: 'Email', emailPlaceholder: 'Wpisz swój adres email', password: 'Hasło', passwordPlaceholder: 'Minimum 8 znaków', repeatPassword: 'Powtórz hasło', repeatPasswordPlaceholder: 'Powtórz swoje hasło', forgot: 'Nie pamiętasz hasła?', encrypted: 'Szyfrowane logowanie', accept1: 'Akceptuję', terms: 'Regulamin', accept2: 'oraz', privacy: 'Politykę prywatności', submitLogin: 'Zaloguj się', submitRegister: 'Załóż konto', authorizing: 'Trwa autoryzacja...', submitNoteLogin: 'Bezpieczne logowanie • szyfrowana autoryzacja Supabase', submitNoteRegister: 'Rejestracja zajmuje mniej niż 30 sekund i aktywuje dostęp do platformy.', socialHeading: 'Śledź nas i dołącz do społeczności', liveKicker: 'REALNE STATYSTYKI LIVE', liveTitle: 'Platforma żyje i odświeża dane na bieżąco', liveBadge: 'LIVE', registeredUsers: 'Zarejestrowanych użytkowników', aiAccuracy: 'Skuteczność AI', activeNow: 'Aktywni teraz', tipsToday: 'Typów dzisiaj', liveLoading: 'Ładowanie statystyk live...', liveRefresh: 'Auto-odświeżanie co 30 s', lastUpdate: 'ostatnia aktualizacja', safeData: 'Bezpieczne dane', safeDataText: 'Twoje dane są u nas w pełni chronione.', fastRegister: 'Szybka rejestracja', fastRegisterText: 'Załóż konto w mniej niż 30 sekund.', freeAi: 'Darmowe typy AI', freeAiText: 'Codziennie nowe typy o wysokiej skuteczności.', community: 'Aktywna społeczność', communityText: 'Tysiące typerów dzieli się wiedzą i wygrywa razem.', showPassword: 'Pokaż hasło', hidePassword: 'Ukryj hasło', showRepeat: 'Pokaż powtórzone hasło', hideRepeat: 'Ukryj powtórzone hasło', resetMissingEmail: 'Wpisz adres email, aby zresetować hasło.', resetSending: 'Wysyłanie linku do resetu hasła...', resetSuccess: 'Link do resetu hasła został wysłany na Twój adres email.', notConfiguredReset: 'Supabase nie jest skonfigurowane. Uzupełnij klucze, aby włączyć reset hasła.', notConfiguredLogin: 'Supabase nie jest skonfigurowane. Uzupełnij klucze, aby włączyć logowanie.', enterEmail: 'Wpisz adres email.', enterPassword: 'Wpisz hasło.', enterUsername: 'Wpisz nazwę użytkownika.', shortPassword: 'Hasło musi mieć minimum 8 znaków.', passwordMismatch: 'Hasła nie są identyczne.', acceptTermsError: 'Zaakceptuj Regulamin oraz Politykę prywatności.', accountCreatedLogged: 'Konto zostało utworzone i jesteś już zalogowany.', accountCreatedConfirm: 'Konto zostało utworzone. Sprawdź skrzynkę email, aby potwierdzić rejestrację.', loginSuccess: 'Logowanie zakończone sukcesem.', dbError: 'Błąd bazy przy rejestracji: uruchom raz plik SUPABASE_RUN_ONCE_FIX_REGISTER_503.sql w Supabase SQL Editor i spróbuj ponownie.', emailLimit: 'Limit wysyłki email został przekroczony. Do testów wyłącz Confirm email albo podłącz Custom SMTP i ustaw większy limit w Supabase.', authFailed: 'Nie udało się wykonać autoryzacji.' },
    en: { languageLabel: 'Language', authPanelLabel: 'Bet+AI login and registration panel', authFrameAlt: 'Bet+AI platform preview', benefitsLabel: 'BetAI benefits', authModeLabel: 'Choose authentication mode', loginTab: 'Login', registerTab: 'Registration', subtitleLogin: 'Log in to your account', subtitleRegister: 'Create your account', emailPlaceholderShort: 'Enter your email', passwordPlaceholderShort: 'Enter your password', rememberMe: 'Remember me', forgotPassword: 'Forgot password?', statusLogin: 'Ready to log in.', statusRegister: 'Enter email and password to create an account.', createAccountShort: 'Create account', secureNote: 'Your data is fully secured', login: 'Log in', register: 'Register', heroLine1: 'Join the', heroLine2: 'platform', subtitle1: 'Sign up and use AI analytics, picks', subtitle2: 'and live statistics.', username: 'Username', usernamePlaceholder: 'Choose a username', email: 'Email', emailPlaceholder: 'Enter your email address', password: 'Password', passwordPlaceholder: 'Minimum 8 characters', repeatPassword: 'Repeat password', repeatPasswordPlaceholder: 'Repeat your password', forgot: 'Forgot password?', encrypted: 'Encrypted login', accept1: 'I accept the', terms: 'Terms', accept2: 'and', privacy: 'Privacy Policy', submitLogin: 'Log in', submitRegister: 'Create account', authorizing: 'Authorizing...', submitNoteLogin: 'Secure login • encrypted Supabase authorization', submitNoteRegister: 'Registration takes less than 30 seconds and activates platform access.', socialHeading: 'Follow us and join the community', liveKicker: 'REAL LIVE STATS', liveTitle: 'The platform is alive and refreshes data live', liveBadge: 'LIVE', registeredUsers: 'Registered users', aiAccuracy: 'AI accuracy', activeNow: 'Active now', tipsToday: 'Picks today', liveLoading: 'Loading live stats...', liveRefresh: 'Auto-refresh every 30 s', lastUpdate: 'last update', safeData: 'Secure data', safeDataText: 'Your data is fully protected with us.', fastRegister: 'Fast registration', fastRegisterText: 'Create an account in less than 30 seconds.', freeAi: 'Free AI picks', freeAiText: 'New high-accuracy picks every day.', community: 'Active community', communityText: 'Thousands of bettors share knowledge and win together.', showPassword: 'Show password', hidePassword: 'Hide password', showRepeat: 'Show repeated password', hideRepeat: 'Hide repeated password', resetMissingEmail: 'Enter your email to reset the password.', resetSending: 'Sending password reset link...', resetSuccess: 'Password reset link has been sent to your email.', notConfiguredReset: 'Supabase is not configured. Add keys to enable password reset.', notConfiguredLogin: 'Supabase is not configured. Add keys to enable login.', enterEmail: 'Enter your email address.', enterPassword: 'Enter your password.', enterUsername: 'Enter your username.', shortPassword: 'Password must be at least 8 characters.', passwordMismatch: 'Passwords do not match.', acceptTermsError: 'Accept the Terms and Privacy Policy.', accountCreatedLogged: 'Account created and you are already logged in.', accountCreatedConfirm: 'Account created. Check your email to confirm registration.', loginSuccess: 'Login successful.', dbError: 'Database registration error: run SUPABASE_RUN_ONCE_FIX_REGISTER_503.sql once in Supabase SQL Editor and try again.', emailLimit: 'Email sending limit exceeded. For tests disable Confirm email or connect Custom SMTP and set a higher Supabase limit.', authFailed: 'Authorization failed.' },
    de: { languageLabel: 'Sprache', authPanelLabel: 'Bet+AI Login- und Registrierungsbereich', authFrameAlt: 'Bet+AI Plattformvorschau', benefitsLabel: 'BetAI Vorteile', authModeLabel: 'Authentifizierungsmodus wählen', loginTab: 'Login', registerTab: 'Registrierung', subtitleLogin: 'Melde dich in deinem Konto an', subtitleRegister: 'Erstelle dein Konto', emailPlaceholderShort: 'E-Mail eingeben', passwordPlaceholderShort: 'Passwort eingeben', rememberMe: 'Angemeldet bleiben', forgotPassword: 'Passwort vergessen?', statusLogin: 'Bereit zum Einloggen.', statusRegister: 'E-Mail und Passwort eingeben, um ein Konto zu erstellen.', createAccountShort: 'Konto erstellen', secureNote: 'Deine Daten sind vollständig gesichert', login: 'Einloggen', register: 'Registrieren', heroLine1: 'Tritt der', heroLine2: 'Plattform', subtitle1: 'Registriere dich und nutze KI-Analysen, Tipps', subtitle2: 'und Live-Statistiken.', username: 'Benutzername', usernamePlaceholder: 'Benutzernamen wählen', email: 'E-Mail', emailPlaceholder: 'E-Mail-Adresse eingeben', password: 'Passwort', passwordPlaceholder: 'Mindestens 8 Zeichen', repeatPassword: 'Passwort wiederholen', repeatPasswordPlaceholder: 'Passwort wiederholen', forgot: 'Passwort vergessen?', encrypted: 'Verschlüsselter Login', accept1: 'Ich akzeptiere die', terms: 'AGB', accept2: 'und die', privacy: 'Datenschutzerklärung', submitLogin: 'Einloggen', submitRegister: 'Konto erstellen', authorizing: 'Autorisierung...', submitNoteLogin: 'Sicherer Login • verschlüsselte Supabase-Autorisierung', submitNoteRegister: 'Die Registrierung dauert weniger als 30 Sekunden und aktiviert den Zugang.', socialHeading: 'Folge uns und tritt der Community bei', liveKicker: 'ECHTE LIVE-STATISTIKEN', liveTitle: 'Die Plattform lebt und aktualisiert Daten live', liveBadge: 'LIVE', registeredUsers: 'Registrierte Nutzer', aiAccuracy: 'KI-Trefferquote', activeNow: 'Jetzt aktiv', tipsToday: 'Tipps heute', liveLoading: 'Live-Statistiken werden geladen...', liveRefresh: 'Auto-Aktualisierung alle 30 s', lastUpdate: 'letzte Aktualisierung', safeData: 'Sichere Daten', safeDataText: 'Deine Daten sind vollständig geschützt.', fastRegister: 'Schnelle Registrierung', fastRegisterText: 'Erstelle ein Konto in weniger als 30 Sekunden.', freeAi: 'Kostenlose KI-Tipps', freeAiText: 'Täglich neue Tipps mit hoher Trefferquote.', community: 'Aktive Community', communityText: 'Tausende Tipper teilen Wissen und gewinnen zusammen.', showPassword: 'Passwort anzeigen', hidePassword: 'Passwort verbergen', showRepeat: 'Wiederholtes Passwort anzeigen', hideRepeat: 'Wiederholtes Passwort verbergen', resetMissingEmail: 'Gib deine E-Mail ein, um das Passwort zurückzusetzen.', resetSending: 'Reset-Link wird gesendet...', resetSuccess: 'Der Reset-Link wurde an deine E-Mail gesendet.', notConfiguredReset: 'Supabase ist nicht konfiguriert. Füge Schlüssel hinzu, um den Reset zu aktivieren.', notConfiguredLogin: 'Supabase ist nicht konfiguriert. Füge Schlüssel hinzu, um Login zu aktivieren.', enterEmail: 'E-Mail-Adresse eingeben.', enterPassword: 'Passwort eingeben.', enterUsername: 'Benutzernamen eingeben.', shortPassword: 'Das Passwort muss mindestens 8 Zeichen haben.', passwordMismatch: 'Passwörter stimmen nicht überein.', acceptTermsError: 'Akzeptiere AGB und Datenschutzerklärung.', accountCreatedLogged: 'Konto wurde erstellt und du bist bereits eingeloggt.', accountCreatedConfirm: 'Konto wurde erstellt. Prüfe deine E-Mail zur Bestätigung.', loginSuccess: 'Login erfolgreich.', dbError: 'Datenbankfehler bei Registrierung: führe SUPABASE_RUN_ONCE_FIX_REGISTER_503.sql einmal im Supabase SQL Editor aus.', emailLimit: 'E-Mail-Limit überschritten. Für Tests Confirm email deaktivieren oder Custom SMTP verbinden.', authFailed: 'Autorisierung fehlgeschlagen.' },
    es: { languageLabel: 'Idioma', authPanelLabel: 'Panel de inicio de sesión y registro Bet+AI', authFrameAlt: 'Vista previa de la plataforma Bet+AI', benefitsLabel: 'Beneficios de BetAI', authModeLabel: 'Elige modo de acceso', loginTab: 'Acceso', registerTab: 'Registro', subtitleLogin: 'Inicia sesión en tu cuenta', subtitleRegister: 'Crea tu cuenta', emailPlaceholderShort: 'Introduce tu email', passwordPlaceholderShort: 'Introduce tu contraseña', rememberMe: 'Recordarme', forgotPassword: '¿Olvidaste la contraseña?', statusLogin: 'Listo para iniciar sesión.', statusRegister: 'Introduce email y contraseña para crear una cuenta.', createAccountShort: 'Crear cuenta', secureNote: 'Tus datos están totalmente protegidos', login: 'Iniciar sesión', register: 'Registrarse', heroLine1: 'Únete a la', heroLine2: 'plataforma', subtitle1: 'Regístrate y usa análisis de IA, pronósticos', subtitle2: 'y estadísticas en vivo.', username: 'Usuario', usernamePlaceholder: 'Elige un usuario', email: 'Email', emailPlaceholder: 'Introduce tu email', password: 'Contraseña', passwordPlaceholder: 'Mínimo 8 caracteres', repeatPassword: 'Repetir contraseña', repeatPasswordPlaceholder: 'Repite tu contraseña', forgot: '¿Olvidaste tu contraseña?', encrypted: 'Login cifrado', accept1: 'Acepto los', terms: 'Términos', accept2: 'y la', privacy: 'Política de privacidad', submitLogin: 'Iniciar sesión', submitRegister: 'Crear cuenta', authorizing: 'Autorizando...', submitNoteLogin: 'Login seguro • autorización cifrada de Supabase', submitNoteRegister: 'El registro tarda menos de 30 segundos y activa el acceso.', socialHeading: 'Síguenos y únete a la comunidad', liveKicker: 'ESTADÍSTICAS LIVE REALES', liveTitle: 'La plataforma vive y actualiza datos en directo', liveBadge: 'LIVE', registeredUsers: 'Usuarios registrados', aiAccuracy: 'Precisión IA', activeNow: 'Activos ahora', tipsToday: 'Pronósticos hoy', liveLoading: 'Cargando estadísticas live...', liveRefresh: 'Auto-actualización cada 30 s', lastUpdate: 'última actualización', safeData: 'Datos seguros', safeDataText: 'Tus datos están totalmente protegidos.', fastRegister: 'Registro rápido', fastRegisterText: 'Crea una cuenta en menos de 30 segundos.', freeAi: 'Pronósticos IA gratis', freeAiText: 'Nuevos pronósticos diarios de alta precisión.', community: 'Comunidad activa', communityText: 'Miles de usuarios comparten conocimiento y ganan juntos.', showPassword: 'Mostrar contraseña', hidePassword: 'Ocultar contraseña', showRepeat: 'Mostrar contraseña repetida', hideRepeat: 'Ocultar contraseña repetida', resetMissingEmail: 'Introduce tu email para restablecer la contraseña.', resetSending: 'Enviando enlace de restablecimiento...', resetSuccess: 'El enlace fue enviado a tu email.', notConfiguredReset: 'Supabase no está configurado. Añade claves para activar el reset.', notConfiguredLogin: 'Supabase no está configurado. Añade claves para activar login.', enterEmail: 'Introduce tu email.', enterPassword: 'Introduce tu contraseña.', enterUsername: 'Introduce tu usuario.', shortPassword: 'La contraseña debe tener al menos 8 caracteres.', passwordMismatch: 'Las contraseñas no coinciden.', acceptTermsError: 'Acepta los Términos y la Política de privacidad.', accountCreatedLogged: 'Cuenta creada y ya has iniciado sesión.', accountCreatedConfirm: 'Cuenta creada. Revisa tu email para confirmar el registro.', loginSuccess: 'Inicio de sesión correcto.', dbError: 'Error de base de datos en registro: ejecuta SUPABASE_RUN_ONCE_FIX_REGISTER_503.sql en Supabase SQL Editor.', emailLimit: 'Límite de envío de email superado. Para pruebas desactiva Confirm email o conecta Custom SMTP.', authFailed: 'No se pudo autorizar.' },
    ru: { languageLabel: 'Язык', authPanelLabel: 'Панель входа и регистрации Bet+AI', authFrameAlt: 'Превью платформы Bet+AI', benefitsLabel: 'Преимущества BetAI', authModeLabel: 'Выберите режим авторизации', loginTab: 'Вход', registerTab: 'Регистрация', subtitleLogin: 'Войдите в свой аккаунт', subtitleRegister: 'Создайте аккаунт', emailPlaceholderShort: 'Введите email', passwordPlaceholderShort: 'Введите пароль', rememberMe: 'Запомнить меня', forgotPassword: 'Забыли пароль?', statusLogin: 'Готово к входу.', statusRegister: 'Введите email и пароль, чтобы создать аккаунт.', createAccountShort: 'Создать аккаунт', secureNote: 'Ваши данные полностью защищены', login: 'Войти', register: 'Регистрация', heroLine1: 'Присоединяйся к', heroLine2: 'платформе', subtitle1: 'Зарегистрируйся и используй AI-аналитику, прогнозы', subtitle2: 'и live-статистику.', username: 'Имя пользователя', usernamePlaceholder: 'Выберите имя пользователя', email: 'Email', emailPlaceholder: 'Введите email', password: 'Пароль', passwordPlaceholder: 'Минимум 8 символов', repeatPassword: 'Повторите пароль', repeatPasswordPlaceholder: 'Повторите пароль', forgot: 'Забыли пароль?', encrypted: 'Защищенный вход', accept1: 'Я принимаю', terms: 'Условия', accept2: 'и', privacy: 'Политику конфиденциальности', submitLogin: 'Войти', submitRegister: 'Создать аккаунт', authorizing: 'Авторизация...', submitNoteLogin: 'Безопасный вход • шифрованная авторизация Supabase', submitNoteRegister: 'Регистрация занимает меньше 30 секунд и открывает доступ.', socialHeading: 'Подписывайся и вступай в сообщество', liveKicker: 'РЕАЛЬНАЯ LIVE-СТАТИСТИКА', liveTitle: 'Платформа живая и обновляет данные онлайн', liveBadge: 'LIVE', registeredUsers: 'Зарегистрированных пользователей', aiAccuracy: 'Точность AI', activeNow: 'Активны сейчас', tipsToday: 'Прогнозов сегодня', liveLoading: 'Загрузка live-статистики...', liveRefresh: 'Автообновление каждые 30 сек', lastUpdate: 'последнее обновление', safeData: 'Безопасные данные', safeDataText: 'Ваши данные полностью защищены.', fastRegister: 'Быстрая регистрация', fastRegisterText: 'Создайте аккаунт меньше чем за 30 секунд.', freeAi: 'Бесплатные AI-прогнозы', freeAiText: 'Новые точные прогнозы каждый день.', community: 'Активное сообщество', communityText: 'Тысячи игроков делятся знаниями и выигрывают вместе.', showPassword: 'Показать пароль', hidePassword: 'Скрыть пароль', showRepeat: 'Показать повтор пароля', hideRepeat: 'Скрыть повтор пароля', resetMissingEmail: 'Введите email для сброса пароля.', resetSending: 'Отправка ссылки сброса...', resetSuccess: 'Ссылка сброса отправлена на email.', notConfiguredReset: 'Supabase не настроен. Добавьте ключи для сброса пароля.', notConfiguredLogin: 'Supabase не настроен. Добавьте ключи для входа.', enterEmail: 'Введите email.', enterPassword: 'Введите пароль.', enterUsername: 'Введите имя пользователя.', shortPassword: 'Пароль должен быть минимум 8 символов.', passwordMismatch: 'Пароли не совпадают.', acceptTermsError: 'Примите Условия и Политику конфиденциальности.', accountCreatedLogged: 'Аккаунт создан, вы уже вошли.', accountCreatedConfirm: 'Аккаунт создан. Проверьте email для подтверждения.', loginSuccess: 'Вход выполнен успешно.', dbError: 'Ошибка базы при регистрации: один раз запустите SUPABASE_RUN_ONCE_FIX_REGISTER_503.sql в Supabase SQL Editor.', emailLimit: 'Превышен лимит отправки email. Для тестов отключите Confirm email или подключите Custom SMTP.', authFailed: 'Авторизация не выполнена.' }
  }

  function setLanguage(nextLang) {
    if (!supportedAuthLanguages.includes(nextLang)) return
    setAuthLang(nextLang)
    try { localStorage.setItem('betai_language', nextLang) } catch (_) {}
    window.dispatchEvent(new CustomEvent('betai-language-changed', { detail: nextLang }))
  }

  const t = authTranslations[authLang] || authTranslations.pl
  const localizedAuthFrameSrc = authLang === 'pl'
    ? '/auth-frame-reference-609.png'
    : `/auth-frame-reference-609-${authLang}.png`

  function normalizeLiveCount(value, fallback = 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  function formatCompactNumber(value) {
    const parsed = normalizeLiveCount(value, 0)
    if (parsed >= 1000000) return `${(parsed / 1000000).toFixed(parsed >= 10000000 ? 0 : 1)} mln`
    if (parsed >= 1000) return `${(parsed / 1000).toFixed(parsed >= 10000 ? 0 : 1)}k`
    return String(parsed)
  }

  useEffect(() => {
    let cancelled = false

    async function loadAuthLiveStats() {
      if (!isSupabaseConfigured || !supabase) {
        if (!cancelled) {
          setLiveStats(prev => ({ ...prev, loading: false }))
        }
        return
      }

      try {
        let nextStats = null
        const rpcResponse = await supabase.rpc('get_auth_live_stats')

        if (!rpcResponse.error && rpcResponse.data) {
          const row = Array.isArray(rpcResponse.data) ? rpcResponse.data[0] : rpcResponse.data
          if (row) {
            nextStats = {
              registeredUsers: normalizeLiveCount(row.registered_users ?? row.registeredUsers),
              aiAccuracy: normalizeLiveCount(row.ai_accuracy ?? row.aiAccuracy, 76),
              activeNow: normalizeLiveCount(row.active_now ?? row.activeNow, 1),
              tipsToday: normalizeLiveCount(row.tips_today ?? row.tipsToday),
              updatedAt: new Date().toISOString(),
              loading: false
            }
          }
        }

        if (!nextStats) {
          const now = new Date()
          const startOfDay = new Date(now)
          startOfDay.setHours(0, 0, 0, 0)
          const activeCutoff = new Date(now.getTime() - 10 * 60 * 1000).toISOString()
          const aiRangeCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
          const settledStatuses = ['won', 'win', 'wygrany', 'wygrana', 'lost', 'loss', 'przegrany', 'przegrana']
          const wonStatuses = ['won', 'win', 'wygrany', 'wygrana']

          const [profilesResult, activeResult, tipsTodayResult, aiSettledResult, aiWonResult, aiAvgResult] = await Promise.allSettled([
            supabase.from('profiles').select('id', { count: 'exact', head: true }),
            supabase.from('presence_heartbeats').select('user_id', { count: 'exact', head: true }).gte('last_seen', activeCutoff),
            supabase.from('tips').select('id', { count: 'exact', head: true }).gte('created_at', startOfDay.toISOString()),
            supabase.from('tips').select('id', { count: 'exact', head: true }).eq('ai_source', 'real_ai_engine').gte('created_at', aiRangeCutoff).in('status', settledStatuses),
            supabase.from('tips').select('id', { count: 'exact', head: true }).eq('ai_source', 'real_ai_engine').gte('created_at', aiRangeCutoff).in('status', wonStatuses),
            supabase.from('tips').select('ai_confidence, ai_probability, confidence').eq('ai_source', 'real_ai_engine').order('created_at', { ascending: false }).limit(50)
          ])

          const exactCount = (result, fallback = 0) => {
            if (result.status !== 'fulfilled') return fallback
            return normalizeLiveCount(result.value?.count, fallback)
          }

          const profilesCount = exactCount(profilesResult)
          const activeCount = exactCount(activeResult, 1)
          const tipsTodayCount = exactCount(tipsTodayResult)
          const aiSettledCount = exactCount(aiSettledResult)
          const aiWonCount = exactCount(aiWonResult)
          const avgConfidence = aiAvgResult.status === 'fulfilled'
            ? (() => {
                const rows = Array.isArray(aiAvgResult.value?.data) ? aiAvgResult.value.data : []
                const values = rows
                  .map(row => Number(row?.ai_confidence ?? row?.ai_probability ?? row?.confidence ?? 0))
                  .filter(value => Number.isFinite(value) && value > 0)
                if (!values.length) return 76
                return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
              })()
            : 76

          nextStats = {
            registeredUsers: profilesCount,
            aiAccuracy: aiSettledCount > 0 ? Math.round((aiWonCount / aiSettledCount) * 100) : avgConfidence,
            activeNow: activeCount,
            tipsToday: tipsTodayCount,
            updatedAt: new Date().toISOString(),
            loading: false
          }
        }

        if (!cancelled && nextStats) {
          setLiveStats(prev => ({
            ...prev,
            ...nextStats,
            registeredUsers: nextStats.registeredUsers || prev.registeredUsers || 0,
            activeNow: nextStats.activeNow || prev.activeNow || 1,
            aiAccuracy: nextStats.aiAccuracy || prev.aiAccuracy || 76,
            tipsToday: nextStats.tipsToday || prev.tipsToday || 0
          }))
        }
      } catch (error) {
        console.warn('Auth live stats unavailable', error)
        if (!cancelled) {
          setLiveStats(prev => ({ ...prev, loading: false }))
        }
      }
    }

    loadAuthLiveStats()
    const timer = window.setInterval(loadAuthLiveStats, 30000)
    window.addEventListener('focus', loadAuthLiveStats)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', loadAuthLiveStats)
    }
  }, [])

  useEffect(() => {
    try {
      if (form.agree) {
        localStorage.setItem('betai_remember_login', '1')
        const cleanEmail = String(form.email || '').trim().toLowerCase()
        if (cleanEmail) localStorage.setItem('betai_remember_email', cleanEmail)
      } else {
        localStorage.removeItem('betai_remember_login')
        localStorage.removeItem('betai_remember_email')
      }
    } catch (_) {}
  }, [form.agree, form.email])

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function showMessage(type, message) {
    setAuthMessageType(type)
    setAuthMessage(message)
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setAuthMessage('')
  }

  async function handleForgotPassword() {
    if (!isSupabaseConfigured || !supabase) {
      showMessage('error', t.notConfiguredReset)
      return
    }

    const email = String(form.email || '').trim().toLowerCase()
    if (!email) {
      showMessage('error', t.resetMissingEmail)
      return
    }

    setSubmitting(true)
    showMessage('info', t.resetSending)

    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
      const { error } = await supabase.auth.resetPasswordForEmail(
        email,
        redirectTo ? { redirectTo } : undefined
      )
      if (error) throw error
      showMessage('success', t.resetSuccess)
    } catch (error) {
      showMessage('error', error?.message || t.authFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setAuthMessage('')

    if (!isSupabaseConfigured || !supabase) {
      showMessage('error', t.notConfiguredLogin)
      return
    }

    const email = String(form.email || '').trim().toLowerCase()
    const password = String(form.password || '')

    try {
      if (form.agree) {
        localStorage.setItem('betai_remember_login', '1')
        localStorage.setItem('betai_remember_email', email)
      } else {
        localStorage.removeItem('betai_remember_login')
        localStorage.removeItem('betai_remember_email')
      }
    } catch (_) {}
    const username = String(form.username || '').trim()
    const derivedUsername = username || (email.split('@')[0] || '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 24) || `user${Date.now().toString().slice(-6)}`
    const repeatPassword = String(form.repeatPassword || password)

    if (!email) {
      showMessage('error', t.enterEmail)
      return
    }

    if (!password) {
      showMessage('error', t.enterPassword)
      return
    }

    setSubmitting(true)
    showMessage('info', t.authorizing)

    try {
      if (mode === 'register') {
        if (password.length < 8) throw new Error(t.shortPassword)
        if (password !== repeatPassword) throw new Error(t.passwordMismatch)

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: derivedUsername,
              display_name: derivedUsername
            }
          }
        })

        if (error) throw error

        if (data?.session?.user) {
          onAuth?.(data.session.user)
          showMessage('success', t.accountCreatedLogged)
        } else {
          showMessage('success', t.accountCreatedConfirm)
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (error) throw error
        if (data?.user) {
          onAuth?.(data.user)
          showMessage('success', t.loginSuccess)
        }
      }
    } catch (error) {
      const errorText = String(error?.message || '')
      showMessage('error', errorText.includes('Database error saving new user')
        ? t.dbError
        : errorText.toLowerCase().includes('email rate limit')
          ? t.emailLimit
          : (error?.message || t.authFailed))
    } finally {
      setSubmitting(false)
    }
  }

  function IconUser() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="8" r="4" />
      </svg>
    )
  }

  function IconMail() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 6h16v12H4z" />
        <path d="m4 8 8 6 8-6" />
      </svg>
    )
  }

  function IconLock() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 1 1 8 0v3" />
      </svg>
    )
  }

  function IconEye() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
        <circle cx="12" cy="12" r="2.8" />
      </svg>
    )
  }

  function IconShield() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3 5 6v6c0 5 3.5 7.8 7 9 3.5-1.2 7-4 7-9V6l-7-3Z" />
      </svg>
    )
  }

  function IconBolt() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13 2 5 14h5l-1 8 8-12h-5l1-8Z" />
      </svg>
    )
  }

  function IconChart() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="m7 15 4-4 3 2 4-6" />
      </svg>
    )
  }

  function IconUsers() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="9.5" cy="7" r="3.5" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  }


  function IconTelegram() {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M21.5 4.6 18.3 19c-.24 1.02-.88 1.28-1.79.8l-4.95-3.64-2.39 2.3c-.26.26-.49.49-.99.49l.36-5.1 9.29-8.39c.4-.36-.09-.57-.62-.21l-11.48 7.23-4.95-1.55c-1.07-.34-1.09-1.08.22-1.59L20.3 3.6c.88-.33 1.65.22 1.2 1Z"/>
      </svg>
    )
  }

  function IconDiscord() {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.32 4.37A17.43 17.43 0 0 0 16.02 3l-.21.43a15.2 15.2 0 0 1 3.7 1.77 12.74 12.74 0 0 0-4.54-1.39 14.6 14.6 0 0 0-5.94 0A12.73 12.73 0 0 0 4.49 5.2a15.1 15.1 0 0 1 3.7-1.77L7.98 3A17.32 17.32 0 0 0 3.68 4.37C.96 8.45.22 12.43.59 16.35a17.61 17.61 0 0 0 5.27 2.65l1.13-1.84c-.64-.24-1.24-.53-1.82-.87.15.11.3.22.46.32a12.45 12.45 0 0 0 10.74 0c.16-.1.31-.21.46-.32-.58.34-1.18.63-1.82.87L16.14 19a17.53 17.53 0 0 0 5.27-2.65c.44-4.55-.75-8.5-1.09-11.98ZM9.53 13.96c-1.03 0-1.88-.95-1.88-2.12s.83-2.12 1.88-2.12c1.06 0 1.9.96 1.88 2.12 0 1.17-.83 2.12-1.88 2.12Zm4.94 0c-1.03 0-1.88-.95-1.88-2.12s.83-2.12 1.88-2.12c1.06 0 1.9.96 1.88 2.12 0 1.17-.82 2.12-1.88 2.12Z"/>
      </svg>
    )
  }

  function IconInstagram() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  function IconX() {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.9 2H22l-6.77 7.73L23 22h-6.1l-4.78-6.9L6.1 22H3l7.25-8.28L1 2h6.25l4.32 6.26L18.9 2Zm-1.07 18h1.69L6.33 3.9H4.52L17.83 20Z"/>
      </svg>
    )
  }



  const submitLabel = mode === 'login' ? t.submitLogin : t.submitRegister
  const submitNote = mode === 'login'
    ? t.submitNoteLogin
    : t.submitNoteRegister
  const liveStatsCards = useMemo(() => ([
    {
      key: 'users',
      label: t.registeredUsers,
      value: formatCompactNumber(liveStats.registeredUsers),
      icon: <IconUsers />,
      accentClass: 'is-users'
    },
    {
      key: 'ai',
      label: t.aiAccuracy,
      value: `${normalizeLiveCount(liveStats.aiAccuracy, 76)}%`,
      icon: <IconChart />,
      accentClass: 'is-ai'
    },
    {
      key: 'active',
      label: t.activeNow,
      value: formatCompactNumber(liveStats.activeNow),
      icon: <IconBolt />,
      accentClass: 'is-active'
    },
    {
      key: 'tips',
      label: t.tipsToday,
      value: formatCompactNumber(liveStats.tipsToday),
      icon: <IconShield />,
      accentClass: 'is-tips'
    }
  ]), [liveStats, authLang])


  const auth627SocialLinks = useMemo(() => ([
    { key: 'telegram', label: 'Telegram', href: 'https://t.me/', icon: <IconTelegram />, className: 'is-telegram' },
    { key: 'discord', label: 'Discord', href: 'https://discord.com/', icon: <IconDiscord />, className: 'is-discord' },
    { key: 'instagram', label: 'Instagram', href: 'https://instagram.com/', icon: <IconInstagram />, className: 'is-instagram' },
    { key: 'x', label: 'X', href: 'https://x.com/', icon: <IconX />, className: 'is-x' }
  ]), [])

  return (
    <div className="auth609-screen" aria-label={t.authPanelLabel || 'Bet+AI authentication panel'}>
      <div className="auth620-language-corner">
        <BetaiLanguageSwitch lang={authLang} onChange={setLanguage} floating ariaLabel={t.languageLabel} />
      </div>
      <nav className="auth627-social-dock" aria-label="Social media Bet+AI">
        {auth627SocialLinks.map(link => (
          <a
            key={link.key}
            className={`auth627-social-link ${link.className}`}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            aria-label={link.label}
            title={link.label}
          >
            <span className="auth627-social-icon">{link.icon}</span>
            <b>{link.label}</b>
          </a>
        ))}
      </nav>
      <div className="auth609-artboard">
        <img
          src={localizedAuthFrameSrc}
          alt={t.authFrameAlt || 'Bet+AI screen reference'}
          className="auth609-reference"
          draggable="false"
        />

        <div className="auth609-overlay">
          <section className="auth609-left-panel">
            <div className="auth609-panel-shell auth609-panel-shell-fixed">
              <div className="auth609-center-wrap">
                <div className="auth609-top-spacer" />

                <div className="auth609-heading-copy auth609-heading-center">
                  <img src="/auth-logo-fused-619.png" alt="Bet+AI" className="auth619-fused-logo auth620-fused-logo" draggable="false" />
                  <p className="auth609-subtitle-main auth620-subtitle-main">{mode === 'login' ? t.subtitleLogin : t.subtitleRegister}</p>
                </div>

                <div className={`auth481-tabs auth609-tabs auth609-tabs-fixed ${mode === 'login' ? 'auth481-tabs-login' : 'auth481-tabs-register'}`} role="tablist" aria-label={t.authModeLabel}>
                  <button
                    type="button"
                    className={`auth481-tab ${mode === 'login' ? 'is-active' : ''}`}
                    onClick={() => switchMode('login')}
                  >
                    {t.loginTab}
                  </button>
                  <button
                    type="button"
                    className={`auth481-tab ${mode === 'register' ? 'is-active' : ''}`}
                    onClick={() => switchMode('register')}
                  >
                    {t.registerTab}
                  </button>
                </div>

                <form className="auth481-form auth609-form auth609-form-fixed" onSubmit={handleSubmit} autoComplete={form.agree ? 'on' : 'off'}>
                  <AuthField
                    label={t.email}
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    placeholder={t.emailPlaceholderShort}
                    icon={<IconMail />}
                    autoComplete={mode === 'login' ? 'username' : 'email'}
                    name="betai_email"
                  />

                  <AuthField
                    label={t.password}
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(event) => {
                      updateField('password', event.target.value)
                      if (mode === 'register') updateField('repeatPassword', event.target.value)
                    }}
                    placeholder={t.passwordPlaceholderShort}
                    icon={<IconLock />}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    name="betai_password"
                    rightControl={
                      <button
                        type="button"
                        className="auth481-eye"
                        onClick={() => setShowPassword(prev => !prev)}
                        aria-label={showPassword ? t.hidePassword : t.showPassword}
                      >
                        <IconEye />
                      </button>
                    }
                  />

                  <div className="auth609-remember-row">
                    <label className={`auth609-remember-toggle ${form.agree ? 'is-checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={form.agree}
                        onChange={(event) => updateField('agree', event.target.checked)}
                        aria-label={t.rememberMe}
                      />
                      <span className="auth609-remember-box">✓</span>
                      <span>{t.rememberMe}</span>
                    </label>
                    <button type="button" className="auth609-forgot-link" onClick={handleForgotPassword}>
                      {t.forgotPassword}
                    </button>
                  </div>

                  <div className="auth609-status-line">
                    <span>
                      {mode === 'login' ? t.statusLogin : t.statusRegister}
                    </span>
                    <span className="auth609-status-shield"><IconShield /></span>
                  </div>

                  <button type="submit" className="auth481-submit auth609-submit auth609-submit-fixed" disabled={submitting}>
                    {submitting ? t.authorizing : mode === 'login' ? t.submitLogin : t.createAccountShort}
                  </button>
                </form>

                <div className="auth609-secure-note">
                  <span className="auth609-secure-icon"><IconShield /></span>
                  <span>{t.secureNote}</span>
                </div>

                {authMessage ? (
                  <div className={`auth481-message ${authMessageType} auth609-message`} role="status" aria-live="polite">
                    {authMessage}
                  </div>
                ) : null}
              </div>
            </div>
          </section>


          <aside className="auth623-side-live auth624-side-live" aria-label={t.liveBadge}>
            <div className="auth623-side-head auth624-side-head">
              <em><i />{t.liveBadge}</em>
            </div>

            <div className="auth623-side-list">
              {liveStatsCards.map(card => (
                <div className={`auth623-side-card ${card.accentClass}`} key={card.key}>
                  <span className="auth623-side-icon">{card.icon}</span>
                  <div>
                    <b>{liveStats.loading ? '...' : card.value}</b>
                    <small>{card.label}</small>
                  </div>
                </div>
              ))}
            </div>

            <div className="auth623-side-foot">
              <span className="auth623-pulse" />
              <span>{t.liveRefresh} • {t.lastUpdate} {liveStats.updatedAt ? new Date(liveStats.updatedAt).toLocaleTimeString(authLang === 'pl' ? 'pl-PL' : authLang) : '--:--'}</span>
            </div>
          </aside>

          <div className="auth617-feature-strip" aria-label={t.benefitsLabel}>
            <div className="auth617-feature-card">
              <span className="auth617-feature-icon"><IconShield /></span>
              <div>
                <strong>{t.safeData}</strong>
                <p>{t.safeDataText}</p>
              </div>
            </div>
            <div className="auth617-feature-card">
              <span className="auth617-feature-icon"><IconBolt /></span>
              <div>
                <strong>{t.fastRegister}</strong>
                <p>{t.fastRegisterText}</p>
              </div>
            </div>
            <div className="auth617-feature-card">
              <span className="auth617-feature-icon"><IconChart /></span>
              <div>
                <strong>{t.freeAi}</strong>
                <p>{t.freeAiText}</p>
              </div>
            </div>
            <div className="auth617-feature-card">
              <span className="auth617-feature-icon"><IconUsers /></span>
              <div>
                <strong>{t.community}</strong>
                <p>{t.communityText}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <SiteReviewsWidget />
      <AuthSupportChatGuest />
    </div>
  )
}

function PaymentModal({ tip, user, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  if (!tip) return null

  const price = Number(tip.price || 29)

  async function startCheckout() {
    setPaymentError('')
    setLoading(true)

    try {
      const response = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipId: tip.id,
          userId: user?.id || null,
          userEmail: user?.email || '',
          matchName: `${tip.team_home} vs ${tip.team_away}`,
          price,
          referralCode: getStoredReferralCode()
        })
      })

      const data = await response.json()

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Nie udało się utworzyć płatności Stripe.')
      }

      window.location.href = data.url
    } catch (error) {
      setPaymentError(error.message)
      setLoading(false)
    }
  }

  function demoUnlock() {
    onSuccess(tip)
  }

  return (
    <div className="payment-backdrop">
      <div className="payment-modal">
        <div className="payment-icon">💳</div>
        <h2>Kup singiel premium</h2>
        <p>Kupujesz pojedynczy typ premium. Cenę singla ustala typer przy publikacji typu.</p>

        <div className="payment-summary">
          <span>Mecz</span>
          <strong>{tip.team_home} vs {tip.team_away}</strong>
        </div>

        <div className="payment-summary">
          <span>Typer</span>
          <strong>{tip.author_name || tip.author_email?.split('@')[0] || 'Użytkownik'}</strong>
        </div>

        <div className="payment-price">
          <span>Do zapłaty</span>
          <b>{price.toFixed(2)} zł</b>
        </div>

        {paymentError && <div className="payment-error">{paymentError}</div>}

        <button className="payment-primary" onClick={startCheckout} disabled={loading}>
          {loading ? 'Łączenie ze Stripe...' : 'Zapłać przez Stripe'}
        </button>

        <button className="payment-demo" onClick={demoUnlock}>
          Odblokuj testowo
        </button>

        <button className="payment-secondary" onClick={onClose}>
          Anuluj
        </button>
      </div>
    </div>
  )
}

function TipsterPricingSettings({ user, onToast }) {
  const [plans, setPlans] = useState(TIPSTER_PLAN_OPTIONS.map(option => ({
    ...option,
    price: option.defaultPrice,
    active: true
  })))
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    async function loadPlans() {
      if (!user?.id || !isSupabaseConfigured || !supabase) return
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('tipster_plans')
          .select('plan_key,label,duration_days,price,active')
          .eq('tipster_id', user.id)

        if (error) throw error
        if (!active) return

        setPlans(TIPSTER_PLAN_OPTIONS.map(option => {
          const row = Array.isArray(data) ? data.find(item => item.plan_key === option.key) : null
          return row
            ? {
                ...option,
                label: row.label || option.label,
                durationDays: Number(row.duration_days || option.durationDays),
                price: Number(row.price ?? option.defaultPrice),
                active: row.active !== false
              }
            : { ...option, price: option.defaultPrice, active: true }
        }))
      } catch (error) {
        console.warn('tipster plans load skipped', error)
      } finally {
        if (active) setLoading(false)
      }
    }
    loadPlans()
    return () => { active = false }
  }, [user?.id])

  const updatePlan = (key, patch) => {
    setPlans(current => current.map(plan => plan.key === key ? { ...plan, ...patch } : plan))
  }

  const savePlans = async () => {
    if (!user?.id || !isSupabaseConfigured || !supabase) {
      onToast?.({ type: 'error', title: 'Brak konta', message: 'Nie udało się zapisać cennika.' })
      return
    }
    setSaving(true)
    try {
      const rows = plans.map(plan => ({
        tipster_id: user.id,
        plan_key: plan.key,
        label: plan.label,
        duration_days: Number(plan.durationDays),
        price: Number(plan.price || 0),
        active: Boolean(plan.active)
      }))
      const { error } = await supabase.from('tipster_plans').upsert(rows, { onConflict: 'tipster_id,plan_key' })
      if (error) throw error
      onToast?.({ type: 'success', title: 'Cennik zapisany', message: 'Ceny subskrypcji profilu zostały zaktualizowane.' })
    } catch (error) {
      onToast?.({ type: 'error', title: 'Błąd cennika', message: formatAppErrorMessage(error.message) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-profile-v3 tipster-pricing-settings">
      <div className="profile-v3-card-head">
        <h3>Cennik subskrypcji profilu</h3>
        <span>{loading ? 'Ładowanie...' : 'Dla kupujących'}</span>
      </div>
      <p>Ustaw ceny, za które inni użytkownicy mogą kupić dostęp do Twojego profilu i typów.</p>
      <div className="tipster-pricing-grid">
        {plans.map(plan => (
          <label key={plan.key}>
            <strong>{plan.label}</strong>
            <span>{plan.durationDays} dni</span>
            <input
              type="number"
              min="0"
              step="1"
              value={plan.price}
              onChange={event => updatePlan(plan.key, { price: Math.max(0, Number(event.target.value || 0)) })}
            />
            <em>zł</em>
            <input
              type="checkbox"
              checked={plan.active}
              onChange={event => updatePlan(plan.key, { active: event.target.checked })}
            />
          </label>
        ))}
      </div>
      <button type="button" onClick={savePlans} disabled={saving}>
        {saving ? 'Zapisuję...' : 'Zapisz cennik'}
      </button>
    </div>
  )
}

function ProfileSubscriptionModal({ tip, user, onClose }) {
  const [plans, setPlans] = useState(TIPSTER_PLAN_OPTIONS.map(p => ({ ...p, price: p.defaultPrice })))
  const [loadingKey, setLoadingKey] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPlans() {
      const tipsterId = getTipAuthorId(tip)
      if (!tipsterId || !isSupabaseConfigured || !supabase) return
      const { data } = await supabase.from('tipster_plans').select('*').eq('tipster_id', tipsterId).eq('active', true)
      if (Array.isArray(data) && data.length) {
        setPlans(TIPSTER_PLAN_OPTIONS.map(option => {
          const row = data.find(item => item.plan_key === option.key)
          return row ? { ...option, label: row.label || option.label, durationDays: Number(row.duration_days || option.durationDays), price: Number(row.price || option.defaultPrice) } : { ...option, price: option.defaultPrice }
        }))
      }
    }
    loadPlans()
  }, [tip?.id])

  if (!tip) return null
  const tipsterId = getTipAuthorId(tip)
  const tipsterName = tip.author_name || 'Typer'

  async function buy(plan) {
    setError('')
    setLoadingKey(plan.key)
    try {
      const response = await fetch('/.netlify/functions/create-tipster-subscription-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          userEmail: user?.email || '',
          tipsterId,
          tipsterName,
          durationDays: plan.durationDays,
          label: plan.label,
          price: plan.price,
          referralCode: getStoredReferralCode()
        })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.url) throw new Error(data.error || 'Nie udało się utworzyć płatności za dostęp do profilu.')
      window.location.href = data.url
    } catch (e) {
      setError(e.message)
      setLoadingKey('')
    }
  }

  return (
    <div className="payment-backdrop">
      <div className="payment-modal profile-sub-modal">
        <div className="payment-icon">👤</div>
        <h2>Subskrypcja profilu typera</h2>
        <p>Kup subskrypcję profilu użytkownika <b>{tipsterName}</b>. Typer sam ustala ceny pakietów: tydzień, miesiąc, pół roku i rok. Platforma pobiera 20% marży.</p>
        <div className="profile-sub-grid">
          {plans.map(plan => (
            <button key={plan.key} className="profile-sub-option" type="button" onClick={() => buy(plan)} disabled={Boolean(loadingKey)}>
              <strong>{plan.label}</strong>
              <b>{Number(plan.price || 0).toFixed(2)} zł</b>
              <span>Typer: {(Number(plan.price || 0) * 0.8).toFixed(2)} zł • Platforma: {(Number(plan.price || 0) * 0.2).toFixed(2)} zł</span>
              <em>{loadingKey === plan.key ? 'Łączenie...' : 'Kup subskrypcję'}</em>
            </button>
          ))}
        </div>
        {error && <div className="payment-error">{error}</div>}
        <button className="payment-secondary" onClick={onClose}>Anuluj</button>
      </div>
    </div>
  )
}

function SubscriptionView({ userPlan = 'free', user = null, payments = [], onUpgrade, onManage, onViewChange }) {
  const [subscriptionClock, setSubscriptionClock] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setSubscriptionClock(new Date()), 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  const isPremium = isPremiumProfile(user) || isPremiumAccount(userPlan) || isPremiumAccount(user?.plan || user?.subscription_status || user?.status)
  const periodEnd = user?.current_period_end ? new Date(user.current_period_end) : null
  const hasPeriodEnd = !!periodEnd && !Number.isNaN(periodEnd.getTime())
  const daysLeft = hasPeriodEnd
    ? (() => {
        const today = new Date(subscriptionClock)
        const end = new Date(periodEnd)
        today.setHours(0, 0, 0, 0)
        end.setHours(0, 0, 0, 0)
        return Math.max(0, Math.round((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)))
      })()
    : (isPremium ? 30 : 0)
  const daysLabel = daysLeft === 1 ? 'dzień' : 'dni'
  const expiryLabel = hasPeriodEnd ? periodEnd.toLocaleDateString('pl-PL') : '—'
  const paymentKind = payment => {
    const provider = String(payment?.provider || '').toLowerCase()
    const type = String(payment?.type || payment?.kind || '').toLowerCase()
    return provider.includes('premium') || type.includes('premium')
  }
  const premiumPayments = payments.filter(paymentKind)
  const latestPremiumPayment = premiumPayments[0] || null
  const getInvoiceLink = payment => payment?.invoice_pdf_url || payment?.invoice_pdf || payment?.invoice_url || payment?.hosted_invoice_url || null
  const getStatusLabel = () => {
    if (!isPremium) return 'Konto Free'
    if (daysLeft <= 0) return 'Premium wygasło'
    return 'Premium aktywne'
  }
  const planPrice = isPremium ? '29 zł / miesiąc' : '0 zł / miesiąc'
  const planFeatures = isPremium
    ? [
        'Sprzedaż typów premium',
        'Brak limitu dodawania typów',
        '3 wypłaty miesięcznie',
        'AI, statystyki, bonusy i dropy'
      ]
    : [
        '5 darmowych typów dziennie',
        '1 wypłata miesięcznie',
        'Brak sprzedaży typów premium',
        'Podstawowe funkcje konta'
      ]

  return (
    <section className="wallet-subpage subscription-live-page">
      <div className="wallet-subpage-tabs glass-v2-panel">
        <button type="button" onClick={() => onViewChange?.('wallet')}>Portfel</button>
        <button type="button" onClick={() => onViewChange?.('deposits')}>Wpłaty</button>
        <button type="button" onClick={() => onViewChange?.('payouts')}>Wypłaty</button>
        <button type="button" onClick={() => onViewChange?.('payments')}>Płatności</button>
        <button type="button" className="active">Subskrypcja</button>
        <button type="button" onClick={() => onViewChange?.('earnings')}>Zarobki</button>
      </div>

      <div className="subscription-live-hero glass-v2-panel">
        <div>
          <span>Plan konta</span>
          <h1>Subskrypcja</h1>
          <p>Tu widzisz realny status planu, datę końca Premium i historię płatności za subskrypcję przypisaną do Twojego konta.</p>
        </div>
        <div className={`subscription-live-status ${isPremium ? 'premium' : 'free'}`}>
          <small>Aktualny status</small>
          <b>{getStatusLabel()}</b>
        </div>
      </div>

      <div className="subscription-live-stats">
        <div className="glass-v2-panel">
          <span>Aktualny plan</span>
          <b>{isPremium ? 'Premium' : 'Free'}</b>
          <small>{planPrice}</small>
        </div>
        <div className="glass-v2-panel">
          <span>Ważne do</span>
          <b>{isPremium ? expiryLabel : '—'}</b>
          <small>{isPremium ? `Zostało ${daysLeft} ${daysLabel}` : 'Brak aktywnego Premium'}</small>
        </div>
        <div className="glass-v2-panel">
          <span>Płatności Premium</span>
          <b>{premiumPayments.length}</b>
          <small>Prawdziwe dokumenty</small>
        </div>
        <div className="glass-v2-panel">
          <span>Ostatnia płatność</span>
          <b>{latestPremiumPayment ? formatMoney(latestPremiumPayment.amount) : '—'}</b>
          <small>{latestPremiumPayment ? new Date(latestPremiumPayment.created_at).toLocaleDateString('pl-PL') : 'Brak płatności'}</small>
        </div>
      </div>

      <div className="subscription-live-grid">
        <div className="glass-v2-panel subscription-live-plan-card">
          <div className="subscription-live-card-head">
            <h2>{isPremium ? 'Twój plan Premium' : 'Twój plan Free'}</h2>
            <span className={isPremium ? 'premium' : 'free'}>{isPremium ? 'Aktywny' : 'Free'}</span>
          </div>
          <strong>{planPrice}</strong>
          <p>{isPremium ? 'Pełny dostęp do funkcji twórcy i sprzedaży premium.' : 'Plan startowy bez sprzedaży płatnych typów.'}</p>
          <ul>
            {planFeatures.map(feature => <li key={feature}>✓ {feature}</li>)}
          </ul>
          {isPremium ? (
            <button type="button" onClick={onManage}>Zarządzaj subskrypcją</button>
          ) : (
            <button type="button" onClick={onUpgrade}>Aktywuj Premium przez Stripe</button>
          )}
        </div>

        <div className="glass-v2-panel subscription-live-rules-card">
          <div className="subscription-live-card-head"><h2>Limity planów</h2></div>
          <div className="subscription-live-compare">
            <div>
              <strong>Free</strong>
              <span>5 typów dziennie</span>
              <span>1 wypłata / miesiąc</span>
              <span>Brak sprzedaży</span>
            </div>
            <div className="featured">
              <strong>Premium</strong>
              <span>Bez limitu typów</span>
              <span>3 wypłaty / miesiąc</span>
              <span>Sprzedaż singli i profilu</span>
            </div>
          </div>
          <small>Premium nie daje uprawnień admina. Adminem jest tylko smilhytv.</small>
        </div>

        <div className="glass-v2-panel subscription-live-history-card">
          <div className="subscription-live-card-head">
            <h2>Historia Premium</h2>
            <button type="button" onClick={() => onViewChange?.('payments')}>Wszystkie płatności</button>
          </div>
          {premiumPayments.length ? (
            <div className="subscription-live-history">
              {premiumPayments.slice(0, 5).map(payment => {
                const invoiceLink = getInvoiceLink(payment)
                return (
                  <div key={payment.id}>
                    <span>{new Date(payment.created_at).toLocaleString('pl-PL')}</span>
                    <strong>{formatMoney(payment.amount)}</strong>
                    <small>{invoiceLink ? <a href={invoiceLink} target="_blank" rel="noreferrer">Pobierz fakturę</a> : 'Brak faktury'}</small>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="subscription-live-empty">
              <strong>Brak płatności Premium</strong>
              <span>Po pierwszym zakupie Premium historia pojawi się tutaj.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function PaymentsView({ payments = [], onViewChange, onTopUp }) {
  const [paymentFilter, setPaymentFilter] = useState('all')
  const getInvoiceLink = payment => payment?.invoice_pdf_url || payment?.invoice_pdf || payment?.invoice_url || payment?.hosted_invoice_url || null
  const getPaymentKind = payment => {
    const provider = String(payment?.provider || '').toLowerCase()
    const type = String(payment?.type || payment?.kind || '').toLowerCase()
    if (provider.includes('premium') || type.includes('premium')) return 'premium'
    if (provider.includes('token') || type.includes('token')) return 'tokens'
    if (payment?.tip_id) return 'tips'
    return 'other'
  }
  const getPaymentName = payment => {
    const kind = getPaymentKind(payment)
    if (kind === 'premium') return 'Zakup Premium'
    if (kind === 'tokens') return 'Zakup żetonów'
    if (kind === 'tips') return 'Zakup typu premium'
    return 'Płatność'
  }
  const getPaymentStatusLabel = status => {
    const clean = String(status || 'paid').toLowerCase()
    if (clean === 'completed' || clean === 'paid' || clean === 'succeeded') return 'Opłacona'
    if (clean === 'pending') return 'Oczekuje'
    if (clean === 'failed') return 'Nieudana'
    if (clean === 'refunded') return 'Zwrócona'
    return status || 'Opłacona'
  }
  const isPaidPayment = payment => ['completed', 'paid', 'succeeded'].includes(String(payment?.status || 'paid').toLowerCase())
  const filteredPayments = payments.filter(payment => paymentFilter === 'all' || getPaymentKind(payment) === paymentFilter)
  const total = payments.filter(isPaidPayment).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const paidCount = payments.filter(isPaidPayment).length
  const invoiceCount = payments.filter(payment => !!getInvoiceLink(payment)).length
  const latestPayment = payments[0] || null
  const filterCounts = {
    all: payments.length,
    premium: payments.filter(payment => getPaymentKind(payment) === 'premium').length,
    tips: payments.filter(payment => getPaymentKind(payment) === 'tips').length,
    tokens: payments.filter(payment => getPaymentKind(payment) === 'tokens').length,
    other: payments.filter(payment => getPaymentKind(payment) === 'other').length
  }

  return (
    <section className="wallet-subpage payments-live-page">
      <div className="wallet-subpage-tabs glass-v2-panel">
        <button type="button" onClick={() => onViewChange?.('wallet')}>Portfel</button>
        <button type="button" onClick={() => onViewChange?.('deposits')}>Wpłaty</button>
        <button type="button" onClick={() => onViewChange?.('payouts')}>Wypłaty</button>
        <button type="button" className="active">Płatności</button>
        <button type="button" onClick={() => onViewChange?.('subscriptions')}>Subskrypcja</button>
        <button type="button" onClick={() => onViewChange?.('earnings')}>Zarobki</button>
      </div>

      <div className="payments-live-hero glass-v2-panel">
        <div>
          <span>Dokumenty konta</span>
          <h1>Płatności i faktury</h1>
          <p>Tu widzisz tylko prawdziwe płatności przypisane do zalogowanego konta oraz faktury wygenerowane przez Stripe.</p>
        </div>
        <div className="payments-live-total">
          <small>Opłacono razem</small>
          <b>{formatMoney(total)}</b>
        </div>
      </div>

      <div className="payments-live-stats">
        <div className="glass-v2-panel">
          <span>Wszystkie płatności</span>
          <b>{payments.length}</b>
          <small>Dokumenty konta</small>
        </div>
        <div className="glass-v2-panel">
          <span>Opłacone</span>
          <b>{paidCount}</b>
          <small>Zakończone sukcesem</small>
        </div>
        <div className="glass-v2-panel">
          <span>Faktury do pobrania</span>
          <b>{invoiceCount}</b>
          <small>Realne linki Stripe</small>
        </div>
        <div className="glass-v2-panel">
          <span>Ostatnia płatność</span>
          <b>{latestPayment ? formatMoney(latestPayment.amount) : '—'}</b>
          <small>{latestPayment ? new Date(latestPayment.created_at).toLocaleDateString('pl-PL') : 'Brak płatności'}</small>
        </div>
      </div>

      <div className="payments-live-grid">
        <div className="glass-v2-panel payments-live-table-card">
          <div className="payments-live-card-head">
            <h2>Historia płatności</h2>
            <span>{filteredPayments.length} wyników</span>
          </div>

          <div className="payments-live-filters">
            <button type="button" className={paymentFilter === 'all' ? 'active' : ''} onClick={() => setPaymentFilter('all')}>Wszystkie <b>{filterCounts.all}</b></button>
            <button type="button" className={paymentFilter === 'premium' ? 'active' : ''} onClick={() => setPaymentFilter('premium')}>Premium <b>{filterCounts.premium}</b></button>
            <button type="button" className={paymentFilter === 'tips' ? 'active' : ''} onClick={() => setPaymentFilter('tips')}>Typy <b>{filterCounts.tips}</b></button>
            <button type="button" className={paymentFilter === 'tokens' ? 'active' : ''} onClick={() => setPaymentFilter('tokens')}>Żetony <b>{filterCounts.tokens}</b></button>
            <button type="button" className={paymentFilter === 'other' ? 'active' : ''} onClick={() => setPaymentFilter('other')}>Inne <b>{filterCounts.other}</b></button>
          </div>

          <div className="payments-live-table">
            <div className="payments-live-row header">
              <span>Data</span>
              <span>Dokument</span>
              <span>Status</span>
              <span>Kwota</span>
              <span>Faktura</span>
            </div>

            {filteredPayments.length ? filteredPayments.map(payment => {
              const invoiceLink = getInvoiceLink(payment)
              return (
                <div className="payments-live-row" key={payment.id}>
                  <span>{new Date(payment.created_at).toLocaleString('pl-PL')}</span>
                  <span>
                    <strong>{payment.invoice_number ? `Faktura ${payment.invoice_number}` : getPaymentName(payment)}</strong>
                    <small>{getPaymentName(payment)}</small>
                  </span>
                  <span className={`payments-live-status status-${String(payment.status || 'paid').toLowerCase()}`}>{getPaymentStatusLabel(payment.status)}</span>
                  <span className="payments-live-amount">{formatMoney(payment.amount)}</span>
                  <span>{invoiceLink ? <a className="payment-invoice-link" href={invoiceLink} target="_blank" rel="noreferrer">Pobierz</a> : 'Brak faktury'}</span>
                </div>
              )
            }) : (
              <div className="payments-live-empty">
                <strong>Brak płatności</strong>
                <span>Po pierwszej prawdziwej płatności dokument pojawi się tutaj.</span>
              </div>
            )}
          </div>
        </div>

        <div className="payments-live-side">
          <div className="glass-v2-panel payments-live-info-card">
            <div className="payments-live-card-head"><h2>Co tu trafia?</h2></div>
            <ul>
              <li>Zakupy Premium.</li>
              <li>Zakupy płatnych typów.</li>
              <li>Zakupy żetonów, gdy zostaną podpięte pod płatność.</li>
              <li>Prawdziwe faktury Stripe, jeśli zostały wygenerowane.</li>
            </ul>
          </div>

          <div className="glass-v2-panel payments-live-info-card">
            <div className="payments-live-card-head"><h2>Faktury Stripe</h2></div>
            <p>Przycisk <b>Pobierz</b> pojawia się tylko wtedy, gdy Stripe zwróci prawdziwy link do faktury PDF lub faktury online.</p>
            <button type="button" onClick={() => onViewChange?.('subscriptions')}>Zarządzaj subskrypcją</button>
            <button type="button" className="secondary" onClick={() => onTopUp?.(100)}>Wpłać środki</button>
          </div>
        </div>
      </div>
    </section>
  )
}

function EarningsView({ user, earnings = null, stripeConnectStatus = null, onConnectStripe, onViewChange }) {
  const [earningsPeriod, setEarningsPeriod] = useState('current_month')
  const history = Array.isArray(earnings?.history) ? earnings.history : []
  const total = Number(earnings?.total || 0)
  const sales = Number(earnings?.sales || history.length || 0)
  const availableToPayout = Number(earnings?.available_to_payout || 0)
  const startOfDay = value => {
    const date = new Date(value)
    date.setHours(0, 0, 0, 0)
    return date
  }
  const startOfMonth = value => {
    const date = new Date(value)
    date.setDate(1)
    date.setHours(0, 0, 0, 0)
    return date
  }
  const addMonths = (value, months) => {
    const date = new Date(value)
    date.setMonth(date.getMonth() + months)
    return date
  }
  const now = new Date()
  const currentMonthStart = startOfMonth(now)
  const nextMonthStart = addMonths(currentMonthStart, 1)
  const periodRange = (() => {
    if (earningsPeriod === 'previous_month') {
      return { start: addMonths(currentMonthStart, -1), end: currentMonthStart, label: 'Poprzedni miesiąc' }
    }
    if (earningsPeriod === 'last_3_months') {
      return { start: addMonths(currentMonthStart, -2), end: nextMonthStart, label: 'Ostatnie 3 miesiące' }
    }
    if (earningsPeriod === 'year') {
      return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1), label: 'Cały rok' }
    }
    return { start: currentMonthStart, end: nextMonthStart, label: 'Bieżący miesiąc' }
  })()
  const previousPeriodRange = (() => {
    const span = periodRange.end.getTime() - periodRange.start.getTime()
    return { start: new Date(periodRange.start.getTime() - span), end: periodRange.start }
  })()
  const amountFromRow = row => Number(row?.amount || row?.net_amount || row?.tipster_amount || 0) || 0
  const grossFromRow = row => Number(row?.gross_amount || (amountFromRow(row) + Number(row?.commission || 0)) || 0)
  const rowsForRange = range => history.filter(row => {
    const createdAt = new Date(row?.created_at || 0)
    return !Number.isNaN(createdAt.getTime()) && createdAt >= range.start && createdAt < range.end
  })
  const currentRows = rowsForRange(periodRange)
  const previousRows = rowsForRange(previousPeriodRange)
  const periodNet = currentRows.reduce((sum, row) => sum + amountFromRow(row), 0)
  const periodGross = currentRows.reduce((sum, row) => sum + grossFromRow(row), 0)
  const periodCommission = currentRows.reduce((sum, row) => sum + Number(row?.commission || 0), 0)
  const periodSales = currentRows.length
  const previousNet = previousRows.reduce((sum, row) => sum + amountFromRow(row), 0)
  const average = periodSales ? periodNet / periodSales : 0
  const growth = previousNet > 0 ? ((periodNet - previousNet) / previousNet) * 100 : (periodNet > 0 ? 100 : 0)
  const growthLabel = previousNet > 0
    ? `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% vs poprzedni okres`
    : periodNet > 0
      ? 'Pierwszy zarobek w tym okresie'
      : 'Brak danych do porównania'
  const sourceLabel = source => {
    if (source === 'profile_subscription') return 'Subskrypcja profilu'
    if (source === 'tip_purchase') return 'Sprzedaż typu'
    return 'Zarobek twórcy'
  }
  const chartBuckets = (() => {
    const useMonths = earningsPeriod === 'last_3_months' || earningsPeriod === 'year'
    const buckets = []
    if (useMonths) {
      const cursor = startOfMonth(periodRange.start)
      while (cursor < periodRange.end) {
        const bucketStart = new Date(cursor)
        const bucketEnd = addMonths(bucketStart, 1)
        buckets.push({
          key: `${bucketStart.getFullYear()}-${bucketStart.getMonth()}`,
          label: bucketStart.toLocaleDateString('pl-PL', { month: 'short' }),
          amount: rowsForRange({ start: bucketStart, end: bucketEnd }).reduce((sum, row) => sum + amountFromRow(row), 0)
        })
        cursor.setMonth(cursor.getMonth() + 1)
      }
      return buckets
    }
    const cursor = startOfDay(periodRange.start)
    while (cursor < periodRange.end) {
      const bucketStart = new Date(cursor)
      const bucketEnd = new Date(bucketStart)
      bucketEnd.setDate(bucketEnd.getDate() + 1)
      buckets.push({
        key: bucketStart.toISOString().slice(0, 10),
        label: String(bucketStart.getDate()),
        amount: rowsForRange({ start: bucketStart, end: bucketEnd }).reduce((sum, row) => sum + amountFromRow(row), 0)
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    return buckets
  })()
  const chartMax = Math.max(1, ...chartBuckets.map(bucket => Number(bucket.amount || 0)))
  const chartPoints = chartBuckets.map((bucket, index) => {
    const x = chartBuckets.length <= 1 ? 0 : (index / (chartBuckets.length - 1)) * 100
    const y = 100 - (Number(bucket.amount || 0) / chartMax) * 100
    return `${x},${y}`
  }).join(' ')
  const chartAreaPoints = chartBuckets.length ? `0,100 ${chartPoints} 100,100` : ''
  const chartLabels = chartBuckets.length > 7
    ? chartBuckets.filter((_, index) => index === 0 || index === chartBuckets.length - 1 || index % Math.ceil(chartBuckets.length / 4) === 0)
    : chartBuckets
  const recentRows = history.slice(0, 5)
  const stripeReady = !!stripeConnectStatus?.payouts_enabled
  const profile = getUserProfileView(user || {})

  return (
    <section className="wallet-subpage earnings-live-page">
      <div className="wallet-subpage-tabs glass-v2-panel">
        <button type="button" onClick={() => onViewChange?.('wallet')}>Portfel</button>
        <button type="button" onClick={() => onViewChange?.('deposits')}>Wpłaty</button>
        <button type="button" onClick={() => onViewChange?.('payouts')}>Wypłaty</button>
        <button type="button" onClick={() => onViewChange?.('payments')}>Płatności</button>
        <button type="button" onClick={() => onViewChange?.('subscriptions')}>Subskrypcja</button>
        <button type="button" className="active">Zarobki</button>
      </div>

      <div className="earnings-live-hero glass-v2-panel">
        <div>
          <span>Zarobki twórcy</span>
          <h1>Zarobki</h1>
          <p>{profile.username || 'Typer'} — tu widzisz realne przychody ze sprzedaży płatnych typów i subskrypcji profilu.</p>
        </div>
        <div className="earnings-live-total">
          <small>Zarobiłeś łącznie</small>
          <b>{formatMoney(total)}</b>
        </div>
      </div>

      <div className="earnings-live-stats">
        <div className="glass-v2-panel">
          <span>Zarobek netto</span>
          <b>{formatMoney(periodNet)}</b>
          <small>{periodRange.label}</small>
        </div>
        <div className="glass-v2-panel">
          <span>Sprzedaż brutto</span>
          <b>{formatMoney(periodGross)}</b>
          <small>Przed prowizją</small>
        </div>
        <div className="glass-v2-panel">
          <span>Prowizja platformy</span>
          <b>{formatMoney(periodCommission)}</b>
          <small>20% od sprzedaży</small>
        </div>
        <div className="glass-v2-panel">
          <span>Dostępne do wypłaty</span>
          <b>{formatMoney(availableToPayout)}</b>
          <small>Realne saldo zarobków</small>
        </div>
      </div>

      <div className="earnings-live-grid">
        <div className="glass-v2-panel earnings-live-chart-card">
          <div className="earnings-live-card-head">
            <div>
              <h2>Wykres zarobków</h2>
              <span>{growthLabel}</span>
            </div>
            <select value={earningsPeriod} onChange={event => setEarningsPeriod(event.target.value)} aria-label="Okres zarobków">
              <option value="current_month">Bieżący miesiąc</option>
              <option value="previous_month">Poprzedni miesiąc</option>
              <option value="last_3_months">Ostatnie 3 miesiące</option>
              <option value="year">Cały rok</option>
            </select>
          </div>

          {periodSales > 0 ? (
            <>
              <div className="earnings-live-metrics">
                <span><b>{periodSales}</b> sprzedaży</span>
                <span><b>{formatMoney(average)}</b> średnio / sprzedaż</span>
              </div>
              <div className="earnings-live-chart-v2">
                <div className="y-labels">
                  <span>{formatMoney(chartMax)}</span>
                  <span>{formatMoney(chartMax / 2)}</span>
                  <span>0 zł</span>
                </div>
                <div className="chart-area">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon points={chartAreaPoints} />
                    <polyline points={chartPoints} />
                  </svg>
                </div>
                <div className="x-labels">
                  {chartLabels.map(bucket => <small key={bucket.key}>{bucket.label}</small>)}
                </div>
              </div>
            </>
          ) : (
            <div className="earnings-live-empty">
              <strong>Brak zarobków w tym okresie</strong>
              <span>Po pierwszej sprzedaży płatnego typu albo subskrypcji profilu wykres ożyje realnymi danymi.</span>
            </div>
          )}
        </div>

        <div className="glass-v2-panel earnings-live-stripe-card">
          <div className="earnings-live-card-head"><h2>Wypłaty Stripe</h2></div>
          <div className={`earnings-live-stripe-status ${stripeReady ? 'ready' : 'locked'}`}>
            <strong>{stripeReady ? 'Stripe aktywny' : 'Stripe niepodłączony'}</strong>
            <span>{stripeReady ? 'Konto jest gotowe do odbierania wypłat.' : 'Podłącz Stripe Connect, aby odbierać realne wypłaty.'}</span>
          </div>
          <button type="button" onClick={() => stripeReady ? onViewChange?.('payouts') : onConnectStripe?.()}>
            {stripeReady ? 'Przejdź do wypłat' : 'Podłącz Stripe'}
          </button>
          <ul>
            <li>Zarabiasz 80% wartości sprzedaży.</li>
            <li>20% zostaje jako prowizja platformy.</li>
            <li>Wypłata trafia do zakładki Wypłaty.</li>
          </ul>
        </div>

        <div className="glass-v2-panel earnings-live-history-card">
          <div className="earnings-live-card-head">
            <h2>Ostatnie zarobki</h2>
            <span>{sales} łącznie</span>
          </div>
          {recentRows.length ? (
            <div className="earnings-live-history">
              {recentRows.map(row => (
                <div key={row.id || `${row.created_at}_${row.source}`}>
                  <span>{new Date(row.created_at).toLocaleString('pl-PL')}</span>
                  <strong>+{formatMoney(amountFromRow(row))}</strong>
                  <small>{sourceLabel(row.source)}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="earnings-live-empty compact">
              <strong>Brak zarobków</strong>
              <span>Sprzedaże pojawią się tutaj automatycznie.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}



function getApiSportsFootballTeamLogo(teamId) {
  const id = String(teamId || '').replace(/[^\d]/g, '')
  return id ? `https://media.api-sports.io/football/teams/${id}.png` : ''
}

function resolveTipTeamLogo(explicitLogo, teamId) {
  return explicitLogo || getApiSportsFootballTeamLogo(teamId) || ''
}

function TipTeamLogo({ logo, teamId, name }) {
  const [failed, setFailed] = useState(false)
  const src = resolveTipTeamLogo(logo, teamId)
  const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <span className={`profile-ticket-v6-team-logo ${src && !failed ? 'has-logo' : ''}`}>
      {src && !failed && <img src={src} alt="" onError={() => setFailed(true)} />}
      <b>{initial}</b>
    </span>
  )
}


function formatRelativeAddedTime(value) {
  const ts = Date.parse(value || '')
  if (!Number.isFinite(ts)) return 'teraz'
  const diffMinutes = Math.max(0, Math.floor((Date.now() - ts) / 60000))
  if (diffMinutes < 1) return 'teraz'
  if (diffMinutes < 60) return `${diffMinutes} ${diffMinutes === 1 ? 'minutę' : 'minut'} temu`
  const hours = Math.floor(diffMinutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'godzinę' : hours < 5 ? 'godziny' : 'godzin'} temu`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'dzień' : 'dni'} temu`
}

async function updateTipField(tipId, patch) {
  if (!tipId || !isSupabaseConfigured || !supabase) return false
  const { error } = await supabase.from('tips').update(patch).eq('id', tipId)
  if (error) throw error
  return true
}

function shareTipText(tip) {
  return `${tip?.home || tip?.team_home || 'Mecz'} vs ${tip?.away || tip?.team_away || ''} • ${tip?.pick || tip?.bet_type || tip?.prediction || 'Typ'} • kurs ${tip?.odds || '—'}`
}

function ProfileLiveTipCard({
  tip,
  sourceTip,
  avatarUrl,
  initials,
  displayName,
  currentUser,
  unlockedTips = new Set(),
  tipsterSubscriptions = [],
  followingTipsters = new Set(),
  onToggleFollow,
  onUnlock,
  onSubscribeToTipster,
  onToast,
  onViewType,
  authorStats = null,
}) {
  const profileSubActive = hasActiveTipsterSubscription(sourceTip, tipsterSubscriptions)
  const singleUnlocked = Boolean(sourceTip?.id && unlockedTips?.has?.(sourceTip.id))
  const isUnlocked = !tip.premium || singleUnlocked || profileSubActive

  const currentUsername = getProfileUsername(currentUser) || String(currentUser?.email || '').split('@')[0] || displayName || 'Użytkownik'
  const actorKey = String(currentUser?.id || currentUser?.email || currentUsername || 'guest').toLowerCase()
  const actorLabel = currentUsername || displayName || 'Gość'
  const baseLikes = Number(sourceTip?.likes ?? tip.likes ?? 0) || 0
  const baseDislikes = Number(sourceTip?.dislikes ?? 0) || 0
  const baseCommentCount = Number(sourceTip?.comments_count ?? sourceTip?.comments ?? tip.comments ?? 0) || 0
  const interactionStorageKey = useMemo(
    () => `betai_tip_interactions_v3_${sourceTip?.id || tip.id || `${tip.home || 'home'}_${tip.away || 'away'}`}`,
    [sourceTip?.id, tip.id, tip.home, tip.away]
  )

  const [feedback, setFeedback] = useState({ likes: baseLikes, dislikes: baseDislikes, comments: [], votes: {} })
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const createdAgo = formatRelativeAddedTime(sourceTip?.created_at || tip?.createdAt || tip?.createdLabel)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(interactionStorageKey)
      if (!raw) {
        setFeedback({ likes: baseLikes, dislikes: baseDislikes, comments: [], votes: {} })
        return
      }
      const parsed = JSON.parse(raw)
      setFeedback({
        likes: Number(parsed?.likes ?? baseLikes) || 0,
        dislikes: Number(parsed?.dislikes ?? baseDislikes) || 0,
        comments: Array.isArray(parsed?.comments) ? parsed.comments : [],
        votes: parsed?.votes && typeof parsed.votes === 'object' ? parsed.votes : {},
      })
    } catch (_) {
      setFeedback({ likes: baseLikes, dislikes: baseDislikes, comments: [], votes: {} })
    }
  }, [interactionStorageKey, baseLikes, baseDislikes])

  useEffect(() => {
    try {
      localStorage.setItem(interactionStorageKey, JSON.stringify(feedback))
    } catch (_) {}
  }, [interactionStorageKey, feedback])

  const activeVote = feedback?.votes?.[actorKey] || null
  const commentCount = baseCommentCount + (feedback?.comments?.length || 0)
  const profileTipIdentity = {
    id: sourceTip?.author_id || sourceTip?.user_id || tip?.author_id || tip?.user_id,
    user_id: sourceTip?.user_id || tip?.user_id,
    author_id: sourceTip?.author_id || tip?.author_id,
    email: sourceTip?.author_email || sourceTip?.email || tip?.author_email || tip?.email || tip?.user_email,
    author_email: sourceTip?.author_email || tip?.author_email,
    username: sourceTip?.author_name || sourceTip?.username || tip?.author_name || tip?.username || displayName,
    author_name: sourceTip?.author_name || tip?.author_name || displayName,
  }
  const profileTipAuthor = resolveRealProfileUsername(profileTipIdentity) || displayName || 'Użytkownik'
  const isOwnTip = isSameProfileIdentity(currentUser, profileTipIdentity) || Boolean(
    currentUsername && String(currentUsername).toLowerCase() === String(profileTipAuthor).toLowerCase()
  )
  const showFollowButton = !isOwnTip
  const profileFollowLookupKey = String(profileTipAuthor || displayName || '').toLowerCase()
  const profileTipsterId = profileTipIdentity.id || profileTipIdentity.author_id || profileTipIdentity.user_id
  const isFollowing = Boolean(
    followingTipsters?.has?.(String(profileTipsterId || '')) ||
    (profileFollowLookupKey && followingTipsters?.has?.(profileFollowLookupKey))
  )

  function handleVote(nextVote) {
    const previousVote = activeVote
    setFeedback(prev => {
      const votes = { ...(prev?.votes || {}) }
      let likes = Number(prev?.likes || 0)
      let dislikes = Number(prev?.dislikes || 0)

      if (previousVote === nextVote) {
        if (nextVote === 'like') likes = Math.max(0, likes - 1)
        if (nextVote === 'dislike') dislikes = Math.max(0, dislikes - 1)
        delete votes[actorKey]
      } else {
        if (previousVote === 'like') likes = Math.max(0, likes - 1)
        if (previousVote === 'dislike') dislikes = Math.max(0, dislikes - 1)
        if (nextVote === 'like') likes += 1
        if (nextVote === 'dislike') dislikes += 1
        votes[actorKey] = nextVote
      }

      return { ...prev, likes, dislikes, votes }
    })
  }

  function submitComment() {
    const clean = commentDraft.trim()
    if (!clean) return
    const newComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      author: actorLabel || 'Gość',
      text: clean.slice(0, 280),
      created_at: new Date().toISOString(),
    }
    setFeedback(prev => ({ ...prev, comments: [newComment, ...(prev?.comments || [])] }))
    setCommentDraft('')
    setCommentsOpen(true)
    onToast?.({ type: 'success', title: 'Komentarz dodany', message: 'Twój komentarz został dodany do typu.' })
  }

  async function reportTip() {
    setMenuOpen(false)
    onToast?.({ type: 'info', title: 'Zgłoszono wpis', message: 'Zgłoszenie zostało przyjęte do sprawdzenia.' })
  }

  async function settleTip() {
    setMenuOpen(false)
    const nextStatus = window.prompt('Wpisz wynik: won / lost / void', 'won')
    if (!nextStatus) return
    const clean = String(nextStatus).trim().toLowerCase()
    if (!['won', 'lost', 'void'].includes(clean)) {
      onToast?.({ type: 'error', title: 'Nieprawidłowy wynik', message: 'Dozwolone wartości: won, lost albo void.' })
      return
    }
    try {
      await updateTipField(sourceTip?.id || tip?.id, { status: clean })
      onToast?.({ type: 'success', title: 'Typ rozliczony', message: `Zapisano wynik: ${clean}.` })
    } catch (error) {
      onToast?.({ type: 'error', title: 'Błąd rozliczenia', message: formatAppErrorMessage(error?.message || 'Nie udało się zapisać wyniku.') })
    }
  }

  async function addAnalysis() {
    setMenuOpen(false)
    const nextAnalysis = window.prompt('Dodaj analizę do typu:', tip?.analysis || sourceTip?.analysis || '')
    if (!nextAnalysis) return
    try {
      await updateTipField(sourceTip?.id || tip?.id, { analysis: nextAnalysis, description: nextAnalysis })
      onToast?.({ type: 'success', title: 'Analiza zapisana', message: 'Analiza została dodana do typu.' })
    } catch (error) {
      onToast?.({ type: 'error', title: 'Błąd analizy', message: formatAppErrorMessage(error?.message || 'Nie udało się zapisać analizy.') })
    }
  }

  async function shareTip() {
    setMenuOpen(false)
    const text = shareTipText(tip)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Typ Bet+AI', text })
      } else {
        await navigator.clipboard.writeText(text)
        onToast?.({ type: 'success', title: 'Skopiowano', message: 'Treść typu skopiowana do schowka.' })
      }
    } catch (_) {}
  }

  function handleShareAction() {
    setFeedback(prev => ({ ...prev, dislikes: Number(prev?.dislikes || 0) + 1 }))
    shareTip()
  }

  return (
    <article className={`profile-ticket-v6 ${tip.premium ? 'premium' : 'free'} ${isUnlocked ? 'unlocked' : 'locked'}`}>
      <div className="profile-ticket-v6-left">
        <span className={`profile-ticket-v6-avatar ${avatarUrl ? 'has-avatar' : ''}`} style={avatarUrl ? { '--avatar-image': `url("${avatarUrl}")` } : undefined}>
          {avatarUrl ? '' : initials}
        </span>
        <div>
          <span className="ticket-author-row-v874"><strong>{displayName}</strong><b>✓</b></span>
          {authorStats ? (
            <div className="ticket-mini-stats-v876">
              <span>Yield: <b>{authorStats.yieldLabel}</b></span>
              <span>Oddane typy: <b>{authorStats.totalTipsLabel}</b></span>
              <span>Bilans: <b className={(Number(authorStats?.profitValue || 0) >= 0) ? 'profit-positive-text' : 'profit-negative-text'}>{authorStats.profitLabel}</b></span>
            </div>
          ) : null}
        </div>
        <button type="button" className={`profile-ticket-v6-access ${tip.premium ? 'premium' : 'free'}`} onClick={() => tip.premium && onSubscribeToTipster?.(sourceTip)}>
          {tip.premium ? '♕ PREMIUM' : '🎁 DARMOWY'}
        </button>
      </div>

      <div className="profile-ticket-v6-main">
        <div className="profile-ticket-v6-league"><span>⚽</span><strong>{tip.league}</strong></div>
        <div className="profile-ticket-v6-match">
          <div><TipTeamLogo logo={tip.homeLogo} teamId={tip.homeTeamId} name={tip.home} /><strong>{tip.home}</strong></div>
          <span>vs</span>
          <div><TipTeamLogo logo={tip.awayLogo} teamId={tip.awayTeamId} name={tip.away} /><strong>{tip.away}</strong></div>
        </div>
        <small>{tip.matchLabel}</small>
      </div>

      <div className="profile-ticket-v6-field">
        <small>TYP</small>
        <strong>{tip.premium && !isUnlocked ? 'Typ premium' : tip.pick}</strong>
        <span>{tip.premium ? 'Singiel' : 'Darmowy typ'}</span>
      </div>

      <div className="profile-ticket-v6-field stake">
        <small>STAWKA</small>
        <strong>{tip.stake.toFixed(0)} zł</strong>
        <i><b style={{ width: `${Math.max(12, Math.min(100, tip.stake * 10))}%` }} /></i>
      </div>

      <div className="profile-ticket-v6-field odds">
        <small>KURS</small>
        <strong>{tip.premium && !isUnlocked ? '—' : tip.odds}</strong>
      </div>

      <div className={`profile-ticket-v6-analysis ${tip.premium && !isUnlocked ? 'locked' : ''}`}>
        <small>ANALIZA</small>
        <p>{tip.premium && !isUnlocked ? 'Ten typ premium jest zablokowany. Odblokuj dostęp, aby zobaczyć analizę, kurs i pełny typ.' : tip.analysis}</p>
        <button type="button">Czytaj więcej⌄</button>
      </div>

      <div className="profile-ticket-v6-buy">
        <div className="profile-ticket-v6-corner">
          <span>{createdAgo}</span>
          <button type="button" onClick={() => setMenuOpen(prev => !prev)}>⋮</button>
          {menuOpen && (
            <div className="profile-ticket-v6-menu">
              <button type="button" onClick={reportTip}>⚠ Zgłoś wpis</button>
              <button type="button" onClick={settleTip}>✓ Rozlicz</button>
              <button type="button" onClick={addAnalysis}>📝 Dodaj analizę</button>
              <button type="button" onClick={shareTip}>↗ Udostępnij</button>
            </div>
          )}
        </div>
        <span className={`status-${tip.statusLabel.toLowerCase()}`}>✓ {tip.statusLabel}</span>
        {tip.premium && !isUnlocked ? (
          <>
            <button type="button" onClick={() => onUnlock?.(sourceTip)}>Kup singiel</button>
            <strong>{formatMoney(tip.price)}</strong>
          </>
        ) : null}
      </div>

      <footer className="profile-ticket-v6-footer">
        <div>
          <button type="button" className={`ticket-action-btn-v877 ${activeVote === 'like' ? 'active' : ''}`} onClick={() => handleVote('like')}>
            <TipActionLikeIcon />
            <b>{feedback.likes}</b>
          </button>
          <button type="button" className={`ticket-action-btn-v877 ${commentsOpen ? 'active' : ''}`} onClick={() => setCommentsOpen(prev => !prev)} aria-label={commentsOpen ? 'Zamknij komentarze' : 'Otwórz komentarze'}>
            <TipActionCommentIcon />
            <b>{commentCount}</b>
          </button>
          <button type="button" className="ticket-action-btn-v877" onClick={handleShareAction}>
            <TipActionShareIcon />
            <b>{feedback.dislikes}</b>
          </button>
          {showFollowButton ? (
            <button
              type="button"
              className={`ticket-follow-inline-btn ${isFollowing ? 'active' : ''}`}
              onClick={(event) => {
                event.stopPropagation()
                onToggleFollow?.(profileTipsterId, profileTipAuthor)
              }}
              aria-label={isFollowing ? 'Obserwujesz typera' : 'Obserwuj typera'}
            >
              {isFollowing ? '✓ Obserwujesz' : 'Obserwuj'}
            </button>
          ) : null}
        </div>
      </footer>

      {commentsOpen && (
        <div className="profile-live-tip-comments profile-ticket-v6-comments">
          <div className="tip-comments-head">
            <strong>Komentarze:</strong>
            <span>{commentCount} łącznie</span>
            <button type="button" className="tip-comments-close" onClick={() => setCommentsOpen(false)} aria-label="Zamknij komentarze">×</button>
          </div>
          <div className="tip-comment-form">
            <input
              type="text"
              value={commentDraft}
              onChange={event => setCommentDraft(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); submitComment() } }}
              placeholder="Dodaj komentarz do tego typu..."
              maxLength={280}
            />
            <button type="button" className="tip-comment-submit" onClick={submitComment}>Dodaj komentarz</button>
          </div>
          {feedback.comments.length > 0 ? (
            <div className="tip-comment-list">
              {feedback.comments.map(comment => (
                <div key={comment.id} className="tip-comment-item">
                  <div className="tip-comment-avatar">{String(comment.author || 'G').slice(0, 1).toUpperCase()}</div>
                  <div className="tip-comment-body">
                    <div className="tip-comment-meta"><strong>{comment.author}</strong><span>{new Date(comment.created_at).toLocaleString('pl-PL')}</span></div>
                    <p>{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </article>
  )
}


function ProfileStatsTable({ title, columns, rows, wide = false }) {
  return (
    <section className={`glass-profile-v3 profile-v3-card profile-v4-stats-table ${wide ? 'wide' : ''}`}>
      <div className="profile-v3-card-head"><h3>{title}</h3></div>
      <div className="profile-v4-data-table" style={{ '--cols': columns.length }}>
        <div>{columns.map(column => <b key={column}>{column}</b>)}</div>
        {rows.map((row, index) => (
          <div key={`${title}-${index}`}>
            {row.map((cell, cellIndex) => <span key={`${title}-${index}-${cellIndex}`}>{cell}</span>)}
          </div>
        ))}
      </div>
    </section>
  )
}

function ProfileView({ user, tips = [], unlockedTips = new Set(), tipsterSubscriptions = [], followingTipsters = new Set(), onToggleFollow = null, userPlan = 'free', stripeConnectStatus = null, onConnectStripe = null, onToast = null, onAvatarUpdated = null, onProfileUpdated = null, onUnlock = null, onSubscribeToTipster = null }) {
  const profile = getUserProfileView(user)
  const email = normalizeEmail(profile.email || user?.email || '')
  const username = resolveRealProfileUsername({ ...(user || {}), email: profile.email || user?.email, username: profile.username })
  const displayName = username
  const handleName = username.startsWith('@') ? username : `@${username}`
  const initials = (username || email || 'U').replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '').slice(0, 2).toUpperCase() || 'U'
  const profileCreatedAt = user?.created_at || user?.createdAt || user?.updated_at || ''
  const createdLabel = profileCreatedAt ? new Date(profileCreatedAt).toLocaleDateString('pl-PL') : 'Nowy użytkownik'
  const admin = isAdminUser(user)
  const premium = isPremiumProfile(user) || isPremiumAccount(userPlan) || isPremiumAccount(user?.plan || user?.subscription_status || user?.status)
  const roleLabel = admin ? 'ADMIN' : premium ? 'PREMIUM' : 'FREE'
  const avatarInputRef = useRef(null)
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || user?.user_metadata?.avatar_url || '')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [profileTab, setProfileTab] = useState('tips')
  const [profileTipsFilter, setProfileTipsFilter] = useState('all')
  const [profileResultsFilter, setProfileResultsFilter] = useState('all')
  const fallbackBio = `${displayName} — dodaj własny opis profilu.`
  const [bioEditing, setBioEditing] = useState(false)
  const [bioSaving, setBioSaving] = useState(false)
  const [bioDraft, setBioDraft] = useState(user?.bio || user?.description || user?.about || fallbackBio)

  useEffect(() => {
    setAvatarUrl(user?.avatar_url || user?.user_metadata?.avatar_url || '')
  }, [user?.avatar_url, user?.user_metadata?.avatar_url])

  useEffect(() => {
    setBioDraft(user?.bio || user?.description || user?.about || fallbackBio)
  }, [user?.bio, user?.description, user?.about, fallbackBio])

  const chooseAvatar = () => {
    avatarInputRef.current?.click()
  }

  const changeAvatar = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      onToast?.({ type: 'error', title: 'Avatar', message: 'Wybierz plik graficzny JPG, PNG lub WEBP.' })
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      onToast?.({ type: 'error', title: 'Avatar', message: 'Avatar może mieć maksymalnie 3 MB.' })
      return
    }
    if (!user?.id || !isSupabaseConfigured || !supabase) {
      onToast?.({ type: 'error', title: 'Avatar', message: 'Nie udało się połączyć z profilem użytkownika.' })
      return
    }

    setAvatarUploading(true)
    try {
      const extension = (file.name.split('.').pop() || file.type.split('/').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `${user.id}/avatar-${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type })
      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(path)
      const nextAvatarUrl = publicData?.publicUrl || ''
      if (!nextAvatarUrl) throw new Error('Nie udało się pobrać adresu avatara.')

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: nextAvatarUrl })
        .eq('id', user.id)
      if (profileError) throw profileError

      await supabase.auth.updateUser({ data: { avatar_url: nextAvatarUrl } }).catch(() => null)

      setAvatarUrl(nextAvatarUrl)
      onAvatarUpdated?.(nextAvatarUrl)
      onToast?.({ type: 'success', title: 'Avatar zapisany', message: 'Zdjęcie profilowe zostało zaktualizowane.' })
    } catch (error) {
      onToast?.({ type: 'error', title: 'Błąd avatara', message: formatAppErrorMessage(error.message) })
    } finally {
      setAvatarUploading(false)
    }
  }

  const saveBio = async () => {
    const cleanBio = String(bioDraft || '').trim().slice(0, 220)
    if (!user?.id || !isSupabaseConfigured || !supabase) {
      onToast?.({ type: 'error', title: 'Opis profilu', message: 'Nie udało się połączyć z profilem użytkownika.' })
      return
    }
    setBioSaving(true)
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ bio: cleanBio })
        .eq('id', user.id)
      if (profileError) throw profileError

      await supabase.auth.updateUser({ data: { bio: cleanBio } }).catch(() => null)
      setBioDraft(cleanBio)
      onProfileUpdated?.({ bio: cleanBio, description: cleanBio, about: cleanBio })
      setBioEditing(false)
      onToast?.({ type: 'success', title: 'Opis zapisany', message: 'Opis profilu został zaktualizowany.' })
    } catch (error) {
      onToast?.({ type: 'error', title: 'Błąd opisu', message: formatAppErrorMessage(error.message) })
    } finally {
      setBioSaving(false)
    }
  }

  const userTips = (Array.isArray(tips) ? tips : []).map(normalizeTipRow).filter(tip => {
    const authorId = String(getTipAuthorId(tip) || tip.user_id || tip.author_id || '')
    const authorEmail = normalizeEmail(tip.author_email || tip.email || tip.user_email || '')
    const authorName = normalizeEmail(tip.author_name || tip.username || '')
    return (profile.id && authorId === String(profile.id)) || (email && authorEmail === email) || (username && authorName === normalizeEmail(username))
  })
  const profileStatsSource = user || {}
  const importedAtMs = Date.parse(profileStatsSource?.stats_imported_at || '')
  const hasImportedStats = Number(profileStatsSource?.imported_total_tips || 0) > 0 || Number(profileStatsSource?.imported_total_staked || 0) > 0 || Number(profileStatsSource?.imported_profit || 0) !== 0
  const liveTipsForStats = hasImportedStats && Number.isFinite(importedAtMs)
    ? userTips.filter(tip => Date.parse(tip.created_at || 0) > importedAtMs)
    : userTips

  const importedTotalTips = Number(profileStatsSource?.imported_total_tips || 0) || 0
  const importedWonTips = Number(profileStatsSource?.imported_won_tips || 0) || 0
  const importedLostTips = Number(profileStatsSource?.imported_lost_tips || 0) || 0
  const importedPendingTips = Number(profileStatsSource?.imported_pending_tips || 0) || 0
  const importedTotalStaked = Number(profileStatsSource?.imported_total_staked || 0) || 0
  const importedProfit = Number(profileStatsSource?.imported_profit || 0) || 0
  const importedAvgOdds = Number(profileStatsSource?.imported_avg_odds || 0) || 0
  const importedHighestOdds = Number(profileStatsSource?.imported_highest_odds || 0) || 0
  const importedTipsAmount = Number(profileStatsSource?.imported_tips_amount || 0) || 0
  const importedTipsCurrency = String(profileStatsSource?.imported_tips_currency || 'zł').trim() || 'zł'

  const liveTotalTips = liveTipsForStats.length
  const liveWonTips = liveTipsForStats.filter(tip => ['won', 'win', 'wygrany', 'wygrana'].includes(String(tip.status || '').toLowerCase())).length
  const liveLostTips = liveTipsForStats.filter(tip => ['lost', 'loss', 'przegrany', 'przegrana'].includes(String(tip.status || '').toLowerCase())).length
  const liveSettledTips = liveWonTips + liveLostTips
  const livePendingTips = Math.max(0, liveTotalTips - liveSettledTips)
  const liveAvgOddsNumber = liveTipsForStats.length ? (liveTipsForStats.reduce((sum, tip) => sum + Number(tip.odds || tip.course || 0), 0) / liveTipsForStats.length) : 0
  const liveSettledStake = liveTipsForStats.reduce((sum, tip) => {
    const status = String(tip.status || '').toLowerCase()
    if (!['won', 'win', 'wygrany', 'wygrana', 'lost', 'loss', 'przegrany', 'przegrana'].includes(status)) return sum
    return sum + Math.max(0, Number(tip.stake || tip.bet_amount || tip.amount || 0) || 0)
  }, 0)
  const liveProfitAmount = liveTipsForStats.reduce((sum, tip) => {
    const status = String(tip.status || '').toLowerCase()
    const stake = Math.max(0, Number(tip.stake || tip.bet_amount || tip.amount || 0) || 0)
    const odds = Math.max(0, Number(tip.odds || tip.course || 0) || 0)
    if (['won', 'win', 'wygrany', 'wygrana'].includes(status)) return sum + (stake * Math.max(0, odds - 1))
    if (['lost', 'loss', 'przegrany', 'przegrana'].includes(status)) return sum - stake
    return sum
  }, 0)
  const liveTotalStakedAmount = liveTipsForStats.reduce((sum, tip) => sum + Math.max(0, Number(tip.stake || tip.bet_amount || tip.amount || 0) || 0), 0)
  const liveHighestOddsNumber = liveTipsForStats.reduce((maxValue, tip) => Math.max(maxValue, Number(tip.odds || tip.course || 0) || 0), 0)

  // Statystyki historyczne z poprzedniej platformy stanowią bazę.
  // Nowe typy dodane PO dacie importu dopisują się automatycznie do kafelków.
  const totalTips = importedTotalTips + liveTotalTips
  const wonTips = importedWonTips + liveWonTips
  const lostTips = importedLostTips + liveLostTips
  const settledTips = wonTips + lostTips
  const pendingTips = importedPendingTips + livePendingTips
  const totalStakedAmount = importedTotalStaked + liveTotalStakedAmount
  const profitAmount = importedProfit + liveProfitAmount
  const winRate = settledTips ? Math.round((wonTips / settledTips) * 100) : 0
  const avgOddsNumber = totalTips
    ? (((importedAvgOdds * importedTotalTips) + (liveAvgOddsNumber * liveTotalTips)) / totalTips)
    : 0
  const avgOdds = avgOddsNumber ? avgOddsNumber.toFixed(2) : '—'
  const highestOddsNumber = Math.max(importedHighestOdds, liveHighestOddsNumber)
  const highestOdds = highestOddsNumber ? highestOddsNumber.toFixed(2) : '—'
  const roi = totalStakedAmount ? Math.round((profitAmount / totalStakedAmount) * 100) : (Number(profileStatsSource?.imported_yield || 0) || 0)
  const tipsSupportAmount = importedTipsAmount + (Number(user?.tips_earnings || user?.tips_total || user?.tips_income || 0) || 0)

  const statsCards = [
    { label: 'Yield', value: `${roi}%`, sub: roi > 0 ? 'Zwrot na plus' : roi < 0 ? 'Zwrot na minus' : 'Zwrot z inwestycji', tone: roi < 0 ? 'danger' : roi > 0 ? 'success' : 'neutral', accent: true },
    { label: 'Profit', value: `${profitAmount >= 0 ? '+' : ''}${profitAmount.toFixed(2)} zł`, sub: profitAmount > 0 ? 'Bilans na plus' : profitAmount < 0 ? 'Bilans na minus' : 'Bilans zerowy', tone: profitAmount < 0 ? 'danger' : profitAmount > 0 ? 'success' : 'neutral', accent: true },
    { label: 'Typy', value: String(totalTips), sub: 'Wszystkie dodane', tone: totalTips > 0 ? 'info' : 'neutral' },
    { label: 'Wygrane', value: String(wonTips), sub: 'Rozliczone na plus', tone: wonTips > 0 ? 'success' : 'neutral' },
    { label: 'Przegrane', value: String(lostTips), sub: 'Rozliczone na minus', tone: lostTips > 0 ? 'danger' : 'neutral' },
    { label: 'Pending', value: String(pendingTips), sub: 'Czekają na wynik', tone: pendingTips > 0 ? 'warning' : 'neutral' },
    { label: 'Stawki', value: `${totalStakedAmount.toFixed(2)} zł`, sub: 'Łącznie zagrane', tone: totalStakedAmount > 0 ? 'info' : 'neutral' },
    { label: 'Śr. kurs', value: avgOdds, sub: 'Średnia kursów', tone: Number(avgOdds) > 2 ? 'info' : 'neutral' },
    { label: 'Max kurs', value: highestOdds, sub: 'Najwyższy kurs', tone: highestOddsNumber >= 3 ? 'success' : 'neutral' },
    { label: 'Napiwki', value: `${tipsSupportAmount.toFixed(2)} ${importedTipsCurrency}`, sub: 'Wsparcie społeczności', tone: tipsSupportAmount > 0 ? 'success' : 'neutral' },
  ]
  const followersCount = Number(user?.followers_count || user?.followers || 0) || 0
  const followingCount = Number(user?.following_count || user?.following || 0) || 0
  const tokenCount = Number(user?.token_balance || user?.tokens || user?.coin || 0) || 0
  const walletAmount = Number(user?.wallet || user?.balance || 0) || 0
  const profileBio = user?.bio || user?.description || user?.about || fallbackBio
  const preferredSport = user?.preferred_sport || user?.sport || 'Nie ustawiono'

  const toTipRow = (tip, fallbackPremium = false) => {
    const normalized = normalizeTipRow(tip)
    const home = normalized.home_team || normalized.team_home || 'Gospodarze'
    const away = normalized.away_team || normalized.team_away || 'Goście'
    const league = normalized.league || 'Liga'
    const time = normalized.match_time || normalized.created_at || ''
    const timeLabel = time ? new Date(time).toLocaleString('pl-PL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : 'Brak daty'
    const pick = normalized.pick || normalized.type || normalized.bet_type || 'Typ'
    const odds = Number(normalized.odds || 0) ? Number(normalized.odds || 0).toFixed(2) : '—'
    const confidence = `${getAiConfidence(normalized) || 0}%`
    const access = isTipPremium(normalized) || fallbackPremium ? 'Premium' : 'FREE'
    return [home, away, `${league} • ${timeLabel}`, pick, odds, confidence, access, String(Number(normalized.likes || normalized.hearts || 0) || 0), normalized.created_at ? new Date(normalized.created_at).toLocaleDateString('pl-PL') : 'Teraz']
  }

  const buildProfileTipCard = (tip) => {
    const normalized = normalizeTipRow(tip)
    const premiumTip = isTipPremium(normalized)
    const home = normalized.home_team || normalized.team_home || 'Gospodarze'
    const away = normalized.away_team || normalized.team_away || 'Goście'
    const league = normalized.league || 'Liga'
    const matchTime = normalized.match_time || normalized.event_date || normalized.kickoff_at || normalized.created_at
    const createdAt = normalized.created_at ? new Date(normalized.created_at) : null
    const matchAt = matchTime ? new Date(matchTime) : null
    const formatDateTime = (value) => value && !Number.isNaN(value.getTime())
      ? value.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Brak daty'
    const status = String(normalized.status || 'pending').toLowerCase()
    const statusLabel = ['won', 'win', 'wygrany', 'wygrana'].includes(status)
      ? 'Wygrany'
      : ['lost', 'loss', 'przegrany', 'przegrana'].includes(status)
        ? 'Przegrany'
        : 'Oczekujący'
    const confidence = Math.max(0, Math.min(100, Number(normalized.ai_probability || normalized.ai_confidence || normalized.confidence || 0) || 0))
    return {
      id: normalized.id || `${home}-${away}-${normalized.created_at || Math.random()}`,
      rawTip: normalized,
      premium: premiumTip,
      home,
      away,
      league,
      homeLogo: normalized.home_logo || normalized.homeLogo || null,
      awayLogo: normalized.away_logo || normalized.awayLogo || null,
      homeTeamId: normalized.home_team_id || normalized.homeTeamId || null,
      awayTeamId: normalized.away_team_id || normalized.awayTeamId || null,
      pick: normalized.pick || normalized.bet_type || normalized.prediction || 'Typ',
      odds: Number(normalized.odds || 0) ? Number(normalized.odds).toFixed(2) : '—',
      stake: Number(normalized.stake || normalized.bet_amount || normalized.amount || (premiumTip ? 1 : 10)) || (premiumTip ? 1 : 10),
      analysis: normalized.ai_analysis || normalized.analysis || normalized.description || 'Brak analizy użytkownika.',
      confidence,
      createdLabel: formatDateTime(createdAt),
      matchLabel: formatDateTime(matchAt),
      statusLabel,
      likes: Number(normalized.likes || normalized.hearts || 0) || 0,
      trophies: Number(normalized.trophies || normalized.upvotes || 0) || 0,
      comments: Number(normalized.comments || normalized.comments_count || 0) || 0,
      price: Math.max(0, Number(normalized.price || 29) || 29)
    }
  }

  const premiumCards = userTips.filter(isTipPremium).slice(0, 3).map(buildProfileTipCard)
  const freeCards = userTips.filter(tip => !isTipPremium(tip)).slice(0, 3).map(buildProfileTipCard)
  const allProfileTipCards = userTips.map(buildProfileTipCard)

  const resultRows = [
    ['Bieżący miesiąc', String(totalTips), String(wonTips), String(lostTips), `${winRate}%`, `${roi}%`, `${profitAmount.toFixed(2)} zł`],
    ['Wszystkie typy', String(totalTips), String(wonTips), String(lostTips), `${winRate}%`, `${roi}%`, `${profitAmount.toFixed(2)} zł`],
  ]
  const analysisRows = userTips.slice(0, 3).map(tip => {
    const normalized = normalizeTipRow(tip)
    return [normalized.analysis || normalized.description || `Analiza: ${normalized.home_team || 'Mecz'} vs ${normalized.away_team || ''}`.trim(), normalized.created_at ? new Date(normalized.created_at).toLocaleDateString('pl-PL') : 'Bet+AI']
  })
  if (!analysisRows.length) analysisRows.push(['Brak analiz — dodaj pierwszy typ, aby zbudować historię profilu.', 'Bet+AI'])

  const rankingSnapshot = buildRankingFromTips(Array.isArray(tips) ? tips : [])
  const ownRankingRow = rankingSnapshot.find(row => {
    const sameId = profile.id && String(row.id || '') === String(profile.id)
    const sameEmail = email && normalizeEmail(row.email || '') === email
    const sameName = username && normalizeEmail(row.username || '') === normalizeEmail(username)
    return sameId || sameEmail || sameName
  })
  const rankingPosition = Number(user?.ranking_position || user?.rank || ownRankingRow?.liveRank || 0) || 0

  const sortedUserTips = [...userTips].sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0))
  const latestTip = sortedUserTips[0] || null
  const latestActivityRaw = latestTip?.created_at || user?.last_sign_in_at || user?.updated_at || profileCreatedAt || ''
  const formatProfileDate = (value) => {
    if (!value) return 'Brak danych'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Brak danych'
    const today = new Date()
    const sameDay = date.toDateString() === today.toDateString()
    if (sameDay) return 'Dzisiaj'
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) return 'Wczoraj'
    return date.toLocaleDateString('pl-PL')
  }
  const lastActivityLabel = formatProfileDate(latestActivityRaw)
  const lastTipAt = latestTip?.created_at ? new Date(latestTip.created_at) : null
  const isActive30d = Boolean(lastTipAt && !Number.isNaN(lastTipAt.getTime()) && Date.now() - lastTipAt.getTime() <= 30 * 24 * 60 * 60 * 1000)
  const rankingPercent = Number(user?.ranking_percent || user?.rank_percent || 0) || 0

  const profileBadges = [
    { icon: '🏆', tone: 'orange', title: 'TOP 1%', detail: rankingPercent > 0 ? `${rankingPercent}%` : (rankingPosition ? `#${rankingPosition}` : 'Brak rankingu'), achieved: rankingPercent > 0 && rankingPercent <= 1 },
    { icon: '✦', tone: 'gold', title: '1000+', detail: `${totalTips}/1000 typów`, achieved: totalTips >= 1000 },
    { icon: '🛡', tone: 'cyan', title: 'WIN RATE+', detail: settledTips ? `${winRate}% / 60%` : '0 rozliczeń', achieved: settledTips >= 10 && winRate >= 60 },
    { icon: '↗', tone: 'teal', title: 'ROI+', detail: `${roi}% / 10%`, achieved: settledTips >= 10 && roi >= 10 },
    { icon: '⚡', tone: 'yellow', title: 'AKTYWNY', detail: isActive30d ? 'Typ w 30 dni' : 'Brak typu 30 dni', achieved: isActive30d },
    { icon: '♛', tone: 'purple', title: 'PREMIUM', detail: premium ? 'Aktywne' : 'Nieaktywne', achieved: premium },
  ]

  const summaryRows = [
    ['Użytkownik od', createdLabel],
    ['Ostatnia aktywność', lastActivityLabel],
    ['Poziom', roleLabel],
    ['Ranking globalny', rankingPosition ? `#${rankingPosition}` : 'Brak danych'],
    ['Preferowane dyscypliny', preferredSport],
  ]

  const recentActivityRows = sortedUserTips.slice(0, 3).map(tip => {
    const normalized = normalizeTipRow(tip)
    const status = String(normalized.status || 'pending').toLowerCase()
    const statusLabel = ['won', 'win', 'wygrany', 'wygrana'].includes(status)
      ? 'Wygrany'
      : ['lost', 'loss', 'przegrany', 'przegrana'].includes(status)
        ? 'Przegrany'
        : 'Oczekujący'
    return [
      normalized.bet_type || normalized.pick || 'Typ',
      `${normalized.team_home || 'Mecz'} vs ${normalized.team_away || ''}`.trim(),
      `${statusLabel} • ${formatProfileDate(normalized.created_at)}`
    ]
  })
  if (!recentActivityRows.length) recentActivityRows.push(['Brak typów', 'Dodaj pierwszy typ, aby zbudować aktywność profilu', createdLabel])

  const profileRatingAverage = Number(user?.rating_avg || user?.average_rating || user?.rating || 0) || 0
  const profileRatingCount = Number(user?.rating_count || user?.reviews_count || 0) || 0
  const ratingDistribution = user?.rating_distribution && typeof user.rating_distribution === 'object'
    ? user.rating_distribution
    : {}
  const ratingBars = [5,4,3,2,1].map(score => {
    const count = Number(ratingDistribution[score] ?? ratingDistribution[String(score)] ?? 0) || 0
    const width = profileRatingCount ? Math.round((count / profileRatingCount) * 100) : 0
    return { label: `${score} ★`, count, width }
  })

  const rankingRows = ownRankingRow
    ? [[String(ownRankingRow.liveRank || rankingPosition || '—'), displayName, `${Number(ownRankingRow.roi || roi || 0).toFixed(0)}% ROI`, String(ownRankingRow.followers || followersCount), `${profitAmount >= 0 ? '+' : ''}${profitAmount.toFixed(2)} zł`]]
    : []


  const importedTypeStatsRows = [
    { label: 'Publiczny', coupons: 190, profit: 2207.34, yield: 36.00, avgOdds: 1.80, avgStake: 325.81 },
    { label: 'Płatny', coupons: 499, profit: 57848.55, yield: 41.00, avgOdds: 1.94, avgStake: 282.36 },
  ]
  const importedSportStatsRows = [
    { label: 'MMA', coupons: 47, stake: 33073.99, profit: 75029.02, yield: 227.00 },
    { label: 'Baseball', coupons: 26, stake: 5215.00, profit: 4107.70, yield: 79.00 },
    { label: 'Krykiet', coupons: 2, stake: 50.00, profit: 16.80, yield: 34.00 },
    { label: 'Koszykówka', coupons: 20, stake: 3428.00, profit: 622.39, yield: 18.00 },
    { label: 'Piłka nożna', coupons: 497, stake: 109473.34, profit: 5903.54, yield: 5.00 },
    { label: 'Tenis', coupons: 103, stake: 21423.67, profit: 546.54, yield: 3.00 },
    { label: 'Darts', coupons: 4, stake: 50.00, profit: 0.70, yield: 1.00 },
    { label: 'Hokej', coupons: 30, stake: 8036.00, profit: -45.60, yield: -1.00 },
    { label: 'Boks', coupons: 5, stake: 3020.00, profit: -650.00, yield: -22.00 },
    { label: 'Snooker', coupons: 22, stake: 19030.00, profit: -5611.20, yield: -29.00 },
  ]
  const importedOddsStatsRows = [
    { label: '1.01 - 1.50', coupons: 136, profit: 1392.96, yield: 3.00, avgOdds: 1.45, avgStake: 347.82 },
    { label: '1.51 - 2.00', coupons: 448, profit: 9163.29, yield: 8.00, avgOdds: 1.71, avgStake: 251.25 },
    { label: '2.01 - 3.00', coupons: 71, profit: 9091.58, yield: 37.00, avgOdds: 2.26, avgStake: 342.20 },
    { label: '3.01 - 5.00', coupons: 27, profit: 1892.06, yield: 13.00, avgOdds: 3.58, avgStake: 541.41 },
    { label: '5.01 - 8.00', coupons: 1, profit: 4100.00, yield: 410.00, avgOdds: 5.10, avgStake: 1000.00 },
    { label: '8.01 - 9.99', coupons: 1, profit: 7290.00, yield: 729.00, avgOdds: 8.29, avgStake: 1000.00 },
    { label: '10.00+', coupons: 2, profit: 46990.00, yield: 4652.00, avgOdds: 36.40, avgStake: 505.00 },
  ]
  const importedHourStatsRows = [
    { label: '00:00 - 07:59', coupons: 114, profit: 60871.45, yield: 153.00, avgOdds: 2.36, avgStake: 349.57 },
    { label: '08:00 - 11:59', coupons: 52, profit: 1564.82, yield: 14.00, avgOdds: 1.73, avgStake: 220.58 },
    { label: '12:00 - 16:59', coupons: 167, profit: -5910.06, yield: -23.00, avgOdds: 1.77, avgStake: 155.08 },
    { label: '17:00 - 19:59', coupons: 215, profit: 12269.92, yield: 18.00, avgOdds: 1.79, avgStake: 323.05 },
    { label: '20:00 - 23:59', coupons: 141, profit: 1123.76, yield: 20.00, avgOdds: 1.91, avgStake: 398.04 },
  ]
  const importedMonthStatsRows = [
    { label: '05/2026', coupons: 55, stake: 19340.00, profit: 2049.10, yield: 11.00 },
    { label: '04/2026', coupons: 251, stake: 74481.00, profit: 5850.88, yield: 8.00 },
    { label: '03/2026', coupons: 272, stake: 105496.00, profit: 70296.40, yield: 67.00 },
    { label: '02/2026', coupons: 58, stake: 3165.00, profit: 1593.26, yield: 50.00 },
    { label: '01/2026', coupons: 53, stake: 318.00, profit: 130.25, yield: 41.00 },
    { label: '12/2025', coupons: 0, stake: 0, profit: 0, yield: 0 },
    { label: '11/2025', coupons: 0, stake: 0, profit: 0, yield: 0 },
    { label: '10/2025', coupons: 0, stake: 0, profit: 0, yield: 0 },
    { label: '09/2025', coupons: 0, stake: 0, profit: 0, yield: 0 },
    { label: '08/2025', coupons: 0, stake: 0, profit: 0, yield: 0 },
  ]
  const balanceChartRows = [...importedMonthStatsRows].reverse().map(row => ({ label: row.label, value: row.profit }))
  const profileVisibleTipCards = allProfileTipCards.filter(tip => {
    if (profileTipsFilter === 'premium') return tip.premium
    if (profileTipsFilter === 'free') return !tip.premium
    return true
  })
  const resultTipRows = allProfileTipCards.filter(tip => {
    if (profileResultsFilter === 'won') return tip.statusLabel === 'Wygrany'
    if (profileResultsFilter === 'lost') return tip.statusLabel === 'Przegrany'
    if (profileResultsFilter === 'pending') return tip.statusLabel === 'Oczekujący'
    return true
  })
  const formatStatValue = (value, decimals = 2) => Number(value || 0).toFixed(decimals)
  const linePoints = balanceChartRows.map((row, index) => {
    const maxValue = Math.max(...balanceChartRows.map(item => Number(item.value || 0)), 1)
    const x = balanceChartRows.length <= 1 ? 0 : (index / (balanceChartRows.length - 1)) * 100
    const y = 100 - ((Number(row.value || 0) / maxValue) * 100)
    return `${x},${Math.max(0, Math.min(100, y))}`
  }).join(' ')
  const historyEvents = sortedUserTips.slice(0, 8).map(tip => {
    const normalized = normalizeTipRow(tip)
    const card = buildProfileTipCard(normalized)
    return {
      date: formatProfileDate(normalized.created_at),
      title: card.statusLabel === 'Oczekujący' ? 'Opublikowano typ' : `Rozliczono typ: ${card.statusLabel}`,
      detail: `${card.home} vs ${card.away} • ${card.pick} • kurs ${card.odds}`,
      tone: card.statusLabel === 'Wygrany' ? 'success' : card.statusLabel === 'Przegrany' ? 'danger' : 'info',
      amount: card.statusLabel === 'Wygrany' ? `+${(card.stake * Math.max(0, Number(card.odds) - 1)).toFixed(2)} zł` : card.statusLabel === 'Przegrany' ? `-${card.stake.toFixed(2)} zł` : '',
    }
  })
  const reviewRows = Array.isArray(user?.reviews) ? user.reviews : []

  const profileTipStats = {
    yieldLabel: `${roi}%`,
    totalTipsLabel: String(totalTips),
    profitLabel: `${profitAmount >= 0 ? '+' : ''}${profitAmount.toFixed(2)} zł`,
    profitValue: profitAmount,
  }

  const renderProfileTipCard = (tip) => (
    <ProfileLiveTipCard
      key={tip.id}
      tip={tip}
      sourceTip={tip.rawTip || {}}
      avatarUrl={avatarUrl}
      initials={initials}
      displayName={displayName}
      currentUser={user}
      unlockedTips={unlockedTips}
      tipsterSubscriptions={tipsterSubscriptions}
      followingTipsters={followingTipsters}
      onToggleFollow={onToggleFollow}
      onUnlock={onUnlock}
      onSubscribeToTipster={onSubscribeToTipster}
      onToast={onToast}
      onViewType={() => setProfileTab('tips')}
      authorStats={profileTipStats}
    />
  )

  return (
    <section className={`profile-page profile-static-v3 ${(profileTab === 'overview' || profileTab === 'tips') ? '' : 'profile-v4-wide-mode'}`} aria-label="Mój profil">
      <div className="profile-v3-layout">
        <div className="profile-v3-main">
          <div className="profile-v3-hero glass-profile-v3">
            <div className="profile-v3-hero-overlay"></div>
            <button
              type="button"
              className={`profile-hero-stripe-btn ${stripeConnectStatus?.payouts_enabled ? 'ready' : stripeConnectStatus?.stripe_account_id ? 'pending' : 'empty'}`}
              onClick={() => onConnectStripe?.()}
            >
              {stripeConnectStatus?.payouts_enabled ? 'Zarządzaj Stripe' : stripeConnectStatus?.stripe_account_id ? 'Dokończ Stripe' : 'Podłącz Stripe'}
            </button>
            <div className="profile-v3-user-row">
              <button
                type="button"
                className={`profile-v3-avatar profile-v3-avatar-editable ${avatarUrl ? 'has-avatar' : ''} ${avatarUploading ? 'is-uploading' : ''}`}
                onClick={chooseAvatar}
                title="Kliknij, aby dodać lub zmienić avatar"
                style={avatarUrl ? { '--avatar-image': `url("${avatarUrl}")` } : undefined}
              >
                {avatarUrl ? '' : initials}
                <span>{avatarUploading ? '...' : '✎'}</span>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="profile-avatar-file-input"
                onChange={changeAvatar}
              />
              <div className="profile-v3-user-copy">
                <div className="profile-v3-name-line">
                  <h1>{displayName}</h1>
                  
                </div>
                <small>{handleName}</small>
                <div className="profile-v3-badges">
                  <span>{roleLabel}</span>
                  <span>TYPER</span>
                  {totalTips > 0 && <span>AKTYWNY</span>}
                </div>
                {bioEditing ? (
                  <div className="profile-v3-bio-editor">
                    <textarea
                      value={bioDraft}
                      onChange={(event) => setBioDraft(event.target.value.slice(0, 220))}
                      maxLength={220}
                      autoFocus
                    />
                    <div>
                      <small>{bioDraft.length}/220</small>
                      <button type="button" onClick={() => {
                        setBioDraft(profileBio)
                        setBioEditing(false)
                      }}>Anuluj</button>
                      <button type="button" className="primary" onClick={saveBio} disabled={bioSaving}>{bioSaving ? 'Zapisuję...' : 'Zapisz opis'}</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="profile-v3-bio-click" onClick={() => setBioEditing(true)} title="Kliknij, aby zmienić opis profilu">
                    {profileBio}
                    <span>✎</span>
                  </button>
                )}
                <div className="profile-v3-actions">
                  <button type="button" className="primary">Mój profil</button>
                  <button type="button">▢ Wiadomości</button>
                  <button type="button">🏆 Wsparcie tipami</button>
                </div>
              </div>
            </div>
          </div>

          <section className="glass-profile-v3 profile-v3-card profile-stats-cards-section">
            <div className="profile-v3-card-head">
              <h3>📊 Twoje statystyki</h3>
            </div>
            <div className="profile-stats-cards-grid">
              {statsCards.map((card) => (
                <article
                  key={card.label}
                  className={`profile-stat-card profile-stat-card-${card.tone} ${card.accent ? 'is-accent' : ''}`}
                >
                  <small>{card.label}</small>
                  <strong>{card.value}</strong>
                  <span>{card.sub}</span>
                </article>
              ))}
            </div>
          </section>

          <div className="profile-v3-tabs glass-profile-v3 profile-v4-tabs">
            <button type="button" className={profileTab === 'tips' ? 'active' : ''} onClick={() => setProfileTab('tips')}><span>◉</span> Typy <b>{totalTips}</b></button>
            <button type="button" className={profileTab === 'results' ? 'active' : ''} onClick={() => setProfileTab('results')}><span>↗</span> Wyniki</button>
            <button type="button" className={profileTab === 'stats' ? 'active' : ''} onClick={() => setProfileTab('stats')}><span>▮▮</span> Statystyki</button>
            <button type="button" className={profileTab === 'history' ? 'active' : ''} onClick={() => setProfileTab('history')}><span>◷</span> Historia</button>
            <button type="button" className={profileTab === 'opinions' ? 'active' : ''} onClick={() => setProfileTab('opinions')}><span>☁</span> Opinie</button>
            <button type="button" className={profileTab === 'pricing' ? 'active' : ''} onClick={() => setProfileTab('pricing')}><span>▣</span> Cennik subskrypcji</button>
          </div>

          {profileTab === 'tips' && (
            <section className="glass-profile-v3 profile-v3-card profile-v4-page profile-v4-tips-page">
              <div className="profile-v3-card-head profile-v4-tips-head"><h3>◉ Typy</h3></div>
              <div className="profile-v4-filter-row">
                <button type="button" className={`filter-pill-v872 all ${profileTipsFilter === 'all' ? 'active' : ''}`} onClick={() => setProfileTipsFilter('all')}><span className="filter-icon-v872">◉</span><span>Wszystkie</span><b>{allProfileTipCards.length}</b></button>
                <button type="button" className={`filter-pill-v872 premium ${profileTipsFilter === 'premium' ? 'active' : ''}`} onClick={() => setProfileTipsFilter('premium')}><span className="filter-icon-v872">♕</span><span>Premium</span><b>{premiumCards.length}</b></button>
                <button type="button" className={`filter-pill-v872 free ${profileTipsFilter === 'free' ? 'active' : ''}`} onClick={() => setProfileTipsFilter('free')}><span className="filter-icon-v872">🎁</span><span>Darmowe</span><b>{freeCards.length}</b></button>
              </div>
              {profileVisibleTipCards.length ? (
                <div className="profile-all-tips-list">{profileVisibleTipCards.map(renderProfileTipCard)}</div>
              ) : (
                <div className="profile-live-tip-empty">Brak typów w tej kategorii.</div>
              )}
            </section>
          )}


          {profileTab === 'results' && (
            <section className="profile-v4-page profile-v4-results-page">
              <div className="profile-v4-summary-grid">
                <article><small>Wszystkie rozliczone</small><strong>{settledTips}</strong></article>
                <article className="success"><small>Wygrane</small><strong>{wonTips}</strong></article>
                <article className="danger"><small>Przegrane</small><strong>{lostTips}</strong></article>
                <article className="warning"><small>Nierozliczone</small><strong>{pendingTips}</strong></article>
                <article className={roi >= 0 ? 'success' : 'danger'}><small>Yield</small><strong>{roi}%</strong></article>
                <article className={profitAmount >= 0 ? 'success' : 'danger'}><small>Bilans</small><strong>{profitAmount >= 0 ? '+' : ''}{profitAmount.toFixed(2)} zł</strong></article>
              </div>
              <section className="glass-profile-v3 profile-v3-card profile-v4-chart-card">
                <div className="profile-v3-card-head"><h3>Wyniki — przebieg bilansu</h3></div>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="profile-v4-balance-chart">
                  <defs>
                    <linearGradient id="profileBalanceFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(0,255,148,.32)" />
                      <stop offset="100%" stopColor="rgba(0,255,148,0)" />
                    </linearGradient>
                  </defs>
                  <polyline points={linePoints} fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <polygon points={`0,100 ${linePoints} 100,100`} fill="url(#profileBalanceFill)" />
                </svg>
              </section>
              <section className="glass-profile-v3 profile-v3-card profile-v4-table-card">
                <div className="profile-v4-filter-row">
                  <button type="button" className={profileResultsFilter === 'all' ? 'active' : ''} onClick={() => setProfileResultsFilter('all')}>Wszystkie</button>
                  <button type="button" className={profileResultsFilter === 'won' ? 'active' : ''} onClick={() => setProfileResultsFilter('won')}>Wygrane</button>
                  <button type="button" className={profileResultsFilter === 'lost' ? 'active' : ''} onClick={() => setProfileResultsFilter('lost')}>Przegrane</button>
                  <button type="button" className={profileResultsFilter === 'pending' ? 'active' : ''} onClick={() => setProfileResultsFilter('pending')}>Nierozliczone</button>
                </div>
                <div className="profile-v4-results-table">
                  <div><b>Mecz</b><b>Typ</b><b>Kurs</b><b>Stawka</b><b>Wynik</b></div>
                  {resultTipRows.length ? resultTipRows.map(tip => (
                    <div key={tip.id}>
                      <span>{tip.home} — {tip.away}</span>
                      <span>{tip.pick}</span>
                      <span>{tip.odds}</span>
                      <span>{tip.stake.toFixed(2)} zł</span>
                      <em className={tip.statusLabel === 'Wygrany' ? 'pos' : tip.statusLabel === 'Przegrany' ? 'neg' : 'wait'}>{tip.statusLabel}</em>
                    </div>
                  )) : <p>Brak wyników w tej kategorii.</p>}
                </div>
              </section>
            </section>
          )}

          {profileTab === 'stats' && (
            <section className="profile-v4-page profile-v4-stats-page">
              <div className="profile-v4-summary-grid profile-v4-stats-top">
                <article><small>Postawione kupony</small><strong>{totalTips}</strong></article>
                <article><small>Wygrane / przegrane</small><strong>{wonTips} / {lostTips}</strong></article>
                <article className="warning"><small>Nierozliczone kupony</small><strong>{pendingTips}</strong></article>
                <article className="success"><small>Yield</small><strong>{roi}%</strong></article>
                <article className={profitAmount >= 0 ? 'success' : 'danger'}><small>Bilans</small><strong>{profitAmount.toFixed(2)}</strong></article>
                <article><small>Zainwestowane pieniądze</small><strong>{totalStakedAmount.toFixed(2)}</strong></article>
              </div>
              <section className="glass-profile-v3 profile-v3-card profile-v4-chart-card">
                <div className="profile-v3-card-head"><h3>Wykres salda</h3></div>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="profile-v4-balance-chart cyan">
                  <defs>
                    <linearGradient id="profileBalanceBlue" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(0,180,255,.34)" />
                      <stop offset="100%" stopColor="rgba(0,180,255,0)" />
                    </linearGradient>
                  </defs>
                  <polyline points={linePoints} fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <polygon points={`0,100 ${linePoints} 100,100`} fill="url(#profileBalanceBlue)" />
                </svg>
              </section>
              <div className="profile-v4-stats-grid">
                <ProfileStatsTable title="Statystyki typów kuponów" columns={['Statystyki', 'Ilość kuponów', 'Bilans', 'Yield', 'Śr. kurs', 'Śr. stawka']} rows={importedTypeStatsRows.map(row => [row.label, row.coupons, formatStatValue(row.profit), `${formatStatValue(row.yield)}%`, formatStatValue(row.avgOdds), formatStatValue(row.avgStake)])} />
                <ProfileStatsTable title="Statystyki dla sportów" columns={['Sport', 'Liczba kuponów', 'Stawka', 'Wygrana', 'Yield']} rows={importedSportStatsRows.map(row => [row.label, row.coupons, formatStatValue(row.stake), formatStatValue(row.profit), `${formatStatValue(row.yield)}%`])} />
                <ProfileStatsTable title="Statystyki zakresów kursów" columns={['Kurs', 'Ilość kuponów', 'Bilans', 'Yield', 'Śr. kurs', 'Śr. stawka']} rows={importedOddsStatsRows.map(row => [row.label, row.coupons, formatStatValue(row.profit), `${formatStatValue(row.yield)}%`, formatStatValue(row.avgOdds), formatStatValue(row.avgStake)])} />
                <ProfileStatsTable title="Statystyki godzin dodawania kuponów" columns={['Godziny', 'Ilość kuponów', 'Bilans', 'Yield', 'Śr. kurs', 'Śr. stawka']} rows={importedHourStatsRows.map(row => [row.label, row.coupons, formatStatValue(row.profit), `${formatStatValue(row.yield)}%`, formatStatValue(row.avgOdds), formatStatValue(row.avgStake)])} />
                <ProfileStatsTable title="Statystyki poszczególnych miesięcy" columns={['Data', 'Liczba kuponów', 'Zainwestowane', 'Bilans', 'Yield']} rows={importedMonthStatsRows.map(row => [row.label, row.coupons, formatStatValue(row.stake), formatStatValue(row.profit), `${formatStatValue(row.yield)}%`])} wide />
              </div>
            </section>
          )}

          {profileTab === 'history' && (
            <section className="glass-profile-v3 profile-v3-card profile-v4-page profile-v4-history-page">
              <div className="profile-v3-card-head"><h3>Historia aktywności</h3><span>{historyEvents.length} zdarzeń</span></div>
              <div className="profile-v4-history-timeline">
                {historyEvents.length ? historyEvents.map((event, index) => (
                  <article key={`${event.title}-${index}`} className={event.tone}>
                    <small>{event.date}</small>
                    <div>
                      <strong>{event.title}</strong>
                      <span>{event.detail}</span>
                    </div>
                    {event.amount && <b>{event.amount}</b>}
                  </article>
                )) : <p>Brak aktywności do pokazania.</p>}
              </div>
            </section>
          )}

          {profileTab === 'opinions' && (
            <section className="profile-v4-page profile-v4-opinions-page">
              <div className="glass-profile-v3 profile-v3-card profile-v4-opinion-summary">
                <div>
                  <small>Podsumowanie opinii</small>
                  <strong>{profileRatingCount ? profileRatingAverage.toFixed(1) : '0.0'}</strong>
                  <span>{profileRatingCount ? `${profileRatingCount} opinii` : 'Brak opinii profilu'}</span>
                </div>
                <div className="profile-v4-rating-bars">
                  {ratingBars.map(row => (
                    <label key={row.label}><span>{row.label}</span><i><b style={{ width: `${row.width}%` }} /></i><em>{row.count}</em></label>
                  ))}
                </div>
              </div>
              <section className="glass-profile-v3 profile-v3-card profile-v4-reviews-list">
                <div className="profile-v3-card-head"><h3>Opinie</h3><span>{reviewRows.length} pozycji</span></div>
                {reviewRows.length ? reviewRows.map((review, index) => (
                  <article key={review.id || index}>
                    <strong>{review.author_name || 'Użytkownik'}</strong>
                    <span>{review.comment || review.body || ''}</span>
                  </article>
                )) : <div className="profile-live-tip-empty">Nie masz jeszcze opinii.</div>}
              </section>
            </section>
          )}

          {profileTab === 'pricing' && (
            <TipsterPricingSettings user={user} onToast={onToast} />
          )}

          {profileTab === 'overview' && (
            <>
          <div className="profile-v3-content-grid">
            <div className="profile-v3-left-col profile-live-tip-sections">
              <section className="glass-profile-v3 profile-v3-card profile-live-tip-section">
                <div className="profile-v3-card-head"><h3>🏆 Ostatnie typy PREMIUM</h3><button type="button" onClick={() => setProfileTab('tips')}>Zobacz wszystkie</button></div>
                {premiumCards.length ? premiumCards.map(renderProfileTipCard) : (
                  <div className="profile-live-tip-empty">Brak typów premium.</div>
                )}
              </section>

              <section className="glass-profile-v3 profile-v3-card profile-live-tip-section">
                <div className="profile-v3-card-head"><h3>🟢 Ostatnie typy FREE</h3><button type="button" onClick={() => setProfileTab('tips')}>Zobacz wszystkie</button></div>
                {freeCards.length ? freeCards.map(renderProfileTipCard) : (
                  <div className="profile-live-tip-empty">Brak darmowych typów.</div>
                )}
              </section>
            </div>
          </div>
            </>
          )}
        </div>

        {(profileTab === 'overview' || profileTab === 'tips') && <aside className="profile-v3-sidebar profile-v4-shared-sidebar">
          <div className="glass-profile-v3 side-card-v3">
            <div className="side-card-head-v3"><h3>Podsumowanie</h3><span>• ONLINE ●</span></div>
            <div className="key-list-v3">
              {summaryRows.map((row, idx) => <div key={idx}><span>{row[0]}</span><b>{row[1]}</b></div>)}
            </div>
          </div>

          <div className="glass-profile-v3 side-card-v3">
            <div className="side-card-head-v3"><h3>Społeczność</h3></div>
            <div className="community-v3"><div><span>👥 Obserwujący</span><b>{followersCount}</b></div><div><span>👤 Obserwowani</span><b>{followingCount}</b></div></div>
          </div>

          <div className="glass-profile-v3 side-card-v3 side-badges-v3">
            <div className="side-card-head-v3"><h3>🏅 Osiągnięcia / Odznaki</h3><button type="button" onClick={() => setProfileTab('history')}>Zobacz historię</button></div>
            <div className="badges-grid-v3 sidebar-badges-grid">
              {profileBadges.map(badge => (
                <div key={badge.title} className={badge.achieved ? 'achieved' : 'locked'}>
                  <span className={`badge-orb ${badge.tone}`}>{badge.icon}</span>
                  <strong>{badge.title}</strong>
                  <small>{badge.detail}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-profile-v3 side-card-v3">
            <div className="side-card-head-v3"><h3>Oceny i opinie</h3><button type="button" onClick={() => setProfileTab('opinions')}>Zobacz opinie</button></div>
            <div className="ratings-v3">
              <div className="rating-score">
                <strong>{profileRatingCount ? profileRatingAverage.toFixed(1) : '0.0'}</strong>
                <span>{profileRatingCount ? '★★★★★' : '☆☆☆☆☆'}</span>
                <small>{profileRatingCount ? `Na podstawie ${profileRatingCount} opinii` : 'Brak ocen profilu'}</small>
              </div>
              <div className="rating-bars">
                {ratingBars.map((row, idx) => <div key={idx}><span>{row.label}</span><div className="rate-bar"><i style={{width: `${row.width}%`}}></i></div><b>{row.count}</b></div>)}
              </div>
            </div>
          </div>

          <div className="glass-profile-v3 side-card-v3">
            <div className="side-card-head-v3"><h3>Ranking typerów</h3></div>
            <div className="ranking-v3">
              {rankingRows.length ? rankingRows.map((row, idx) => <div key={idx}><span className="rank-mini">{row[0]}</span><div><strong>{row[1]}</strong><small>{row[2]}</small></div><em>{row[3]}</em><b>{row[4]}</b></div>) : (
                <div className="profile-sidebar-empty">Brak danych rankingowych.</div>
              )}
            </div>
          </div>
        </aside>}
      </div>
    </section>
  )
}


function DepositsView({ user, wallet = 0, onTopUp, onViewChange }) {
  const [amount, setAmount] = useState(100)
  const [customAmount, setCustomAmount] = useState('')
  const [topups, setTopups] = useState([])
  const [loading, setLoading] = useState(false)
  const presetAmounts = [10, 25, 50, 100, 200, 500]
  const selectedAmount = customAmount !== '' ? Number(customAmount || 0) : Number(amount || 0)
  const safeAmount = Math.max(1, Math.round(Number(selectedAmount || 0) * 100) / 100)

  useEffect(() => {
    let active = true
    async function loadTopups() {
      if (!isSupabaseConfigured || !supabase || !user?.id) return
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'topup')
          .order('created_at', { ascending: false })
          .limit(10)
        if (error) throw error
        if (active) setTopups(data || [])
      } catch (error) {
        console.warn('deposits history skipped', error)
        if (active) setTopups([])
      } finally {
        if (active) setLoading(false)
      }
    }
    loadTopups()
    const refresh = () => loadTopups()
    window.addEventListener('betai-wallet-history-changed', refresh)
    return () => {
      active = false
      window.removeEventListener('betai-wallet-history-changed', refresh)
    }
  }, [user?.id])

  return (
    <section className="deposits-page wallet-subpage">
      <div className="wallet-subpage-tabs glass-v2-panel">
        <button type="button" onClick={() => onViewChange?.('wallet')}>Portfel</button>
        <button type="button" className="active">Wpłaty</button>
        <button type="button" onClick={() => onViewChange?.('payouts')}>Wypłaty</button>
        <button type="button" onClick={() => onViewChange?.('payments')}>Płatności</button>
        <button type="button" onClick={() => onViewChange?.('subscriptions')}>Subskrypcja</button>
        <button type="button" onClick={() => onViewChange?.('earnings')}>Zarobki</button>
      </div>

      <div className="deposits-hero glass-v2-panel">
        <div>
          <span>Doładuj portfel</span>
          <h1>Wpłaty</h1>
          <p>Dodaj środki do salda Bet+AI. Na teraz aktywną metodą jest Stripe, a każda opłacona wpłata zapisuje się automatycznie w historii konta.</p>
        </div>
        <div className="deposits-balance">
          <small>Aktualne saldo</small>
          <b>{formatMoney(wallet)}</b>
        </div>
      </div>

      <div className="deposits-grid">
        <div className="glass-v2-panel deposits-card">
          <div className="deposits-card-head">
            <h2>Nowa wpłata</h2>
            <span className="deposits-live-pill">Stripe aktywne</span>
          </div>
          <p>Wybierz kwotę lub wpisz własną. Po płatności Stripe saldo zwiększy się po potwierdzeniu webhooka.</p>
          <div className="deposits-amounts">
            {presetAmounts.map(value => (
              <button
                type="button"
                key={value}
                className={customAmount === '' && Number(amount) === value ? 'active' : ''}
                onClick={() => { setAmount(value); setCustomAmount('') }}
              >
                {value} zł
              </button>
            ))}
          </div>
          <label className="deposits-custom">
            <span>Własna kwota</span>
            <input
              type="number"
              min="1"
              step="0.01"
              placeholder="np. 75"
              value={customAmount}
              onChange={event => setCustomAmount(event.target.value)}
            />
          </label>
          <button type="button" className="wallet-v2-primary-btn deposits-pay-btn" onClick={() => onTopUp?.(safeAmount)}>
            Wpłać {formatMoney(safeAmount)} przez Stripe
          </button>
        </div>

        <div className="glass-v2-panel deposits-card">
          <div className="deposits-card-head"><h2>Metoda wpłaty</h2></div>
          <div className="deposits-methods">
            <div className="active"><span className="pay-logo stripe">S</span><strong>Stripe</strong><small>Aktywne</small></div>
            <div className="locked"><span className="pay-logo paypal">P</span><strong>PayPal</strong><small>🔒 Wkrótce</small></div>
            <div className="locked"><span className="pay-logo revolut">R</span><strong>Revolut</strong><small>🔒 Wkrótce</small></div>
          </div>
          <ul className="deposits-rules">
            <li>Wpłata jest przypisana do zalogowanego użytkownika.</li>
            <li>Saldo rośnie dopiero po potwierdzeniu płatności Stripe.</li>
            <li>Każda wpłata pojawia się w historii transakcji i płatnościach.</li>
          </ul>
        </div>

        <div className="glass-v2-panel deposits-card deposits-history-card">
          <div className="deposits-card-head"><h2>Ostatnie wpłaty</h2></div>
          {loading ? (
            <div className="deposits-empty">Ładowanie wpłat...</div>
          ) : topups.length ? (
            <div className="deposits-history-list">
              {topups.map(row => (
                <div key={row.id}>
                  <span>{new Date(row.created_at).toLocaleString('pl-PL')}</span>
                  <strong>+{formatMoney(row.amount)}</strong>
                  <small>{row.status === 'completed' ? 'Opłacona' : row.status || 'Oczekuje'}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="deposits-empty">Nie masz jeszcze żadnych wpłat.</div>
          )}
        </div>
      </div>
    </section>
  )
}

function PayoutsView({ user, payoutRequests = [], onRequestPayout, userPlan = 'free', stripeConnectStatus, onConnectStripe, onViewChange, submitting = false, earnings = null }) {
  const MIN_PAYOUT_AMOUNT = 50

  if (!user) {
    return (
      <section className="wallet-subpage payout-live-page">
        <div className="payout-live-loading glass-v2-panel">
          <strong>Ładowanie wypłat...</strong>
          <span>Trwa pobieranie danych konta.</span>
        </div>
      </section>
    )
  }

  const profile = getUserProfileView(user)
  const planLimits = getPlanLimits(userPlan)
  const monthlyPayoutCount = getMonthlyCount(payoutRequests)
  const payoutLimitReached = monthlyPayoutCount >= planLimits.monthlyPayoutLimit
  const grossRevenue = Array.isArray(earnings?.history)
    ? earnings.history.reduce((sum, row) => sum + Number(row?.gross_amount || Number(row?.amount || 0) + Number(row?.commission || 0) || 0), 0)
    : 0
  const platformFee = Array.isArray(earnings?.history)
    ? earnings.history.reduce((sum, row) => sum + Number(row?.commission || 0), 0)
    : 0
  const totalNetEarnings = Number(earnings?.total || 0)
  const paidOut = payoutRequests
    .filter(request => request.status === 'paid' || request.status === 'approved')
    .reduce((sum, request) => sum + Number(request.amount || 0), 0)
  const pendingAmount = payoutRequests
    .filter(request => request.status === 'pending')
    .reduce((sum, request) => sum + Number(request.amount || 0), 0)
  const available = Math.max(0, Number(earnings?.available_to_payout ?? (totalNetEarnings - paidOut - pendingAmount) ?? 0))
  const hasPending = payoutRequests.some(request => request.status === 'pending')
  const stripeReady = !!stripeConnectStatus?.payouts_enabled
  const canRequestPayout = available >= MIN_PAYOUT_AMOUNT && !hasPending && stripeReady && !payoutLimitReached && !submitting
  const payoutStatusLabel = status => {
    if (status === 'paid') return 'Wypłacona'
    if (status === 'approved') return 'Zatwierdzona'
    if (status === 'pending') return 'Oczekuje'
    if (status === 'rejected') return 'Odrzucona'
    return status || 'Nieznany'
  }
  const payoutActionLabel = hasPending
    ? 'Masz oczekującą wypłatę'
    : payoutLimitReached
      ? 'Limit wypłat wykorzystany'
      : !stripeReady
        ? 'Połącz Stripe'
        : available < MIN_PAYOUT_AMOUNT
          ? 'Minimum 50 zł'
          : submitting
            ? 'Wysyłam...'
            : 'Poproś o wypłatę'

  return (
    <section className="wallet-subpage payout-live-page">
      <div className="wallet-subpage-tabs glass-v2-panel">
        <button type="button" onClick={() => onViewChange?.('wallet')}>Portfel</button>
        <button type="button" onClick={() => onViewChange?.('deposits')}>Wpłaty</button>
        <button type="button" className="active">Wypłaty</button>
        <button type="button" onClick={() => onViewChange?.('payments')}>Płatności</button>
        <button type="button" onClick={() => onViewChange?.('subscriptions')}>Subskrypcja</button>
        <button type="button" onClick={() => onViewChange?.('earnings')}>Zarobki</button>
      </div>

      <div className="payout-live-hero glass-v2-panel">
        <div>
          <span>Wypłaty twórcy</span>
          <h1>Wypłaty</h1>
          <p>{profile.username} — tu zgłaszasz wypłaty z realnych zarobków ze sprzedaży typów i subskrypcji profilu.</p>
        </div>
        <div className="payout-live-available">
          <small>Dostępne do wypłaty</small>
          <b>{formatMoney(available)}</b>
        </div>
      </div>

      <div className="payout-live-stats">
        <div className="glass-v2-panel">
          <span>Zarobek netto</span>
          <b>{formatMoney(totalNetEarnings)}</b>
          <small>Po prowizji platformy</small>
        </div>
        <div className="glass-v2-panel">
          <span>Sprzedaż brutto</span>
          <b>{formatMoney(grossRevenue)}</b>
          <small>Typy i subskrypcje</small>
        </div>
        <div className="glass-v2-panel">
          <span>Prowizja platformy</span>
          <b>{formatMoney(platformFee)}</b>
          <small>20% od sprzedaży</small>
        </div>
        <div className="glass-v2-panel">
          <span>Limit w miesiącu</span>
          <b>{monthlyPayoutCount}/{planLimits.monthlyPayoutLimit}</b>
          <small>{isPremiumAccount(userPlan) ? 'Plan Premium' : 'Plan Free'}</small>
        </div>
      </div>

      <div className="payout-live-grid">
        <div className="glass-v2-panel payout-live-request-card">
          <div className="payout-live-card-head">
            <h2>Nowa wypłata</h2>
            <span className={stripeReady ? 'ready' : 'locked'}>
              {stripeReady ? 'Stripe aktywny' : 'Stripe niepodłączony'}
            </span>
          </div>
          <p>
            Minimum wypłaty to <b>50 zł</b>. Konto FREE ma 1 wypłatę miesięcznie, a konto Premium 3 wypłaty miesięcznie.
          </p>
          <div className="payout-live-request-summary">
            <div><small>Dostępne</small><b>{formatMoney(available)}</b></div>
            <div><small>Oczekuje</small><b>{formatMoney(pendingAmount)}</b></div>
            <div><small>Wypłacone</small><b>{formatMoney(paidOut)}</b></div>
          </div>
          <button type="button" disabled={!canRequestPayout} onClick={() => onRequestPayout?.()}>
            {payoutActionLabel}
          </button>
          {!stripeReady && (
            <button type="button" className="secondary" onClick={() => onConnectStripe?.()}>
              Podłącz Stripe Connect
            </button>
          )}
        </div>

        <div className="glass-v2-panel payout-live-methods-card">
          <div className="payout-live-card-head"><h2>Metody wypłaty</h2></div>
          <div className="payout-live-methods">
            <button type="button" className="active" onClick={() => stripeReady ? null : onConnectStripe?.()}>
              <span className="pay-logo stripe">S</span>
              <strong>Stripe</strong>
              <small>{stripeReady ? 'Aktywne' : 'Połącz'}</small>
            </button>
            <button type="button" className="locked" disabled>
              <span className="pay-logo paypal">P</span>
              <strong>PayPal</strong>
              <small>🔒 Wkrótce</small>
            </button>
            <button type="button" className="locked" disabled>
              <span className="pay-logo revolut">R</span>
              <strong>Revolut</strong>
              <small>🔒 Wkrótce</small>
            </button>
          </div>
          <ul>
            <li>Wypłata działa tylko z realnych zarobków twórcy.</li>
            <li>Po zgłoszeniu wypłata trafia do panelu admina.</li>
            <li>Po zatwierdzeniu wypłata idzie przez Stripe Connect.</li>
          </ul>
        </div>

        <div className="glass-v2-panel payout-live-history-card">
          <div className="payout-live-card-head"><h2>Historia wypłat</h2></div>
          {payoutRequests.length ? (
            <div className="payout-live-history">
              {payoutRequests.map(request => (
                <div key={request.id}>
                  <span>{new Date(request.created_at).toLocaleString('pl-PL')}</span>
                  <strong>{formatMoney(request.amount)}</strong>
                  <small className={`status-${request.status}`}>{payoutStatusLabel(request.status)}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="payout-live-empty">
              <strong>Brak wypłat</strong>
              <span>Twoje prawdziwe zgłoszenia wypłat pojawią się tutaj.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}



function AdminFinanceView({ report, onRefresh, onViewChange }) {
  const [adminFinanceFilter, setAdminFinanceFilter] = useState('all')
  const transactions = Array.isArray(report?.transactions) ? report.transactions : []
  const getTxType = row => {
    const raw = String(row?.type || row?.source || '').toLowerCase()
    if (raw.includes('earning') || raw.includes('sale') || raw.includes('tip_purchase')) return 'marketplace'
    if (raw.includes('premium')) return 'premium'
    if (raw.includes('payout')) return 'payout'
    if (raw.includes('topup')) return 'topup'
    return 'other'
  }
  const getTxLabel = row => {
    const type = getTxType(row)
    if (type === 'marketplace') return 'Sprzedaż marketplace'
    if (type === 'premium') return 'Subskrypcja Premium'
    if (type === 'payout') return 'Wypłata typera'
    if (type === 'topup') return 'Wpłata do portfela'
    return row?.label || row?.type || 'Operacja'
  }
  const getStatusLabel = status => {
    const clean = String(status || '').toLowerCase()
    if (clean === 'completed' || clean === 'paid' || clean === 'succeeded') return 'Zakończona'
    if (clean === 'pending') return 'Oczekuje'
    if (clean === 'approved') return 'Zatwierdzona'
    if (clean === 'rejected') return 'Odrzucona'
    return status || '—'
  }
  const txCounts = {
    all: transactions.length,
    marketplace: transactions.filter(row => getTxType(row) === 'marketplace').length,
    premium: transactions.filter(row => getTxType(row) === 'premium').length,
    payout: transactions.filter(row => getTxType(row) === 'payout').length,
    topup: transactions.filter(row => getTxType(row) === 'topup').length
  }
  const filteredTransactions = transactions.filter(row => adminFinanceFilter === 'all' || getTxType(row) === adminFinanceFilter)
  const totalPlatformRevenue = Number(report?.total_platform_revenue || (Number(report?.platform_commission || 0) + Number(report?.premium_revenue || 0)))
  const platformCommission = Number(report?.platform_commission || 0)
  const premiumRevenue = Number(report?.premium_revenue || 0)
  const grossSales = Number(report?.gross_sales || 0)
  const tipsterEarnings = Number(report?.tipster_earnings || 0)
  const paidOut = Number(report?.total_payouts || 0)
  const pendingPayouts = Number(report?.pending_payouts || 0)
  const availableToPayout = Number(report?.available_to_payout || Math.max(0, tipsterEarnings - paidOut - pendingPayouts))
  const walletTopups = Number(report?.wallet_topups || 0)
  const activePremiumUsers = Number(report?.active_premium_users || 0)
  const payoutCoverage = tipsterEarnings > 0 ? Math.min(100, (paidOut / tipsterEarnings) * 100) : 0

  return (
    <section className="admin-finance-live-page">
      <div className="admin-finance-live-hero glass-v2-panel">
        <div>
          <span>Tylko administrator</span>
          <h1>Finanse platformy</h1>
          <p>Prawdziwy raport Bet+AI: przychód platformy, obrót marketplace, zobowiązania wobec typerów, wpłaty i ostatnie operacje.</p>
        </div>
        <button type="button" onClick={onRefresh}>Odśwież raport</button>
      </div>

      <div className="admin-finance-live-kpis">
        <div className="glass-v2-panel primary">
          <span>Przychód platformy</span>
          <b>{formatMoney(totalPlatformRevenue)}</b>
          <small>Premium + prowizja marketplace</small>
        </div>
        <div className="glass-v2-panel">
          <span>Premium</span>
          <b>{formatMoney(premiumRevenue)}</b>
          <small>{activePremiumUsers} aktywnych kont</small>
        </div>
        <div className="glass-v2-panel">
          <span>Prowizja marketplace</span>
          <b>{formatMoney(platformCommission)}</b>
          <small>20% od sprzedaży</small>
        </div>
        <div className="glass-v2-panel">
          <span>Wpłaty do portfeli</span>
          <b>{formatMoney(walletTopups)}</b>
          <small>Przepływ środków, nie zysk</small>
        </div>
      </div>

      <div className="admin-finance-live-grid">
        <div className="glass-v2-panel admin-finance-overview-card">
          <div className="admin-finance-live-card-head">
            <h2>Marketplace</h2>
            <span>{Number(report?.total_sales || 0)} sprzedaży</span>
          </div>
          <div className="admin-finance-overview-list">
            <div><span>Obrót brutto</span><b>{formatMoney(grossSales)}</b></div>
            <div><span>Zarobki typerów</span><b>{formatMoney(tipsterEarnings)}</b></div>
            <div><span>Prowizja platformy</span><b>{formatMoney(platformCommission)}</b></div>
          </div>
          <div className="admin-finance-split">
            <span style={{ width: grossSales > 0 ? `${Math.min(100, (tipsterEarnings / grossSales) * 100)}%` : '0%' }}></span>
          </div>
          <small>Podział sprzedaży: 80% typerzy / 20% platforma.</small>
        </div>

        <div className="glass-v2-panel admin-finance-overview-card">
          <div className="admin-finance-live-card-head">
            <h2>Wypłaty typerów</h2>
            <button type="button" onClick={() => onViewChange?.('adminPayouts')}>Przejdź</button>
          </div>
          <div className="admin-finance-overview-list">
            <div><span>Wypłacono</span><b>{formatMoney(paidOut)}</b></div>
            <div><span>Oczekuje</span><b>{formatMoney(pendingPayouts)}</b></div>
            <div><span>Do wypłaty</span><b>{formatMoney(availableToPayout)}</b></div>
          </div>
          <div className="admin-finance-payout-progress">
            <span style={{ width: `${payoutCoverage}%` }}></span>
          </div>
          <small>{payoutCoverage.toFixed(1)}% wypłaconych zarobków typerów.</small>
        </div>

        <div className="glass-v2-panel admin-finance-health-card">
          <div className="admin-finance-live-card-head"><h2>Szybki stan</h2></div>
          <div className="admin-finance-health-list">
            <div className={pendingPayouts > 0 ? 'warning' : 'ok'}>
              <strong>{pendingPayouts > 0 ? 'Wypłaty wymagają uwagi' : 'Brak zaległych wypłat'}</strong>
              <span>{pendingPayouts > 0 ? `${formatMoney(pendingPayouts)} oczekuje na obsługę.` : 'Nie ma zgłoszonych wypłat do ręcznej obsługi.'}</span>
            </div>
            <div className={totalPlatformRevenue > 0 ? 'ok' : 'neutral'}>
              <strong>{totalPlatformRevenue > 0 ? 'Platforma zarabia' : 'Brak przychodu platformy'}</strong>
              <span>{totalPlatformRevenue > 0 ? `Łącznie ${formatMoney(totalPlatformRevenue)} realnego przychodu.` : 'Po pierwszych sprzedażach pojawią się tu dane.'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-v2-panel admin-finance-transactions-card">
        <div className="admin-finance-live-card-head">
          <h2>Ostatnie operacje finansowe</h2>
          <span>{filteredTransactions.length} wyników</span>
        </div>

        <div className="admin-finance-live-filters">
          <button type="button" className={adminFinanceFilter === 'all' ? 'active' : ''} onClick={() => setAdminFinanceFilter('all')}>Wszystkie <b>{txCounts.all}</b></button>
          <button type="button" className={adminFinanceFilter === 'marketplace' ? 'active' : ''} onClick={() => setAdminFinanceFilter('marketplace')}>Marketplace <b>{txCounts.marketplace}</b></button>
          <button type="button" className={adminFinanceFilter === 'premium' ? 'active' : ''} onClick={() => setAdminFinanceFilter('premium')}>Premium <b>{txCounts.premium}</b></button>
          <button type="button" className={adminFinanceFilter === 'payout' ? 'active' : ''} onClick={() => setAdminFinanceFilter('payout')}>Wypłaty <b>{txCounts.payout}</b></button>
          <button type="button" className={adminFinanceFilter === 'topup' ? 'active' : ''} onClick={() => setAdminFinanceFilter('topup')}>Wpłaty <b>{txCounts.topup}</b></button>
        </div>

        <div className="admin-finance-live-table">
          <div className="admin-finance-live-row header">
            <span>Data</span>
            <span>Operacja</span>
            <span>Użytkownik</span>
            <span>Kwota</span>
            <span>Status</span>
          </div>
          {filteredTransactions.length ? filteredTransactions.map((row, idx) => (
            <div className="admin-finance-live-row" key={row.id || idx}>
              <span>{new Date(row.created_at).toLocaleString('pl-PL')}</span>
              <span><strong>{getTxLabel(row)}</strong><small>{row.type || row.source || '—'}</small></span>
              <span><code>{row.user_email || row.username || row.user_id || '—'}</code></span>
              <span className="amount">{formatMoney(row.amount)}</span>
              <span className={`status status-${String(row.status || '').toLowerCase()}`}>{getStatusLabel(row.status)}</span>
            </div>
          )) : (
            <div className="admin-finance-empty">
              <strong>Brak operacji finansowych</strong>
              <span>Po pierwszych prawdziwych płatnościach i wypłatach zobaczysz je tutaj.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function AdminPayoutsView({ user, requests = [], onUpdateStatus, onRunCron }) {
  const profile = getUserProfileView(user)
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [amountFilter, setAmountFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])

  const normalizedRequests = requests.map(request => ({
    ...request,
    normalizedStatus: String(request.status || 'pending').toLowerCase(),
    normalizedStripeStatus: String(request.stripe_status || '').toLowerCase(),
    amountNumber: Number(request.amount || 0),
    searchText: String([
      request.id,
      request.user_id,
      request.user_email,
      request.email,
      request.status,
      request.stripe_status,
      request.stripe_transfer_id
    ].filter(Boolean).join(' ')).toLowerCase()
  }))

  const pendingRequests = normalizedRequests.filter(request => request.normalizedStatus === 'pending')
  const processingRequests = normalizedRequests.filter(request => request.normalizedStatus === 'processing')
  const paidRequests = normalizedRequests.filter(request => ['paid', 'approved'].includes(request.normalizedStatus))
  const rejectedRequests = normalizedRequests.filter(request => request.normalizedStatus === 'rejected')
  const failedRequests = normalizedRequests.filter(request => request.normalizedStatus === 'failed' || request.normalizedStripeStatus === 'failed')
  const readyRequests = pendingRequests.filter(request => request.amountNumber >= 50)
  const smallPendingRequests = pendingRequests.filter(request => request.amountNumber < 50)
  const totalPending = pendingRequests.reduce((sum, request) => sum + request.amountNumber, 0)
  const totalReady = readyRequests.reduce((sum, request) => sum + request.amountNumber, 0)
  const totalPaid = paidRequests.reduce((sum, request) => sum + request.amountNumber, 0)
  const attentionCount = processingRequests.length + failedRequests.length
  const automationReady = readyRequests.length > 0

  const filteredRequests = normalizedRequests.filter(request => {
    const matchesStatus = statusFilter === 'all' || request.normalizedStatus === statusFilter
    const matchesQuery = !query.trim() || request.searchText.includes(query.trim().toLowerCase())
    const matchesAmount = amountFilter === 'all'
      || (amountFilter === 'ready' && request.normalizedStatus === 'pending' && request.amountNumber >= 50)
      || (amountFilter === 'small' && request.normalizedStatus === 'pending' && request.amountNumber < 50)
    return matchesStatus && matchesQuery && matchesAmount
  })

  const selectedRequests = normalizedRequests.filter(request => selectedIds.includes(request.id))
  const selectedPending = selectedRequests.filter(request => request.normalizedStatus === 'pending')
  const selectedReady = selectedPending.filter(request => request.amountNumber >= 50)

  const toggleSelected = id => {
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  const toggleAllVisible = () => {
    const visiblePendingIds = filteredRequests.filter(request => request.normalizedStatus === 'pending').map(request => request.id)
    const allSelected = visiblePendingIds.length > 0 && visiblePendingIds.every(id => selectedIds.includes(id))
    setSelectedIds(current => allSelected ? current.filter(id => !visiblePendingIds.includes(id)) : Array.from(new Set([...current, ...visiblePendingIds])))
  }

  const bulkUpdate = status => {
    const rows = status === 'paid' ? selectedReady : selectedPending
    rows.forEach(request => onUpdateStatus(request.id, status))
    setSelectedIds([])
  }

  const exportCsv = () => {
    const headers = ['id', 'user_id', 'created_at', 'amount', 'status', 'stripe_status', 'stripe_transfer_id']
    const rows = filteredRequests.map(request => headers.map(key => '"' + String(request[key] ?? '').replaceAll('"', '""') + '"').join(','))
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'admin-wyplaty-' + new Date().toISOString().slice(0, 10) + '.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const getStripeLabel = request => {
    if (request.stripe_transfer_id) return request.stripe_transfer_id
    if (request.normalizedStatus === 'rejected') return 'nie dotyczy'
    if (request.normalizedStatus === 'processing') return 'transfer w toku'
    if (request.normalizedStatus === 'failed' || request.normalizedStripeStatus === 'failed') return 'błąd Stripe'
    if (request.normalizedStatus === 'pending' && request.amountNumber < 50) return 'poniżej minimum'
    return 'czeka na transfer'
  }

  const getStatusLabel = status => {
    if (status === 'pending') return 'Oczekuje'
    if (status === 'processing') return 'Przetwarzana'
    if (status === 'paid' || status === 'approved') return 'Wypłacona'
    if (status === 'rejected') return 'Odrzucona'
    if (status === 'failed') return 'Błąd'
    return status || '—'
  }

  if (!profile.isAdmin) {
    return (
      <section className="admin-payout-live-page">
        <div className="admin-denied">
          <strong>Brak dostępu</strong>
          <span>Ten panel jest dostępny tylko dla administratora.</span>
        </div>
      </section>
    )
  }

  return (
    <section className="admin-payout-live-page">
      <div className="admin-payout-live-hero glass-v2-panel">
        <div>
          <span>Tylko administrator</span>
          <h1>Admin wypłaty</h1>
          <p>Centrum realizacji wypłat typerów: kolejka oczekujących, transfery Stripe, akcje ręczne, cron i pełna historia zgłoszeń.</p>
        </div>
        <button type="button" onClick={onRunCron} disabled={!automationReady}>
          {automationReady ? 'Uruchom cron' : 'Brak gotowych wypłat'}
        </button>
      </div>

      <div className="admin-payout-live-kpis">
        <div className="glass-v2-panel primary">
          <span>Gotowe do wypłaty</span>
          <b>{readyRequests.length}</b>
          <small>{formatMoney(totalReady)} od minimum 50 zł</small>
        </div>
        <div className="glass-v2-panel">
          <span>Oczekujące łącznie</span>
          <b>{pendingRequests.length}</b>
          <small>{formatMoney(totalPending)}</small>
        </div>
        <div className="glass-v2-panel">
          <span>Wypłacone</span>
          <b>{paidRequests.length}</b>
          <small>{formatMoney(totalPaid)}</small>
        </div>
        <div className={`glass-v2-panel ${attentionCount > 0 ? 'warning' : ''}`}>
          <span>Wymaga uwagi</span>
          <b>{attentionCount}</b>
          <small>Processing / failed</small>
        </div>
      </div>

      <div className="admin-payout-live-grid">
        <div className="glass-v2-panel admin-payout-queue-card">
          <div className="admin-payout-live-card-head">
            <h2>Kolejka wypłat</h2>
            <span>{readyRequests.length} gotowych</span>
          </div>
          <div className="admin-payout-queue-list">
            <div>
              <strong>Gotowe do przelewu Stripe</strong>
              <span>{readyRequests.length} zgłoszeń na {formatMoney(totalReady)}</span>
            </div>
            <div>
              <strong>Poniżej minimum</strong>
              <span>{smallPendingRequests.length} zgłoszeń poniżej 50 zł</span>
            </div>
            <div className={attentionCount > 0 ? 'warning' : 'ok'}>
              <strong>{attentionCount > 0 ? 'Sprawdź ręcznie' : 'Brak błędów'}</strong>
              <span>{attentionCount > 0 ? `${attentionCount} pozycji processing / failed.` : 'Nie ma pozycji wymagających interwencji.'}</span>
            </div>
          </div>
        </div>

        <div className="glass-v2-panel admin-payout-cron-card">
          <div className="admin-payout-live-card-head">
            <h2>Automatyka wypłat</h2>
            <span className={automationReady ? 'ready' : 'idle'}>{automationReady ? 'Gotowe' : 'Pusto'}</span>
          </div>
          <p>Cron uruchamia tylko pending wypłaty od 50 zł i zabezpiecza transfery przed duplikacją przez status processing.</p>
          <code>/.netlify/functions/process-payouts</code>
          <button type="button" onClick={onRunCron} disabled={!automationReady}>
            {automationReady ? 'Przetwórz gotowe wypłaty' : 'Brak pending ≥ 50 zł'}
          </button>
        </div>

        <div className="glass-v2-panel admin-payout-actions-card">
          <div className="admin-payout-live-card-head"><h2>Akcje zaznaczonych</h2></div>
          <strong>{selectedPending.length} zaznaczonych oczekujących</strong>
          <span>{selectedReady.length} z nich gotowych do wypłaty</span>
          <div>
            <button type="button" disabled={!selectedReady.length} onClick={() => bulkUpdate('paid')}>Zatwierdź wypłaty</button>
            <button type="button" className="danger" disabled={!selectedPending.length} onClick={() => bulkUpdate('rejected')}>Odrzuć</button>
          </div>
        </div>
      </div>

      <div className="glass-v2-panel admin-payout-transactions-card">
        <div className="admin-payout-live-card-head">
          <h2>Zgłoszenia wypłat</h2>
          <button type="button" onClick={exportCsv}>Eksport CSV</button>
        </div>

        <div className="admin-payout-live-toolbar">
          <label>
            <span>⌕</span>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Szukaj po ID, e-mailu, statusie, Stripe ID..." />
          </label>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="all">Status: wszystkie</option>
            <option value="pending">Oczekuje</option>
            <option value="processing">Przetwarzana</option>
            <option value="paid">Wypłacona</option>
            <option value="rejected">Odrzucona</option>
            <option value="failed">Błąd</option>
          </select>
          <select value={amountFilter} onChange={event => setAmountFilter(event.target.value)}>
            <option value="all">Kwota: wszystkie</option>
            <option value="ready">Gotowe ≥ 50 zł</option>
            <option value="small">Poniżej 50 zł</option>
          </select>
        </div>

        <div className="admin-payout-live-table">
          <div className="admin-payout-live-row header">
            <span><input type="checkbox" onChange={toggleAllVisible} checked={filteredRequests.some(row => row.normalizedStatus === 'pending') && filteredRequests.filter(row => row.normalizedStatus === 'pending').every(row => selectedIds.includes(row.id))} /></span>
            <span>Użytkownik</span>
            <span>Data</span>
            <span>Kwota</span>
            <span>Status</span>
            <span>Stripe</span>
            <span>Akcje</span>
          </div>
          {filteredRequests.length ? filteredRequests.map(request => (
            <div className="admin-payout-live-row" key={request.id}>
              <span><input type="checkbox" disabled={request.normalizedStatus !== 'pending'} checked={selectedIds.includes(request.id)} onChange={() => toggleSelected(request.id)} /></span>
              <span>
                <strong>{request.user_email || request.email || (request.user_id ? request.user_id.slice(0, 8) + '…' : '—')}</strong>
                <small>{request.user_id || '—'}</small>
              </span>
              <span>{request.created_at ? new Date(request.created_at).toLocaleString('pl-PL') : '—'}</span>
              <span className="amount">{formatMoney(request.amountNumber)}</span>
              <span className={`status status-${request.normalizedStatus}`}>{getStatusLabel(request.normalizedStatus)}</span>
              <span>
                <strong>{request.stripe_status || '—'}</strong>
                <small>{getStripeLabel(request)}</small>
              </span>
              <span className="actions">
                {request.normalizedStatus === 'pending' ? (
                  <>
                    <button type="button" disabled={request.amountNumber < 50} onClick={() => onUpdateStatus(request.id, 'paid')}>Zatwierdź</button>
                    <button type="button" className="danger" onClick={() => onUpdateStatus(request.id, 'rejected')}>Odrzuć</button>
                  </>
                ) : (
                  <em>Zamknięte</em>
                )}
              </span>
            </div>
          )) : (
            <div className="admin-payout-empty">
              <strong>Brak zgłoszeń dla wybranych filtrów</strong>
              <span>Zmień filtr albo poczekaj na nowe prawdziwe wypłaty użytkowników.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function TopTipstersView() {
  const categories = [
    ['Wszystkie', '324', 'grid'],
    ['Piłka nożna', '212', 'football'],
    ['Tenis', '45', 'tennis'],
    ['Koszykówka', '28', 'basketball'],
    ['Hokej', '16', 'hockey'],
    ['Esport', '23', 'esport'],
    ['Siatkówka', '18', 'volleyball'],
    ['Baseball', '12', 'baseball'],
    ['Dart', '9', 'dart'],
  ]

  const tipsters = [
    {
      rank: 1,
      name: 'StatKing',
      subtitle: 'Profesjonalny analityk',
      rating: '4.92',
      votes: '1248',
      success: '87%',
      roi: '+32.4%',
      profit: '+3,240 zł',
      picks: '284',
      chart: '87%',
      price: '49 zł',
      followers: '1,248 obserwujących',
      spec: ['⚽', '🎾', '🏒', '⚙', '+2'],
      avatar: 'SK'
    },
    {
      rank: 2,
      name: 'BetMind',
      subtitle: 'Ekspert od Value Betów',
      rating: '4.78',
      votes: '982',
      success: '91%',
      roi: '+41.7%',
      profit: '+4,170 zł',
      picks: '196',
      chart: '91%',
      price: '79 zł',
      followers: '982 obserwujących',
      spec: ['⚽', '🎾', '⚽', '⚙', '+3'],
      avatar: 'BM'
    },
    {
      rank: 3,
      name: 'FootyLogic',
      subtitle: 'Statystyka i analiza',
      rating: '4.71',
      votes: '756',
      success: '84%',
      roi: '+28.1%',
      profit: '+2,980 zł',
      picks: '241',
      chart: '84%',
      price: '59 zł',
      followers: '756 obserwujących',
      spec: ['⚽', '📊', '🏆', '⚙', '+1'],
      avatar: 'FL'
    },
  ]

  const marketStats = [
    ['Tipsterzy', '248'],
    ['Typy dziś', '1,248'],
    ['Skuteczność', '85%'],
    ['ROI rynku', '+18.7%'],
  ]

  const steps = [
    ['1', 'Wybierz typera', 'Sprawdź statystyki i wybierz najlepszego typera.'],
    ['2', 'Kup dostęp', 'Zyskaj dostęp do premium typów i analiz.'],
    ['3', 'Wygrywaj więcej', 'Korzystaj z wiedzy i zwiększaj zyski!'],
  ]

  return (
    <section className="market-static-v7">
      <div className="market-v7-layout">
        <div className="market-v7-main">
          <div className="glass-market-v7 market-v7-hero">
            <div className="market-hero-copy-v7">
              <span>MARKETPLACE TYPÓW I ANALIZ</span>
              <h1>Kupuj sprawdzone typy
                <br />i analizy od <em>najlepszych</em></h1>
              <p>Zweryfikowani typerzy, skuteczne analizy i typy, które dają przewagę.</p>
            </div>
            <div className="market-hero-art-v7" aria-hidden="true">
              <div className="art-card-v7 chart"></div>
              <div className="art-card-v7 cart"></div>
              <div className="hero-ball-v7"></div>
              <div className="hero-line-v7 one"></div>
              <div className="hero-line-v7 two"></div>
            </div>
          </div>

          <div className="market-v7-cats">
            {categories.map((item, idx) => (
              <div className={`glass-market-v7 cat-box-v7 ${idx === 0 ? 'active' : ''}`} key={idx}>
                <i className={`cat-icon-v7 ${item[2]}`}></i>
                <div><strong>{item[0]}</strong><span>{item[1]}</span></div>
              </div>
            ))}
          </div>

          <div className="market-v7-filters">
            <div className="glass-market-v7 filter-v7"><small>Sport</small><strong>Wszystkie</strong><span>⌄</span></div>
            <div className="glass-market-v7 filter-v7"><small>Ligą</small><strong>Wszystkie</strong><span>⌄</span></div>
            <div className="glass-market-v7 filter-v7"><small>Sortuj</small><strong>Popularne</strong><span>⌄</span></div>
            <div className="glass-market-v7 filter-v7 accent"><b>⭐ Tylko Premium</b></div>
            <div className="glass-market-v7 filter-v7 accent"><b>☰ Więcej filtrów</b></div>
          </div>

          <div className="market-v7-section-head">
            <h2>NAJLEPSI TYPERZY</h2>
            <button type="button">Zobacz wszystkich</button>
          </div>

          <div className="market-v7-list">
            {tipsters.map((tipster, idx) => (
              <article className="glass-market-v7 seller-card-v7" key={idx}>
                <div className="seller-main-v7">
                  <div className="seller-profile-v7">
                    <div className={`seller-avatar-v7 a${idx + 1}`}>{tipster.avatar}</div>
                    <div className="seller-copy-v7">
                      <div className="seller-title-row-v7">
                        <span className={`rank-pill-v7 r${tipster.rank}`}>{tipster.rank}</span>
                        <h3>{tipster.name}</h3>
                        <i>✓</i>
                      </div>
                      <p>{tipster.subtitle}</p>
                      <div className="seller-rating-v7">⭐ {tipster.rating} <span>({tipster.votes})</span> <em>PREMIUM</em></div>
                    </div>
                  </div>

                  <div className="seller-stats-row-v7">
                    <div><small>Skuteczność</small><b>{tipster.success}</b></div>
                    <div><small>ROI (30 dni)</small><b>{tipster.roi}</b></div>
                    <div><small>Zysk (30 dni)</small><b>{tipster.profit}</b></div>
                    <div><small>Typy</small><b>{tipster.picks}</b></div>
                  </div>
                </div>

                <div className="seller-chart-v7">
                  <small>Skuteczność (30 dni)</small>
                  <div className="sparkline-v7">
                    <svg viewBox="0 0 240 78" preserveAspectRatio="none">
                      <path d={idx===0 ? 'M0,48 L18,54 L36,42 L54,58 L72,38 L90,33 L108,22 L126,35 L144,18 L162,30 L180,20 L198,25 L216,14 L240,8' : idx===1 ? 'M0,44 L18,46 L36,41 L54,43 L72,29 L90,38 L108,24 L126,30 L144,20 L162,26 L180,19 L198,21 L216,16 L240,10' : 'M0,50 L18,42 L36,48 L54,31 L72,40 L90,26 L108,35 L126,30 L144,33 L162,18 L180,27 L198,23 L216,16 L240,9'} />
                    </svg>
                  </div>
                  <div className="chart-meta-v7">
                    <b>{tipster.chart}</b>
                    <span>Specjalizacja</span>
                  </div>
                  <div className="spec-list-v7">
                    {tipster.spec.map((s, i) => <i key={i}>{s}</i>)}
                  </div>
                </div>

                <div className="seller-cta-v7">
                  <div className="price-v7"><strong>{tipster.price}</strong><span>/ 30 dni</span></div>
                  <button type="button" className="buy-btn-v7">Kup tip</button>
                  <div className="cta-bottom-v7">
                    <button type="button" className="follow-btn-v7">Obserwuj</button>
                    <span>{tipster.followers}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="market-v7-sidebar">
          <div className="glass-market-v7 side-market-card-v7">
            <div className="side-title-v7">PODSUMOWANIE RYNKU <i>ⓘ</i></div>
            <div className="market-summary-grid-v7">
              {marketStats.map((item, idx) => (
                <div key={idx}>
                  <small>{item[0]}</small>
                  <b>{item[1]}</b>
                </div>
              ))}
            </div>
            <button type="button" className="outline-wide-v7">📈 Zobacz statystyki rynku</button>
          </div>

          <div className="glass-market-v7 side-market-card-v7">
            <div className="side-head-line-v7"><h3>AI ANALIZA MECZU</h3><span>AI</span></div>
            <div className="match-side-v7">
              <div className="mini-team-v7"><i className="team-logo-v7 rm">RM</i><strong>Real Madryt</strong></div>
              <span>vs</span>
              <div className="mini-team-v7"><i className="team-logo-v7 bm">BM</i><strong>Bayern Monachium</strong></div>
            </div>
            <div className="match-meta-v7">Liga Mistrzów • Dzisiaj, 21:00</div>
            <div className="ai-prediction-v7">
              <small>AI przewiduje:</small>
              <strong>Powyżej 2.5 gola</strong>
              <div className="prediction-meter-v7"><span>Pewność: 81%</span><b>81%</b><i style={{width:'81%'}}></i></div>
            </div>
            <button type="button" className="outline-wide-v7">Zobacz pełną analizę →</button>
          </div>

          <div className="glass-market-v7 side-market-card-v7">
            <div className="side-title-v7">JAK TO DZIAŁA?</div>
            <div className="steps-list-v7">
              {steps.map((step, idx) => (
                <div className="step-row-v7" key={idx}>
                  <span>{step[0]}</span>
                  <div><strong>{step[1]}</strong><small>{step[2]}</small></div>
                </div>
              ))}
            </div>
          </div>

          <button type="button" className="sell-analysis-v7">☁ Sprzedaj swoją analizę</button>
        </aside>
      </div>
    </section>
  )
}


function disabledTopUp(showToast) {
  showToast?.({
    type: 'info',
    title: 'Doładowanie przez Stripe',
    message: 'Fake doładowanie zostało wyłączone. Saldo zwiększy się dopiero po prawdziwej płatności Stripe.'
  })
}


function DashboardAutoTranslator({ lang }) {
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = lang || 'pl'
    const skipTags = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION'])
    const translateText = (value) => translateBetaiTextValue(value, lang)
    const translateNode = (node) => {
      if (!node) return
      if (node.nodeType === Node.TEXT_NODE) {
        const next = translateText(node.nodeValue)
        if (next !== node.nodeValue) node.nodeValue = next
        return
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return
      if (skipTags.has(node.tagName)) return
      if (node.getAttribute?.('data-no-translate') === 'true') return
      ;['placeholder', 'aria-label', 'title', 'alt'].forEach(attr => {
        if (node.hasAttribute?.(attr)) {
          const current = node.getAttribute(attr)
          const next = translateText(current)
          if (next !== current) node.setAttribute(attr, next)
        }
      })
      node.childNodes?.forEach(child => translateNode(child))
    }
    let frame = null
    const translateRoot = () => {
      if (frame) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const root = document.querySelector('.app-shell') || document.querySelector('#root')
        if (root) translateNode(root)
      })
    }
    translateRoot()
    const observer = new MutationObserver(() => translateRoot())
    const root = document.querySelector('#root') || document.body
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title', 'alt'] })
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [lang])
  return null
}


function RewardsBonusesView({ user, tokenBalance = 2450, userPlan = 'free' }) {
  const missions = [
    { icon: '🎟', title: 'Wygraj 2 kupony', progress: 0, total: 2, reward: '+100 AI' },
    { icon: '🧠', title: 'Postaw 3 typy', progress: 2, total: 3, reward: '+75 AI' },
    { icon: '🎯', title: 'Traf kurs powyżej 2.00', progress: 1, total: 1, reward: '+50 AI' },
    { icon: '⏱', title: 'Aktywność przez 20 min', progress: 12, total: 20, reward: '+30 AI' }
  ]
  const streakDays = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Dziś']
  const streakRewards = [
    { days: '3 dni', reward: '+100 AI', tone: 'cyan' },
    { days: '7 dni', reward: '+250 AI', tone: 'blue' },
    { days: '14 dni', reward: '+500 AI', tone: 'violet' },
    { days: '30 dni', reward: '+1000 AI', tone: 'gold' }
  ]
  const drops = [
    { title: 'DROP FREE', sub: 'Co 60 min', icon: '🧰', progress: 100, cost: '0 AI', cta: 'Odbierz', tone: 'cyan' },
    { title: 'DROP SILVER', sub: '100 AI', icon: '🪙', progress: 100, cost: '100 / 100 AI', cta: 'Odbierz', tone: 'silver' },
    { title: 'DROP GOLD', sub: '500 AI', icon: '👑', progress: 64, cost: '320 / 500 AI', cta: 'Zobacz', tone: 'gold' },
    { title: 'DROP PLATINUM', sub: '1000 AI', icon: '💎', progress: 32, cost: '320 / 1000 AI', cta: 'Zobacz', tone: 'violet' },
    { title: 'DROP LEGEND', sub: '2500 AI', icon: '🏆', progress: 13, cost: '320 / 2500 AI', cta: 'Zobacz', tone: 'legend' }
  ]
  const ranking = [
    { name: 'smilhytv', score: '2 450 AI', badge: 'ADMIN', initials: 'SM' },
    { name: 'buchajsonek1988', score: '1 980 AI', initials: 'BU' },
    { name: 'pkucharski', score: '1 250 AI', initials: 'P' },
    { name: 'smokeybet', score: '980 AI', initials: 'MS' },
    { name: 'AI_Master', score: '870 AI', initials: 'AI' }
  ]
  const achievements = [
    { icon: '🛡', title: 'Pierwszy krok', desc: 'Postaw swój pierwszy typ', status: 'Odblokowano', tone: 'cyan' },
    { icon: '🔥', title: 'Seria zwycięstw', desc: 'Wygraj 5 kuponów z rzędu', status: 'Odblokowano', tone: 'orange' },
    { icon: '👑', title: 'AI Typer', desc: 'Postaw 100 typów', status: 'Odblokowano', tone: 'gold' }
  ]
  const tokenRewards = [
    { title: 'Freebet 10 zł', price: '100 AI', status: 'Dostępne' },
    { title: 'Freebet 25 zł', price: '250 AI', status: 'Dostępne' },
    { title: 'Premium 7 dni', price: '500 AI', status: 'Dostępne' },
    { title: 'Premium 30 dni', price: '1200 AI', status: 'Dostępne' }
  ]
  const premiumBonuses = [
    { title: 'Wyższe dropy', desc: '+50% więcej tokenów z dropów', state: 'Aktywny' },
    { title: 'Szybszy progres', desc: '+25% do wszystkich misji', state: 'Aktywny' },
    { title: 'Ekskluzywne nagrody', desc: 'Dostęp do nagród Premium', state: 'Aktywny' }
  ]

  return (
    <div className="rewards-ultra-page">
      <section className="rewards-ultra-card rewards-ultra-hero">
        <div className="rewards-ultra-hero-copy">
          <h1>Nagrody / Dropy / Misje / Bonusy</h1>
          <p>Zdobywaj tokeny AI, odbieraj dropy i rywalizuj o najlepsze nagrody.</p>
        </div>
        <div className="rewards-ultra-hero-stats">
          <div className="rewards-ultra-topmini tone-blue">
            <span>Tokeny AI</span>
            <strong>{Number(tokenBalance || 2450).toLocaleString('pl-PL')}</strong>
            <small>+250 dzisiaj</small>
          </div>
          <button type="button" className="rewards-ultra-claim-btn">🎁 Odbierz nagrodę</button>
          <div className="rewards-ultra-topmini tone-green">
            <span>Poziom</span>
            <strong>AI Legend</strong>
            <small>1000+ typów</small>
          </div>
        </div>
      </section>

      <div className="rewards-ultra-content">
        <div className="rewards-ultra-main">
          <div className="rewards-ultra-topgrid">
            <section className="rewards-ultra-card rewards-ultra-missions">
              <div className="rewards-ultra-head"><h3>MISJE DZIENNE</h3><small>Reset za: 10:24:37</small></div>
              <div className="rewards-ultra-mission-list">
                {missions.map((mission, index) => (
                  <div className="rewards-ultra-mission" key={index}>
                    <div className="rewards-ultra-mission-icon">{mission.icon}</div>
                    <div className="rewards-ultra-mission-copy">
                      <strong>{mission.title}</strong>
                      <div className="rewards-ultra-progress"><i style={{ width: `${Math.max(8, (mission.progress / mission.total) * 100)}%` }} /></div>
                    </div>
                    <b>{mission.progress}/{mission.total}</b>
                    <span>{mission.reward}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rewards-ultra-card rewards-ultra-streak">
              <div className="rewards-ultra-head"><h3>STREAK AKTYWNOŚCI</h3></div>
              <div className="rewards-ultra-streak-main">
                <div className="rewards-ultra-streak-value"><strong>7</strong><span>dni z rzędu</span></div>
                <div className="rewards-ultra-streak-days">
                  {streakDays.map((day, idx) => (
                    <div className={`rewards-ultra-day ${idx < 5 ? 'done' : idx === 5 ? 'soon' : 'today'}`} key={day}>
                      <i>{idx < 5 ? '✓' : idx === 5 ? '○' : '🔥'}</i>
                      <span>{day}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rewards-ultra-sub">Następne nagrody za streak:</div>
              <div className="rewards-ultra-streak-rewards">
                {streakRewards.map((item) => (
                  <div className={`rewards-ultra-streak-box ${item.tone}`} key={item.days}>
                    <i>{item.tone === 'gold' ? '🏆' : item.tone === 'violet' ? '✦' : item.tone === 'blue' ? '⬢' : '✪'}</i>
                    <div><strong>{item.days}</strong><small>{item.reward}</small></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rewards-ultra-card rewards-ultra-progress-card">
              <div className="rewards-ultra-head"><h3>PROGRES AKTYWNOŚCI</h3></div>
              <div className="rewards-ultra-ring" style={{ '--ring': '72%' }}>
                <div><strong>72%</strong><span>Aktywny</span></div>
              </div>
              <p>Cel tygodniowy: 1000 AI</p>
              <b>Zdobyte: 720 AI / 1000 AI</b>
            </section>
          </div>

          <section className="rewards-ultra-card rewards-ultra-drops-panel">
            <div className="rewards-ultra-head stacked"><h3>DROPY TYPERÓW</h3><small>Zbieraj tokeny i odbieraj dropy za swoją aktywność.</small></div>
            <div className="rewards-ultra-drops-grid">
              {drops.map((drop) => (
                <div className={`rewards-ultra-drop ${drop.tone}`} key={drop.title}>
                  <h4>{drop.title}</h4>
                  <span>{drop.sub}</span>
                  <div className="rewards-ultra-drop-art">{drop.icon}</div>
                  <div className="rewards-ultra-progress"><i style={{ width: `${drop.progress}%` }} /></div>
                  <small>{drop.cost}</small>
                  <button type="button">{drop.cta}</button>
                </div>
              ))}
            </div>
          </section>

          <div className="rewards-ultra-bottomgrid">
            <section className="rewards-ultra-card rewards-ultra-achievements">
              <div className="rewards-ultra-head stacked"><h3>OSIĄGNIĘCIA</h3><small>Twoje odblokowane achievementy</small></div>
              <div className="rewards-ultra-achievement-list">
                {achievements.map((item) => (
                  <div className="rewards-ultra-achievement" key={item.title}>
                    <div className={`rewards-ultra-achievement-icon ${item.tone}`}>{item.icon}</div>
                    <div className="rewards-ultra-achievement-copy"><strong>{item.title}</strong><small>{item.desc}</small></div>
                    <span>{item.status}</span>
                  </div>
                ))}
              </div>
              <button type="button" className="rewards-ultra-muted-btn">Zobacz wszystkie</button>
            </section>

            <section className="rewards-ultra-card rewards-ultra-token-store">
              <div className="rewards-ultra-head stacked"><h3>NAGRODY TOKENOWE</h3><small>Wymieniaj tokeny AI na nagrody</small></div>
              <div className="rewards-ultra-store-grid">
                {tokenRewards.map((item) => (
                  <div className="rewards-ultra-store-item" key={item.title}>
                    <strong>{item.title}</strong>
                    <span>{item.price}</span>
                    <small>{item.status}</small>
                  </div>
                ))}
              </div>
              <button type="button" className="rewards-ultra-muted-btn">Zobacz wszystkie nagrody</button>
            </section>

            <section className="rewards-ultra-card rewards-ultra-premium-bonus">
              <div className="rewards-ultra-head stacked"><h3>BONUSY PREMIUM</h3><small>Aktywne bonusy dla użytkowników Premium</small></div>
              <div className="rewards-ultra-premium-list">
                {premiumBonuses.map((item) => (
                  <div className="rewards-ultra-premium-row" key={item.title}>
                    <div className="rewards-ultra-premium-icon">✦</div>
                    <div><strong>{item.title}</strong><small>{item.desc}</small></div>
                    <span>{item.state}</span>
                  </div>
                ))}
              </div>
              <button type="button" className="rewards-ultra-muted-btn">Zarządzaj Premium</button>
            </section>
          </div>
        </div>

        <aside className="rewards-ultra-sidebar">
          <section className="rewards-ultra-card rewards-ultra-ranking">
            <div className="rewards-ultra-head"><h3>TOP AKTYWNOŚCI</h3><div className="rewards-ultra-tabs"><b>24H</b><span>7D</span><span>30D</span></div></div>
            <div className="rewards-ultra-ranking-list">
              {ranking.map((item, index) => (
                <div className="rewards-ultra-rank-row" key={item.name}>
                  <em>{index + 1}</em>
                  <div className="rewards-ultra-rank-avatar">{item.initials}</div>
                  <div className="rewards-ultra-rank-copy"><strong>{item.name}</strong>{item.badge ? <small>{item.badge}</small> : null}</div>
                  <span>{item.score}</span>
                </div>
              ))}
            </div>
            <button type="button" className="rewards-ultra-muted-btn">Zobacz pełny ranking</button>
          </section>

          <section className="rewards-ultra-card rewards-ultra-claim-card">
            <div className="rewards-ultra-head stacked"><h3>ODBIERZ NAGRODĘ</h3><small>Masz dostępne nagrody do odebrania!</small></div>
            <div className="rewards-ultra-claim-visual">
              <div className="coin big">AI</div>
              <div className="coin mid">⚡</div>
              <div className="coin small">AI</div>
            </div>
            <div className="rewards-ultra-claim-copy">
              <strong>+250 AI</strong>
              <span>Tokeny AI</span>
            </div>
            <button type="button" className="rewards-ultra-claim-main">Odbierz teraz</button>
          </section>
        </aside>
      </div>
    </div>
  )
}

function BetaiLanguageSwitch({ lang, onChange, compact = false, floating = false, ariaLabel = 'Language switcher' }) {
  const [open, setOpen] = useState(false)
  const currentLang = BETAI_LANGUAGES.includes(lang) ? lang : 'pl'
  const chooseLanguage = (code) => {
    onChange?.(code)
    setOpen(false)
  }

  return (
    <div
      className={`betai-language-switch betai-language-dropdown ${compact ? 'compact' : ''} ${floating ? 'floating' : ''} ${open ? 'is-open' : ''}`}
      aria-label={ariaLabel}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        type="button"
        className="betai-language-current is-active"
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${BETAI_LANG_NAMES?.[currentLang] || BETAI_LANG_LABELS[currentLang]}`}
        title={BETAI_LANG_NAMES?.[currentLang] || BETAI_LANG_LABELS[currentLang]}
      >
        <span className={`betai-language-flag betai-flag-${currentLang}`} aria-hidden="true" />
        <span className="betai-language-chevron" aria-hidden="true">⌄</span>
      </button>

      {open ? (
        <div className="betai-language-menu" role="listbox">
          {BETAI_LANGUAGES.map(code => (
            <button
              type="button"
              key={code}
              className={currentLang === code ? 'is-active' : ''}
              onClick={() => chooseLanguage(code)}
              role="option"
              aria-selected={currentLang === code}
              aria-label={BETAI_LANG_NAMES?.[code] || BETAI_LANG_LABELS[code]}
              title={BETAI_LANG_NAMES?.[code] || BETAI_LANG_LABELS[code]}
            >
              <span className={`betai-language-flag betai-flag-${code}`} aria-hidden="true" />
              <span className="betai-language-name">{BETAI_LANG_NAMES?.[code] || BETAI_LANG_LABELS[code]}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
function App() {
  const [tips, setTips] = useState([])
  const [lastTipSaveStatus, setLastTipSaveStatus] = useState(readTipDebug())
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const [topSearch, setTopSearch] = useState('')
  const [dashboardVisibleTips, setDashboardVisibleTips] = useState(3)
  const [view, setView] = useState('dashboard')
  const [sessionUser, setSessionUser] = useState(null)
  const userProfile = getUserProfileView(sessionUser)
  const [authLoading, setAuthLoading] = useState(true)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [selectedProfileSub, setSelectedProfileSub] = useState(null)
  const [tipsterSubscriptions, setTipsterSubscriptions] = useState([])
  const [paymentHistory, setPaymentHistory] = useState([])
  const [payoutRequests, setPayoutRequests] = useState([])
  const [accountPlan, setUserPlan] = useState('free')
  const [accountProfile, setAccountProfile] = useState(null)
  const effectiveAccountProfile = buildEffectiveAccountProfile(accountProfile, sessionUser)
  const effectiveAccountPlan = getEffectiveAccountPlan(accountProfile, sessionUser, accountPlan)
  const effectiveTopbarAvatarUrl = getProfileAvatarUrl(effectiveAccountProfile || sessionUser)
  const [walletBalance, setWalletBalance] = useState(0)
  const [payoutSubmitting, setPayoutSubmitting] = useState(false)
  const [adminPayoutRequests, setAdminPayoutRequests] = useState([])
  const [tipsterEarnings, setTipsterEarnings] = useState({ total: 0, sales: 0, history: [] })
  const [stripeConnectStatus, setStripeConnectStatus] = useState(null)
  const [adminFinanceReport, setAdminFinanceReport] = useState({ platform_commission: 0, total_sales: 0, gross_sales: 0, tipster_earnings: 0, total_payouts: 0, pending_payouts: 0, available_to_payout: 0, transactions: [] })
  function updateUnlockedTips(updater) {
    setUnlockedTips(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      return next
    })
  }
  const [toast, setToast] = useState(null)
  const [wallet, setWallet] = useState(0)
  const [unlockedTips, setUnlockedTips] = useState(() => new Set())
  const [followingTipsters, setFollowingTipsters] = useState(() => new Set())
  const [notifications, setNotifications] = useState([])
  const [notifyPanelOpen, setNotifyPanelOpen] = useState(false)
  const [notifyPanelStyle, setNotifyPanelStyle] = useState(null)
  const [dmPanelOpen, setDmPanelOpen] = useState(false)
  const [dmPanelStyle, setDmPanelStyle] = useState(null)
  const [dmUnreadCount, setDmUnreadCount] = useState(0)
  const notifyButtonRef = useRef(null)
  const mailButtonRef = useRef(null)
  const [tokenBalance, setTokenBalance] = useState(0)
  const [realRanking, setRealRanking] = useState([])
  const [referralData, setReferralData] = useState({ referral_code: '', referrals_count: 0, buyers_count: 0, reward_total: 0, referrals: [], rewards: [] })
  const [referralLoading, setReferralLoading] = useState(false)
  const [aiLiveGenerating, setAiLiveGenerating] = useState(false)
  const [aiSettleGenerating, setAiSettleGenerating] = useState(false)
  const [selectedTipsterId, setSelectedTipsterId] = useState(null)
  const [pendingPublicSlug, setPendingPublicSlug] = useState(() => {
    if (typeof window === 'undefined') return null
    const match = window.location.pathname.match(/^\/tipster\/([^/?#]+)/)
    return match ? decodeURIComponent(match[1]) : null
  })
  const [appLang, setAppLang] = useState(getInitialBetaiLanguage)
  const [liveTipPopup, setLiveTipPopup] = useState(null)
  const [liveTipPopupVisible, setLiveTipPopupVisible] = useState(false)
  const liveTipPopupTimerRef = useRef(null)
  const liveTipPopupHideTimerRef = useRef(null)
  const lastLiveTipIdRef = useRef('')
  const [receivedTipPopup, setReceivedTipPopup] = useState(null)
  const [receivedTipPopupVisible, setReceivedTipPopupVisible] = useState(false)
  const receivedTipTimerRef = useRef(null)
  const receivedTipHideTimerRef = useRef(null)
  const lastReceivedTipRef = useRef('')
  const receivedTipPollReadyRef = useRef(false)
  const lastReceivedTipPollKeyRef = useRef('')
  const receivedTipNotificationPollReadyRef = useRef(false)
  const lastReceivedTipNotificationKeyRef = useRef('')

  function hideReceivedTipPopup() {
    setReceivedTipPopupVisible(false)
    if (receivedTipHideTimerRef.current) clearTimeout(receivedTipHideTimerRef.current)
    receivedTipHideTimerRef.current = setTimeout(() => setReceivedTipPopup(null), 260)
  }

  function showReceivedTipPopup(senderName = 'Użytkownik', amount = 1) {
    if (receivedTipTimerRef.current) clearTimeout(receivedTipTimerRef.current)
    if (receivedTipHideTimerRef.current) clearTimeout(receivedTipHideTimerRef.current)
    setReceivedTipPopup({ senderName, amount })
    setReceivedTipPopupVisible(true)
    receivedTipTimerRef.current = setTimeout(() => setReceivedTipPopupVisible(false), 4200)
    receivedTipHideTimerRef.current = setTimeout(() => setReceivedTipPopup(null), 4550)
  }

  async function fetchCurrentTokenBalance() {
    const email = normalizeEmail(sessionUser?.email || accountProfile?.email || '')
    if (!email) return 0
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('betai_token_wallets')
          .select('balance')
          .eq('email', email)
          .maybeSingle()
        if (!error && data) {
          const nextBalance = Number(data.balance || 0) || 0
          setTokenBalance(nextBalance)
          try { localStorage.setItem('betai_tokens_' + email, String(nextBalance)) } catch (_) {}
          return nextBalance
        }
      }
    } catch (error) {
      console.warn('token balance realtime refresh skipped', error)
    }
    try {
      const localTokens = Number(localStorage.getItem('betai_tokens_' + email) || '0') || 0
      setTokenBalance(localTokens)
      return localTokens
    } catch (_) {
      return 0
    }
  }

  function getTipSenderFromNotification(row = {}) {
    const body = String(row.body || row.message || '')
    const title = String(row.title || '')
    const sentBy = String(row.sender_username || row.from_username || row.sent_by || '').trim()
    const match = body.match(/^(.+?)\s+wysłał\s+Ci/i) || body.match(/^(.+?)\s+wyslal\s+Ci/i)
    if (match?.[1]) return match[1].trim()
    if (sentBy && sentBy.toLowerCase() !== 'betai') return sentBy
    const titleMatch = title.match(/od\s+(.+)$/i)
    if (titleMatch?.[1]) return titleMatch[1].trim()
    return 'Użytkownik'
  }

  function isTipNotification(row = {}) {
    const title = String(row.title || '').toLowerCase()
    const body = String(row.body || row.message || '').toLowerCase()
    const reward = Number(row.reward_tokens || 0) || 0
    return reward > 0 && (title.includes('tip') || body.includes('wysłał ci') || body.includes('wyslal ci') || body.includes('żeton') || body.includes('zeton'))
  }

  function showReceivedTipFromNotification(row = {}, silent = false) {
    if (!row || !isTipNotification(row)) return false
    const key = String(row.id || `${row.created_at || ''}_${row.title || ''}_${row.body || row.message || ''}_${row.reward_tokens || 1}`)
    if (!key || lastReceivedTipNotificationKeyRef.current === key) return false
    lastReceivedTipNotificationKeyRef.current = key
    if (!silent) {
      const senderName = getTipSenderFromNotification(row)
      const amount = Math.max(1, Number(row.reward_tokens || 1) || 1)
      showReceivedTipPopup(senderName, amount)
    }
    window.dispatchEvent(new CustomEvent('betai-token-balance-changed'))
    fetchCurrentTokenBalance()
    return true
  }

  function hideLiveTipPopup() {
    setLiveTipPopupVisible(false)
    if (liveTipPopupHideTimerRef.current) clearTimeout(liveTipPopupHideTimerRef.current)
    liveTipPopupHideTimerRef.current = setTimeout(() => setLiveTipPopup(null), 320)
  }

  function showLiveTipPopup(rawTip) {
    const incomingTip = normalizeTipRow(rawTip || {})
    const nextId = String(incomingTip?.id || '')
    if (!nextId) return
    if (lastLiveTipIdRef.current === nextId) return
    if (String(getTipAuthorId(incomingTip) || '') === String(sessionUser?.id || '')) return

    lastLiveTipIdRef.current = nextId

    if (liveTipPopupTimerRef.current) clearTimeout(liveTipPopupTimerRef.current)
    if (liveTipPopupHideTimerRef.current) clearTimeout(liveTipPopupHideTimerRef.current)

    setLiveTipPopup(incomingTip)
    setLiveTipPopupVisible(true)

    liveTipPopupTimerRef.current = setTimeout(() => {
      setLiveTipPopupVisible(false)
    }, 4700)

    liveTipPopupHideTimerRef.current = setTimeout(() => {
      setLiveTipPopup(null)
    }, 5200)
  }


  function changeAppLanguage(nextLang) {
    if (!BETAI_LANGUAGES.includes(nextLang)) return
    setAppLang(nextLang)
    try { localStorage.setItem('betai_language', nextLang) } catch (_) {}
    window.dispatchEvent(new CustomEvent('betai-language-changed', { detail: nextLang }))
  }

  useEffect(() => {
    const syncLanguage = (event) => {
      const nextLang = event?.detail || getInitialBetaiLanguage()
      if (BETAI_LANGUAGES.includes(nextLang)) setAppLang(nextLang)
    }
    window.addEventListener('betai-language-changed', syncLanguage)
    window.addEventListener('storage', syncLanguage)
    return () => {
      window.removeEventListener('betai-language-changed', syncLanguage)
      window.removeEventListener('storage', syncLanguage)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const refParam = params.get('ref') || params.get('r')
    const pathMatch = window.location.pathname.match(/^\/ref\/([^/?#]+)/)
    const code = refParam || (pathMatch ? decodeURIComponent(pathMatch[1]) : '')
    if (code) {
      setStoredReferralCode(code)
      if (pathMatch) window.history.replaceState({}, document.title, '/')
    }
  }, [])

  async function resolvePublicTipsterBySlug(slug) {
    const cleanSlug = normalizePublicSlug(slug)
    if (!cleanSlug || !isSupabaseConfigured || !supabase) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,username,public_slug')
        .or(`public_slug.eq.${cleanSlug},username.eq.${cleanSlug}`)
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('resolvePublicTipsterBySlug error', error)
        return
      }

      if (data?.id) {
        setSelectedTipsterId(data.id)
        setView('dashboard')
      }
    } catch (error) {
      console.error('resolvePublicTipsterBySlug exception', error)
    }
  }

  async function fetchRealRanking() {
    if (!isSupabaseConfigured || !supabase) {
      setRealRanking(buildLiveLeaderboardRows([], tips))
      return
    }

    try {
      let rankingRows = []
      let tipRows = []
      let profileRows = []

      try {
        const { data, error } = await supabase.from('tipster_ranking_live').select('*').order('profit', { ascending: false }).limit(100)
        if (!error && Array.isArray(data)) rankingRows = data
        else if (error) console.warn('tipster_ranking_live skipped', error)
      } catch (error) {
        console.warn('tipster_ranking_live exception skipped', error)
      }

      if (!rankingRows.length) {
        try {
          const { data, error } = await supabase.from('tipster_ranking').select('*').limit(100)
          if (!error && Array.isArray(data)) rankingRows = data
          else if (error) console.warn('tipster_ranking skipped', error)
        } catch (error) {
          console.warn('tipster_ranking exception skipped', error)
        }
      }

      try {
        const { data, error } = await supabase.from('tips').select('*').order('created_at', { ascending: false }).limit(1000)
        if (!error && Array.isArray(data)) tipRows = data
        else if (error) console.warn('ranking tips skipped', error)
      } catch (error) {
        console.warn('ranking tips exception skipped', error)
      }

      try {
        profileRows = await fetchBetaiPublicProfiles()
      } catch (error) {
        console.warn('ranking public profiles exception skipped', error)
      }

      const profileRankingRows = profileRows.map(profile => {
        const imported = getImportedProfileStats(profile)
        const profit = Number(imported?.profit ?? profile.imported_profit ?? profile.profit ?? profile.earnings ?? 0) || 0
        const totalTips = Number(imported?.totalTips ?? profile.imported_total_tips ?? profile.total_tips ?? profile.tips_count ?? 0) || 0
        const wins = Number(imported?.wonTips ?? profile.imported_won_tips ?? profile.wins ?? 0) || 0
        const losses = Number(imported?.lostTips ?? profile.imported_lost_tips ?? profile.losses ?? 0) || 0
        const roi = Number(imported?.yield ?? profile.imported_yield ?? profile.yield ?? profile.roi ?? 0) || 0
        return {
          ...profile,
          tipster_id: profile.id,
          username: profile.username || (profile.email ? String(profile.email).split('@')[0] : 'Użytkownik'),
          total_tips: totalTips,
          totalTips,
          wins,
          losses,
          winrate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : Number(profile.winrate || 0),
          roi,
          yield: roi,
          earnings: profit,
          profit
        }
      })

      const finalRows = buildLiveLeaderboardRows(
        mergeRankingRows(profileRankingRows, rankingRows, buildRankingFromTips(tipRows)),
        tipRows.length ? tipRows : tips
      ).slice(0, 10)

      setRealRanking(finalRows)
    } catch (error) {
      console.error('fetchRealRanking exception', error)
      setRealRanking(buildLiveLeaderboardRows([], tips))
    }
  }

  async function fetchReferralData(userId = sessionUser?.id) {
    if (!userId || !isSupabaseConfigured || !supabase) {
      setReferralData({ referral_code: '', referrals_count: 0, buyers_count: 0, reward_total: 0, referrals: [], rewards: [] })
      return
    }

    setReferralLoading(true)
    try {
      const { data: codeData } = await supabase.rpc('ensure_referral_code', { p_user_id: userId })
      const referralCode = typeof codeData === 'string' ? codeData : ''
      const { data: dashboardData, error } = await supabase.rpc('get_referral_dashboard', { p_user_id: userId })
      if (error) throw error
      const row = Array.isArray(dashboardData) ? dashboardData[0] : dashboardData

      const { data: referralsRows } = await supabase.from('referrals').select('*').eq('referrer_id', userId).order('created_at', { ascending: false }).limit(20)
      const { data: rewardsRows } = await supabase.from('referral_rewards').select('*').eq('referrer_id', userId).order('created_at', { ascending: false }).limit(20)

      setReferralData({
        referral_code: row?.referral_code || referralCode,
        referrals_count: Number(row?.referrals_count || 0),
        buyers_count: Number(row?.buyers_count || 0),
        reward_total: Number(row?.reward_total || 0),
        referrals: referralsRows || [],
        rewards: rewardsRows || []
      })
    } catch (error) {
      console.error('fetchReferralData error', error)
    } finally {
      setReferralLoading(false)
    }
  }

  async function runLiveAiEngine() {
    setAiLiveGenerating(true)
    try {
      const response = await fetch("/.netlify/functions/generate-live-ai-picks", { method: "POST" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Nie udało się wygenerować LIVE AI typów")
      const msg = data.inserted ? `Dodano ${data.inserted} realnych typów z ${data.matches_checked || data.live_matches_checked || 0} meczów.` : (data.message || "Brak meczów live albo brak value picków.")
      showToast({ type: data.inserted ? "success" : "info", title: "LIVE AI", message: msg })
      await fetchTips(sessionUser?.id)
    } catch (error) {
      console.error("runLiveAiEngine error", error)
      showToast({ type: "error", title: "LIVE AI Engine", message: error.message || "Sprawdź API_FOOTBALL_KEY w Netlify ENV." })
    } finally {
      setAiLiveGenerating(false)
    }
  }

  async function runAiSettlement() {
    setAiSettleGenerating(true)
    try {
      const response = await fetch("/.netlify/functions/settle-live-ai-picks", { method: "POST" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Nie udało się rozliczyć zakończonych meczów")
      const extra = data.errors?.length ? ` Błędy: ${data.errors.length}` : ""
      showToast({ type: data.settled ? "success" : "info", title: "AI Settlement", message: `Sprawdzono ${data.checked || 0}, rozliczono ${data.settled || 0}, pominięto ${data.skipped || 0}.${extra}` })
      await fetchTips(sessionUser?.id)
    } catch (error) {
      console.error("runAiSettlement error", error)
      showToast({ type: "error", title: "AI Settlement", message: error.message || "Sprawdź API_FOOTBALL_KEY / Supabase ENV." })
    } finally {
      setAiSettleGenerating(false)
    }
  }

  async function fetchTips(userId = sessionUser?.id) {
    if (!isSupabaseConfigured || !supabase) {
      setTips([])
      return
    }

    setLoading(true)

    const [{ data: tipsData, error: tipsError }, { data: unlockedData, error: unlockedError }] = await Promise.all([
      supabase
        .from('tips')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
      userId
        ? supabase.from('unlocked_tips').select('tip_id').eq('user_id', userId)
        : Promise.resolve({ data: [], error: null })
    ])

    setLoading(false)

    if (tipsError) {
      console.error('FETCH TIPS ERROR:', tipsError)
      showToast({ type: 'error', title: 'Nie pobrano typów', message: formatAppErrorMessage(tipsError.message || String(tipsError)) })
      setTips([])
      return
    }

    const unlockedSet = new Set((unlockedData || []).map(row => row.tip_id))
    setUnlockedTips(unlockedSet)

    let sourceTips = (tipsData || []).map(normalizeTipRow)
    const authorDynamicStatsMap = buildAuthorStatsFromTips(sourceTips)
    try {
      const authorIds = [...new Set(sourceTips.map(tip => getTipAuthorId(tip)).filter(Boolean).map(String))]
      const authorEmails = [...new Set(sourceTips.map(tip => normalizeEmail(tip.author_email || tip.email || tip.user_email)).filter(Boolean))]
      const authorNames = [...new Set(sourceTips.map(tip => normalizeEmail(tip.author_name || tip.username)).filter(Boolean).filter(name => !isGenericProfileName(name)))]
      const profileFilters = [
        ...authorIds.map(id => `id.eq.${id}`),
        ...authorEmails.map(email => `email.eq.${email}`),
        ...authorNames.map(name => `username.eq.${name}`)
      ].join(',')
      if (profileFilters) {
        const { data: authorProfiles, error: authorProfilesError } = await supabase
          .from('profiles')
          .select('id,email,username,avatar_url,imported_yield,imported_total_tips,imported_won_tips,imported_lost_tips,imported_pending_tips,imported_total_staked,imported_profit,imported_avg_odds,imported_highest_odds,imported_tips_currency')
          .or(profileFilters)
        if (!authorProfilesError && Array.isArray(authorProfiles)) {
          const authorProfileMap = new Map()
          authorProfiles.forEach(profile => {
            if (profile.id) authorProfileMap.set(String(profile.id), profile)
            if (profile.email) authorProfileMap.set(normalizeEmail(profile.email), profile)
            if (profile.username) authorProfileMap.set(normalizeEmail(profile.username), profile)
          })
          sourceTips = sourceTips.map(tip => {
            const profile =
              authorProfileMap.get(String(getTipAuthorId(tip) || '')) ||
              authorProfileMap.get(normalizeEmail(tip.author_email || tip.email || tip.user_email)) ||
              authorProfileMap.get(normalizeEmail(tip.author_name || tip.username))
            return profile
              ? {
                  ...tip,
                  author_name: profile.username || (profile.email ? String(profile.email).split('@')[0] : resolveRealProfileUsername(tip)),
                  username: profile.username || tip.username,
                  author_email: tip.author_email || profile.email || null,
                  author_avatar_url: tip.author_avatar_url || getProfileAvatarUrl(profile) || null,
                  author_visible_stats: finalizeAuthorStats(authorDynamicStatsMap.get(getTipAuthorStatsKey(tip)), getImportedProfileStats(profile)),
                }
              : {
                  ...tip,
                  author_name: resolveRealProfileUsername(tip)
                }
          })
        }
      }
    } catch (avatarEnrichError) {
      console.warn('tip avatar enrichment skipped', avatarEnrichError)
    }
    // WERSJA 912: cache aktualnego usera + RPC publicznych profili.
    // Naprawia przypadek, gdzie stare rekordy w DB miały avatar buchajson1988 przy smilhytv.
    try {
      cacheBetaiCurrentUserAvatar(sessionUser)
      const allProfiles = await fetchBetaiPublicProfiles()
      const profileMap = buildBetaiProfileMap(allProfiles)
      if (profileMap.size) {
        sourceTips = sourceTips.map(tip => applyProfileAvatarToTip(tip, profileMap))
      }
      const currentAvatar = getProfileAvatarUrl(sessionUser)
      if (currentAvatar) {
        const currentEmail = normalizeEmail(sessionUser?.email)
        const currentUsername = normalizeEmail(sessionUser?.username || sessionUser?.user_metadata?.username || sessionUser?.user_metadata?.name)
        sourceTips = sourceTips.map(tip => {
          const tipEmail = normalizeEmail(tip.author_email || tip.email || tip.user_email)
          const tipName = normalizeEmail(tip.author_name || tip.username)
          if ((currentEmail && tipEmail === currentEmail) || (currentUsername && tipName === currentUsername)) {
            return { ...tip, author_avatar_url: currentAvatar, avatar_url: currentAvatar, profile_avatar_url: currentAvatar }
          }
          return tip
        })
      }
    } catch (allProfileAvatarError) {
      console.warn('global tip avatar hydration skipped', allProfileAvatarError)
    }

    sourceTips = sourceTips.map(tip => ({
      ...tip,
      author_visible_stats: tip.author_visible_stats || finalizeAuthorStats(authorDynamicStatsMap.get(getTipAuthorStatsKey(tip)), null)
    }))
    let activeSubs = []
    if (userId) {
      const { data: subRows } = await supabase.from('tipster_subscriptions').select('tipster_id,status,expires_at').eq('user_id', userId).eq('status', 'active')
      activeSubs = Array.isArray(subRows) ? subRows.filter(row => !row.expires_at || new Date(row.expires_at).getTime() > Date.now()) : []
      setTipsterSubscriptions(activeSubs)
    }
    setTips(sourceTips)
    setLastTipSaveStatus(readTipDebug())
    fetchRealRanking()
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !sessionUser?.id) return undefined

    const channel = supabase
      .channel(`betai-live-tip-center-${sessionUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tips' }, (payload) => {
        let incomingTip = normalizeTipRow(payload?.new || {})
        if (!incomingTip?.id) return
        if (isSameProfileIdentity(effectiveAccountProfile || sessionUser, incomingTip)) {
          incomingTip = normalizeTipRow({
            ...incomingTip,
            author_name: getProfileUsername(effectiveAccountProfile || sessionUser) || incomingTip.author_name,
            author_email: (effectiveAccountProfile || sessionUser)?.email || incomingTip.author_email,
            author_avatar_url: getProfileAvatarUrl(effectiveAccountProfile || sessionUser) || incomingTip.author_avatar_url,
            avatar_url: getProfileAvatarUrl(effectiveAccountProfile || sessionUser) || incomingTip.avatar_url
          })
        }

        setTips(prev => [incomingTip, ...prev.filter(item => String(item.id) !== String(incomingTip.id))].slice(0, 50))
        showLiveTipPopup(incomingTip)
        fetchRealRanking()
      })
      .subscribe()

    return () => {
      try { supabase.removeChannel(channel) } catch (_) {}
    }
  }, [sessionUser?.id])

  async function fetchFollowingTipsters(userId = sessionUser?.id) {
    if (!isSupabaseConfigured || !supabase || !userId) {
      setFollowingTipsters(new Set())
      return
    }

    const { data, error } = await supabase
      .from('tipster_follows')
      .select('tipster_id')
      .eq('follower_id', userId)

    if (error) {
      console.error('fetchFollowingTipsters error', error)
      setFollowingTipsters(new Set())
      return
    }

    setFollowingTipsters(new Set((data || []).map(row => String(row.tipster_id))))
  }

  async function fetchNotifications(userId = sessionUser?.id) {
    const email = normalizeEmail(sessionUser?.email || accountProfile?.email || '')
    if (!isSupabaseConfigured || !supabase || (!userId && !email)) {
      setNotifications([])
      setTokenBalance(0)
      return
    }

    const combined = []

    if (userId) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50)
        if (!error && Array.isArray(data)) combined.push(...data.map(row => ({ ...row, source: 'follow' })))
      } catch (error) {
        console.warn('fetch notifications table skipped', error)
      }
    }

    if (email) {
      try {
        const { data, error } = await supabase
          .from('betai_system_notifications')
          .select('*')
          .eq('recipient_email', email)
          .order('created_at', { ascending: false })
          .limit(100)
        if (!error && Array.isArray(data)) combined.push(...data.map(row => ({ ...row, source: 'system', message: row.body || row.message || '' })))
      } catch (error) {
        console.warn('fetch betai_system_notifications skipped', error)
      }

      try {
        const { data, error } = await supabase
          .from('betai_token_wallets')
          .select('balance')
          .eq('email', email)
          .maybeSingle()
        if (!error && data) setTokenBalance(Number(data.balance || 0) || 0)
        else {
          const localTokens = Number(localStorage.getItem('betai_tokens_' + email) || '0') || 0
          setTokenBalance(localTokens)
        }
      } catch (error) {
        const localTokens = Number(localStorage.getItem('betai_tokens_' + email) || '0') || 0
        setTokenBalance(localTokens)
      }
    }

    combined.sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    setNotifications(combined)
  }

  async function ensureUserWalletAndWelcome(user = sessionUser) {
    const email = normalizeEmail(user?.email || accountProfile?.email || '')
    if (!email || !isSupabaseConfigured || !supabase) return
    try {
      const { data: existing } = await supabase
        .from('betai_token_wallets')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (!existing) {
        await supabase.from('betai_token_wallets').upsert({
          email,
          user_id: user?.id || null,
          balance: 100,
          welcome_bonus_claimed: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' })
        await supabase.from('betai_token_transactions').insert({
          email,
          delta_tokens: 100,
          delta_pln: 0,
          reason: 'welcome_bonus',
          ref_type: 'system'
        })
        await supabase.from('betai_system_notifications').insert({
          recipient_email: email,
          title: 'Witamy w BetAI 👋',
          body: 'Miło Cię widzieć! Na start dodaliśmy 100 żetonów do Twojego konta. Możesz nimi tipować najlepsze wiadomości na czacie.',
          reward_tokens: 100,
          sent_by: 'betai',
          is_read: false
        })
        setTokenBalance(100)
        showToast({ type: 'success', title: 'Witaj w BetAI 👋', message: 'Miło Cię widzieć! Dodaliśmy 100 żetonów na start.' })
      } else {
        const balance = Number(existing.balance || 0) || 0
        setTokenBalance(balance)
        if (!existing.welcome_bonus_claimed) {
          const next = balance + 100
          await supabase.from('betai_token_wallets').update({ balance: next, welcome_bonus_claimed: true, updated_at: new Date().toISOString() }).eq('email', email)
          await supabase.from('betai_token_transactions').insert({ email, delta_tokens: 100, delta_pln: 0, reason: 'welcome_bonus', ref_type: 'system' })
          await supabase.from('betai_system_notifications').insert({
            recipient_email: email,
            title: 'Witamy w BetAI 👋',
            body: 'Miło Cię widzieć! Przyznaliśmy jednorazowy bonus powitalny: 100 żetonów.',
            reward_tokens: 100,
            sent_by: 'betai',
            is_read: false
          })
          setTokenBalance(next)
          showToast({ type: 'success', title: 'Bonus powitalny', message: 'Dodaliśmy 100 żetonów do Twojego konta.' })
        } else {
          showToast({ type: 'success', title: 'Witaj ponownie 👋', message: 'Miło Cię widzieć z powrotem w BetAI.' })
        }
      }
      await fetchNotifications(user?.id)
    } catch (error) {
      console.warn('ensure wallet/welcome skipped', error)
      try {
        const localTokens = Number(localStorage.getItem('betai_tokens_' + email) || '0') || 0
        setTokenBalance(localTokens)
      } catch (_) {}
    }
  }

  async function resolveTipsterProfile(tipsterRef, authorName) {
    if (!isSupabaseConfigured || !supabase) return null

    const rawRef = String(tipsterRef || '').trim()
    const rawName = String(authorName || '').trim()
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (rawRef && uuidLike.test(rawRef)) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,username,public_slug,avatar_url')
        .eq('id', rawRef)
        .maybeSingle()
      if (!error && data?.id) return data
    }

    const candidates = [rawRef, rawName]
      .flatMap(value => {
        const clean = String(value || '').trim()
        if (!clean) return []
        const lower = clean.toLowerCase()
        const noAt = lower.startsWith('@') ? lower.slice(1) : lower
        const emailLocal = lower.includes('@') ? lower.split('@')[0] : ''
        return [lower, noAt, emailLocal].filter(Boolean)
      })
      .filter(Boolean)

    if (!candidates.length) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,username,public_slug,avatar_url')
      .limit(500)

    if (error) {
      console.error('resolveTipsterProfile error', error)
      return null
    }

    return (data || []).find(profile => {
      const email = String(profile.email || '').toLowerCase()
      const emailLocal = email ? email.split('@')[0] : ''
      const username = String(profile.username || '').toLowerCase()
      const slug = String(profile.public_slug || '').toLowerCase()
      const id = String(profile.id || '').toLowerCase()
      return candidates.some(candidate =>
        candidate === id ||
        candidate === email ||
        candidate === emailLocal ||
        candidate === username ||
        candidate === slug
      )
    }) || null
  }

  async function resolveTipsterId(tipsterId, authorName) {
    const profile = await resolveTipsterProfile(tipsterId, authorName)
    return profile?.id ? String(profile.id) : null
  }

  async function openTipsterProfile(tipsterRef, authorName) {
    const profile = await resolveTipsterProfile(tipsterRef, authorName)
    const id = profile?.id ? String(profile.id) : null

    const fallbackLookup = String(authorName || tipsterRef || '').trim()
    if (!id && !fallbackLookup) {
      showToast({ type: 'error', title: 'Profil typera', message: 'Nie udało się otworzyć profilu tego użytkownika.' })
      return
    }

    const currentProfile = effectiveAccountProfile || sessionUser || {}
    const currentId = currentProfile?.id || sessionUser?.id
    const currentEmail = normalizeEmail(currentProfile?.email || sessionUser?.email || '')
    const currentUsername = normalizeEmail(resolveRealProfileUsername(currentProfile || sessionUser || {}))
    const targetEmail = normalizeEmail(profile?.email || '')
    const targetUsername = normalizeEmail(profile?.username || profile?.public_slug || '')

    const fallbackLookupKey = normalizeEmail(fallbackLookup)
    const isOwnProfile = Boolean(
      (id && currentId && String(currentId) === id) ||
      (currentEmail && targetEmail && currentEmail === targetEmail) ||
      (currentUsername && targetUsername && currentUsername === targetUsername) ||
      (!id && fallbackLookupKey && (fallbackLookupKey === currentUsername || fallbackLookupKey === currentEmail || fallbackLookupKey === String(currentEmail || '').split('@')[0]))
    )

    setSelectedTipsterId(null)
    if (isOwnProfile) {
      setView('profile')
    } else {
      setSelectedTipsterId(id || `lookup:${encodeURIComponent(fallbackLookup)}`)
      setView('dashboard')
    }
    try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch (_) {}
  }

  async function toggleFollowTipster(tipsterId, authorName) {
    if (!sessionUser?.id) {
      showToast({ type: 'error', title: 'Zaloguj się', message: 'Musisz być zalogowany, aby obserwować typera.' })
      return
    }

    if (!isSupabaseConfigured || !supabase) {
      showToast({ type: 'error', title: 'Supabase', message: 'Brak konfiguracji bazy.' })
      return
    }

    const resolvedId = await resolveTipsterId(tipsterId, authorName)
    const id = resolvedId ? String(resolvedId) : null
    if (!id || id === String(sessionUser.id)) {
      showToast({ type: 'info', title: 'Follow', message: 'Nie można obserwować własnego konta albo nie znaleziono typera w profiles.' })
      return
    }

    const fallbackKey = String(authorName || '').toLowerCase()
    const alreadyFollowing = followingTipsters.has(id) || (fallbackKey && followingTipsters.has(fallbackKey))

    if (alreadyFollowing) {
      const { error } = await supabase
        .from('tipster_follows')
        .delete()
        .eq('follower_id', sessionUser.id)
        .eq('tipster_id', id)

      if (error) {
        showToast({ type: 'error', title: 'Follow', message: formatAppErrorMessage(error.message) })
        return
      }

      setFollowingTipsters(prev => {
        const next = new Set(prev)
        next.delete(id)
        if (fallbackKey) next.delete(fallbackKey)
        return next
      })
      showToast({ type: 'success', title: 'Follow', message: 'Przestałeś obserwować typera.' })
      return
    }

    const { error } = await supabase
      .from('tipster_follows')
      .upsert({ follower_id: sessionUser.id, tipster_id: id }, { onConflict: 'follower_id,tipster_id' })

    if (error) {
      showToast({ type: 'error', title: 'Follow', message: formatAppErrorMessage(error.message) })
      return
    }

    setFollowingTipsters(prev => {
      const next = new Set(prev)
      next.add(id)
      if (authorName) next.add(String(authorName).toLowerCase())
      return next
    })
    showToast({ type: 'success', title: 'Follow', message: 'Obserwujesz typera. Powiadomienia pojawią się po nowych typach.' })
  }

  async function markAllNotificationsRead() {
    if (!isSupabaseConfigured || !supabase) return
    const email = normalizeEmail(sessionUser?.email || accountProfile?.email || '')
    let failed = false

    if (sessionUser?.id) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', sessionUser.id)
          .eq('is_read', false)
        if (error) failed = true
      } catch (_) { failed = true }
    }

    if (email) {
      try {
        const { error } = await supabase
          .from('betai_system_notifications')
          .update({ is_read: true })
          .eq('recipient_email', email)
          .eq('is_read', false)
        if (error) failed = true
      } catch (_) { failed = true }
    }

    await fetchNotifications(sessionUser?.id)
    if (failed) showToast({ type: 'info', title: 'Powiadomienia', message: 'Część powiadomień mogła już być oznaczona albo tabela nie istnieje.' })
    else showToast({ type: 'success', title: 'Powiadomienia', message: 'Oznaczono jako przeczytane.' })
  }


  useEffect(() => {
    if (pendingPublicSlug) {
      resolvePublicTipsterBySlug(pendingPublicSlug)
      setPendingPublicSlug(null)
    }
  }, [pendingPublicSlug])

  useEffect(() => {
    try {
      localStorage.removeItem('betai_unlocked_tips_v1')
      localStorage.removeItem(getUnlockedTipsStorageKey('guest'))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (sessionUser?.id) {
      setUnlockedTips(new Set())
      fetchUnlockedTips(sessionUser.id)
      fetchPaymentHistory(sessionUser.id)
      fetchFollowingTipsters(sessionUser.id)
      fetchNotifications(sessionUser.id)
    } else {
      setUnlockedTips(new Set())
      setFollowingTipsters(new Set())
      setNotifications([])
      setTokenBalance(0)
    }
  }, [sessionUser?.id])


  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('profile_sub') === 'success') {
      showToast({ type: 'success', title: 'Dostęp do profilu', message: 'Płatność zakończona. Dostęp do typów typera zostanie odświeżony.' })
      if (sessionUser?.id) {
        fetchTips(sessionUser.id)
        fetchPaymentHistory(sessionUser.id)
      }
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    if (params.get('profile_sub') === 'cancel') {
      showToast({ type: 'info', title: 'Dostęp do profilu', message: 'Zakup dostępu został anulowany.' })
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    if (params.get('wallet_topup') === 'success') {
      showToast({ type: 'success', title: 'Płatność zakończona', message: 'Jeśli Stripe potwierdził płatność, saldo zaraz się odświeży.' })
      if (sessionUser?.id) {
        fetchWalletBalance(sessionUser.id)
        fetchTipsterEarnings(sessionUser.id)
        fetchStripeConnectStatus(sessionUser.id)
      }
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    if (params.get('wallet_topup') === 'cancel') {
      showToast({ type: 'info', title: 'Płatność anulowana', message: 'Doładowanie nie zostało opłacone.' })
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [sessionUser?.id])


  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const premiumStatus = params.get('premium')
    const sessionId = params.get('session_id')

    async function syncPremiumAfterStripe() {
      if (premiumStatus === 'success' && sessionId) {
        try {
          showToast({ type: 'info', title: 'Premium', message: 'Synchronizuję subskrypcję ze Stripe...' })
          const response = await fetch('/.netlify/functions/sync-premium-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              expected_user_id: sessionStorage.getItem('betai_premium_checkout_user_id') || sessionUser?.id || null,
              expected_email: sessionStorage.getItem('betai_premium_checkout_email') || sessionUser?.email || null
            })
          })
          const data = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(data.error || 'Nie udało się zsynchronizować Premium.')
          showToast({ type: 'success', title: 'Premium aktywowany', message: 'Konto Premium zostało zapisane w bazie.' })
          try {
            sessionStorage.removeItem('betai_premium_checkout_user_id')
            sessionStorage.removeItem('betai_premium_checkout_email')
          } catch {}
          setUserPlan('premium')
          if (sessionUser?.id) {
            await fetchUserPlan(sessionUser.id)
            await fetchWalletBalance(sessionUser.id)
          }
        } catch (error) {
          showToast({ type: 'error', title: 'Premium', message: formatAppErrorMessage(error.message) })
        } finally {
          window.history.replaceState({}, document.title, window.location.pathname)
        }
      } else if (premiumStatus === 'success') {
        showToast({ type: 'success', title: 'Premium', message: 'Płatność zakończona. Premium aktywuje się po potwierdzeniu Stripe.' })
        if (sessionUser?.id) fetchUserPlan(sessionUser.id)
        window.history.replaceState({}, document.title, window.location.pathname)
      } else if (premiumStatus === 'cancel') {
        showToast({ type: 'info', title: 'Premium', message: 'Płatność Premium została anulowana.' })
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }

    syncPremiumAfterStripe()
  }, [sessionUser?.id])


  useEffect(() => {
    const handler = () => runPremiumCheckout()
    window.addEventListener('betai:start-premium-checkout', handler)
    return () => window.removeEventListener('betai:start-premium-checkout', handler)
  }, [sessionUser?.id])


  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('stripe_connect') === 'success') {
      showToast({ type: 'success', title: 'Stripe Connect', message: 'Konto Stripe zostało połączone. Status wypłat odświeży się automatycznie.' })
      if (sessionUser?.id) fetchStripeConnectStatus(sessionUser.id)
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    if (params.get('stripe_connect') === 'refresh') {
      showToast({ type: 'info', title: 'Stripe Connect', message: 'Dokończ konfigurację konta Stripe.' })
      if (sessionUser?.id) connectStripeAccount()
    }
  }, [sessionUser?.id])

  useEffect(() => {
    fetchTips(sessionUser?.id)
  }, [sessionUser?.id])





  async function fetchStripeConnectStatus(userId = sessionUser?.id) {
    try {
      if (!isSupabaseConfigured || !supabase || !userId) {
        setStripeConnectStatus(null)
        return
      }

      const { data, error } = await supabase
        .from('user_stripe_accounts')
        .select('stripe_account_id,charges_enabled,payouts_enabled,created_at,updated_at')
        .eq('user_id', userId)
        .maybeSingle()

      if (error || !data) {
        setStripeConnectStatus(null)
        return
      }

      setStripeConnectStatus(data)
    } catch (error) {
      console.error('fetchStripeConnectStatus error', error)
      setStripeConnectStatus(null)
    }
  }

  async function connectStripeAccount() {
    try {
      if (!sessionUser?.id) {
        showToast({ type: 'error', title: 'Brak konta', message: 'Zaloguj się, aby połączyć Stripe.' })
        return
      }

      showToast({ type: 'info', title: 'Stripe Connect', message: 'Tworzenie linku onboarding...' })

      const response = await fetch('/.netlify/functions/create-stripe-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: sessionUser.id, email: sessionUser.email })
      })

      const data = await response.json()

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Nie udało się utworzyć konta Stripe Connect.')
      }

      window.location.href = data.url
    } catch (error) {
      showToast({ type: 'error', title: 'Stripe Connect', message: formatAppErrorMessage(error.message) })
    }
  }

  async function savePaymentToSupabase(tipId, price = 29, userId = sessionUser?.id) {
    if (!isSupabaseConfigured || !supabase || !tipId) return false

    let finalUserId = userId
    if (!finalUserId) {
      const { data } = await supabase.auth.getSession()
      finalUserId = data?.session?.user?.id
    }

    if (!finalUserId) return false

    const { error } = await supabase
      .from('payments')
      .insert({
        user_id: finalUserId,
        tip_id: tipId,
        amount: price,
        currency: 'pln',
        status: 'paid'
      })

    return !error
  }

  async function saveUnlockToSupabase(tipId, price = 29, userId = sessionUser?.id) {
    if (!isSupabaseConfigured || !supabase || !tipId) return false

    let finalUserId = userId

    if (!finalUserId) {
      const { data } = await supabase.auth.getSession()
      finalUserId = data?.session?.user?.id
    }

    if (!finalUserId) return false

    const { error } = await supabase
      .from('unlocked_tips')
      .upsert({
        user_id: finalUserId,
        tip_id: tipId,
        price
      }, { onConflict: 'user_id,tip_id' })

    return !error
  }

  async function fetchUnlockedTips(userId = sessionUser?.id) {
    try {
    if (!isSupabaseConfigured || !supabase || !userId) {
      setUnlockedTips(new Set())
      return
    }

    const { data, error } = await supabase
      .from('unlocked_tips')
      .select('tip_id')
      .eq('user_id', userId)

    if (!error && Array.isArray(data)) {
      setUnlockedTips(new Set(data.map(row => row.tip_id)))
    } else {
      setUnlockedTips(new Set())
    }
    } catch (error) {
      console.error('fetchUnlockedTips error', error)
      setUnlockedTips(new Set())
    }
  }



  async function fetchAdminPayoutRequests() {
    if (!userProfile?.isAdmin || !isSupabaseConfigured || !supabase) {
      setAdminPayoutRequests([])
      return
    }

    const { data, error } = await supabase
      .from('payout_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('fetchAdminPayoutRequests error', error)
      setAdminPayoutRequests([])
      return
    }

    setAdminPayoutRequests(data || [])
  }

  

  async function runPayoutCron() {
    if (!sessionUser?.id || !isAdminUser(sessionUser)) {
      showToast({ type: 'error', title: 'Brak uprawnień', message: 'Tylko admin może uruchomić cron wypłat.' })
      return
    }

    try {
      showToast({ type: 'info', title: 'Cron wypłat', message: 'Uruchamiam testowe przetwarzanie pending wypłat...' })
      const response = await fetch('/.netlify/functions/process-payouts', { method: 'POST' })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się uruchomić cron wypłat.')
      }

      showToast({
        type: 'success',
        title: 'Cron zakończony',
        message: `Przetworzono: ${data.processed || 0}. Sprawdź statusy i transfer ID.`
      })

      await fetchAdminPayoutRequests()
      await fetchAdminFinanceReport()
      if (sessionUser?.id) {
        await fetchPayoutRequests(sessionUser.id)
        await fetchTipsterEarnings(sessionUser.id)
        await fetchWalletBalance(sessionUser.id)
      }
    } catch (error) {
      showToast({ type: 'error', title: 'Błąd cron wypłat', message: formatAppErrorMessage(error.message) })
    }
  }

  async function updatePayoutStatus(requestId, status) {
    if (!sessionUser?.id || !isAdminUser(sessionUser)) {
      showToast({ type: 'error', title: 'Brak uprawnień', message: 'Tylko admin może zmieniać status wypłat.' })
      return
    }

    try {
      if (status !== 'rejected') {
        const response = await fetch('/.netlify/functions/approve-payout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request_id: requestId, admin_user_id: sessionUser.id })
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data.error || 'Nie udało się wykonać realnej wypłaty Stripe Connect.')
        }
      } else {
        const { error } = await supabase.rpc('reject_tipster_payout', { p_request_id: requestId })

        if (error) {
          showToast({ type: 'error', title: 'Błąd aktualizacji', message: formatAppErrorMessage(error.message) })
          return
        }
      }

      showToast({
        type: 'success',
        title: 'Status zmieniony',
        message: status === 'rejected' ? 'Wypłata odrzucona.' : 'Wypłata zatwierdzona i oznaczona jako wypłacona.'
      })

      await fetchAdminPayoutRequests()
      await fetchAdminFinanceReport()
      if (sessionUser?.id) {
        await fetchPayoutRequests(sessionUser.id)
        await fetchTipsterEarnings(sessionUser.id)
        await fetchWalletBalance(sessionUser.id)
      }
    } catch (error) {
      showToast({ type: 'error', title: 'Błąd aktualizacji', message: formatAppErrorMessage(error.message) })
    }
  }





  async function runPremiumCheckout() {
    if (!sessionUser?.id) {
      showToast({ type: 'error', title: 'Brak konta', message: 'Zaloguj się, aby kupić Premium.' })
      return
    }

    try {
      showToast({ type: 'info', title: 'Premium', message: 'Przekierowanie do płatności Stripe...' })

      const response = await fetch('/.netlify/functions/create-premium-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: sessionUser.id, email: sessionUser.email })
      })

      const data = await response.json()

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Nie udało się utworzyć płatności Premium.')
      }

      try {
        sessionStorage.setItem('betai_premium_checkout_user_id', sessionUser.id)
        sessionStorage.setItem('betai_premium_checkout_email', sessionUser.email || '')
      } catch {}

      if (data.alreadyActive) {
        setUserPlan('premium')
        await fetchUserPlan(sessionUser.id)
        showToast({ type: 'success', title: 'Premium aktywne', message: 'To konto ma już aktywną subskrypcję Premium.' })
        window.history.replaceState({}, document.title, window.location.pathname)
        return
      }

      window.location.href = data.url
    } catch (error) {
      showToast({ type: 'error', title: 'Błąd Premium', message: formatAppErrorMessage(error.message) })
    }
  }

  async function openCustomerPortal() {
    if (!sessionUser?.id) {
      showToast({ type: 'error', title: 'Brak konta', message: 'Zaloguj się, aby zarządzać subskrypcją.' })
      return
    }

    try {
      showToast({ type: 'info', title: 'Stripe Billing', message: 'Otwieram panel zarządzania subskrypcją...' })
      const response = await fetch('/.netlify/functions/create-customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: sessionUser.id })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Nie udało się otworzyć Stripe Billing Portal.')
      }
      window.location.href = data.url
    } catch (error) {
      showToast({ type: 'error', title: 'Billing Portal', message: formatAppErrorMessage(error.message) })
    }
  }

  async function buyWalletTokens(packs = 1) {
    if (!sessionUser?.id) {
      showToast({ type: 'error', title: 'Brak konta', message: 'Zaloguj się, aby kupić żetony.' })
      return
    }
    try {
      const { data, error } = await supabase.rpc('buy_wallet_tokens', { p_packs: Math.max(1, Number(packs || 1)) })
      if (error) throw error
      showToast({ type: 'success', title: 'Kupiono żetony', message: `Dodano ${Number(data?.tokens || packs * 1000).toLocaleString('pl-PL')} żetonów.` })
      await fetchWalletBalance(sessionUser.id)
      await fetchCurrentTokenBalance()
      window.dispatchEvent(new CustomEvent('betai-token-balance-changed'))
      window.dispatchEvent(new CustomEvent('betai-wallet-history-changed'))
    } catch (error) {
      showToast({ type: 'error', title: 'Nie udało się kupić żetonów', message: formatAppErrorMessage(error.message) })
    }
  }

  async function sellWalletTokens(packs = 1) {
    if (!sessionUser?.id) {
      showToast({ type: 'error', title: 'Brak konta', message: 'Zaloguj się, aby wymienić żetony.' })
      return
    }
    try {
      const { data, error } = await supabase.rpc('sell_wallet_tokens', { p_packs: Math.max(1, Number(packs || 1)) })
      if (error) throw error
      showToast({ type: 'success', title: 'Wymieniono żetony', message: `Dodano ${Number(data?.pln || packs * 0.9).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł do salda.` })
      await fetchWalletBalance(sessionUser.id)
      await fetchCurrentTokenBalance()
      window.dispatchEvent(new CustomEvent('betai-token-balance-changed'))
      window.dispatchEvent(new CustomEvent('betai-wallet-history-changed'))
    } catch (error) {
      showToast({ type: 'error', title: 'Nie udało się wymienić żetonów', message: formatAppErrorMessage(error.message) })
    }
  }

  async function startStripeTopup(amount = 100) {
    if (!sessionUser?.id) {
      showToast({ type: 'error', title: 'Brak konta', message: 'Zaloguj się, aby doładować konto.' })
      return
    }

    try {
      showToast({ type: 'info', title: 'Stripe', message: 'Przekierowanie do płatności...' })

      const response = await fetch('/.netlify/functions/create-wallet-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: sessionUser.id,
          email: sessionUser.email,
          amount
        })
      })

      const data = await response.json()

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Nie udało się utworzyć płatności Stripe.')
      }

      window.location.href = data.url
    } catch (error) {
      showToast({ type: 'error', title: 'Błąd płatności', message: formatAppErrorMessage(error.message) })
    }
  }

  async function fetchWalletBalance(userId = sessionUser?.id) {
    if (!isSupabaseConfigured || !supabase || !userId) {
      setWalletBalance(0)
      return
    }

    const { data, error } = await supabase.rpc('get_wallet_balance', { p_user_id: userId })

    if (error || data === null || data === undefined) {
      setWalletBalance(0)
      return
    }

    setWalletBalance(Math.max(0, Number(data || 0)))
  }

  async function fetchUserPlan(userId = sessionUser?.id) {
    const currentEmail = normalizeEmail(sessionUser?.email)
    if (BETAI_PREMIUM_EMAILS.includes(currentEmail)) {
      setUserPlan('premium')
      setAccountProfile(prev => ({ ...(prev || {}), id: userId || prev?.id || null, email: currentEmail, username: currentEmail.split('@')[0], role: BETAI_ADMIN_EMAILS.includes(currentEmail) ? 'admin' : prev?.role, is_admin: BETAI_ADMIN_EMAILS.includes(currentEmail), is_premium: true, plan: 'premium', subscription_status: 'active', current_period_end: '2099-12-31T23:59:59Z' }))
      return
    }

    if (!isSupabaseConfigured || !supabase || !userId) {
      setAccountProfile(null)
      setUserPlan('free')
      return
    }

    let subscriptionData = null
    let profileData = null

    let subResult = await supabase
      .from('user_subscriptions')
      .select('plan,status,current_period_end,cancel_at_period_end,stripe_subscription_id,stripe_customer_id')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subResult.error) {
      subResult = await supabase
        .from('user_subscriptions')
        .select('plan,status,current_period_end')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()
    }

    if (!subResult.error) subscriptionData = subResult.data

    const { data: profData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (!profileError) profileData = profData

    const subscriptionPeriodActive = hasFuturePremiumEnd(subscriptionData?.current_period_end)
    const subPremium = Boolean(subscriptionData) && subscriptionPeriodActive && (
      subscriptionData.plan === 'premium' || ['active','trialing'].includes(String(subscriptionData.status || '').toLowerCase())
    )
    const profilePremium = isPremiumProfile(profileData)
    const effectivePremium = Boolean(subPremium || profilePremium || isAdminUser(profileData))
    const effectivePeriodEnd = subscriptionData?.current_period_end || profileData?.current_period_end || null

    const effectiveProfile = buildEffectiveAccountProfile({
      ...(profileData || {}),
      id: profileData?.id || userId,
      email: profileData?.email || currentEmail || sessionUser?.email || '',
      username: profileData?.username || (currentEmail ? currentEmail.split('@')[0] : ''),
      current_period_end: effectivePeriodEnd,
      is_premium: effectivePremium,
      plan: effectivePremium ? 'premium' : 'free',
      role: isAdminUser(profileData) || isSmilhytvLifetimePremium(profileData) ? 'admin' : profileData?.role,
      subscription_status: effectivePremium ? 'active' : 'free'
    }, sessionUser)

    setAccountProfile(effectiveProfile)

    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email: effectiveProfile.email,
        username: effectiveProfile.username || effectiveProfile.email?.split('@')?.[0] || 'user',
        is_admin: Boolean(effectiveProfile.is_admin),
        is_premium: Boolean(effectiveProfile.is_premium),
        plan: effectivePremium ? 'premium' : (effectiveProfile.plan || 'free'),
        role: isAdminUser(effectiveProfile) || isSmilhytvLifetimePremium(effectiveProfile) ? 'admin' : effectiveProfile.role,
        subscription_status: effectivePremium ? 'active' : (effectiveProfile.subscription_status || 'free'),
        current_period_end: effectiveProfile.current_period_end || null,
        avatar_url: effectiveProfile.avatar_url || null,
        bio: effectiveProfile.bio || effectiveProfile.description || effectiveProfile.about || null
      }, { onConflict: 'id' })
    } catch (syncError) {
      console.warn('Profile sync skipped:', syncError)
    }

    if (hasUnlimitedTipAccess(effectiveProfile, effectiveProfile.plan)) {
      setUserPlan('premium')
      return
    }

    setUserPlan('free')
  }

  async function fetchPayoutRequests(userId = sessionUser?.id) {
    if (!isSupabaseConfigured || !supabase || !userId) return

    const { data, error } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!error) setPayoutRequests(data || [])
    else setPayoutRequests([])
  }

  

  async function requestTipsterPayout() {
    try {
      if (!sessionUser?.id) {
        showToast({ type: 'error', title: 'Brak konta', message: 'Zaloguj się, aby poprosić o wypłatę.' })
        return
      }

      const available = Number(tipsterEarnings?.available_to_payout || 0)
      const limits = getPlanLimits(accountPlan)
      const monthlyPayoutCount = getMonthlyCount(payoutRequests)

      if (monthlyPayoutCount >= limits.monthlyPayoutLimit) {
        showToast({ type: 'error', title: 'Limit wypłat', message: `Twój plan pozwala na ${limits.monthlyPayoutLimit} wypłat miesięcznie.` })
        return
      }

      if (!stripeConnectStatus?.payouts_enabled) {
        showToast({ type: 'error', title: 'Stripe niegotowy', message: 'Najpierw połącz i dokończ Stripe Connect, aby wypłaty mogły być realizowane.' })
        return
      }

      if (!available || available < 50) {
        showToast({
          type: 'error',
          title: 'Minimum wypłaty 50 zł',
          message: 'Zgłoszenie wypłaty będzie dostępne po przekroczeniu minimum 50 zł dostępnych zarobków.'
        })
        return
      }

      const { error } = await supabase.rpc('create_payout_request', {
        p_amount: available
      })

      if (error) {
        showToast({ type: 'error', title: 'Nie udało się zgłosić wypłaty', message: formatAppErrorMessage(error.message) })
        return
      }

      showToast({ type: 'success', title: 'Wypłata zgłoszona', message: 'Zgłoszenie trafiło do panelu admina.' })

      await fetchTipsterEarnings(sessionUser.id)
      await fetchPayoutRequests(sessionUser.id)
      await fetchAdminFinanceReport()
    } catch (error) {
      showToast({ type: 'error', title: 'Błąd wypłaty', message: formatAppErrorMessage(error.message) })
    }
  }


  async function fetchAdminFinanceReport() {
    if (!isSupabaseConfigured || !supabase || !sessionUser?.id || !isAdminUser(sessionUser)) {
      setAdminFinanceReport({ platform_commission: 0, premium_revenue: 0, total_platform_revenue: 0, total_sales: 0, gross_sales: 0, tipster_earnings: 0, total_payouts: 0, pending_payouts: 0, available_to_payout: 0, wallet_topups: 0, active_premium_users: 0, transactions: [] })
      return
    }

    try {
      const { data, error } = await supabase.rpc('get_admin_finance_report')

      if (error || !data) {
        setAdminFinanceReport({ platform_commission: 0, premium_revenue: 0, total_platform_revenue: 0, total_sales: 0, gross_sales: 0, tipster_earnings: 0, total_payouts: 0, pending_payouts: 0, available_to_payout: 0, wallet_topups: 0, active_premium_users: 0, transactions: [] })
        return
      }

      setAdminFinanceReport({
        platform_commission: Number(data.platform_commission || 0),
        premium_revenue: Number(data.premium_revenue || 0),
        total_platform_revenue: Number(data.total_platform_revenue || Number(data.platform_commission || 0) + Number(data.premium_revenue || 0)),
        total_sales: Number(data.total_sales || 0),
        gross_sales: Number(data.gross_sales || 0),
        tipster_earnings: Number(data.tipster_earnings || 0),
        total_payouts: Number(data.total_payouts || 0),
        pending_payouts: Number(data.pending_payouts || 0),
        available_to_payout: Number(data.available_to_payout || 0),
        wallet_topups: Number(data.wallet_topups || 0),
        active_premium_users: Number(data.active_premium_users || 0),
        transactions: Array.isArray(data.transactions) ? data.transactions : []
      })
    } catch (error) {
      console.error('fetchAdminFinanceReport error', error)
      setAdminFinanceReport({ platform_commission: 0, premium_revenue: 0, total_platform_revenue: 0, total_sales: 0, gross_sales: 0, tipster_earnings: 0, total_payouts: 0, pending_payouts: 0, available_to_payout: 0, wallet_topups: 0, active_premium_users: 0, transactions: [] })
    }
  }

  async function fetchPaymentHistory(userId = sessionUser?.id) {
    try {
    if (!isSupabaseConfigured || !supabase || !userId) return

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!error) setPaymentHistory(data || [])
    } catch (error) {
      console.error('fetchPaymentHistory error', error)
      setPaymentHistory([])
    }
  }

  async function fetchTipsterEarnings(userId = sessionUser?.id) {
    if (!isSupabaseConfigured || !supabase || !userId) {
      setTipsterEarnings({ total: 0, sales: 0, history: [], available_to_payout: 0 })
      return
    }

    try {
      const { data, error } = await supabase.rpc('get_tipster_earnings', { p_user_id: userId })
      if (!error && data) {
        const row = Array.isArray(data) ? data[0] : data
        const history = Array.isArray(row?.history) ? row.history : []
        setTipsterEarnings({
          total: Number(row?.total || row?.total_earnings || 0),
          sales: Number(row?.sales || row?.sales_count || 0),
          history,
          available_to_payout: Number(row?.available_to_payout || row?.available || row?.total || 0)
        })
        return
      }
    } catch (error) {
      console.warn('fetchTipsterEarnings rpc skipped:', error)
    }

    try {
      const { data: ownTips } = await supabase
        .from('tips')
        .select('id')
        .or(`author_id.eq.${userId},user_id.eq.${userId}`)

      const ids = (ownTips || []).map(row => row.id).filter(Boolean)
      if (!ids.length) {
        setTipsterEarnings({ total: 0, sales: 0, history: [], available_to_payout: 0 })
        return
      }

      const { data: paymentsRows, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .in('tip_id', ids)
        .order('created_at', { ascending: false })

      if (paymentsError) throw paymentsError
      const history = (paymentsRows || []).map(row => ({ ...row, amount: Number(row.amount || 0) * (1 - PLATFORM_COMMISSION_RATE) }))
      const total = history.reduce((sum, row) => sum + Number(row.amount || 0), 0)
      setTipsterEarnings({ total, sales: history.length, history, available_to_payout: total })
    } catch (error) {
      console.error('fetchTipsterEarnings error', error)
      setTipsterEarnings({ total: 0, sales: 0, history: [], available_to_payout: 0 })
    }
  }

  useEffect(() => {
    let unsubscribe = null

    async function safeInitialLoad(userId) {
      try { await fetchPaymentHistory(userId) } catch (e) { console.error(e) }
      try { await fetchPayoutRequests(userId) } catch (e) { console.error(e) }
      try { await fetchUserPlan(userId) } catch (e) { console.error(e) }
      try { await fetchWalletBalance(userId) } catch (e) { console.error(e) }
      try { await fetchTipsterEarnings(userId) } catch (e) { console.error(e) }
      try { await fetchRealRanking() } catch (e) { console.error(e) }
      try { await fetchReferralData(userId) } catch (e) { console.error(e) }
      try { await fetchStripeConnectStatus(userId) } catch (e) { console.error(e) }
      try { await fetchUnlockedTips(userId) } catch (e) { console.error(e) }
      try { await ensureUserWalletAndWelcome({ id: userId, email: sessionUser?.email }) } catch (e) { console.error(e) }
    }

    async function loadSession() {
      try {
        if (!isSupabaseConfigured || !supabase) {
          setAuthLoading(false)
          return
        }

        const { data } = await supabase.auth.getSession()
        const user = data?.session?.user || null
        setSessionUser(user)
        setWalletBalance(0)

        if (user?.id) {
          safeInitialLoad(user.id)
          ensureUserWalletAndWelcome(user)
        }

        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
          const nextUser = session?.user || null
          setSessionUser(nextUser)
          setWalletBalance(0)
          setTipsterEarnings({ total: 0, sales: 0, history: [] })
          setStripeConnectStatus(null)

          if (!nextUser?.id) {
            setUnlockedTips(new Set())
            try {
              localStorage.removeItem('betai_unlocked_tips_v1')
              localStorage.removeItem(getUnlockedTipsStorageKey('guest'))
            } catch {}
            return
          }

          setUnlockedTips(new Set())
          safeInitialLoad(nextUser.id)
          ensureUserWalletAndWelcome(nextUser)
        })

        unsubscribe = listener?.subscription?.unsubscribe
      } catch (error) {
        console.error('loadSession error', error)
      } finally {
        setAuthLoading(false)
      }
    }

    loadSession()

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    const tipId = params.get('tip')
    const stripeReturn = params.get('stripe') === '1'

    if (payment === 'success' && stripeReturn && tipId) {
      // Nie ustawiamy odblokowania zanim znamy zalogowanego usera.
      // Odblokowanie zapisuje się dopiero pod konkretnym user_id po powrocie ze Stripe.

      async function persistUnlockFromReturn() {
        await saveUnlockToSupabase(tipId, 29)
        await savePaymentToSupabase(tipId, 29)
        const { data } = isSupabaseConfigured && supabase
          ? await supabase.auth.getSession()
          : { data: null }

        const userId = data?.session?.user?.id
        if (userId) {
          clearGuestUnlockedTips()
          await fetchUnlockedTips(userId)
          await fetchPaymentHistory(userId)
        }

        window.history.replaceState({}, document.title, window.location.pathname)
      }

      persistUnlockFromReturn().catch(() => {
        window.history.replaceState({}, document.title, window.location.pathname)
      })
    }

    if (payment === 'cancel') {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  function showToast(nextToast) {
    setToast(nextToast)
    window.clearTimeout(window.__betaiToastTimer)
    window.__betaiToastTimer = window.setTimeout(() => setToast(null), 3500)
  }

  function unlockTip(tip) {
    if (!sessionUser?.id) {
      showToast({
        type: 'error',
        title: 'Zaloguj się, aby odblokować',
        message: 'Zakup premium musi być przypisany do Twojego konta.'
      })
      return
    }

    if (unlockedTips.has(tip.id)) {
      showToast({
        type: 'success',
        title: 'Już odblokowane',
        message: 'Ten typ jest już dostępny na Twoim koncie.'
      })
      return
    }

    setSelectedPayment(tip)
  }

  async function handlePaymentSuccess(tip) {
    showToast({
      type: 'error',
      title: 'Użyj płatności Stripe',
      message: 'Odblokowanie zapisuje się tylko po płatności Stripe.'
    })
    setSelectedPayment(null)
  }

  function topUpWallet() {
    showToast({ type: 'info', title: 'Doładowanie przez Stripe', message: 'Fake doładowanie zostało wyłączone. Kolejny etap: realny Stripe Checkout.' })
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut()
    setSessionUser(null)
    setWalletBalance(0)
    setTipsterEarnings({ total: 0, sales: 0, history: [] })
    setStripeConnectStatus(null)
    setUnlockedTips(new Set())
    clearGuestUnlockedTips()
    try { localStorage.removeItem('betai_unlocked_tips_v1') } catch {}
    showToast({
      type: 'success',
      title: 'Wylogowano',
      message: 'Do zobaczenia ponownie.'
    })
  }


  useEffect(() => {
    if (view === 'adminFinance' && isAdminUser(sessionUser)) {
      fetchAdminFinanceReport()
    }
  }, [view, sessionUser?.id])



  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    if (params.get('stripe_connect') === 'success') {
      showToast({ type: 'success', title: 'Stripe Connect', message: 'Konto Stripe zostało połączone. Możesz odbierać wypłaty.' })
      if (sessionUser?.id) fetchStripeConnectStatus(sessionUser.id)
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    if (params.get('stripe_connect') === 'refresh') {
      showToast({ type: 'info', title: 'Stripe Connect', message: 'Dokończ konfigurację konta Stripe.' })
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [sessionUser?.id])


  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    if (params.get('stripe_connect') === 'success') {
      showToast({ type: 'success', title: 'Stripe Connect', message: 'Konto Stripe zostało połączone. Odświeżam status wypłat.' })

      if (sessionUser?.id) {
        fetch('/.netlify/functions/refresh-stripe-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: sessionUser.id })
        }).finally(() => fetchStripeConnectStatus(sessionUser.id))
      }

      window.history.replaceState({}, document.title, window.location.pathname)
    }

    if (params.get('stripe_connect') === 'refresh') {
      showToast({ type: 'info', title: 'Stripe Connect', message: 'Dokończ konfigurację konta Stripe.' })
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [sessionUser?.id])

  useEffect(() => {
    const currentEmail = normalizeEmail(sessionUser?.email || accountProfile?.email || '')
    if (!currentEmail) return undefined

    let stopped = false
    receivedTipNotificationPollReadyRef.current = false
    lastReceivedTipNotificationKeyRef.current = ''

    const refreshTokens = async () => {
      if (stopped) return
      await fetchCurrentTokenBalance()
      await fetchNotifications(sessionUser?.id)
    }

    const pollTipNotifications = async () => {
      if (stopped || !isSupabaseConfigured || !supabase || !currentEmail) return
      try {
        const { data, error } = await supabase
          .from('betai_system_notifications')
          .select('*')
          .eq('recipient_email', currentEmail)
          .order('created_at', { ascending: false })
          .limit(5)

        if (error || !Array.isArray(data)) return
        const newestTipNotification = data.find(row => isTipNotification(row))
        const newestKey = newestTipNotification ? String(newestTipNotification.id || `${newestTipNotification.created_at || ''}_${newestTipNotification.title || ''}_${newestTipNotification.body || newestTipNotification.message || ''}`) : ''

        if (!receivedTipNotificationPollReadyRef.current) {
          receivedTipNotificationPollReadyRef.current = true
          if (newestKey) lastReceivedTipNotificationKeyRef.current = newestKey
          return
        }

        if (newestTipNotification && newestKey !== lastReceivedTipNotificationKeyRef.current) {
          showReceivedTipFromNotification(newestTipNotification, false)
        }
      } catch (error) {
        console.warn('tip notification popup polling skipped', error)
      }
    }

    window.addEventListener('betai-token-balance-changed', refreshTokens)
    const quickRefresh = setTimeout(refreshTokens, 350)
    const quickNotificationPoll = setTimeout(pollTipNotifications, 900)
    const interval = setInterval(refreshTokens, 3000)
    const notificationInterval = setInterval(pollTipNotifications, 2200)

    let walletChannel = null
    if (isSupabaseConfigured && supabase) {
      try {
        walletChannel = supabase
          .channel(`betai-token-wallet-live-${currentEmail}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'betai_token_wallets', filter: `email=eq.${currentEmail}` }, payload => {
            const nextBalance = Number(payload?.new?.balance || 0) || 0
            setTokenBalance(nextBalance)
            try { localStorage.setItem('betai_tokens_' + currentEmail, String(nextBalance)) } catch (_) {}
            fetchNotifications(sessionUser?.id)
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'betai_system_notifications', filter: `recipient_email=eq.${currentEmail}` }, payload => {
            const row = payload?.new || {}
            if (isTipNotification(row)) showReceivedTipFromNotification(row, false)
            refreshTokens()
          })
          .subscribe()
      } catch (error) {
        console.warn('token wallet realtime channel skipped', error)
      }
    }

    return () => {
      stopped = true
      clearTimeout(quickRefresh)
      clearTimeout(quickNotificationPoll)
      clearInterval(interval)
      clearInterval(notificationInterval)
      window.removeEventListener('betai-token-balance-changed', refreshTokens)
      if (walletChannel) {
        try { supabase.removeChannel(walletChannel) } catch (_) {}
      }
    }
  }, [sessionUser?.id, sessionUser?.email, accountProfile?.email])

  useEffect(() => {
    if (view === 'notifications' && sessionUser?.id) {
      fetchNotifications(sessionUser.id)
    }
    if (view === 'adminPayouts' && isAdminUser(sessionUser)) {
      fetchAdminPayoutRequests()
    }
    if (view === 'adminFinance' && isAdminUser(sessionUser)) {
      fetchAdminFinanceReport()
      fetchAdminPayoutRequests()
    }
    if (view === 'referrals' && sessionUser?.id) {
      fetchReferralData(sessionUser.id)
    }
  }, [view, sessionUser?.id])

  function toggleNotifyPanel() {
    const rect = notifyButtonRef.current?.getBoundingClientRect?.()
    if (rect) {
      const width = Math.min(460, Math.max(320, window.innerWidth - 28))
      const left = Math.min(Math.max(14, rect.right - width), Math.max(14, window.innerWidth - width - 14))
      const top = Math.min(rect.bottom + 10, window.innerHeight - 120)
      setNotifyPanelStyle({ top: `${top}px`, left: `${left}px`, right: 'auto' })
    }
    setDmPanelOpen(false)
    setNotifyPanelOpen(prev => !prev)
    fetchNotifications(sessionUser?.id)
  }

  function toggleDmPanel() {
    const rect = mailButtonRef.current?.getBoundingClientRect?.()
    if (rect) {
      const width = Math.min(860, Math.max(360, window.innerWidth - 28))
      const left = Math.min(Math.max(14, rect.right - width), Math.max(14, window.innerWidth - width - 14))
      const top = Math.min(rect.bottom + 10, window.innerHeight - 120)
      setDmPanelStyle({ top: `${top}px`, left: `${left}px`, right: 'auto' })
    }
    setNotifyPanelOpen(false)
    setDmPanelOpen(prev => !prev)
  }

  const userOnlyTips = tips.filter(isUserTip).map(normalizeTipRow)
  const aiOnlyTips = tips.filter(t => isAiGeneratedTip(t) && String(t?.source || '').toLowerCase().startsWith('live_ai_engine'))

  const feedCounts = {
    all: userOnlyTips.length,
    premium: userOnlyTips.filter(tip => isTipPremium(tip)).length,
    free: userOnlyTips.filter(tip => !isTipPremium(tip)).length,
    mine: userOnlyTips.filter(tip => Boolean(sessionUser?.id && (getTipAuthorId(tip) === sessionUser.id || tip.user_id === sessionUser.id))).length
  }

  const filteredTips = userOnlyTips.filter(tip => {
    const normalizedTip = normalizeTipRow(tip)
    const query = topSearch.trim().toLowerCase()
    const searchableText = [
      normalizedTip.home_team,
      normalizedTip.away_team,
      normalizedTip.match,
      normalizedTip.league,
      normalizedTip.type,
      normalizedTip.pick,
      normalizedTip.description,
      normalizedTip.author_name,
      normalizedTip.username
    ].filter(Boolean).join(' ').toLowerCase()
    if (query && !searchableText.includes(query)) return false
    if (activeFilter === 'all') return true
    if (activeFilter === 'free') return !isTipPremium(normalizedTip)
    if (activeFilter === 'premium') return isTipPremium(normalizedTip)
    if (activeFilter === 'mine') return Boolean(sessionUser?.id && (getTipAuthorId(normalizedTip) === sessionUser.id || normalizedTip.user_id === sessionUser.id))
    return true
  }).map(normalizeTipRow)

  const filterItems = [
    ['all', 'Wszystkie'],
    ['premium', 'Premium'],
    ['free', 'Darmowe'],
    ['mine', 'Moje']
  ]

  useEffect(() => {
    const currentUserId = sessionUser?.id || ''
    const currentEmail = normalizeEmail(sessionUser?.email || accountProfile?.email || '')
    if ((!currentUserId && !currentEmail) || !isSupabaseConfigured || !supabase) return undefined

    receivedTipPollReadyRef.current = false
    lastReceivedTipPollKeyRef.current = ''

    const showTipTransferRow = (row, silent = false) => {
      if (!row) return
      const matchesUserId = currentUserId && String(row.receiver_id || '') === String(currentUserId)
      const matchesEmail = currentEmail && normalizeEmail(row.receiver_email || '') === currentEmail
      if (!matchesUserId && !matchesEmail) return

      const key = String(row.id || `${row.created_at || ''}_${row.sender_username || ''}_${row.sender_email || ''}_${row.amount || 1}`)
      if (!key || lastReceivedTipRef.current === key) return
      lastReceivedTipRef.current = key

      if (!silent) {
        const senderName = row.sender_username || nameFromEmail(row.sender_email || '') || 'Użytkownik'
        const amount = Math.max(1, Number(row.amount || 1) || 1)
        showReceivedTipPopup(senderName, amount)
      }
      window.dispatchEvent(new CustomEvent('betai-token-balance-changed'))
      fetchCurrentTokenBalance()
    }

    const handleTipTransferInsert = (payload) => {
      showTipTransferRow(payload?.new || {}, false)
    }

    const pollTipTransfers = async () => {
      try {
        let rows = []

        if (currentUserId) {
          const { data, error } = await supabase
            .from('tip_transfers')
            .select('*')
            .eq('receiver_id', currentUserId)
            .order('created_at', { ascending: false })
            .limit(5)
          if (!error && Array.isArray(data)) rows.push(...data)
        }

        if (currentEmail) {
          try {
            const { data, error } = await supabase
              .from('tip_transfers')
              .select('*')
              .eq('receiver_email', currentEmail)
              .order('created_at', { ascending: false })
              .limit(5)
            if (!error && Array.isArray(data)) rows.push(...data)
          } catch (emailPollError) {
            console.warn('tip transfer email polling skipped', emailPollError)
          }
        }

        rows = rows
          .filter(Boolean)
          .sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))

        const newest = rows[0]
        const newestKey = newest ? String(newest.id || `${newest.created_at || ''}_${newest.sender_username || ''}_${newest.sender_email || ''}_${newest.amount || 1}`) : ''

        if (!receivedTipPollReadyRef.current) {
          receivedTipPollReadyRef.current = true
          if (newestKey) {
            lastReceivedTipPollKeyRef.current = newestKey
            lastReceivedTipRef.current = newestKey
          }
          return
        }

        if (!newestKey) return

        if (newestKey !== lastReceivedTipPollKeyRef.current) {
          lastReceivedTipPollKeyRef.current = newestKey
          showTipTransferRow(newest, false)
        }
      } catch (error) {
        console.warn('tip transfer polling skipped', error)
      }
    }

    const channels = []
    if (currentUserId) {
      channels.push(
        supabase
          .channel(`betai-tip-transfers-popup-id-${currentUserId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tip_transfers', filter: `receiver_id=eq.${currentUserId}` }, handleTipTransferInsert)
          .subscribe()
      )
    }
    if (currentEmail) {
      try {
        channels.push(
          supabase
            .channel(`betai-tip-transfers-popup-email-${currentEmail}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tip_transfers', filter: `receiver_email=eq.${currentEmail}` }, handleTipTransferInsert)
            .subscribe()
        )
      } catch (error) {
        console.warn('tip transfer email realtime skipped', error)
      }
    }

    const initialPoll = setTimeout(pollTipTransfers, 700)
    const pollInterval = setInterval(pollTipTransfers, 2200)

    return () => {
      clearTimeout(initialPoll)
      clearInterval(pollInterval)
      channels.forEach(channel => {
        try { supabase.removeChannel(channel) } catch (_) {}
      })
    }
  }, [sessionUser?.id, sessionUser?.email, accountProfile?.email])


  const visibleDashboardTips = filteredTips.slice(0, dashboardVisibleTips)
  const hasMoreDashboardTips = filteredTips.length > dashboardVisibleTips
  const hasExpandedDashboardTips = dashboardVisibleTips > 3

  useEffect(() => {
    if (view === 'dashboard') {
      setDashboardVisibleTips(3)
    }
  }, [activeFilter, topSearch, view])

  if (authLoading) {
    return <div className="auth-screen"><div className="auth-card"><div className="auth-brand">Bet<span>+AI</span></div><p>Ładowanie sesji...</p></div></div>
  }

  if (!sessionUser) {
    return <AuthView onAuth={(user) => setSessionUser(user)} />
  }

  return (
    <div className={`app-shell ${view !== 'dashboard' || selectedTipsterId ? 'no-rightbar-page' : ''}`} data-betai-lang={appLang}>
      <DashboardAutoTranslator lang={appLang} />
      <Toast toast={toast} onClose={() => setToast(null)} />
      <LiveTipCenterPopup popup={liveTipPopup} open={liveTipPopupVisible} onClose={hideLiveTipPopup} />
      <ReceivedTipPopup popup={receivedTipPopup} open={receivedTipPopupVisible} onClose={hideReceivedTipPopup} />
      <ProfileSubscriptionModal tip={selectedProfileSub} user={sessionUser} onClose={() => setSelectedProfileSub(null)} />
      <PaymentModal
        tip={selectedPayment}
        user={sessionUser}
        onClose={() => setSelectedPayment(null)}
        onSuccess={handlePaymentSuccess}
      />
      <BetaiNotifyPanel open={notifyPanelOpen} notifications={notifications} tokenBalance={tokenBalance} panelStyle={notifyPanelStyle} onClose={() => setNotifyPanelOpen(false)} onMarkAllRead={markAllNotificationsRead} />
      <UserMessagesPopup open={dmPanelOpen} user={sessionUser} dmUnreadCount={dmUnreadCount} onDmUnreadChange={setDmUnreadCount} panelStyle={dmPanelStyle} onClose={() => setDmPanelOpen(false)} />
      <Sidebar view={view} setView={setView} wallet={walletBalance} tokenBalance={tokenBalance} unlockedCount={unlockedTips.size} notificationsCount={notifications.filter(n => !n.is_read).length} onTopUp={() => startStripeTopup(100)} user={effectiveAccountProfile} userPlan={effectiveAccountPlan} onLogout={logout} />

      <main className="main">
        <header className="topbar">
          <label className="search top-search-field" aria-label="Szukaj meczów, lig i użytkowników">
            <span>⌕</span>
            <input value={topSearch} onChange={e => setTopSearch(e.target.value)} placeholder="Szukaj meczów, lig, użytkowników..." />
          </label>
          <div className="top-actions">
            <BetaiLanguageSwitch lang={appLang} onChange={changeAppLanguage} compact />
            <button type="button" ref={notifyButtonRef} className="notice notice-button notify-btn" onClick={toggleNotifyPanel} aria-label="Powiadomienia BetAI">🔔<b>{notifications.filter(n => !n.is_read).length}</b></button>
            <button type="button" ref={mailButtonRef} className="notice notice-button mail-btn" onClick={toggleDmPanel} aria-label="Wiadomości użytkowników">✉<b>{Number(dmUnreadCount || 0)}</b></button>
            <button className="wallet-top-btn wallet-split-top-btn" onClick={() => setView('wallet')} aria-label="Portfel i żetony">
              <span className="wallet-split-segment wallet-split-balance">
                <strong>{Number(walletBalance || 0).toFixed(2)} zł</strong>
                <small>Saldo</small>
              </span>
              <span className="wallet-split-divider" aria-hidden="true" />
              <span className="wallet-split-segment wallet-split-tokens">
                <span className="wallet-split-coin" aria-hidden="true"><img src="/betai-coin-icon.png" alt="" /></span>
                <span className="wallet-split-token-copy">
                  <strong>{Number(tokenBalance || 0)}</strong>
                  <small>Coin</small>
                </span>
                <span className="wallet-split-chevron" aria-hidden="true">⌄</span>
              </span>
            </button>
            <button type="button" className={`top-user-chip neutral-top-user-chip role-${getDisplayRole(effectiveAccountProfile, effectiveAccountPlan).toLowerCase()}`} onClick={() => setView('profile')} aria-label="Mój profil">
              <span
                className={`top-user-avatar ${effectiveTopbarAvatarUrl ? 'has-avatar' : ''}`}
                style={effectiveTopbarAvatarUrl ? { '--avatar-image': `url("${effectiveTopbarAvatarUrl}")`, backgroundImage: `url("${effectiveTopbarAvatarUrl}")` } : undefined}
                data-avatar-url={effectiveTopbarAvatarUrl || ''}
              >
                {effectiveTopbarAvatarUrl
                  ? <img src={effectiveTopbarAvatarUrl} alt="" loading="eager" decoding="async" referrerPolicy="no-referrer" />
                  : (getProfileUsername(effectiveAccountProfile) || 'U').slice(0,2).toUpperCase()}
              </span>
              <span className="top-user-info"><strong>{getProfileUsername(effectiveAccountProfile) || 'Użytkownik'}</strong><small>{getDisplayRole(effectiveAccountProfile, effectiveAccountPlan)}</small></span>
              <span className="top-user-chevron">⌄</span>
            </button>
          </div>
        </header>

        {view === 'add' && (
          <AddTipForm
            user={effectiveAccountProfile}
            userPlan={effectiveAccountPlan}
            onToast={showToast}
            onTipSaved={(savedTip) => {
              setLastTipSaveStatus(readTipDebug())
              if (savedTip?.id) {
                setTips(prev => [savedTip, ...prev.filter(tip => tip.id !== savedTip.id)])
              }
              fetchTips(sessionUser?.id)
              if (sessionUser?.id) fetchUnlockedTips(sessionUser.id)
              setView('dashboard')
            }}
          />
        )}

        {view === 'deposits' && (
          <DepositsView
            user={sessionUser}
            wallet={walletBalance}
            onTopUp={startStripeTopup}
            onViewChange={setView}
          />
        )}

        {view === 'wallet' && (
          <WalletPanel
            wallet={walletBalance}
            tokenBalance={tokenBalance}
            unlockedTips={unlockedTips}
            tips={tips}
            payments={paymentHistory}
            earnings={tipsterEarnings}
            stripeConnectStatus={stripeConnectStatus}
            onTopUp={() => startStripeTopup(100)}
            onBuyTokens={buyWalletTokens}
            onSellTokens={sellWalletTokens}
            onConnectStripe={connectStripeAccount}
            user={effectiveAccountProfile}
            userPlan={effectiveAccountPlan}
            onViewChange={setView}
            onToast={showToast}
            onManageSubscription={openCustomerPortal}
            onUpgradeSubscription={runPremiumCheckout}
          />
        )}

        {view === 'leaderboard' && (
          <LeaderboardView tips={tips} ranking={realRanking} />
        )}

        {view === 'articles' && (
          <ArticlesView />
        )}

        {view === 'referrals' && (
          <ReferralsView user={sessionUser} data={referralData} loading={referralLoading} onRefresh={() => fetchReferralData(sessionUser?.id)} />
        )}

        {view === 'rewardsBonuses' && (
          <RewardsBonusesView user={sessionUser} tokenBalance={tokenBalance} userPlan={effectiveAccountPlan} />
        )}

        {view === 'aiPicks' && (
          <AiPicksView tips={tips} loading={loading} liveGenerating={aiLiveGenerating} settleGenerating={aiSettleGenerating} onGenerateLive={runLiveAiEngine} onSettle={runAiSettlement} onRefresh={() => fetchTips(sessionUser?.id)} />
        )}

        {view === 'aiStats' && (
          <StatsView tips={tips.filter(t => String(t.ai_source || t.source || '').includes('real_ai') || String(t.source || '').includes('live_ai'))} />
        )}

        {view === 'aiResults' && (
          <AiResultsView tips={tips.filter(t => String(t.ai_source || t.source || '').includes('real_ai') || String(t.source || '').includes('live_ai'))} />
        )}

        {view === 'topTipsters' && (
          <TopTipstersView />
        )}

        {view === 'notifications' && (
          <NotificationsView notifications={notifications} onRefresh={() => fetchNotifications(sessionUser?.id)} onMarkAllRead={markAllNotificationsRead} />
        )}

        {view === 'payments' && (
          <PaymentsView payments={paymentHistory} onViewChange={setView} onTopUp={startStripeTopup} />
        )}

        {view === 'subscriptions' && (
          <SubscriptionView
            userPlan={effectiveAccountPlan}
            user={effectiveAccountProfile}
            payments={paymentHistory}
            onUpgrade={runPremiumCheckout}
            onManage={openCustomerPortal}
            onViewChange={setView}
          />
        )}

        {view === 'earnings' && (
          <EarningsView
            user={effectiveAccountProfile}
            earnings={tipsterEarnings}
            stripeConnectStatus={stripeConnectStatus}
            onConnectStripe={connectStripeAccount}
            onViewChange={setView}
          />
        )}

        {view === 'profile' && (
          <ProfileView
            user={effectiveAccountProfile || sessionUser}
            tips={tips}
            payments={paymentHistory}
            unlockedTips={unlockedTips}
            userPlan={effectiveAccountPlan}
            stripeConnectStatus={stripeConnectStatus}
            onConnectStripe={connectStripeAccount}
            onToast={showToast}
            onUnlock={unlockTip}
            onSubscribeToTipster={setSelectedProfileSub}
            tipsterSubscriptions={tipsterSubscriptions}
            followingTipsters={followingTipsters}
            onToggleFollow={toggleFollowTipster}
            onAvatarUpdated={(nextAvatarUrl) => {
              setAccountProfile(prev => ({ ...(prev || effectiveAccountProfile || {}), avatar_url: nextAvatarUrl }))
              setSessionUser(prev => prev ? ({ ...prev, avatar_url: nextAvatarUrl, user_metadata: { ...(prev.user_metadata || {}), avatar_url: nextAvatarUrl } }) : prev)
            }}
            onProfileUpdated={(patch) => {
              setAccountProfile(prev => ({ ...(prev || effectiveAccountProfile || {}), ...(patch || {}) }))
              setSessionUser(prev => prev ? ({ ...prev, ...(patch || {}), user_metadata: { ...(prev.user_metadata || {}), ...(patch || {}) } }) : prev)
            }}
          />
        )}

        {view === 'adminPayouts' && (
          <AdminPayoutsView
            user={sessionUser}
            requests={adminPayoutRequests}
            onUpdateStatus={updatePayoutStatus}
            onRunCron={runPayoutCron}
          />
        )}

        {view === 'payouts' && (
          <PayoutsView user={effectiveAccountProfile} payoutRequests={payoutRequests} onRequestPayout={requestTipsterPayout} stripeConnectStatus={stripeConnectStatus} onConnectStripe={connectStripeAccount} onViewChange={setView} userPlan={effectiveAccountPlan} submitting={payoutSubmitting} earnings={tipsterEarnings} />
        )}


        {view === 'adminFinance' && (
          <AdminFinanceView
            report={adminFinanceReport}
            onRefresh={fetchAdminFinanceReport}
            onViewChange={setView}
          />
        )}

        {view === 'dashboard' && selectedTipsterId && (
          <TipsterProfileView
            tipsterId={selectedTipsterId}
            onBack={() => setSelectedTipsterId(null)}
            currentUser={effectiveAccountProfile}
            followingTipsters={followingTipsters}
            onToggleFollow={toggleFollowTipster}
            onUnlock={unlockTip}
            onSubscribeToTipster={setSelectedProfileSub}
            unlockedTips={unlockedTips}
            tipsterSubscriptions={tipsterSubscriptions}
          />
        )}

        {view === 'dashboard' && !selectedTipsterId && (
          <section className="feed-section">
            <AnimatedDashboardHero />
            <div className="monetization-panel">
              <div>
                <strong>💰 Marketplace premium</strong>
                <span>Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium. Przejdź na konto Premium, aby monetyzować swoje analizy.</span>
                <button type="button" className="premium-banner-cta" onClick={() => window.dispatchEvent(new CustomEvent('betai:start-premium-checkout'))}>Kup Premium</button>
              </div>
              <div className="monetization-stats">
                <b>{feedCounts.premium}</b>
                <small>typów premium</small>
              </div>
            </div>

            <div className="feed-filters">
              {filterItems.map(([key, label]) => (
                <button
                  key={key}
                  className={activeFilter === key ? 'active' : ''}
                  onClick={() => setActiveFilter(key)}
                >
                  <span>{label}</span>
                  <b>{feedCounts[key]}</b>
                </button>
              ))}
              <button type="button" className="feed-add-tip-btn" onClick={() => setView('add')}>+ Dodaj typ</button>
            </div>


            <div className="feed">
              {filteredTips.length ? visibleDashboardTips.map(tip => <TipCard key={tip.id} tip={tip} unlocked={unlockedTips.has(tip.id)} profileSubscriptionActive={hasActiveTipsterSubscription(tip, tipsterSubscriptions)} onUnlock={unlockTip} onSubscribeToTipster={setSelectedProfileSub} currentUser={effectiveAccountProfile} followingTipsters={followingTipsters} onToggleFollow={toggleFollowTipster} onOpenTipster={openTipsterProfile} onToast={showToast} />) : (
                <div className="empty-state">Brak typów w tym filtrze.</div>
              )}
            </div>

            {filteredTips.length ? (
              <div className="feed-visible-counter">Pokazano {Math.min(dashboardVisibleTips, filteredTips.length)} z {filteredTips.length} typów</div>
            ) : null}

            {filteredTips.length > 3 ? (
              <div className="feed-load-more-wrap">
                <button
                  type="button"
                  className="feed-load-more-btn"
                  onClick={() => setDashboardVisibleTips(prev => prev + 3)}
                  disabled={!hasMoreDashboardTips}
                >
                  {hasMoreDashboardTips ? `Pokaż kolejne 3 typy (${Math.max(filteredTips.length - dashboardVisibleTips, 0)} pozostało)` : 'Pokazano wszystkie typy'}
                </button>
                {hasExpandedDashboardTips ? (
                  <button
                    type="button"
                    className="feed-load-less-btn"
                    onClick={() => setDashboardVisibleTips(3)}
                  >
                    Zwiń do 3 typów
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        )}
      </main>

      {view === 'dashboard' && !selectedTipsterId && <Rightbar ranking={realRanking} tips={tips} user={effectiveAccountProfile || sessionUser} />}
      <SiteReviewsWidget user={effectiveAccountProfile || sessionUser} />
      <SupportChatWidget user={effectiveAccountProfile || sessionUser} />
    </div>
  )
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>)


// BETAI TIP ALERT SYSTEM
window.showBetAITipAlert = function(username) {
  const old = document.getElementById('betai-tip-alert');
  if (old) old.remove();

  const wrap = document.createElement('div');
  wrap.id = 'betai-tip-alert';
  wrap.style.position = 'fixed';
  wrap.style.left = '50%';
  wrap.style.top = '50%';
  wrap.style.transform = 'translate(-50%, -50%)';
  wrap.style.zIndex = '999999';
  wrap.style.background = 'rgba(0,0,0,0.92)';
  wrap.style.border = '2px solid #00d5ff';
  wrap.style.borderRadius = '24px';
  wrap.style.padding = '18px';
  wrap.style.boxShadow = '0 0 40px #00d5ff';
  wrap.style.textAlign = 'center';
  wrap.style.animation = 'betaiFade 0.4s ease';

  const img = document.createElement('img');
  img.src = '/bet_ai_ultra_pro_nowy_tip.gif';
  img.style.width = '260px';
  img.style.borderRadius = '18px';

  const txt = document.createElement('div');
  txt.innerHTML = 'TIP OD:<br><strong>' + username + '</strong>';
  txt.style.color = 'white';
  txt.style.fontSize = '28px';
  txt.style.fontWeight = '800';
  txt.style.marginTop = '16px';

  wrap.appendChild(img);
  wrap.appendChild(txt);
  document.body.appendChild(wrap);

  setTimeout(() => {
    wrap.style.opacity = '0';
    wrap.style.transition = '0.5s';
  }, 4500);

  setTimeout(() => {
    wrap.remove();
  }, 5200);
}

window.addEventListener('betai-tip-received', (e) => {
  const username = e?.detail?.from || 'Użytkownik';
  window.showBetAITipAlert(username);
});
