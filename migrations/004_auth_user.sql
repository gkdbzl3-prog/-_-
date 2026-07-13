-- 유저별 데이터 분리: user_id + RLS (Supabase Auth 이메일 OTP)
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여넣고 Run.

-- 1) 소유자 컬럼 (FK 없이 uuid 만 — 가장 호환성 높음)
alter table public.food_logs
  add column if not exists user_id uuid;

-- 2) 행 수준 보안 켜기
alter table public.food_logs enable row level security;

-- 3) 본인 행만 접근 (select/insert/update/delete 를 정책 하나로)
drop policy if exists "own rows" on public.food_logs;
create policy "own rows" on public.food_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- (선택) 기존 기록을 내 계정에 귀속시키려면, 로그인 후 아래 SELECT 로 내 id 를 찾아
--   select id, email from auth.users;
-- 그 id 로 아래 주석을 풀어 실행. 안 하면 기존 기록은 안 보입니다.
-- update public.food_logs set user_id = '<MY_USER_ID>' where user_id is null;
