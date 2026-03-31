

# Ajuste da Pagina Inicial — Header maior + Hero centralizado

## Problema
A imagem mostra que o header tem textos/icones pequenos e ha um espacamento vertical excessivo no hero, empurrando o conteudo para baixo.

## Alteracoes

### 1. Header (`src/components/Header.tsx`)
- Aumentar tamanho do logo: `w-9 h-9 sm:w-10 sm:h-10` → `w-11 h-11 sm:w-12 sm:h-12` e imagem interna proporcionalmente
- Aumentar nome: `text-[13px] sm:text-sm` → `text-sm sm:text-base`
- Aumentar subtitulo: `text-[10px] sm:text-[11px]` → `text-[11px] sm:text-xs`
- Aumentar nav links: `text-[13px]` → `text-sm`
- Aumentar icones dos botoes CTA: `h-4 w-4` → `h-5 w-5`
- Aumentar padding vertical do header: `py-2.5 sm:py-3` → `py-3 sm:py-4`

### 2. Hero Section (`src/components/HeroSection.tsx`)
- Reduzir altura minima: `min-h-[85dvh]` → `min-h-[75dvh]`
- Trocar alinhamento vertical: `items-end` → `items-center`
- Reduzir padding top: `pt-20 sm:pt-28` → `pt-24 sm:pt-24`
- Reduzir padding bottom: `pb-16` → `pb-10`

Isso sobe o conteudo do hero, reduz o espaco morto e deixa o header mais proeminente.

