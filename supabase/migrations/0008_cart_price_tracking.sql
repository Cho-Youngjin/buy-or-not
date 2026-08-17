-- 장바구니(status='considering') 상품의 가격 인하를 보여주기 위한 컬럼.
-- price(등록 당시 가격)는 그대로 두고, 가장 최근에 확인한 가격과 확인 시각만 더한다.
-- 가격 이력 전체를 남기는 별도 테이블은 만들지 않는다 — 필요한 건 "원래→지금" 한 쌍이지
-- 히스토리 그래프가 아니다. 기존 garments_update RLS 정책(owner_id = auth.uid())이
-- 이 두 컬럼도 그대로 커버해 새 정책이 필요 없다.
alter table garments
  add column last_known_price integer check (last_known_price is null or last_known_price >= 0),
  add column price_checked_at timestamptz;
