BET+AI WERSJA 146 — ALL-IN INTELLIGENCE UPGRADE

W jednej wersji połączono plan v141-v146:

1. CALIBRATION ENGINE 2.0
- RAW probability pozostaje zapisane do audytu.
- Fair odds / Value używają probability po kalibracji historycznej.
- Korekta jest częściowa i rośnie z wielkością próbki; historia nigdy nie zastępuje całkowicie bieżącego modelu.
- Liga jest używana dopiero, gdy ma odpowiednią próbkę; inaczej fallback globalny.

2. ODDS HISTORY + CLV FOUNDATION
- Kursy już pobrane przez pełną analizę są zapisywane w Supabase.
- Zero dodatkowych requestów API-Football do samego zapisu historii.
- Powtarzający się identyczny kurs nie jest zapisywany częściej niż co 10 minut.
- CLV jest pokazywane tylko, gdy ostatni zapis kursu jest wystarczająco blisko kickoffu; wcześniej UI pokazuje ruch OPEN -> LAST.

3. DYNAMIC SOURCE WEIGHTING
- Statystyki pozostają głównym niezależnym źródłem.
- Waga API i web consensus zmienia się zależnie od dostępności, zgodności i historycznej jakości modelu.
- Kurs bukmachera nie jest mieszany do prognozy tylko po to, żeby tworzyć sztuczne value; jest niezależnym benchmarkiem cenowym.

4. TOP 5 ANALIZ DNIA
- Value Scanner tworzy Daily Shortlist max 5 kandydatów.
- Pre-scan również stosuje historyczną korektę probability, jeśli próbka pozwala.
- Full match analysis nadal jest ostateczną weryfikacją.

5. EXPLAINABLE AI
- Panel pokazuje czynniki wspierające prognozę i ryzyka/ograniczenia.
- Nie wymyśla źródeł ani zawodników.

6. EVENT ENGINE 2.0
- Rzuty wolne.
- Czerwone kartki z wpływem na possession/compactness.
- Realni rezerwowi przy zmianach, jeśli są dostępni; bez wymyślania nazwisk.
- Zmiany taktyczne zależne od symulowanego wyniku.
- Zmęczenie po 55 min i częściowe odświeżenie po zmianach.
- Gol z karnego może być źródłem już istniejącego modelowego gola — nie dodaje losowego ekstra gola.
- Full Time Report.

WAŻNE:
Uruchom raz SUPABASE_RUN_ONCE_WERSJA_146_ALL_IN_INTELLIGENCE.sql.
Kalibracja i CLV wymagają danych historycznych; przy małej próbce system pokazuje PENDING zamiast udawać pewność.
