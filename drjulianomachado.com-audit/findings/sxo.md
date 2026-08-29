# SXO, Search Experience Optimization, drjulianomachado.com

Data da análise, 28/08/2026. Objetivo de negócio, agendamento de consulta.

Nota, SXO Gap Score, 58 de 100. Esta nota é separada do Health Score de SEO técnico (82) e do que estiver em outros arquivos desta auditoria. Ela mede a distância entre o que a SERP recompensa mais a fricção real até marcar consulta, não a saúde técnica do site.

Método usado, leitura do código fonte real das páginas (React, em src/pages e src/components) e do dataset já extraído em paginas.json, mais WebSearch para as 5 consultas pedidas. Não usei render_page.py porque o coordenador já tinha as 18 páginas extraídas em disco e pediu para não baixar de novo, e o código fonte dá mais precisão que HTML renderizado para julgar formulário, rota e dado ausente na tela.

## Achado principal, o município sede do consultório é o mais invisível internamente

Paragominas é onde o Dr. Juliano atende e é a primeira cidade no H1 da home ("Oftalmologista em Paragominas e Belém"). Mesmo assim, `/paragominas` não está no menu de navegação (o menu global tem só Sobre, Procedimentos, Glaucoma, YAG Laser, Depoimentos, Locais, Belém, Convênios, mais o CTA de agendar) e recebe apenas 2 links internos no site inteiro. `/belem`, criada depois (ver comentário no próprio código de `src/pages/Belem.tsx`, linha 21 a 30, "Belem nao tinha pagina, nem mapa, nem botao de direcao"), está no menu e recebe 16 links internos. Isso inverte a prioridade real do negócio, a cidade sede fica mais difícil de achar dentro do próprio site do que a cidade satélite.

Consequência direta na SERP, busquei "oftalmologista Paragominas" no Google (WebSearch) e quem aparece pelo site não é `/paragominas`, é a home genérica. A SERP para esse termo é dominada por perfis de diretório, BoaConsulta (2 resultados), Doctoralia, CatalogoMed, MedicosBrasil e AgendarConsulta, ou seja, 5 dos 9 resultados vistos são diretórios. A home aparece uma vez. Não vi nenhuma clínica com site próprio concorrendo aqui além do alvo. Isso é bom sinal de espaço aberto, mas a página mais bem equipada para competir (a de conteúdo local dedicado) é a que o próprio site esconde.

## Descompasso de tipo de página por consulta

- **"oftalmologista Paragominas"**, tipo dominante, perfil de diretório (Doctoralia, BoaConsulta, CatalogoMed, MedicosBrasil, AgendarConsulta). O site aparece via home, não via `/paragominas`. Severidade, Alto. Ação de arquitetura interna importa mais aqui do que conteúdo novo.
- **"oftalmologista Belém"**, busquei "oftalmologista Belém PA", tipo dominante misto, metade site próprio de clínica estabelecida (Visual Laser "quase 30 anos", Clínica Olhar Belém, Dr. Lauro Barata, Rede Mais Saúde), metade diretório (MedicosBrasil, CatalogoMed, medguias). `/belem` não apareceu nos resultados que vi. O tipo de página está certo (é exatamente uma página de clínica local), o problema aparenta ser autoridade e histórico, não formato, a página foi criada há pouco tempo contra concorrentes de décadas. Severidade, Alto, mas recomendo cruzar com `/seo local` antes de agir, não verifiquei pacote local nem mapa do Google, o WebSearch usado não mostra isso.
- **"consulta oftalmológica Belém"**, dominado por site próprio de clínica (Clínica Queiroz, VidaMed, Cornea Clinic, Rede Mais Saúde, Visual Laser, Clínica Flávia e Jorge Hage) mais Doctoralia. Um resultado, Cornea Clinic, mostra preço direto no snippet, "consulta completa... custa R$300,00". Tipo de página do site está alinhado (`/belem` e `/procedimentos/consulta-oftalmologica` são páginas de clínica), mas falta o sinal de preço que a concorrência já expõe. Severidade, Médio.
- **"tratamento de glaucoma Belém"**, mistura de conteúdo institucional informativo (Unimed, "como tratar glaucoma"), diretório filtrado por especialista (CatalogoMed) e páginas de serviço dedicadas (Clínica Foco, clínica que existe só para glaucoma, e a página "Consulta Especializada em Glaucoma" da Clínica Queiroz). `/procedimentos/glaucoma` é exatamente esse formato e o Dr. Juliano tem fellowship em glaucoma, uma credencial que a concorrência local usa como diferencial de marca inteira. Aqui o tipo de página está **alinhado**. O gap provável é autoridade e não formato.
- **"cirurgia de catarata Paragominas"**, não consegui verificar de forma confiável, o WebSearch devolveu só páginas genéricas de hospitais de outras cidades (São Paulo, Rio, Goiânia), sem nenhum resultado com recorte local de Paragominas. Não invento posição aqui, ficou sem verificação de fato.

