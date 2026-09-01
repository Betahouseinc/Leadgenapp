-- Per-lead contact enrichment, run on demand rather than for every lead.
--
-- Discovery (Google Places) never returns an email, so a lead arrives with a
-- phone and a website and nothing to mail. Enrichment fills that in when the
-- user asks for a specific lead, which is what keeps it affordable: the free
-- path is a fetch of the business's own site, and the paid path (a grounded
-- Gemini search) only runs for the leads someone actually wants.
--
-- enriched_at doubles as the "already tried" marker. A lead that was attempted
-- and yielded nothing still gets a timestamp, so the button does not silently
-- re-run the expensive path every time it is clicked.

alter table public.leads
  add column if not exists enriched_at       timestamptz,
  add column if not exists enrichment_source text;

comment on column public.leads.enriched_at is
  'When enrichment last ran for this lead, successful or not. Null means never attempted.';
comment on column public.leads.enrichment_source is
  'Where the email came from: website (free page fetch), search (grounded Gemini), or none (attempted, nothing found).';

-- Reads the per-user daily ceiling on grounded lookups, which is the only part
-- of enrichment that costs money.
create index if not exists leads_enrichment_source_idx
  on public.leads (user_id, enrichment_source, enriched_at desc)
  where enrichment_source is not null;
