# Local SEO, drjulianomachado.com, nota 54/100

Auditoria de SEO local do Dr. Juliano Machado, oftalmologista, CRM-PA 15253, atendimento em Paragominas e Belém (PA). Páginas avaliadas com renderização completa (JS executado): home, /paragominas, /belem, /agendamento, /sobre. Dados combinados com achados já registrados em on-page-seo.md, schema.md, technical-seo.md e content-quality.md.

## Nota por dimensão

| Dimensão | Peso | Nota | Nota ponderada |
|---|---|---|---|
| Sinais de GBP | 25% | 55/100 | 13.8 |
| Avaliações e reputação | 20% | 50/100 | 10.0 |
| SEO local on-page | 20% | 48/100 | 9.6 |
| Consistência de NAP e citações | 15% | 65/100 | 9.75 |
| Schema local | 10% | 65/100 | 6.5 |
| Links e autoridade local | 10% | 45/100 | 4.5 |
| **Total** | | | **54.1, arredondado para 54/100** |

## Tipo de negócio e vertical

**Tipo de negócio: híbrido.** O site mostra endereços físicos completos de quatro clínicas (Clinicor e Hospital Geral de Paragominas, em Paragominas, Instituto de Olhos de Belém e Vitria/Ed. Síntese 21, em Belém), com links de rota e telefone, e ao mesmo tempo usa linguagem de área de atendimento ("Oftalmologista em Paragominas e Belém", "atende em Belém em duas unidades"). Não há embed de mapa interativo (iframe), só links estáticos para o Google Maps.

**Vertical: saúde (healthcare).** Sinais claros: CRM-PA 15253 visível 166 vezes, menção a convênios, agendamento de consulta, schema Physician e MedicalClinic (não o genérico LocalBusiness). Os subtipos de schema usados estão corretos para a vertical.

## Auditoria de consistência de NAP

### Fontes internas (schema JSON-LD e HTML renderizado)

| Fonte | Nome/entidade | Endereço | Telefone |
|---|---|---|---|
| Schema Physician (repetido em todas as páginas) | Dr. Juliano Machado | Rua Eixo W1, R. Célio Miranda, N° 729, Paragominas/PA | +5591936180476 |
| Schema MedicalClinic "Clinicor" | Clinicor | mesmo endereço acima | +5591936180476 |
| Schema MedicalClinic "Hospital Geral de Paragominas" | Hospital Geral de Paragominas | R. Santa Terezinha, 304, Centro, Paragominas/PA | +559191000303 |
| Schema MedicalClinic "Instituto de Olhos de Belém" | Instituto de Olhos de Belém | Av. Generalíssimo Deodoro, 904, Nazaré, Belém/PA | +559132394600 |
| Schema MedicalClinic "Vitria, Ed. Síntese 21" | Vitria, Ed. Síntese 21 | Av. Conselheiro Furtado, 2865, Sobreloja, salas 08-10, São Braz, Belém/PA | +559133421463 |
| HTML visível /paragominas | Clinicor e HGP | bate com o schema (grafia "729" sem "N°", cosmético) | nenhum tel: visível, só WhatsApp |
| HTML visível /belem | IOB e Vitria | bate com o schema | tel:+559132394600 e tel:+559133421463, batem com o schema |
| HTML visível /home, atributo tel: | Clinicor | Rua Eixo W1, 729, Paragominas/PA | tel:91936180476, mesmo número mas sem "+55" |
| WhatsApp (wa.me, 136 ocorrências no site) | número único sitewide | não aplicável | 5591936180476, bate com o schema |

**Achado [Low].** O href `tel:91936180476` da home não segue o formato E.164 usado no schema e no WhatsApp (`+5591936180476`). É o mesmo número, só falta o "+55" e a formatação visual "(91) 93618-0476" que aparece no rodapé. Não é uma divergência de NAP, é inconsistência de formatação. Correção: padronizar todos os `tel:` para `+5591936180476`.

**Confirmado, sem achado.** Não há nenhuma ocorrência de número com DDD 19 (Campinas) em nenhuma página do site novo, nem em `tel:`, nem em `wa.me`, nem no schema. O resíduo do site antigo drjulianosmachado.com.br não vazou para drjulianomachado.com. Da mesma forma, "Mais de 15 anos" é consistente em todo o site (166 menções de CRM-PA 15253 e nenhum resíduo de "11 anos").

**Confirmado, sem achado.** O domínio antigo `drjulianosmachado.com.br` responde HTTP 301 para `https://drjulianomachado.com/` neste momento (testado agora). O redirecionamento configurado na migração de Search Console está ativo e funcionando.

### Fontes externas

