create table outfits (
  id uuid primary key default gen_random_uuid(),
  wardrobe_owner_id uuid not null references profiles (id) on delete cascade,
  author_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create table outfit_items (
  outfit_id uuid not null references outfits (id) on delete cascade,
  garment_id uuid not null references garments (id) on delete cascade,
  primary key (outfit_id, garment_id)
);

create index outfits_wardrobe_owner_idx on outfits (wardrobe_owner_id);

alter table outfits enable row level security;
alter table outfit_items enable row level security;

create policy outfits_select on outfits for select
  using (
    wardrobe_owner_id = auth.uid()
    or exists (select 1 from profiles p where p.id = wardrobe_owner_id and p.is_wardrobe_public)
  );

-- 스펙 §7 원문 그대로: author_id=auth.uid()"이고" 대상 옷장이 공개 중이어야 한다 —
-- 본인 옷장이라는 예외가 없다. 즉 자기 옷장으로 룩을 만들려면 그 옷장도 공개돼 있어야 한다.
create policy outfits_insert on outfits for insert
  with check (
    author_id = auth.uid()
    and exists (select 1 from profiles p where p.id = wardrobe_owner_id and p.is_wardrobe_public)
  );

create policy outfits_delete on outfits for delete
  using (author_id = auth.uid() or wardrobe_owner_id = auth.uid());

create policy outfit_items_select on outfit_items for select
  using (
    exists (
      select 1 from outfits o
      where o.id = outfit_items.outfit_id
        and (
          o.wardrobe_owner_id = auth.uid()
          or exists (select 1 from profiles p where p.id = o.wardrobe_owner_id and p.is_wardrobe_public)
        )
    )
  );

-- 룩에 담기는 옷은 그 옷장 소유의 옷이어야 한다(스펙 §6) — garments.owner_id = outfits.wardrobe_owner_id를
-- 조인으로 검증한다. 친구가 남의 옷장 룩에 제3자의(자기 것 포함) 옷을 끼워 넣을 수 없다.
create policy outfit_items_insert on outfit_items for insert
  with check (
    exists (
      select 1 from outfits o
      join garments g on g.id = outfit_items.garment_id
      where o.id = outfit_items.outfit_id
        and o.author_id = auth.uid()
        and g.owner_id = o.wardrobe_owner_id
    )
  );

create policy outfit_items_delete on outfit_items for delete
  using (
    exists (
      select 1 from outfits o
      where o.id = outfit_items.outfit_id
        and (o.author_id = auth.uid() or o.wardrobe_owner_id = auth.uid())
    )
  );
