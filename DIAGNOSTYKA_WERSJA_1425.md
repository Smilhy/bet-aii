## Największe pliki
- public/auth-login-placeholder-609.png: 3.06 MB
- dist/auth-login-placeholder-609.png: 3.06 MB
- src/styles.css: 2.89 MB
- public/bet_ai_ultra_pro_nowy_tip.gif: 2.49 MB
- dist/bet_ai_ultra_pro_nowy_tip.gif: 2.49 MB
- dist/assets/index-CXiCiM4l.css: 2.44 MB
- public/auth-frame-reference-609.png: 2.09 MB
- dist/auth-frame-reference-609.png: 2.09 MB
- public/auth-frame-reference-609-ru.png: 1.91 MB
- dist/auth-frame-reference-609-ru.png: 1.91 MB
- public/auth-frame-reference-609-es.png: 1.91 MB
- dist/auth-frame-reference-609-es.png: 1.91 MB
- public/auth-frame-reference-609-de.png: 1.91 MB
- dist/auth-frame-reference-609-de.png: 1.91 MB
- public/auth-frame-reference-609-en.png: 1.90 MB
- dist/auth-frame-reference-609-en.png: 1.90 MB
- public/ultra-referrals-banner.png: 1.64 MB
- dist/ultra-referrals-banner.png: 1.64 MB
- public/typy-ai-hero-v1068.png: 1.64 MB
- dist/typy-ai-hero-v1068.png: 1.64 MB
- public/typy-ai-hero-v1062.png: 1.62 MB
- dist/typy-ai-hero-v1062.png: 1.62 MB
- public/ultra-subscription-banner.png: 1.55 MB
- dist/ultra-subscription-banner.png: 1.55 MB
- public/ultra-wallet-banner.png: 1.54 MB
- dist/ultra-wallet-banner.png: 1.54 MB
- public/ultra-profile-banner.png: 1.49 MB
- dist/ultra-profile-banner.png: 1.49 MB
- public/typy-ai-premium-banner-v1052.png: 1.48 MB
- dist/typy-ai-premium-banner-v1052.png: 1.48 MB

## Hotspoty w main.jsx
- DM loadUsers: 1 wystąpień
- DM interval 4000: 9 wystąpień
- DM unreadMap effect: 1 wystąpień
- community realtime: 0 wystąpień
- heavy live views: 0 wystąpień
- heavy recommended RPC: 0 wystąpień
- profiles pagination range: 1 wystąpień
- live_chat_messages 1000: 4 wystąpień

## Główna przyczyna po analizie
Najcięższy element nie był już sam widok Społeczności, tylko panel koperty `UserMessagesPanel`.

W `main.jsx` znalazłem:
- `loadUsers()` pobierał katalog użytkowników z RPC, potem paginował `profiles` do 1600 rekordów, potem czytał `live_chat_messages` limit 1000, potem `direct_messages` limit 500.
- Ten sam `loadUsers()` odpalał się co 4 sekundy w interwale.
- Był dodatkowy `useEffect(... JSON.stringify(unreadMap))`, który znowu odpalał `loadUsers()` po zmianie nieprzeczytanych.
- Czyli jedno kliknięcie koperty mogło robić serię ciężkich zapytań w pętli.
- To tłumaczy ładowanie po 3–10 minut i blokowanie całej strony.

## Co naprawiłem w 1425
- `loadUsers()` jest lekki: pobiera tylko ostatnie rozmowy z `direct_messages` limit 80 i mały fallback `profiles` limit 30.
- Usunięte ciężkie źródła z DM: pełny katalog RPC, paginacja profiles, live_chat_messages 1000, direct_messages 500.
- Interwał DM zmieniony z 4s na 15s.
- Interwał nie odpala już `loadUsers()`, tylko `loadUnread()` i aktywną rozmowę.
- Usunięty efekt zależny od `JSON.stringify(unreadMap)`.
- Rozmowa DM ma limit 80 wiadomości i timeout.
- Wysłanie wiadomości nie odpala już pełnego `loadUsers()`.
- Dodany SQL z indeksami dla `direct_messages`, `profiles` i tabel społeczności.
