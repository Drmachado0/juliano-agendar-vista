# Fase 4, perfis fora do site

**Data:** 29/08/2026

Nada aqui e codigo. Sao acoes em plataformas de terceiros, todas exigindo o seu
login. O que eu fiz foi levantar o estado publico de cada perfil e preparar o
texto exato para colar, para voce so conferir e salvar.

Por que esta fase importa mais que qualquer coisa que eu mexa no site: o estudo
de fatores locais mais citado atribui mais da metade da variacao de posicao no
pacote de mapas a proximidade e a sinais do proprio perfil do Google. Nenhuma
correcao de HTML compete com um perfil incompleto.

---

## O bloco de NAP oficial

Copie daqui. Este e o texto que o site declara no dado estruturado, e a regra de
ouro de SEO local e que o texto seja **identico** em todo lugar, letra por letra,
incluindo abreviacao e pontuacao. "Av." em um lugar e "Avenida" em outro ja conta
como divergencia para o Google.

**Nome profissional**

```
Dr. Juliano Machado
```

**Registro**

```
CRM-PA 15253
```

**Especialidade, e a categoria a escolher no perfil**

```
Oftalmologista
```

Nao aceite "Medico" generico. Categoria errada e uma das causas mais comuns de
um perfil correto nao aparecer no pacote local.

**As quatro unidades**

| Unidade | Endereco | Telefone |
|---|---|---|
| Clinicor | Rua Eixo W1, R. Célio Miranda, N° 729, Paragominas - PA | (91) 93618-0476 |
| Hospital Geral de Paragominas | R. Santa Terezinha, 304 - Centro, Paragominas - PA | (91) 9100-0303 |
| Instituto de Olhos de Belém | Av. Generalíssimo Deodoro, 904 - Nazaré, Belém - PA | (91) 3239-4600 |
| Vitria - Ed. Síntese 21 | Av. Conselheiro Furtado, 2865 - Sobreloja, salas 08-10 - São Braz, Belém - PA | (91) 3342-1463 |

**Site**

```
https://drjulianomachado.com
```

**Instagram**

```
https://www.instagram.com/drjuliano.oftalmo/
```

O outro perfil, `@drjulianomachado.oftalmo`, saiu do site em 29/08/2026. Se ele
existir em algum cadastro, troque.

**Descricao curta, mesma do dado estruturado do site**

```
Oftalmologista especializado em catarata, pterígio, exames de campo visual e
OCT. Atendimento em Paragominas e Belém.
```

**Experiencia**

```
Mais de 15 anos
```

Nunca "11 anos". Ver a secao de contaminacao abaixo.

**Horario de atendimento**

**Nao declarar, decidido em 29/08/2026.** O atendimento e flexivel e nao ha
horario fixo. A opcao de por 24/7 foi levantada e descartada: horario declarado
que nao bate com o movimento real degrada a confianca do perfil no Google, e um
paciente que ve "aberto agora" as 23h liga ou aparece.

Perfil sem horario nao perde posicao, so nao ganha o selo de aberto. E o campo
tambem nao entra no dado estruturado do site, entao nao ha afirmacao falsa em
pagina de saude.

Se um dia existir horario de CONTATO estavel, quando alguem responde o WhatsApp
ou o telefone, ai vale declarar. Nao precisa ser quando o medico esta no
consultorio, precisa ser verdade.

---

## A contaminacao do dominio antigo

Existiu um site em **drjulianosmachado.com.br**, com um "s" a mais, aposentado
por redirecionamento 301 em 28/08/2026. Ele propagou dois dados errados que
vazaram para cadastros de terceiros:

1. **"11 anos de experiencia"**, quando o correto e mais de 15
2. **um telefone com DDD 19**, de Campinas, em Sao Paulo

O site novo esta limpo dos dois, verifiquei o codigo e o HTML publicado. O
problema e que cadastro de diretorio nao se corrige sozinho quando o site de
origem sai do ar. Ele congela o dado errado ate alguem editar.

**Onde o DDD 19 sabidamente vazou:** o perfil no agendarconsulta.com.

Um telefone de outro estado no perfil de um medico do Para e pior que um dado
desatualizado. Para o Google, telefone e um dos tres campos que definem a
identidade do negocio local, junto de nome e endereco. Um numero de Campinas
enfraquece a associacao dele com Paragominas e Belem.

---

## O que eu encontrei, verificado em 29/08/2026

### RESOLVIDO em 29/08/2026, as avaliacoes voltaram a se atualizar sozinhas

