import React, { useCallback, useEffect, useRef, useState } from 'react'
import MatchSimulatorIntroView from './MatchSimulatorIntroView'
import MatchSimulatorView from './MatchSimulatorView'
import MatchSimulatorDailyMatchesView from './MatchSimulatorDailyMatchesView'
import MatchSimulatorPreparationView from './MatchSimulatorPreparationView'



// V335 — presentation-only EN translator for the whole AI Simulation flow.
// It translates remaining legacy Polish labels/commentary without touching model logic,
// API payloads, market keys, forecasts or simulation state.
const SIMULATOR_EN_REPLACEMENTS_V335 = [
  [/TOP 5 ANALIZ DNIA/g, 'TOP 5 DAILY ANALYSES'],
  [/Value Scanner wybiera maksymalnie 5 najmocniejszych kandydatów z topowych lig \+ Ekstraklasy\. RAW jest korygowane historyczną kalibracją; pełna analiza pozostaje końcową weryfikacją\./g, 'Value Scanner selects up to 5 strongest candidates from the approved top leagues. RAW probabilities are adjusted by historical calibration; full analysis remains the final verification.'],
  [/SKANOWANIE LIVE/g, 'LIVE SCANNING'], [/SKAN GOTOWY/g, 'SCAN COMPLETE'],
  [/Sprawdzam realne statystyki meczów…/g, 'Checking real match statistics…'], [/sprawdzonych/g, 'checked'],
  [/17 WYBRANYCH LIG/g, '17 APPROVED LEAGUES'], [/TYLKO 17 WYBRANYCH ROZGRYWEK/g, 'ONLY 17 APPROVED COMPETITIONS'],
  [/znaleziono/g, 'found'], [/meczów widocznych/g, 'matches visible'], [/gotowych po pre-checku/g, 'ready after pre-check'], [/sprawdzam jakość/g, 'checking quality'],
  [/Brak kolejnych meczów z topowych lig na dzisiaj\./g, 'No more approved top-league fixtures today.'],
  [/Brak kolejnych nierozpoczętych meczów na dzisiaj\./g, 'No more upcoming fixtures today.'],
  [/brak meczów spełniających próg realnych statystyk/g, 'no matches meet the real-statistics threshold'],
  [/Budget Guard nie ukrywa już późniejszych spotkań/g, 'Budget Guard no longer hides later fixtures'],
  [/NAJLEPSZY RYNEK AI/g, 'BEST AI MARKET'], [/NAJMOCNIEJSZY KIERUNEK AI/g, 'STRONGEST AI DIRECTION'],
  [/KURSY 1X2/g, '1X2 ODDS'], [/BRAK KURSÓW/g, 'NO ODDS'], [/Brak kursów/g, 'No odds'], [/Realny kurs/g, 'Real odds'], [/Brak kursu rynkowego/g, 'No market odds'], [/FAIR modelu/g, 'model FAIR'], [/\bKURS\b/g, 'ODDS'], [/Dostępne wkrótce/g, 'Available soon'], [/Pobieram kursy…/g, 'Loading odds…'],
  [/RYNEK GOLOWY/g, 'GOALS MARKET'], [/RYNEK BTTS/g, 'BTTS MARKET'], [/RYNEK 1X2/g, '1X2 MARKET'], [/RYNEK/g, 'MARKET'],
  [/Powyżej 1\.5 gola/g, 'Over 1.5 goals'], [/Poniżej 1\.5 gola/g, 'Under 1.5 goals'], [/Powyżej 2\.5 gola/g, 'Over 2.5 goals'], [/Poniżej 2\.5 gola/g, 'Under 2.5 goals'], [/Powyżej 3\.5 gola/g, 'Over 3.5 goals'], [/Poniżej 3\.5 gola/g, 'Under 3.5 goals'],
  [/Obie drużyny strzelą/g, 'Both teams to score'], [/Nie obie strzelą/g, 'Both teams not to score'],
  [/Remis w meczu/g, 'Match draw'], [/Typ: mecz zakończy się remisem/g, 'Pick: match to finish level'], [/Typ: wygrana gospodarzy/g, 'Pick: home win'], [/Typ: wygrana gości/g, 'Pick: away win'],
  [/Typ: minimum 2 gole w meczu/g, 'Pick: at least 2 goals'], [/Typ: minimum 3 gole w meczu/g, 'Pick: at least 3 goals'], [/Typ: minimum 4 gole w meczu/g, 'Pick: at least 4 goals'],
  [/Typ: maksymalnie 1 gol w meczu/g, 'Pick: maximum 1 goal'], [/Typ: maksymalnie 2 gole w meczu/g, 'Pick: maximum 2 goals'], [/Typ: maksymalnie 3 gole w meczu/g, 'Pick: maximum 3 goals'],
  [/Typ: obie drużyny zdobędą gola/g, 'Pick: both teams score'], [/Typ: przynajmniej jedna drużyna bez gola/g, 'Pick: at least one team does not score'],
  [/Wygra ([^\n•]+)/g, '$1 to win'],
  [/\bDOM\b/g, 'HOME'], [/\bREMIS\b/g, 'DRAW'], [/GOŚCIE/g, 'AWAY'], [/GOSPODARZE/g, 'HOME'],
  [/NAJBLIŻSZY MECZ/g, 'NEXT MATCH'], [/Start za/g, 'Starts in'],

  [/Przygotowanie meczu/g, 'Match preparation'], [/Pobieramy prawdziwe dane przed uruchomieniem silnika meczu\./g, 'We load real pre-match data before starting the match engine.'],
  [/Analizuję dane meczu…/g, 'Analysing match data…'], [/Uruchom symulację/g, 'Start simulation'], [/Wróć do meczów/g, 'Back to matches'], [/Spróbuj ponownie/g, 'Try again'],
  [/Kompletność danych/g, 'Data completeness'], [/Symulacja predykcyjna — wynik nie jest rzeczywistym wynikiem przyszłego meczu\./g, 'Predictive simulation — this is not the actual future match result.'],
  [/Forma drużyn/g, 'Team form'], [/Składy XI/g, 'Starting XI'], [/Statystyki drużyn/g, 'Team statistics'], [/Sprawdzone/g, 'Checked'], [/Brak danych/g, 'Unavailable'],
  [/Nie udało się zbudować XI/g, 'Could not build XI'], [/Realne kursy dostępne/g, 'Real odds available'], [/Brak realnych kursów/g, 'No real odds'], [/Brak historii H2H/g, 'No H2H history'], [/Brak zgłoszonych absencji/g, 'No reported absences'],
  [/Część źródeł chwilowo nie odpowiedziała\. Model użyje wyłącznie dostępnych danych\./g, 'Some sources did not respond. The model will use available data only.'],
  [/Przeszukuję źródła i prognozy ekspertów…/g, 'Searching public sources and expert predictions…'], [/Konsensus zewnętrzny/g, 'External consensus'], [/źródeł znalezionych/g, 'sources found'],
  [/Identyfikacja meczu/g, 'Identifying fixture'], [/Pobieranie formy/g, 'Loading form'], [/Sprawdzanie H2H/g, 'Checking H2H'], [/Sprawdzanie absencji/g, 'Checking absences'], [/Pobieranie składów/g, 'Loading lineups'], [/Budowanie modelu AI/g, 'Building AI model'],
  [/Wymagane min\. 5 \+ 5 realnych meczów/g, 'Required: at least 5 + 5 real matches'], [/Brak tabeli • opcjonalne \(np\. puchar\)/g, 'No standings • optional (e.g. cup)'], [/Wymagane: sezonowe lub min\. 5 ostatnich meczów obu drużyn/g, 'Required: season data or at least 5 recent matches for both teams'],
  [/ostatnie składy/g, 'recent lineups'], [/ostatnich/g, 'recent'], [/sezon/g, 'season'], [/bukmacherów/g, 'bookmakers'], [/opcjonalne/g, 'optional'],
  [/Za mała próbka historyczna/g, 'Historical sample too small'], [/Historyczny Brier Score jest zbyt słaby/g, 'Historical Brier Score is too weak'], [/Historyczna pewność jest dobrze skalibrowana/g, 'Historical confidence is well calibrated'], [/Próbka wystarczająca, kalibracja w normie/g, 'Sample is sufficient and calibration is acceptable'],
  [/Brak dodatkowej prognozy API — większa część ciężaru spoczywa na modelu statystycznym\./g, 'No additional API prediction — more weight is carried by the statistical model.'],
  [/Historyczna kalibracja wybranego rynku jest słaba — rekomendacja jest blokowana\./g, 'Historical calibration for the selected market is weak — recommendation is blocked.'],
  [/Kalibracja rynku ma dopiero ([0-9]+) prób\./g, 'Market calibration has only $1 samples.'], [/Brak dużych czerwonych flag w dostępnych danych przedmeczowych\./g, 'No major red flags in the available pre-match data.'],
  [/Model nie znalazł jednego dominującego czynnika — prognoza jest wynikiem połączenia kilku umiarkowanych sygnałów\./g, 'The model found no single dominant factor — the forecast combines several moderate signals.'],
  [/Brak kompletnego rynku kursowego — model pokazuje prawdopodobieństwa, ale nie wymusza rekomendacji\./g, 'No complete odds market — the model shows probabilities but does not force a recommendation.'],
  [/Brak pełnego rynku do wiarygodnego usunięcia marży bukmachera/g, 'No complete market to remove bookmaker margin reliably'], [/Za niska jakość danych/g, 'Data quality too low'], [/Za mała próbka backtestu — brak rekomendacji/g, 'Backtest sample too small — no recommendation'],
  [/Model jest słabo skalibrowany dla tego rynku/g, 'Model is poorly calibrated for this market'], [/Modele zbyt mocno się nie zgadzają — brak rekomendacji/g, 'Models disagree too strongly — no recommendation'], [/Zewnętrzne źródła są zbyt rozbieżne — brak rekomendacji/g, 'External sources disagree too strongly — no recommendation'], [/Łączna wiarygodność modelu jest za niska/g, 'Overall model reliability is too low'],
  [/Duża przewaga po usunięciu marży i dobra jakość modelu/g, 'Large edge after removing margin and good model quality'], [/Przewaga przekracza wymagany próg/g, 'Edge exceeds the required threshold'], [/Dodatnia przewaga, ale poniżej bezpiecznego progu/g, 'Positive edge but below the safe threshold'], [/Brak dodatniej przewagi nad ceną rynkową/g, 'No positive edge over the market price'],
  [/Wiarygodność tej analizy/g, 'Reliability of this analysis'], [/Finalna decyzja modelu/g, 'Final model decision'], [/Prognoza przedmeczowa \+ Value Engine/g, 'Pre-match forecast + Value Engine'], [/Dlaczego Bet\+AI tak ocenia ten mecz\?/g, 'Why does Bet+AI rate this match this way?'],
  [/CO WSPIERA PROGNOZĘ/g, 'WHAT SUPPORTS THE FORECAST'], [/RYZYKA \/ OGRANICZENIA/g, 'RISKS / LIMITATIONS'], [/CO MOŻE ZMIENIĆ PROGNOZĘ/g, 'WHAT COULD CHANGE THE FORECAST'],
  [/MECZ ZAKWALIFIKOWANY/g, 'MATCH QUALIFIED'], [/MECZ ODRZUCONY — ZA MAŁO DANYCH/g, 'MATCH REJECTED — INSUFFICIENT DATA'],
  [/Rzeczywista skuteczność modelu/g, 'Real model performance'], [/KALIBRACJA PEWNOŚCI/g, 'CONFIDENCE CALIBRATION'], [/niżej = lepiej/g, 'lower is better'], [/rozliczonych meczów/g, 'settled matches'], [/value betów/g, 'value bets'], [/30 DNI/g, '30 DAYS'],
  [/ZBIERANIE DANYCH/g, 'COLLECTING DATA'], [/LICZĘ/g, 'CALCULATING'], [/AKTYWNY/g, 'ACTIVE'], [/ZAPISUJĘ/g, 'SAVING'], [/OCZEKUJE/g, 'WAITING'],
  [/NAJCZĘSTSZE PRZYCZYNY PRZEGRANYCH PROGNOZ/g, 'MOST COMMON CAUSES OF LOSING FORECASTS'], [/Brak aktywnych alarmów jakości modelu\./g, 'No active model-quality alerts.'],

  [/STATYSTYKI MECZU/g, 'MATCH STATISTICS'], [/XG \(OCZEKIWANE BRAMKI\)/g, 'XG (EXPECTED GOALS)'], [/KLUCZOWE STATYSTYKI/g, 'KEY STATISTICS'], [/OSTATNIE WYDARZENIA/g, 'RECENT EVENTS'],
  [/Strzały celne/g, 'Shots on target'], [/Strzały/g, 'Shots'], [/Posiadanie piłki/g, 'Possession'], [/Rzuty rożne/g, 'Corners'], [/Kartki/g, 'Cards'], [/Podania/g, 'Passes'], [/Celność podań/g, 'Pass accuracy'], [/Pojedynki wygrane/g, 'Duels won'], [/Spalone/g, 'Offsides'],
  [/Pełne statystyki/g, 'Full statistics'], [/bieżące xG/g, 'live xG'], [/Model przedmeczowy/g, 'Pre-match model'], [/Szczegóły xG/g, 'xG details'], [/Zobacz analizę/g, 'View analysis'], [/Pełny raport/g, 'Full report'], [/Pełny przebieg/g, 'Full timeline'],
  [/WIDOK MECZU/g, 'MATCH VIEW'], [/ANALIZA/g, 'ANALYSIS'], [/STREFY BOISKOWE/g, 'PITCH ZONES'], [/SIATKA PODAŃ/g, 'PASS NETWORK'], [/NOWY SCENARIUSZ/g, 'NEW SCENARIO'],
  [/NA ŻYWO/g, 'LIVE'], [/KONIEC/g, 'FULL TIME'], [/PAUZA/g, 'PAUSED'], [/1\. POŁOWA/g, '1ST HALF'], [/2\. POŁOWA/g, '2ND HALF'],
  [/Pełny mecz: 2 minuty przy prędkości x1/g, 'Full match: 2 minutes at x1 speed'], [/Brak pełnych oficjalnych XI z pozycjami/g, 'No complete official XI with positions'], [/Boisko nie pokazuje fikcyjnych zawodników\./g, 'The pitch does not show fictional players.'],
  [/Oczekiwanie na oficjalny skład/g, 'Waiting for official lineup'], [/Oficjalny/g, 'Official'], [/oficjalny/g, 'official'], [/przewidywany/g, 'predicted'], [/Brak składu do symulacji/g, 'No lineup available for simulation'], [/Brak pozycji boiskowych w API/g, 'No pitch positions in API data'],
  [/Bet\+AI nie generuje przypadkowych nazwisk ani ustawienia\./g, 'Bet+AI does not generate random player names or formations.'], [/Bet\+AI nie tworzy fikcyjnych nazwisk\. Skład pojawi się automatycznie, gdy API-Football opublikuje startową XI\./g, 'Bet+AI does not invent player names. The lineup will appear automatically when API-Football publishes the starting XI.'],
  [/XI przewidywana z ostatnich realnych składów\./g, 'Predicted XI based on recent real lineups.'], [/zawodników/g, 'players'], [/predykcja z/g, 'prediction from'], [/składów/g, 'lineups'], [/Trener/g, 'Coach'], [/Dane API/g, 'API data'],
  [/Pobieram realne dane meczu…/g, 'Loading real match data…'], [/XI oficjalne\/przewidywane/g, 'official/predicted XI'], [/formacje/g, 'formations'], [/forma/g, 'form'], [/tabela/g, 'standings'],
  [/Symulacja rozpoczyna się od 00:00\./g, 'Simulation starts at 00:00.'], [/Powtórz ten sam seed/g, 'Replay the same seed'],
  [/Mecz gotowy\. Skład przewidywany z ostatnich realnych XI; formacja i zawodnicy pochodzą z danych API\./g, 'Match ready. The lineup is predicted from recent real XIs; formation and players come from API data.'], [/Mecz gotowy\. Silnik wykorzystuje oficjalne składy i formacje z API\./g, 'Match ready. The engine uses official API lineups and formations.'], [/Mecz nie spełnia warunków jakości danych\./g, 'The match does not meet data-quality requirements.'],
  [/Kliknij, aby aktywować prawdziwe audio stadionu/g, 'Click to enable real stadium audio'], [/Wycisz dźwięki meczu/g, 'Mute match audio'], [/Włącz dźwięki meczu/g, 'Enable match audio'], [/Aktywuj prawdziwe audio stadionu/g, 'Enable real stadium audio'], [/AKTYWUJ AUDIO/g, 'ENABLE AUDIO'], [/DŹWIĘK MECZU/g, 'MATCH AUDIO'], [/1 klik • wymóg przeglądarki/g, '1 click • browser requirement'], [/Przyśpiewki • reakcje • gwizdek • gol/g, 'Chants • reactions • whistle • goal'], [/Głośność dźwięków meczu/g, 'Match audio volume'],
  [/Raport końcowy symulacji/g, 'Final simulation report'], [/STRZAŁY/g, 'SHOTS'], [/ROŻNE/g, 'CORNERS'], [/KARTKI/g, 'CARDS'], [/ZMIANY/g, 'SUBSTITUTIONS'], [/czerwone/g, 'red cards'],
  [/V320 generuje posiadania, ruch, podania i sytuacje z zamrożonego profilu Bet\+AI\. LIVE AI Coach aktualizuje prawdopodobieństwa wyłącznie z przebiegu tej symulacji; bez kursu live nie potwierdza VALUE\./g, 'V320 generates possessions, movement, passes and chances from the frozen Bet+AI profile. LIVE AI Coach updates probabilities only from this simulation; without live odds it does not confirm VALUE.'],
  [/▶ Początek symulacji/g, '▶ Simulation kick-off'], [/▶ Start drugiej połowy/g, '▶ Start of the second half'], [/🎯 Strzał/g, '🎯 Shot'], [/🚩 Rzut rożny dla/g, '🚩 Corner for'], [/📣 Groźny faul/g, '📣 Dangerous foul'],
  [/ spokojnie buduje akcję od tyłu/g, ' builds patiently from the back'], [/ wyprowadza piłkę spod pressingu/g, ' carries the ball out of pressure'], [/ prowadzi piłkę przez środek/g, ' carries the ball through midfield'], [/ zagrywa piłkę między liniami/g, ' plays the ball between the lines'], [/ rusza w stronę pola karnego/g, ' drives toward the penalty area'], [/ cofa piłkę i cierpliwie szuka miejsca/g, ' recycles possession and patiently looks for space'], [/ szuka ostatniego podania pod bramką/g, ' looks for the final pass near goal'], [/ przejmuje piłkę — szybka zmiana kierunku akcji/g, ' wins the ball — quick transition'], [/ prowadzi piłkę pod pole karne/g, ' carries the ball toward the box'], [/ składa się do strzału…/g, ' prepares to shoot…'], [/ uderza na bramkę!/g, ' shoots at goal!'], [/ wrzuca piłkę z narożnika/g, ' delivers the corner'], [/ ustawia piłkę do rzutu wolnego/g, ' sets up the free kick'], [/ świętuje bramkę — za chwilę wznowienie od środka/g, ' celebrates the goal — restart from the centre shortly'], [/ wznawia grę od środka/g, ' restarts from the centre'], [/ — zespół musi przebudować ustawienie/g, ' — the team must reorganise'],
  [/wyższy pressing i szybsze przejście do ataku/g, 'higher press and faster attacking transitions'], [/bardziej ofensywne ustawienie na końcówkę/g, 'more attacking setup for the closing stages'],
  [/Piłka/g, 'Ball'], [/Drużyna/g, 'Team'],
  [/ symulacji modelu/g, ' model simulations'], [/ prób/g, ' samples'], [/ próba/g, ' sample'], [/ źr\./g, ' src.'],
]


