-- Ajusta a identidade da avaliacao para o caso de nota sem comentario.
--
-- MIGRACAO NOVA, e nao edicao da 20260830090000. Aquela ja foi commitada e
-- aplicada, e o Supabase pula versao ja registrada em schema_migrations, entao
-- corrigir no arquivo antigo funcionaria na minha maquina e em nenhum ambiente
-- novo. A 090000 fica como registro do que foi feito naquele momento.
--
-- O QUE ACONTECEU. Em 30/08/2026, primeira vez que o cron diario rodou de
-- verdade, ele trouxe uma avaliacao so de estrelas, sem texto, de alguem que o
-- backfill ja tinha. A identidade daquela versao era NULL sem texto, a linha
-- caia na chave da fonte, e como cron e backfill usam chaves diferentes ela
-- entrou como segunda linha da mesma pessoa. Nao aparecia no mural, que so
-- mostra quem escreveu, mas sujava a tabela.
--
-- SEM TEXTO, A IDENTIDADE E SO O AUTOR. O Google permite uma avaliacao por
-- pessoa por local, entao o nome ja identifica a avaliacao sozinho.
--
-- O AUTOR AGORA COLAPSA ESPACO INTERNO, e isso e o que faz a correcao valer.
-- So o texto era normalizado assim antes. Numa avaliacao sem comentario o autor
-- e a chave inteira, e as duas fontes divergem exatamente nisso: a raspagem do
-- Maps devolve "Jessyca  Aquinno" com dois espacos onde a Places API devolve um.
-- Sem colapsar, a gemea passaria assim mesmo e a correcao seria inutil.
--
-- ESPELHO EM JAVASCRIPT: identidade() em src/lib/testimonialsPool.ts. Os dois
-- lados normalizam autor e texto na mesma ordem: tira espaco das pontas,
-- colapsa espaco interno, minuscula. O texto ainda corta em 60.
CREATE OR REPLACE FUNCTION public.avaliacao_identidade(p_autor text, p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
           WHEN s.autor = '' AND s.corpo IS NULL THEN NULL
           ELSE s.autor || '::' || COALESCE(s.corpo, '<sem-texto>')
         END
    FROM (
      SELECT lower(
               regexp_replace(
                 regexp_replace(COALESCE(p_autor, ''), '^\s+|\s+$', '', 'g'),
                 '\s+', ' ', 'g'
               )
             ) AS autor,
             NULLIF(
               left(
                 lower(
                   regexp_replace(
                     regexp_replace(COALESCE(p_texto, ''), '^\s+|\s+$', '', 'g'),
                     '\s+', ' ', 'g'
                   )
                 ),
                 60
               ),
               ''
             ) AS corpo
    ) s
$$;

COMMENT ON FUNCTION public.avaliacao_identidade(text, text) IS
  'Identidade de uma avaliacao, independente da fonte. Autor mais os 60 primeiros caracteres do texto normalizado, ou autor mais <sem-texto> quando so ha nota. NULL apenas quando nao ha autor nem texto.';

-- Limpa as gemeas sem texto que entraram antes desta migracao. O trigger
-- avaliacoes_google_sem_gemea_trg ja barra as futuras, porque le a funcao acima.
--
-- ESTE DELETE MUDOU DE ALCANCE, e vale dizer em voz alta. Antes ele so juntava
-- linhas com texto, porque identidade NULL nunca casa consigo mesma. Agora ele
-- tambem junta linhas so de nota que compartilham o nome do autor. A
-- consequencia rara: dois homonimos que so deram estrela viram uma linha so.
--
-- Aceito de proposito, porque o trigger tem exatamente o mesmo comportamento, e
-- limpeza que discorda do trigger e pior que a perda de um homonimo. Vale saber
-- que isso mexe na media do Dashboard do admin, que calcula rating sobre todas
-- as linhas ativas, inclusive as sem texto. O mural nao muda, porque ele so
-- exibe avaliacao com comentario.
--
-- Mantem a linha mais antiga de cada identidade, que e a do backfill.
DELETE FROM public.avaliacoes_google a
 USING public.avaliacoes_google b
 WHERE public.avaliacao_identidade(a.author_name, a.text)
     = public.avaliacao_identidade(b.author_name, b.text)
   AND (b.created_at, b.id) < (a.created_at, a.id);
