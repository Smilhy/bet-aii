BET+AI — WERSJA 16

NOWOŚĆ: AUTOMATYCZNY SLIDER TYPERÓW W PRAWEJ KOLUMNIE DASHBOARDU

Umiejscowienie:
- pomiędzy LIVE CHAT a panelem TOP TYPERZY.

Zakładki slidera:
- Najlepsi — sortowanie po Yield,
- Płatni — typerzy premium / autorzy płatnych typów,
- Seria — najlepsza aktualna seria zwycięstw z ostatnich rozliczonych typów,
- Popularni — sortowanie po liczbie obserwujących.

Działanie:
- zakładki zmieniają się automatycznie co 5,5 sekundy,
- można przełączać je ręcznie klikając nazwę lub kropki,
- po najechaniu kursorem / użyciu klawiatury automat zatrzymuje się,
- kliknięcie typera otwiera jego profil,
- dane są brane z już istniejącego rankingu, profili i typów,
- nie dodano nowych requestów do Supabase i nie jest potrzebny żaden SQL.

Wygląd:
- 4 typerów w układzie 2x2,
- avatary, flaga kraju i status premium / weryfikacja,
- osobny widok formy dla zakładki Seria,
- animowane przejście slajdu,
- dopasowanie do aktualnego ciemnego/neonowego stylu Bet+AI,
- responsywny układ dla węższych ekranów.

NETLIFY + SUPABASE:
- bez zmian konfiguracji,
- bez migracji bazy,
- paczkę można wdrożyć tak samo jak poprzednią wersję.

TEST:
- npm run build — OK (Vite production build).
