-- ============================================================
-- Mục tiêu hằng tháng cho Sổ cá nhân, gắn với từng nhãn.
-- Chạy 1 lần trong Supabase Dashboard → SQL Editor.
-- Chạy lại nhiều lần cũng không sao (idempotent).
-- ============================================================
--
-- kind = 'limit'  : giới hạn chi, ví dụ Ăn uống tối đa 2.000.000đ/tháng
-- kind = 'target' : mục tiêu tích luỹ, ví dụ Tiết kiệm 1.000.000đ/tháng.
--                   Các khoản của nhãn này được tính là "Tích luỹ", không tính vào "Chi tiêu".
-- Mục tiêu áp dụng cho mọi kỳ (từ ngày 10 đến ngày 9 tháng sau), không cần đặt lại.

create table if not exists public.personal_goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label_id   uuid not null references public.personal_labels(id) on delete cascade,
  kind       text not null check (kind in ('limit', 'target')),
  amount     numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  -- Mỗi nhãn có tối đa một mục tiêu
  constraint personal_goals_label_unique unique (label_id)
);

alter table public.personal_goals enable row level security;

-- Mỗi người chỉ đọc/ghi mục tiêu của chính mình, và chỉ cho nhãn của chính mình
drop policy if exists "personal_goals: own select" on public.personal_goals;
create policy "personal_goals: own select" on public.personal_goals
  for select using (user_id = auth.uid());

drop policy if exists "personal_goals: own insert" on public.personal_goals;
create policy "personal_goals: own insert" on public.personal_goals
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.personal_labels l where l.id = label_id and l.user_id = auth.uid())
  );

drop policy if exists "personal_goals: own update" on public.personal_goals;
create policy "personal_goals: own update" on public.personal_goals
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.personal_labels l where l.id = label_id and l.user_id = auth.uid())
  );

drop policy if exists "personal_goals: own delete" on public.personal_goals;
create policy "personal_goals: own delete" on public.personal_goals
  for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.personal_goals to authenticated;

-- Báo API của Supabase nạp lại cấu trúc bảng mới
notify pgrst, 'reload schema';
