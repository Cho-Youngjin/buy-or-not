-- 핏 판단 허용오차 배율. 클수록 너그럽고(허용 범위가 넓어짐) 작을수록 엄격하다.
-- 값이 하나뿐이라 별도 테이블을 만들지 않고 profiles에 컬럼으로 둔다 —
-- 기존 profiles_update 정책(id = auth.uid())이 이 컬럼의 권한도 그대로 커버한다.
-- CHECK로 범위를 DB에서 강제해, 클라이언트·API 검증이 뚫려도 이상한 값이 저장되지 않게 한다.
alter table profiles
  add column fit_strictness numeric(2, 1) not null default 1.0
  check (fit_strictness between 0.5 and 2.0);
