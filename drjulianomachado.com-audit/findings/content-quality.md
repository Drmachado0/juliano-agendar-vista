# Content Quality e E-E-A-T (QRG set/2025) - nota 65/100

Auditoria das 18 rotas com HTML completo (SSG ativo desde 28/08/2026). Metodologia: extracao de texto visivel de cada pagina, remocao de cabecalho/rodape comuns, comparacao par a par por shingles de 5 palavras para medir sobreposicao real.

## Resumo executivo

O site tem uma base tecnica de E-E-A-T solida (CRM visivel, formacao detalhada, revisao medica datada, LGPD completa), mas contem dois elementos de conteudo que sao riscos concretos de conformidade com a Resolucao CFM 1.974/2011 e o Codigo de Etica Medica: uma secao de imagens de "antes e depois" de um caso clinico real na home, e depoimentos de pacientes com nome completo reproduzidos no funil de agendamento. Para um site medico (YMYL), isso pesa mais do que qualquer metrica de palavras ou legibilidade, e por isso a nota geral fica abaixo do que a qualidade editorial isolada sugeriria.

## E-E-A-T detalhado

| Fator | Peso | Nota | Evidencia |
|---|---|---|---|
| Experience | 20% | 85 | "Mais de 15 anos de experiencia", "6.000+ pacientes atendidos" (agendamento.html), descricao em primeira pessoa do metodo ("Escutar, Examinar, Explicar" em paragominas.html), 4 enderecos fisicos reais com telefone proprio cada. |
| Expertise | 25% | 88 | /sobre lista formacao com datas e carga horaria: "Fellowship em Glaucoma, Unidade Paulista de Oftalmologia (UPO), 1.980 horas", "Glaucoma Clinico e Cirurgico, UNIFESP, 360 horas", residencia no Hospital Federal de Bonsucesso, graduacao no CESUPA. Cada pagina de procedimento fecha com "Conteudo revisado por Dr. Juliano Machado, CRM-PA 15253, em 26 de agosto de 2026." e o JSON-LD carrega reviewedBy como Physician com identifier de CRM. Falta apenas o numero de RQE (Registro de Qualificacao de Especialista), que nao aparece em nenhuma pagina. |
| Authoritativeness | 25% | 60 | Afiliacoes a Sociedade Brasileira de Oftalmologia e Sociedade Brasileira de Glaucoma sao citadas, mas sem link, ano de filiacao ou credencial verificavel. Prova social e apenas 14 avaliacoes no Google (5.0). Nao ha citacao externa, artigo publicado, palestra ou mencao de imprensa. |
| Trustworthiness | 30% | 40 | Enderecos, telefone e politica de privacidade LGPD completa (controlador, bases legais, direitos do titular, canal para exercicio) pesam a favor. Contra: duas praticas de publicidade restritas pela Resolucao CFM 1.974/2011 (ver Critical abaixo) e um erro de dado factual entre paginas (ver High). |

Nota ponderada: 0,20x85 + 0,25x88 + 0,25x60 + 0,30x40 = 66, arredondado para 65 considerando a severidade regulatoria dos achados Critical.

## Achados

### [Critical] Imagens de "antes e depois" de caso clinico real na home

A home (home.html) tem uma secao com titulo "Antes e depois" que mostra duas fotos do mesmo olho com legendas clinicas: "Antes: Opacidade da capsula posterior, Visao embacada" e "Depois: Abertura central apos o YAG laser, Visao mais nitida", seguida do texto "A capsulotomia YAG laser remove a opacidade da capsula posterior e melhora a qualidade da visao. Imagens de um caso real, o resultado varia de paciente para paciente."

Isso e exatamente o formato que a Resolucao CFM 1.974/2011 (Manual de Publicidade Medica) e o Codigo de Etica Medica (art. 112, vedacao a publicidade que configure autopromocao, sensacionalismo ou garantia de resultado) tratam como restrito: comparacao visual de resultado de procedimento em peca de publicidade medica. O aviso "o resultado varia de paciente para paciente" reduz a leitura de garantia de resultado, mas nao descaracteriza a natureza comparativa da peca, que e o elemento vedado, independente da ressalva. O contexto (site institucional do proprio medico, secao com CTA "Saiba mais" logo abaixo, no meio do funil de conversao) reforca o carater publicitario, nao o atenua.

Recomendacao: remover a secao ou substituir por explicacao apenas textual/didatica do procedimento (o que e a capsula posterior, por que ela opacifica, como o laser age), sem par de fotos do mesmo paciente. Se a equipe juridica avaliar que o formato pode ficar, o parecer deve vir de advogado especializado em direito medico, nao desta auditoria de conteudo.