## Personas, onde cada uma trava

### Persona A, idoso com catarata, busca feita por um filho, baixa tolerância a fricção, quer telefone e endereço

- `Footer.tsx` não tem nenhum telefone, nenhum `tel:` (grep vazio no arquivo inteiro).
- `/paragominas` também não tem nenhum telefone visível na tela (grep vazio em `src/pages/Paragominas.tsx`), apesar de os números existirem no código de dados (`src/lib/locations.ts` linhas 43 e 57, Clinicor "(91) 93618-0476" e Hospital Geral de Paragominas "(91) 9100-0303"), só que só entram no JSON-LD (`telephone` do schema `MedicalClinic`), não em um link clicável na página. Um filho que quer ligar direto para a Clinicor ou para o HGP não acha esse número em lugar nenhum navegável, mesmo estando na cidade sede.
- `/belem` já resolve isso corretamente, tem `tel:` clicável e botão "Como chegar" (Google Maps) por unidade (`src/pages/Belem.tsx` linhas 156 a 171). É o padrão certo, só falta replicar em Paragominas.
- O CTA principal da home e da landing de Paragominas se chama "Ver horários disponíveis" (`HeroSection.tsx` linha 97, `Paragominas.tsx` linha 384), mas ele não mostra horário nenhum de cara. Ele abre um formulário de 4 passos (`Agendamento.tsx`, `totalSteps = 4`), nome completo, WhatsApp e **data de nascimento obrigatória** no passo 1 (`PersonalDataStep.tsx` linhas 136 a 154), tipo de atendimento, local e convênio no passo 2, e só no passo 3 aparece data e hora. Para alguém com baixa paciência, o botão promete algo que só entrega depois de duas telas preenchidas.
- Rota alternativa mais curta e que já existe, "Falar no WhatsApp" no hero (2 cliques a partir da SERP, clique na home mais clique no WhatsApp) leva direto a uma pessoa, sem formulário. Recomendo tratar essa rota como a primária para esta persona, não a secundária.
- Achado extra relevante aqui, o link de agendamento usado nos CTAs de `/paragominas` aponta para `/paragominas/agendamento` (`Paragominas.tsx` linha 157, `PGM_BOOKING`), uma rota real do app (`src/App.tsx` linha 137). Segundo apuração já feita pelo coordenador, o servidor devolve para essa URL o HTML inteiro da home, byte a byte, com canonical apontando para `/`, e a rota não está no sitemap. Para um navegador comum com JS isso não trava nada, o React troca a tela certinho. O problema aparece em quem não roda JS, se o filho copiar e colar esse link no WhatsApp para mandar para a mãe ou para outro parente, o preview que abre no WhatsApp mostra a home genérica, não "agende sua consulta em Paragominas", exatamente no momento em que a confiança do link importa mais.

### Persona B, adulto de consulta de rotina, compara preço e convênio antes de decidir