| Fonte | Resultado |
|---|---|
| Google Business Profile (CID `16599594730260861753`, referenciado em `sameAs` em todas as páginas) | **Não verificado.** O link é consistente em 100% das páginas, o que é positivo, mas o conteúdo do perfil (nome exibido, categoria, endereço, telefone, fotos, posts) não pôde ser lido porque o Google Maps é renderizado via JavaScript e bloqueia scraping direto. |
| Doctoralia | **Não verificado.** A URL testada (`doctoralia.com.br/juliano-machado/oftalmologista/paragominas`) devolveu o perfil de um homônimo, um ortopedista de Pernambuco, CRM-PE 15979, RQE 1538. Isso não é uma divergência do Dr. Juliano Machado oftalmologista, é apenas prova de que a URL testada é a errada. É preciso localizar manualmente se existe um perfil correto (com CRM-PA 15253) ou criar um novo. |
| AgendarConsulta.com | **Não verificado.** A URL testada caiu em uma página de busca vazia ("Nenhum profissional encontrado"). Isso não confirma nem descarta a existência de um perfil ativo. Dado o histórico relatado de vazamento do telefone com DDD 19 para esta plataforma, este é o diretório de maior prioridade para checagem manual e correção. |
| CRM-PA (Conselho Regional de Medicina do Pará) | **Não verificado.** Não foi possível consultar o registro público do CRM 15253 nesta sessão. |
| Instagram @drjulianomachado.oftalmo | Link consistente no schema e no rodapé do site. **Não verificado** o conteúdo do perfil (bio, categoria, endereço), a página carrega via JavaScript e não expôs texto ao fetch. |
| Facebook | Nenhum link para página do Facebook foi encontrado no HTML do site. Um ícone com texto alternativo "WhatsApp/Facebook" existe no footer, mas aponta só para o WhatsApp. Não há perfil vinculado. |

## As páginas de cidade sustentam ranqueamento local

**Sobreposição de texto entre /paragominas e /belem (medida programaticamente, conteúdo principal, sem cabeçalho/rodapé):**
- Similaridade de caracteres (difflib): 19,6%. Com nomes de cidade e clínica mascarados, cai para 10,7%, ou seja, a maior parte da semelhança bruta é só repetição de nomes próprios, não de texto real.
- Sobreposição de vocabulário (Jaccard, palavras únicas): 32,8%, esperado, já que as duas páginas falam do mesmo médico e dos mesmos 5 procedimentos.
- Um bloco de 54 palavras consecutivas é idêntico, palavra por palavra, nas duas páginas (a lista "Glaucoma, Cirurgia de catarata, Cirurgia de pterígio, Capsulotomia YAG laser, Consulta oftalmológica" com as mesmas descrições). Isso equivale a cerca de 10% do corpo de texto de /paragominas.
- Fora esse bloco compartilhado, as páginas não passam no teste de "doorway page": os H1, o FAQ (perguntas totalmente diferentes em cada cidade) e vários módulos de confiança são exclusivos de cada página. O problema real não é duplicação, é assimetria de profundidade.

**Achado [High].** /belem é a página de cidade mais completa. /paragominas é mais rasa em prova social apesar de ser, aparentemente, a base de operação do médico (é o endereço usado no schema Physician e no priceRange). Módulos presentes só em /paragominas e ausentes em /belem, /home e nas demais páginas: selo "Google 5.0 · 14", seção "Palavra dos pacientes, O que dizem no Google", estatística "Mais de 15 anos", bloco de associações profissionais e um demo interativo de acuidade visual. Isso deixa /belem sem qualquer prova social de avaliações na própria página.

**Achado [Critical], reportado pelo coordenador e incorporado aqui.** A rota `/paragominas/agendamento` existe no app mas devolve a home inteira (147.248 bytes) com canonical apontando para `/`, e não está no sitemap. Ou seja, existe a intenção de um funil de agendamento dedicado a Paragominas que nenhum crawler nem usuário que chegue direto por essa URL consegue ver de fato. Não existe equivalente quebrado em Belém. Como "página de serviço dedicada" é citado no briefing como o fator número 1 de ranqueamento orgânico local e número 2 de visibilidade em buscas de IA, esse é o achado mais grave desta auditoria.

**Achado [Critical], reportado pelo coordenador e incorporado aqui.** O menu de navegação global tem quatro destinos, /sobre, /procedimentos/glaucoma, /belem e /agendamento. **/paragominas não está no menu.** Resultado medido, /belem recebe 16 links internos, /paragominas recebe 2. Isso sufoca o sinal de relevância interna justamente da cidade que é a base cadastral do médico.

**Achado [High].** H1 de /paragominas é "Sua visão,com mais clareza." (sem espaço depois da vírgula, sem o nome da cidade). H1 de /belem é "Oftalmologista em Belém" (correto, com a cidade). Já registrado em on-page-seo.md, repetido aqui pelo impacto direto em ranqueamento local por cidade.

