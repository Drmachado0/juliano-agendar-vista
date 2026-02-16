

# Melhorias visuais na pagina inicial e rodape

## Problema
- Logo no rodape esta muito pequena (w-10/h-10 container, w-8/h-8 imagem)
- Rodape visualmente simples comparado ao resto do site premium
- Espaco excessivo entre o header e o conteudo do Hero (muita area vazia no topo)

## Alteracoes propostas

### 1. Rodape - Logo maior e mais destaque
- Aumentar container do logo de `w-10 h-10` para `w-14 h-14`
- Aumentar imagem de `w-8 h-8` para `w-12 h-12`
- Aumentar nome do doutor de `text-sm` para `text-base`
- Aumentar subtitulo "Oftalmologista" de `text-[11px]` para `text-xs`
- Adicionar um separador decorativo dourado entre o conteudo e a barra inferior
- Melhorar a barra inferior com icones de redes sociais (Instagram + WhatsApp)

### 2. Rodape - Melhoria visual geral
- Adicionar gradiente sutil no fundo do rodape em vez de cor solida
- Titulos das colunas com detalhe dourado (borda inferior ou icone)
- Links com efeito hover mais suave e indicador visual
- Icone do WhatsApp no contato (substituir Phone por MessageCircle ou manter com icone WhatsApp)

### 3. Hero Section - Reduzir espaco vazio superior
- Reduzir `min-h-[100dvh]` para `min-h-[92dvh]` para que o hero nao tenha tanto espaco vazio acima do conteudo
- Ajustar `pt-20` para `pt-24` para melhor centralizacao vertical

### 4. Rodape - Barra inferior mais elegante
- Adicionar link para Instagram e WhatsApp como icones clicaveis na barra inferior
- Texto "Feito com coração" com estilo mais discreto

## Detalhes tecnicos

### Arquivo: `src/components/Footer.tsx`
- Logo: `w-10 h-10` → `w-14 h-14`, imagem `w-8 h-8` → `w-12 h-12`
- Nome: `text-sm` → `text-base font-bold`
- Subtitulo: `text-[11px]` → `text-xs`
- Fundo: `bg-card` → gradiente `bg-gradient-to-b from-card to-background`
- Titulos: adicionar `border-b border-primary/20 pb-2 inline-block`
- Barra inferior: icones sociais (Instagram, WhatsApp) como links

### Arquivo: `src/components/HeroSection.tsx`
- Reduzir `min-h-[100dvh]` para `min-h-[92dvh]`

