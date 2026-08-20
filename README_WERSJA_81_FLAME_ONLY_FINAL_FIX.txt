WERSJA 81 — FLAME ONLY FINAL FIX

ZMIENIONE TYLKO TO:
- poprawiony wyłącznie płomyk przy statusie "Oczekujący"
- bez zmian w pozostałym layoucie, kartach, spacingu i statusach

CO BYŁO ŹLE:
- poprzedni flame oparty o SVG potrafił znikać / nie renderować się poprawnie
- przez to na dashboardzie przy pending nie było widać płomienia

CO JEST TERAZ:
- flame renderowany jako mała ikonka emoji 🔥
- nadal ma poziomy intensywności zależne od czasu do kickoffu
- delikatny glow + puls rosnący bliżej startu meczu
- status "Oczekujący" zostaje bez zmian

PLIKI:
- src/main.jsx
- src/styles.css
