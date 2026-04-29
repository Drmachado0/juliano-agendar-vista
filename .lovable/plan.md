
## Objetivo

Implementar **Variação Automática de Mensagens** nos Lembretes Anuais (`/admin/lembretes`) idêntica ao sistema da página de Avaliações: combinar aleatoriamente saudações, blocos de texto, CTAs e emojis para que **nenhuma mensagem seja igual à anterior**, evitando bloqueios por padrão repetido (anti-spam WhatsApp).

## Conflito com regra anterior — atenção

Hoje o Lembretes intencionalmente **só varia a saudação** (linha 65-132 de `Lembretes.tsx`) por causa da sua instrução anterior: *"sempre siga o template das configurações, nunca mude o link, apenas as frases"*.

Para atender o pedido atual sem violar aquela regra, vou:
- **Variar saudação + corpo + CTA + emojis** (frases) — como em Avaliações.
- **Manter intactos**: o link de agendamento (`https://drjulianomachado.com.br/agendar`) e a assinatura ("Dr. Juliano Machado / Oftalmologia").
- A variação fica **opt-in via toggle** "Variação de Texto Ativa" (já existe na UI). Quando **desligado**, o template salvo em /admin/whatsapp é usado puro (comportamento atual preservado).
- Quando **ligado**, o template salvo é **ignorado** e a mensagem é montada por composição aleatória (igual Avaliações).

Isso preserva: link fixo, regra anti-spam, e o template configurado continua sendo a fonte quando a variação está desativada.

## Mudanças

### 1) `src/pages/admin/Lembretes.tsx`

Substituir a função `aplicarVariacaoSeguraNoTemplate` por uma `gerarMensagemVariadaLembrete(nome, ultimaMensagem?)` nos moldes de `gerarMensagemVariada` em Avaliações:

- Adicionar arrays no topo do arquivo:
  - `SAUDACOES_LEMBRETE` (expandir o atual)
  - `BLOCOS_ABERTURA_LEMBRETE` — ex.: "Já faz cerca de 1 ano desde sua última consulta.", "Notamos que sua última visita foi há aproximadamente 1 ano.", "Faz quase um ano desde nosso último encontro.", etc.
  - `BLOCOS_IMPORTANCIA_LEMBRETE` — ex.: "Manter os exames em dia é essencial para a saúde dos seus olhos.", "Acompanhamento anual é fundamental para prevenir problemas oculares.", etc.
  - `CTAS_LEMBRETE` — ex.: "Gostaria de agendar seu retorno?", "Posso te ajudar a marcar uma nova consulta?", "Que tal agendarmos seu retorno?", etc.
  - `EMOJIS_OPCIONAIS_LEMBRETE` — `["👀", "💙", "✨", "🙏", "👨‍⚕️", ""]`
  - Constante `LINK_AGENDAMENTO = "https://drjulianomachado.com.br/agendar"` (FIXO, nunca varia).

- Função monta a mensagem no formato:
  ```
  {saudacao}, {nome}! [emoji?]

  {bloco_abertura} {bloco_importancia}

  {cta}
  📱 Agende pelo WhatsApp ou pelo nosso site:
  👉 {LINK_AGENDAMENTO}

  Atenciosamente,
  Dr. Juliano Machado
  Oftalmologia
  ```
- Loop `do/while` (até 10 tentativas) garantindo `mensagem !== ultimaMensagem`.

### 2) Integração no fluxo de envio (mesmo arquivo)

- No envio em lote (linha ~541), quando `variacaoTextoAtiva` for `true`, usar `gerarMensagemVariadaLembrete(nome, ultimaMensagemEnviada)` em vez de aplicar variação sobre o template salvo. Manter referência da última mensagem para passar ao próximo envio (evita duas iguais consecutivas).
- Quando `variacaoTextoAtiva` for `false`, manter o comportamento atual: usar o template configurado em /admin/whatsapp puro, apenas substituindo `{{nome}}`.

### 3) Preview na UI

- Atualizar `mensagemPreviewVariada` para chamar a nova função.
- Botão "Gerar nova variação" (já existe) chama `gerarMensagemVariadaLembrete("Maria", mensagemPreviewVariada)`.
- No card de variação (linha ~1525), adicionar texto explicativo idêntico ao de Avaliações: *"Gera mensagens únicas combinando diferentes saudações, textos e emojis. Nenhuma mensagem será igual à anterior."*
- Adicionar Badge "Ativa/Inativa" ao lado do switch (espelhar Avaliações).

### 4) Campanha mensal (`CampanhaMensalLembretes.tsx`)

Verificar se a campanha mensal usa a mesma flag `variacaoTextoAtiva` — se sim, exportar `gerarMensagemVariadaLembrete` (ou movê-la para um helper compartilhado `src/lib/variacaoMensagensLembrete.ts`) e aplicar o mesmo padrão na geração de mensagens das 4 remessas.

## Garantias

- **Link nunca muda** — `LINK_AGENDAMENTO` é constante.
- **Assinatura nunca muda** — texto fixo no final.
- **Toggle off = template das configurações é respeitado integralmente** (regra antiga preservada).
- **Toggle on = variação completa estilo Avaliações** (pedido novo).
- Loop anti-duplicata garante mensagens consecutivas diferentes.

## Arquivos afetados

- `src/pages/admin/Lembretes.tsx` (principal)
- `src/components/admin/CampanhaMensalLembretes.tsx` (se compartilhar a flag)
- (opcional) novo `src/lib/variacaoMensagensLembrete.ts` para reuso
