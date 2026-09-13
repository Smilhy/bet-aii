BET+AI V374 — FM AI AUTO TRACKER 24/7 + LEAGUE DRILLDOWN

1. FM AI System Tracker no longer depends only on opening the FM AI tab.
2. Netlify scheduled function triggers the autonomous tracker every hour.
3. It scans today's approved FM AI competitions, reuses fresh scanner snapshots, and records the FIRST actionable VALUE / STRONG_VALUE before kickoff.
4. Existing fixture_id freeze/deduplication remains unchanged: one paper pick per fixture, no rewriting after publication.
5. Existing hourly settlement continues to grade picks from real API-Football final scores.
6. Full Statistics -> league rows are now clickable.
7. Clicking a league opens a detailed league modal with:
   - picks, stake, profit, yield, W/L/V, hit rate,
   - settled market/pick types,
   - count, stake, profit, yield, average odds and W/L/V by market,
   - recent picks from that league.
8. The new league modal includes Polish/English copy for the new elements.
9. No new Supabase SQL/table is required. It uses existing fm_ai_system_picks_v368 and match_value_scan_snapshots.
10. V373 timezone/flags logic is preserved.

Netlify schedules:
- scheduled-fm-ai-auto-tracker: minute 06 every hour
- settle-fm-ai-system-picks: minute 26 every hour (existing)
