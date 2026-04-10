-- Supabase analytics schema for explicit product actions only.
-- Run this in the Supabase SQL editor to migrate the previous event-envelope table
-- to a narrow append-only activity log.

do $$
begin
    if exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'analytics_events'
    ) and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'analytics_events'
          and column_name = 'event_name'
    ) and not exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'analytics_events_legacy'
    ) then
        alter table public.analytics_events rename to analytics_events_legacy;
    end if;
end $$;

drop index if exists public.analytics_events_created_at_idx;
drop index if exists public.analytics_events_user_email_created_at_idx;
drop index if exists public.analytics_events_event_name_created_at_idx;
drop index if exists public.analytics_events_environment_created_at_idx;
drop index if exists public.analytics_events_terminal_created_at_idx;

create table if not exists public.analytics_events (
    created_at timestamptz not null default now(),
    user_email text not null,
    environment text not null check (environment in ('dev', 'prod')),
    extension_version text not null,
    feature_area text not null check (feature_area in ('booking', 'container_monitor')),
    terminal text not null check (terminal in ('DCT', 'BCT', 'GCT')),
    action text not null check (action in ('container_added', 'booking_success'))
);

create index if not exists analytics_events_created_at_desc_idx
    on public.analytics_events (created_at desc);

create index if not exists analytics_events_user_email_created_at_desc_idx
    on public.analytics_events (user_email, created_at desc);

create index if not exists analytics_events_environment_created_at_desc_idx
    on public.analytics_events (environment, created_at desc);

create index if not exists analytics_events_feature_terminal_created_at_desc_idx
    on public.analytics_events (feature_area, terminal, created_at desc);

create index if not exists analytics_events_action_terminal_created_at_desc_idx
    on public.analytics_events (action, terminal, created_at desc);

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

-- Daily activity by area, terminal, and action
select
    date(created_at) as day,
    feature_area,
    terminal,
    action,
    count(*) as total_actions,
    count(distinct user_email) as active_users
from public.analytics_events
group by 1, 2, 3, 4
order by 1 desc, 2, 3, 4;

-- Booking successes by terminal and environment
select
    environment,
    terminal,
    count(*) as booking_successes,
    count(distinct user_email) as users
from public.analytics_events
where feature_area = 'booking'
  and action = 'booking_success'
group by 1, 2
order by 1, 2;

-- Container additions split by booking tabs vs Monitor Kontenerow
select
    environment,
    feature_area,
    terminal,
    count(*) as containers_added
from public.analytics_events
where action = 'container_added'
group by 1, 2, 3
order by 1, 2, 3;

-- Recent activity feed
select
    created_at,
    user_email,
    environment,
    feature_area,
    terminal,
    action
from public.analytics_events
order by created_at desc
limit 100;