- Não existe menção de preço em nenhuma página verificada, grep por "R$", "preço" e "valor" em `Paragominas.tsx` não retornou nada, e o mesmo vale para `Belem.tsx` (lido por completo). A concorrência direta em Belém já publica preço na própria SERP (Cornea Clinic, R$300,00 no snippet do Google). Essa persona compara sem precisar clicar em nada no concorrente, e precisa de pelo menos uma conversa por WhatsApp para descobrir o mesmo dado no site do Dr. Juliano.
- A lista de convênios aceitos só existe dentro do passo 2 do formulário de agendamento (`ConsultationDetailsStep.tsx`, carregada via `listarConvenios()`), não existe como conteúdo estático em nenhuma página pública. Isso tem dois efeitos, a pessoa não consegue comparar convênio sem começar o formulário, e o Google não consegue indexar nem citar essa lista, então o site não compete por buscas do tipo "oftalmologista [nome do convênio] Belém".
- Em `/belem`, o único CTA de agendamento da página inteira fica no bloco final, depois de intro, unidades, motivos de consulta, FAQ e área de atuação (`Belem.tsx` linhas 216 a 230). Não há CTA logo no topo da página, só o cabeçalho fixo do site resolve isso parcialmente com o botão "Agendar" sempre visível.
- Caminho até descobrir se o convênio é aceito, SERP, clique 1 até `/belem` (se rankear, não confirmado), rolagem até o fim, clique 2 em "Agendar consulta", passo 1 do formulário, só no passo 2 (clique 3) aparece a lista de convênios. Preço nunca aparece.

### Persona C, paciente encaminhado por outro médico, busca o nome do doutor para se confirmar

- Esta é a persona mais bem atendida das três. CRM-PA 15253 aparece no header (`Header.tsx` linha 92), na hero da home e da landing de Paragominas, e no rodapé de cada página de procedimento junto com a data de revisão clínica.
- `/sobre` está presente no menu em toda página (inclusive mobile) e traz residência no Hospital Federal de Bonsucesso e fellowship em Glaucoma pela Unidade Paulista de Oftalmologia, com 369 palavras, isso é exatamente o que essa persona procura para se assegurar.
- Nota do Google e contagem de avaliações aparecem na hero da home (`HeroSection.tsx` linhas 119 a 123) e em chip separado no desktop.
- Não identifiquei fricção relevante aqui. Único ponto menor, não há uma página ou seção que liste hospitais e convênios de forma consolidada para reforçar a validação profissional, mas isso é um "nice to have", não um bloqueio.

## Contagem de cliques até consulta marcada, por persona

- **Persona A, caminho do formulário**, 1 clique de saída da SERP até a home, mais 1 clique no CTA, mais 2 passos de formulário até ver horário (nome, telefone e data de nascimento no passo 1, tipo e convênio no passo 2), mais 2 passos para concluir (data/hora e confirmação). Total, 6 interações antes de reservar de fato.
- **Persona A, caminho WhatsApp**, 1 clique de saída da SERP até a home, mais 1 clique em "Falar no WhatsApp". Total, 2 cliques até falar com uma pessoa. Esse é o caminho que deveria ser o CTA primário para esta persona.
- **Persona B**, 1 clique de saída da SERP (se `/belem` rankear), rolagem completa da página, 1 clique em "Agendar consulta" no rodapé da página, 1 passo de formulário para enxergar convênio. Preço, nunca, precisa de contato direto.
- **Persona C**, 1 clique de saída da SERP até home ou `/sobre`, confiança já visível sem cliques extra.

## User stories derivadas de sinal real da SERP

1. "Como filho de paciente idoso, quero achar um telefone que eu possa discar direto na página da cidade onde meu pai mora, sem preencher formulário", sinal, `/belem` já tem `tel:` clicável por unidade e `/paragominas` não tem nenhum, apesar dos números existirem no código. Mudança concreta, replicar o bloco de telefone e "Como chegar" do `Belem.tsx` (linhas 156 a 171) dentro da seção "Onde atendo" de `Paragominas.tsx` (linha 739 em diante).
2. "Como paciente que compara preço antes de agendar, quero ver se meu convênio é aceito sem começar um formulário", sinal, concorrente direto (Cornea Clinic) expõe preço na própria SERP para "consulta oftalmológica Belém". Mudança concreta, publicar a lista de convênios aceitos como conteúdo estático e indexável em `/belem`, `/paragominas` e `/procedimentos/consulta-oftalmologica`, hoje ela só existe dentro do passo 2 do formulário.
3. "Como pessoa que busca 'oftalmologista Paragominas', quero cair numa página que fale só da minha cidade, não numa home genérica que também fala de Belém", sinal, SERP para esse termo é dominada por diretórios locais, a página que mais compete com eles em foco geográfico é `/paragominas`, que hoje não está no menu e recebe 2 links internos. Mudança concreta, colocar "Paragominas" no menu de navegação junto com "Belém" e linkar `/paragominas` a partir da home e do rodapé.
4. "Como quem recebe o link de agendamento pelo WhatsApp de um familiar, quero que o preview mostre 'agende em Paragominas', não a home genérica", sinal, `/paragominas/agendamento` devolve HTML idêntico ao da home com canonical para `/`, apurado pelo coordenador. Mudança concreta, essa rota precisa ter seu próprio HTML pré-renderizado com title, description e og, e entrar no sitemap.
5. "Como paciente que já tem indicação de glaucoma, quero achar uma página que fale só disso e mostre que o médico é especialista no assunto", sinal, a SERP de "tratamento de glaucoma Belém" é dominada por clínicas que existem em torno dessa especialidade (Clínica Foco) ou têm página dedicada (Clínica Queiroz), e o Dr. Juliano tem fellowship em glaucoma. Este já está bem resolvido em `/procedimentos/glaucoma`, story incluída para registrar o que já funciona, não para pedir mudança.

