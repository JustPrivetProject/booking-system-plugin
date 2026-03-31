# GCT feature access setup

The extension now expects a Supabase table named `feature_access`.

Apply the same SQL in both Supabase projects:

- `brama-plugin-dev`
- `brama-plugin-prod`

The code already uses the active project from `SUPABASE_URL` and `SUPABASE_ANON_KEY`, so the environment separation is automatic.

## SQL

```sql
create table if not exists public.feature_access (
    user_id uuid not null references auth.users (id) on delete cascade,
    feature_key text not null,
    enabled boolean not null default false,
    updated_at timestamptz not null default now(),
    constraint feature_access_pkey primary key (user_id, feature_key)
);

alter table public.feature_access enable row level security;

create policy "Users can read own feature access"
on public.feature_access
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can manage own feature access"
on public.feature_access
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.set_feature_access_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_feature_access_updated_at on public.feature_access;

create trigger set_feature_access_updated_at
before update on public.feature_access
for each row
execute function public.set_feature_access_updated_at();
```

## Grant access to a user

```sql
insert into public.feature_access (user_id, feature_key, enabled)
values ('USER_UUID_HERE', 'gct_tab', true)
on conflict (user_id, feature_key)
do update set enabled = excluded.enabled;
```

## Revoke access

```sql
update public.feature_access
set enabled = false
where user_id = 'USER_UUID_HERE'
  and feature_key = 'gct_tab';
```