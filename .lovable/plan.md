

# Integrar Secretaria Virtual (n8n) com o Sistema do Site

## Situacao Atual

O workflow **Secretaria Virtual v3** no n8n esta funcionando, mas usando um **banco de dados separado** (`ebyruchdswmkuynthiqi`). Isso significa que as mensagens da Sofia (IA) nao aparecem no painel admin do site, e os dados de pacientes nao sao compartilhados.

```text
HOJE (separado):

Paciente WhatsApp
     |
     +---> Evolution API "ZapZap"
              |
              +---> n8n (Sofia IA) ---> Supabase EXTERNO (ebyruchdswmkuynthiqi)
              |
              +---> Edge Function receber-whatsapp ---> Supabase LOVABLE (cnpifhaszbonwlqruwnn)

Resultado: mensagens da Sofia nao aparecem no painel admin
```

## Objetivo

Fazer o n8n gravar mensagens no **mesmo banco de dados** do site, para que tudo apareca no painel admin.

```text
DEPOIS (integrado):

Paciente WhatsApp
     |
     +---> Evolution API "ZapZap"
              |
              +---> n8n (Sofia IA) ---> Supabase LOVABLE (cnpifhaszbonwlqruwnn)
              |                              |
              +---> Edge Function ---------> +
                                             |
                                        Painel Admin (tudo junto)
```

## Etapas

### 1. Criar funcao `registrar_mensagem` no banco de dados

O n8n chama uma RPC chamada `registrar_mensagem` para salvar mensagens. Essa funcao precisa ser criada no banco do Lovable para aceitar os mesmos parametros:

- `p_phone_number` - numero do telefone
- `p_remote_jid` - identificador do WhatsApp
- `p_nome` - nome do remetente
- `p_conteudo` - texto da mensagem
- `p_direcao` - "entrada" ou "saida"
- `p_tipo_mensagem` - "texto" ou "audio"
- `p_message_id` - ID externo da mensagem
- `p_metadata` - dados extras (JSON)

A funcao vai buscar o agendamento pelo telefone e inserir na tabela `mensagens_whatsapp` existente, traduzindo "entrada"/"saida" para "IN"/"OUT".

### 2. Criar view `pacientes` para consulta de pacientes

O n8n busca dados de pacientes em uma tabela `pacientes`. Como o sistema do site usa a tabela `agendamentos`, sera criada uma **view** que expoe os dados no formato esperado pelo n8n, sem duplicar dados:

- `phone_number` - telefone
- `nome` - nome do paciente
- `convenio` - convenio
- `tags` - tipo de atendimento
- `total_mensagens` - contagem de mensagens
- `total_atendimentos` - contagem de agendamentos

### 3. Atualizar URLs e chaves no n8n (manual)

Voce precisara atualizar 3 nodes no workflow do n8n:

| Node | O que mudar |
|---|---|
| **Registrar Entrada** | URL e apikey para o Supabase do Lovable |
| **Buscar Paciente** | URL e apikey para o Supabase do Lovable |
| **Registrar Resposta** | URL e apikey para o Supabase do Lovable |

Os novos valores serao fornecidos apos a criacao das funcoes no banco.

## Detalhes tecnicos

### Migracao SQL - Funcao `registrar_mensagem`

```sql
CREATE OR REPLACE FUNCTION public.registrar_mensagem(
  p_phone_number TEXT,
  p_remote_jid TEXT DEFAULT NULL,
  p_nome TEXT DEFAULT 'Paciente',
  p_conteudo TEXT DEFAULT '',
  p_direcao TEXT DEFAULT 'entrada',
  p_tipo_mensagem TEXT DEFAULT 'texto',
  p_message_id TEXT DEFAULT '',
  p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  v_agendamento_id UUID;
  v_telefone_formatado TEXT;
  v_direcao_db TEXT;
  v_mensagem_id UUID;
  v_last8 TEXT;
BEGIN
  -- Normalizar direcao
  v_direcao_db := CASE 
    WHEN p_direcao = 'entrada' THEN 'IN'
    WHEN p_direcao = 'saida' THEN 'OUT'
    ELSE p_direcao
  END;

  -- Extrair ultimos 8 digitos para matching
  v_last8 := RIGHT(regexp_replace(p_phone_number, '\D', '', 'g'), 8);

  -- Buscar agendamento pelo telefone
  SELECT id, telefone_whatsapp INTO v_agendamento_id, v_telefone_formatado
  FROM agendamentos
  WHERE RIGHT(regexp_replace(telefone_whatsapp, '\D', '', 'g'), 8) = v_last8
  ORDER BY created_at DESC
  LIMIT 1;

  -- Inserir mensagem
  INSERT INTO mensagens_whatsapp (
    agendamento_id, telefone, direcao, conteudo,
    status_envio, mensagem_externa_id, lida
  ) VALUES (
    v_agendamento_id,
    COALESCE(v_telefone_formatado, p_phone_number),
    v_direcao_db,
    p_conteudo,
    CASE WHEN v_direcao_db = 'OUT' THEN 'enviado' ELSE NULL END,
    NULLIF(p_message_id, ''),
    CASE WHEN v_direcao_db = 'IN' THEN false ELSE true END
  ) RETURNING id INTO v_mensagem_id;

  RETURN jsonb_build_object(
    'success', true,
    'mensagem_id', v_mensagem_id,
    'agendamento_id', v_agendamento_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Migracao SQL - View `pacientes`

```sql
CREATE OR REPLACE VIEW public.pacientes AS
SELECT
  a.id,
  regexp_replace(a.telefone_whatsapp, '\D', '', 'g') AS phone_number,
  a.nome_completo AS nome,
  a.convenio,
  a.tipo_atendimento AS tags,
  COALESCE(msg_count.total, 0) AS total_mensagens,
  COALESCE(ag_count.total, 0) AS total_atendimentos
FROM agendamentos a
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INT AS total
  FROM mensagens_whatsapp m
  WHERE m.agendamento_id = a.id
) msg_count ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INT AS total
  FROM agendamentos a2
  WHERE RIGHT(regexp_replace(a2.telefone_whatsapp, '\D', '', 'g'), 8) 
      = RIGHT(regexp_replace(a.telefone_whatsapp, '\D', '', 'g'), 8)
) ag_count ON true;
```

### RLS

A funcao usa `SECURITY DEFINER` e a view sera acessada via `apikey` (anon), entao sera necessario adicionar um `GRANT SELECT` na view para o role `anon`.

### Nenhuma alteracao de codigo no site

O painel admin ja le mensagens da tabela `mensagens_whatsapp` com realtime. Quando o n8n comecar a gravar nessa mesma tabela, as mensagens da Sofia vao aparecer automaticamente no chat do admin.

