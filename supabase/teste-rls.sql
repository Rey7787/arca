-- Arca: teste das politicas de RLS
-- Finge ser um usuario comum e verifica se as travas funcionam.
-- Nao altera nada permanente: limpa o que criou no fim.

create temp table if not exists resultado_rls (
  n int, teste text, esperado text, obtido text, veredito text
);
truncate resultado_rls;

do $$
declare
  ua uuid;
  ub uuid;
  visiveis int;
  atualizadas int;
  apagadas int;
  insercao_alheia text;
begin
  select id into ua from auth.users order by created_at limit 1;
  select id into ub from auth.users where id <> ua order by created_at limit 1;

  if ub is null then
    insert into resultado_rls values
      (0, 'pre-requisito', '2 usuarios em auth.users',
       'so existe 1', 'RODE A BANCADA COM OUTRO E-MAIL ANTES');
    return;
  end if;

  delete from public.entries where colecao = 'teste_rls';

  insert into public.entries (id, user_id, colecao, conteudo, iv, versao_chave)
  values (gen_random_uuid(), ua, 'teste_rls', 'linha do usuario A', 'iv-a', 1),
         (gen_random_uuid(), ub, 'teste_rls', 'linha do usuario B', 'iv-b', 1);

  -- a partir daqui, viramos o usuario A
  perform set_config('request.jwt.claims',
    json_build_object('sub', ua::text, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';

  select count(*) into visiveis
    from public.entries where colecao = 'teste_rls';

  update public.entries set conteudo = 'invadido'
   where user_id = ub and colecao = 'teste_rls';
  get diagnostics atualizadas = row_count;

  delete from public.entries where colecao = 'teste_rls';
  get diagnostics apagadas = row_count;

  begin
    insert into public.entries (id, user_id, colecao, conteudo, iv, versao_chave)
    values (gen_random_uuid(), ub, 'teste_rls', 'plantado', 'iv-x', 1);
    insercao_alheia := 'ACEITOU';
  exception when others then
    insercao_alheia := 'bloqueado (' || sqlstate || ')';
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);

  insert into resultado_rls values
    (1, 've so as proprias linhas', '1', visiveis::text,
     case when visiveis = 1 then 'OK' else 'FALHOU' end),
    (2, 'nao edita linha alheia', '0', atualizadas::text,
     case when atualizadas = 0 then 'OK' else 'FALHOU' end),
    (3, 'nao apaga de verdade', '0', apagadas::text,
     case when apagadas = 0 then 'OK' else 'FALHOU' end),
    (4, 'nao insere em nome de outro', 'bloqueado', insercao_alheia,
     case when insercao_alheia like 'bloqueado%' then 'OK' else 'FALHOU' end);

  delete from public.entries where colecao = 'teste_rls';
end $$;

select * from resultado_rls order by n;
