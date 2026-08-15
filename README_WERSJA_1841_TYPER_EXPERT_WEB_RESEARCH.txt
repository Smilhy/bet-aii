BETAI WERSJA 1841 — TYPER EXPERT WEB RESEARCH + ANALIZA DO 500 ZNAKÓW

CO ZMIENIONO
- Zmieniono wyłącznie silnik i opis profilu Typer Expert.
- Harmonogram pozostaje co 3 godziny.
- Progresja stawek pozostaje bez zmian.
- Silnik najpierw wybiera najlepszych kandydatów na podstawie realnych kursów i konsensusu bukmacherów.
- Następnie OpenAI Web Search sprawdza publiczne, aktualne zapowiedzi ekspertów, oficjalne informacje, składy, kontuzje, formę i analizy statystyczne.
- Typ jest publikowany tylko wtedy, gdy uzyska potwierdzenie w co najmniej 2 niezależnych źródłach i research score minimum 62/100.
- Źródła sprzeczne lub zbyt słabe powodują odrzucenie typu.
- Analiza jest syntezą własnymi słowami, ma maksymalnie 500 znaków i uzasadnia wybór.
- Silnik nie kopiuje pełnych cudzych analiz i nie korzysta z treści wymagających logowania.

WYMAGANE ZMIENNE NETLIFY
- OPENAI_API_KEY
- APISPORTS_KEY albo API_FOOTBALL_KEY
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

OPCJONALNE ZMIENNE
- TYPER_EXPERT_RESEARCH_MODEL=gpt-4.1-mini
- TYPER_EXPERT_RESEARCH_CANDIDATES=5
- TYPER_EXPERT_MIN_RESEARCH_SOURCES=2
- TYPER_EXPERT_MIN_RESEARCH_SCORE=62
- TYPER_EXPERT_RESEARCH_WEIGHT=0.45
- TYPER_EXPERT_RESEARCH_CONTEXT_SIZE=low
- TYPER_EXPERT_REQUIRE_RESEARCH=1
- TYPER_EXPERT_ALLOWED_DOMAINS=domena1.pl,domena2.com

TEST BEZ PUBLIKOWANIA
https://bet-ai.app/.netlify/functions/publish-typer-expert?dry_run=1

W ODPOWIEDZI TESTOWEJ SPRAWDŹ
- researched_candidates
- accepted_after_research
- research.support_score
- research.source_count
- research.source_names
- tip.analysis

WAŻNE
Nie da się technicznie ani prawnie przeczytać „wszystkich” stron w internecie. Silnik przeszukuje publiczne wyniki zwrócone przez Web Search i odrzuca typ, gdy nie ma wystarczającego potwierdzenia. To nie gwarantuje zysku. Progresja do 1000 jednostek pozostaje ryzykowna.

WDROŻENIE
1. Wgraj cały projekt na Netlify.
2. Sprawdź, czy OPENAI_API_KEY jest ustawiony.
3. Uruchom dry_run=1.
4. Nie trzeba wykonywać SQL.
