-- ============================================================
-- Thêm loại mục tiêu 'payment' (Chỉ tiêu) cho Sổ cá nhân.
-- Chạy 1 lần trong Supabase Dashboard → SQL Editor, sau supabase-migration-personal-goals.sql.
-- Chạy lại nhiều lần cũng không sao (idempotent).
-- ============================================================
--
-- kind = 'payment' : chỉ tiêu — số tiền cần chi đủ mỗi kỳ, ví dụ Trả nợ 5.000.000đ/tháng.
--                    Đạt khi đã chi đủ trong kỳ, Không đạt khi hết kỳ mà chưa đủ.
--                    Các khoản của nhãn này vẫn tính vào "Chi tiêu".

alter table public.personal_goals drop constraint if exists personal_goals_kind_check;
alter table public.personal_goals
  add constraint personal_goals_kind_check check (kind in ('limit', 'target', 'payment'));
