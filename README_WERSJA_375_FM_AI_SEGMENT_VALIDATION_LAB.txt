BET+AI V375 — FM AI SEGMENT VALIDATION LAB

AUDYT PRZED ZMIANĄ — NIE DUBLOWAĆ ISTNIEJĄCYCH FUNKCJI
=========================================================
Sprawdzone w V374:
- Confidence performance buckets: JUŻ SĄ w Model Intelligence Center V347.
- Edge performance buckets: JUŻ SĄ w Model Intelligence Center V347.
- Odds buckets: JUŻ SĄ w Model Intelligence Center V347.
- CLV / closing line: JUŻ JEST (CLV TRACKER + prediction timeline).
- Model Health: JUŻ JEST, w tym LAST 30 / 100 / 500.
- Calibration / Brier / reliability: JUŻ SĄ.
- League & Market Trust / Red Flag Guard: JUŻ SĄ.
- Best daily pick / Top Picks: JUŻ SĄ.
- League drilldown with market stats: JUŻ JEST od V374.

DLATEGO V375 NIE TWORZY DRUGIEJ KOPII TYCH MODUŁÓW.

NOWOŚĆ V375
============
Jedyna nowa warstwa to SEGMENT LAB — LIGA × RYNEK w pełnych statystykach FM AI.
Łączy ligę z konkretnym rynkiem, np.:
- Serie A × Over 2.5
- La Liga × Under 3.5
- Eredivisie × BTTS Yes

i pokazuje:
- liczbę rozliczonych typów,
- W/L,
- hit rate,
- średni kurs,
- bilans,
- yield,
- jakość / dojrzałość próbki.

Dodatkowo:
- TOP 3 najlepsze obecne segmenty,
- TOP 3 segmenty do obserwacji,
- ranking dopiero od minimum 5 rozliczonych typów,
- etykiety próbki: LOW SAMPLE / EARLY SIGNAL / VALIDATING / STRONG SAMPLE.

WAŻNE
=====
- V375 nie zmienia modelu prognostycznego i nie blokuje automatycznie rynków.
- To jest warstwa walidacyjna, aby nie overfitować modelu na małej próbce.
- Nie wymaga nowego SQL ani migracji Supabase.
- Nadal używa istniejącej tabeli public.fm_ai_system_picks_v368.
- Auto Tracker 24/7 z V374 pozostaje bez zmian.
- Wszystkie istniejące V347/V374 statystyki pozostają bez zmian.

TESTY
=====
TEST_WERSJA_375_FM_AI_SEGMENT_VALIDATION_LAB.cjs — OK
TEST_WERSJA_347_FM_AI_MODEL_INTELLIGENCE.cjs — OK
TEST_WERSJA_352_FM_AI_PERSISTENT_CACHE.cjs — OK
TEST_WERSJA_353_MASTER_CONSENSUS.cjs — OK
