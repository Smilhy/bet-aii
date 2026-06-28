-- Usuwa testowy/fallbackowy profil i typy: bet-ai-model / u-ytkownik.
-- Odpal w Supabase SQL Editor, jeśli nadal widzisz konto po wgraniu wersji 1101.

delete from public.tips
where lower(coalesce(author_name, '')) in ('bet-ai-model','u-ytkownik','użytkownik','uzytkownik')
   or lower(coalesce(username, '')) in ('bet-ai-model','u-ytkownik','użytkownik','uzytkownik')
   or lower(coalesce(author_email, '')) like '%bet-ai-model%';

delete from public.tipster_ranking
where lower(coalesce(username, '')) in ('bet-ai-model','u-ytkownik','użytkownik','uzytkownik')
   or lower(coalesce(tipster_name, '')) in ('bet-ai-model','u-ytkownik','użytkownik','uzytkownik');

delete from public.profiles
where lower(coalesce(username, '')) in ('bet-ai-model','u-ytkownik','użytkownik','uzytkownik')
   or lower(coalesce(public_slug, '')) in ('bet-ai-model','u-ytkownik','użytkownik','uzytkownik')
   or lower(coalesce(email, '')) like '%bet-ai-model%';
