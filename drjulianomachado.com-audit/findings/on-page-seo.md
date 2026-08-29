# On-Page SEO, drjulianomachado.com

**Data:** 28/08/2026 · **Nota: 78/100** (era 96/100 em 27/08. Caiu porque a arquitetura de links internos foi medida a fundo pela primeira vez, nao porque algo piorou.)

Medicao: as 18 URLs do sitemap baixadas com `curl` puro, sem execucao de JS, e parseadas. O HTML servido agora e completo, o SSG entrou no ar em 28/08/2026, entao o HTML cru ja e mensuravel. Na auditoria anterior isso exigia Playwright.

## O que esta certo

- **Titulos:** as 18 paginas entre 45 e 59 caracteres. Nenhum corta na SERP.
- **Descriptions:** as 18 entre 111 e 160 caracteres. Nenhuma fora da faixa.
- **H1:** exatamente um por pagina nas 18 rotas. Zero duplicados, zero ausentes.
- **Canonical:** auto-referente e correto nas 18 rotas.
- **Meta robots:** `index, follow` explicito em 16 rotas, ausente e portanto indexavel por padrao em `/agendamento` e `/procedimentos`.
- **Hierarquia de headings:** densidade coerente, de 4 a 14 h2 por pagina.
- **URLs:** limpas, em portugues, com hierarquia real (`/procedimentos/<slug>`), sem parametros nem maiusculas.

## Achados

### [High] O hub `/procedimentos` recebe 1 unico link interno, porque o breadcrumb aponta para o lugar errado

O breadcrumb das 11 paginas de procedimento tem o nivel 2 apontando para `/#procedimentos`, uma ancora na home, e nao para `/procedimentos`, a pagina indice real.

Evidencia, em `/procedimentos/tonometria`, HTML e JSON-LD dizendo a mesma coisa errada:

```html
<li><a href="/#procedimentos">Procedimentos</a></li>
```
```json
{"@type":"ListItem","position":2,"name":"Procedimentos",
 "item":"https://drjulianomachado.com/#procedimentos"}
```

Contagem de links internos apontando para cada rota, nas 18 paginas:

| Rota | Links internos recebidos |
|---|---|
| `/sobre` | 17 |
| `/politica-de-privacidade` | 17 |
| `/procedimentos/glaucoma` | 17 |
| `/agendamento` | 16 |
| `/belem` | 16 |
| `/` | 15 |
| `/procedimentos/capsulotomia-yag-laser` | 6 |
| `/procedimentos/cirurgia-de-catarata` | 5 |
| `/procedimentos/cirurgia-de-pterigio` | 5 |
| `/procedimentos/consulta-oftalmologica` | 4 |
| `/paragominas` | **2** |
| `/procedimentos/biometria-ultrassonica` | 2 |
| `/procedimentos/gonioscopia` | 2 |
| `/procedimentos/iridotomia-a-laser` | 2 |
| `/procedimentos/mapeamento-de-retina` | 2 |
| `/procedimentos/retinografia` | 2 |
| `/procedimentos/tonometria` | 2 |
| **`/procedimentos`** | **1** |

So `/procedimentos/capsulotomia-yag-laser` linka para o hub. As outras 17 paginas, nao.

Dois efeitos, ambos concretos. O hub fica sem autoridade interna para distribuir aos 11 filhos, e o breadcrumb que o Google exibe na SERP mostra a home como pagina mae, em vez do indice de procedimentos.

*Correcao:* trocar o nivel 2 do breadcrumb de `/#procedimentos` para `https://drjulianomachado.com/procedimentos`, no componente de breadcrumb e no gerador de BreadcrumbList. Uma mudanca, 11 paginas corrigidas, HTML e schema juntos.

*Como saber se falhou:* rodar de novo a contagem de links internos. `/procedimentos` tem que sair de 1 para 12. Se continuar em 1, o componente nao e a fonte do breadcrumb.

---

### [High] Paragominas esta fora da navegacao global, Belem esta dentro

A navegacao de topo, presente nas 18 paginas, tem exatamente quatro destinos:

```
/sobre · /procedimentos/glaucoma · /belem · /agendamento
```

E o rodape tem dois: `/sobre` e `/politica-de-privacidade`.

