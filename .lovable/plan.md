# Fixar imagem padrão no Template de Avaliações

## O que será feito

1. Copiar `drjuliano.png` para `src/assets/avaliacao-default.png` (commitada no projeto).
2. Em `src/pages/admin/Avaliacoes.tsx`:
   - Importar o asset como ES6 module.
   - Adicionar `useEffect` que, no mount, faz `fetch()` da imagem, converte em base64 e popula `imagemBase64`, `imagemPreview` e `imagemNome` ("Imagem padrão Dr. Juliano").
3. Manter botões de remover/trocar funcionando — admin pode substituir ou remover só naquele envio. Após reload, a padrão volta.

## Detalhes técnicos

- `import imagemPadraoAvaliacao from "@/assets/avaliacao-default.png"`.
- Conversão: `fetch(imagemPadraoAvaliacao) → blob → FileReader.readAsDataURL → setImagemBase64(base64)`.
- Não altera backend, banco, edge functions nem o template de texto. O envio já dispara `enviarImagemWhatsApp` quando há `imagemBase64`.

## Fora de escopo

- Sem campo configurável no banco para trocar a imagem padrão.
- Sem mudanças em lembretes anuais ou outras telas de envio em massa.
