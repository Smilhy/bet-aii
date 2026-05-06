import React, { useMemo, useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import './styles.css'
const BETAI_ADMIN_EMAILS = ['smilhytv@gmail.com'];
const BETAI_PREMIUM_EMAILS = ['smilhytv@gmail.com', 'buchajson1988@gmail.com'];
const BETAI_PREMIUM_USERNAMES = ['smilhytv', 'buchajson1988', 'buchajsonek1988', 'buchajson', 'buchajsonek'];
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
    'Dashboard': 'Dashboard', 'Dodaj typ': 'Add pick', 'Portfel': 'Wallet', 'Mój profil': 'My profile', 'Ranking': 'Ranking', 'Polecenia': 'Referrals', 'Powiadomienia': 'Notifications', 'Płatności': 'Payments', 'Subskrypcja': 'Subscription', 'Zarobki': 'Earnings', 'Wypłaty': 'Payouts', 'Typy AI': 'AI picks', 'Top typerzy': 'Top tipsters', 'Admin finanse': 'Admin finance', 'Admin wypłaty': 'Admin payouts', 'Wyloguj': 'Log out', 'Doładuj konto': 'Top up account', 'Saldo': 'Balance', 'Żetony': 'Tokens', 'Odblokowane': 'Unlocked', 'Przejdź na Premium': 'Go Premium', 'Zarządzaj Premium': 'Manage Premium', 'Szukaj meczów, lig, użytkowników...': 'Search matches, leagues, users...', 'Szukaj meczów, lig i użytkowników': 'Search matches, leagues and users', 'Mój profil': 'My profile', 'WITAJ PONOWNIE': 'WELCOME BACK', 'MECZÓW DZIŚ': 'MATCHES TODAY', 'ŚR. PEWNOŚĆ': 'AVG. CONFIDENCE', 'PREMIUM': 'PREMIUM', 'Marketplace premium': 'Premium marketplace', 'Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium. Przejdź na konto Premium, aby monetyzować swoje analizy.': 'Publishing paid picks is available only for Premium users. Upgrade to Premium to monetize your analysis.', 'Kup Premium': 'Buy Premium', 'typów premium': 'premium picks', 'Wszystkie': 'All', 'Premium': 'Premium', 'Darmowe': 'Free', 'Moje': 'Mine', 'AI Analiza': 'AI analysis', 'Zobacz typ': 'View pick', 'Obserwuj tipstera': 'Follow tipster', 'Obserwuj': 'Follow', 'Oczekujący': 'Pending', 'Dzisiaj': 'Today', 'Typ': 'Pick', 'Kurs': 'Odds', 'Powyżej 2.5 gola': 'Over 2.5 goals', 'Top użytkownik (24h)': 'Top user (24h)', 'Nagroda dnia': 'Daily reward', 'Aktywni teraz': 'Active now', 'Brak lidera': 'No leader', 'wiadomości dziś': 'today messages', 'Dla najbardziej aktywnych': 'For the most active', 'Napisz wiadomość...': 'Write a message...', 'Twoja wiadomość': 'Your message', 'Top tipsterzy': 'Top tipsters', 'Ranking real': 'Real ranking', 'AI Typy dnia': 'AI picks of the day', 'Zobacz wszystkie': 'See all', 'Wyniki live': 'Live scores', 'Artykuły': 'Articles', 'News': 'News', 'Analizy AI': 'AI analytics', 'TV / PPV': 'TV / PPV', 'Nie pobrano typów': 'Could not load picks', 'Brak konta': 'No account', 'Zaloguj się, aby odblokować': 'Log in to unlock', 'Musisz być zalogowany, aby obserwować tipstera.': 'You must be logged in to follow a tipster.', 'Witaj ponownie': 'Welcome back', 'Miło Cię widzieć z powrotem w BetAI.': 'Nice to see you back in BetAI.'
  },
  de: {
    'Dashboard': 'Dashboard', 'Dodaj typ': 'Tipp hinzufügen', 'Portfel': 'Wallet', 'Mój profil': 'Mein Profil', 'Ranking': 'Ranking', 'Polecenia': 'Empfehlungen', 'Powiadomienia': 'Benachrichtigungen', 'Płatności': 'Zahlungen', 'Subskrypcja': 'Abo', 'Zarobki': 'Einnahmen', 'Wypłaty': 'Auszahlungen', 'Typy AI': 'KI-Tipps', 'Top typerzy': 'Top-Tipper', 'Admin finanse': 'Admin Finanzen', 'Admin wypłaty': 'Admin Auszahlungen', 'Wyloguj': 'Ausloggen', 'Doładuj konto': 'Konto aufladen', 'Saldo': 'Guthaben', 'Żetony': 'Tokens', 'Odblokowane': 'Freigeschaltet', 'Przejdź na Premium': 'Zu Premium wechseln', 'Zarządzaj Premium': 'Premium verwalten', 'Szukaj meczów, lig, użytkowników...': 'Spiele, Ligen, Nutzer suchen...', 'Szukaj meczów, lig i użytkowników': 'Spiele, Ligen und Nutzer suchen', 'WITAJ PONOWNIE': 'WILLKOMMEN ZURÜCK', 'MECZÓW DZIŚ': 'SPIELE HEUTE', 'ŚR. PEWNOŚĆ': 'Ø SICHERHEIT', 'Marketplace premium': 'Premium-Marktplatz', 'Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium. Przejdź na konto Premium, aby monetyzować swoje analizy.': 'Bezahlte Tipps sind nur für Premium-Nutzer verfügbar. Wechsle zu Premium, um deine Analysen zu monetarisieren.', 'Kup Premium': 'Premium kaufen', 'typów premium': 'Premium-Tipps', 'Wszystkie': 'Alle', 'Premium': 'Premium', 'Darmowe': 'Kostenlos', 'Moje': 'Meine', 'AI Analiza': 'KI-Analyse', 'Zobacz typ': 'Tipp ansehen', 'Obserwuj tipstera': 'Tipper folgen', 'Obserwuj': 'Folgen', 'Oczekujący': 'Ausstehend', 'Dzisiaj': 'Heute', 'Typ': 'Tipp', 'Kurs': 'Quote', 'Powyżej 2.5 gola': 'Über 2,5 Tore', 'Top użytkownik (24h)': 'Top-Nutzer (24h)', 'Nagroda dnia': 'Tagespreis', 'Aktywni teraz': 'Jetzt aktiv', 'Brak lidera': 'Kein Leader', 'wiadomości dziś': 'Nachrichten heute', 'Dla najbardziej aktywnych': 'Für die Aktivsten', 'Napisz wiadomość...': 'Nachricht schreiben...', 'Twoja wiadomość': 'Deine Nachricht', 'Top tipsterzy': 'Top-Tipper', 'Ranking real': 'Echtes Ranking', 'AI Typy dnia': 'KI-Tipps des Tages', 'Zobacz wszystkie': 'Alle ansehen', 'Wyniki live': 'Live-Ergebnisse', 'Artykuły': 'Artikel', 'News': 'News', 'Analizy AI': 'KI-Analysen', 'TV / PPV': 'TV / PPV', 'Nie pobrano typów': 'Tipps konnten nicht geladen werden', 'Brak konta': 'Kein Konto', 'Zaloguj się, aby odblokować': 'Einloggen zum Freischalten', 'Musisz być zalogowany, aby obserwować tipstera.': 'Du musst eingeloggt sein, um einem Tipper zu folgen.', 'Witaj ponownie': 'Willkommen zurück', 'Miło Cię widzieć z powrotem w BetAI.': 'Schön, dich wieder bei BetAI zu sehen.'
  },
  es: {
    'Dashboard': 'Panel', 'Dodaj typ': 'Añadir pick', 'Portfel': 'Cartera', 'Mój profil': 'Mi perfil', 'Ranking': 'Ranking', 'Polecenia': 'Referidos', 'Powiadomienia': 'Notificaciones', 'Płatności': 'Pagos', 'Subskrypcja': 'Suscripción', 'Zarobki': 'Ganancias', 'Wypłaty': 'Retiros', 'Typy AI': 'Picks IA', 'Top typerzy': 'Top tipsters', 'Admin finanse': 'Admin finanzas', 'Admin wypłaty': 'Admin retiros', 'Wyloguj': 'Cerrar sesión', 'Doładuj konto': 'Recargar cuenta', 'Saldo': 'Saldo', 'Żetony': 'Tokens', 'Odblokowane': 'Desbloqueados', 'Przejdź na Premium': 'Ir a Premium', 'Zarządzaj Premium': 'Gestionar Premium', 'Szukaj meczów, lig, użytkowników...': 'Buscar partidos, ligas, usuarios...', 'Szukaj meczów, lig i użytkowników': 'Buscar partidos, ligas y usuarios', 'WITAJ PONOWNIE': 'BIENVENIDO DE NUEVO', 'MECZÓW DZIŚ': 'PARTIDOS HOY', 'ŚR. PEWNOŚĆ': 'CONFIANZA MEDIA', 'Marketplace premium': 'Marketplace premium', 'Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium. Przejdź na konto Premium, aby monetyzować swoje analizy.': 'Publicar picks de pago solo está disponible para usuarios Premium. Pasa a Premium para monetizar tus análisis.', 'Kup Premium': 'Comprar Premium', 'typów premium': 'picks premium', 'Wszystkie': 'Todos', 'Premium': 'Premium', 'Darmowe': 'Gratis', 'Moje': 'Míos', 'AI Analiza': 'Análisis IA', 'Zobacz typ': 'Ver pick', 'Obserwuj tipstera': 'Seguir tipster', 'Obserwuj': 'Seguir', 'Oczekujący': 'Pendiente', 'Dzisiaj': 'Hoy', 'Typ': 'Pick', 'Kurs': 'Cuota', 'Powyżej 2.5 gola': 'Más de 2.5 goles', 'Top użytkownik (24h)': 'Usuario top (24h)', 'Nagroda dnia': 'Premio del día', 'Aktywni teraz': 'Activos ahora', 'Brak lidera': 'Sin líder', 'wiadomości dziś': 'mensajes hoy', 'Dla najbardziej aktywnych': 'Para los más activos', 'Napisz wiadomość...': 'Escribe un mensaje...', 'Twoja wiadomość': 'Tu mensaje', 'Top tipsterzy': 'Top tipsters', 'Ranking real': 'Ranking real', 'AI Typy dnia': 'Picks IA del día', 'Zobacz wszystkie': 'Ver todo', 'Wyniki live': 'Resultados live', 'Artykuły': 'Artículos', 'News': 'Noticias', 'Analizy AI': 'Análisis IA', 'TV / PPV': 'TV / PPV', 'Nie pobrano typów': 'No se pudieron cargar picks', 'Brak konta': 'Sin cuenta', 'Zaloguj się, aby odblokować': 'Inicia sesión para desbloquear', 'Musisz być zalogowany, aby obserwować tipstera.': 'Debes iniciar sesión para seguir a un tipster.', 'Witaj ponownie': 'Bienvenido de nuevo', 'Miło Cię widzieć z powrotem w BetAI.': 'Qué bueno verte de vuelta en BetAI.'
  },
  ru: {
    'Dashboard': 'Панель', 'Dodaj typ': 'Добавить прогноз', 'Portfel': 'Кошелек', 'Mój profil': 'Мой профиль', 'Ranking': 'Рейтинг', 'Polecenia': 'Рефералы', 'Powiadomienia': 'Уведомления', 'Płatności': 'Платежи', 'Subskrypcja': 'Подписка', 'Zarobki': 'Доходы', 'Wypłaty': 'Выводы', 'Typy AI': 'AI прогнозы', 'Top typerzy': 'Топ типстеры', 'Admin finanse': 'Админ финансы', 'Admin wypłaty': 'Админ выводы', 'Wyloguj': 'Выйти', 'Doładuj konto': 'Пополнить счет', 'Saldo': 'Баланс', 'Żetony': 'Токены', 'Odblokowane': 'Разблокировано', 'Przejdź na Premium': 'Перейти на Premium', 'Zarządzaj Premium': 'Управлять Premium', 'Szukaj meczów, lig, użytkowników...': 'Искать матчи, лиги, пользователей...', 'Szukaj meczów, lig i użytkowników': 'Искать матчи, лиги и пользователей', 'WITAJ PONOWNIE': 'С ВОЗВРАЩЕНИЕМ', 'MECZÓW DZIŚ': 'МАТЧЕЙ СЕГОДНЯ', 'ŚR. PEWNOŚĆ': 'СР. УВЕРЕННОСТЬ', 'Marketplace premium': 'Premium маркетплейс', 'Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium. Przejdź na konto Premium, aby monetyzować swoje analizy.': 'Платные прогнозы доступны только Premium пользователям. Перейдите на Premium, чтобы монетизировать аналитику.', 'Kup Premium': 'Купить Premium', 'typów premium': 'premium прогнозов', 'Wszystkie': 'Все', 'Premium': 'Premium', 'Darmowe': 'Бесплатные', 'Moje': 'Мои', 'AI Analiza': 'AI анализ', 'Zobacz typ': 'Смотреть прогноз', 'Obserwuj tipstera': 'Следить за типстером', 'Obserwuj': 'Следить', 'Oczekujący': 'Ожидает', 'Dzisiaj': 'Сегодня', 'Typ': 'Прогноз', 'Kurs': 'Коэф.', 'Powyżej 2.5 gola': 'Тотал больше 2.5', 'Top użytkownik (24h)': 'Топ пользователь (24ч)', 'Nagroda dnia': 'Награда дня', 'Aktywni teraz': 'Активны сейчас', 'Brak lidera': 'Лидера нет', 'wiadomości dziś': 'сообщений сегодня', 'Dla najbardziej aktywnych': 'Для самых активных', 'Napisz wiadomość...': 'Напишите сообщение...', 'Twoja wiadomość': 'Ваше сообщение', 'Top tipsterzy': 'Топ типстеры', 'Ranking real': 'Реальный рейтинг', 'AI Typy dnia': 'AI прогнозы дня', 'Zobacz wszystkie': 'Смотреть все', 'Wyniki live': 'Live результаты', 'Artykuły': 'Статьи', 'News': 'Новости', 'Analizy AI': 'AI аналитика', 'TV / PPV': 'TV / PPV', 'Nie pobrano typów': 'Не удалось загрузить прогнозы', 'Brak konta': 'Нет аккаунта', 'Zaloguj się, aby odblokować': 'Войдите, чтобы разблокировать', 'Musisz być zalogowany, aby obserwować tipstera.': 'Нужно войти, чтобы следить за типстером.', 'Witaj ponownie': 'С возвращением', 'Miło Cię widzieć z powrotem w BetAI.': 'Рады видеть вас снова в BetAI.'
  }
}

