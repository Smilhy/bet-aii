WERSJA 25 — NOWY HERO TY VS AI WGRANY DO STRONY I DOPASOWANY

To nie jest sama grafika. Paczka zawiera całą stronę z nowym banerem już podłączonym w dashboardzie.

Zmiany:
1. Nowy baner TY vs AI jest wgrany do:
   public/dashboard-hero-v551/you-vs-ai-hero.png
   public/dashboard-hero-v551/en/you-vs-ai-hero.png
2. src/main.jsx ma podłączony nowy baner zamiast Mistrzostw Świata.
3. Dodano specjalną klasę dla tego slajdu.
4. CSS został poprawiony tak, aby baner:
   - wypełniał cały slot hero,
   - nie miał dużych pustych marginesów,
   - używał object-fit: cover,
   - miał proporcje 4:1 na desktopie,
   - był responsywny na tabletach i telefonach.
5. Brak zmian SQL i Supabase.
