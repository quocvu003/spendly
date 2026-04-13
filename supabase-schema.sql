-- =============================================
-- Run this in Supabase SQL Editor
-- Drop old tables first if re-running
-- =============================================

drop trigger if exists on_user_created on auth.users;
drop function if exists create_default_wallet();
drop table if exists transaction_splits cascade;
drop table if exists transactions cascade;
drop table if exists room_members cascade;
drop table if exists rooms cascade;
drop table if exists wallets cascade;

-- =============================================
-- ROOMS
-- =============================================
create table rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- =============================================
-- ROOM MEMBERS
-- =============================================
create table room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  unique(room_id, user_id)
);

-- =============================================
-- SETTLEMENTS
-- =============================================
create table settlements (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  total_amount numeric(12,2) not null,
  created_at timestamptz default now()
);

-- =============================================
-- TRANSACTIONS
-- type: 'shared' = chia đều, 'personal' = chọn ai liên quan
-- paid_by: user_id người trả trước
-- =============================================
create table transactions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  paid_by uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('shared', 'personal')),
  amount numeric(12,2) not null check (amount > 0),
  description text not null,
  date date not null default current_date,
  settlement_id uuid references settlements(id) on delete set null,
  created_at timestamptz default now()
);

-- =============================================
-- TRANSACTION SPLITS
-- Each row = how much a specific user owes for a transaction
-- =============================================
create table transaction_splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  amount numeric(12,2) not null, -- their share
  unique(transaction_id, user_id)
);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================
create or replace function public.is_room_member(check_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from room_members
    where room_id = check_room_id and user_id = auth.uid()
  );
$$;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
alter table rooms enable row level security;
alter table room_members enable row level security;
alter table settlements enable row level security;
alter table transactions enable row level security;
alter table transaction_splits enable row level security;

-- rooms: visible to members
create policy "rooms: members can view" on rooms
  for select using (
    public.is_room_member(id)
    or owner_id = auth.uid()
  );
create policy "rooms: owner can insert" on rooms
  for insert with check (owner_id = auth.uid());
create policy "rooms: owner can update" on rooms
  for update using (owner_id = auth.uid());
create policy "rooms: owner can delete" on rooms
  for delete using (owner_id = auth.uid());

-- room_members
create policy "room_members: members can view" on room_members
  for select using (
    public.is_room_member(room_id)
    or exists (select 1 from rooms r where r.id = room_id and r.owner_id = auth.uid())
  );
create policy "room_members: owner can insert" on room_members
  for insert with check (
    exists (select 1 from rooms where id = room_id and owner_id = auth.uid())
  );
create policy "room_members: owner can delete" on room_members
  for delete using (
    exists (select 1 from rooms where id = room_id and owner_id = auth.uid())
  );

-- settlements
create policy "settlements: room members can view" on settlements
  for select using (
    public.is_room_member(room_id)
  );
create policy "settlements: room members can insert" on settlements
  for insert with check (
    public.is_room_member(room_id)
  );

-- transactions
create policy "transactions: room members can view" on transactions
  for select using (
    public.is_room_member(room_id)
  );
create policy "transactions: room members can insert" on transactions
  for insert with check (
    public.is_room_member(room_id)
  );
create policy "transactions: room members can update" on transactions
  for update using (public.is_room_member(room_id));
create policy "transactions: paid_by can delete" on transactions
  for delete using (paid_by = auth.uid());

-- transaction_splits
create policy "splits: room members can view" on transaction_splits
  for select using (
    exists (
      select 1 from transactions t
      where t.id = transaction_id and public.is_room_member(t.room_id)
    )
  );
create policy "splits: room members can insert" on transaction_splits
  for insert with check (
    exists (
      select 1 from transactions t
      where t.id = transaction_id and public.is_room_member(t.room_id)
    )
  );
create policy "splits: room members can delete" on transaction_splits
  for delete using (
    exists (
      select 1 from transactions t
      where t.id = transaction_id and public.is_room_member(t.room_id)
    )
  );

-- =============================================
-- AUTO-ADD OWNER AS MEMBER WHEN ROOM CREATED
-- =============================================
create or replace function add_owner_as_member()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.room_members (room_id, user_id) values (new.id, new.owner_id);
  return new;
end;
$$;

create trigger on_room_created
  after insert on rooms
  for each row execute function add_owner_as_member();