A cadeia inteira foi fechada no mesmo dia. Fica o registro porque o caminho ate
aqui tem tres armadilhas que valem para a proxima pessoa.

| Etapa | Quem fez | Resultado |
|---|---|---|
| Colunas `google_reviews_total` e `google_rating` | o medico, pelo SQL editor | criadas |
| Sincronizacao | o medico, pelo botao do admin | rodou |
| Valor gravado | | **111 avaliacoes, nota 5,0** |
| Atualizacao daria as 6h | ja existia | segue sozinha |

**Armadilha 1, dois bancos parecidos.** O conector do Supabase desta sessao
enxerga um projeto chamado `juliano-agendar-vista`, ref `qwpgmvudxvndmzqwrskt`,
com `site_config` e `avaliacoes_google` de 14 linhas. Bate com tudo. **Nao e o
do site.** O bundle publicado chama `cnpifhaszbonwlqruwnn`, que nao aparece na
lista porque e provisionado pela Lovable. Rodar a migration no primeiro daria
sucesso e nao mudaria nada no site.

**Armadilha 2, o 401 nao era do gateway.** A funcao tem gate proprio, na linha
41 do `index.ts`: aceita `Bearer <CRON_SECRET>` ou um usuario autenticado de
verdade. Chave anonima nao e usuario, e chave de projeto. Por isso a chamada
externa e a invocacao pelo painel falharam, e por isso o unico caminho era o
botao em `src/pages/admin/Configuracoes.tsx:310`, que manda a sessao do medico.

**Armadilha 3, cinco e cento e onze.** O botao respondeu "Synchronized 5
reviews" e o banco recebeu 111. Nao e contradicao: a API do Google devolve no
maximo 5 depoimentos para exibir, e junto manda `user_ratings_total`, que e
quantas avaliacoes o perfil tem. Confundir os dois foi a causa do bug original.

**O que sobra.** O `count` em `src/lib/constants.ts` virou irrelevante para o
cliente, porque o banco manda. Mas o SSG continua usando ele, ja que no servidor
nao ha sessao para consultar o banco. Entao 111 segue sendo o numero que o
Google e o preview do WhatsApp leem, e ele volta a envelhecer. A correcao
duravel e o SSG ler o valor no build. Nao e urgente.

---

### Google Business Profile, melhor do que se supunha e com um dado que o site erra

Abri o perfil pelo CID declarado no site e li a tela. Nao e relato de terceiro.

| Campo | Valor publico hoje |
|---|---|
| Nome | Dr Juliano Machado - Oftalmologista |
| Nota | **5,0** |
| Avaliacoes | **111** |
| Categoria | **Oftalmologista**, correta |
| Endereco | R. Santa Terezinha, 304 - **Sala 07** - Centro, Paragominas - PA, **68625-080** |
| Horario | tem horario declarado, aparecia "Aberto, fecha 12:00" |

**Tres coisas boas.** A categoria esta certa, entao a causa mais comum de perfil
invisivel esta descartada. Nao ha perfil duplicado, o problema classico de quem
atende em varios enderecos. E o perfil e ativo, com post do proprietario e
resposta em praticamente toda avaliacao.

**Uma coisa que o site erra feio.** O site diz **14 avaliacoes**. O perfil tem
**111**. O HTML pre renderizado publica o numero errado em dois lugares da home,
e o mesmo numero vai para quem le sem executar JS.

O `useGoogleReviews` busca o total real no Supabase e cai numa constante quando
nao consegue. No servidor ele nunca consegue, entao o HTML sai sempre com a
constante. E a constante esta em 14, com um comentario dizendo que 14 e a
contagem real do pool sincronizado. Pool de depoimentos exibidos e total de
avaliacoes sao coisas diferentes, e o texto da pagina diz "avaliacoes".

Subestimar o proprio ativo mais forte por um fator de 8 e o tipo de erro que
custa conversao sem aparecer em relatorio nenhum.

**Dois pontos menores para conferir logado:**

- O telefone do perfil e (91) 3729-3200, e o site diz (91) 9100-0303 para o
  mesmo endereco do HGP. Telefone divergente entre perfil e site enfraquece o
  sinal local. Um dos dois esta desatualizado, e so voce sabe qual.
- O endereco do perfil traz "Sala 07", que o site nao tem. Vale acrescentar no
  `locations.ts`, para o NAP bater letra por letra.

**CEP achado de graca:** o perfil mostra **68625-080** para o Hospital Geral de
Paragominas. E um dos quatro que faltavam no item 3.1 do plano.

