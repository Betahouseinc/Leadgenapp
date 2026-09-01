-- Records what each lead-generation run actually cost at the data provider.
--
-- Until now the only cost signal was scrape_runs.limit_requested, which is what
-- was *asked for*, not what was spent: a run that fails part way, or returns
-- fewer places than requested, still bills for what it crawled. That proxy is
-- why an Apify balance could reach $0.12 without anyone noticing.
--
-- scrape-worker fills this from the Apify run object's usageTotalUsd at the
-- moment the run reaches a terminal state, which is the only time it is
-- reported. Null means the run never reached a terminal state (killed slice,
-- reaped job) or predates this column.

alter table public.scrape_runs
  add column if not exists cost_usd numeric(10, 6);

comment on column public.scrape_runs.cost_usd is
  'Actual provider spend for this run in USD, from Apify usageTotalUsd. Null if the run never terminated cleanly.';
