## Objetivo

Resolver 3 problemas no editor de **Templates de Mensagens WhatsApp** (`/admin/whatsapp` → aba Templates):

1. **Preview ilegível**: a bolha verde do preview está com texto branco sobre fundo verde claro — o usuário não consegue ler.
2. **Falta o template "Lembrete Anual"**: o template usado em `/admin/lembretes` (mensagem de retorno após 1 ano) não aparece no editor.
3. **Não há como testar**: usuário precisa enviar a mensagem renderizada para um número real para validar.

---

## Mudanças

### 1. Corrigir o Preview da Mensagem

Arquivo: `src/components/admin/TemplatesWhatsAppTab.tsx`

Atualmente o `<pre>` usa `text-foreground`, que no tema escuro vira branco — invisível sobre o fundo verde claro `#e7ffd8`. Vamos forçar cores fixas estilo WhatsApp para o balão (independente do tema):

- Fundo: `#e7ffd8` (claro) / `#005c4b` (escuro)
- Texto: `#111` (claro) / `#e9edef` (escuro)
- Hora: cinza neutro fixo
- Renderizar **markdown leve do WhatsApp**: `*negrito*` vira `<strong>`, quebras de linha preservadas, e `https://...` vira link clicável. Isso deixa o preview muito mais próximo do que o paciente realmente verá.
- Adicionar mini header da bolha (nome do contato simulado: "Paciente") para dar contexto.

### 2. Adicionar template "Lembrete Anual"

Hoje a página `/admin/lembretes` usa um template fixo no código (`TEMPLATE_LEMBRETE_PADRAO`). Vamos:

**a) Migration** — inserir o registro na tabela `templates_whatsapp`:

- `tipo`: `lembrete_anual`
- `nome`: "Lembrete Anual de Retorno"
- `descricao`: "Mensagem enviada a pacientes 1 ano após a última consulta"
- `variaveis_disponiveis`: `['{{nome}}']`
- `conteudo`: o texto atual usado em `Lembretes.tsx` (com `{{nome}}`)
- `ativo`: true

**b) Atualizar `src/services/templatesWhatsApp.ts`**:
- Incluir `lembrete_anual` em `templatesPadrao` (fallback)
- Incluir `lembrete_anual: '🔔'` em `tipoIcones`

**c) Atualizar `src/pages/admin/Lembretes.tsx`**:
- Carregar o template do banco via `buscarTemplatePorTipo('lembrete_anual')` no mount
- Usar o template do banco como valor inicial de `template`, mantendo o `TEMPLATE_LEMBRETE_PADRAO` apenas como fallback se a busca falhar
- Assim, qualquer edição feita no editor de templates passa a refletir automaticamente nos lembretes anuais

**d) Atualizar `supabase/functions/_shared/templateRenderer.ts`**:
- Adicionar `lembrete_anual` em `templatesPadrao` para que edge functions futuras também possam usar.

### 3. Card de Envio de Teste

Novo bloco abaixo do "Preview da Mensagem" em `TemplatesWhatsAppTab.tsx`:

**Componentes UI:**
- Título: "Enviar Teste"
- `Select` para escolher qual template enviar (lista todos os templates ativos, default = template atualmente selecionado)
- `Input` para o número de telefone (com placeholder "Ex: 5591999999999" e validação básica de 10–13 dígitos)
- `Button` "Enviar Teste" com ícone `Send`
- Toast de sucesso/erro
- Aviso pequeno: "A mensagem será enviada com dados de exemplo (mesmo do preview)."

**Lógica:**
- Renderiza o `editedContent` (não o salvo) com `dadosExemplo`, para o usuário poder testar mudanças antes de salvar
- Sanitiza o telefone: remove tudo que não é dígito, garante que comece com `55` (DDI Brasil) se tiver 10–11 dígitos
- Chama `enviarMensagemWhatsApp(telefone, mensagemRenderizada, { campaign: 'teste_template', priority: 'high' })` do `services/integracoes.ts` (que já passa pela edge function `enviar-whatsapp-queue`)
- Estado de loading no botão durante o envio
- Persiste o último número testado em `localStorage` (`templates_teste_telefone`) para conveniência

**Permissão:** o componente já vive dentro do admin protegido — basta usar a função existente.

---

## Detalhes Técnicos

### Renderização markdown WhatsApp (helper inline)

```tsx
function renderWhatsAppMarkdown(text: string) {
  // *bold*, _italic_, ~strike~, links http(s)://
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/~(.+?)~/g, '<s>$1</s>')
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" class="underline">$1</a>');
  return { __html: escaped };
}
```

Bolha do preview:
```tsx
<div className="rounded-lg p-3 max-w-md shadow-sm bg-[#e7ffd8] dark:bg-[#005c4b]">
  <div
    className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-[#111] dark:text-[#e9edef]"
    dangerouslySetInnerHTML={renderWhatsAppMarkdown(previewMensagem)}
  />
  <div className="text-right mt-1">
    <span className="text-[10px] text-[#667781] dark:text-[#8696a0]">09:00 ✓✓</span>
  </div>
</div>
```

### Sanitização de telefone para teste

```ts
function normalizarTelefoneTeste(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) return null;
  if (digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}
```

### Arquivos modificados

- `src/components/admin/TemplatesWhatsAppTab.tsx` (preview + card de teste)
- `src/services/templatesWhatsApp.ts` (fallback + ícone do `lembrete_anual`)
- `src/pages/admin/Lembretes.tsx` (carrega template do banco)
- `supabase/functions/_shared/templateRenderer.ts` (fallback `lembrete_anual`)
- Nova migration: insert do template `lembrete_anual` em `templates_whatsapp`

Sem mudanças em RLS — a tabela `templates_whatsapp` já é gerenciável via admin existente, e o envio usa a edge function já protegida.