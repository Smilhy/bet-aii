BetAI WERSJA 55 — Dashboard / Popularni — realna liczba obserwujących

Naprawa:
- prawa kolumna Dashboardu w zakładce Popularni nie korzysta już wyłącznie z followers_count zapisanej w profilu/rankingu,
- liczba obserwujących jest teraz łączona z aktualnym followStats pobieranym z:
  * betai_get_tipster_follow_stats_v1123,
  * tipster_follows,
  * betai_tipster_follow_keys_v1033,
- dopasowanie działa po id, tipster_id, user_id, emailu, username i public_slug,
- po dodaniu/usunięciu obserwowania liczba w Popularni odświeża się razem ze stanem followStats,
- sortowanie Popularni używa tej samej realnej liczby.

Nie zmieniono logiki typów, kursów, rozliczeń, rankingów profit/yield ani Supabase.
Nie potrzeba SQL.
