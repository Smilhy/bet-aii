BETAI — WERSJA 6

NAPRAWA: DNB JEST ROZLICZANE PO 90 MINUTACH, BEZ DOGRYWKI I KARNYCH

Znaleziony błąd:
- dodawanie typu DNB było już rozpoznawane poprawnie,
- błąd był później, podczas pobierania wyniku z API-Football,
- automat brał najpierw pole `goals`, które przy statusie AET/PEN może zawierać
  wynik po dogrywce lub karnych,
- dla Belgia — Senegal wynik po 90 minutach 2:2 został przez to potraktowany jak
  końcowa wygrana Belgii i DNB dostało status WON.

Naprawa:
- standardowe rynki piłkarskie używają teraz najpierw `score.fulltime` (90 minut),
- DNB przy remisie po 90 minutach zawsze daje VOID / ZWROT,
- profit = 0,
- payout i return_amount = stawka,
- naprawa obejmuje auto-settle-tips, settle-live-ai-picks, Typer Expert i Ograć Buka,
- stare błędnie rozliczone DNB są ponownie sprawdzane znacznikiem wersji 6,
- dodano fallback dla różnych wersji schematu Supabase, aby brak opcjonalnej
  kolumny (np. settlement_reason) nie blokował całej aktualizacji.

Po deployu:
1. Otwórz zakładkę Dashboard albo Mój profil. Automat uruchomi naprawę sam.
2. Możesz też wywołać:
   /.netlify/functions/auto-settle-tips?limit=500&repair_dnb=1
3. Aby zmienić dokładnie rekord smilhytv od razu, uruchom w Supabase SQL Editor:
   SUPABASE_RUN_ONCE_WERSJA_6_BELGIA_SENEGAL_DNB_ZWROT.sql

Test lokalny:
  npm run test:settlement

Oczekiwany wynik testu:
  OK: DNB jest rozliczane po 90 minutach, remis 2:2 daje VOID/ZWROT, payout = stawka.