// V336 — complete EN pass for all remaining preparation + V320 match-engine UI.
// Presentation only: no model/API/simulation calculations are modified.
const SIMULATOR_EN_REPLACEMENTS_V336_EXTRA = [
  [/Szybkie podsumowanie analizy/g, 'Quick analysis summary'],
  [/Najważniejsza decyzja, kierunki i ryzyko — bez czytania całego raportu\./g, 'Key decision, directions and risk — at a glance.'],
  [/FINALNA DECYZJA MODELU/g, 'FINAL MODEL DECISION'],
  [/Sygnał przeszedł konserwatywne filtry modelu\./g, 'The signal passed the model’s conservative filters.'],
  [/Kierunek wart obserwacji, ale model nie daje jeszcze pełnego BET\./g, 'Worth monitoring, but the model does not yet confirm a full BET.'],
  [/Kierunki poniżej pozostają informacyjne — model nie rekomenduje obecnie stawki\./g, 'The directions below are informational — the model does not currently recommend a stake.'],
  [/NAJMOCNIEJSZY KIERUNEK/g, 'STRONGEST DIRECTION'],
  [/RYNEK BRAMKOWY/g, 'GOALS MARKET'],
  [/RYNEK MODELU/g, 'MODEL MARKET'],
  [/xG • OCZEKIWANE GOLE/g, 'xG • EXPECTED GOALS'],
  [/WIARYGODNOŚĆ/g, 'RELIABILITY'],
  [/KALIBRACJA/g, 'CALIBRATION'],
  [/NAJLEPSZE 1X2/g, 'BEST 1X2'],
  [/WYSOKA/g, 'HIGH'], [/ŚREDNIA/g, 'MEDIUM'], [/NISKA/g, 'LOW'],
  [/PRÓG SPEŁNIONY/g, 'THRESHOLD MET'], [/ZBIERANIE PRÓB/g, 'COLLECTING SAMPLES'],
  [/NAJWAŻNIEJSZE POWODY/g, 'KEY REASONS'],
  [/Co naprawdę wpływa na ocenę tego meczu/g, 'What actually drives this match rating'],
  [/PROFIL SYMULACJI/g, 'SIMULATION PROFILE'],
  [/Zamrożony model Bet\+AI/g, 'Frozen Bet+AI model'],
  [/Pokaż pełną analizę/g, 'Show full analysis'],
  [/V322 zmienia tylko interfejs\. Prediction Engine i decyzje pozostają bez zmian\./g, 'V322 changes the interface only. Prediction Engine and decisions remain unchanged.'],
  [/POSTĘP PRZYGOTOWANIA/g, 'PREPARATION PROGRESS'],
  [/Analiza gotowa do symulacji/g, 'Analysis ready for simulation'],
  [/Oczekiwanie na dane/g, 'Waiting for data'],
  [/BŁĄD/g, 'ERROR'],
  [/DZISIAJ/g, 'TODAY'], [/STADION/g, 'STADIUM'], [/Dane stadionu oczekują/g, 'Stadium data pending'],
  [/Piłka nożna/g, 'Football'],
  [/API 429 • automatyczne ponowienie/g, 'API 429 • automatic retry'],
  [/API zajęte • używam ostatnich poprawnych danych z cache/g, 'API busy • using the latest valid cached data'],
  [/Supabase cache \/ snapshot • oszczędzam requesty API/g, 'Supabase cache / snapshot • saving API requests'],
  [/Globalny throttle API aktywny/g, 'Global API throttle active'],
  [/Najlepszy zestaw danych zapisano w Supabase\./g, 'Best available data snapshot saved in Supabase.'],
  [/Baza:/g, 'Sources:'],
  [/Wagi źródeł dla tego meczu/g, 'Source weights for this match'],
  [/model statystyczny/g, 'statistical model'],
  [/Najbardziej prawdopodobne wyniki/g, 'Most likely scorelines'],
  [/NAJBARDZIEJ PRAWDOPODOBNE WYNIKI/g, 'MOST LIKELY SCORELINES'],
  [/Ruchy rynku zapisany w Supabase/g, 'Market moves saved in Supabase'],
  [/Ruchy rynku zapisane w Supabase/g, 'Market moves saved in Supabase'],
  [/0 dodatkowych requestów API/g, '0 additional API requests'],
  [/TOP 3 kandydaci • bez wymuszania zakładu/g, 'TOP 3 candidates • no forced bet'],
  [/przed kalibracją/g, 'before calibration'],
  [/po kalibracji/g, 'after calibration'],
  [/Test rekomendacji bez stawiania pieniędzy/g, 'Recommendation test without real-money staking'],
  [/niezależnych modeli/g, 'independent models'],
  [/waga/g, 'weight'],
  [/snapshot danych, wag i decyzji pre-match/g, 'snapshot of pre-match data, weights and decisions'],
  [/zbieranie realnych błędów modelu/g, 'collecting real model errors'],
  [/Brak aktywnych alarmów jakości modelu\./g, 'No active model-quality alerts.'],
  [/Rzeczywista skuteczność modelu/g, 'Real model performance'],
  [/ROZLICZONYCH/g, 'SETTLED'],
  [/rozliczonych/g, 'settled'],
  [/meczów/g, 'matches'],
  [/meczu/g, 'match'],
  [/niżej = lepiej/g, 'lower = better'],
  [/value betów/g, 'value bets'],
  [/30 DNI/g, '30 DAYS'],
  [/realnie/g, 'actual'],
  [/Wyniki są liczone wyłącznie z zamrożonych prognoz pre-match i prawdziwych rezultatów\./g, 'Results are calculated only from frozen pre-match forecasts and real outcomes.'],
  [/Pierwsze statystyki pojawią się po zakończeniu i automatycznym rozliczeniu zapisanych prognoz\./g, 'The first statistics will appear after saved forecasts are completed and automatically settled.'],
  [/Forecast po kickoffie jest zablokowany, więc wynik nie może zmienić historycznej predykcji\./g, 'Forecast changes after kick-off are blocked, so the result cannot alter the historical prediction.'],
  [/chronologicznie • bez danych z przyszłości/g, 'chronological • no future data'],
  [/prób rynku/g, 'market samples'],
  [/Część danych dodatkowych jest niedostępna, ale wymagane statystyki sportowe spełniają próg jakości\./g, 'Some additional data is unavailable, but the required sports statistics meet the quality threshold.'],
  [/MECZ ODRZUCONY PRZEZ FILTR JAKOŚCI/g, 'MATCH REJECTED BY QUALITY FILTER'],
  [/za mało danych/g, 'insufficient data'],

  // Match Engine / live simulation UI
  [/PRZERWA/g, 'HALF-TIME'],
  [/symulacji modelu/g, 'model simulations'],
  [/Momentum na żywo gospodarze kontra goście/g, 'Live momentum: home vs away'],
  [/Gospodarze/g, 'Home'], [/Goście/g, 'Away'], [/Drużyna/g, 'Team'],
  [/Oficjalny/g, 'Official'], [/oficjalny/g, 'official'], [/przewidywany/g, 'predicted'],
  [/Brak składu/g, 'No lineup'],
  [/Brak pozycji boiskowych w API/g, 'No pitch positions in API data'],
  [/Brak składu do symulacji/g, 'No lineup available for simulation'],
  [/XI przewidywana z ostatnich realnych składów\./g, 'Predicted XI based on recent real lineups.'],
  [/Bet\+AI nie generuje przypadkowych nazwisk ani ustawienia\./g, 'Bet+AI does not generate random player names or formations.'],
  [/Dane API/g, 'API data'], [/Trener/g, 'Coach'], [/zawodników/g, 'players'], [/składów/g, 'lineups'],
  [/predykcja z/g, 'prediction from'],
  [/Strzały celne/g, 'Shots on target'], [/Strzały/g, 'Shots'], [/Posiadanie piłki/g, 'Possession'], [/Rzuty rożne/g, 'Corners'], [/Kartki/g, 'Cards'],
  [/Podania/g, 'Passes'], [/Celność podań/g, 'Pass accuracy'], [/Pojedynki wygrane/g, 'Duels won'], [/Spalone/g, 'Offsides'],
  [/Pełne statystyki/g, 'Full statistics'], [/bieżące xG/g, 'live xG'], [/Model przedmeczowy/g, 'Pre-match model'], [/Szczegóły xG/g, 'xG details'],
  [/Zobacz analizę/g, 'View analysis'], [/Pełny raport/g, 'Full report'], [/Pełny przebieg/g, 'Full timeline'],
  [/WIDOK MECZU/g, 'MATCH VIEW'], [/ANALIZA/g, 'ANALYSIS'], [/STREFY BOISKOWE/g, 'PITCH ZONES'], [/SIATKA PODAŃ/g, 'PASS NETWORK'],
  [/NOWY SCENARIUSZ/g, 'NEW SCENARIO'], [/Powtórz ten sam seed/g, 'Replay the same seed'],
  [/NA ŻYWO/g, 'LIVE'], [/KONIEC/g, 'FULL TIME'], [/PAUZA/g, 'PAUSED'],
  [/Mecz gotowy\. Skład przewidywany z ostatnich realnych XI; formacja i zawodnicy pochodzą z danych API\./g, 'Match ready. The lineup is predicted from recent real XIs; formation and players come from API data.'],
  [/Mecz gotowy\. Silnik wykorzystuje oficjalne składy i formacje z API\./g, 'Match ready. The engine uses official API lineups and formations.'],
  [/Mecz nie spełnia warunków jakości danych\./g, 'The match does not meet data-quality requirements.'],
  [/Symulacja rozpoczyna się od 00:00\./g, 'Simulation starts at 00:00.'],
  [/Kliknij, aby aktywować prawdziwe audio stadionu/g, 'Click to enable real stadium audio'],
  [/Wycisz dźwięki meczu/g, 'Mute match audio'], [/Włącz dźwięki meczu/g, 'Enable match audio'], [/Aktywuj prawdziwe audio stadionu/g, 'Enable real stadium audio'],
  [/AKTYWUJ AUDIO/g, 'ENABLE AUDIO'], [/DŹWIĘK MECZU/g, 'MATCH AUDIO'], [/1 klik • wymóg przeglądarki/g, '1 click • browser requirement'],
  [/Przyśpiewki • reakcje • gwizdek • gol/g, 'Chants • reactions • whistle • goal'], [/Głośność dźwięków meczu/g, 'Match audio volume'],
  [/Raport końcowy symulacji/g, 'Final simulation report'], [/STRZAŁY/g, 'SHOTS'], [/ROŻNE/g, 'CORNERS'], [/KARTKI/g, 'CARDS'], [/ZMIANY/g, 'SUBSTITUTIONS'], [/czerwone/g, 'red cards'],
  [/V320 generuje posiadania, ruch, podania i sytuacje z zamrożonego profilu Bet\+AI\. LIVE AI Coach aktualizuje prawdopodobieństwa wyłącznie z przebiegu tej symulacji; bez kursu live nie potwierdza VALUE\./g, 'V320 generates possessions, movement, passes and chances from the frozen Bet+AI profile. LIVE AI Coach updates probabilities only from this simulation; without live odds it does not confirm VALUE.'],

  // Generated commentary / event text
  [/▶ Początek symulacji/g, '▶ Simulation kick-off'], [/▶ Start drugiej połowy/g, '▶ Start of the second half'], [/🏁 Koniec symulacji/g, '🏁 End of simulation'],
  [/🎯 Strzał/g, '🎯 Shot'], [/🚩 Rzut rożny dla/g, '🚩 Corner for'], [/📣 Groźny faul/g, '📣 Dangerous foul'],
  [/⚽ GOL Z KARNEGO/g, '⚽ PENALTY GOAL'], [/🔄 Zmiana taktyczna/g, '🔄 Tactical change'], [/🔄 Zmiana/g, '🔄 Substitution'],
  [/ za /g, ' for '],
  [/spokojnie buduje akcję od tyłu/g, 'builds patiently from the back'],
  [/wyprowadza piłkę spod pressingu/g, 'carries the ball out of pressure'],
  [/podaje do/g, 'passes to'],
  [/prowadzi piłkę przez środek/g, 'carries the ball through midfield'],
  [/zagrywa piłkę między liniami/g, 'plays the ball between the lines'],
  [/rusza w stronę pola karnego/g, 'drives toward the penalty area'],
  [/cofa piłkę i cierpliwie szuka miejsca/g, 'recycles possession and patiently looks for space'],
  [/szuka ostatniego podania pod bramką/g, 'looks for the final pass near goal'],
  [/przejmuje piłkę — szybka zmiana kierunku akcji/g, 'wins the ball — quick transition'],
  [/zagrywa do/g, 'plays to'],
  [/prowadzi piłkę pod pole karne/g, 'carries the ball toward the box'],
  [/składa się do strzału…/g, 'sets up to shoot…'], [/uderza na bramkę!/g, 'shoots at goal!'],
  [/wrzuca piłkę z narożnika/g, 'delivers the corner'], [/ustawia piłkę do rzutu wolnego/g, 'sets up the free kick'],
  [/świętuje bramkę — za chwilę wznowienie od środka/g, 'celebrates the goal — restart from the centre shortly'],
  [/wznawia grę od środka/g, 'restarts from the centre'],
  [/przecina linię podania/g, 'cuts out the passing lane'],
  [/posyła piłkę w wolną przestrzeń do/g, 'plays the ball into space for'],
  [/— zespół musi przebudować ustawienie/g, '— the team must reorganise'],
  [/wyższy pressing i szybsze przejście do ataku/g, 'higher press and faster attacking transitions'],
  [/bardziej ofensywne ustawienie na końcówkę/g, 'more attacking setup for the closing stages'],

  // Common preparation fragments left by legacy modules
  [/gola na mecz/g, 'goals per match'], [/gola — to podnosi profil bramkowy/g, 'goals — this raises the scoring profile'],
  [/źródeł, zgodność/g, 'sources, agreement'], [/Absencje:/g, 'Absences:'], [/gospodarze/g, 'home'], [/goście/g, 'away'],
  [/model podnosi wymagany próg value/g, 'the model raises the required value threshold'],
  [/prób\./g, 'samples.'], [/prób/g, 'samples'],
  [/brak rekomendacji/g, 'no recommendation'], [/Brak rekomendacji/g, 'No recommendation'],
  [/brak wystarczającej przewagi/g, 'insufficient edge'],
  [/Brak wystarczającej przewagi/g, 'Insufficient edge'],
  [/przed kalibracją/g, 'before calibration'],
  [/kalibracja/g, 'calibration'],
  [/Kalibracja/g, 'Calibration'],
  [/oczekuje/g, 'waiting'], [/OCZEKUJE/g, 'WAITING'], [/ZAPISUJĘ/g, 'SAVING'], [/AKTYWNY/g, 'ACTIVE'],  [/RAW → skalibrowane prawdopodobieństwo/g, 'RAW → calibrated probability'],
  [/MODEL STATYSTYCZNY/g, 'STATISTICAL MODEL'],
  [/NO BET — KALIBRACJA/g, 'NO BET — CALIBRATION'],
  [/Za mała próbka historyczna/g, 'Historical sample too small'],
  [/Bet\+AI pokaże rekomendację dopiero po min\. ([0-9]+) rozliczonych próbach danego rynku\./g, 'Bet+AI will show a recommendation only after at least $1 settled samples for this market.'],
  [/Przewaga \+([0-9.]+) pp jest poniżej wymaganego progu ([0-9.]+) pp\./g, 'Edge +$1 pp is below the required $2 pp threshold.'],
  [/Brak wystarczającej przewagi/g, 'Insufficient edge'],
  [/rynek no-vig/g, 'no-vig market'], [/próg/g, 'threshold'],
  [/VALUE NIEOCENIONE/g, 'VALUE NOT ASSESSED'],
  [/Brak pełnych realnych kursów/g, 'No complete real odds'],
  [/Do Value V2 potrzebna jest para\/komplet kursów z tego samego bukmachera, aby usunąć marżę\./g, 'Value V2 requires a complete odds set from the same bookmaker in order to remove the margin.'],
  [/Ruch rynku zapisany w Supabase/g, 'Market movement saved in Supabase'],
  [/TOP 3 przewagi cenowe/g, 'TOP 3 pricing edges'],
  [/RYNEK NO-VIG/g, 'NO-VIG MARKET'],
  [/BEZ UKRYWANIA CZYNNIKÓW/g, 'NO HIDDEN FACTORS'],
  [/Dlaczego Bet\+AI tak ocenia ten mecz\?/g, 'Why does Bet+AI rate this match this way?'],
  [/CO WSPIERA PROGNOZĘ/g, 'WHAT SUPPORTS THE FORECAST'], [/RYZYKA \/ OGRANICZENIA/g, 'RISKS / LIMITATIONS'],
  [/Finalna decyzja modelu/g, 'Final model decision'],
  [/RYNEK/g, 'MARKET'],
  [/Brak pełnego rynku kursowego/g, 'No complete odds market'],
  [/Modele składowe rozjeżdżają się/g, 'Component models disagree'],
  [/modele składowe rozjeżdżają się/g, 'component models disagree'],
  [/przed kalibracją/g, 'before calibration'],
  [/aktywny model/g, 'active model'],
  [/Rynek jest tylko warstwą wyceny\./g, 'The market is only a pricing layer.'],
  [/Challenger zbiera historię\./g, 'Challenger is collecting history.'],
  [/Kontrola wspólnej ekspozycji\./g, 'Shared-exposure control.'],
  [/Model Brain • automatyczne wagi i governance/g, 'Model Brain • automatic weights and governance'],
  [/dni/g, 'days'], [/prób • Brier/g, 'samples • Brier'],
  [/AKTYWNY/g, 'ACTIVE'], [/profile audit w Supabase/g, 'profile audit in Supabase'], [/zbieranie profilu/g, 'collecting profile'],
  [/XI • absencje • fatigue • matchup adjustment/g, 'XI • absences • fatigue • matchup adjustment'],
  [/BRAK XI/g, 'NO XI'], [/absencje/g, 'absences'], [/mecze/g, 'matches'],
  [/bez fikcyjnych ratingów zawodników/g, 'no fabricated player ratings'],
  [/kontrola jakości/g, 'quality control'], [/shrinkage aktywny/g, 'shrinkage active'], [/zbieranie out-of-sample historii/g, 'collecting out-of-sample history'],
  [/KALIBRACJA PEWNOŚCI/g, 'CONFIDENCE CALIBRATION'],
  [/chronologicznie • bez danych z przyszłości/g, 'chronological • no future data'],
  [/prób rynku/g, 'market samples'],
  [/TAK/g, 'YES'], [/NIE/g, 'NO'],
  [/oczekuje/g, 'waiting'], [/OCZEKUJE/g, 'WAITING'], [/ZAPISUJĘ/g, 'SAVING'], [/AKTYWNY/g, 'ACTIVE'],
]