**Achado [High].** Nenhuma das duas páginas mostra horário de funcionamento em texto visível. "Ver horários disponíveis" se refere aos horários de agendamento, não ao expediente das clínicas. Sem openingHoursSpecification no schema (ver seção de schema abaixo), não há sinal de horário nem para usuário nem para o Google.

**Achado [Medium].** /paragominas não tem nenhum link `tel:`, só WhatsApp, para Clinicor e para o Hospital Geral de Paragominas. /belem já oferece `tel:` clicável para as duas unidades. Pacientes que preferem ligar direto ficam sem essa opção na página de Paragominas.

**Achado [Low].** Provas locais de bairro aparecem em Belém (Nazaré, São Braz) mas não em Paragominas (só "Centro" no endereço do HGP, sem bairro na Clinicor). A seção "Convênios" existe como âncora de menu nas duas páginas de cidade, mas o texto extraído não mostra nomes de planos de saúde aceitos de forma visível no corpo do texto. Não verificado se a lista completa de convênios está em algum ponto da página não capturado nesta extração, recomenda-se checagem manual direta no navegador.

## Sinais de GBP visíveis no site

| Sinal | Paragominas | Belém | Home |
|---|---|---|---|
| Link/CID do Google Maps no schema (`sameAs`) | Sim | Sim | Sim |
| Link estático "Ver rota/Como chegar" para o Maps | Sim (2x) | Sim (2x) | Sim (1x) |
| Embed de mapa interativo (iframe) | Não | Não | Não |
| Selo de nota e contagem de avaliações ("Google 5.0 · 14") | Sim | Não | Não |
| Seção de depoimentos/avaliações | Sim, mas mostra "Avaliações carregando..." no HTML renderizado capturado, não verificado se os cards reais chegam a aparecer para crawlers | Não existe | Não existe |
| Clique para ligar (tel:) | Não | Sim, nas duas unidades | Sim, 1 número |
| Clique para WhatsApp | Sim | Sim | Sim |
| aggregateRating autodeclarado no schema | Não existe (removido em auditoria anterior, correto) | Não existe | Não existe |

## Avaliações, o que dá para ver

- Nota exibida: 5.0. Contagem exibida: 14 avaliações. Fonte: selo na página /paragominas, texto "Google 5.0 · 14" e "5.0 · 14 avaliações".
- **Não verificado**: recência das avaliações, velocidade (a regra dos 18 dias citada no briefing não pode ser checada sem acesso à API do Google Business Profile), taxa e conteúdo das respostas do médico, se existe um único perfil de GBP cobrindo as duas cidades ou perfis separados por clínica.
- O placeholder "Avaliações carregando..." presente no HTML renderizado sugere que os cards de avaliação individuais são buscados via chamada assíncrona à parte. Recomenda-se confirmar manualmente, com o site aberto no navegador, se esse conteúdo realmente aparece, porque se depender de uma chamada que só completa depois do tempo de captura do crawler, o rich snippet de prova social pode nunca ser visto por bots.
- Volume de 14 avaliações é baixo para uma prática de mais de 15 anos em duas cidades.

## Validação de schema local

- Subtipo correto: `Physician` e `MedicalClinic` são usados, não o genérico `LocalBusiness`, alinhado com a vertical de saúde.
- Quatro entidades `MedicalClinic` distintas, uma por unidade física, cada uma com nome, endereço, telefone e areaServed próprios. Não há repetição do mesmo endereço nas quatro, o NAP de cada clínica é de fato único.
- O nó `Physician`, repetido de forma idêntica em todas as páginas do site (home, /paragominas, /belem, /agendamento, /sobre), sempre usa o endereço de Paragominas (Clinicor) como endereço único do médico, mesmo na página /belem. Isso é aceitável (uma pessoa física tem um endereço principal), mas significa que o nó Physician da página de Belém não reflete a cidade da própria página, só as entidades MedicalClinic ao lado fazem esse papel.
- `areaServed` no nível do Physician lista as duas cidades corretamente. `areaServed` em cada MedicalClinic aponta só para a própria cidade, sem contaminação cruzada.
- `hasMap` usa link de busca do tipo `maps.google.com/?q=...` em vez de um Place ID ou coordenada, funciona mas é menos preciso.
- **Achado [High].** Nenhuma das quatro entidades `MedicalClinic` tem a propriedade `geo` (latitude/longitude). Zero ocorrências confirmadas nos quatro blocos de schema.
- **Achado [High].** Nenhuma das quatro `MedicalClinic` tem `openingHoursSpecification`. Zero ocorrências confirmadas.
- Sem `aggregateRating` autodeclarado, correto e alinhado com as diretrizes do Google, essa era uma falha da auditoria anterior e foi corrigida.

## Citações locais brasileiras recomendadas, priorizadas

