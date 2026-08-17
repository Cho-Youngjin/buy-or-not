-- 항목별(카테고리 안 실측 키별) 허용오차 직접 입력. garment_measurements와 같은
-- "(대상, 키, 값)" 정규화 패턴을 따른다 — JSONB 한 덩어리 대신 항목 하나하나가 행이라
-- SQL로 다루기 쉽다. (category, field_key)를 복합키로 쓰는 이유: "총장"은 상의(3.0cm)·
-- 아우터(4.0cm)·하의(3.0cm)에서 기본값이 다 달라, 카테고리 없이는 어느 기본값을
-- 대체하는지 알 수 없다.
create table fit_field_overrides (
  owner_id uuid not null references profiles (id) on delete cascade,
  category category not null,
  field_key text not null,
  tolerance numeric(4, 1) not null check (tolerance > 0),
  primary key (owner_id, category, field_key)
);

alter table fit_field_overrides enable row level security;

-- 핏 판단은 항상 로그인한 사용자 자신의 옷장만 대상으로 실행된다(계획 5에서 확인) —
-- profiles처럼 공개 옷장 방문자에게 노출할 이유가 없어 owner_id = auth.uid() 하나로
-- select·insert·update·delete를 전부 커버한다.
create policy fit_field_overrides_select on fit_field_overrides for select
  using (owner_id = auth.uid());

create policy fit_field_overrides_insert on fit_field_overrides for insert
  with check (owner_id = auth.uid());

create policy fit_field_overrides_update on fit_field_overrides for update
  using (owner_id = auth.uid());

create policy fit_field_overrides_delete on fit_field_overrides for delete
  using (owner_id = auth.uid());