## Intenção de busca vs as 11 páginas de procedimento

O molde usado em todas (`ProcedurePageLayout.tsx`) é híbrido, informativo mais transacional, hero com CTA duplo, barra lateral fixa com CTA durante toda a rolagem, e CTA final. Esse formato bate com o que apareceu na SERP para os procedimentos cirúrgicos e de tratamento contínuo verificados (glaucoma, e o padrão genérico visto para cirurgia de catarata em outras cidades, que também são páginas de clínica, não artigos de blog nem diretórios). Isso é um ponto forte real do site, vale reconhecer.

Ressalva sem verificação direta (não testei essas 5 consultas no WebSearch, fora do escopo pedido), os 6 exames diagnósticos da lista (tonometria, gonioscopia, retinografia, biometria ultrassônica, mapeamento de retina, iridotomia a laser) tendem a ser buscados de forma mais informativa que decisória, "o que é", "dói", "precisa de preparo", e o mesmo molde de 3 CTAs de agendamento empilhados pode estar sobrecarregando páginas que uma pessoa está lendo só para entender o exame antes mesmo de ter indicação médica. Não afirmo isso como fato de ranking, é uma hipótese de UX a testar.

Achado de arquitetura à parte, o breadcrumb de cada página de procedimento (`ProcedurePageLayout.tsx` linha 72) aponta "Procedimentos" para `/#procedimentos`, uma âncora da home, não para a página real `/procedimentos`. Isso ajuda a explicar por que `/procedimentos` recebe só 1 link interno no site inteiro, mesmo sendo o índice das 11 páginas filhas.

## Limitações

- Não usei render_page.py nesta rodada, o coordenador já tinha as 18 páginas extraídas em disco e pediu para não baixar de novo. Usei o código fonte React (mais preciso para formulário, rota e dado ausente na tela) e o paginas.json já existente.
- WebSearch não simula pacote local nem mapa do Google, não vi nem confirmei posição de ranking real, nem presença ou ausência no Local Pack, para nenhuma das 5 consultas. O que reportei é só a composição dos resultados orgânicos que o WebSearch retornou.
- Não verifiquei "cirurgia de catarata Paragominas" de forma útil, os resultados vieram sem recorte local nenhum.
- Não testei consultas para os 6 exames diagnósticos nem para busca de marca ("Dr. Juliano Machado"), a hipótese sobre a persona C e sobre os exames é inferência do conteúdo do site, não leitura de SERP real.
- Não testei o formulário de agendamento em ambiente real (não cliquei nos 4 passos), a análise de fricção vem da leitura do código de validação e da UI, não de um teste de usuário ao vivo.
- Intenção local presente na SERP de Belém sugere valor em `/seo local` (Google Business Profile), recomendo essa análise como próximo passo antes de investir em mais conteúdo em `/belem`.

Recomenda-se gerar um relatório em PDF com `/seo google report`, se fizer sentido consolidar este achado com os das outras categorias já auditadas (technical-seo.md, content-quality.md, schema.md, performance.md, ai-search-readiness.md, images.md, on-page-seo.md).
