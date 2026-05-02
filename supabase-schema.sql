-- ============================================================
--  SayIt — Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Profiles (extends auth.users) ────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text unique,
  avatar_url  text,
  created_at  timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Categories ────────────────────────────────────────────────
create table if not exists public.categories (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text unique not null,
  icon            text,
  gradient_from   text,
  gradient_to     text,
  display_order   int default 0,
  is_hero         boolean default false,
  is_active       boolean default true,
  created_at      timestamptz default now()
);

alter table public.categories enable row level security;
create policy "Anyone can read categories" on public.categories for select using (true);
create policy "Admin can manage categories" on public.categories for all using (auth.role() = 'service_role');

-- ── Sub-categories ────────────────────────────────────────────
create table if not exists public.subcategories (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid references public.categories(id) on delete cascade,
  name            text not null,
  slug            text not null,
  icon            text,
  display_order   int default 0
);

alter table public.subcategories enable row level security;
create policy "Anyone can read subcategories" on public.subcategories for select using (true);

-- ── Templates ─────────────────────────────────────────────────
create table if not exists public.templates (
  id                  uuid primary key default gen_random_uuid(),
  category_id         uuid references public.categories(id) on delete cascade,
  subcategory_id      uuid references public.subcategories(id) on delete set null,
  title               text,
  front_image_url     text not null,
  inside_image_url    text,
  color_accent        text,
  display_order       int default 0,
  is_active           boolean default true,
  created_at          timestamptz default now()
);

alter table public.templates enable row level security;
create policy "Anyone can read active templates" on public.templates for select using (is_active = true);
create policy "Admin can manage templates" on public.templates for all using (auth.role() = 'service_role');

-- ── Sent Cards ────────────────────────────────────────────────
create table if not exists public.sent_cards (
  id                uuid primary key default gen_random_uuid(),
  sender_id         uuid references public.profiles(id) on delete cascade,
  recipient_phone   text not null,
  recipient_id      uuid references public.profiles(id) on delete set null,
  template_id       uuid,   -- references templates — kept loose for flexibility
  message           text not null,
  short_code        text unique not null,
  viewed_at         timestamptz,
  created_at        timestamptz default now()
);

alter table public.sent_cards enable row level security;

create policy "Sender can see own sent cards"
  on public.sent_cards for select using (auth.uid() = sender_id);

create policy "Recipient can see cards sent to them"
  on public.sent_cards for select using (auth.uid() = recipient_id);

create policy "Authenticated users can insert"
  on public.sent_cards for insert with check (auth.uid() = sender_id);

create policy "Public short code lookup (preview page)"
  on public.sent_cards for select using (true);  -- scoped by short_code in query

-- ── Reactions ─────────────────────────────────────────────────
create table if not exists public.reactions (
  id              uuid primary key default gen_random_uuid(),
  card_id         uuid references public.sent_cards(id) on delete cascade,
  reactor_id      uuid references public.profiles(id) on delete cascade,
  emoji           text,
  pre_made_message text,
  created_at      timestamptz default now(),
  unique(card_id, reactor_id)   -- one reaction per card per user
);

alter table public.reactions enable row level security;

create policy "Card sender can see reactions"
  on public.reactions for select using (
    exists (select 1 from public.sent_cards where id = card_id and sender_id = auth.uid())
  );

create policy "Reactor can insert reaction"
  on public.reactions for insert with check (auth.uid() = reactor_id);

-- ── Feedback (from landing page) ──────────────────────────────
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  email       text,
  phone       text,
  message     text,
  created_at  timestamptz default now()
);

alter table public.feedback enable row level security;
create policy "Anyone can submit feedback" on public.feedback for insert with check (true);
create policy "Admin can read feedback" on public.feedback for select using (auth.role() = 'service_role');

-- ============================================================
--  Done! Now go to Authentication → Providers and enable:
--  - Email (already enabled)
--  - Google (add Client ID + Secret from Google Cloud Console)
-- ============================================================
