BetAI WERSJA 57 — MOBILE FAST START / SESSION PERFORMANCE

Baza: działająca Wersja 56 ZOOM INFO ALWAYS OPEN (zbudowana z V55).
Nie użyto odrzuconej wersji Mobile Lite.

Zmiany wydajnościowe na telefonach:
1. Powracający zalogowany użytkownik jest renderowany od razu z lokalnej sesji Supabase.
2. Limit blokowania „Ładowanie sesji…”: telefon 1.4 s, desktop 3.5 s (wcześniej 6.5 s).
3. Pierwszy mobilny feed typów pobiera tylko 160 rekordów i pokazuje Dashboard szybko.
4. Pełna hydracja typów uruchamia się dopiero po 8 s w tle.
5. Dane niepotrzebne do pierwszego renderu (płatności, wypłaty, earnings, referrals, Stripe) są rozłożone w czasie.
6. Live Chat startuje po 1.8 s na telefonie; awaryjny polling 60 s zamiast 15 s.
7. Online count: 90 s zamiast 30 s na telefonie.
8. Avatar fallback Live Chat nie pobiera już 150 typów przy każdym refreshu — ma 10-minutowy cache i limit 80 na telefonie.
9. Główny soft-poll typów: 90 s zamiast 30 s na telefonie (Supabase Realtime nadal działa).
10. Coin/powiadomienia/tip-transfer fallback polling: 120 s na telefonie; realtime pozostaje aktywny.
11. Auto-settlement oraz admin bot maintenance są odsunięte od pierwszych sekund startu.
12. Presence heartbeat na telefonie: 40 s zamiast 20 s, nadal mieści się w oknie ONLINE 75 s.

Nie zmieniono:
- wyglądu strony,
- formularza dodawania typów,
- kursów i stawek,
- rozliczania wyników,
- logiki Premium,
- tabel/SQL Supabase,
- mechanizmu Realtime.

Nie potrzeba SQL.