### [Critical] Depoimentos de pacientes com nome completo no funil de agendamento

/agendamento reproduz tres avaliacoes do Google com nome completo da pessoa:

"Um otimo atendimento, e dr Juliano um grande profissional. Levei meu filho para fazer o teste do olhinho e o dr. foi muito atencioso, cauteloso e muito cuidadoso no atendimento do meu pequeno." (Fernanda Cruz, Avaliacao verificada, Google)

"Atendimento muito bom, profissional excelente, muito prestativo, atencioso, humano, super indico, fala muita clara." (Jessica Oliveira da Costa, Avaliacao verificada, Google)

"Atendimento excelente, medico atencioso e equipe muito profissional. Recomendo demais!" (Gislene Alves da Silva, Avaliacao verificada, Google)

A mesma citacao de Jessica Oliveira da Costa e repetida mais uma vez, mais abaixo na mesma pagina, na secao "Por que escolher o Dr. Juliano?". Depoimento de paciente usado como peca de autopromocao e uma das praticas classicamente vedadas pela normativa de publicidade medica do CFM, mesmo quando a fonte e uma plataforma de terceiros como o Google. O fato de estarem dentro do formulario de agendamento (o ponto de conversao) e o que mais pesa aqui, pois nao e um simples link para "veja no Google", e sim conteudo curado e reproduzido pelo proprio site para induzir a marcacao.

Recomendacao: trocar a citacao integral por link/selo de nota agregada do Google ("5.0, 14 avaliacoes, ver no Google"), sem texto do depoimento nem nome do paciente reproduzido na pagina.

### [High] Erro de dado: "Instituto de Olhos da Bahia" na Politica de Privacidade

politica-de-privacidade.html, secao 1 (Controlador dos dados), diz: "Enderecos de atendimento: Paragominas/PA (Clinicor e Hospital Geral) e Belem/PA (Instituto de Olhos da Bahia e Vitria)."

Em todas as outras 17 paginas (home, sobre, belem, paragominas) o nome correto e "Instituto de Olhos de Belem", no proprio estado do Para. Bahia e outro estado, a mais de 2.000 km. E o tipo de erro que sugere geracao ou edicao sem checagem humana final, e que mina a credibilidade justamente na pagina que deveria transmitir mais rigor, a que trata de dados pessoais sob a LGPD.

Recomendacao: corrigir para "Instituto de Olhos de Belem" e conferir NAP (nome, endereco, telefone) das 4 unidades em todas as paginas de uma vez.

### [Medium] Slider de nitidez em /paragominas usa a mesma logica de comparacao visual

paragominas.html tem um componente interativo: "Da visao embacada a clareza... Deslize aqui para ajustar a nitidez, Mais embacado, Mais nitido... Demonstracao visual ilustrativa. Nao substitui avaliacao oftalmologica." E generico (nao e o olho de um paciente real) e carrega aviso, o que reduz bastante o risco frente ao achado Critical da home. Ainda assim, e um recurso de "antes e depois" simulado, posicionado logo apos o CTA de agendamento, na mesma pagina que vende consulta em Paragominas.

Recomendacao: manter o aviso visivel (esta bem redigido) e evitar qualquer associacao verbal proxima com "resultado da cirurgia" ou com o nome de um procedimento especifico.

### [Medium] H1 de /paragominas nao comunica a intencao de busca nem serve bem a leitura por IA

O H1 renderizado, "Sua visao, com mais clareza.", ja foi registrado em on-page-seo.md quanto ao espacamento apos a virgula. Do ponto de vista editorial, o problema maior e outro: e uma tagline generica, sem cidade e sem "oftalmologista", que poderia estar no site de qualquer clinica em qualquer lugar do Brasil. O texto que de fato localiza a pagina, "Oftalmologista em Paragominas", existe mas fica em um elemento secundario acima do H1, nao na propria heading. Isso enfraquece o sinal tanto para busca local quanto para IA generativa, que tende a priorizar a heading principal como resumo do topico da pagina. /belem faz isso corretamente: o H1 e literalmente "Oftalmologista em Belem".

Recomendacao: levar "Oftalmologista em Paragominas" para dentro do H1, mantendo a linha de efeito abaixo como subtitulo (h2 ou paragrafo), no mesmo padrao ja usado em /belem.

### [Low] Ausencia do RQE (Registro de Qualificacao de Especialista)

O CRM-PA 15253 aparece de forma proeminente (cabecalho fixo em todas as paginas, nao so rodape) e de forma consistente nas 18 rotas. O que falta e o numero de RQE em oftalmologia, dado que comprova o titulo de especialista perante o CFM. O site nao usa a palavra "especialista" em nenhum texto (checado nas 18 paginas), entao nao ha alegacao indevida, mas divulgar o RQE ao lado do CRM reforcaria a expertise sem gerar risco.

