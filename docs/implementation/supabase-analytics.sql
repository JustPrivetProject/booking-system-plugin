-- Supabase analytics schema for explicit product actions only.
-- Dev reset version: this script is destructive and recreates the table.

drop table if exists public.analytics_events;

create table public.analytics_events (
    created_at timestamptz not null default now(),
    user_email text not null,
    extension_version text not null,
    feature_area text not null check (feature_area in ('booking', 'container_monitor')),
    terminal text not null check (terminal in ('DCT', 'BCT', 'GCT')),
    action text not null check (action in ('container_added', 'slot_added', 'booking_success')),
    container_key text
);

create index analytics_events_created_at_desc_idx
    on public.analytics_events (created_at desc);

create index analytics_events_user_email_created_at_desc_idx
    on public.analytics_events (user_email, created_at desc);

create index analytics_events_feature_terminal_created_at_desc_idx
    on public.analytics_events (feature_area, terminal, created_at desc);

create index analytics_events_action_terminal_created_at_desc_idx
    on public.analytics_events (action, terminal, created_at desc);

create index analytics_events_action_terminal_container_created_at_desc_idx
    on public.analytics_events (action, terminal, container_key, created_at desc)
    where container_key is not null;

create index analytics_events_user_email_action_terminal_created_at_desc_idx
    on public.analytics_events (user_email, action, terminal, created_at desc);

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

-- Activity by area, terminal, and action with configurable granularity.
-- Replace 'day' with 'hour' for per-hour buckets.
with params as (
    select 'day'::text as granularity
)
select
    case
        when params.granularity = 'hour' then date_trunc('hour', created_at at time zone 'Europe/Warsaw')
        else date_trunc('day', created_at at time zone 'Europe/Warsaw')
    end as time_bucket,
    feature_area,
    terminal,
    action,
    count(*) as total_actions,
    count(distinct user_email) as active_users,
    count(distinct container_key) filter (where container_key is not null) as unique_containers
from public.analytics_events
cross join params
group by 1, 2, 3, 4
order by 1 desc, 2, 3, 4;

-- Booking successes by terminal
select
    terminal,
    count(*) as booking_successes,
    count(distinct user_email) as users,
    count(distinct container_key) filter (where container_key is not null) as unique_containers
from public.analytics_events
where feature_area = 'booking'
  and action = 'booking_success'
group by 1
order by 1;

-- Container additions (Monitor Kontenerow) split by terminal
select
    feature_area,
    terminal,
    count(*) as containers_added,
    count(distinct container_key) filter (where container_key is not null) as unique_containers_added
from public.analytics_events
where action = 'container_added'
    and feature_area = 'container_monitor'
group by 1, 2
order by 1, 2;

-- Slot additions (booking) split by terminal
select
    terminal,
    count(*) as slots_added,
    count(distinct container_key) filter (where container_key is not null) as unique_containers_with_slot_additions
from public.analytics_events
where action = 'slot_added'
    and feature_area = 'booking'
group by 1
order by 1;

-- Recent activity feed
select
    created_at,
    user_email,
    feature_area,
    terminal,
    action
from public.analytics_events
order by created_at desc
limit 100;
