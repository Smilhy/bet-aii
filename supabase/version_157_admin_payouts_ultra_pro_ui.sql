-- VERSION 157 — ADMIN WYPŁATY ULTRA PRO UI
-- Brak wymaganych zmian w bazie danych.
-- Ta wersja poprawia wyłącznie frontend/CSS panelu Admin wypłaty.
select 'version_157_admin_payouts_ultra_pro_ui: frontend-only update' as status;
notify pgrst, 'reload schema';
