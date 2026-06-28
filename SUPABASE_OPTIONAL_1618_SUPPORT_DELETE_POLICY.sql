-- OPCJONALNE: użyj tylko jeśli po kliknięciu „×” pojawi się błąd uprawnień/RLS.
-- Pozwala zalogowanemu adminowi smilhytv@gmail.com usuwać wiadomości z centrum wsparcia.

create policy if not exists "support_messages_admin_delete_1618"
on public.support_messages
for delete
to authenticated
using (
  lower((select email from auth.users where id = auth.uid())) = 'smilhytv@gmail.com'
  or lower(sender_email) = 'smilhytv@gmail.com'
  or lower(admin_email) = 'smilhytv@gmail.com'
);
