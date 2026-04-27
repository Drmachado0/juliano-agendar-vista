## Objetivo

Adicionar um botão "Desconectar" na página `/admin/configuracoes/evolution` que faz logout da instância WhatsApp na Evolution API, permitindo desligar a conexão temporariamente sem precisar excluir a instância. Para reconectar depois, basta usar os botões "Forçar Conexão" / "Reconexão Completa" já existentes (que vão gerar novo QR Code se necessário).

## Mudanças

### 1. Edge Function `gerenciar-conexao-evolution`
- Adicionar nova função `logoutInstance()` que chama `DELETE {baseUrl}/instance/logout/{instanceName}` da Evolution API.
- Adicionar novo case `"logout"` no switch de ações, que executa o logout, aguarda 2s e retorna o estado atualizado (esperado: `close`).

### 2. Hook `useEvolutionStatus.ts`
- Adicionar `"logout"` ao tipo de ação aceito por `executeAction`.
- Expor método de conveniência `desconectar = () => executeAction("logout")`.

### 3. Página `src/pages/admin/ConfiguracoesEvolution.tsx`
- Adicionar botão "Desconectar WhatsApp" (variant destructive, ícone `PowerOff`) ao lado dos botões existentes (Reiniciar / Forçar Conexão / Reconexão Completa).
- O botão só aparece habilitado quando `status.connected === true` (não faz sentido desconectar algo já desconectado).
- Envolver em `AlertDialog` de confirmação, já que é uma ação destrutiva: "Tem certeza? A instância ficará offline e o bot Hermes parará de receber/enviar mensagens até reconectar."
- Ao confirmar, chamar `desconectar()`, mostrar toast de sucesso/erro e atualizar status.

## Comportamento esperado

1. Usuário clica em "Desconectar WhatsApp" → modal de confirmação aparece.
2. Confirma → edge function chama logout na Evolution → instância vai para estado `close`.
3. Badge do header e card de status mostram "Desconectado".
4. Para reconectar, basta clicar em "Forçar Conexão" (gera novo QR) ou "Reconexão Completa".
5. A instância **não é excluída** — apenas desconectada da sessão WhatsApp atual.
