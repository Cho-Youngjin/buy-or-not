create type verdict as enum ('buy', 'caution', 'skip');

create table analyses (
  id uuid primary key default gen_random_uuid(),
  garment_id uuid not null references garments (id) on delete cascade,
  requester_id uuid not null references profiles (id) on delete cascade,
  verdict verdict not null,
  fit_score integer not null,
  report jsonb not null,
  feedback jsonb,
  model text,
  prompt_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index analyses_garment_idx on analyses (garment_id);
create index analyses_requester_idx on analyses (requester_id);

alter table analyses enable row level security;

-- 스펙 §7: analyses는 모든 작업에 대해 requester_id = auth.uid()만 허용한다.
-- UPDATE 정책은 만들지 않는다 — 분석 결과는 재계산해서 새로 남길 뿐 수정하지 않는다(불변 기록).
create policy analyses_select on analyses for select
  using (requester_id = auth.uid());

create policy analyses_insert on analyses for insert
  with check (requester_id = auth.uid());

create policy analyses_delete on analyses for delete
  using (requester_id = auth.uid());
