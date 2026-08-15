-- URL 안전한 무작위 공유 slug를 만든다.
create or replace function public.generate_share_slug()
returns text
language sql
volatile
as $$
  select replace(replace(encode(gen_random_bytes(9), 'base64'), '/', '_'), '+', '-');
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname, avatar_url, share_slug)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '사용자'),
    new.raw_user_meta_data ->> 'avatar_url',
    public.generate_share_slug()
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