const BETAI_EXTRA_DASHBOARD_TRANSLATIONS = {
  en: {
    'Zaloguj się': 'Log in', 'Zarejestruj się': 'Register', 'Załóż konto': 'Create account', 'Nazwa użytkownika': 'Username', 'Hasło': 'Password', 'Powtórz hasło': 'Repeat password', 'Regulamin': 'Terms', 'Politykę prywatności': 'Privacy policy', 'Nie pamiętasz hasła?': 'Forgot password?', 'Szyfrowane logowanie': 'Encrypted login',
    'Realne statystyki live': 'Real live statistics', 'Platforma żyje i odświeża dane na bieżąco': 'The platform is live and refreshes data in real time', 'Zarejestrowanych użytkowników': 'Registered users', 'Skuteczność AI': 'AI accuracy', 'Typów dzisiaj': 'Picks today', 'Auto-odświeżanie co 30 s': 'Auto-refresh every 30s', 'ostatnia aktualizacja': 'last update',
    'BetAI LIVE CHAT': 'BetAI LIVE CHAT', 'online': 'online', 'TOP UŻYTKOWNIK (24H)': 'TOP USER (24H)', 'NAGRODA DNIA': 'DAILY REWARD', 'AKTYWNI TERAZ': 'ACTIVE NOW', '1 żeton / 24h': '1 token / 24h', 'Brak lidera': 'No leader', 'Dla najbardziej aktywnych': 'For the most active', 'Napisz wiadomość...': 'Write a message...', 'Twoja wiadomość': 'Your message', 'Witaj ponownie': 'Welcome back', 'Miło Cię widzieć z powrotem w BetAI.': 'Nice to see you back in BetAI.',
    'Marketplace premium': 'Premium marketplace', 'Typy premium': 'Premium picks', 'Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium.': 'Publishing paid picks is available only for Premium users.', 'Przejdź na konto Premium, aby monetyzować swoje analizy.': 'Upgrade to Premium to monetize your analyses.', 'Kup Premium': 'Buy Premium',
    'Wszystkie': 'All', 'Darmowe': 'Free', 'Moje': 'Mine', 'Dodaj typ': 'Add pick', 'Zobacz typ': 'View pick', 'Zobacz prognozę': 'View pick', 'Obserwuj tipstera': 'Follow tipster', 'Obserwuj': 'Follow', 'Oczekujący': 'Pending', 'Liga Mistrzów': 'Champions League', 'Dzisiaj': 'Today', 'Prognoz': 'Pick', 'Prognoza': 'Pick', 'Powyżej 2.5 gola': 'Over 2.5 goals', 'Ponad 2.5 gola': 'Over 2.5 goals', 'Kurs': 'Odds', 'Koef.': 'Odds', 'AI Analiza': 'AI analysis', 'Real w świetnej formie u siebie. Bayern ma problemy w defensywie w ostatnich meczach.': 'Real is in excellent home form. Bayern has had defensive problems in recent matches.',
    'Top tipsterzy': 'Top tipsters', 'Ranking real': 'Real ranking', 'AI Typy dnia': 'AI picks of the day', 'Zobacz wszystkie': 'See all', 'Brak danych': 'No data', 'Brak typów': 'No picks', 'Ładowanie...': 'Loading...', 'Łączenie...': 'Connecting...', 'Kup dostęp': 'Buy access', 'Szczegóły': 'Details',
    'Bezpieczne dane': 'Secure data', 'Twoje dane są u nas w pełni chronione.': 'Your data is fully protected.', 'Szybka rejestracja': 'Fast registration', 'Załóż konto w mniej niż 30 sekund.': 'Create an account in under 30 seconds.', 'Darmowe typy AI': 'Free AI picks', 'Codziennie nowe typy o wysokiej skuteczności.': 'New high-accuracy picks every day.', 'Aktywna społeczność': 'Active community', 'Tysiące typerów dzieli się wiedzą i wygrywa razem.': 'Thousands of bettors share knowledge and win together.',
    'Bilans': 'Balance', 'Balans': 'Balance', 'Odblokowano': 'Unlocked', 'Popолнить счет': 'Top up account', 'Пополни́ть счет': 'Top up account', 'Witaj': 'Welcome', 'Meczów dziś': 'Matches today', 'Śr. pewność': 'Avg. confidence', 'Dostęp do inteligentnych typów': 'Access to intelligent picks', 'Sport': 'Sport'
  },
  de: {
    'Zaloguj się': 'Einloggen', 'Zarejestruj się': 'Registrieren', 'Załóż konto': 'Konto erstellen', 'Nazwa użytkownika': 'Benutzername', 'Hasło': 'Passwort', 'Powtórz hasło': 'Passwort wiederholen', 'Regulamin': 'Bedingungen', 'Politykę prywatności': 'Datenschutz', 'Nie pamiętasz hasła?': 'Passwort vergessen?', 'Szyfrowane logowanie': 'Verschlüsselter Login',
    'Realne statystyki live': 'Echte Live-Statistiken', 'Platforma żyje i odświeża dane na bieżąco': 'Die Plattform ist live und aktualisiert Daten laufend', 'Zarejestrowanych użytkowników': 'Registrierte Nutzer', 'Skuteczność AI': 'KI-Trefferquote', 'Typów dzisiaj': 'Tipps heute', 'Auto-odświeżanie co 30 s': 'Auto-Aktualisierung alle 30 s', 'ostatnia aktualizacja': 'letzte Aktualisierung',
    'BetAI LIVE CHAT': 'BetAI LIVE CHAT', 'online': 'online', 'TOP UŻYTKOWNIK (24H)': 'TOP-NUTZER (24H)', 'NAGRODA DNIA': 'TAGESPREIS', 'AKTYWNI TERAZ': 'JETZT AKTIV', '1 żeton / 24h': '1 Token / 24h', 'Brak lidera': 'Kein Leader', 'Dla najbardziej aktywnych': 'Für die Aktivsten', 'Napisz wiadomość...': 'Nachricht schreiben...', 'Twoja wiadomość': 'Deine Nachricht', 'Witaj ponownie': 'Willkommen zurück', 'Miło Cię widzieć z powrotem w BetAI.': 'Schön, dich wieder bei BetAI zu sehen.',
    'Marketplace premium': 'Premium-Marktplatz', 'Typy premium': 'Premium-Tipps', 'Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium.': 'Bezahlte Tipps sind nur für Premium-Nutzer verfügbar.', 'Przejdź na konto Premium, aby monetyzować swoje analizy.': 'Wechsle zu Premium, um deine Analysen zu monetarisieren.', 'Kup Premium': 'Premium kaufen',
    'Wszystkie': 'Alle', 'Darmowe': 'Kostenlos', 'Moje': 'Meine', 'Dodaj typ': 'Tipp hinzufügen', 'Zobacz typ': 'Tipp ansehen', 'Zobacz prognozę': 'Prognose ansehen', 'Obserwuj tipstera': 'Tipster folgen', 'Obserwuj': 'Folgen', 'Oczekujący': 'Ausstehend', 'Liga Mistrzów': 'Champions League', 'Dzisiaj': 'Heute', 'Prognoz': 'Tipp', 'Prognoza': 'Tipp', 'Powyżej 2.5 gola': 'Über 2,5 Tore', 'Ponad 2.5 gola': 'Über 2,5 Tore', 'Kurs': 'Quote', 'Koef.': 'Quote', 'AI Analiza': 'KI-Analyse', 'Real w świetnej formie u siebie. Bayern ma problemy w defensywie w ostatnich meczach.': 'Real ist zu Hause in sehr guter Form. Bayern hatte zuletzt Defensivprobleme.',
    'Top tipsterzy': 'Top-Tipster', 'Ranking real': 'Echtes Ranking', 'AI Typy dnia': 'KI-Tipps des Tages', 'Zobacz wszystkie': 'Alle ansehen', 'Brak danych': 'Keine Daten', 'Brak typów': 'Keine Tipps', 'Ładowanie...': 'Laden...', 'Łączenie...': 'Verbinden...', 'Kup dostęp': 'Zugang kaufen', 'Szczegóły': 'Details',
    'Bezpieczne dane': 'Sichere Daten', 'Twoje dane są u nas w pełni chronione.': 'Deine Daten sind vollständig geschützt.', 'Szybka rejestracja': 'Schnelle Registrierung', 'Załóż konto w mniej niż 30 sekund.': 'Erstelle ein Konto in weniger als 30 Sekunden.', 'Darmowe typy AI': 'Kostenlose KI-Tipps', 'Codziennie nowe typy o wysokiej skuteczności.': 'Täglich neue Tipps mit hoher Trefferquote.', 'Aktywna społeczność': 'Aktive Community', 'Tysiące typerów dzieli się wiedzą i wygrywa razem.': 'Tausende Tipper teilen Wissen und gewinnen gemeinsam.',
    'Bilans': 'Guthaben', 'Balans': 'Guthaben', 'Odblokowano': 'Freigeschaltet', 'Witaj': 'Willkommen', 'Meczów dziś': 'Spiele heute', 'Śr. pewność': 'Ø Sicherheit', 'Dostęp do inteligentnych typów': 'Zugang zu intelligenten Tipps', 'Sport': 'Sport'
  },
  es: {
    'Zaloguj się': 'Iniciar sesión', 'Zarejestruj się': 'Registrarse', 'Załóż konto': 'Crear cuenta', 'Nazwa użytkownika': 'Usuario', 'Hasło': 'Contraseña', 'Powtórz hasło': 'Repetir contraseña', 'Regulamin': 'Términos', 'Politykę prywatności': 'Política de privacidad', 'Nie pamiętasz hasła?': '¿Olvidaste tu contraseña?', 'Szyfrowane logowanie': 'Inicio seguro',
    'Realne statystyki live': 'Estadísticas live reales', 'Platforma żyje i odświeża dane na bieżąco': 'La plataforma está viva y actualiza datos en directo', 'Zarejestrowanych użytkowników': 'Usuarios registrados', 'Skuteczność AI': 'Precisión IA', 'Typów dzisiaj': 'Picks hoy', 'Auto-odświeżanie co 30 s': 'Auto-actualización cada 30 s', 'ostatnia aktualizacja': 'última actualización',
    'BetAI LIVE CHAT': 'BetAI LIVE CHAT', 'online': 'online', 'TOP UŻYTKOWNIK (24H)': 'USUARIO TOP (24H)', 'NAGRODA DNIA': 'PREMIO DEL DÍA', 'AKTYWNI TERAZ': 'ACTIVOS AHORA', '1 żeton / 24h': '1 token / 24h', 'Brak lidera': 'Sin líder', 'Dla najbardziej aktywnych': 'Para los más activos', 'Napisz wiadomość...': 'Escribe un mensaje...', 'Twoja wiadomość': 'Tu mensaje', 'Witaj ponownie': 'Bienvenido de nuevo', 'Miło Cię widzieć z powrotem w BetAI.': 'Qué bueno verte de vuelta en BetAI.',
    'Marketplace premium': 'Marketplace premium', 'Typy premium': 'Picks premium', 'Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium.': 'Publicar picks de pago solo está disponible para usuarios Premium.', 'Przejdź na konto Premium, aby monetyzować swoje analizy.': 'Pasa a Premium para monetizar tus análisis.', 'Kup Premium': 'Comprar Premium',
    'Wszystkie': 'Todos', 'Darmowe': 'Gratis', 'Moje': 'Míos', 'Dodaj typ': 'Añadir pick', 'Zobacz typ': 'Ver pick', 'Zobacz prognozę': 'Ver pronóstico', 'Obserwuj tipstera': 'Seguir tipster', 'Obserwuj': 'Seguir', 'Oczekujący': 'Pendiente', 'Liga Mistrzów': 'Champions League', 'Dzisiaj': 'Hoy', 'Prognoz': 'Pronóstico', 'Prognoza': 'Pronóstico', 'Powyżej 2.5 gola': 'Más de 2.5 goles', 'Ponad 2.5 gola': 'Más de 2.5 goles', 'Kurs': 'Cuota', 'Koef.': 'Cuota', 'AI Analiza': 'Análisis IA', 'Real w świetnej formie u siebie. Bayern ma problemy w defensywie w ostatnich meczach.': 'Real está muy fuerte en casa. Bayern tuvo problemas defensivos en los últimos partidos.',
    'Top tipsterzy': 'Top tipsters', 'Ranking real': 'Ranking real', 'AI Typy dnia': 'Picks IA del día', 'Zobacz wszystkie': 'Ver todo', 'Brak danych': 'Sin datos', 'Brak typów': 'Sin picks', 'Ładowanie...': 'Cargando...', 'Łączenie...': 'Conectando...', 'Kup dostęp': 'Comprar acceso', 'Szczegóły': 'Detalles',
    'Bezpieczne dane': 'Datos seguros', 'Twoje dane są u nas w pełni chronione.': 'Tus datos están totalmente protegidos.', 'Szybka rejestracja': 'Registro rápido', 'Załóż konto w mniej niż 30 sekund.': 'Crea una cuenta en menos de 30 segundos.', 'Darmowe typy AI': 'Picks IA gratis', 'Codziennie nowe typy o wysokiej skuteczności.': 'Nuevos picks diarios de alta precisión.', 'Aktywna społeczność': 'Comunidad activa', 'Tysiące typerów dzieli się wiedzą i wygrywa razem.': 'Miles de usuarios comparten conocimiento y ganan juntos.',
    'Bilans': 'Saldo', 'Balans': 'Saldo', 'Odblokowano': 'Desbloqueado', 'Witaj': 'Bienvenido', 'Meczów dziś': 'Partidos hoy', 'Śr. pewność': 'Confianza media', 'Dostęp do inteligentnych typów': 'Acceso a picks inteligentes', 'Sport': 'Deporte'
  },
  ru: {
    'Zaloguj się': 'Войти', 'Zarejestruj się': 'Регистрация', 'Załóż konto': 'Создать аккаунт', 'Nazwa użytkownika': 'Имя пользователя', 'Hasło': 'Пароль', 'Powtórz hasło': 'Повторите пароль', 'Regulamin': 'Условия', 'Politykę prywatności': 'Политику конфиденциальности', 'Nie pamiętasz hasła?': 'Забыли пароль?', 'Szyfrowane logowanie': 'Защищенный вход',
    'Realne statystyki live': 'Реальная live-статистика', 'Platforma żyje i odświeża dane na bieżąco': 'Платформа живая и обновляет данные онлайн', 'Zarejestrowanych użytkowników': 'Зарегистрированных пользователей', 'Skuteczność AI': 'Точность AI', 'Typów dzisiaj': 'Прогнозов сегодня', 'Auto-odświeżanie co 30 s': 'Автообновление каждые 30 с', 'ostatnia aktualizacja': 'последнее обновление',
    'BetAI LIVE CHAT': 'BetAI LIVE CHAT', 'online': 'онлайн', 'TOP UŻYTKOWNIK (24H)': 'ТОП ПОЛЬЗОВАТЕЛЬ (24Ч)', 'NAGRODA DNIA': 'НАГРАДА ДНЯ', 'AKTYWNI TERAZ': 'АКТИВНЫ СЕЙЧАС', '1 żeton / 24h': '1 жетон / 24ч', 'Brak lidera': 'Лидера нет', 'Dla najbardziej aktywnych': 'Для самых активных', 'Napisz wiadomość...': 'Напишите сообщение...', 'Twoja wiadomość': 'Ваше сообщение', 'Witaj ponownie': 'С возвращением', 'Miło Cię widzieć z powrotem w BetAI.': 'Рады видеть вас снова в BetAI.',
    'Marketplace premium': 'Premium маркетплейс', 'Typy premium': 'Premium прогнозы', 'Publikowanie płatnych typów jest dostępne tylko dla użytkowników Premium.': 'Платные прогнозы доступны только Premium пользователям.', 'Przejdź na konto Premium, aby monetyzować swoje analizy.': 'Перейдите на Premium, чтобы монетизировать аналитику.', 'Kup Premium': 'Купить Premium',
    'Wszystkie': 'Все', 'Darmowe': 'Бесплатные', 'Moje': 'Мои', 'Dodaj typ': 'Добавить прогноз', 'Zobacz typ': 'Смотреть прогноз', 'Zobacz prognozę': 'Смотреть прогноз', 'Obserwuj tipstera': 'Следить за типстером', 'Obserwuj': 'Следить', 'Oczekujący': 'Ожидает', 'Liga Mistrzów': 'Лига чемпионов', 'Dzisiaj': 'Сегодня', 'Prognoz': 'Прогноз', 'Prognoza': 'Прогноз', 'Powyżej 2.5 gola': 'Тотал больше 2.5', 'Ponad 2.5 gola': 'Тотал больше 2.5', 'Kurs': 'Коэф.', 'Koef.': 'Коэф.', 'AI Analiza': 'AI анализ', 'Real w świetnej formie u siebie. Bayern ma problemy w defensywie w ostatnich meczach.': 'Real в отличной форме дома. У Bayern были проблемы в защите в последних матчах.',
    'Top tipsterzy': 'Топ типстеры', 'Ranking real': 'Реальный рейтинг', 'AI Typy dnia': 'AI прогнозы дня', 'Zobacz wszystkie': 'Смотреть все', 'Brak danych': 'Нет данных', 'Brak typów': 'Нет прогнозов', 'Ładowanie...': 'Загрузка...', 'Łączenie...': 'Подключение...', 'Kup dostęp': 'Купить доступ', 'Szczegóły': 'Детали',
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
    const id = normalized.author_id || normalized.user_id || normalized.author_email || normalized.author_name || 'unknown'
    const current = map.get(id) || { tipster_id: id, username: normalized.author_name || 'Użytkownik', email: normalized.author_email || '', total_tips: 0, wins: 0, losses: 0, roi: 0, winrate: 0, earnings: 0 }
    current.total_tips += 1
    const st = String(normalized.status || normalized.result || '').toLowerCase()
    if (['won','win','wygrany','wygrana'].includes(st)) current.wins += 1
    if (['lost','loss','lose','przegrany','przegrana'].includes(st)) current.losses += 1
    current.winrate = current.total_tips ? (current.wins / current.total_tips) * 100 : 0
    map.set(id, current)
  })
  return Array.from(map.values()).sort((a,b) => (b.total_tips || 0) - (a.total_tips || 0)).slice(0, 10)
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
    author_name: row.author_name || row.username || (row.author_email ? String(row.author_email).split('@')[0] : null) || 'Użytkownik',
    author_email: row.author_email || row.email || null,
    league: row.league || 'Liga',
    team_home: row.team_home || teamsFromMatch[0] || 'Drużyna 1',
    team_away: row.team_away || teamsFromMatch[1] || 'Drużyna 2',
    bet_type: row.bet_type || row.prediction || row.type || 'Typ',
    odds: Number(row.odds || row.course || 0),
    analysis: row.analysis || row.description || '',
    ai_analysis: row.ai_analysis || row.analysis || row.description || '',
    ai_probability: Number(row.ai_probability ?? row.ai_confidence ?? row.confidence ?? 0),
    ai_confidence: Number(row.ai_confidence ?? row.ai_probability ?? row.confidence ?? 0),
    access_type: premium ? 'premium' : 'free',
    is_premium: premium,
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

function getUserProfileView(user) {
  const email = user?.email || ''
  const username = user?.user_metadata?.username || user?.user_metadata?.name || (email ? email.split('@')[0] : 'Użytkownik')
  return {
    id: user?.id || null,
    email,
    username,
    initials: (username || 'U').slice(0, 2).toUpperCase(),
    isAdmin: email.toLowerCase() === 'smilhytv@gmail.com'
  }
}



function getProfileEmail(user) {
  return normalizeEmail(user?.email || user?.author_email || user?.auth_email || user?.user_metadata?.email || user?.raw_user_meta_data?.email)
}

function getProfileUsername(user) {
  const email = getProfileEmail(user)
  return normalizeEmail(
    user?.username ||
    user?.author_name ||
    user?.name ||
    user?.user_metadata?.username ||
    user?.user_metadata?.name ||
    user?.raw_user_meta_data?.username ||
    (email ? email.split('@')[0] : '')
  )
}

function isGuaranteedPremiumIdentity(user) {
  const email = getProfileEmail(user)
  const username = getProfileUsername(user)
  return BETAI_PREMIUM_EMAILS.includes(email) || BETAI_PREMIUM_USERNAMES.includes(username)
}

function isAdminUser(user) {
  const email = getProfileEmail(user)
  const username = getProfileUsername(user)
  return BETAI_ADMIN_EMAILS.includes(email) || username === 'smilhytv' || Boolean(user?.is_admin)
}

function isPremiumAccount(plan) {
  const value = String(plan || '').toLowerCase()
  return ['premium', 'vip', 'active', 'trialing', 'admin'].includes(value)
}

function isPremiumProfile(profile) {
  if (!profile) return false
  return isGuaranteedPremiumIdentity(profile) ||
    Boolean(profile.is_premium) ||
    Boolean(profile.is_admin) ||
    isPremiumAccount(profile.plan) ||
    ['active', 'trialing', 'premium'].includes(String(profile.subscription_status || '').toLowerCase()) ||
    ['admin', 'premium'].includes(String(profile.status || '').toLowerCase())
}

function hasUnlimitedTipAccess(user, plan = 'free') {
  return isAdminUser(user) || isGuaranteedPremiumIdentity(user) || isPremiumProfile(user) || isPremiumAccount(plan)
}

