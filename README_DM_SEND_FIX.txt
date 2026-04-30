Jeśli dalej nie wysyła wiadomości:
1. Sprawdź czy w tabeli public.direct_messages są kolumny:
   sender_id, receiver_id, message_text, is_read, created_at
2. Sprawdź czy polityka INSERT pozwala na:
   auth.uid() = sender_id
3. Użytkownik musi być zalogowany i wybrany odbiorca musi istnieć w public.profiles
4. Otwórz konsolę przeglądarki (F12) i sprawdź czy nie ma błędu dm_send_failed
