-- Impede que a mesma avaliacao entre duas vezes com chaves diferentes.
--
-- O PROBLEMA. A mesma avaliacao chega por dois caminhos que nunca concordam na
-- chave. O cron da Places API grava google_review_id no formato
-- Autor_timestamp. O backfill do Google Maps gravou maps_ mais o id opaco do
-- Google. Das 111 do backfill, zero batiam com as 17 que ja estavam la, e os 17
-- autores eram os mesmos. Nem o time_epoch coincide entre as duas fontes.
--
-- O upsert do cron usa ON CONFLICT (google_review_id). Como a chave dele nunca
-- bate com a do backfill, toda sincronizacao inseria uma gemea nova em vez de
-- atualizar a linha que ja existe.
--
-- POR QUE NO BANCO, e nao na edge function. A regra passa a valer para qualquer
-- escritor, hoje e depois, sem depender de qual versao da funcao esta no ar.
-- Isso importa porque a versao nova da sincronizacao NAO subiu: dois Publish e
-- um deploy pela API da Lovable deixaram o site em dia, mas a edge function em
-- producao continua sendo a antiga, e o CLI e o MCP do Supabase respondem 403
-- porque o projeto pertence a Lovable.
--
-- Idempotente: pode rodar mais de uma vez.

-- A identidade de uma avaliacao e o autor mais o comeco do texto.
--
-- SESSENTA CARACTERES porque a raspagem do Maps corta o texto longo e cola
-- reticencia no fim, enquanto a Places API devolve inteiro. Sessenta ficam
-- antes de qualquer corte observado e ja distinguem avaliacoes diferentes do
-- mesmo autor.
--
-- O AUTOR ENTRA NA CHAVE de proposito. Duas pessoas diferentes escrevendo
-- "Gostei muito" sao duas avaliacoes, e sem o autor virariam uma.
--
-- SEM TEXTO A IDENTIDADE E NULL, e o NULL se propaga pela concatenacao sozinho.
-- Nao ha guarda separada porque uma guarda com btrim divergiria da normalizacao
-- de baixo: btrim tira espaco e nao tira quebra de linha, entao um texto de um
-- \n so passaria pela guarda e viraria identidade de corpo vazio.
--
-- ESPELHO EM JAVASCRIPT: identidade() em src/lib/testimonialsPool.ts, que hoje
-- e rede de seguranca e nao a regra. As duas normalizam na mesma ordem: tira
-- espaco das pontas, colapsa espaco interno, minuscula, corta em 60.
CREATE OR REPLACE FUNCTION public.avaliacao_identidade(p_autor text, p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(regexp_replace(COALESCE(p_autor, ''), '^\s+|\s+$', '', 'g'))
         || '::' || s.corpo
    FROM (
      SELECT NULLIF(
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
  'Identidade de uma avaliacao, independente da fonte. NULL quando nao ha texto.';

-- Antes de inserir, procura uma linha com a mesma identidade. Se achar,
-- atualiza aquela e descarta o insert, devolvendo NULL.
--
-- MECANISMO INTERINO, e vale saber por que. O certo em regime seria um indice
-- unico sobre avaliacao_identidade(author_name, text) e o escritor usando
-- ON CONFLICT nesse indice. Nao da hoje: a sincronizacao manda UM upsert em
-- lote, tudo ou nada, e sem uma clausula ON CONFLICT apontando para o indice a
-- primeira gemea viraria violacao de unicidade e derrubaria o lote inteiro, ou
-- seja, a sincronizacao do dia toda. Como a edge function nao pode ser
-- redeployada, o indice sozinho seria PIOR que o trigger. Quando ela voltar a
-- ser deployavel: cria o indice, move o escritor para ON CONFLICT nele, apaga
-- este trigger.
--
-- O QUE ELE NAO PEGA. Ele so dispara em INSERT. Se o paciente editar a propria
-- avaliacao no Google, o texto muda, a identidade muda junto, e a linha nova
-- entra sem reconhecer a antiga. E raro e nao tem conserto por aqui.
--
-- CUSTO. Varredura sequencial calculando a identidade de cada linha, por linha
-- inserida. Sao 111 linhas vezes o lote de ate 10, algo como 1.100 chamadas de
-- dois regexp_replace curtos, uma vez por dia. Dezenas de milissegundos diarios.
-- Um indice de expressao seria legal, a funcao e IMMUTABLE e o SET search_path
-- ate impede o inlining que atrapalharia o casamento, mas nao ha o que ganhar
-- em velocidade nessa escala.
--
-- O time_epoch DA LINHA QUE FICA E PRESERVADO. O do backfill foi derivado de
-- texto tipo "3 meses atras", entao e grosso, mas trocar por outro valor a cada
-- sincronizacao reembaralharia a ordem do mural todo dia sem ganho nenhum.
--
-- ativo NAO ENTRA no UPDATE. Quem desliga uma avaliacao e o botao do admin, em
-- toggleAvaliacaoAtiva, e reativar aqui desfaria isso a cada sincronizacao.
--
-- updated_at TAMBEM NAO, porque ja existe update_avaliacoes_google_updated_at,
-- um BEFORE UPDATE criado junto com a tabela que carimba o campo sozinho.
CREATE OR REPLACE FUNCTION public.avaliacoes_google_sem_gemea()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_identidade text;
  v_existente uuid;
BEGIN
  v_identidade := public.avaliacao_identidade(NEW.author_name, NEW.text);

  IF v_identidade IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.id
    INTO v_existente
    FROM public.avaliacoes_google a
   WHERE public.avaliacao_identidade(a.author_name, a.text) = v_identidade
   ORDER BY a.created_at, a.id
   LIMIT 1;

  IF v_existente IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.avaliacoes_google
     SET author_photo_url = COALESCE(NEW.author_photo_url, author_photo_url),
         rating = NEW.rating,
         relative_time_description =
           COALESCE(NEW.relative_time_description, relative_time_description),
         time_epoch = COALESCE(time_epoch, NEW.time_epoch)
   WHERE id = v_existente;

  -- A sincronizacao reporta "10 synced" contando o que MANDOU, nao o que
  -- entrou, e nao tem como saber daqui que a gemea foi absorvida. Esta linha e
  -- o unico rastro contavel disso no log do Postgres.
  RAISE LOG 'avaliacoes_google: gemea absorvida, identidade=%', v_identidade;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS avaliacoes_google_sem_gemea_trg ON public.avaliacoes_google;

CREATE TRIGGER avaliacoes_google_sem_gemea_trg
BEFORE INSERT ON public.avaliacoes_google
FOR EACH ROW
EXECUTE FUNCTION public.avaliacoes_google_sem_gemea();

-- Limpeza do que ja tiver entrado duplicado antes deste trigger existir. O
-- trigger so barra insercao futura, e nao desfaz o passado.
--
-- Mantem a linha mais antiga de cada identidade, que e a do backfill. Isso e
-- pre-requisito do trigger, e nao so faxina: o SELECT la em cima pega uma linha
-- por identidade, e so ha uma resposta certa porque este DELETE ja colapsou
-- cada identidade a uma linha.
--
-- Identidade NULL nunca casa consigo mesma, entao avaliacao sem texto passa
-- inteira por aqui sem guarda extra.
DELETE FROM public.avaliacoes_google a
 USING public.avaliacoes_google b
 WHERE public.avaliacao_identidade(a.author_name, a.text)
     = public.avaliacao_identidade(b.author_name, b.text)
   AND (b.created_at, b.id) < (a.created_at, a.id);
