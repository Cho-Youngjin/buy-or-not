-- 옷장 주인이 비공개 옷장이어도 자기 옷으로 룩을 만들 수 있게 한다(계획 16).
-- 기존 정책은 "대상 옷장이 공개 상태"를 예외 없이 요구해서, 비공개 옷장 주인이
-- 자기 옷으로 룩을 만들려 해도 막혔다 — 친구 추천 흐름(계획 9)만 상정하고 짠 정책이었다.
drop policy outfits_insert on outfits;
create policy outfits_insert on outfits for insert
  with check (
    author_id = auth.uid()
    and (
      wardrobe_owner_id = auth.uid()
      or exists (select 1 from profiles p where p.id = wardrobe_owner_id and p.is_wardrobe_public)
    )
  );
