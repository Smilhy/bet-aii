-- WERSJA 1653 — naprawa liczby zdarzeń AKO dla istniejących kuponów.

update public.tips
set legs_count = greatest(coalesce(legs_count, 0), jsonb_array_length(legs_json))
where (is_ako = true or lower(coalesce(coupon_type, '')) = 'ako')
  and jsonb_typeof(legs_json) = 'array';

select 'WERSJA 1653 AKO LEGS COUNT FIX OK' as status;
