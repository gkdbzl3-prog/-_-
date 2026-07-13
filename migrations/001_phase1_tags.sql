-- 1단계: '왜 먹었지' 이유/출처 태그 + 정확도(%) 컬럼 추가
-- Supabase 대시보드의 SQL Editor에서 실행하세요.
-- 모든 컬럼은 nullable 이라 기존 기록(reason/source 없는 행)도 그대로 유효합니다.

alter table food_logs
  add column if not exists reason   text,   -- 왜 먹었지: 배고파서 / 스트레스 / 습관적으로 ...
  add column if not exists hunger   text,   -- 먹기 전 상태: 많이 배고픔 / 조금 배고픔 / 안 배고픔
  add column if not exists source   text,   -- 출처: 직접 조리 / 집밥 / 외식 / 배달 / 편의점 ...
  add column if not exists accuracy integer; -- 칼로리 추정 정확도(0~100 %). 기존 confidence 대체 표시용.
