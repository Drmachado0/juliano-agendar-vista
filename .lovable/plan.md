

# Correção do Link WhatsApp

## Problema
O link `https://api.whatsapp.com/send?phone=...` pode não funcionar corretamente em alguns navegadores/dispositivos. O formato recomendado e mais compatível é usar `https://wa.me/`.

## Correção
Substituir todos os links WhatsApp no site de:
- `https://api.whatsapp.com/send?phone=5591936180476&text=...`
- `https://api.whatsapp.com/send?phone=5591936180476`

Para:
- `https://wa.me/5591936180476?text=...`
- `https://wa.me/5591936180476`

O formato `wa.me` é o link universal oficial do WhatsApp, mais confiável em todos os dispositivos (mobile e desktop).

### Arquivos afetados (4 arquivos, 5 ocorrências):
1. **WhatsAppButton.tsx** — 1 link com texto
2. **InsuranceSection.tsx** — 1 link com texto
3. **Header.tsx** — 1 link sem texto
4. **Footer.tsx** — 2 links sem texto

### Nota
O erro de runtime (`Cannot set property attributeName`) é interno do Lovable e não está relacionado ao projeto.

