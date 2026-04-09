-- Minimal Supabase analytics schema for the extension.
-- Run this in the Supabase SQL editor before enabling the extension-side tracking.

create extension if not exists pgcrypto;

create table if not exists public.analytics_events (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    user_email text not null,
    environment text not null check (environment in ('dev', 'prod')),
    extension_version text not null,
    event_name text not null check (
        event_name in (
            'session_started',
            'tab_viewed',
            'booking_started',
            'booking_result',
            'container_monitor_action'
        )
    ),
    feature_area text not null check (
        feature_area in (
            'auth',
            'popup',
            'booking',
            'container_monitor'
        )
    ),
    terminal text null check (terminal in ('DCT', 'BCT', 'GCT')),
    success boolean null,
    error_type text null,
    metadata jsonb not null default '{}'::jsonb
);

create index if not exists analytics_events_created_at_idx
    on public.analytics_events (created_at desc);

create index if not exists analytics_events_user_email_created_at_idx
    on public.analytics_events (user_email, created_at desc);

create index if not exists analytics_events_event_name_created_at_idx
    on public.analytics_events (event_name, created_at desc);

create index if not exists analytics_events_environment_created_at_idx
    on public.analytics_events (environment, created_at desc);

create index if not exists analytics_events_terminal_created_at_idx
    on public.analytics_events (terminal, created_at desc);

alter table public.analytics_events enable row level security;

revoke all on public.analytics_events from anon;
revoke all on public.analytics_events from authenticated;

grant insert on public.analytics_events to authenticated;

drop policy if exists analytics_events_insert_authenticated_email_match
    on public.analytics_events;

create policy analytics_events_insert_authenticated_email_match
on public.analytics_events
for insert
to authenticated
with check (
    auth.jwt() ->> 'email' is not null
    and lower(user_email) = lower(auth.jwt() ->> 'email')
);

-- Example saved queries

-- Daily active users by environment
select
    date(created_at) as day,
    environment,
    count(distinct user_email) as active_users
from public.analytics_events
group by 1, 2
order by 1 desc, 2;

-- Tab usage by tab and environment
select
    environment,
    metadata ->> 'tab' as tab,
    count(*) as views
from public.analytics_events
where event_name = 'tab_viewed'
group by 1, 2
order by 1, 3 desc;

-- Booking success rate by terminal and environment
select
    environment,
    terminal,
    count(*) filter (where success is true) as successes,
    count(*) filter (where success is false) as failures,
    round(
        100.0 * count(*) filter (where success is true) / nullif(count(*), 0),
        2
    ) as success_rate_pct
from public.analytics_events
where event_name = 'booking_result'
group by 1, 2
order by 1, 2;

-- Monitor kontenerow activity by day
select
    date(created_at) as day,
    count(distinct user_email) as active_users,
    count(*) as total_actions
from public.analytics_events
where event_name = 'container_monitor_action'
group by 1
order by 1 desc;

-- Top booking errors
select
    environment,
    terminal,
    coalesce(error_type, 'unknown') as error_type,
    count(*) as occurrences
from public.analytics_events
where event_name = 'booking_result'
  and success is false
group by 1, 2, 3
order by occurrences desc;

-- Recent activity feed
select
    created_at,
    user_email,
    environment,
    event_name,
    feature_area,
    terminal,
    success,
    error_type,
    metadata
from public.analytics_events
order by created_at desc
limit 100;
