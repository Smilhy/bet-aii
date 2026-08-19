BetAI WERSJA 75 — twarda naprawa mieszania kont

Naprawione źródła problemu:
- spóźniony getSession()/late-getSession nie może nadpisać konta po ręcznym przełączeniu,
- cache Coinów jest związany z user_id + email, a nie tylko z emailem,
- email-only cache Coinów jest czyszczony przy realnym switchu,
- Supabase jest źródłem prawdy i zapisuje zweryfikowany cache V75,
- stare realtime callbacki poprzedniego konta mają epoch/user guard,
- logout odcina lokalną tożsamość zanim zakończy się request signOut.

Nie zmieniano Algorytmu, rankingu, typów ani rozliczeń. SQL niepotrzebny.