function translateSimulatorTextV335(value = '') {
  let output = String(value ?? '')
  for (const [pattern, replacement] of [...SIMULATOR_EN_REPLACEMENTS_V335, ...SIMULATOR_EN_REPLACEMENTS_V336_EXTRA]) output = output.replace(pattern, replacement)
  return output
}

function translateSimulatorDomV335(root) {
  if (!root || typeof document === 'undefined') return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes = []
  let node
  while ((node = walker.nextNode())) nodes.push(node)
  nodes.forEach(textNode => {
    const parent = textNode.parentElement
    if (!parent || ['SCRIPT', 'STYLE'].includes(parent.tagName)) return
    const next = translateSimulatorTextV335(textNode.nodeValue)
    if (next !== textNode.nodeValue) textNode.nodeValue = next
  })
  root.querySelectorAll('[title],[aria-label],[placeholder]').forEach(el => {
    ;['title', 'aria-label', 'placeholder'].forEach(attr => {
      const value = el.getAttribute(attr)
      if (!value) return
      const next = translateSimulatorTextV335(value)
      if (next !== value) el.setAttribute(attr, next)
    })
  })
}

export default function MatchSimulatorFlowView({ lang = 'pl' }) {
  const [stage, setStage] = useState('intro')
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [preparedData, setPreparedData] = useState(null)
  const flowRef = useRef(null)

  useEffect(() => {
    if (lang !== 'en' || !flowRef.current) return undefined
    const root = flowRef.current
    const apply = () => translateSimulatorDomV335(root)
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder'] })
    return () => observer.disconnect()
  }, [lang, stage])

  const openDailyMatches = useCallback(() => setStage('matches'), [])
  const openPreparation = useCallback((match) => {
    setSelectedMatch(match || null)
    setPreparedData(null)
    setStage('prep')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])
  const openMatchEngine = useCallback((match, data) => {
    setSelectedMatch(match || null)
    setPreparedData(data || null)
    setStage('match')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])
  const backToMatches = useCallback(() => {
    setStage('matches')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <div ref={flowRef} className={`match-simulator-flow-v87 is-${stage}`} data-simulator-lang={lang}>
      {stage === 'intro' && <MatchSimulatorIntroView key={`intro-${lang}`} lang={lang} onComplete={openDailyMatches} />}
      {stage === 'matches' && <MatchSimulatorDailyMatchesView key={`matches-${lang}`} lang={lang} onSelectMatch={openPreparation} />}
      {stage === 'prep' && <MatchSimulatorPreparationView key={`prep-${lang}`} lang={lang} match={selectedMatch} onBack={backToMatches} onStart={openMatchEngine} />}
      {stage === 'match' && <div className="match-simulator-stage-v87"><MatchSimulatorView key={`match-${lang}`} lang={lang} selectedMatch={selectedMatch} preparedData={preparedData} /></div>}
    </div>
  )
}
