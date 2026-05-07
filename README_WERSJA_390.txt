BetAI wersja 390

Zmiany:
- Przeniesiona logika tipowania na czacie: kliknięcie Tip 1 zabiera 1 żeton nadawcy i dodaje 1 żeton odbiorcy.
- Tip zapisuje się w live_chat_tips, aktualizuje tipped_amount wiadomości, dopisuje historię w betai_token_transactions i powiadomienia dla obu stron.
- Aktywni teraz na czacie liczeni są z tabeli presence_heartbeats z ostatnich 60 sekund, czyli pokazują realnie zalogowanych aktywnych w danej minucie.
- Lider aktywności czatu z ostatnich 24h/dnia dostaje 1 żeton raz na dobę przez live_chat_daily_rewards.
- Po zalogowaniu użytkownik dostaje miłą wiadomość powitalną i portfel żetonów jest inicjalizowany; nowy portfel dostaje 100 żetonów startowych.
- Ramka powiadomień otwiera się pod dzwonkiem.

Ważne SQL:
Uruchom w Supabase plik: supabase/version_390_chat_tokens_presence_welcome.sql
Jeśli tabele już istnieją, skrypt jest idempotentny i tylko uzupełni brakujące elementy/polityki.