Consequencia medida: `/belem` recebe 16 links internos, `/paragominas` recebe 2. Isso apesar de Paragominas vir primeiro no h1 da home ("Oftalmologista em Paragominas e Belem") e de `/paragominas` ter mais conteudo que `/belem`, 667 contra 555 palavras.

Tambem chama atencao `/procedimentos/glaucoma` ocupar um item de menu global. Uma pagina filha entre onze recebe 17 links internos enquanto seis irmas recebem 2. Isso pode ser deliberado, mas esta desequilibrando a distribuicao interna de autoridade sem que o hub exista no menu para compensar.

*Correcao:* colocar `/paragominas` na navegacao global ao lado de `/belem`, e trocar o item "Glaucoma" por "Procedimentos" apontando para `/procedimentos`, que distribui para os 11 filhos, glaucoma incluso. Se glaucoma tem valor comercial que justifique o lugar no menu, mantenha e acrescente Procedimentos em vez de trocar.

*Dependencia:* fazer junto com a correcao do breadcrumb acima. As duas alimentam o mesmo hub. Separadas, cada uma entrega metade do ganho.

*Como saber se falhou:* `/paragominas` precisa passar de 2 para 18 links internos e `/procedimentos` de 1 para 18. Se o numero nao mudar, o menu nao e global de verdade.

---

### [x] RESOLVIDO em 29/08/2026. Duas tags canonical por pagina

Cada uma das 18 paginas serve duas tags canonical, uma injetada pelo react-helmet no SSG e outra do template.

```html
<link data-rh="true" rel="canonical" href="https://drjulianomachado.com/sobre"/>
<link rel="canonical" href="https://drjulianomachado.com/sobre" />
```

Hoje os valores **coincidem** nas 18 rotas, e o Google tolera canonicals duplicados identicos. O risco nao e o estado atual, e o acoplamento. No dia em que uma das duas fontes mudar sozinha, as tags divergem, e a documentacao do Google diz que multiplos canonicals conflitantes podem ser todos ignorados. E uma armadilha esperando alguem editar o template.

*Correcao:* eleger uma fonte so. Como o SSG ja injeta via helmet em todas as rotas, tirar a tag estatica do template.

*Resolvido junto com o item 2.7 do plano.* O `montar()` do `scripts/ssg.mjs`
so injeta canonical quando a pagina nao emitiu o dela. O gatilho foi
`/agendar`, que precisa apontar para `/agendamento` e passou a contradizer a
tag do SSG. O risco que este achado descrevia, de as duas fontes divergirem,
deixou de ser hipotetico e virou bug real em menos de um dia.

*Verificado:* as 23 rotas do `dist` tem exatamente uma tag canonical.

---

### [Medium] `/paragominas` tem h1 generico, sem a cidade, e com erro de digitacao

```
h1 = "Sua visao,com mais clareza."
```

Falta o espaco depois da virgula, e o h1 nao menciona Paragominas. Compare com a irma: `/belem` usa "Oftalmologista em Belem". As 11 paginas de procedimento tambem nomeiam as cidades no h1, por exemplo "Tonometria em Paragominas e Belem". `/paragominas` e a unica pagina de cidade sem a cidade no h1, justamente a cidade principal.

O title e a description da pagina estao corretos e mencionam Paragominas, entao o prejuizo e do h1 isolado, nao da pagina inteira.

*Correcao:* `h1 = "Oftalmologista em Paragominas"`, simetria com `/belem`. Mover "Sua visao, com mais clareza", com o espaco, para um subtitulo, se o texto for querido.

*Como saber se falhou:* trivial de verificar no HTML servido.

---

### [Low] Meta robots ausente em duas rotas

`/agendamento` e `/procedimentos` nao trazem `<meta name="robots">`. O padrao e indexavel, entao nao ha prejuizo hoje. E inconsistencia com as outras 16, e inconsistencia em head e onde regressao silenciosa nasce.

*Correcao:* emitir `index, follow` nas 18 rotas pela mesma fonte.

---

### [Info] Cobertura de heading e densidade

`/agendamento` tem 1 h2 e 346 palavras, a pagina mais rasa do site. Como pagina transacional isso e defensavel. A avaliacao de merito esta em `content-quality.md`.
