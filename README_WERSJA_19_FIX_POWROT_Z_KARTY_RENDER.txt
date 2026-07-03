BetAI — WERSJA 19

Naprawa czarnego ekranu po powrocie do karty Opera/Chromium.

Zakres zmian:
- usunięte nakładanie CSS zoom na BODY oraz #root jednocześnie,
- zachowany ten sam wizualny widok 75% na ekranach FHD, ale skala działa tylko na #root,
- wymuszenie ponownego renderowania po pageshow/resume/visibilitychange,
- automatyczne odzyskanie strony po odrzuceniu karty lub braku uruchomienia bundla,
- bez zmian w logice typów, płatności, Supabase i funkcjach Netlify.
