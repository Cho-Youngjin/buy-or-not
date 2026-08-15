create extension if not exists pgcrypto;

create type category as enum ('top', 'bottom', 'outer', 'shoes', 'acc');
create type garment_status as enum ('owned', 'considering');
create type fit_tag as enum ('tight', 'just', 'loose');
create type wear_frequency as enum ('often', 'sometimes', 'rarely');
create type parse_mode as enum ('auto', 'partial', 'manual');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text,
  avatar_url text,
  share_slug text unique not null,
  is_wardrobe_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table garments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  status garment_status not null default 'owned',
  source_url text,
  goods_no text,
  brand text,
  name text not null,
  price integer check (price is null or price >= 0),
  image_url text,
  category category not null,
  color_option text,
  size_option text,
  ai_tags jsonb,
  rating smallint check (rating is null or rating between 1 and 5),
  fit_tag fit_tag,
  wear_frequency wear_frequency,
  parse_mode parse_mode not null default 'manual',
  recommended_by uuid references profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index garments_owner_status_idx on garments (owner_id, status);
create index garments_owner_category_idx on garments (owner_id, category);
create index garments_goods_no_idx on garments (goods_no);

create table garment_measurements (
  garment_id uuid not null references garments (id) on delete cascade,
  key text not null,
  value numeric(5, 1) not null,
  primary key (garment_id, key)
);

create table musinsa_cache (
  goods_no text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

-- 상품 이미지 사본 버킷 (공개 읽기, 쓰기는 service_role만)
insert into storage.buckets (id, name, public)
values ('garments', 'garments', true)
on conflict (id) do nothing;
