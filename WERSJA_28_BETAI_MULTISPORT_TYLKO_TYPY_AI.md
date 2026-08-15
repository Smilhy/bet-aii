# WERSJA 28 — BetAI MultiSport tylko w Typy AI

Zmiana rozdziela BetAI MultiSport AI od normalnych typerów.

- BetAI MultiSport AI zapisuje nowe typy wyłącznie do `ai_bets`.
- Nie zapisuje już kopii do `tips`, więc nie dubluje się w feedzie/profilu/rankingu.
- Stare rekordy BetAI MultiSport AI z `tips` są ukrywane po stronie frontu i endpointu `get-public-tips`.
- Zakładka `Typy AI`, `Mecze Result` i prawy panel `AI Typy dnia` nadal czytają z `ai_bets`.
- Typer Expert i Ograć Buka zostają normalnymi botami-typerami w `tips`.

Nie zmieniono płatności, Supabase schema, progresji Typer Expert ani wyglądu.
