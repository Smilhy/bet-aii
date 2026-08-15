BETAI WERSJA 1846 — NOWY TYPER „OGRAĆ BUKA”

Zakres zmian
- Dodano wyłącznie nowy profil systemowy: Ograć Buka.
- Nie zmieniono Typer Expert, BetAI MultiSport AI ani pozostałej logiki strony.
- Konto jest FREE i publikuje darmowe typy.

Strategia
- Źródło danych: wyłącznie API-Football.
- Dane: fixtures, kursy kilku bukmacherów, predictions, porównanie formy/ataku/obrony/Poissona/H2H oraz injuries.
- Brak kursów syntetycznych.
- Brak progresji i gonienia strat.
- Stała wirtualna stawka: 1 jednostka.
- Maksymalnie jeden aktywny typ oraz 20 godzin cooldown między publikacjami.
- Skan co 3 godziny o minutach 10: 00:10, 03:10, 06:10, 09:10, 12:10, 15:10, 18:10, 21:10 UTC.
- Rozliczanie co godzinę o minucie 52.

Domyślne filtry
- minimum 4 bukmacherów,
- kurs 1.45–2.20,
- konsensus rynku minimum 58%,
- wstępne value minimum 3%,
- mała rozbieżność prawdopodobieństw i kursów,
- API-Football score minimum 65,
- API probability minimum 58% dla 1X2,
- combined score minimum 68,
- konserwatywne value po redukcji niepewności minimum 2.5%,
- wykluczone: młodzież, rezerwy, kobiety, sparingi, ligi amatorskie i regionalne.

Wdrożenie
1. Wgraj całą paczkę jako production deploy na Netlify.
2. Nie trzeba uruchamiać SQL.
3. W Netlify musi istnieć klucz API-Football pod jedną z nazw:
   APISPORTS_KEY / API_SPORTS_KEY / API_FOOTBALL_KEY.
4. Wykonaj Ctrl+Shift+R.

Test bez publikowania
https://bet-ai.app/.netlify/functions/publish-ograc-buka?dry_run=1

Normalne ręczne uruchomienie
https://bet-ai.app/.netlify/functions/publish-ograc-buka

Rozliczanie ręczne
https://bet-ai.app/.netlify/functions/settle-ograc-buka

Wynik testu
- inserted: 1 — typ został opublikowany,
- inserted: 0 — brak typu spełniającego filtry,
- skipped: previous_pick_pending — poprzedni typ nadal oczekuje,
- skipped: cooldown — nie minął limit czasu od poprzedniego typu.

Ważne
To jest model testowy z wirtualną stawką. Nie gwarantuje zysku ani stałego dochodu. Jego jakość należy oceniać po dużej próbie przyszłych typów przy niezmienionych regułach.
