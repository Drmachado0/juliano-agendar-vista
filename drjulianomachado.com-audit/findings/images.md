# Imagens, drjulianomachado.com

**Data:** 28/08/2026 · **Nota: 84/100** (era 96/100. A queda vem de dois problemas reais na `/agendamento` e da ausencia total de `srcset`, que a auditoria anterior nao mediu.)

Medicao: 48 tags `<img>` nas 18 rotas, extraidas do HTML servido. Peso de cada asset baixado individualmente.

## O que esta certo

- **Alt text:** 47 das 48 imagens tem `alt` descritivo e em portugues. Zero `alt` ausente.
- **Alt de qualidade:** os textos descrevem de verdade, nao sao keyword stuffing. Exemplo: `"Retroiluminacao do olho antes do laser"` e `"Dr. Juliano Machado durante consulta no consultorio"`.
- **Lazy loading correto:** as imagens abaixo da dobra usam `loading="lazy"`, e a hero da home nao usa, com `fetchpriority="high"` no lugar certo.
- **Cache:** todos os assets com `Cache-Control: public, max-age=31536000, immutable`.
- **WebP na home:** a hero da home e WebP de 62.634 bytes, com `width` e `height` declarados.

## Achados

### [High] A hero da `/agendamento` e JPG, tem lazy loading e nao declara dimensoes

Tres problemas na mesma tag, na pagina que existe para converter:

```html
<img src="/assets/dr-juliano-hero-BIYZWmdo.jpg" loading="lazy"
     alt="Dr. Juliano Machado, oftalmologista">
```

| | `/` (correto) | `/agendamento` (problema) |
|---|---|---|
| Formato | WebP | **JPG** |
| Peso | 62.634 bytes | **122.380 bytes** |
| `loading` | ausente, carrega logo | **`lazy`** |
| `fetchpriority` | `high` | ausente |
| `width` / `height` | declarados | **ausentes** |

E a mesma foto, servida com o dobro do peso e adiada. Como e o elemento de topo da pagina, e quase certamente o LCP dela, e `loading="lazy"` num elemento de LCP e a forma mais direta de atrasar o LCP que existe. A ausencia de `width` e `height` ainda abre espaco para deslocamento de layout, que conta como CLS.

*Correcao:* usar o mesmo asset WebP da home (`dr-juliano-hero-BvBWiQwP.webp`), tirar `loading="lazy"`, por `fetchpriority="high"`, declarar `width` e `height`. Quatro atributos.

*Como saber se falhou:* PageSpeed em `/agendamento` mobile antes e depois. Se o LCP nao melhorar, o elemento de LCP nao e essa imagem, e a hipotese cai.

---

### [x] RESOLVIDO em 28/08/2026. Imagens responsivas, e duas correcoes minhas

Este achado passou por duas correcoes antes de ficar de pe. Vale registrar as duas, porque as duas vieram de medir por fora sem abrir o codigo.

**Erro 1, maiusculas.** Contei `srcset` em minusculas e conclui que nenhuma imagem era responsiva. O React escreve `srcSet` em camelCase.

**Erro 2, `<picture>`.** Refiz a contagem sem diferenciar maiusculas, mas so em tags `<img>`, e conclui que so a hero da home era responsiva. A hero de `/paragominas` ja era responsiva desde antes, por `<picture>` com `<source srcSet>` de 900w e 1400w, que a busca em `<img>` nao alcanca.

Contagem final, correta, olhando `<img>` e `<source>`:

| Rota | Imagens responsivas antes | Depois |
|---|---|---|
| `/` | 1, no `<img>` | 1 |
| `/paragominas` | 1, no `<source>` de um `<picture>` | 1 |
| `/agendamento` | 0 | **1** |
| `/belem`, `/sobre` | 0 | 0 |

*O que foi feito:* `/agendamento` ganhou `<picture>` com tres variantes, 540w, 900w e 1400w, e `sizes="400px"`, que e a largura real da coluna lateral onde a imagem vive.

*O que nao precisava:* `/paragominas` ja estava certa. `/belem` e `/sobre` servem so o logo SVG e retratos pequenos.

---

### [x] RESOLVIDO em 28/08/2026, e o diagnostico estava errado. Imagem de `/agendamento`

O achado original dizia: JPG, com lazy loading, sem dimensoes, provavel elemento de LCP adiado.

