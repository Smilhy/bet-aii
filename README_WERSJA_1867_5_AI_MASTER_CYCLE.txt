BETAI WERSJA 1867.5 — NAPRAWA BRAKU TYPÓW BOTÓW

CO BYŁO NIE TAK
- 3 boty pobierały osobno te same fixtures, odds, predictions i injuries.
- To szybko zużywało limit API-Football i każdy skan mógł zakończyć się bez kursów.
- Background Function zwracała tylko 202, więc ekran nie znał realnego wyniku skanu.
- Przy braku dodatniego value generator nie publikował nic, mimo że istniały realne kursy.

CO ZMIENIONO
- Jeden wspólny skan pobiera mecze i kursy tylko raz.
- Z jednego skanu wybierane są maksymalnie 3 różne realne mecze: BetAI AI, Typer Expert, Ograć Buka.
- Kursy 1.50–5.00, realne dane API-Football, minimum 1 bukmacher.
- Dodatnie value ma pierwszeństwo, ale przy braku value działa bezpieczny konsensus rynku.
- Prognoza API-Football wzmacnia Typer Expert i Ograć Buka, ale jej brak nie blokuje publikacji.
- Ręczny przycisk Typy AI dostaje prawdziwy wynik skanu zamiast samego komunikatu „queued”.
- Jeden harmonogram: 05:12, 10:12, 15:12 i 20:12 UTC.
- Endpoint diagnostyczny: /.netlify/functions/ai-bots-health

WAŻNE WDROŻENIE
Netlify musi zbudować cały projekt z katalogiem netlify/functions. Nie wrzucaj samego katalogu dist,
bo wtedy frontend działa, ale funkcje i harmonogramy botów nie zostaną wdrożone.
Najpewniej: repozytorium Git podpięte do Netlify albo Netlify CLI: npx netlify deploy --build --prod

WYMAGANE ENV W NETLIFY
SUPABASE_URL (lub VITE_SUPABASE_URL)
SUPABASE_SERVICE_ROLE_KEY
APISPORTS_KEY (lub API_FOOTBALL_KEY)

Opcjonalnie uruchom w Supabase SQL Editor:
SUPABASE_WERSJA_1867_5_AI_DIAGNOSTYKA.sql
