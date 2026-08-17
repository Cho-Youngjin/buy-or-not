-- 다크모드 설정. profiles에 저장해 기기 간 동기화된다(핏 강도·옷장 공개 여부와 같은 자리).
-- 'system'이 기본값 — CSS만으로 OS 다크모드를 그대로 따르고, 사용자가 명시적으로
-- light/dark를 고르면 그 값이 우선한다(app/layout.tsx가 <html data-theme>로 반영).
-- 기존 profiles_update RLS 정책(id = auth.uid())이 이 컬럼도 그대로 커버해 새 정책이 필요 없다.
alter table profiles
  add column theme text not null default 'system'
  check (theme in ('system', 'light', 'dark'));
