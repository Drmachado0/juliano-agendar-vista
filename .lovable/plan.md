

# Atualizar numero WhatsApp da landing page

Trocar todas as ocorrencias do numero antigo pelo novo **5591920021125** em 4 arquivos:

| Arquivo | Numero Atual | Ocorrencias |
|---------|-------------|-------------|
| `src/components/WhatsAppButton.tsx` | `5519982273901` | 1 |
| `src/components/Footer.tsx` | `5519982273901` | 2 |
| `src/components/InsuranceSection.tsx` | `5519982273901` | 1 |
| `src/components/Header.tsx` | `5591981653200` | 1 |

Todas as URLs `https://api.whatsapp.com/send?phone=XXXXX` serao atualizadas para usar `phone=5591920021125`. O texto da mensagem padrao nos links permanece o mesmo. O numero exibido no rodape tambem sera atualizado para o formato `(91) 92002-1125`.

