
O link do WhatsApp na `/agendamento` está usando `https://wa.me/5591936180476` mas a imagem mostra que o navegador tentou abrir `api.whatsapp.com/send/?phone=...` e foi bloqueado. Preciso checar como o link funciona na página principal (Header e WhatsAppButton) para replicar o mesmo padrão.

Da memória: número universal é `https://wa.me/5591936180476`. O `WhatsAppButton.tsx` detecta mobile vs desktop e usa URLs diferentes. Vou conferir.
<lov-tool-use id="toolu_vrtx_01DGDohEFtNBd1ptkS1DZ38e" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/WhatsAppButton.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_013QWVWxTn5ofokYxKbz237Z" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/WhatsAppButton.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01UUZapGJQoCMAok67KW9JUB" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/Header.tsx\", \"lines\": \"1-80\"}">
</lov-tool-use>
Found the issue. The `/agendamento` page header uses `https://wa.me/${WHATSAPP_NUMBER}` directly (no message), but the issue per the screenshot is that it's hitting `api.whatsapp.com` which is blocked. The main site uses `wa.me` on mobile and `web.whatsapp.com/send` on desktop with text. I'll align `/agendamento` to use the same pattern.

<lov-plan>

## Problema
Na página `/agendamento`, o link "WhatsApp" no header aponta para `https://wa.me/5591936180476` sem texto, e em alguns navegadores desktop está caindo em `api.whatsapp.com` (bloqueado — print enviado pelo usuário).

A página principal usa lógica do `WhatsAppButton.tsx` que detecta dispositivo:
- Mobile → `https://wa.me/{phone}?text=...`
- Desktop → `https://web.whatsapp.com/send?phone={phone}&text=...`

E inclui mensagem pré-pronta + tracking GTM/Meta Pixel.

## Correção
**Arquivo:** `src/pages/Agendamento.tsx`

1. Substituir o link estático do WhatsApp no header por lógica idêntica à do `WhatsAppButton`:
   - Detectar mobile via `navigator.userAgent`
   - Usar `wa.me` no mobile, `web.whatsapp.com/send` no desktop
   - Incluir mensagem padrão: "Olá! Gostaria de agendar uma consulta com o Dr. Juliano Machado."

2. Aplicar a mesma lógica no link do telefone do footer (caso esteja com problema similar) — manter `tel:` que é seguro.

3. Adicionar tracking `trackWhatsAppClick` + `trackMetaContact('WhatsApp')` no clique para manter paridade com o resto do site.

## Resultado
- Link do WhatsApp na `/agendamento` funciona igual ao da home
- Sem mais erro `api.whatsapp.com bloqueado` no desktop
- Tracking de conversão mantido