### Onde ele aparece, e onde nao aparece

| Busca | Situacao |
|---|---|
| "oftalmologista Paragominas", no mapa | **1o lugar**, a frente de CEO Centro Especializado, Clinica Vision e Nabila Demachki |
| "oftalmologista Paragominas", organico | **o site nao aparece**. Os primeiros sao BoaConsulta, Doctoralia, CatalogoMed e MedicosBrasil |
| "oftalmologista Belem", no mapa | **nao aparece em posicao nenhuma** |
| "oftalmologista Belem", organico | so diretorios e clinicas |

Isto reorganiza a leitura da auditoria. Em Paragominas ele domina o mapa e perde
o organico para diretorios onde ele nem tem perfil decente. Em Belem ele nao
existe, nem no mapa nem no organico, apesar de atender em dois enderecos la.

O perfil unico esta ancorado no HGP em Paragominas. Nao ha nada dele no mapa de
Belem, e isso explica melhor as 11 paginas com zero impressao do que qualquer
problema de HTML.

### agendarconsulta.com, o pior caso

**Perfil:** https://agendarconsulta.com/perfil/dr-dr-juliano-machado-1720017204

Confirmei pessoalmente, baixando a pagina. Nao e relato de terceiro.

| Campo | O que esta publicado hoje | Correcao |
|---|---|---|
| Telefone | **(19) 98227-3901**, aparece 3 vezes | `(91) 93618-0476` |
| Instagram | **@droftalmologista_** | `@drjuliano.oftalmo` |
| Clinicor | "Rua Eixo W1, 729, Paragominas" | falta `R. Célio Miranda, N°` |
| Hospital Geral | "Rua Santa Teresinha, 304, Paragominas" | falta `- Centro`, e o tel `(91) 9100-0303` |
| Belem | **ausente** | faltam as duas unidades |
| Site | drjulianomachado.com | correto |
| Estado | nao reivindicado, "nao possui agenda online" | reivindicar |

O DDD 19 esta no ar agora. Nao ha "11 anos" nesta pagina, ao contrario do que a
auditoria supunha.

**Descoberta lateral:** apareceu um TERCEIRO handle de Instagram. Sao tres nomes
circulando para a mesma pessoa: `@drjuliano.oftalmo`, que e o ativo,
`@drjulianomachado.oftalmo`, que saiu do site em 29/08, e `@droftalmologista_`,
neste perfil. Tres enderecos para uma pessoa so dividem o sinal em tres.

### BoaConsulta, perfil auto-gerado com quatro enderecos fantasma

**Perfil:** https://www.boaconsulta.com/especialista/juliano-silva-machado-6105d28ca2e00a5e18000132

Confirmado como sendo ele pelo CRM 15253 PA. Perfil gerado automaticamente,
nunca reivindicado, sem telefone. Lista **seis** enderecos, e nenhum bate:

| Endereco listado | Problema |
|---|---|
| Av. Generalissimo Deodoro, **868** - **Umarizal**, Belem | numero e bairro errados, o certo e 904, Nazare |
| Rua Santa Teresinha, 304 - **Celio Miranda**, Paragominas | bairro errado, e Centro. O "Celio Miranda" veio colado do endereco da Clinicor |
| Av. Dionisio Bentes, Tome-Acu/PA | nao e unidade oficial |
| Av. Dionisio Ventes, Tome-Acu/PA | duplicata do anterior, com erro de grafia |
| Tv. Americo Lopes, Sao Miguel do Guama/PA | nao e unidade oficial |
| Tv. WE 53, Coqueiro, Ananindeua/PA | nao e unidade oficial |

Seis enderecos sem telefone e sem reivindicacao e ruido puro. Para o Google,
um profissional espalhado por seis cidades tem menos relevancia local em cada
uma que um com quatro enderecos corretos em duas.

### Doctoralia, perfil nao existe

Conferido nas duas listagens, Paragominas e Belem. Ele nao esta em nenhuma.

**E aqui mora um risco de marca.** O homonimo que aparece na busca e um
**ortopedista de Recife**, e o dominio dele e **drjulianomachado.com.br**, o
`.com.br` do seu `.com`. Sao dois medicos com o mesmo nome, sites quase iguais,
e um deles ja ocupa o Doctoralia. Criar o perfil deixa de ser opcional.

### Onde ele nao esta

CatalogoMed, MedGuias, iClinic e Consulta Marcada nao tem perfil dele.

### Residuo do dominio antigo