function buildEffectiveAccountProfile(accountProfile, sessionUser) {
  const sessionEmail = normalizeEmail(sessionUser?.email || accountProfile?.email)
  const fallbackUsername = sessionEmail ? sessionEmail.split('@')[0] : ''
  const merged = {
    ...(sessionUser || {}),
    ...(accountProfile || {}),
    id: accountProfile?.id || sessionUser?.id || null,
    email: sessionEmail || accountProfile?.email || sessionUser?.email || '',
    username: accountProfile?.username || sessionUser?.username || fallbackUsername
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
return (
    <aside className="sidebar">
      <div className="user-card">
        <div className="avatar">{profile.initials}</div>
        <div>
          <strong>{profile.username}</strong>
          <span className="pill">{getDisplayRole(user, userPlan)}</span>
        </div>
        <div className="wallet-row"><span>Saldo</span><b>{Number(wallet || 0).toFixed(2)} zł</b></div>
        <div className="wallet-row wallet-row-tokens"><span>Żetony</span><b>{Number(tokenBalance || 0)}</b></div>
        <div className="wallet-row"><span>Odblokowane</span><b>{unlockedCount || 0}</b></div>
        <button className="outline-btn" onClick={onTopUp || (() => {})}>Doładuj konto</button>
        <button className="logout-btn" onClick={onLogout}>Wyloguj</button>
      </div>

      <nav className="menu">
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>⌂ Dashboard</button>
        <button className={view === 'add' ? 'active' : ''} onClick={() => setView('add')}>＋ Dodaj typ</button>
        <button className={view === 'wallet' ? 'active' : ''} onClick={() => setView('wallet')}>💼 Portfel</button>
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

      <div className="premium-box">
        <h3>✦ Bet+AI Premium</h3>
        <p>✓ AI Typy bez limitu</p>
        <p>✓ Szczegółowe analizy</p>
        <p>✓ Statystyki premium</p>
        <p>✓ Typy premium</p>
        <p>✓ Brak reklam</p>
        {isPremiumAccount(userPlan) ? <button onClick={() => setView('subscriptions')}>Zarządzaj Premium</button> : <button onClick={() => window.dispatchEvent(new CustomEvent('betai:start-premium-checkout'))}>Przejdź na Premium</button>}
      </div>
    </aside>
  )
}

function formatRankingName(row) {
  const email = row?.email || row?.username || 'Tipster'
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

  if (message.includes('PREMIUM_REQUIRED')) {
    return 'Nie posiadasz konta Premium. Typy premium możesz dodawać po aktywacji Premium.'
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
  const userName = user?.username || user?.user_metadata?.username || user?.user_metadata?.name || (email ? email.split('@')[0] : 'Użytkownik')

  const nameFromEmail = (value = '') => {
    const clean = normalizeEmail(value)
    if (!clean) return 'Gość'
    if (clean === 'smilhytv@gmail.com') return 'Smilhytv'
    return clean.split('@')[0].replace(/[._-]+/g, ' ').split(' ').filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
  }

  const initialsFromName = (name = '') => String(name || 'LC').split(' ').filter(Boolean).slice(0, 2).map(part => part.charAt(0)).join('').slice(0, 2).toUpperCase() || 'LC'

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
      const nextMessages = (data || []).reverse()
      setMessages(nextMessages)
      setStatus('Live chat połączony — wiadomości odświeżają się automatycznie.')
      awardDailyLeaderIfNeeded(nextMessages)
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
        avatar_url: user?.avatar_url || user?.user_metadata?.avatar_url || '',
        message: clean,
        tipped_amount: 0,
        created_at: new Date().toISOString()
      })
      if (error) throw error
      setText('')
      setStatus('Wiadomość wysłana na live chat.')
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
    <section className="card widget livechat226-card betai-right-chat-final" id="betaiChatWidget">
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
        <div className="livechat226-stat betai-chat-stat-final"><span>NAGRODA DNIA</span><strong>🪙 1 żeton / 24h</strong><small>dla najbardziej aktywnych</small></div>
        <div className="livechat226-stat betai-chat-stat-final"><span>AKTYWNI TERAZ</span><strong>👥 {onlineCount}</strong></div>
      </div>


      <div className="livechat226-messages betai-chat-messages-final" id="liveChatMessages226">
        {messages.length ? messages.map(msg => {
          const msgEmail = normalizeEmail(msg.user_email)
          const mine = msgEmail && msgEmail === email
          const isAdmin = msgEmail === 'smilhytv@gmail.com'
          const isLeader = leader?.email && leader.email === msgEmail
          const name = msg.user_name || nameFromEmail(msgEmail)
          const avatar = msg.avatar_url || ''
          return (
            <div className={`livechat226-msg ${mine ? 'me' : ''}`} key={msg.id || msg.created_at}>
              <div className="livechat226-avatar" style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}>{avatar ? '' : initialsFromName(name)}</div>
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
  const fallbackRanking = buildRankingFromTips(tips)
  const realRanking = Array.isArray(ranking) && ranking.length ? ranking : fallbackRanking

  return (
    <aside className="rightbar">
      <LiveChatPanel user={user} />
      <section className="panel real-ranking-panel">
        <div className="panel-head"><h2>🏆 Top tipsterzy</h2><a>Ranking real</a></div>
        {realRanking.length ? realRanking.slice(0, 5).map((row, index) => (
          <div className={`rank ${index === 0 ? 'first' : index === 1 ? 'second' : index === 2 ? 'third' : ''}`} key={row.tipster_id || row.id || row.email || index}>
            <span>{index + 1}</span>
            <div className="mini-avatar">{formatRankingName(row).slice(0, 2).toUpperCase()}</div>
            <div>
              <b>{formatRankingName(row)}</b>
              <small>ROI: {Number(row.roi || 0).toFixed(2)} zł • WR: {Number(row.winrate || 0).toFixed(1)}%</small>
              <small>Typy: {Number(row.total_tips || 0)} • Wygrane: {Number(row.wins || 0)}</small>
            </div>
            <strong>+{formatMoney(row.earnings || row.total_earnings || 0)}</strong>
          </div>
        )) : (
          <div className="empty-mini">Brak danych rankingu. Dodaj typy i wyniki, aby ranking się naliczył.</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head"><h2><span>AI</span> Typy dnia</h2><a>Zobacz wszystkie</a></div>
        <div className="ai-pick"><div className="club">MC</div><div><b>Manchester City <span>vs</span> Inter Mediolan</b><small>Typ: Manchester City wygra</small><div className="tiny-progress"><i style={{width:'68%'}}></i></div></div><strong>68%</strong></div>
        <div className="ai-pick"><div className="club psg">PSG</div><div><b>PSG <span>vs</span> Borussia Dortmund</b><small>Typ: Powyżej 2.5 gola</small><div className="tiny-progress"><i style={{width:'63%'}}></i></div></div><strong>63%</strong></div>
        <div className="ai-pick"><div className="club lfc">L</div><div><b>Liverpool <span>vs</span> Bayer Leverkusen</b><small>Typ: Liverpool wygra</small><div className="tiny-progress"><i style={{width:'61%'}}></i></div></div><strong>61%</strong></div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Najnowsze wyniki</h2><a>Zobacz wszystkie</a></div>
        <div className="result"><span>PSG</span><b>2:1</b><span>Dortmund</span><em>Wygrany</em></div>
        <div className="result"><span>Liverpool</span><b>3:0</b><span>Leverkusen</span><em>Wygrany</em></div>
        <div className="result"><span>AC Milan</span><b>1:1</b><span>Roma</span><em className="neutral">Zwrot</em></div>
        <div className="result"><span>Juventus</span><b>2:0</b><span>Lazio</span><em>Wygrany</em></div>
        <div className="result"><span>Barcelona</span><b>3:1</b><span>Betis</span><em>Wygrany</em></div>
      </section>
    </aside>
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
      setStatus('Czat pomocy wymaga uruchomienia pliku SUPABASE_SUPPORT_CHAT_510.sql w Supabase.')
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
      setStatus('Nie udało się wysłać wiadomości. Uruchom SUPABASE_SUPPORT_CHAT_510.sql i spróbuj ponownie.')
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
              {conversations.length ? conversations.slice(0, 5).map(item => (
                <button key={item.key} type="button" className={(selectedKey || conversations[0]?.key) === item.key ? 'active' : ''} onClick={() => setSelectedKey(item.key)}>
                  <b>{item.name}</b>
                  <span>{item.unread ? `${item.unread} nowe` : item.email}</span>
                </button>
              )) : <span className="support510-empty-mini">Brak rozmów</span>}
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


function TipCard({ tip, unlocked, onUnlock, onSubscribeToTipster, profileSubscriptionActive, currentUser, followingTipsters, onToggleFollow, onOpenTipster }) {
  const statusLabel = tip.status === 'won' ? '● Wygrany' : tip.status === 'lost' ? '● Przegrany' : tip.status === 'void' ? '● Zwrot' : '◷ Oczekujący'
  const statusClass = tip.status === 'won' ? 'won' : tip.status === 'lost' ? 'lost' : 'pending'
  const probability = getAiConfidence(tip)
  const aiScore = getAiScore(tip)
  const aiAnalysis = getAiAnalysis(tip)
  const aiBadges = getAiBadges(tip)
  const isPremium = tip.access_type === 'premium'
  const isLocked = isPremium && !unlocked && !profileSubscriptionActive
  const author = tip.author_name || tip.author_email?.split('@')[0] || 'Użytkownik'
  const authorId = getTipAuthorId(tip)
  const currentUsername = (currentUser?.email || '').split('@')[0]
  const isOwnTip = Boolean(
    (currentUser?.id && authorId && String(currentUser.id) === String(authorId)) ||
    (currentUsername && String(currentUsername).toLowerCase() === String(author).toLowerCase())
  )
  const followKey = authorId ? String(authorId) : String(author).toLowerCase()
  const isFollowing = Boolean(followKey && followingTipsters?.has?.(followKey))

  return (
    <article className={`tip-card pro-tip-card ${isLocked ? 'locked-card' : ''}`}>
      <div className="tip-header">
        <div className="tipster">
          <div className={`photo ${author === 'AI Tip' ? 'bot' : ''}`}>{author.slice(0,2).toUpperCase()}</div>
          <div><strong className="tipster-name-link" onClick={() => authorId && onOpenTipster?.(authorId)}>{author}</strong><span>{new Date(tip.created_at).toLocaleString('pl-PL')}</span></div>
          <em>{author === 'AI Tip' ? 'AI' : 'TIPSTER'}</em>
          {!isOwnTip && author !== 'AI Tip' && (
            <button
              type="button"
              className={isFollowing ? 'follow-btn active' : 'follow-btn'}
              onClick={() => onToggleFollow?.(authorId, author)}
              title="Obserwuj tego tipstera i dostawaj powiadomienia o nowych typach"
            >
              {isFollowing ? '✓ Obserwujesz' : '+ Obserwuj'}
            </button>
          )}
        </div>
        <div className="card-badges">
          <span className={isPremium ? 'premium-tag' : 'free-tag'}>{isPremium ? '▣ PREMIUM' : '○ FREE'}</span>
          <span className="ai-badge">{isLocked ? 'AI 🔒' : `AI ${probability}%`}</span>
          {!isLocked && aiScore >= 75 && <span className="ai-score-badge">Score {aiScore}</span>}
        </div>
      </div>

      <div className="league">{tip.league} • {tip.match_time ? new Date(tip.match_time).toLocaleString('pl-PL') : 'Dzisiaj'}</div>

      <div className="tip-grid">
        <div className="match-box">
          <div className="teams"><b>{tip.team_home}</b><span>vs</span><b>{tip.team_away}</b></div>
          <div className="bet-row">
            <div><span>Typ</span><b>{isLocked ? '🔒 Typ premium' : tip.bet_type}</b></div>
            <div><span>Kurs</span><b>{isLocked ? '—' : tip.odds}</b></div>
          </div>
        </div>

        <div className={`ai-box ${isLocked ? 'premium-blur-box' : ''}`}>
          <div className="ai-title">✦ AI Analiza <strong>{isLocked ? '🔒' : `${probability}%`}</strong></div>
          <p>{isLocked ? 'Ten typ premium jest zablokowany. Odblokuj dostęp, aby zobaczyć analizę, kurs i pełny typ.' : aiAnalysis}</p>
          <div className="progress"><i style={{width:`${isLocked ? 18 : probability}%`}}></i></div>
          {!isLocked && aiBadges.length > 0 && <div className="ai-mini-badges">{aiBadges.map(badge => <span key={badge}>{badge}</span>)}</div>}
          {isLocked && <div className="lock-overlay">🔒 Premium</div>}
        </div>
      </div>

      <div className="tip-footer">
        <span className={statusClass}>{statusLabel}</span>
        <span>♡ 128</span><span>▢ 45</span><span>↗</span>
        {!isOwnTip && author !== 'AI Tip' && (
          <button
            type="button"
            className={isFollowing ? 'follow-footer-btn active' : 'follow-footer-btn'}
            onClick={() => onToggleFollow?.(authorId, author)}
          >
            {isFollowing ? '✓ Obserwujesz' : '+ Obserwuj tipstera'}
          </button>
        )}
        {isLocked ? (
          <>
            <button className="unlock-btn" onClick={() => onUnlock(tip)}>Kup typ za {tip.price || 29} zł</button>
            <button className="unlock-btn secondary" onClick={() => onSubscribeToTipster?.(tip)}>Kup dostęp do profilu</button>
          </>
        ) : (
          <button>{isPremium ? 'Odblokowany ✓' : 'Zobacz typ'}</button>
        )}
      </div>
    </article>
  )
}


function normalizeResult(value) {
  const v = String(value || '').toLowerCase()
  if (['win','won','wygrany'].includes(v)) return 'win'
  if (['loss','lose','lost','przegrany'].includes(v)) return 'loss'
  if (['void','push','zwrot'].includes(v)) return 'void'
  return 'pending'
}

function TipsterProfileView({ tipsterId, onBack, currentUser, followingTipsters, onToggleFollow, onUnlock, onSubscribeToTipster, unlockedTips = new Set(), tipsterSubscriptions = [] }) {
  const [profile, setProfile] = useState(null)
  const [tipsterTips, setTipsterTips] = useState([])
  const [stats, setStats] = useState(null)
  const [byLeague, setByLeague] = useState([])
  const [byType, setByType] = useState([])
  const [recentForm, setRecentForm] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadTipsterProfile() {
      if (!tipsterId || !isSupabaseConfigured || !supabase) return
      setLoading(true)
      try {
        const [profileRes, tipsRes, rankingRes, leagueRes, typeRes, formRes] = await Promise.all([
          supabase.from('profiles').select('id,email,username,public_slug,plan,subscription_status').eq('id', tipsterId).maybeSingle(),
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
        setTipsterTips(tipsRes.data || [])
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
  }, [tipsterId])

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
  const featuredTips = [...tipsterTips]
    .filter(t => isTipPremium(t) || Number(t.ai_confidence || t.ai_score || t.confidence || 0) >= 85 || normalizeResult(t.result || t.status) === 'win')
    .sort((a, b) => Number(b.ai_confidence || b.ai_score || b.confidence || b.odds || 0) - Number(a.ai_confidence || a.ai_score || a.confidence || a.odds || 0))
    .slice(0, 3)
  const lastTenTips = tipsterTips.slice(0, 10)
  const isTopSeller = salesCount >= 10 || buyersCount >= 10 || earnings >= 500
  const isOwn = currentUser?.id && String(currentUser.id) === String(tipsterId)
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
            <p className="eyebrow">PROFIL TIPSTERA</p>
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

      {loading ? <div className="empty-state">Ładowanie profilu tipstera...</div> : (
        <>
          <div className="tipster-sales-strip">
            <div className="sales-copy">
              <span className="sales-eyebrow">TIPSTER PROFILE PRO</span>
              <h2>{isTopSeller ? '🔥 TOP SELLER — sprawdzony profil premium' : 'Profil premium gotowy do sprzedaży'}</h2>
              <p>Ostatnie wyniki, statystyki i social proof w jednym miejscu. Kup dostęp do profilu albo odblokuj pojedynczy typ.</p>
            </div>
            {!isOwn && (
              <div className="sales-actions">
                <button className="unlock-btn sales-primary" onClick={() => onSubscribeToTipster?.({ author_id: tipsterId, author_name: username })}>Kup dostęp do wszystkich typów</button>
                <button className="follow-profile-btn" onClick={() => onToggleFollow?.(tipsterId, username)}>{isFollowing ? '✓ Obserwujesz' : '+ Obserwuj tipstera'}</button>
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
              <div className="feed-title compact"><div><h2>Ostatnie 10 typów</h2><p>Transparentna forma tipstera.</p></div></div>
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
            <div className="feed-title"><div><h2>Typy tipstera</h2><p>Publiczny feed tego użytkownika.</p></div></div>
            <div className="feed">
              {tipsterTips.length ? tipsterTips.map(tip => <TipCard key={tip.id} tip={tip} unlocked={unlockedTips.has(tip.id)} profileSubscriptionActive={hasActiveTipsterSubscription(tip, tipsterSubscriptions)} onUnlock={onUnlock} onSubscribeToTipster={onSubscribeToTipster} currentUser={currentUser} followingTipsters={followingTipsters} onToggleFollow={onToggleFollow} onOpenTipster={() => {}} />) : <div className="empty-state">Ten tipster nie dodał jeszcze typów.</div>}
            </div>
          </div>
        </>
      )}
    </section>
  )
}


function AddTipForm({ onTipSaved, onToast, user, userPlan = 'free' }) {
  const confidenceDots = Array.from({ length: 15 }, (_, index) => index)

  return (
    <section className="add-page add-tip-ultra-static">
      <div className="static-add-layout">
        <div className="static-add-main glass-ultra-panel">
          <div className="static-add-header">
            <div>
              <div className="static-add-title-row">
                <span className="static-add-title-icon">⬡</span>
                <h1>Dodaj nowy typ</h1>
              </div>
              <p>Stwórz i opublikuj swój typ bukmacherski. Wykorzystaj AI, statystyki i swoją wiedzę.</p>
            </div>
            <button type="button" className="static-add-hints">💡 Wskazówki</button>
          </div>

          <div className="static-add-form-grid">
            <div className="static-add-card">
              <span className="static-add-label">1. Wybór sportu</span>
              <div className="static-add-display"><span>⚽ Piłka nożna</span><b>⌄</b></div>
            </div>

            <div className="static-add-card">
              <span className="static-add-label">2. Liga</span>
              <div className="static-add-display"><span>⚽ Premier League</span><b>⌄</b></div>
            </div>

            <div className="static-add-card">
              <span className="static-add-label">3. Mecz</span>
              <div className="static-add-display static-add-display-double">
                <div className="match-line"><span className="club-badge city">MCI</span><span>Manchester City</span><span className="versus">vs</span><span>Arsenal</span><span className="club-badge arsenal">ARS</span></div>
                <small>25.05.2025, 17:30</small>
              </div>
            </div>

            <div className="static-add-card">
              <span className="static-add-label">4. Typ zakładu</span>
              <div className="static-add-stack">
                <div className="static-add-display"><span>Wynik końcowy</span><b>⌄</b></div>
                <div className="static-add-display"><span>Manchester City wygra</span><b>⌄</b></div>
              </div>
            </div>

            <div className="static-add-card">
              <span className="static-add-label">5. Kurs (średni)</span>
              <div className="static-add-inline-row">
                <div className="static-add-display odds-display"><span>1.72</span></div>
                <div className="auto-pill">✦ Automatycznie <i>●</i></div>
              </div>
            </div>

            <div className="static-add-card">
              <span className="static-add-label">6. Stawka</span>
              <div className="stake-row">
                <div className="static-add-display stake-value"><span>100.00</span></div>
                <div className="static-add-display stake-currency"><span>zł</span><b>⌄</b></div>
              </div>
              <div className="stake-pills">
                <span>10 zł</span>
                <span>50 zł</span>
                <span className="active">100 zł</span>
                <span>200 zł</span>
                <span>500 zł</span>
              </div>
            </div>

            <div className="static-add-card">
              <span className="static-add-label">7. Data i godzina</span>
              <div className="date-time-row">
                <div className="static-add-display"><span>25.05.2025</span><b>🗓</b></div>
                <div className="static-add-display"><span>17:30</span><b>◷</b></div>
              </div>
            </div>

            <div className="static-add-card">
              <span className="static-add-label">8. Opis typu</span>
              <div className="static-add-textarea">
                Manchester City u siebie prezentuje świetną formę, wygrywając 7 z ostatnich 8 spotkań.<br />
                Arsenal ma problemy w defensywie i traci średnio 1.6 gola na wyjazdach.<br />
                Typ oparty na statystykach, formie i analizie AI.
                <small>160 / 500</small>
              </div>
            </div>

            <div className="static-add-card">
              <span className="static-add-label">9. Analiza AI</span>
              <div className="ai-analysis-box">
                <div className="ai-analysis-head"><span className="ai-badge">AI</span><strong>Analiza wygenerowana przez AI</strong></div>
                <p>Model AI ocenia ten typ jako wartościowy.<br />Manchester City ma <b>68% szans</b> na wygraną.<br />Kluczowe przewagi w formie, posiadaniu piłki i skuteczności.</p>
                <button type="button">Generuj ponownie</button>
              </div>
            </div>

            <div className="static-add-card">
              <span className="static-add-label">10. Poziom pewności</span>
              <div className="confidence-head"><strong>Wysoki</strong><b>84%</b></div>
              <div className="confidence-dots">
                {confidenceDots.map((dot) => <i key={dot} className={dot < 10 ? 'active' : ''}></i>)}
              </div>
              <div className="confidence-scale"><span>Niski</span><span>Bardzo wysoki</span></div>
            </div>

            <div className="static-add-card static-span-two">
              <span className="static-add-label">11. Tagi</span>
              <div className="tag-row">
                <span>#PremierLeague</span>
                <span>#ManchesterCity</span>
                <span>#Statystyki</span>
                <span>#AI</span>
                <button type="button">+ Dodaj tag</button>
              </div>
            </div>

            <div className="static-add-card static-span-two publish-card">
              <div>
                <span className="static-add-label">12. Darmowy / Premium</span>
                <p>Wybierz widoczność typu dla użytkowników</p>
              </div>
              <div className="publish-actions">
                <div className="publish-toggle">
                  <button type="button">Darmowy</button>
                  <button type="button" className="active">Premium 👑</button>
                </div>
                <button type="button" className="publish-btn">Opublikuj typ ✈</button>
              </div>
            </div>
          </div>
        </div>

        <aside className="static-add-side">
          <div className="glass-ultra-panel static-side-card preview-card">
            <div className="side-card-head">
              <h3>Podgląd typu</h3>
              <p>Zobacz jak Twój typ będzie wyglądał po publikacji.</p>
            </div>
            <div className="preview-match-card">
              <div className="preview-topline"><span>⚽ PIŁKA NOŻNA ・ PREMIER LEAGUE</span><strong>👑 PREMIUM</strong></div>
              <div className="preview-teams-row">
                <div className="preview-team"><span className="preview-logo city">MCI</span><b>Manchester City</b></div>
                <span className="preview-vs">VS</span>
                <div className="preview-team right"><span className="preview-logo arsenal">ARS</span><b>Arsenal</b></div>
              </div>
              <div className="preview-time">25.05.2025, 17:30</div>
              <div className="preview-stats-grid">
                <div><small>TYP</small><strong>Manchester City wygra</strong></div>
                <div><small>KURS</small><strong>1.72</strong></div>
                <div><small>PEWNOŚĆ</small><strong className="accent">84%</strong></div>
                <div><small>STAWKA</small><strong>100.00 zł</strong></div>
                <div><small>ANALIZA AI</small><strong className="accent">AI Wysoka</strong></div>
                <div><small>DATA DODANIA</small><strong>24.05.2025, 14:32</strong></div>
              </div>
              <div className="preview-ring">↗</div>
            </div>
            <span className="preview-note">* To tylko podgląd. Rzeczywisty wygląd może się nieznacznie różnić.</span>
          </div>

          <div className="glass-ultra-panel static-side-card suggestion-card">
            <div className="small-card-head"><span>🏠 Sugestia AI</span><em>Inteligentna rekomendacja <b>New</b></em></div>
            <div className="suggestion-content">
              <div>
                <p>AI sugeruje, że to wartościowy typ do publikacji.</p>
                <small>Podobne typy w tej lidze miały 61% skuteczności. Rozważ dodanie statystyk H2H dla lepszego zasięgu.</small>
                <button type="button">Zobacz szczegóły analizy</button>
              </div>
              <div className="big-percent">82%</div>
            </div>
          </div>

          <div className="glass-ultra-panel static-side-card history-card">
            <div className="small-card-head"><span>✦ Historia skuteczności</span><select><option>Premier League</option></select></div>
            <p>Twoje statystyki w wybranej lidze</p>
            <div className="history-grid">
              <div><strong>62%</strong><small>Skuteczność</small></div>
              <div><strong>+24.6%</strong><small>ROI</small></div>
              <div><strong>18</strong><small>Typów</small></div>
              <div><strong>11</strong><small>Wygrane</small></div>
            </div>
            <div className="history-chart"><span></span></div>
          </div>

          <div className="glass-ultra-panel static-side-card reach-card">
            <div className="small-card-head"><span>📣 Przewidywany zasięg</span><em>Premium boost</em></div>
            <p>Szacunkowy zasięg Twojego typu</p>
            <div className="reach-grid">
              <div><strong>2.4K – 3.1K</strong><small>Wyświetlenia</small></div>
              <div><strong>180 – 280</strong><small>Interakcje</small></div>
              <div><strong>35 – 60</strong><small>Polubienia</small></div>
            </div>
            <div className="reach-megaphone">📣</div>
          </div>
        </aside>
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

function WalletPanel({ wallet, unlockedTips, tips, onTopUp }) {
  const historyRows = [
    { icon: '▣', title: 'Wpłata BLIK', time: '26.05.2025, 14:23', amount: '+200.00 zł', positive: true },
    { icon: '◎', title: 'Wypłata na konto', time: '27.05.2025, 09:11', amount: '-150.00 zł', positive: false },
    { icon: '★', title: 'Zakup Premium', time: 'Premium 30 dni', amount: '-29.99 zł', positive: false },
    { icon: '✓', title: 'Wygrana kupon', time: '25.05.2025, 22:17', amount: '+320.50 zł', positive: true },
    { icon: 'AI', title: 'Zakup żetonów', time: '25.05.2025, 16:33', amount: '+50', positive: true }
  ]
  const invoiceRows = [
    { title: 'Faktura F/2025/05/128', sub: 'Premium 30 dni', action: 'Pobierz', price: '29.99 zł', date: '26.05.2025' },
    { title: 'Faktura F/2025/04/095', sub: 'Premium 30 dni', action: 'Pobierz', price: '29.99 zł', date: '26.04.2025' },
    { title: 'Faktura F/2025/03/067', sub: 'Żetony (100 szt.)', action: 'Pobierz', price: '149.00 zł', date: '26.03.2025' }
  ]
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

  return (
    <section className="wallet-panel wallet-ultra-page wallet-static-v2">
      <div className="wallet-v2-layout">
        <div className="wallet-v2-main">
          <div className="wallet-v2-header">
            <div>
              <h1>Portfel</h1>
              <p>Zarządzaj swoimi środkami i finansami</p>
            </div>
            <div className="wallet-v2-update">Ostatnia aktualizacja: <b>Teraz</b> ⟳</div>
          </div>

          <div className="wallet-v2-tabs glass-v2-panel">
            <button type="button" className="active">Portfel</button>
            <button type="button">Wpłaty</button>
            <button type="button">Wypłaty</button>
            <button type="button">Płatności</button>
            <button type="button">Subskrypcja</button>
            <button type="button">Zarobki</button>
            <button type="button">Admin finanse</button>
            <button type="button">Admin wypłaty</button>
          </div>

          <div className="wallet-v2-topstats">
            <div className="glass-v2-panel wallet-v2-stat">
              <div className="wallet-v2-stat-top"><span>Saldo główne</span><i>👛</i></div>
              <strong>1,250.75 zł</strong>
              <small>Dostępne środki</small>
            </div>
            <div className="glass-v2-panel wallet-v2-stat">
              <div className="wallet-v2-stat-top"><span>Saldo żetonów</span><i>◌</i></div>
              <strong>86</strong>
              <small>Dostępne żetony</small>
            </div>
            <div className="glass-v2-panel wallet-v2-stat">
              <div className="wallet-v2-stat-top"><span>Wartość żetonów (PLN)</span><i>◍</i></div>
              <strong>129.00 zł</strong>
              <small>1 żeton = 1.50 zł</small>
            </div>
          </div>

          <div className="wallet-v2-midgrid">
            <div className="glass-v2-panel wallet-v2-card">
              <div className="wallet-v2-card-head"><h3>Szybkie operacje</h3></div>
              <div className="wallet-v2-action-grid">
                <button type="button"><b>＋</b><span><strong>Wpłać środki</strong><small>Doładuj konto błyskawicznie</small></span></button>
                <button type="button"><b>⇡</b><span><strong>Wypłać środki</strong><small>Wypłata na konto bankowe</small></span></button>
                <button type="button"><b>◎</b><span><strong>Kup żetony</strong><small>Doładuj swoje żetony</small></span></button>
                <button type="button"><b>◫</b><span><strong>Historia transakcji</strong><small>Zobacz wszystkie operacje</small></span></button>
              </div>
            </div>

            <div className="glass-v2-panel wallet-v2-card">
              <div className="wallet-v2-card-head"><h3>Historia transakcji</h3><button type="button">Zobacz wszystkie</button></div>
              <div className="wallet-v2-history-list">
                {historyRows.map((row, index) => (
                  <div className="wallet-v2-history-item" key={index}>
                    <span className="history-icon">{row.icon}</span>
                    <div className="history-text"><strong>{row.title}</strong><small>{row.time}</small></div>
                    <b className={row.positive ? 'positive' : 'negative'}>{row.amount}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-v2-panel wallet-v2-card">
              <div className="wallet-v2-card-head"><h3>Metody wpłaty</h3></div>
              <p className="wallet-v2-sub">Wybierz preferowaną metodę</p>
              <div className="wallet-v2-payment-grid">
                <div><span className="pay-logo blik">blik</span><strong>BLIK</strong><small>Natychmiast</small></div>
                <div><span className="pay-logo bank">🏛</span><strong>Przelew online</strong><small>Natychmiast</small></div>
                <div><span className="pay-logo card">💳</span><strong>Karta płatnicza</strong><small>Natychmiast</small></div>
                <div><span className="pay-logo paypal">P</span><strong>PayPal</strong><small>Natychmiast</small></div>
                <div><span className="pay-logo gpay">G Pay</span><strong>Google Pay</strong><small>Natychmiast</small></div>
                <div><span className="pay-logo apple"> Pay</span><strong>Apple Pay</strong><small>Natychmiast</small></div>
              </div>
              <button type="button" className="wallet-v2-primary-btn" onClick={onTopUp}>Przejdź do wpłat</button>
            </div>
          </div>

          <div className="wallet-v2-bottomgrid">
            <div className="glass-v2-panel wallet-v2-card">
              <div className="wallet-v2-card-head"><h3>Płatności i faktury</h3></div>
              <p className="wallet-v2-sub">Historia płatności i faktur</p>
              <div className="wallet-v2-invoice-list">
                {invoiceRows.map((row, index) => (
                  <div className="invoice-item" key={index}>
                    <span className="invoice-icon">▤</span>
                    <div className="invoice-info"><strong>{row.title}</strong><small>{row.sub} <em>{row.action}</em></small></div>
                    <div className="invoice-meta"><b>{row.price}</b><small>{row.date}</small></div>
                  </div>
                ))}
              </div>
              <button type="button" className="wallet-v2-primary-btn">Zobacz wszystkie faktury</button>
            </div>

            <div className="glass-v2-panel wallet-v2-card subscription-card-v2">
              <div className="wallet-v2-card-head"><h3>Subskrypcja</h3></div>
              <p className="wallet-v2-sub">Aktywny plan</p>
              <div className="subscription-badge-v2">
                <span className="premium-round">✦</span>
                <div>
                  <strong>Premium</strong>
                  <small>Plan miesięczny</small>
                  <b>29.99 zł / miesiąc</b>
                </div>
              </div>
              <ul className="sub-feature-list">
                <li>Dostęp do typów Premium</li>
                <li>Zaawansowane statystyki</li>
                <li>Typy AI bez limitu</li>
                <li>Priorytetowe powiadomienia</li>
              </ul>
              <div className="renew-info">Następne odnowienie: <b>26.06.2025</b></div>
              <button type="button" className="wallet-v2-primary-btn">Zarządzaj subskrypcją</button>
            </div>

            <div className="glass-v2-panel wallet-v2-card earnings-card-v2">
              <div className="wallet-v2-card-head"><h3>Zarobki twórcy</h3><span>Twoje zarobki jako twórca typów</span></div>
              <div className="earnings-topline">
                <button type="button">Bieżący miesiąc ⌄</button>
                <div><strong>2,450.75 zł</strong><small>+18.5% vs poprzedni miesiąc</small></div>
              </div>
              <div className="earnings-chart-v2">
                <div className="y-labels"><span>30</span><span>20</span><span>10</span><span>0</span></div>
                <div className="chart-area"><span></span></div>
                <div className="x-labels"><small>1 Maj</small><small>8 Maj</small><small>15 Maj</small><small>22 Maj</small><small>29 Maj</small></div>
              </div>
              <button type="button" className="wallet-v2-primary-btn">Szczegółowe statystyki</button>
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
          <p>Nowe typy od obserwowanych tipsterów oraz ważne komunikaty systemowe.</p>
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
            <span>Zaobserwuj tipstera, a po dodaniu przez niego nowego typu zobaczysz tutaj alert.</span>
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

  const myId = user?.id || ''
  const myEmail = normalizeEmail(user?.email || '')

  const displayName = (email = '', username = '') => {
    const clean = normalizeEmail(email)
    if (username) return String(username)
    if (clean === 'smilhytv@gmail.com') return 'Smilhytv'
    return clean ? clean.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Użytkownik'
  }
  const initials = (name = '') => String(name || 'BU').split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'BU'

  const loadUsers = async () => {
    if (!isSupabaseConfigured || !supabase || !myEmail) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,username,created_at')
        .order('created_at', { ascending: false })
        .limit(120)
      if (error) throw error
      const rows = (Array.isArray(data) ? data : [])
        .filter(row => normalizeEmail(row?.email) && normalizeEmail(row?.email) !== myEmail)
        .map(row => ({
          id: row.id,
          email: normalizeEmail(row.email),
          name: displayName(row.email, row.username),
          initials: initials(displayName(row.email, row.username))
        }))
      setUsers(rows)
      setActiveUser(prev => prev && rows.some(row => String(row.id) === String(prev.id)) ? prev : (rows[0] || null))
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
    } catch (error) {
      console.warn('user messages send failed', error)
      setStatus('Wysyłka nie powiodła się. Sprawdź SQL/RLS direct_messages.')
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (!visible || !myId) return undefined
    loadUsers()
    loadUnread()
    const timer = setInterval(() => {
      loadUnread()
      loadConversation(activeUser)
    }, 4000)
    return () => clearInterval(timer)
  }, [visible, myId, activeUser?.id])

  useEffect(() => {
    if (visible && activeUser?.id) loadConversation(activeUser)
  }, [visible, activeUser?.id])

  const filteredUsers = users.filter(item => {
    const q = normalizeEmail(search)
    return !q || normalizeEmail(item.email).includes(q) || normalizeEmail(item.name).includes(q)
  })
  const activeUnread = Object.values(unreadMap).reduce((sum, value) => sum + Number(value || 0), 0)

  return (
    <div className="betai-dm-box">
      <div className="betai-dm-toolbar">
        <div>
          <div className="betai-notify-kicker">USER MESSAGES</div>
          <div className="betai-dm-title">Wiadomości użytkowników</div>
        </div>
        <span className="betai-dm-unread">{activeUnread} nowe</span>
      </div>
      <div className="betai-dm-layout">
        <aside className="betai-dm-users">
          <input className="betai-dm-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj użytkownika..." />
          <div className="betai-dm-user-list">
            {filteredUsers.length ? filteredUsers.map(item => (
              <button type="button" className={activeUser?.id === item.id ? 'betai-dm-user active' : 'betai-dm-user'} key={item.id || item.email} onClick={() => setActiveUser(item)}>
                <span className="betai-dm-avatar">{item.initials}</span>
                <span><strong>{item.name}</strong><small>{item.email}</small></span>
                {Number(unreadMap[item.id] || 0) > 0 && <b>{Number(unreadMap[item.id] || 0)}</b>}
              </button>
            )) : <div className="betai-dm-empty">Brak użytkowników.</div>}
          </div>
        </aside>
        <section className="betai-dm-conversation">
          <div className="betai-dm-active">
            <span className="betai-dm-avatar big">{activeUser?.initials || 'BU'}</span>
            <div><strong>{activeUser?.name || 'Wybierz użytkownika'}</strong><small>{activeUser?.email || 'Prywatny czat user → user'}</small></div>
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
            <div className="betai-notify-sub">Prywatny czat user → user. Ten panel otwiera się z koperty, nie z dzwonka.</div>
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
  const aiCards = [
    {
      leagueFlag: '🇬🇧',
      league: 'Premier League',
      country: 'Anglia',
      home: 'Manchester City',
      away: 'Arsenal',
      homeShort: 'MCI',
      awayShort: 'ARS',
      date: '25.05.2025 • 17:30',
      pickTitle: 'Manchester City wygra',
      pickType: 'Wynik końcowy (1X2)',
      odds: '1.85',
      score: '87%',
      confidence: 'WYSOKA',
      ev: '+0.43',
      evText: 'Wysoka wartość',
      probabilityLabelA: '1',
      probabilityLabelB: 'X',
      probabilityLabelC: '2',
      probA: '56%',
      probB: '24%',
      probC: '20%',
      probWidthA: '56%',
      probWidthB: '24%',
      probWidthC: '20%',
      explanation: 'Manchester City ma przewagę w formie, jakości składu i statystykach H2H. Arsenal traci kluczowych zawodników.'
    },
    {
      leagueFlag: '🇪🇸',
      league: 'La Liga',
      country: 'Hiszpania',
      home: 'Barcelona',
      away: 'Real Sociedad',
      homeShort: 'BAR',
      awayShort: 'RSO',
      date: '25.05.2025 • 21:00',
      pickTitle: 'Powyżej 2.5 gola',
      pickType: 'Suma goli',
      odds: '1.72',
      score: '82%',
      confidence: 'WYSOKA',
      ev: '+0.28',
      evText: 'Dodatnia wartość',
      probabilityLabelA: 'Poniżej 2.5',
      probabilityLabelB: 'Powyżej 2.5',
      probabilityLabelC: '',
      probA: '37%',
      probB: '63%',
      probC: '',
      probWidthA: '37%',
      probWidthB: '63%',
      probWidthC: '0%',
      explanation: 'Obie drużyny notują wysoką skuteczność ofensywną. Średnia goli w ich ostatnich meczach to 3.1.'
    },
    {
      leagueFlag: '🇮🇹',
      league: 'ATP • Roland Garros',
      country: 'Paryż',
      home: 'Carlos Alcaraz',
      away: 'Jannik Sinner',
      homeShort: 'CA',
      awayShort: 'JS',
      date: '26.05.2025 • 15:00',
      pickTitle: 'Carlos Alcaraz wygra',
      pickType: 'Zwycięzca meczu',
      odds: '1.68',
      score: '79%',
      confidence: 'WYSOKA',
      ev: '+0.21',
      evText: 'Dodatnia wartość',
      probabilityLabelA: 'Alcaraz',
      probabilityLabelB: 'Sinner',
      probabilityLabelC: '',
      probA: '59%',
      probB: '41%',
      probC: '',
      probWidthA: '59%',
      probWidthB: '41%',
      probWidthC: '0%',
      explanation: 'Alcaraz lepiej radzi sobie na mączce. Jego return i mobilność dają przewagę w długich wymianach.'
    },
  ]

  const sourceRows = [
    ['Statystyki meczowe', 'AKTYWNE'],
    ['Forma drużyn', 'AKTYWNE'],
    ['Bezpośrednie mecze (H2H)', 'AKTYWNE'],
    ['Kontuzje i zawieszenia', 'AKTYWNE'],
    ['Warunki pogodowe', 'AKTYWNE'],
    ['Ruchy kursów', 'AKTYWNE'],
  ]

  const formRows = [
    { team: 'Manchester City', score: '7.8', chips: ['W', 'W', 'D', 'W', 'W'], tone: 'sky' },
    { team: 'Arsenal', score: '6.4', chips: ['W', 'L', 'D', 'W', 'L'], tone: 'red' },
  ]

  const trends = [
    ['Średnia goli (ostatnie 5)', '2.8'],
    ['Posiadanie piłki (średnia)', '62%'],
    ['Strzały na mecz', '15.2'],
    ['Czyste konta', '3'],
  ]

  return (
    <section className="ai-static-v6">
      <div className="ai-v6-layout">
        <div className="ai-v6-main">
          <div className="ai-v6-hero glass-ai-v6">
            <div>
              <h1>Typy AI</h1>
              <p>Inteligentne typy oparte na zaawansowanej analizie danych i uczeniu maszynowym.</p>
            </div>
            <div className="ai-v6-hero-art" aria-hidden="true">
              <span className="ring one"></span>
              <span className="ring two"></span>
              <span className="mark"></span>
            </div>
          </div>

          <div className="glass-ai-v6 ai-v6-tabs">
            <button type="button" className="active">Wszystkie</button>
            <button type="button">Piłka nożna</button>
            <button type="button">Koszykówka</button>
            <button type="button">Tenis</button>
            <button type="button">Hokej</button>
            <button type="button">Esport</button>
            <button type="button">🇷🇺 Rosja typy</button>
            <button type="button">👑 Premium</button>
            <button type="button">Historia modeli</button>
          </div>

          <div className="glass-ai-v6 ai-v6-filters">
            <div className="filter-box-v6">Wszystkie ligi <span>⌄</span></div>
            <div className="filter-box-v6">Sortuj: Najwyższy AI Score <span>⌄</span></div>
            <div className="toggle-wrap-v6">
              <span>Pokaż tylko wysokie AI Score</span>
              <div className="toggle-v6"><i></i></div>
            </div>
          </div>

          <div className="ai-v6-cards">
            {aiCards.map((card, idx) => (
              <article className="glass-ai-v6 ai-card-v6" key={idx}>
                <div className="ai-card-v6-top">
                  <div className="ai-card-v6-left">
                    <div className="league-line-v6"><span>{card.leagueFlag}</span><strong>{card.league}</strong><small>• {card.country}</small></div>
                    <div className="match-line-v6">
                      <div className="team-v6"><i className={`team-badge-v6 t${idx + 1}`}>{card.homeShort}</i><b>{card.home}</b></div>
                      <span className="versus-v6">vs</span>
                      <div className="team-v6"><i className={`team-badge-v6 away a${idx + 1}`}>{card.awayShort}</i><b>{card.away}</b></div>
                    </div>
                    <div className="kickoff-v6">{card.date}</div>
                  </div>
                  <div className="ai-card-v6-mid">
                    <small>Typ AI</small>
                    <strong>{card.pickTitle}</strong>
                    <span>{card.pickType}</span>
                  </div>
                  <div className="ai-card-v6-odds">
                    <strong>{card.odds}</strong>
                    <span>Kurs</span>
                  </div>
                  <div className="ai-card-v6-score">
                    <small>AI SCORE</small>
                    <div className="score-ring-v6"><b>{card.score}</b></div>
                    <span>PEWNOŚĆ <em>{card.confidence}</em></span>
                  </div>
                  <button type="button" className="collapse-v6">⌃</button>
                </div>

                <div className="ai-card-v6-bottom">
                  <div className="metric-block-v6 ev">
                    <small>WARTOŚĆ OCZEKIWANA (EV)</small>
                    <strong>{card.ev}</strong>
                    <span>{card.evText}</span>
                  </div>
                  <div className="metric-block-v6 probability">
                    <small>PRAWDOPODOBIEŃSTWO</small>
                    <div className="prob-grid-v6">
                      <div>
                        <span>{card.probabilityLabelA}</span>
                        <b>{card.probA}</b>
                        <div className="prob-bar-v6"><i style={{ width: card.probWidthA }}></i></div>
                      </div>
                      <div>
                        <span>{card.probabilityLabelB}</span>
                        <b>{card.probB}</b>
                        <div className="prob-bar-v6 alt"><i style={{ width: card.probWidthB }}></i></div>
                      </div>
                      {card.probabilityLabelC ? (
                        <div>
                          <span>{card.probabilityLabelC}</span>
                          <b>{card.probC}</b>
                          <div className="prob-bar-v6 muted"><i style={{ width: card.probWidthC }}></i></div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="metric-block-v6 explanation">
                    <small>WYJAŚNIENIE AI</small>
                    <p>{card.explanation}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="ai-v6-foot-row">
            <span>Pokazano 1–3 z 24 typów</span>
            <button type="button">⟳ Załaduj więcej</button>
          </div>
        </div>

        <aside className="ai-v6-sidebar">
          <div className="glass-ai-v6 ai-side-card-v6">
            <div className="side-head-v6"><h3>Szczegóły modelu</h3><span>PODGLĄD</span></div>
            <div className="model-copy-v6">
              <strong>Model: Bet+AI v3.2</strong>
              <small>Piłka nożna — Wynik końcowy</small>
              <em>Ostatnia aktualizacja: 24.05.2025 • 12:30</em>
            </div>
            <div className="side-score-wrap-v6">
              <div className="big-score-ring-v6"><b>87%</b></div>
              <div className="score-stats-v6">
                <div><span>PEWNOŚĆ</span><b>WYSOKA</b></div>
                <div><span>STABILNOŚĆ MODELU</span><b>94%</b></div>
                <div><span>DOKŁADNOŚĆ 30D</span><b>71%</b></div>
              </div>
            </div>
            <p className="model-note-v6">Model wykazuje wysoką skuteczność w podobnych typach.</p>
          </div>

          <div className="glass-ai-v6 ai-side-card-v6">
            <div className="side-section-title-v6">ŹRÓDŁA DANYCH</div>
            <div className="source-list-v6">
              {sourceRows.map((row, idx) => (
                <div key={idx}><span>{row[0]}</span><b>{row[1]}</b></div>
              ))}
            </div>
          </div>

          <div className="glass-ai-v6 ai-side-card-v6">
            <div className="side-section-title-v6">ANALIZA FORMY</div>
            <div className="form-list-v6">
              {formRows.map((row, idx) => (
                <div className="form-row-v6" key={idx}>
                  <div className={`form-team-badge-v6 ${row.tone}`}>{row.team.slice(0,2).toUpperCase()}</div>
                  <div className="form-team-copy-v6">
                    <strong>{row.team}</strong>
                    <div className="form-chips-v6">
                      {row.chips.map((chip, i) => <i key={i} className={chip === 'L' ? 'loss' : chip === 'D' ? 'draw' : 'win'}>{chip}</i>)}
                    </div>
                  </div>
                  <div className="form-score-v6"><b>{row.score}</b><span>forma</span></div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-ai-v6 ai-side-card-v6">
            <div className="side-section-title-v6">TRENDY</div>
            <div className="trend-list-v6">
              {trends.map((row, idx) => <div key={idx}><span>{row[0]}</span><b>{row[1]}</b></div>)}
            </div>
          </div>

          <button type="button" className="report-btn-v6">Zobacz pełny raport modelu <span>📈</span></button>
        </aside>
      </div>

      <div className="ai-v6-bottom-links">
        <span>Regulamin</span>
        <span>Polityka prywatności</span>
        <span>O nas</span>
        <span>Kontakt</span>
        <span>FAQ</span>
      </div>
    </section>
  )
}


function LeaderboardView({ tips = [], ranking = [] }) {
  const leaderboardRows = [
    ['1', 'AI Master', 'PRO', '92.4%', '+28.7%', '1,283', '27.4K', '+12,842.35 zł', ['◈','✦','🏅']],
    ['2', 'BetWizard', 'VIP', '89.1%', '+24.3%', '987', '19.8K', '+9,652.20 zł', ['◈','✦','🏅']],
    ['3', 'GreenStrike', 'PRO', '87.6%', '+21.9%', '853', '15.6K', '+7,231.44 zł', ['◈','✦','🏅']],
    ['4', 'StatKing', 'PRO', '85.2%', '+19.6%', '741', '12.3K', '+5,882.11 zł', ['◈','✦','🏅']],
    ['5', 'ValueHunter', 'VIP', '83.7%', '+18.2%', '689', '10.7K', '+4,993.32 zł', ['◈','✦','🏅']],
    ['6', 'Over2Expert', 'PRO', '82.5%', '+16.8%', '612', '9.1K', '+3,842.77 zł', ['◈','✦','🏅']],
    ['7', 'SoccerMind', 'VIP', '81.3%', '+15.3%', '544', '7.8K', '+3,127.09 zł', ['◈','✦','🏅']],
    ['8', 'CornerLord', 'PRO', '79.8%', '+14.1%', '498', '6.3K', '+2,684.51 zł', ['◈','✦','🏅']],
  ]
  const topTipsters = [
    ['1', 'smilhytv', 'Typy: 32 • Win: 76.0% • ROI: 17.2%', '+0.00 zł'],
    ['2', 'buchajsonek1988', 'Typy: 15 • Win: 79.0% • ROI: 14.1%', '+0.00 zł'],
    ['3', 'buchajson1988', 'Typy: 12 • Win: 68.0% • ROI: 11.8%', '+0.00 zł'],
  ]
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
              <p>Rywalizuj z najlepszymi i wspinaj się na szczyt!</p>
            </div>
            <div className="ranking-v4-filters">
              <button type="button">Wszystkie sporty ⌄</button>
              <button type="button">🗓 Tydzień ⌄</button>
            </div>
          </div>

          <div className="glass-ranking-v4 ranking-v4-tabs">
            <button type="button" className="active">Ranking</button>
            <button type="button">Top tipsterzy</button>
            <button type="button">Polecenia</button>
            <button type="button">Liderzy miesiąca</button>
          </div>

          <div className="glass-ranking-v4 ranking-v4-table-card">
            <div className="ranking-v4-table">
              <div className="ranking-v4-row head">
                <span>#</span>
                <span>TIPSTER</span>
                <span>WIN RATE</span>
                <span>ROI</span>
                <span>TYPY</span>
                <span>OBSERWUJĄCY</span>
                <span>ZAROBKI</span>
                <span>ODZNAKI</span>
                <span></span>
              </div>
              {leaderboardRows.map((row, idx) => (
                <div className="ranking-v4-row" key={idx}>
                  <span className={`place-badge-v4 p${row[0]}`}>{row[0]}</span>
                  <span className="tipster-cell-v4">
                    <i className={`tipster-photo-v4 ${idx < 3 ? 'top' : ''}`}>{row[1].slice(0,2).toUpperCase()}</i>
                    <div>
                      <b>{row[1]}</b>
                      <small className={`status-tag-v4 ${row[2].toLowerCase()}`}>{row[2]}</small>
                    </div>
                  </span>
                  <span className="win-v4">{row[3]} ↗</span>
                  <span>{row[4]}</span>
                  <span>{row[5]}</span>
                  <span>{row[6]}</span>
                  <span className="profit-v4">{row[7]}</span>
                  <span className="badges-cell-v4">{row[8].map((b, i) => <i key={i}>{b}</i>)}</span>
                  <span><button type="button" className="follow-btn-v4">Obserwuj</button></span>
                </div>
              ))}
            </div>
            <button type="button" className="full-ranking-btn-v4">Zobacz pełny ranking</button>
          </div>

          <div className="ranking-v4-bottom-grid">
            <div className="glass-ranking-v4 ranking-v4-card hall-card-v4">
              <div className="ranking-v4-card-head"><h3>Galeria sławy</h3></div>
              <div className="hall-stage-v4">
                <div className="hall-copy-v4">
                  <strong>Legendy Bet+AI</strong>
                  <p>Najlepsi z najlepszych. Inspiracja dla wszystkich.</p>
                  <div className="hall-laurels-v4">
                    <span>AI Master<br/><small>Sezon 3 • ROI 42.1%</small></span>
                    <span>BetWizard<br/><small>Sezon 2 • ROI 38.2%</small></span>
                    <span>StatKing<br/><small>Sezon 1 • ROI 35.2%</small></span>
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
              <button type="button" className="active">Top tipsterzy</button>
              <button type="button">Polecenia</button>
              <button type="button">Liderzy miesiąca</button>
            </div>
            <div className="sidebar-head-link-v4">Zobacz wszystkich</div>
            <div className="top-tipsters-list-v4">
              {topTipsters.map((row, idx) => (
                <div className="top-tipster-row-v4" key={idx}>
                  <span className={`mini-rank-v4 r${idx+1}`}>{row[0]}</span>
                  <i className="mini-avatar-v4">{row[1].slice(0,2).toUpperCase()}</i>
                  <div><strong>{row[1]}</strong><small>{row[2]}</small></div>
                  <b>{row[3]}</b>
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
            <div className="bonus-levels-v4">
              {referralBonuses.map((row, idx) => (
                <div className={`bonus-box-v4 ${row[2] ? 'done' : 'locked'}`} key={idx}>
                  <span className="bonus-icon-v4">{row[2] ? '✓' : '🔒'}</span>
                  <strong>{row[0]}</strong>
                  <small>{row[1]}</small>
                </div>
              ))}
            </div>
            <div className="ref-earnings-v4">
              <span>Zarobki z poleceń</span>
              <div className="ref-earnings-grid-v4">
                <div><small>Łącznie</small><b>+124.50 zł</b></div>
                <div><small>W tym miesiącu</small><b>+28.30 zł</b></div>
                <div><small>Oczekujące</small><b>+6.20 zł</b></div>
              </div>
            </div>
            <button type="button" className="details-btn-v4">Zobacz szczegóły</button>
          </div>
        </aside>
      </div>
    </section>
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
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    repeatPassword: '',
    agree: true
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
      languageLabel: 'Język', login: 'Zaloguj się', register: 'Zarejestruj się', heroLine1: 'Dołącz do', heroLine2: 'platformy', subtitle1: 'Zarejestruj się i korzystaj z analityki AI, typów', subtitle2: 'oraz statystyk na żywo.', username: 'Nazwa użytkownika', usernamePlaceholder: 'Wybierz nazwę użytkownika', email: 'Email', emailPlaceholder: 'Wpisz swój adres email', password: 'Hasło', passwordPlaceholder: 'Minimum 8 znaków', repeatPassword: 'Powtórz hasło', repeatPasswordPlaceholder: 'Powtórz swoje hasło', forgot: 'Nie pamiętasz hasła?', encrypted: 'Szyfrowane logowanie', accept1: 'Akceptuję', terms: 'Regulamin', accept2: 'oraz', privacy: 'Politykę prywatności', submitLogin: 'Zaloguj się', submitRegister: 'Załóż konto', authorizing: 'Trwa autoryzacja...', submitNoteLogin: 'Bezpieczne logowanie • szyfrowana autoryzacja Supabase', submitNoteRegister: 'Rejestracja zajmuje mniej niż 30 sekund i aktywuje dostęp do platformy.', socialHeading: 'Śledź nas i dołącz do społeczności', liveKicker: 'REALNE STATYSTYKI LIVE', liveTitle: 'Platforma żyje i odświeża dane na bieżąco', liveBadge: 'LIVE', registeredUsers: 'Zarejestrowanych użytkowników', aiAccuracy: 'Skuteczność AI', activeNow: 'Aktywni teraz', tipsToday: 'Typów dzisiaj', liveLoading: 'Ładowanie statystyk live...', liveRefresh: 'Auto-odświeżanie co 30 s', lastUpdate: 'ostatnia aktualizacja', safeData: 'Bezpieczne dane', safeDataText: 'Twoje dane są u nas w pełni chronione.', fastRegister: 'Szybka rejestracja', fastRegisterText: 'Załóż konto w mniej niż 30 sekund.', freeAi: 'Darmowe typy AI', freeAiText: 'Codziennie nowe typy o wysokiej skuteczności.', community: 'Aktywna społeczność', communityText: 'Tysiące typerów dzieli się wiedzą i wygrywa razem.', showPassword: 'Pokaż hasło', hidePassword: 'Ukryj hasło', showRepeat: 'Pokaż powtórzone hasło', hideRepeat: 'Ukryj powtórzone hasło', resetMissingEmail: 'Wpisz adres email, aby zresetować hasło.', resetSending: 'Wysyłanie linku do resetu hasła...', resetSuccess: 'Link do resetu hasła został wysłany na Twój adres email.', notConfiguredReset: 'Supabase nie jest skonfigurowane. Uzupełnij klucze, aby włączyć reset hasła.', notConfiguredLogin: 'Supabase nie jest skonfigurowane. Uzupełnij klucze, aby włączyć logowanie.', enterEmail: 'Wpisz adres email.', enterPassword: 'Wpisz hasło.', enterUsername: 'Wpisz nazwę użytkownika.', shortPassword: 'Hasło musi mieć minimum 8 znaków.', passwordMismatch: 'Hasła nie są identyczne.', acceptTermsError: 'Zaakceptuj Regulamin oraz Politykę prywatności.', accountCreatedLogged: 'Konto zostało utworzone i jesteś już zalogowany.', accountCreatedConfirm: 'Konto zostało utworzone. Sprawdź skrzynkę email, aby potwierdzić rejestrację.', loginSuccess: 'Logowanie zakończone sukcesem.', dbError: 'Błąd bazy przy rejestracji: uruchom raz plik SUPABASE_RUN_ONCE_FIX_REGISTER_503.sql w Supabase SQL Editor i spróbuj ponownie.', emailLimit: 'Limit wysyłki email został przekroczony. Do testów wyłącz Confirm email albo podłącz Custom SMTP i ustaw większy limit w Supabase.', authFailed: 'Nie udało się wykonać autoryzacji.' },
    en: { languageLabel: 'Language', login: 'Log in', register: 'Register', heroLine1: 'Join the', heroLine2: 'platform', subtitle1: 'Sign up and use AI analytics, picks', subtitle2: 'and live statistics.', username: 'Username', usernamePlaceholder: 'Choose a username', email: 'Email', emailPlaceholder: 'Enter your email address', password: 'Password', passwordPlaceholder: 'Minimum 8 characters', repeatPassword: 'Repeat password', repeatPasswordPlaceholder: 'Repeat your password', forgot: 'Forgot password?', encrypted: 'Encrypted login', accept1: 'I accept the', terms: 'Terms', accept2: 'and', privacy: 'Privacy Policy', submitLogin: 'Log in', submitRegister: 'Create account', authorizing: 'Authorizing...', submitNoteLogin: 'Secure login • encrypted Supabase authorization', submitNoteRegister: 'Registration takes less than 30 seconds and activates platform access.', socialHeading: 'Follow us and join the community', liveKicker: 'REAL LIVE STATS', liveTitle: 'The platform is alive and refreshes data live', liveBadge: 'LIVE', registeredUsers: 'Registered users', aiAccuracy: 'AI accuracy', activeNow: 'Active now', tipsToday: 'Picks today', liveLoading: 'Loading live stats...', liveRefresh: 'Auto-refresh every 30 s', lastUpdate: 'last update', safeData: 'Secure data', safeDataText: 'Your data is fully protected with us.', fastRegister: 'Fast registration', fastRegisterText: 'Create an account in less than 30 seconds.', freeAi: 'Free AI picks', freeAiText: 'New high-accuracy picks every day.', community: 'Active community', communityText: 'Thousands of bettors share knowledge and win together.', showPassword: 'Show password', hidePassword: 'Hide password', showRepeat: 'Show repeated password', hideRepeat: 'Hide repeated password', resetMissingEmail: 'Enter your email to reset the password.', resetSending: 'Sending password reset link...', resetSuccess: 'Password reset link has been sent to your email.', notConfiguredReset: 'Supabase is not configured. Add keys to enable password reset.', notConfiguredLogin: 'Supabase is not configured. Add keys to enable login.', enterEmail: 'Enter your email address.', enterPassword: 'Enter your password.', enterUsername: 'Enter your username.', shortPassword: 'Password must be at least 8 characters.', passwordMismatch: 'Passwords do not match.', acceptTermsError: 'Accept the Terms and Privacy Policy.', accountCreatedLogged: 'Account created and you are already logged in.', accountCreatedConfirm: 'Account created. Check your email to confirm registration.', loginSuccess: 'Login successful.', dbError: 'Database registration error: run SUPABASE_RUN_ONCE_FIX_REGISTER_503.sql once in Supabase SQL Editor and try again.', emailLimit: 'Email sending limit exceeded. For tests disable Confirm email or connect Custom SMTP and set a higher Supabase limit.', authFailed: 'Authorization failed.' },
    de: { languageLabel: 'Sprache', login: 'Einloggen', register: 'Registrieren', heroLine1: 'Tritt der', heroLine2: 'Plattform', subtitle1: 'Registriere dich und nutze KI-Analysen, Tipps', subtitle2: 'und Live-Statistiken.', username: 'Benutzername', usernamePlaceholder: 'Benutzernamen wählen', email: 'E-Mail', emailPlaceholder: 'E-Mail-Adresse eingeben', password: 'Passwort', passwordPlaceholder: 'Mindestens 8 Zeichen', repeatPassword: 'Passwort wiederholen', repeatPasswordPlaceholder: 'Passwort wiederholen', forgot: 'Passwort vergessen?', encrypted: 'Verschlüsselter Login', accept1: 'Ich akzeptiere die', terms: 'AGB', accept2: 'und die', privacy: 'Datenschutzerklärung', submitLogin: 'Einloggen', submitRegister: 'Konto erstellen', authorizing: 'Autorisierung...', submitNoteLogin: 'Sicherer Login • verschlüsselte Supabase-Autorisierung', submitNoteRegister: 'Die Registrierung dauert weniger als 30 Sekunden und aktiviert den Zugang.', socialHeading: 'Folge uns und tritt der Community bei', liveKicker: 'ECHTE LIVE-STATISTIKEN', liveTitle: 'Die Plattform lebt und aktualisiert Daten live', liveBadge: 'LIVE', registeredUsers: 'Registrierte Nutzer', aiAccuracy: 'KI-Trefferquote', activeNow: 'Jetzt aktiv', tipsToday: 'Tipps heute', liveLoading: 'Live-Statistiken werden geladen...', liveRefresh: 'Auto-Aktualisierung alle 30 s', lastUpdate: 'letzte Aktualisierung', safeData: 'Sichere Daten', safeDataText: 'Deine Daten sind vollständig geschützt.', fastRegister: 'Schnelle Registrierung', fastRegisterText: 'Erstelle ein Konto in weniger als 30 Sekunden.', freeAi: 'Kostenlose KI-Tipps', freeAiText: 'Täglich neue Tipps mit hoher Trefferquote.', community: 'Aktive Community', communityText: 'Tausende Tipper teilen Wissen und gewinnen zusammen.', showPassword: 'Passwort anzeigen', hidePassword: 'Passwort verbergen', showRepeat: 'Wiederholtes Passwort anzeigen', hideRepeat: 'Wiederholtes Passwort verbergen', resetMissingEmail: 'Gib deine E-Mail ein, um das Passwort zurückzusetzen.', resetSending: 'Reset-Link wird gesendet...', resetSuccess: 'Der Reset-Link wurde an deine E-Mail gesendet.', notConfiguredReset: 'Supabase ist nicht konfiguriert. Füge Schlüssel hinzu, um den Reset zu aktivieren.', notConfiguredLogin: 'Supabase ist nicht konfiguriert. Füge Schlüssel hinzu, um Login zu aktivieren.', enterEmail: 'E-Mail-Adresse eingeben.', enterPassword: 'Passwort eingeben.', enterUsername: 'Benutzernamen eingeben.', shortPassword: 'Das Passwort muss mindestens 8 Zeichen haben.', passwordMismatch: 'Passwörter stimmen nicht überein.', acceptTermsError: 'Akzeptiere AGB und Datenschutzerklärung.', accountCreatedLogged: 'Konto wurde erstellt und du bist bereits eingeloggt.', accountCreatedConfirm: 'Konto wurde erstellt. Prüfe deine E-Mail zur Bestätigung.', loginSuccess: 'Login erfolgreich.', dbError: 'Datenbankfehler bei Registrierung: führe SUPABASE_RUN_ONCE_FIX_REGISTER_503.sql einmal im Supabase SQL Editor aus.', emailLimit: 'E-Mail-Limit überschritten. Für Tests Confirm email deaktivieren oder Custom SMTP verbinden.', authFailed: 'Autorisierung fehlgeschlagen.' },
    es: { languageLabel: 'Idioma', login: 'Iniciar sesión', register: 'Registrarse', heroLine1: 'Únete a la', heroLine2: 'plataforma', subtitle1: 'Regístrate y usa análisis de IA, pronósticos', subtitle2: 'y estadísticas en vivo.', username: 'Usuario', usernamePlaceholder: 'Elige un usuario', email: 'Email', emailPlaceholder: 'Introduce tu email', password: 'Contraseña', passwordPlaceholder: 'Mínimo 8 caracteres', repeatPassword: 'Repetir contraseña', repeatPasswordPlaceholder: 'Repite tu contraseña', forgot: '¿Olvidaste tu contraseña?', encrypted: 'Login cifrado', accept1: 'Acepto los', terms: 'Términos', accept2: 'y la', privacy: 'Política de privacidad', submitLogin: 'Iniciar sesión', submitRegister: 'Crear cuenta', authorizing: 'Autorizando...', submitNoteLogin: 'Login seguro • autorización cifrada de Supabase', submitNoteRegister: 'El registro tarda menos de 30 segundos y activa el acceso.', socialHeading: 'Síguenos y únete a la comunidad', liveKicker: 'ESTADÍSTICAS LIVE REALES', liveTitle: 'La plataforma vive y actualiza datos en directo', liveBadge: 'LIVE', registeredUsers: 'Usuarios registrados', aiAccuracy: 'Precisión IA', activeNow: 'Activos ahora', tipsToday: 'Pronósticos hoy', liveLoading: 'Cargando estadísticas live...', liveRefresh: 'Auto-actualización cada 30 s', lastUpdate: 'última actualización', safeData: 'Datos seguros', safeDataText: 'Tus datos están totalmente protegidos.', fastRegister: 'Registro rápido', fastRegisterText: 'Crea una cuenta en menos de 30 segundos.', freeAi: 'Pronósticos IA gratis', freeAiText: 'Nuevos pronósticos diarios de alta precisión.', community: 'Comunidad activa', communityText: 'Miles de usuarios comparten conocimiento y ganan juntos.', showPassword: 'Mostrar contraseña', hidePassword: 'Ocultar contraseña', showRepeat: 'Mostrar contraseña repetida', hideRepeat: 'Ocultar contraseña repetida', resetMissingEmail: 'Introduce tu email para restablecer la contraseña.', resetSending: 'Enviando enlace de restablecimiento...', resetSuccess: 'El enlace fue enviado a tu email.', notConfiguredReset: 'Supabase no está configurado. Añade claves para activar el reset.', notConfiguredLogin: 'Supabase no está configurado. Añade claves para activar login.', enterEmail: 'Introduce tu email.', enterPassword: 'Introduce tu contraseña.', enterUsername: 'Introduce tu usuario.', shortPassword: 'La contraseña debe tener al menos 8 caracteres.', passwordMismatch: 'Las contraseñas no coinciden.', acceptTermsError: 'Acepta los Términos y la Política de privacidad.', accountCreatedLogged: 'Cuenta creada y ya has iniciado sesión.', accountCreatedConfirm: 'Cuenta creada. Revisa tu email para confirmar el registro.', loginSuccess: 'Inicio de sesión correcto.', dbError: 'Error de base de datos en registro: ejecuta SUPABASE_RUN_ONCE_FIX_REGISTER_503.sql en Supabase SQL Editor.', emailLimit: 'Límite de envío de email superado. Para pruebas desactiva Confirm email o conecta Custom SMTP.', authFailed: 'No se pudo autorizar.' },
    ru: { languageLabel: 'Язык', login: 'Войти', register: 'Регистрация', heroLine1: 'Присоединяйся к', heroLine2: 'платформе', subtitle1: 'Зарегистрируйся и используй AI-аналитику, прогнозы', subtitle2: 'и live-статистику.', username: 'Имя пользователя', usernamePlaceholder: 'Выберите имя пользователя', email: 'Email', emailPlaceholder: 'Введите email', password: 'Пароль', passwordPlaceholder: 'Минимум 8 символов', repeatPassword: 'Повторите пароль', repeatPasswordPlaceholder: 'Повторите пароль', forgot: 'Забыли пароль?', encrypted: 'Защищенный вход', accept1: 'Я принимаю', terms: 'Условия', accept2: 'и', privacy: 'Политику конфиденциальности', submitLogin: 'Войти', submitRegister: 'Создать аккаунт', authorizing: 'Авторизация...', submitNoteLogin: 'Безопасный вход • шифрованная авторизация Supabase', submitNoteRegister: 'Регистрация занимает меньше 30 секунд и открывает доступ.', socialHeading: 'Подписывайся и вступай в сообщество', liveKicker: 'РЕАЛЬНАЯ LIVE-СТАТИСТИКА', liveTitle: 'Платформа живая и обновляет данные онлайн', liveBadge: 'LIVE', registeredUsers: 'Зарегистрированных пользователей', aiAccuracy: 'Точность AI', activeNow: 'Активны сейчас', tipsToday: 'Прогнозов сегодня', liveLoading: 'Загрузка live-статистики...', liveRefresh: 'Автообновление каждые 30 сек', lastUpdate: 'последнее обновление', safeData: 'Безопасные данные', safeDataText: 'Ваши данные полностью защищены.', fastRegister: 'Быстрая регистрация', fastRegisterText: 'Создайте аккаунт меньше чем за 30 секунд.', freeAi: 'Бесплатные AI-прогнозы', freeAiText: 'Новые точные прогнозы каждый день.', community: 'Активное сообщество', communityText: 'Тысячи игроков делятся знаниями и выигрывают вместе.', showPassword: 'Показать пароль', hidePassword: 'Скрыть пароль', showRepeat: 'Показать повтор пароля', hideRepeat: 'Скрыть повтор пароля', resetMissingEmail: 'Введите email для сброса пароля.', resetSending: 'Отправка ссылки сброса...', resetSuccess: 'Ссылка сброса отправлена на email.', notConfiguredReset: 'Supabase не настроен. Добавьте ключи для сброса пароля.', notConfiguredLogin: 'Supabase не настроен. Добавьте ключи для входа.', enterEmail: 'Введите email.', enterPassword: 'Введите пароль.', enterUsername: 'Введите имя пользователя.', shortPassword: 'Пароль должен быть минимум 8 символов.', passwordMismatch: 'Пароли не совпадают.', acceptTermsError: 'Примите Условия и Политику конфиденциальности.', accountCreatedLogged: 'Аккаунт создан, вы уже вошли.', accountCreatedConfirm: 'Аккаунт создан. Проверьте email для подтверждения.', loginSuccess: 'Вход выполнен успешно.', dbError: 'Ошибка базы при регистрации: один раз запустите SUPABASE_RUN_ONCE_FIX_REGISTER_503.sql в Supabase SQL Editor.', emailLimit: 'Превышен лимит отправки email. Для тестов отключите Confirm email или подключите Custom SMTP.', authFailed: 'Авторизация не выполнена.' }
  }

  function setLanguage(nextLang) {
    if (!supportedAuthLanguages.includes(nextLang)) return
    setAuthLang(nextLang)
    try { localStorage.setItem('betai_language', nextLang) } catch (_) {}
    window.dispatchEvent(new CustomEvent('betai-language-changed', { detail: nextLang }))
  }

  const t = authTranslations[authLang] || authTranslations.pl

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
    const username = String(form.username || '').trim()

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
        if (!username) throw new Error(t.enterUsername)
        if (password.length < 8) throw new Error(t.shortPassword)
        if (password !== form.repeatPassword) throw new Error(t.passwordMismatch)
        if (!form.agree) throw new Error(t.acceptTermsError)

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
              display_name: username
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

  return (
    <div className="auth481-screen" aria-label="Bet+AI authentication panel">
      <div className="auth481-language-corner">
        <BetaiLanguageSwitch lang={authLang} onChange={setLanguage} floating ariaLabel={t.languageLabel} />
      </div>
      <div className="auth481-wrap">
        <div className="auth481-top-grid">
          <section className="auth481-left-card">
            <img src="/auth-brand-470-transparent.png" alt="Bet+AI" className="auth481-logo" draggable="false" />

            <h1 className="auth481-title">
              {t.heroLine1}
              <br />
              {t.heroLine2} <span>AI</span>
            </h1>

            <p className="auth481-subtitle">
              {t.subtitle1}
              <br />
              {t.subtitle2}
            </p>

            <div className={`auth481-tabs ${mode === 'login' ? 'auth481-tabs-login' : 'auth481-tabs-register'}`} role="tablist" aria-label="Choose authentication mode">
              <button
                type="button"
                className={`auth481-tab ${mode === 'login' ? 'is-active' : ''}`}
                onClick={() => switchMode('login')}
              >
                {t.login}
              </button>
              <button
                type="button"
                className={`auth481-tab ${mode === 'register' ? 'is-active' : ''}`}
                onClick={() => switchMode('register')}
              >
                {t.register}
              </button>
            </div>

            <form className={`auth481-form auth481-form-${mode}`} onSubmit={handleSubmit} autoComplete="off">
              {mode === 'register' ? (
                <AuthField
                  label={t.username}
                  value={form.username}
                  onChange={(event) => updateField('username', event.target.value)}
                  placeholder={t.usernamePlaceholder}
                  icon={<IconUser />}
                  autoComplete="off"
                  name="betai_username"
                />
              ) : null}

              <AuthField
                label={t.email}
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                placeholder={t.emailPlaceholder}
                icon={<IconMail />}
                autoComplete={mode === 'login' ? 'username' : 'email'}
                name="betai_email"
              />

              <AuthField
                label={t.password}
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                placeholder={t.passwordPlaceholder}
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

              {mode === 'login' ? (
                <div className="auth481-login-tools">
                  <button type="button" className="auth481-link-button" onClick={handleForgotPassword}>
                    {t.forgot}
                  </button>
                  <span className="auth481-login-badge">{t.encrypted}</span>
                </div>
              ) : null}

              {mode === 'register' ? (
                <AuthField
                  label={t.repeatPassword}
                  type={showRepeatPassword ? 'text' : 'password'}
                  value={form.repeatPassword}
                  onChange={(event) => updateField('repeatPassword', event.target.value)}
                  placeholder={t.repeatPasswordPlaceholder}
                  icon={<IconLock />}
                  autoComplete="new-password"
                  name="betai_repeat_password"
                  rightControl={
                    <button
                      type="button"
                      className="auth481-eye"
                      onClick={() => setShowRepeatPassword(prev => !prev)}
                      aria-label={showRepeatPassword ? t.hideRepeat : t.showRepeat}
                    >
                      <IconEye />
                    </button>
                  }
                />
              ) : null}

              {mode === 'register' ? (
                <label className="auth481-agree">
                  <input
                    type="checkbox"
                    checked={form.agree}
                    onChange={(event) => updateField('agree', event.target.checked)}
                  />
                  <span className="auth481-checkmark" />
                  <span>
                    {t.accept1} <strong>{t.terms}</strong> {t.accept2} <strong>{t.privacy}</strong>
                  </span>
                </label>
              ) : null}

              <button type="submit" className="auth481-submit" disabled={submitting}>
                {submitting ? 'Trwa autoryzacja...' : `${submitLabel} →`}
              </button>
              <div className="auth481-submit-note">{submitNote}</div>
            </form>

            <div className="auth481-social-block" aria-label="Social media Bet+AI">
              <div className="auth481-social-heading">{t.socialHeading}</div>
              <div className="auth481-social-row">
                <a className="auth481-social-link is-telegram" href="#" aria-label="Telegram Bet+AI" title="Telegram">
                  <span className="auth481-social-icon"><IconTelegram /></span>
                  <span>Telegram</span>
                </a>
                <a className="auth481-social-link is-discord" href="#" aria-label="Discord Bet+AI" title="Discord">
                  <span className="auth481-social-icon"><IconDiscord /></span>
                  <span>Discord</span>
                </a>
                <a className="auth481-social-link is-instagram" href="#" aria-label="Instagram Bet+AI" title="Instagram">
                  <span className="auth481-social-icon"><IconInstagram /></span>
                  <span>Instagram</span>
                </a>
                <a className="auth481-social-link is-x" href="#" aria-label="X Bet+AI" title="X">
                  <span className="auth481-social-icon"><IconX /></span>
                  <span>X</span>
                </a>
              </div>
            </div>

            {authMessage ? (
              <div className={`auth481-message ${authMessageType}`} role="status" aria-live="polite">
                {authMessage}
              </div>
            ) : null}
          </section>

          <section className={`auth481-right-column ${mode === 'login' ? 'auth481-right-login' : 'auth481-right-register'}`}>
            <img src="/auth-right-484.png" alt="Bet+AI dashboard preview" className="auth481-right-image" draggable="false" />

            <div className="auth481-live-panel" aria-label="Realne statystyki live Bet+AI">
              <div className="auth481-live-panel-head">
                <div>
                  <span className="auth481-live-kicker">{t.liveKicker}</span>
                  <strong>{t.liveTitle}</strong>
                </div>
                <span className="auth481-live-badge">
                  <span className="auth481-live-dot" />
                  {t.liveBadge}
                </span>
              </div>

              <div className="auth481-live-grid">
                {liveStatsCards.map(card => (
                  <div className={`auth481-live-card ${card.accentClass}`} key={card.key}>
                    <span className="auth481-live-icon">{card.icon}</span>
                    <div className="auth481-live-copy">
                      <strong>{card.value}</strong>
                      <span>{card.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="auth481-live-footnote">
                <span className="auth481-live-footnote-dot" />
                {liveStats.loading
                  ? t.liveLoading
                  : `${t.liveRefresh}${liveStats.updatedAt ? ' • ' + t.lastUpdate + ' ' + new Date(liveStats.updatedAt).toLocaleTimeString(authLang === 'pl' ? 'pl-PL' : authLang === 'de' ? 'de-DE' : authLang === 'es' ? 'es-ES' : authLang === 'ru' ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : ''}`}
              </div>
            </div>
          </section>
        </div>

        <div className="auth481-features-grid">
          <div className="auth481-feature-card">
            <span className="auth481-feature-icon"><IconShield /></span>
            <div>
              <h3>{t.safeData}</h3>
              <p>{t.safeDataText}</p>
            </div>
          </div>
          <div className="auth481-feature-card">
            <span className="auth481-feature-icon"><IconBolt /></span>
            <div>
              <h3>{t.fastRegister}</h3>
              <p>{t.fastRegisterText}</p>
            </div>
          </div>
          <div className="auth481-feature-card">
            <span className="auth481-feature-icon"><IconChart /></span>
            <div>
              <h3>{t.freeAi}</h3>
              <p>{t.freeAiText}</p>
            </div>
          </div>
          <div className="auth481-feature-card">
            <span className="auth481-feature-icon"><IconUsers /></span>
            <div>
              <h3>{t.community}</h3>
              <p>{t.communityText}</p>
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
        <h2>Odblokuj typ premium</h2>
        <p>Stripe Checkout jest gotowy. Dodaj STRIPE_SECRET_KEY w Netlify, aby uruchomić realne płatności.</p>

        <div className="payment-summary">
          <span>Mecz</span>
          <strong>{tip.team_home} vs {tip.team_away}</strong>
        </div>

        <div className="payment-summary">
          <span>Tipster</span>
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
  const tipsterName = tip.author_name || 'Tipster'

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
        <h2>Dostęp do profilu tipstera</h2>
        <p>Kup dostęp do wszystkich typów premium użytkownika <b>{tipsterName}</b>. Platforma zawsze pobiera 20% marży.</p>
        <div className="profile-sub-grid">
          {plans.map(plan => (
            <button key={plan.key} className="profile-sub-option" type="button" onClick={() => buy(plan)} disabled={Boolean(loadingKey)}>
              <strong>{plan.label}</strong>
              <b>{Number(plan.price || 0).toFixed(2)} zł</b>
              <span>Tipster: {(Number(plan.price || 0) * 0.8).toFixed(2)} zł • Platforma: {(Number(plan.price || 0) * 0.2).toFixed(2)} zł</span>
              <em>{loadingKey === plan.key ? 'Łączenie...' : 'Kup dostęp'}</em>
            </button>
          ))}
        </div>
        {error && <div className="payment-error">{error}</div>}
        <button className="payment-secondary" onClick={onClose}>Anuluj</button>
      </div>
    </div>
  )
}


function SubscriptionView({ userPlan = 'free', onUpgrade, onManage }) {
  const isPremium = isPremiumAccount(userPlan)
  return (
    <section className="subscription-page subscription-ultra-page">
      <UltraPageBanner variant="subscriptions">{isPremium ? <button type="button" onClick={onManage}>Zarządzaj subskrypcją</button> : <button type="button" onClick={onUpgrade}>Aktywuj Premium</button>}</UltraPageBanner>
      <div className="subscription-hero subscription-ultra-hero">
        <div className="subscription-hero-copy">
          <span className="subscription-kicker">BETAI PREMIUM ACCESS</span>
          <h1>Subskrypcja BetAI</h1>
          <p>Ultra profesjonalny panel Premium: paywall, sprzedaż typów, AI, statystyki PRO i pełna kontrola subskrypcji przez Stripe.</p>
          <div className="subscription-hero-pills">
            <em>Stripe Billing</em>
            <em>Marketplace PRO</em>
            <em>AI + Statystyki</em>
          </div>
        </div>
        <div className={`subscription-status ${isPremium ? 'active' : 'free'}`}>
          <small>Aktualny plan</small>
          <b>{isPremium ? 'PREMIUM ACTIVE' : 'FREE PLAN'}</b>
        </div>
      </div>

      <div className="pricing-grid subscription-pricing-grid">
        <div className="pricing-card subscription-plan-card free-plan-card">
          <div className="plan-topline">
            <span>FREE</span>
            <em>Start</em>
          </div>
          <strong>0 zł</strong>
          <p>Dostęp do dashboardu, darmowych typów i podstawowych funkcji.</p>
          <ul>
            <li><b>✓</b> 5 darmowych typów dziennie</li>
            <li><b>✓</b> 1 wypłata miesięcznie</li>
            <li><i>✕</i> Sprzedaż typów premium</li>
            <li><i>✕</i> Avatar, bonusy i dropy</li>
          </ul>
        </div>

        <div className="pricing-card featured subscription-plan-card premium-plan-card">
          <div className="plan-topline">
            <span>PREMIUM</span>
            <em>Najlepszy wybór</em>
          </div>
          <strong>29 zł <small>/ miesiąc</small></strong>
          <p>Pełny SaaS plan z paywallem, marketplace premium i narzędziami dla aktywnych tipsterów.</p>
          <ul>
            <li><b>✓</b> Sprzedaż typów premium</li>
            <li><b>✓</b> Brak limitu dodawania typów</li>
            <li><b>✓</b> 3 wypłaty miesięcznie</li>
            <li><b>✓</b> Avatar, AI, statystyki, bonusy i dropy</li>
            <li><b>✓</b> Stripe Billing Portal</li>
          </ul>
          {isPremium ? (
            <button type="button" onClick={onManage}>Zarządzaj subskrypcją</button>
          ) : (
            <button type="button" onClick={onUpgrade}>Aktywuj Premium przez Stripe</button>
          )}
        </div>
      </div>

      <div className="paywall-rules-card subscription-rules-card">
        <div>
          <strong>Paywall aktywny</strong>
          <span>Konto FREE: 5 typów dziennie, 1 wypłata/miesiąc, brak sprzedaży i bonusów. Premium: bez limitu typów, sprzedaż premium, 3 wypłaty/miesiąc, avatar, bonusy, dropy, AI i statystyki PRO.</span>
        </div>
      </div>
    </section>
  )
}
function PaymentsView({ payments }) {
  const total = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)

  return (
    <section className="payments-page">
      <UltraPageBanner variant="payments" />
      <div className="payments-hero">
        <div>
          <h1>Historia płatności</h1>
          <p>Panel zakupów premium i przychodów marketplace.</p>
        </div>
        <div className="payments-total">
          <span>Razem</span>
          <b>{total.toFixed(2)} zł</b>
        </div>
      </div>

      <div className="payments-table">
        <div className="payments-row header">
          <span>Data</span>
          <span>Tip ID</span>
          <span>Status</span>
          <span>Kwota</span>
        </div>

        {payments.length ? payments.map(payment => (
          <div className="payments-row" key={payment.id}>
            <span>{new Date(payment.created_at).toLocaleString('pl-PL')}</span>
            <span>{payment.tip_id || '—'}</span>
            <span className="paid-status">{payment.status || 'paid'}</span>
            <span className="paid-amount">{Number(payment.amount || 0).toFixed(2)} zł</span>
          </div>
        )) : (
          <div className="payments-empty">
            <strong>Brak płatności</strong>
            <span>Po pierwszym zakupie premium transakcja pojawi się tutaj.</span>
          </div>
        )}
      </div>
    </section>
  )
}




function EarningsView({ tips, payments, user, earnings, stripeConnectStatus, onConnectStripe }) {
  const total = Number(earnings?.total || 0)
  const sales = Number(earnings?.sales || 0)
  const history = Array.isArray(earnings?.history) ? earnings.history : []
  const average = sales ? total / sales : 0
  const thisMonth = history.filter(row => {
    const d = new Date(row.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((sum, row) => sum + Number(row.amount || 0), 0)

  return (
    <section className="earnings-page">
      <UltraPageBanner variant="earnings"><button type="button" onClick={onConnectStripe}>{stripeConnectStatus?.stripe_account_id ? 'Dokończ Stripe' : 'Połącz Stripe'}</button></UltraPageBanner>
      <div className="page-title">
        <h1>Zarobki tipstera</h1>
        <p>Realne zarobki są liczone tylko ze sprzedaży premium typów. Platforma pobiera 20% prowizji, a 80% trafia do Ciebie.</p>
      </div>

      <div className="stripe-connect-card">
        <div>
          <strong>🏦 Stripe Connect</strong>
          <span>
            {stripeConnectStatus?.payouts_enabled
              ? 'Konto Stripe jest połączone i gotowe do wypłat.'
              : stripeConnectStatus?.stripe_account_id
                ? 'Konto Stripe jest utworzone. Dokończ onboarding, aby odbierać wypłaty.'
                : 'Połącz konto Stripe, aby admin mógł wypłacać Ci realne zarobki.'}
          </span>
        </div>
        <button type="button" onClick={onConnectStripe}>
          {stripeConnectStatus?.stripe_account_id ? 'Dokończ Stripe' : 'Połącz Stripe'}
        </button>
      </div>

      <div className="earnings-hero">
        <div>
          <span>💰 Zarobiłeś łącznie</span>
          <strong>{total.toFixed(2)} zł</strong>
          <p>Kwota po prowizji platformy.</p>
        </div>
        <div>
          <span>📊 Liczba sprzedaży</span>
          <strong>{sales}</strong>
          <p>Kupione premium typy.</p>
        </div>
        <div>
          <span>📅 Ten miesiąc</span>
          <strong>{thisMonth.toFixed(2)} zł</strong>
          <p>Historia bieżącego miesiąca.</p>
        </div>
        <div>
          <span>Średnio / sprzedaż</span>
          <strong>{average.toFixed(2)} zł</strong>
          <p>Po prowizji 20%.</p>
        </div>
      </div>

      <div className="earnings-table-card">
        <div className="earnings-table-head">
          <h2>Historia zarobków</h2>
          <span>{history.length} transakcji</span>
        </div>

        {history.length ? (
          <table className="earnings-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Kwota dla Ciebie</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row, idx) => (
                <tr key={row.id || idx}>
                  <td>{new Date(row.created_at).toLocaleString('pl-PL')}</td>
                  <td><b>{Number(row.amount || 0).toFixed(2)} zł</b></td>
                  <td><span className="status-pill success">completed</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-wallet">
            <strong>Brak sprzedaży premium</strong>
            <span>Gdy ktoś kupi Twój premium typ, tutaj pojawi się zarobek 80% ceny.</span>
          </div>
        )}
      </div>
    </section>
  )
}



function TipsterPricingSettings({ user, onToast }) {
  const [prices, setPrices] = useState(() => Object.fromEntries(TIPSTER_PLAN_OPTIONS.map(p => [p.key, p.defaultPrice])))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured || !supabase || !user?.id) return
      const { data } = await supabase.from('tipster_plans').select('*').eq('tipster_id', user.id)
      if (Array.isArray(data) && data.length) {
        setPrices(prev => {
          const next = { ...prev }
          data.forEach(row => { if (row.plan_key) next[row.plan_key] = Number(row.price || 0) })
          return next
        })
      }
    }
    load()
  }, [user?.id])

  async function save() {
    if (!user?.id || !supabase) return
    setSaving(true)
    setMessage('')
    const rows = TIPSTER_PLAN_OPTIONS.map(plan => ({
      tipster_id: user.id,
      plan_key: plan.key,
      label: plan.label,
      duration_days: plan.durationDays,
      price: Math.max(1, Number(prices[plan.key] || plan.defaultPrice)),
      active: true
    }))
    const { error } = await supabase.from('tipster_plans').upsert(rows, { onConflict: 'tipster_id,plan_key' })
    setSaving(false)
    if (error) {
      setMessage('Błąd zapisu cen: ' + formatAppErrorMessage(error.message))
      return
    }
    setMessage('✅ Ceny subskrypcji profilu zapisane.')
  }

  return (
    <div className="profile-panel tipster-pricing-panel">
      <div className="profile-panel-head"><h3>Ceny dostępu do profilu</h3><span>20% marży</span></div>
      <p className="small-muted">Sam ustalasz ceny. Kupujący może kupić pojedynczy typ albo dostęp do wszystkich Twoich typów na wybrany okres.</p>
      <div className="pricing-settings-grid">
        {TIPSTER_PLAN_OPTIONS.map(plan => (
          <label key={plan.key}>
            <span>{plan.label}</span>
            <input type="number" step="0.01" min="1" value={prices[plan.key]} onChange={e => setPrices(prev => ({ ...prev, [plan.key]: e.target.value }))} />
            <small>Ty: {(Number(prices[plan.key] || 0) * 0.8).toFixed(2)} zł • Platforma: {(Number(prices[plan.key] || 0) * 0.2).toFixed(2)} zł</small>
          </label>
        ))}
      </div>
      {message && <div className={message.startsWith('✅') ? 'success-message' : 'error-message'}>{message}</div>}
      <button className="submit-btn" type="button" onClick={save} disabled={saving}>{saving ? 'Zapisywanie...' : 'Zapisz ceny dostępu'}</button>
    </div>
  )
}

function ProfileView({ user, tips = [] }) {
  const displayName = 'smilhytv'
  const premiumRows = [
    ['Real Madryt', 'Bayern Monachium', 'Liga Mistrzów • Dzisiaj, 21:00', 'Powyżej 2.5 gola', '1.72', '85%', 'Premium', '12', '2 godz. temu'],
  ]
  const freeRows = [
    ['Arsenal', 'Aston Villa', 'Premier League • Jutro, 17:30', 'Arsenal wygra', '1.65', '78%', 'FREE', '8', '4 godz. temu'],
  ]
  const resultRows = [
    ['Maj 2026', '142', '95', '42', '67%', '+16.3%', '+128.60 zł'],
    ['Kwiecień 2026', '168', '112', '51', '67%', '+12.8%', '+96.40 zł'],
    ['Marzec 2026', '155', '101', '47', '65%', '+10.7%', '+78.30 zł'],
  ]
  const analysisRows = [
    ['AI analiza: Real Madryt vs Bayern', '20.05.2026 • Liga Mistrzów'],
    ['5 value betów na nadchodzący weekend', '19.05.2026 • Premium'],
    ['Statystyki nie kłamią – liga angielska', '18.05.2026 • Analiza'],
  ]
  const summaryRows = [
    ['Użytkownik od', '12.02.2024'],
    ['Ostatnia aktywność', 'Dzisiaj, 12:45'],
    ['Poziom', 'Premium 7'],
    ['Ranking globalny', '#1 (TOP 1%)'],
    ['Preferowane dyscypliny', 'Piłka nożna ⚽'],
  ]
  const recentAchievements = [
    ['TOP 1% RANKINGU', 'Osiągnięcie top 1% najlepszych typerów', '20.05.2026'],
    ['1000+ TYPÓW', 'Opublikowałeś ponad 1000 typów', '14.05.2026'],
    ['WIN RATE 60%+', 'Utrzymujesz skuteczność powyżej 60%', '07.05.2026'],
  ]
  const ratingBars = [
    ['5 ★', '212'], ['4 ★', '18'], ['3 ★', '4'], ['2 ★', '1'], ['1 ★', '1']
  ]
  const rankingRows = [
    ['1', 'smilhytv', '85% ROI', '2 541', '+128.60 zł'],
    ['2', 'buchajsonek1988', '84% ROI', '1 872', '+96.20 zł'],
    ['3', 'p.kucharski', '78% ROI', '1 523', '+74.30 zł'],
  ]

  return (
    <section className="profile-page profile-static-v3" aria-label="Mój profil">
      <div className="profile-v3-layout">
        <div className="profile-v3-main">
          <div className="profile-v3-hero glass-profile-v3">
            <div className="profile-v3-hero-overlay"></div>
            <div className="profile-v3-user-row">
              <div className="profile-v3-avatar">SM</div>
              <div className="profile-v3-user-copy">
                <div className="profile-v3-name-line">
                  <h1>{displayName}</h1>
                  <span className="verify-dot">✓</span>
                </div>
                <small>@smilhytv</small>
                <div className="profile-v3-badges">
                  <span>ADMIN</span>
                  <span>TIPSTER</span>
                  <span>TOP AKTYWNOŚĆ</span>
                </div>
                <p>AI typy sportowe oparte na danych i analizie statystycznej. Specjalizuje się w piłce nożnej i wartościowych kursowych. Gram odpowiedzialnie. Analizuję. Nie kopiuję. Wygrywaj. ✅</p>
                <div className="profile-v3-actions">
                  <button type="button" className="primary">+ Obserwuj</button>
                  <button type="button">▢ Wyślij wiadomość</button>
                  <button type="button">🏆 Wspieraj tipami</button>
                </div>
              </div>
            </div>
            <div className="profile-v3-stats-strip">
              <div><small>ROI</small><strong>85%</strong></div>
              <div><small>WIN RATE</small><strong>68%</strong></div>
              <div><small>SKUTECZNOŚĆ</small><strong>1.72 <em>ŚR. KURS</em></strong></div>
              <div><small>LICZBA TYPÓW</small><strong>1 248</strong></div>
              <div><small>OBSERWUJĄCY</small><strong>2 541</strong></div>
              <div><small>POZIOM</small><strong>Premium 7</strong></div>
              <div><small>ŻETONY</small><strong>86</strong></div>
              <div><small>SALDO</small><strong>0.00 zł</strong></div>
              <div><small>RANKING</small><strong>#1 <em>TOP 1%</em></strong></div>
              <div><small>ŚR. KURS</small><strong>1.72</strong></div>
            </div>
          </div>

          <div className="profile-v3-tabs glass-profile-v3">
            <button type="button" className="active">▣ Przegląd</button>
            <button type="button">◉ Typy</button>
            <button type="button">↗ Wyniki</button>
            <button type="button">⌁ Analizy</button>
            <button type="button">◔ Historia</button>
            <button type="button">💬 Opinie</button>
          </div>

          <div className="profile-v3-content-grid">
            <div className="profile-v3-left-col">
              <div className="glass-profile-v3 profile-v3-card tip-card-v3">
                <div className="profile-v3-card-head"><h3>🏆 Ostatnie typy PREMIUM</h3><button type="button">Zobacz wszystkie</button></div>
                {premiumRows.map((row, idx) => (
                  <div className="tip-preview-v3" key={idx}>
                    <div className="tip-preview-top"><span className="club-round">RM</span><div><strong>{row[0]} <span>vs</span> {row[1]}</strong><small>{row[2]}</small></div></div>
                    <div className="tip-preview-mid">
                      <div><small>TYP</small><b>{row[3]}</b></div>
                      <div><small>KURS</small><b>{row[4]}</b></div>
                      <div><small>AI PEWNOŚĆ</small><b>{row[5]}</b></div>
                    </div>
                    <div className="tip-progress"><span style={{width:'85%'}}></span></div>
                    <div className="tip-preview-foot"><em className="premium-pill">♥ {row[6]}</em><span>{row[7]} ♡</span><span>{row[8]}</span></div>
                  </div>
                ))}
              </div>

              <div className="glass-profile-v3 profile-v3-card tip-card-v3">
                <div className="profile-v3-card-head"><h3>🟢 Ostatnie typy FREE</h3><button type="button">Zobacz wszystkie</button></div>
                {freeRows.map((row, idx) => (
                  <div className="tip-preview-v3 free" key={idx}>
                    <div className="tip-preview-top"><span className="club-round arsenal">AR</span><div><strong>{row[0]} <span>vs</span> {row[1]}</strong><small>{row[2]}</small></div></div>
                    <div className="tip-preview-mid">
                      <div><small>TYP</small><b>{row[3]}</b></div>
                      <div><small>KURS</small><b>{row[4]}</b></div>
                      <div><small>AI PEWNOŚĆ</small><b>{row[5]}</b></div>
                    </div>
                    <div className="tip-progress"><span style={{width:'78%'}}></span></div>
                    <div className="tip-preview-foot"><em className="free-pill">● {row[6]}</em><span>{row[7]} ♡</span><span>{row[8]}</span></div>
                  </div>
                ))}
              </div>

              <div className="glass-profile-v3 profile-v3-card history-v3">
                <div className="profile-v3-card-head"><h3>📊 Historia wyników</h3></div>
                <div className="history-v3-table">
                  <div className="history-v3-row head"><span>OKRES</span><span>TYPY</span><span>WYGRANE</span><span>PRZEGRANE</span><span>WIN RATE</span><span>ROI</span><span>ZYSK</span></div>
                  {resultRows.map((row, idx) => (
                    <div className="history-v3-row" key={idx}>{row.map((cell, i) => <span key={i}>{cell}</span>)}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="profile-v3-right-col">
              <div className="glass-profile-v3 profile-v3-card month-stats-v3">
                <div className="profile-v3-card-head"><h3>📈 Statystyki miesiąca</h3><button type="button">Zobacz więcej</button></div>
                <div className="month-metrics-v3">
                  <div><small>ROI</small><strong>+16.3%</strong></div>
                  <div><small>ZYSK</small><strong>+128.60 zł</strong></div>
                  <div><small>TYPY</small><strong>142</strong></div>
                  <div><small>WIN RATE</small><strong>67%</strong></div>
                </div>
                <div className="month-bars-v3">
                  <div><span>Typy wygrane</span><div className="bar"><i style={{width:'67%'}}></i></div><b>95 (67%)</b></div>
                  <div><span>Typy przegrane</span><div className="bar red"><i style={{width:'30%'}}></i></div><b>42 (30%)</b></div>
                  <div><span>Anulowane</span><div className="bar gray"><i style={{width:'5%'}}></i></div><b>5 (3%)</b></div>
                </div>
              </div>

              <div className="profile-v3-split-row">
                <div className="glass-profile-v3 profile-v3-card about-v3">
                  <div className="profile-v3-card-head"><h3>ⓘ O mnie</h3></div>
                  <p>Nazywam się Smilhytv i od 6 lat analizuję sportowe dane, by znajdować wartościowe typy i przewagę statystyczną. Korzystam z historii meczów oraz AI do oceny ryzyka i value betów. Gram odpowiedzialnie i zachęcam do tego samego. ✅</p>
                  <div className="about-tags"><span>AI ANALIZA</span><span>DANE</span><span>STATYSTYKI</span><span>VALUE BETS</span></div>
                </div>
                <div className="glass-profile-v3 profile-v3-card analysis-v3">
                  <div className="profile-v3-card-head"><h3>Ostatnie analizy</h3><button type="button">Zobacz wszystkie</button></div>
                  <div className="analysis-list-v3">
                    {analysisRows.map((row, idx) => (
                      <div className="analysis-item-v3" key={idx}><span>▣</span><div><strong>{row[0]}</strong><small>{row[1]}</small></div></div>
                    ))}
                  </div>
                  <button type="button" className="link-btn-v3">Więcej analiz →</button>
                </div>
              </div>

              <div className="glass-profile-v3 profile-v3-card badges-v3">
                <div className="profile-v3-card-head"><h3>🏅 Osiągnięcia / Odznaki</h3><button type="button">Zobacz wszystkie</button></div>
                <div className="badges-grid-v3">
                  <div><span className="badge-orb orange">🏆</span><strong>TOP 1%</strong><small>Ranking</small></div>
                  <div><span className="badge-orb gold">✦</span><strong>1000+</strong><small>Typów</small></div>
                  <div><span className="badge-orb cyan">🛡</span><strong>WIN RATE+</strong><small>60%+</small></div>
                  <div><span className="badge-orb teal">↗</span><strong>ROI+</strong><small>10%+</small></div>
                  <div><span className="badge-orb yellow">⚡</span><strong>AKTYWNY</strong><small>30 dni</small></div>
                  <div><span className="badge-orb purple">♛</span><strong>PREMIUM</strong><small>Poziom 7</small></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="profile-v3-sidebar">
          <div className="glass-profile-v3 side-card-v3">
            <div className="side-card-head-v3"><h3>Podsumowanie</h3><span>• ONLINE ●</span></div>
            <div className="key-list-v3">
              {summaryRows.map((row, idx) => <div key={idx}><span>{row[0]}</span><b>{row[1]}</b></div>)}
            </div>
          </div>

          <div className="glass-profile-v3 side-card-v3">
            <div className="side-card-head-v3"><h3>Społeczność</h3><button type="button">Zobacz wszystkich</button></div>
            <div className="community-v3"><div><span>👥 Obserwujący</span><b>2 541</b></div><div><span>👤 Obserwowani</span><b>121</b></div></div>
          </div>

          <div className="glass-profile-v3 side-card-v3">
            <div className="side-card-head-v3"><h3>🌀 Ostatnie osiągnięcia</h3></div>
            <div className="recent-achievements-v3">
              {recentAchievements.map((row, idx) => <div key={idx}><span className={`mini-achieve ${idx===0?'gold':idx===1?'orange':'green'}`}></span><div><strong>{row[0]}</strong><small>{row[1]}</small></div><em>{row[2]}</em></div>)}
            </div>
            <button type="button" className="side-link-v3">Zobacz wszystkie odznaki →</button>
          </div>

          <div className="glass-profile-v3 side-card-v3">
            <div className="side-card-head-v3"><h3>Oceny i opinie</h3><button type="button">Zobacz wszystkie</button></div>
            <div className="ratings-v3">
              <div className="rating-score"><strong>4.9</strong><span>★★★★★</span><small>Na podstawie 236 opinii</small></div>
              <div className="rating-bars">
                {ratingBars.map((row, idx) => <div key={idx}><span>{row[0]}</span><div className="rate-bar"><i style={{width: `${[100,42,18,8,6][idx]}%`}}></i></div><b>{row[1]}</b></div>)}
              </div>
            </div>
          </div>

          <div className="glass-profile-v3 side-card-v3">
            <div className="side-card-head-v3"><h3>Ranking typerów</h3><button type="button">Zobacz ranking</button></div>
            <div className="ranking-v3">
              {rankingRows.map((row, idx) => <div key={idx}><span className="rank-mini">{row[0]}</span><div><strong>{row[1]}</strong><small>{row[2]}</small></div><em>{row[3]}</em><b>{row[4]}</b></div>)}
            </div>
            <button type="button" className="side-link-v3">Pełny ranking →</button>
          </div>
        </aside>
      </div>
    </section>
  )
}


function PayoutsView({ user, tips = [], payments = [], payoutRequests = [], onRequestPayout, userPlan = 'free', stripeConnectStatus, onConnectStripe}) {
  const MIN_PAYOUT_AMOUNT = 50
  if (!user) {
    return (
      <section className="payout-page">
        <div className="payout-loading">
          <strong>Ładowanie wypłat...</strong>
          <span>Trwa pobieranie danych konta.</span>
        </div>
      </section>
    )
  }
  const profile = getUserProfileView(user)
  const myTips = tips.filter(tip => getTipAuthorId(tip) === user?.id)
  const soldPayments = payments.filter(payment => myTips.some(tip => tip.id === payment.tip_id))
  const grossRevenue = soldPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const platformFee = grossRevenue * PLATFORM_COMMISSION_RATE
  const planLimits = getPlanLimits(userPlan)
  const monthlyPayoutCount = getMonthlyCount(payoutRequests)
  const payoutLimitReached = monthlyPayoutCount >= planLimits.monthlyPayoutLimit
  const paidOut = payoutRequests
    .filter(request => request.status === 'paid' || request.status === 'approved')
    .reduce((sum, request) => sum + Number(request.amount || 0), 0)
  const available = Math.max(0, grossRevenue - platformFee - paidOut)
  const hasPending = payoutRequests.some(request => request.status === 'pending')
  const stripeReady = !!stripeConnectStatus?.payouts_enabled
  const canRequestPayout = available >= MIN_PAYOUT_AMOUNT && !hasPending && stripeReady && !payoutLimitReached

  return (
    <section className="payout-page">
      <UltraPageBanner variant="payouts" />
      <div className="payout-hero">
        <div>
          <h1>Wypłaty tipstera</h1>
          <p>{profile.username} — zgłaszaj wypłaty z zarobków premium.</p>
        </div>
        <div className="payout-available">
          <span>Dostępne do wypłaty</span>
          <b>{available.toFixed(2)} zł</b>
        </div>
      </div>

      <div className="payout-grid">
        <div className="payout-stat"><span>Przychód brutto</span><b>{grossRevenue.toFixed(2)} zł</b></div>
        <div className="payout-stat"><span>Prowizja 20%</span><b>{platformFee.toFixed(2)} zł</b></div>
        <div className="payout-stat"><span>Limit wypłat</span><b>{monthlyPayoutCount}/{planLimits.monthlyPayoutLimit}</b></div>
        <div className="payout-stat"><span>Wypłacone / zatwierdzone</span><b>{paidOut.toFixed(2)} zł</b></div>
      </div>

      <div className="payout-request-card">
        <div>
          <strong>Poproś o wypłatę</strong>
          <span>Minimum wypłaty to 50 zł. FREE ma 1 wypłatę/miesiąc, PREMIUM ma 3 wypłaty/miesiąc.</span>
        </div>
        <button disabled={!canRequestPayout} onClick={() => onRequestPayout(Number(available.toFixed(2)))}>
          {hasPending ? 'Masz pending' : payoutLimitReached ? 'Limit wypłat' : !stripeReady ? 'Połącz Stripe' : available < MIN_PAYOUT_AMOUNT ? 'Minimum 50 zł' : 'Poproś o wypłatę'}
        </button>
      </div>

      <div className="payout-table">
        <div className="payout-row header">
          <span>Data</span>
          <span>Kwota</span>
          <span>Status</span>
        </div>

        {payoutRequests.length ? payoutRequests.map(request => (
          <div className="payout-row" key={request.id}>
            <span>{new Date(request.created_at).toLocaleString('pl-PL')}</span>
            <span>{Number(request.amount || 0).toFixed(2)} zł</span>
            <span className={`payout-status ${request.status}`}>{request.status}</span>
          </div>
        )) : (
          <div className="payout-empty">
            <strong>Brak wypłat</strong>
            <span>Twoje zgłoszenia wypłat pojawią się tutaj.</span>
          </div>
        )}
      </div>

      <div className="stripe-connect-note">
        <strong>Następny etap: Stripe Connect</strong>
        <span>Stripe Connect jest aktywny: wypłata zostanie przekazana przez realny Stripe transfer po zatwierdzeniu admina albo przez cron automatycznych wypłat.</span>
      </div>
    </section>
  )
}




function AdminFinanceView({ report, onRefresh }) {
  const tx = Array.isArray(report?.transactions) ? report.transactions : []

  return (
    <section className="admin-finance-page">
      <UltraPageBanner variant="adminFinance"><button type="button" onClick={onRefresh}>Odśwież raport</button></UltraPageBanner>
      <div className="page-title admin-finance-title">
        <div>
          <h1>Admin — raport platformy</h1>
          <p>Kontrola finansów marketplace: sprzedaż, prowizja 20%, zarobki tipsterów i wypłaty.</p>
        </div>
        <button type="button" onClick={onRefresh}>Odśwież raport</button>
      </div>

      <div className="admin-finance-grid">
        <div className="finance-card primary">
          <span>💰 Prowizja platformy 20%</span>
          <strong>{Number(report?.platform_commission || 0).toFixed(2)} zł</strong>
          <p>Twoje przychody z premium sprzedaży.</p>
        </div>
        <div className="finance-card">
          <span>📊 Sprzedaż premium</span>
          <strong>{Number(report?.total_sales || 0)}</strong>
          <p>Liczba kupionych premium typów.</p>
        </div>
        <div className="finance-card">
          <span>🧾 Obrót brutto</span>
          <strong>{Number(report?.gross_sales || 0).toFixed(2)} zł</strong>
          <p>100% ceny premium typów.</p>
        </div>
        <div className="finance-card">
          <span>👥 Zarobki tipsterów</span>
          <strong>{Number(report?.tipster_earnings || 0).toFixed(2)} zł</strong>
          <p>80% sprzedaży dla autorów.</p>
        </div>
        <div className="finance-card">
          <span>✅ Wypłacono</span>
          <strong>{Number(report?.total_payouts || 0).toFixed(2)} zł</strong>
          <p>Zatwierdzone wypłaty tipsterów.</p>
        </div>
        <div className="finance-card warning">
          <span>⏳ Pending wypłaty</span>
          <strong>{Number(report?.pending_payouts || 0).toFixed(2)} zł</strong>
          <p>Zgłoszone, ale jeszcze niewypłacone.</p>
        </div>
      </div>

      <div className="earnings-table-card">
        <div className="earnings-table-head">
          <h2>Ostatnie transakcje marketplace</h2>
          <span>{tx.length} pozycji</span>
        </div>

        {tx.length ? (
          <table className="earnings-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>User ID</th>
                <th>Typ</th>
                <th>Kwota</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tx.map((row, idx) => (
                <tr key={row.id || idx}>
                  <td>{new Date(row.created_at).toLocaleString('pl-PL')}</td>
                  <td><code>{row.user_id}</code></td>
                  <td><span className="status-pill">{row.type}</span></td>
                  <td><b>{Number(row.amount || 0).toFixed(2)} zł</b></td>
                  <td><span className={`status-pill ${row.status === 'completed' ? 'success' : ''}`}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-wallet">
            <strong>Brak transakcji</strong>
            <span>Po pierwszej sprzedaży premium pojawi się tutaj historia.</span>
          </div>
        )}
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
    normalizedStatus: (request.status || 'pending').toLowerCase(),
    amountNumber: Number(request.amount || 0),
    searchText: String((request.id || '') + ' ' + (request.user_id || '') + ' ' + (request.status || '') + ' ' + (request.stripe_status || '') + ' ' + (request.stripe_transfer_id || '')).toLowerCase()
  }))

  const pendingRequests = normalizedRequests.filter(request => request.normalizedStatus === 'pending')
  const processingRequests = normalizedRequests.filter(request => request.normalizedStatus === 'processing')
  const paidRequests = normalizedRequests.filter(request => request.normalizedStatus === 'paid')
  const failedRequests = normalizedRequests.filter(request => request.normalizedStatus === 'failed' || request.stripe_status === 'failed')
  const rejectedRequests = normalizedRequests.filter(request => request.normalizedStatus === 'rejected')
  const payableRequests = pendingRequests.filter(request => request.amountNumber >= 50)
  const totalPending = pendingRequests.reduce((sum, request) => sum + request.amountNumber, 0)
  const totalPaid = paidRequests.reduce((sum, request) => sum + request.amountNumber, 0)
  const automationReady = payableRequests.length > 0

  const filteredRequests = normalizedRequests.filter(request => {
    const matchesStatus = statusFilter === 'all' || request.normalizedStatus === statusFilter
    const matchesQuery = !query.trim() || request.searchText.includes(query.trim().toLowerCase())
    const matchesAmount = amountFilter === 'all'
      || (amountFilter === 'payable' && request.amountNumber >= 50)
      || (amountFilter === 'small' && request.amountNumber < 50)
    return matchesStatus && matchesQuery && matchesAmount
  })

  const selectedRequests = normalizedRequests.filter(request => selectedIds.includes(request.id))
  const selectedPending = selectedRequests.filter(request => request.normalizedStatus === 'pending')

  const toggleSelected = (id) => {
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  const toggleAllVisible = () => {
    const visiblePendingIds = filteredRequests.filter(request => request.normalizedStatus === 'pending').map(request => request.id)
    const allSelected = visiblePendingIds.length > 0 && visiblePendingIds.every(id => selectedIds.includes(id))
    setSelectedIds(current => allSelected ? current.filter(id => !visiblePendingIds.includes(id)) : Array.from(new Set([...current, ...visiblePendingIds])))
  }

  const bulkUpdate = (status) => {
    selectedPending.forEach(request => onUpdateStatus(request.id, status))
    setSelectedIds([])
  }

  const exportCsv = () => {
    const headers = ['user_id', 'created_at', 'amount', 'status', 'stripe_status', 'stripe_transfer_id']
    const rows = filteredRequests.map(request => headers.map(key => '"' + String(request[key] ?? '').replaceAll('"', '""') + '"').join(','))
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'admin-wyplaty-' + new Date().toISOString().slice(0, 10) + '.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const getStripeLabel = (request) => {
    if (request.stripe_transfer_id) return request.stripe_transfer_id
    if (request.normalizedStatus === 'rejected') return 'nie dotyczy'
    if (request.amountNumber < 50 && request.normalizedStatus === 'pending') return 'poniżej minimum'
    if (request.stripe_status === 'failed' || request.normalizedStatus === 'failed') return 'błąd Stripe'
    if (request.normalizedStatus === 'processing') return 'przetwarzanie'
    return 'czeka'
  }

  if (!profile.isAdmin) {
    return (
      <section className="admin-payout-page admin-payout-page-pro">
        <div className="admin-denied">
          <strong>Brak dostępu</strong>
          <span>Ten panel jest dostępny tylko dla administratora.</span>
        </div>
      </section>
    )
  }

  return (
    <section className="admin-payout-page admin-payout-page-pro">
      <UltraPageBanner variant="adminPayouts"><button type="button" onClick={onRunCron}>Uruchom cron wypłat</button></UltraPageBanner>
      <div className="admin-payout-hero admin-payout-hero-pro">
        <div>
          <div className="admin-eyebrow">Stripe Connect · payouts control center</div>
          <h1>Admin wypłaty</h1>
          <p>PRO panel do realnych wypłat Stripe Connect: approve, reject, transfer ID, CSV, filtry i gotowość pod cron.</p>
        </div>
        <div className="admin-payout-badge">ADMIN PRO</div>
      </div>

      <div className="admin-payout-stats admin-payout-stats-pro admin-payout-stat-cards-pro">
        <div><span>Zgłoszenia</span><b>{requests.length}</b><small>Wszystkie zgłoszenia</small></div>
        <div><span>Pending</span><b>{pendingRequests.length}</b><small>{totalPending.toFixed(2)} zł oczekuje</small></div>
        <div><span>Wypłacone</span><b>{paidRequests.length}</b><small>{totalPaid.toFixed(2)} zł zrealizowane</small></div>
        <div><span>Odrzucone</span><b>{rejectedRequests.length}</b><small>Do audytu</small></div>
      </div>

      <div className="admin-payout-summary admin-payout-summary-pro">
        <div>
          <span>Do automatu cron</span>
          <strong>{payableRequests.length}</strong>
          <p>Pending wypłaty od 50 zł gotowe do realnego transferu Stripe.</p>
        </div>
        <div>
          <span>Wymaga uwagi</span>
          <strong>{failedRequests.length + processingRequests.length}</strong>
          <p>Pozycje processing/failed do sprawdzenia w logach Stripe i admin_logs.</p>
        </div>
      </div>

      <div className="admin-cron-card admin-cron-card-pro">
        <div>
          <strong>Automatyczne wypłaty — cron ready <em>Aktywne</em></strong>
          <span>Endpoint <code>/.netlify/functions/process-payouts</code> obsługuje tylko pending wypłaty od 50 zł, blokuje duplikaty statusem processing i używa idempotency key.</span>
        </div>
        <button type="button" className="cron-run-button" onClick={onRunCron} disabled={!automationReady}>{automationReady ? 'Uruchom teraz' : 'Brak pending ≥ 50 zł'}</button>
      </div>

      <div className="admin-payout-toolbar">
        <div className="admin-search-field">
          <span>⌕</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Szukaj po ID użytkownika, statusie, Stripe ID..." />
        </div>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
          <option value="all">Status: wszystkie</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
          <option value="failed">Failed</option>
        </select>
        <select value={amountFilter} onChange={event => setAmountFilter(event.target.value)}>
          <option value="all">Kwota: wszystkie</option>
          <option value="payable">Gotowe ≥ 50 zł</option>
          <option value="small">Poniżej 50 zł</option>
        </select>
        <button type="button" onClick={exportCsv}>Eksport CSV</button>
      </div>

      <div className="admin-bulk-bar">
        <strong>Zaznaczone: {selectedPending.length}</strong>
        <button type="button" disabled={!selectedPending.length} onClick={() => bulkUpdate('paid')}>Zatwierdź wypłaty</button>
        <button type="button" className="danger" disabled={!selectedPending.length} onClick={() => bulkUpdate('rejected')}>Odrzuć</button>
        <button type="button" onClick={() => setSelectedIds([])}>Wyczyść</button>
        <span>{filteredRequests.length} pozycji po filtrze</span>
      </div>

      <div className="admin-payout-table admin-payout-table-pro">
        <div className="admin-payout-row header admin-payout-row-pro">
          <span><input type="checkbox" onChange={toggleAllVisible} checked={filteredRequests.some(r => r.normalizedStatus === 'pending') && filteredRequests.filter(r => r.normalizedStatus === 'pending').every(r => selectedIds.includes(r.id))} /></span>
          <span>User ID</span>
          <span>Data</span>
          <span>Kwota</span>
          <span>Status</span>
          <span>Stripe</span>
          <span>Akcje</span>
        </div>

        {filteredRequests.length ? filteredRequests.map(request => (
          <div className="admin-payout-row admin-payout-row-pro" key={request.id}>
            <span><input type="checkbox" disabled={request.normalizedStatus !== 'pending'} checked={selectedIds.includes(request.id)} onChange={() => toggleSelected(request.id)} /></span>
            <span className="mono">{request.user_id ? request.user_id.slice(0, 8) + '...' : '—'}</span>
            <span>{request.created_at ? new Date(request.created_at).toLocaleString('pl-PL') : '—'}</span>
            <span><b>{request.amountNumber.toFixed(2)} zł</b></span>
            <span className={`payout-status ${request.normalizedStatus}`}>{request.normalizedStatus}</span>
            <span className="admin-stripe-cell">
              <b>{request.stripe_status || (request.normalizedStatus === 'rejected' ? 'rejected' : '—')}</b>
              <small>{getStripeLabel(request)}</small>
            </span>
            <span className="admin-actions">
              {request.normalizedStatus === 'pending' ? (
                <>
                  <button type="button" disabled={request.amountNumber < 50} onClick={() => onUpdateStatus(request.id, 'paid')}>Zatwierdź</button>
                  <button type="button" className="danger" onClick={() => onUpdateStatus(request.id, 'rejected')}>Odrzuć</button>
                </>
              ) : (
                <span className="admin-action-locked">Szczegóły</span>
              )}
            </span>
          </div>
        )) : (
          <div className="admin-empty">
            <strong>Brak zgłoszeń dla wybranych filtrów</strong>
            <span>Zmień status, kwotę lub wyszukiwane ID.</span>
          </div>
        )}
      </div>

      <div className="stripe-connect-note stripe-connect-note-pro">
        <strong>System finalizacji wypłat</strong>
        <span>Manual approve wykonuje realny Stripe transfer. Cron może przetwarzać pending automatycznie, jeżeli ustawisz CRON_SECRET i harmonogram Netlify.</span>
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
    ['1', 'Wybierz tipstera', 'Sprawdź statystyki i wybierz najlepszego.'],
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
              <p>Zweryfikowani tipsterzy, skuteczne analizy i typy, które dają przewagę.</p>
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
            <h2>NAJLEPSI TIPSTERZY</h2>
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
      setRealRanking([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('tipster_ranking')
        .select('*')
        .order('earnings', { ascending: false })
        .limit(5)

      if (error) {
        console.error('fetchRealRanking error', error)
        setRealRanking([])
        return
      }

      setRealRanking(data || [])
    } catch (error) {
      console.error('fetchRealRanking exception', error)
      setRealRanking([])
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

    const sourceTips = (tipsData || []).map(normalizeTipRow)
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

  async function resolveTipsterId(tipsterId, authorName) {
    if (tipsterId) return String(tipsterId)
    if (!authorName || !isSupabaseConfigured || !supabase) return null

    const username = String(authorName).toLowerCase().trim()
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email')
      .limit(100)

    if (error) {
      console.error('resolveTipsterId error', error)
      return null
    }

    const match = (data || []).find(profile => {
      const email = String(profile.email || '').toLowerCase()
      return email === username || email.split('@')[0] === username
    })

    return match?.id ? String(match.id) : null
  }

  async function toggleFollowTipster(tipsterId, authorName) {
    if (!sessionUser?.id) {
      showToast({ type: 'error', title: 'Zaloguj się', message: 'Musisz być zalogowany, aby obserwować tipstera.' })
      return
    }

    if (!isSupabaseConfigured || !supabase) {
      showToast({ type: 'error', title: 'Supabase', message: 'Brak konfiguracji bazy.' })
      return
    }

    const resolvedId = await resolveTipsterId(tipsterId, authorName)
    const id = resolvedId ? String(resolvedId) : null
    if (!id || id === String(sessionUser.id)) {
      showToast({ type: 'info', title: 'Follow', message: 'Nie można obserwować własnego konta albo nie znaleziono tipstera w profiles.' })
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
        return next
      })
      showToast({ type: 'success', title: 'Follow', message: 'Przestałeś obserwować tipstera.' })
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
    showToast({ type: 'success', title: 'Follow', message: 'Obserwujesz tipstera. Powiadomienia pojawią się po nowych typach.' })
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
      showToast({ type: 'success', title: 'Dostęp do profilu', message: 'Płatność zakończona. Dostęp do typów tipstera zostanie odświeżony.' })
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
      setAccountProfile(prev => ({ ...(prev || {}), id: userId || prev?.id || null, email: currentEmail, username: currentEmail.split('@')[0], is_admin: BETAI_ADMIN_EMAILS.includes(currentEmail), is_premium: true, plan: 'premium', subscription_status: 'active' }))
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
      .select('id,email,username,is_admin,is_premium,plan,subscription_status,stripe_customer_id,stripe_subscription_id,current_period_end')
      .eq('id', userId)
      .maybeSingle()

    if (!profileError) profileData = profData

    const subPremium = subscriptionData && (
      subscriptionData.plan === 'premium' || ['active','trialing'].includes(String(subscriptionData.status || '').toLowerCase())
    )
    const profilePremium = isPremiumProfile(profileData)
    const effectivePremium = Boolean(subPremium || profilePremium)

    const effectiveProfile = buildEffectiveAccountProfile({
      ...(profileData || {}),
      id: profileData?.id || userId,
      email: profileData?.email || currentEmail || sessionUser?.email || '',
      username: profileData?.username || (currentEmail ? currentEmail.split('@')[0] : ''),
      is_premium: effectivePremium || Boolean(profileData?.is_premium),
      plan: effectivePremium ? 'premium' : (profileData?.plan || 'free'),
      subscription_status: effectivePremium ? 'active' : (profileData?.subscription_status || 'free')
    }, sessionUser)

    setAccountProfile(effectiveProfile)

    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email: effectiveProfile.email,
        username: effectiveProfile.username || effectiveProfile.email?.split('@')?.[0] || 'user',
        is_admin: Boolean(effectiveProfile.is_admin),
        is_premium: Boolean(effectiveProfile.is_premium),
        plan: effectiveProfile.plan || (effectivePremium ? 'premium' : 'free'),
        subscription_status: effectiveProfile.subscription_status || (effectivePremium ? 'active' : 'free')
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
      setAdminFinanceReport({ platform_commission: 0, total_sales: 0, gross_sales: 0, tipster_earnings: 0, total_payouts: 0, pending_payouts: 0, available_to_payout: 0, transactions: [] })
      return
    }

    try {
      const { data, error } = await supabase.rpc('get_admin_finance_report')

      if (error || !data) {
        setAdminFinanceReport({ platform_commission: 0, total_sales: 0, gross_sales: 0, tipster_earnings: 0, total_payouts: 0, pending_payouts: 0, available_to_payout: 0, transactions: [] })
        return
      }

      setAdminFinanceReport({
        platform_commission: Number(data.platform_commission || 0),
        total_sales: Number(data.total_sales || 0),
        gross_sales: Number(data.gross_sales || 0),
        tipster_earnings: Number(data.tipster_earnings || 0),
        total_payouts: Number(data.total_payouts || 0),
        pending_payouts: Number(data.pending_payouts || 0),
        available_to_payout: Number(data.available_to_payout || 0),
        transactions: Array.isArray(data.transactions) ? data.transactions : []
      })
    } catch (error) {
      console.error('fetchAdminFinanceReport error', error)
      setAdminFinanceReport({ platform_commission: 0, total_sales: 0, gross_sales: 0, tipster_earnings: 0, total_payouts: 0, pending_payouts: 0, available_to_payout: 0, transactions: [] })
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
    if (['notifications', 'payments', 'subscriptions', 'earnings', 'payouts'].includes(view)) {
      setView('dashboard')
    }
  }, [view])

  useEffect(() => {
    const refreshTokens = () => fetchNotifications(sessionUser?.id)
    window.addEventListener('betai-token-balance-changed', refreshTokens)
    return () => window.removeEventListener('betai-token-balance-changed', refreshTokens)
  }, [sessionUser?.id])

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
                <span className="wallet-split-coin" aria-hidden="true">◉</span>
                <span className="wallet-split-token-copy">
                  <strong>{Number(tokenBalance || 0)}</strong>
                  <small>Żetony</small>
                </span>
                <span className="wallet-split-chevron" aria-hidden="true">⌄</span>
              </span>
            </button>
            <button type="button" className={`top-user-chip neutral-top-user-chip role-${getDisplayRole(effectiveAccountProfile, effectiveAccountPlan).toLowerCase()}`} onClick={() => setView('profile')} aria-label="Mój profil">
              <span className="top-user-avatar">{(getProfileUsername(effectiveAccountProfile) || 'U').slice(0,2).toUpperCase()}</span>
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

        {view === 'wallet' && (
          <WalletPanel wallet={walletBalance} unlockedTips={unlockedTips} tips={tips} onTopUp={() => startStripeTopup(100)} />
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

        {view === 'topTipsters' && (
          <TopTipstersView />
        )}

        {view === 'notifications' && (
          <NotificationsView notifications={notifications} onRefresh={() => fetchNotifications(sessionUser?.id)} onMarkAllRead={markAllNotificationsRead} />
        )}

        {view === 'payments' && (
          <PaymentsView payments={paymentHistory} />
        )}

        {view === 'subscriptions' && (
          <SubscriptionView userPlan={effectiveAccountPlan} onUpgrade={runPremiumCheckout} onManage={openCustomerPortal} />
        )}

        {view === 'earnings' && (
          <EarningsView tips={tips} payments={paymentHistory} user={sessionUser} earnings={tipsterEarnings} stripeConnectStatus={stripeConnectStatus} onConnectStripe={connectStripeAccount} />
        )}

        {view === 'profile' && (
          <ProfileView
            user={sessionUser}
            tips={tips}
            payments={paymentHistory}
            unlockedTips={unlockedTips}
            userPlan={effectiveAccountPlan}
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
          <PayoutsView user={effectiveAccountProfile} tips={tips} payments={paymentHistory} payoutRequests={payoutRequests} onRequestPayout={requestTipsterPayout} stripeConnectStatus={stripeConnectStatus} onConnectStripe={connectStripeAccount} userPlan={effectiveAccountPlan} submitting={payoutSubmitting} earnings={tipsterEarnings} />
        )}


        {view === 'adminFinance' && (
          <AdminFinanceView
            report={adminFinanceReport}
            onRefresh={fetchAdminFinanceReport}
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
              {filteredTips.length ? filteredTips.map(tip => <TipCard key={tip.id} tip={tip} unlocked={unlockedTips.has(tip.id)} profileSubscriptionActive={hasActiveTipsterSubscription(tip, tipsterSubscriptions)} onUnlock={unlockTip} onSubscribeToTipster={setSelectedProfileSub} currentUser={effectiveAccountProfile} followingTipsters={followingTipsters} onToggleFollow={toggleFollowTipster} onOpenTipster={setSelectedTipsterId} />) : (
                <div className="empty-state">Brak typów w tym filtrze.</div>
              )}
            </div>
          </section>
        )}
      </main>

      {view === 'dashboard' && !selectedTipsterId && <Rightbar ranking={realRanking} tips={tips} user={sessionUser} />}
      <SiteReviewsWidget user={effectiveAccountProfile || sessionUser} />
      <SupportChatWidget user={effectiveAccountProfile || sessionUser} />
    </div>
  )
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>)