**Dois dos tres estavam errados.** A imagem vive dentro de:

```jsx
<aside className="sticky top-24 hidden self-start lg:flex lg:flex-col lg:gap-6">
```

`hidden lg:flex` significa que ela **nao renderiza no mobile**. No desktop fica na coluna lateral, abaixo do bloco de avaliacoes. Ela nao e, e nao era, o elemento de LCP da pagina.

- `loading="lazy"` estava **correto** e foi mantido.
- Nao havia risco de CLS. `h-64 w-full` ja determina a caixa por CSS, entao `width` e `height` nao mudam nada aqui. Foram adicionados mesmo assim, como dica de proporcao caso a classe mude.
- O que era real: **formato**. JPG de 122.380 bytes onde o mesmo retrato existia em WebP de 62.634. Trocado.

Licao para a proxima auditoria: `loading="lazy"` numa imagem so e problema depois de confirmar que ela renderiza no viewport medido e que esta acima da dobra. Atributo lido do HTML nao diz onde a imagem aparece.

---

### [Medium] Os seis logos de convenio somam 171.924 bytes em PNG

Todos na home, abaixo da dobra, com lazy loading, o que limita o dano. Ainda assim e peso evitavel:

| Arquivo | Peso |
|---|---|
| `particular-D7wFq5Cv.png` | 79.281 bytes |
| `saude-caixa-C90N4yDP.png` | 38.550 bytes |
| `cassi-DFIFzF8_.png` | 24.253 bytes |
| `bradesco-saude-BqKR37sN.png` | 12.908 bytes |
| `sulamerica-DLsL7Txc.png` | 11.558 bytes |
| `unimed-CKyK-JgR.png` | 5.374 bytes |

79 KB para o selo "Particular" e desproporcional, provavelmente PNG em resolucao muito acima do tamanho de exibicao. Logos de marca sao o caso classico de SVG ou WebP.

*Correcao:* converter para WebP, ou SVG onde houver vetor. Espera-se cair para algo em torno de 30 KB no conjunto.

---

### [Medium] As 11 paginas de procedimento nao tem nenhuma imagem de conteudo

Todas as 11, mais `/sobre`, `/belem` e `/politica-de-privacidade`, servem apenas o logo SVG embutido. Zero foto, zero diagrama, zero ilustracao.

Duas perdas. A primeira e de experiencia: um paciente lendo sobre cirurgia de catarata ou gonioscopia se beneficia de ver o que e o exame. A segunda e de trafego: a busca por imagens do Google e uma porta de entrada real para termos medicos, e o site nao tem nada para ela indexar nessas paginas.

A home mostra que o padrao existe e funciona: as fotos `yag-antes` e `yag-depois` sao exatamente o tipo de conteudo visual que serve tanto ao paciente quanto a busca.

*Atencao regulatoria:* imagens de antes e depois em publicidade medica sao restritas pela Resolucao CFM 1.974/2011. As duas ja publicadas na home entram nessa questao. A avaliacao esta em `content-quality.md`, e vale resolver antes de multiplicar o padrao pelas outras paginas.

*Correcao:* comecar pelas tres paginas de maior valor comercial, catarata, pterigio e consulta oftalmologica, com foto do equipamento ou do procedimento, alt descritivo, WebP, dimensoes declaradas.

---

### [Low] A mesma `og:image` generica nas 18 rotas

As 18 paginas apontam para `https://drjulianomachado.com/og-image.jpg`. Compartilhar a pagina de catarata no WhatsApp mostra a mesma arte que compartilhar a politica de privacidade.

Em Paragominas e Belem o WhatsApp e o principal canal de indicacao entre pacientes. Um preview que nomeia o procedimento converte melhor que um generico.

*Correcao:* `og:image` por pagina, no minimo distinta para `/`, `/paragominas`, `/belem`, `/agendamento` e as tres paginas de procedimento de maior valor.

---

### [Info] Um `alt` vazio em `/paragominas`

O logo SVG embutido aparece com `alt=""` em `/paragominas` e com `alt="Dr. Juliano Machado, Oftalmologista"` nas outras rotas. A auditoria de 27/08 ja avaliou esse caso e concluiu que o `alt` vazio esta correto, por ser imagem decorativa com `aria-hidden`. O que resta e inconsistencia entre rotas, nao erro de acessibilidade.
