

# Padronizar numero WhatsApp 0476 + corrigir SEO

## Diagnostico

Os links `wa.me` ja estao todos usando `5591936180476` -- correto. O bloqueio mostrado na imagem (`api.whatsapp.com`) e do cache do navegador ou de uma versao anterior; o codigo atual nao tem mais `api.whatsapp.com`.

Porem, ha inconsistencias no numero **exibido** e no SEO:

| Local | Problema |
|-------|----------|
| Footer.tsx linha 94 | Texto exibe `(91) 93618-0428` mas link aponta para 0476 |
| LocationsSection.tsx linha 30 | Clinicor phone exibe `(91) 93618-0428` |
| index.html linha 55 | Schema JSON-LD usa `+5591936180428` |
| Index.tsx linha 43 | Schema structured data usa `+559181653200` (numero diferente) |

## Correcoes

### 1. Footer.tsx (linha 94)
Trocar texto exibido de `(91) 93618-0428` para `(91) 93618-0476`.

### 2. LocationsSection.tsx (linha 30)
Trocar phone da Clinicor de `(91) 93618-0428` para `(91) 93618-0476`.

### 3. index.html (linha 55)
Trocar `"telephone": "+5591936180428"` para `"telephone": "+5591936180476"`.

### 4. Index.tsx (linha 43)
Trocar `"telephone": "+559181653200"` para `"telephone": "+5591936180476"`.

Os telefones especificos das outras clinicas (Hospital Geral, IOB, Vitria) permanecem inalterados.

