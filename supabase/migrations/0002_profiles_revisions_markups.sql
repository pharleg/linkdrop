-- profiles: extends auth.users
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  plan text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  custom_domain text,
  hide_branding boolean not null default false,
  created_at timestamptz not null default now()
);

-- auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- proposal_revisions: versioned content
create table if not exists proposal_revisions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  revision integer not null default 1,
  body text not null,
  file_url text,
  created_at timestamptz not null default now(),
  unique(proposal_id, revision)
);

-- markups: paragraph-level comments and strikethroughs
create table if not exists markups (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  revision integer not null,
  paragraph_index integer not null,
  markup_type text not null check (markup_type in ('strikethrough', 'comment')),
  comment_text text,
  reply_text text,
  author_role text not null check (author_role in ('sender', 'recipient')),
  created_at timestamptz not null default now()
);

-- signatures: add revision column if missing
alter table signatures add column if not exists revision integer not null default 1;

-- proposals: drop columns moved to proposal_revisions
alter table proposals drop column if exists body;
alter table proposals drop column if exists file_url;
