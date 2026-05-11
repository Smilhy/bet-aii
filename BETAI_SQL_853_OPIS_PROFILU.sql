-- BETAI SQL 853 — opis profilu użytkownika
-- Uruchom tylko raz w Supabase SQL Editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text;

-- Własny profil można aktualizować; jeśli polityka już istnieje, nic nie zmieniamy.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles update owner" ON public.profiles;
CREATE POLICY "Profiles update owner"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
