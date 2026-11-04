-- ============================================================
-- Lưu màu giao diện trên Supabase để đồng bộ giữa các thiết bị.
-- Chạy 1 lần trong Supabase Dashboard → SQL Editor.
-- Chạy lại nhiều lần cũng không sao (idempotent).
-- ============================================================

-- 1. Màu trang danh sách phòng (/rooms) và màu Sổ cá nhân: lưu trong profiles
alter table public.profiles
  add column if not exists dashboard_theme text,
  add column if not exists personal_theme text;

alter table public.profiles drop constraint if exists profiles_dashboard_theme_hex;
alter table public.profiles add constraint profiles_dashboard_theme_hex
  check (dashboard_theme is null or dashboard_theme ~ '^#[0-9a-fA-F]{6}$');

alter table public.profiles drop constraint if exists profiles_personal_theme_hex;
alter table public.profiles add constraint profiles_personal_theme_hex
  check (personal_theme is null or personal_theme ~ '^#[0-9a-fA-F]{6}$');

-- 2. Màu từng phòng, riêng cho mỗi người (hai thành viên cùng phòng có thể chọn màu khác nhau)
create table if not exists public.user_room_themes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  color   text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  primary key (user_id, room_id)
);

alter table public.user_room_themes enable row level security;

-- Mỗi người chỉ đọc/ghi màu của chính mình, và chỉ cho phòng mình là thành viên
drop policy if exists "user_room_themes: own select" on public.user_room_themes;
create policy "user_room_themes: own select" on public.user_room_themes
  for select using (user_id = auth.uid());

drop policy if exists "user_room_themes: own insert" on public.user_room_themes;
create policy "user_room_themes: own insert" on public.user_room_themes
  for insert with check (user_id = auth.uid() and public.is_room_member(room_id));

drop policy if exists "user_room_themes: own update" on public.user_room_themes;
create policy "user_room_themes: own update" on public.user_room_themes
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_room_member(room_id));

drop policy if exists "user_room_themes: own delete" on public.user_room_themes;
create policy "user_room_themes: own delete" on public.user_room_themes
  for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.user_room_themes to authenticated;

-- Báo API của Supabase nạp lại cấu trúc bảng mới
notify pgrst, 'reload schema';
