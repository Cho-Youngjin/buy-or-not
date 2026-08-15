alter table profiles enable row level security;
alter table garments enable row level security;
alter table garment_measurements enable row level security;
alter table musinsa_cache enable row level security;
-- musinsa_cache에는 정책을 만들지 않는다. service_role만 접근한다.

create policy profiles_select on profiles for select
  using (id = auth.uid() or is_wardrobe_public);

create policy profiles_insert on profiles for insert
  with check (id = auth.uid());

create policy profiles_update on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy garments_select on garments for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = garments.owner_id and p.is_wardrobe_public
    )
  );

-- 본인 옷장에는 자유롭게, 남의 공개 옷장에는 '추천(장바구니)'으로만 넣을 수 있다.
create policy garments_insert on garments for insert
  with check (
    owner_id = auth.uid()
    or (
      status = 'considering'
      and recommended_by = auth.uid()
      and exists (
        select 1 from profiles p
        where p.id = owner_id and p.is_wardrobe_public
      )
    )
  );

create policy garments_update on garments for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy garments_delete on garments for delete
  using (owner_id = auth.uid());

create policy gm_select on garment_measurements for select
  using (
    exists (
      select 1 from garments g
      where g.id = garment_measurements.garment_id
        and (
          g.owner_id = auth.uid()
          or exists (
            select 1 from profiles p
            where p.id = g.owner_id and p.is_wardrobe_public
          )
        )
    )
  );

-- 실측 삽입은 그 옷을 넣을 수 있었던 사람(주인 또는 추천자)에게 허용한다.
create policy gm_insert on garment_measurements for insert
  with check (
    exists (
      select 1 from garments g
      where g.id = garment_measurements.garment_id
        and (g.owner_id = auth.uid() or g.recommended_by = auth.uid())
    )
  );

create policy gm_update on garment_measurements for update
  using (
    exists (
      select 1 from garments g
      where g.id = garment_measurements.garment_id and g.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from garments g
      where g.id = garment_measurements.garment_id and g.owner_id = auth.uid()
    )
  );

create policy gm_delete on garment_measurements for delete
  using (
    exists (
      select 1 from garments g
      where g.id = garment_measurements.garment_id and g.owner_id = auth.uid()
    )
  );
