# WERSJA 1430 — Top typerzy diagnostyka

## Podejrzane wzorce znalezione przed patchem
- `author_id.eq`: 2
- `user_id.eq`: 5
- `tipster_id.eq`: 0
- `author_email.eq`: 0
- `user_email.eq`: 1
- `username.eq`: 1
- `public_slug.eq`: 0
- `select('id,email`: 9
- `select('id, username`: 1
- `betai_live_ranking_v999`: 1
- `tipster_ranking_live`: 0
- `limit(1000)`: 2

## Co zostało poprawione
- direct `profiles?public_slug.eq`, `profiles?username.eq`, `profiles?email.eq` zastąpione lokalnym filtrowaniem po małej paczce profili.
- `tips` nie powinno już odpalać ryzykownego OR po `author_id/user_id/tipster_id/email/username` bezpośrednio w URL.
- limity rankingów i tips zmniejszone.
- dodany helper `loadSafeTipsForProfile()`.
- SQL dodaje brakujące bezpieczne kolumny i indeksy, żeby starsze zapytania też przestały dawać 400.
