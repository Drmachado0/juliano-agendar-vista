# Verificar WhatsApp + Corrigir telefones em Lembretes Anuais

Replicar na aba **Pendentes** de `/admin/lembretes` o mesmo fluxo de proteção anti-bloqueio que já existe em `/admin/avaliacoes`: validar formato dos telefones, verificar quais realmente existem no WhatsApp via Evolution API e permitir corrigir números inválidos antes do disparo em lote.

## O que muda na UI (aba Pendentes)

Acima da lista de pacientes pendentes, ao lado de "Selecionar todos", adicionar uma barra de ações idêntica à de Avaliações:

```text
[ ] Selecionar todos (N)        [⚡ Verificar WhatsApp]  [✎ Corrigir X telefone(s)]  N selecionado(s)
```

Em cada item da lista de lembrete pendente:
- Badge de status do telefone ao lado do número:
  - verde `✓` = formato válido + verificado no WhatsApp
  - vermelho `✗ Inválido` = não existe no WhatsApp (após verificação)
  - amarelo `⚠ Corrigir` = formato BR inválido mas corrigível (ex.: faltando 9, DDD errado)
  - cinza `?` = ainda não verificado
- Quando o telefone for corrigível, mostrar botão inline **Corrigir** que abre um pequeno input para edição rápida (mesmo componente de Avaliações).

Botão **Iniciar Envio** existente passa a respeitar a verificação:
- Se houver selecionados com `whatsappVerificado === 'invalido'`, exibir confirmação: "X número(s) selecionado(s) não existem no WhatsApp e serão pulados. Continuar?"
- Itens marcados como inválidos são automaticamente excluídos do loop de envio (sem consumir cota da sessão).

## Fluxo técnico

1. **Validação local de formato** — usar a mesma função `validarTelefoneBrasileiro` já existente em `Avaliacoes.tsx`. Será extraída para `src/lib/validarTelefoneBR.ts` e importada nos dois lugares.
2. **Verificação remota** — botão "Verificar WhatsApp" chama a edge function existente `verificar-numeros-whatsapp` em lotes de 50 (mesmo padrão de Avaliações), envia apenas os telefones dos pacientes selecionados (ou todos da lista filtrada se nada estiver selecionado).
3. **Cache** — a edge function já usa `verificacoes_whatsapp` com TTL de 30 dias, então não há custo adicional para reverificar pacientes recentes.
4. **Erro de conexão** — se a edge retornar `isConnectionError`, mostrar toast "Reconecte o WhatsApp nas configurações" (mesmo texto de Avaliações) e abortar.
5. **Corrigir telefone** — abre o input inline; ao salvar, atualiza `lembretes_anuais.telefone` no banco via `supabase.from('lembretes_anuais').update(...)` e marca o item como "não verificado" novamente.
6. **Persistência da verificação** — armazenar resultado apenas em estado local da página (`Map<lembreteId, 'valido'|'invalido'|'pendente'>`), igual a Avaliações. Não precisa de coluna nova.

## Arquivos afetados

- `src/lib/validarTelefoneBR.ts` (novo) — extrai `validarTelefoneBrasileiro` de `Avaliacoes.tsx`.
- `src/pages/admin/Avaliacoes.tsx` — passa a importar de `@/lib/validarTelefoneBR` (sem mudança de comportamento).
- `src/pages/admin/Lembretes.tsx`:
  - Estado novo: `verificacoesTelefone: Map<string, 'valido'|'invalido'|'pendente'>`, `verificandoWhatsApp: boolean`, `verificacaoConcluida: boolean`.
  - Funções novas: `verificarNumerosWhatsApp()`, `corrigirTelefoneLembrete(id, novo)`, `contarTelefonesCorrigiveis()`, `contarNumerosVerificados()`.
  - UI nova na barra de ações da aba Pendentes e nos itens da lista.
  - Loop `enviarEmLote` filtra `whatsappVerificado !== 'invalido'`.
- `src/services/lembretesAnuais.ts` — adicionar `atualizarTelefoneLembrete(id, telefone)` (update simples).

## Não muda

- Edge function `verificar-numeros-whatsapp` — já existe e já é usada por Avaliações; sem alterações.
- Tabela `lembretes_anuais` — sem migração, apenas updates de coluna existente `telefone`.
- Lógica de variação de mensagem, limites de sessão/dia, pausas anti-bloqueio.
- Importar pacientes / Dashboard / Histórico — nenhuma mudança.

## Observação

Não vou tocar em `Hermes` nem recriar nada relacionado (memória do projeto confirma remoção). Também não mexo em `bot_config` ou pause do bot.