O 301 de `drjulianosmachado.com.br` funciona, confirmado. Mas o indice do
buscador ainda serve trechos com "**mais de 11 anos**" e "**mais de 13 anos**"
do cache do dominio aposentado. Isso se resolve sozinho com a reindexacao, e nao
ha o que editar, porque a pagina de origem nao existe mais.

---

## CORRECAO DE 29/08/2026, o medico nao usa diretorio

Ele informou que **nao usa agendarconsulta nem Doctoralia**. Isso inverte parte
da recomendacao acima, que foi escrita supondo o contrario.

**O que muda.** O objetivo nesses diretorios deixa de ser construir presenca e
passa a ser **controle de dano**. Perfil de diretorio sem dono nao e vitrine
vazia, e um cadastro que outra empresa mantem sobre voce, e a plataforma ganha
dinheiro exibindo ele com ou sem a sua participacao.

**Perfil abandonado e pior que perfil inexistente.** Paciente que manda mensagem
por um canal que ninguem le nao conclui "ele nao usa isso", conclui "ele nao
respondeu". Criar cadastro em plataforma que nao sera mantida troca um problema
de ausencia por um de descaso.

### O que fica valendo

- [ ] **agendarconsulta: corrigir ou remover, nao adotar.** O motivo nao e SEO,
      e o telefone `(19) 98227-3901`, de Campinas, publicado com o nome e o CRM
      dele. Paciente que liga cai em outro estado. Procure "reportar dados
      incorretos" ou o formulario de contato. Se der para reivindicar so para
      apagar o numero e abandonar, resolve igual.

- [ ] **BoaConsulta: mesma coisa.** Seis enderecos, quatro em cidades onde ele
      nao atende. Nao ha telefone la, entao o dano e menor que o do
      agendarconsulta, mas quatro cidades falsas diluem a relevancia local dele
      nas duas cidades reais.

- [x] **Doctoralia: NAO criar.** Recomendacao anterior cancelada. O argumento
      era o homonimo ortopedista de Recife ocupando o espaco de marca, e ele
      continua verdadeiro, mas nao justifica manter um canal que ninguem
      responde. Se um dia houver secretaria dedicada a isso, reabra.

- [x] **Bing Places, Apple Business Connect, Facebook: adiar.** Mesma logica.
      Sao cadastros, e cadastro sem dono envelhece.

### Onde a energia rende, e como fazer

Sobra uma frente, e ela e a que mais rende de qualquer forma: o **Google
Business Profile**, que ele de fato controla e ja mantem, com post proprio e
resposta em quase toda avaliacao.

**O buraco e Belem.** Um perfil so, ancorado no Hospital Geral em Paragominas,
onde ele e primeiro lugar no mapa. Em Belem nao aparece em posicao nenhuma,
apesar de atender em dois enderecos.

**Confirmado com ele em 29/08/2026:** em Belem ele atende DENTRO da estrutura de
terceiros, tanto no IOB quanto na Vitria. Nao sao consultorios dele.

Isso nao impede perfil proprio, e a prova esta no proprio caso dele. O perfil de
Paragominas fica no Hospital Geral, que tambem e estrutura de terceiro, existe,
esta ativo e e primeiro lugar. A regra do Google permite perfil de profissional
em local de outra empresa quando ele atende o proprio publico e o local tem mais
de um profissional. IOB e Vitria atendem os dois criterios.

**O que fazer:** dois perfis de profissional, um por endereco, com o nome dele e
nao o da clinica. Categoria Oftalmologista. Endereco da clinica, com sala quando
houver.

**Duas condicoes que decidem se funciona:**

1. **Avisar as clinicas antes.** A verificacao costuma ser por carta ou ligacao
   naquele endereco, e sem colaboracao trava. Alem disso, perfil surpresa no
   endereco de um parceiro cria atrito a toa.
2. **Nao usar o telefone da clinica.** Use o WhatsApp dele. O perfil e dele, e
   paciente que liga precisa chegar nele, nao na recepcao do parceiro.

**Nota de nomenclatura:** "Vitria" esta CORRETO, confirmado com o medico em
29/08/2026. Nao troque para "Vitrea". O site usa "Vitria" em doze lugares e
todos estao certos.

---

## Ordem de prioridade

Reescrita em 29/08/2026, depois que o medico informou que nao usa diretorio. A
versao anterior mandava criar perfil no Doctoralia, no Bing Places e no Apple
Business Connect. Estava errada para o caso dele, e foi removida em vez de
mantida ao lado da correta.

A ordem nao e por facilidade, e por quanto cada uma move o ponteiro.

