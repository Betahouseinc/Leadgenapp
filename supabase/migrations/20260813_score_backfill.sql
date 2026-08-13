-- 2026-08-13 — Retire the fabricated score of 40
--
-- scrape-leads used to write `score: 40, summary: '[AI scoring unavailable]'`
-- whenever Gemini failed, so a large share of rows carry a score the product
-- never actually computed. The function no longer does this — a chunk that
-- cannot be scored now aborts the run and saves nothing — but the rows already
-- written still misrepresent themselves to the customer.
--
-- These rows are NOT deleted. They are real businesses the customer can still
-- work, and deleting paid-for data is not ours to decide. The score is set to
-- NULL so the UI can render an honest "unscored" state instead of a red 40,
-- and the rows stay re-scoreable later.
--
-- Idempotent: re-running only ever affects rows still carrying the marker.

-- ---------------------------------------------------------------------------
-- 1. Make the column nullable
--
-- NULL is the representation of "not scored". If a NOT NULL constraint or a
-- DEFAULT 40 is present it would silently defeat the whole fix, so clear both.
-- ---------------------------------------------------------------------------

alter table leads alter column score drop not null;
alter table leads alter column score drop default;

-- ---------------------------------------------------------------------------
-- 2. Backfill
--
-- Matched on the summary marker rather than on `score = 40`, so genuine leads
-- that legitimately scored 40 are left untouched.
-- ---------------------------------------------------------------------------

update leads
   set score = null,
       summary = '[not scored — re-run this search to score it]'
 where score is not null
   and coalesce(summary, '') like '%AI scoring unavailable%';

-- ---------------------------------------------------------------------------
-- 3. Verification
--
-- Run these by hand after applying. The first should return 0 rows. The second
-- shows the score distribution — a healthy one is spread across the range, not
-- piled on a single value.
-- ---------------------------------------------------------------------------

-- select count(*) from leads where coalesce(summary,'') like '%AI scoring unavailable%';
--
-- select score, count(*)
--   from leads
--  group by score
--  order by count(*) desc
--  limit 20;
