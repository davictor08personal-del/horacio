-- Run ONCE, after the app is published on Vercel (Supabase → SQL Editor → New query → Run).
-- Every minute Supabase calls /api/tick, which sends the reminders that are due and the 9:30 summary.
-- Before running, replace the two values below:
--   https://YOUR-APP.vercel.app → the app's address in Vercel
--   YOUR_CRON_SECRET            → the same CRON_SECRET you put in Vercel's environment variables
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('horacio-tick') where exists (select 1 from cron.job where jobname = 'horacio-tick');
select cron.schedule('horacio-tick', '* * * * *', $$
  select net.http_post(
    url := 'https://YOUR-APP.vercel.app/api/tick',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  )
$$);

-- To check it's running: select * from cron.job_run_details order by start_time desc limit 5;
-- To stop it:            select cron.unschedule('horacio-tick');
