-- 식사 유형 태그: 한 끼 식사 / 간식 / 디저트 / 음료 / 야식 / 추가 음식
-- nullable 이라 기존 기록은 그대로 유효.
-- Supabase 대시보드의 SQL Editor에서 실행하세요.

alter table food_logs
  add column if not exists meal_type text;
