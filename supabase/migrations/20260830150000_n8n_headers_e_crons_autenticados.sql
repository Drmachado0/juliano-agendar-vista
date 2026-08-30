-- Conserta a autenticacao de dois crons que nunca funcionaram.
--
-- O MESMO DIAGNOSTICO DA SINCRONIZACAO DE AVALIACOES, achado em 30/08/2026. O
-- cron enfileira a requisicao com sucesso, cron.job_run_details marca
-- "succeeded", e a resposta HTTP, que mora em net._http_response, e 401. Nada
-- nas telas do projeto mostra isso.
--
-- Job migrar-atendidos-diario. O cron mandava Authorization Bearer com a chave
-- anon do projeto, a mesma chave publica que vai no navegador. A funcao
-- migrar-atendidos nao aceita isso: ela exige o header x-n8n-secret, comparado
-- com getN8nSharedSecret. Header que o cron nunca mandou.
--
-- Job enviar-relatorio-diario-8h. Ele ja tentava o caminho certo, lendo
-- CRON_SECRET de vault.decrypted_secrets. So que o segredo nao mora la: mora em
-- public.integracao_secrets, criptografado com a ENCRYPTION_KEY do vault. A
-- leitura devolvia NULL e o header saia vazio.

-- Espelho de _cron_headers para o outro segredo. Os dois lados de uma chamada
-- server-to-server ficam assim: aqui o banco monta o header, e do outro lado a
-- edge function le o MESMO valor por RPC e compara em tempo constante.
--
-- DUAS FUNCOES PEQUENAS, e nao uma parametrizada. Elas diferem em mais que os
-- dois literais: _cron_headers tambem emite Authorization Bearer, que esta aqui
-- omite de proposito. Parametrizar exigiria tres argumentos, e como o pg_cron
-- guarda o comando como texto, o nome do segredo acabaria escondido dentro de
-- uma string numa linha de tabela, em vez de numa funcao que da para grepar.
CREATE OR REPLACE FUNCTION public._n8n_headers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_key text;
  v_enc bytea;
  v_val text;
BEGIN
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'ENCRYPTION_KEY' LIMIT 1;
  SELECT valor_encrypted INTO v_enc
    FROM public.integracao_secrets WHERE nome = 'N8N_SHARED_SECRET';

  -- Sem segredo, devolve so o Content-Type. A funcao do outro lado responde 401,
  -- que e melhor que um header meio montado passando por acidente.
  IF v_key IS NULL OR v_enc IS NULL THEN
    RETURN jsonb_build_object('Content-Type', 'application/json');
  END IF;

  v_val := pgp_sym_decrypt(v_enc, v_key);

  RETURN jsonb_build_object(
    'Content-Type', 'application/json',
    'x-n8n-secret', v_val
  );
END $$;

-- OBRIGATORIO, e nao higiene opcional. A funcao e SECURITY DEFINER e devolve o
-- segredo descriptografado. Sem este REVOKE ela nasce com EXECUTE para PUBLIC,
-- que e o padrao do Postgres, e qualquer usuario logado leria o N8N_SHARED_SECRET
-- com um SELECT. _cron_headers tem o mesmo REVOKE desde julho.
REVOKE ALL ON FUNCTION public._n8n_headers() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public._n8n_headers() IS
  'Headers para chamar edge function protegida por N8N_SHARED_SECRET a partir de pg_cron. Espelho de _cron_headers para o segredo do n8n. Do outro lado, requireN8nSecret.';

-- Reagenda os dois crons POR NOME, que e o padrao das outras migracoes deste
-- repositorio. Nao use cron.alter_job por id: o id e por banco, entao num
-- projeto novo o id nao existe e a migracao quebra, e num job recriado ela
-- reconfiguraria outro job qualquer. Agendar por nome tambem traz a expressao
-- de horario para o controle de versao, em vez de ela existir so em producao.
DO $mig$
DECLARE
  v_base text := 'https://cnpifhaszbonwlqruwnn.supabase.co/functions/v1/';
  v_jobs jsonb := jsonb_build_array(
    jsonb_build_object('name', 'migrar-atendidos-diario',   'fn', 'migrar-atendidos',       'sched', '0 3 * * *',  'headers', 'public._n8n_headers()'),
    jsonb_build_object('name', 'enviar-relatorio-diario-8h','fn', 'enviar-relatorio-diario','sched', '0 11 * * *', 'headers', 'public._cron_headers()')
  );
  r record;
BEGIN
  FOR r IN SELECT * FROM jsonb_to_recordset(v_jobs) AS x(name text, fn text, sched text, headers text) LOOP
    BEGIN
      PERFORM cron.unschedule(r.name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
      PERFORM cron.schedule(
        r.name,
        r.sched,
        format($cron$
          SELECT net.http_post(
            url := %L,
            headers := %s,
            body := '{}'::jsonb,
            timeout_milliseconds := 30000
          );
        $cron$, v_base || r.fn, r.headers)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falha ao reagendar %: %', r.name, SQLERRM;
    END;
  END LOOP;
END $mig$;

-- O timeout de 30000 nao e enfeite. O padrao do pg_net e 5000, e ja derrubou
-- chamada neste projeto: em 30/08/2026 tres requisicoes das 09:00 morreram
-- exatamente em 5001 ms.
--
-- FICA REGISTRADO, e nao foi mexido aqui: trigger_google_calendar_pull, da
-- migracao 20260426204650, tem o mesmo defeito do job do relatorio. Ela le
-- CRON_SECRET de vault.decrypted_secrets, recebe NULL, e o
-- google-calendar-pull-15min vem pulando em silencio a cada 15 minutos. Nao foi
-- religado de proposito: google-calendar-pull faz UPDATE em agendamentos, e
-- ligar de volta um sincronismo parado ha meses e decisao do medico, nao
-- efeito colateral de uma migracao de autenticacao.