### 1. Google Business Profile, Belem

O maior ganho disponivel. Ele e primeiro lugar no mapa de Paragominas e nao
aparece em Belem, onde atende em dois enderecos.

- [ ] Avisar o IOB e a Vitria antes, a verificacao passa pelo endereco delas
- [ ] Criar perfil de profissional em cada endereco, com o nome dele e nao o da
      clinica, categoria Oftalmologista
- [ ] Usar o WhatsApp dele, nao o telefone da recepcao do parceiro

### 2. Google Business Profile, o que ja existe

- [ ] O telefone do perfil e `(91) 3729-3200` e o site diz `(91) 9100-0303` para
      o mesmo endereco. Decidir qual fica e igualar os dois
- [ ] O endereco do perfil traz "Sala 07", que o site nao tem. Acrescentar em
      `src/lib/locations.ts` para o NAP bater letra por letra
- [ ] Fotos do consultorio, nao so a do Street View
- [ ] Servicos listados, um por procedimento

Ja conferido e correto: categoria e Oftalmologista, e nao ha perfil duplicado.
Horario fica sem declarar, decisao registrada acima.

### Decidido, os fixos de Belem ficam como estao

Levantado e **descartado** em 29/08/2026, pelo medico.

A pagina `/belem` publica os fixos das clinicas, `(91) 3239-4600` para o
Instituto de Olhos e `(91) 3342-1463` para a Vitria. O agendamento dele nessas
duas unidades acontece pelo WhatsApp proprio, `(91) 93618-0476`, em agenda
interna, e a recepcao das clinicas nao mexe nessa agenda.

Foram oferecidas tres saidas: trocar os fixos pelo WhatsApp, mostrar os dois com
rotulo, ou deixar. **Ele escolheu deixar.**

Consequencia conhecida e aceita: quando os perfis de Belem forem criados com o
WhatsApp dele, o telefone do perfil nao vai bater com o fixo que a pagina mostra
para aquela unidade. E divergencia de NAP de baixo impacto, porque o WhatsApp
dele ja aparece na mesma pagina em quatro lugares.

Nao "corrija" isso sem falar com ele. Os fixos sao os numeros reais das clinicas
e estao certos como informacao.

### 3. agendarconsulta.com, corrigir ou remover

Nao adotar a plataforma. O objetivo e so parar de publicar dado errado com o
nome e o CRM dele.

- [ ] Apagar o telefone `(19) 98227-3901`, de Campinas
- [ ] Trocar `@droftalmologista_` por `@drjuliano.oftalmo`, ou apagar
- [ ] Se der para remover o perfil inteiro, melhor ainda

### 4. BoaConsulta, mesma logica

Dano menor, porque nao ha telefone la. Mas quatro cidades falsas diluem a
relevancia local dele nas duas cidades reais.

- [ ] Apagar os enderecos de Tome-Acu, Sao Miguel do Guama e Ananindeua
- [ ] Corrigir Av. Generalissimo Deodoro de 868 Umarizal para 904 Nazare
- [ ] Corrigir o bairro do Hospital Geral, de Celio Miranda para Centro

### 5. CRM-PA e sociedades da especialidade

Nao trazem trafego. Sao a fonte que o Google usa para confirmar que o
profissional existe e e habilitado, e valem peso alto em conteudo de saude. Nao
exigem manutencao, que e o que os separa dos diretorios acima.

- [ ] Conferir se os dados publicos do CRM-PA batem com o site
- [ ] Conselho Brasileiro de Oftalmologia, https://www.cbo.com.br
- [ ] Sociedade Brasileira de Glaucoma, https://www.sbglaucoma.com.br,
      especialmente pelo fellowship em glaucoma

### Fora da lista, de proposito

Doctoralia, Bing Places, Apple Business Connect e pagina no Facebook. Todos
seriam cadastro novo em plataforma que ninguem vai manter. Reabra apenas se
houver secretaria dedicada a responder por esses canais.

---

## Como saber se funcionou

Sem refazer auditoria:

| Sinal | Onde | O que significa |
|---|---|---|
| Chamadas pelo perfil | Insights do Google Business Profile | o perfil passou a converter |
| Pedidos de rota | Idem | proximidade sendo reconhecida |
| Buscas de descoberta contra buscas de marca | Idem | se descoberta subir, o perfil esta aparecendo para quem ainda nao conhece o nome |
| Telefone com DDD 19 na busca | busque o nome dele no Google | tem que sumir dos resultados em algumas semanas |
