WERSJA 3 - LIVE CHAT FIX

Naprawiono problem, w którym konto admina nie widziało wiadomości wysyłanych z drugiego konta.

Zmiany:
- live chat odświeża się automatycznie co 2 sekundy jako zabezpieczenie,
- Realtime Supabase dostał poprawiony kanał i status połączenia,
- dodano BroadcastChannel/localStorage ping dla kart w tej samej przeglądarce,
- poprawiono SQL: live_chat_messages, live_chat_tips i live_chat_daily_rewards są dodane do supabase_realtime,
- poprawiono RLS dla emaili niezależnie od wielkości liter,
- jeśli baza nie działa, aplikacja pokazuje jasny komunikat zamiast udawać live.

WAŻNE:
Jeśli wiadomości dalej nie przechodzą między różnymi kontami/urządzeniami, uruchom w Supabase plik:
SUPABASE_LIVE_CHAT_V226.sql

Bez tego czat może działać tylko lokalnie w przeglądarce.