1. **Google Business Profile**, business.google.com. Crítico. Confirmar se existe um único perfil cobrindo as duas cidades ou se é preciso um perfil por endereço, revisar a categoria primária (deve ser "Oftalmologista", categoria errada é apontada no briefing como o principal fator negativo de ranqueamento local).
2. **Doctoralia**, doctoralia.com.br/novo-medico. Alto tráfego de busca de pacientes no Brasil. Localizar ou criar o perfil correto, com CRM-PA 15253, e não confundir com o homônimo ortopedista de Pernambuco encontrado nesta auditoria.
3. **AgendarConsulta.com**, cadastro pelo site da plataforma. Prioridade alta pelo histórico de telefone errado (DDD 19) associado a esse diretório. Verificar e corrigir com urgência.
4. **CRM-PA / Conselho Regional de Medicina do Pará**, cremepa.org.br. Confirmar que a busca pública do CRM 15253 mostra nome e dados corretos.
5. **Sociedade Brasileira de Oftalmologia (SBO)**, sboportal.org.br. Já citada como `memberOf` no schema, confirmar se existe listagem pública de associado com link para o site novo.
6. **Sociedade Brasileira de Glaucoma**, sbglaucoma.org.br. Mesma lógica da SBO.
7. **Bing Places for Business**, bingplaces.com. Baixo esforço, cobre Bing e Copilot.
8. **Apple Business Connect**, businessconnect.apple.com. Cobre Apple Maps e Siri.
9. **Facebook Page**, business.facebook.com. Não existe hoje nenhum link para Facebook no site, oportunidade de criar mais uma fonte pública de NAP consistente.
10. **Diretórios genéricos brasileiros** (GuiaMais, Telelistas, Apontador). Esforço baixo, valor baixo a médio, mas somam à densidade geral de citações, um dos fatores de visibilidade em IA citados no briefing.

## Top 10 ações prioritizadas

**Critical**
1. Corrigir a rota `/paragominas/agendamento`, hoje devolve a home inteira com canonical para `/` e fica fora do sitemap. Restaurar o funil de agendamento dedicado a Paragominas.
2. Incluir `/paragominas` no menu de navegação principal. Hoje recebe 2 links internos contra 16 de `/belem`, mesmo sendo o endereço de registro do médico no schema.

**High**
3. Corrigir o H1 de `/paragominas` para incluir o nome da cidade e o espaço após a vírgula, no padrão do H1 de `/belem`.
4. Levar a prova social (selo "Google 5.0 · 14" e a seção de avaliações) para `/belem`, para a home e para as demais páginas. Confirmar antes se os cards de avaliação realmente renderizam, hoje o HTML capturado mostra só o placeholder "Avaliações carregando...".
5. Adicionar `geo` (latitude e longitude, 5 casas decimais) às quatro entidades `MedicalClinic` do schema.
6. Adicionar `openingHoursSpecification` às quatro entidades `MedicalClinic` e exibir o horário de funcionamento em texto visível nas páginas de cidade.

**Medium**
7. Adicionar link `tel:` clicável em `/paragominas` para Clinicor e para o Hospital Geral de Paragominas, hoje só existe WhatsApp nessa página.
8. Verificar manualmente e, se necessário, corrigir ou reivindicar os perfis em Doctoralia e AgendarConsulta.com. Nenhum dos dois pôde ser confirmado por busca automatizada nesta auditoria, e o histórico de vazamento do DDD 19 torna o AgendarConsulta prioritário.
9. Cadastrar o consultório nas citações Tier 1 listadas acima, começando por Google Business Profile, Doctoralia e CRM-PA.

**Low**
10. Padronizar o atributo `tel:` da home para o formato E.164 completo (`+5591936180476`), hoje aparece sem o "+55". Confirmar visualmente se a seção "Convênios" mostra os nomes dos planos aceitos, hoje o texto extraído só encontra a âncora de menu.

## Limitações, o que não deu para verificar

- Conteúdo real do Google Business Profile (nome exibido, categoria primária, fotos, posts, perguntas e respostas), o Google Maps é renderizado via JavaScript e não expôs esses dados ao fetch usado nesta auditoria.
- Se existe um único GBP cobrindo as duas cidades ou GBPs separados por clínica.
- Recência e velocidade das avaliações (a regra dos 18 dias citada no briefing), taxa e conteúdo das respostas do médico às avaliações.
- Perfis em Doctoralia e AgendarConsulta.com, as URLs testadas não confirmaram nem descartaram a existência de um perfil correto.
- Registro público no CRM-PA (cremepa.org.br).
- Conteúdo do perfil do Instagram (bio, categoria, endereço declarado).
- Backlinks e autoridade de domínio, exigem ferramenta paga não configurada nesta sessão.
- Proximidade geográfica do buscador, responde por 55,2% da variação de ranqueamento local segundo o estudo citado no briefing, e está fora do controle do site.
