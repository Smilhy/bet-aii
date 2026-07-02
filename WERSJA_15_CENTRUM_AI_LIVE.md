# BetAI Wersja 15 — Centrum Kontroli AI LIVE

## Nowa zakładka

Zakładka **🛰 Centrum AI** jest widoczna wyłącznie dla administratora i znajduje się bezpośrednio po **AI Prediction**.

## Realne dane

Panel nie używa danych demonstracyjnych. Odczytuje:

- realne rekordy `tips`, `ai_bets` i `ai_prediction_history` z Supabase,
- prawdziwy stan API-Sports wraz z limitem zapytań,
- realne logi funkcji Netlify zapisane w `ai_system_runs`,
- status brakujących `fixture_id`,
- oczekujące i przeterminowane typy,
- ostatnie oraz następne uruchomienia harmonogramów.

Dane odświeżają się automatycznie co 30 sekund.

## Kontrolowane systemy

1. BetAI MultiSport AI
2. Typer Expert
3. Ograć Buka
4. AI Prediction

Każda karta pokazuje ostatni skan, ostatnie rozliczenie, następny harmonogram, liczbę kandydatów, dodanych i rozliczonych rekordów, oczekujące rekordy oraz ostatnie błędy.

## Ręczne akcje

Administrator może uruchomić:

- skan pojedynczego systemu,
- rozliczanie pojedynczego systemu,
- skan wszystkich systemów,
- rozliczanie wszystkich systemów.

Typer Expert nadal respektuje blokadę oczekującego typu i progresję — przycisk nie omija zasad strategii.

## Bezpieczeństwo

Endpoint `ai-control-center` wymaga aktywnego tokenu Supabase i weryfikuje konto administratora po stronie Netlify. Klucz Service Role ani API-Sports nie trafia do przeglądarki.

## Wdrożenie

1. Uruchom `SUPABASE_RUN_ONCE_WERSJA_15_CENTRUM_AI.sql` w Supabase SQL Editor.
2. Wdróż pełny projekt przez Git albo Netlify CLI.
3. Zaloguj się jako administrator i otwórz **Centrum AI**.
4. Po pierwszym wdrożeniu użyj przycisku „Skanuj wszystkie” albo poczekaj na harmonogram, aby wypełnić dziennik uruchomień.