Recomendacao: incluir o RQE em /sobre e no schema Physician, ao lado do identifier de CRM ja existente.

## Conteudo raso: /agendamento (346 palavras) e problema?

Nao. Descontando cabecalho e rodape comuns as 18 paginas (cerca de 150 palavras de template), o corpo unico de /agendamento fica perto de 286 palavras, mas o proposito da pagina e transacional: formulario em 4 passos, prova social curta e FAQ de decisao rapida (confirmacao, cancelamento). Nao ha intencao de busca informacional para essa URL, ela existe para converter quem ja decidiu agendar. O piso de 1.500 palavras de blog post ou de 800 de service page nao se aplica aqui. O unico ajuste necessario nessa pagina e de conformidade (depoimentos), nao de volume.

## Canibalizacao e sobreposicao real

Sobreposicao medida por shingles de 5 palavras, apos remover cabecalho/rodape identicos presentes nas 18 paginas:

- As 11 paginas de procedimento: containment entre 20% e 31% umas com as outras. Inspecionando os trechos compartilhados (ex.: gonioscopia vs. biometria, 31%), o que se repete e boilerplate de template: a linha de autoria ("Procedimento realizado pelo Dr. Juliano Machado"), o aviso "Esta pagina e informativa e nao substitui a consulta: a indicacao depende de avaliacao presencial", o bloco de locais de atendimento e o CTA de avaliacoes do Google. O conteudo clinico especifico de cada exame ou cirurgia (o que e, para que serve, como e feito, cuidados) nao se repete de uma pagina para outra. Nao ha canibalizacao real de conteudo entre as 11 paginas.
- /belem vs. /paragominas: containment de 24%, o mais baixo entre os pares nao triviais do site. O unico bloco compartilhado quase literalmente e a lista de 5 procedimentos ("Glaucoma, Diagnostico e acompanhamento, com tonometria, gonioscopia, campo visual e OCT... Cirurgia de catarata... Cirurgia de pterigio... Capsulotomia YAG laser... Consulta oftalmologica..."), que funciona como card de navegacao, nao como texto de posicionamento da pagina. O H1, a secao "Motivos mais comuns de consulta" / "Quando procurar", o FAQ e a lista de enderecos sao inteiramente diferentes entre as duas. As paginas de cidade nao competem entre si por conteudo, mas /paragominas tem H1 fraco (ver achado Medium acima), que e o risco maior ali, nao duplicacao.
- /belem vs. /sobre: containment de 33%, o par mais alto do site fora dos procedimentos entre si. Explicado pela mesma frase de formacao resumida ("Formado em Medicina pelo CESUPA... residencia... Hospital Federal de Bonsucesso... fellowship em Glaucoma pela Unidade Paulista de Oftalmologia") e pela lista de enderecos, repetidas porque sao dados factuais do medico. Nao seria correto variar esse texto so por variar.

## Legibilidade e prontidao para citacao por IA

Ponto forte: as paginas de procedimento tem estrutura favoravel a citacao, com paragrafos curtos, definicao direta logo no primeiro paragrafo (ex.: tonometria abre dizendo o que o exame mede), FAQ em formato pergunta/resposta autocontido, e o bloco final de revisao medica com nome, CRM e data da revisao, dando ao conteudo um "quem disse isso e quando" que ferramentas de IA generativa valorizam para atribuicao. O vocabulario e adequado a paciente leigo (evita jargao sem explicar, ex.: "capsula posterior" e explicada antes de ser usada).

Ponto fraco: a informacao mais citavel de /paragominas (nome da cidade e da especialidade) esta fora do H1, como apontado acima, o que reduz a chance de um mecanismo de IA usar essa pagina como resposta direta para "oftalmologista em Paragominas".

## Lacunas de conteudo para um oftalmologista em Paragominas e Belem

Faltam paginas proprias para: exame de reflexo vermelho / teste do olhinho em recem-nascidos (ja mencionado em um depoimento reproduzido no site, mas sem pagina de servico), oftalmologia pediatrica em geral, ceratocone, olho seco, conjuntivite e outras doencas externas comuns em pronto atendimento, e cirurgia refrativa (miopia/astigmatismo). Falta tambem uma pagina de convenios com regras de cobertura por plano, em vez de so a logomarca, e conteudo educativo (artigos) para capturar busca informacional (ex.: "pressao no olho e normal", "catarata tem cura"), hoje fragmentado dentro das paginas de procedimento.
