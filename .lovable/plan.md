

# Redesign profissional do Hero Section

## Problema atual
- A foto atual (com bebe) nao transmite profissionalismo medico
- Layout generico, nao diferenciado de sites de clinicas comuns
- Muito espaco vazio entre o header e o conteudo
- Badges flutuantes (Paragominas, Belem, Google rating) ficam cortados ou desalinhados
- Falta hierarquia visual clara para converter visitantes em agendamentos

## Solucao

### 1. Trocar a foto do Hero
- Usar a nova foto profissional enviada (jaleco branco no consultorio) como imagem principal do Hero
- Copiar o arquivo `user-uploads://unnamed.png` para `src/assets/dr-juliano-hero.png`
- Apresentacao circular ou com moldura elegante ao inves do retangulo grande atual

### 2. Redesign completo do Hero Section
- **Layout centralizado**: conteudo principal centralizado para impacto maximo, com a foto do doutor em destaque acima ou ao lado
- **Headline mais impactante**: manter "Sua visao merece cuidado especializado" mas com tipografia maior e mais impactante
- **Subtitulo focado em conversao**: texto curto e direto que gera confianca
- **CTA mais proeminente**: botao "Agendar minha consulta" com mais destaque visual, maior e com animacao sutil
- **Social proof integrado**: stats (+6.000 pacientes, 5.0 Google, +13 anos) em cards com fundo sutil ao inves de apenas texto
- **Remover badges flutuantes**: integrar locais e rating de forma mais limpa dentro do layout
- **Reduzir espaco vazio**: conteudo mais compacto e vertical para mobile

### 3. Melhorias de layout mobile
- Foto do doutor menor e circular no mobile
- Headline e CTA acima da dobra (sem scroll necessario)
- Stats em linha horizontal compacta
- Padding reduzido para aproveitar melhor o espaco

### 4. Microinteracoes e polish
- Badge de confianca ("Membro SBO") mais discreto e elegante
- Gradiente de fundo mais sofisticado com particulas sutis ou linhas decorativas
- Transicoes de entrada mais suaves e sequenciais

## Detalhes tecnicos

### Arquivos modificados
| Arquivo | Alteracao |
|---------|-----------|
| `src/assets/dr-juliano-hero.png` | **Novo** - foto profissional no consultorio |
| `src/components/HeroSection.tsx` | Redesign completo do componente |

### Estrutura do novo Hero (desktop)

```text
+-------------------------------------------------------+
|  [Badge SBO]                                           |
|                                                        |
|   [Foto circular]    Sua visao merece                  |
|   [Dr. Juliano]      cuidado especializado             |
|                                                        |
|   Dr. Juliano Machado - +13 anos de excelencia         |
|   em oftalmologia em Paragominas e Belem               |
|                                                        |
|   [=== Agendar minha consulta ===] [Procedimentos]     |
|                                                        |
|   +6.000 pacientes  |  5.0 Google  |  +13 anos        |
+-------------------------------------------------------+
```

### Estrutura mobile

```text
+---------------------------+
|     [Foto circular]       |
|     Dr. Juliano Machado   |
|     Oftalmologista        |
|                           |
|   Sua visao merece        |
|   cuidado especializado   |
|                           |
|   +13 anos de excelencia  |
|                           |
|  [Agendar minha consulta] |
|  [Conhecer procedimentos] |
|                           |
|  +6k  |  5.0  |  +13a    |
+---------------------------+
```

### Aspectos visuais
- Foto com borda dourada sutil e sombra glow
- Background com gradiente navy mais rico e linhas decorativas sutis
- Stats em mini-cards com icone e fundo `bg-card/50`
- CTA com gradiente dourado mais vibrante e efeito shimmer
- Animacoes de entrada sequenciais mantidas mas refinadas

