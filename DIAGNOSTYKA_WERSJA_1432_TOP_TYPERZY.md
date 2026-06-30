# WERSJA 1432 — DIAGNOSTYKA TOP TYPERZY

Po patchu w main.jsx:
- `select('id,email`: 0
- `select('author_id`: 0
- `author_id,user_id`: 0
- `.select(columns)`: 0
- `.limit(2000)`: 0
- `.limit(1000)`: 0
- `.from('profiles').select('*')`: 17
- `.from('tips').select('*')`: 15

Co naprawiono:
- usunięte ryzykowne selecty typu profiles select=id,email,username...
- usunięte ryzykowne selecty typu tips select=author_id,user_id...
- usunięte select(columns), który próbował wielu kombinacji kolumn i generował 400,
- limity 1000/2000 zmniejszone,
- SQL dodaje brakujące kolumny dla starszych paczek i odświeża PostgREST cache.
