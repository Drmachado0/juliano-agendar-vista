

# Revisao do Sistema de Bloqueios - Bug Critico Encontrado

## Problema Principal

O sistema de bloqueios tem um **bug critico de seguranca/funcionalidade**: a tabela `bloqueios_agenda` tem RLS que permite apenas admins (`has_role(auth.uid(), 'admin')`) fazerem SELECT. Porem, o servico publico `src/services/disponibilidadePublica.ts` consulta essa tabela diretamente do navegador usando o cliente anonimo (sem autenticacao).

**Resultado**: bloqueios criados pelo admin sao **completamente ignorados** no formulario publico de agendamento. Pacientes conseguem agendar em horarios bloqueados.

O mesmo problema afeta a tabela `agendamentos` — a query que busca agendamentos existentes para evitar conflitos tambem retorna vazio por RLS, porem os agendamentos tem `status_crm` filtrado e poderiam nao funcionar corretamente.

### Tabelas afetadas e suas RLS (leitura publica):
| Tabela | Leitura Publica? | Impacto |
|--------|-----------------|---------|
| `bloqueios_agenda` | NAO (so admin) | Bloqueios ignorados no booking |
| `agendamentos` | NAO (so admin) | Conflitos de horario nao detectados |
| `disponibilidade_semanal` | SIM (`ativo = true`) | OK |
| `disponibilidade_especifica` | SIM (`true`) | OK |
| `clinicas` | SIM (`ativo = true`) | OK |

## Solucao

Adicionar politicas RLS de leitura publica (somente SELECT) nas duas tabelas problemáticas, expondo apenas os campos minimos necessarios. Alternativamente, criar uma view ou function security definer.

**Abordagem recomendada**: Adicionar RLS SELECT publico com campos restritos via view nao e possivel com RLS simples — entao a melhor opcao e adicionar politica SELECT publica nas duas tabelas, ja que os dados nao sao sensiveis (datas, horarios, tipo de bloqueio).

### Alteracoes

1. **Migração SQL**: Adicionar 2 politicas RLS permissivas:
   - `bloqueios_agenda`: SELECT publico para usuarios anonimos (dados nao sensiveis)
   - `agendamentos`: SELECT publico limitado aos campos `data_agendamento`, `hora_agendamento`, `local_atendimento`, `clinica_id` — porem RLS nao permite restringir colunas, entao a politica seria um SELECT geral. Como alternativa mais segura, criar uma **function SECURITY DEFINER** que retorna apenas horarios ocupados.

2. **Criar function `public.horarios_ocupados`** (SECURITY DEFINER):
   - Recebe `p_data_inicio date`, `p_data_fim date`, `p_clinica_ids uuid[]`
   - Retorna apenas `data_agendamento, hora_agendamento, clinica_id`
   - Evita expor dados pessoais dos pacientes

3. **Atualizar `src/services/disponibilidadePublica.ts`**:
   - Substituir query direta a `agendamentos` por chamada a `supabase.rpc('horarios_ocupados', ...)`
   - Manter query direta a `bloqueios_agenda` (apos adicionar RLS publica)

### Detalhes da migracao

```sql
-- 1. Bloqueios: leitura publica (dados nao sensiveis)
CREATE POLICY "Public can view bloqueios"
ON public.bloqueios_agenda FOR SELECT
TO anon, authenticated
USING (true);

-- 2. Function para horarios ocupados (sem expor dados pessoais)
CREATE OR REPLACE FUNCTION public.horarios_ocupados(
  p_data_inicio date, p_data_fim date, p_clinica_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(data_agendamento date, hora_agendamento time, clinica_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.data_agendamento, a.hora_agendamento, a.clinica_id
  FROM public.agendamentos a
  WHERE a.data_agendamento >= p_data_inicio
    AND a.data_agendamento <= p_data_fim
    AND (p_clinica_ids IS NULL OR a.clinica_id = ANY(p_clinica_ids))
$$;
```

4. **Atualizar `src/services/disponibilidadePublica.ts`**: usar `supabase.rpc('horarios_ocupados', ...)` em vez de query direta na tabela `agendamentos`.

