-- 왜_먹었지: 지금까지 추가된 모든 컬럼을 한 번에 적용 (001+002+003).
-- 전부 nullable + "if not exists" 라 여러 번 실행해도 안전하고 기존 기록도 유효.
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run.
--
-- 이 마이그레이션을 실행하기 전에는 음식 '추가'가 실패한다.
-- (없는 컬럼에 insert 를 시도하기 때문)

alter table food_logs
  add column if not exists reason    text,     -- 왜 먹었지 (이유)
  add column if not exists hunger    text,     -- 먹기 전 상태
  add column if not exists source    text,     -- 출처(집밥/외식/배달 등)
  add column if not exists meal_type text,      -- 식사 유형(한 끼/간식/야식 등)
  add column if not exists accuracy  integer,   -- 칼로리 추정 정확도(%)
  add column if not exists nutrition jsonb;     -- AI 영양 태그(6축 + tip)
