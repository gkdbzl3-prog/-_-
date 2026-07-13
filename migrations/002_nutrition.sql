-- 4단계(병행): AI 영양 태그. 6축(단백질/채소/탄수화물/지방/당류/나트륨) + 보완 tip 을
-- 하나의 jsonb 로 저장한다. nullable 이라 기존 기록은 그대로 유효.
-- Supabase 대시보드의 SQL Editor에서 실행하세요.

alter table food_logs
  add column if not exists nutrition jsonb;
