# Schema / Structured Data - nota 58/100

Auditoria de dados estruturados de https://drjulianomachado.com/. Dados extraidos do HTML servido (SSG), 18 URLs analisadas: home, /belem, /paragominas, /procedimentos, /sobre, /agendamento, /politica-de-privacidade e as 11 paginas filhas de /procedimentos. Fonte: paginas ja baixadas em disco, JSON-LD parseado em Python (sem execucao de JS, mas o SSG ja injeta o schema no HTML cru).

## O que esta certo

- Nenhum tipo descontinuado (sem HowTo, sem SpecialAnnouncement). Sem microdata/RDFa concorrente, so JSON-LD, `@context` sempre `https://schema.org`.
- Consolidacao de entidade correta em 6 dos 7 templates (home, /belem, /paragominas, /procedimentos, /sobre, /agendamento): o mesmo `Physician` e o mesmo `WebSite` sao reemitidos com o **mesmo `@id`** (`https://drjulianomachado.com/#physician` e `.../#website`) pagina apos pagina. Isso e o padrao certo para JSON-LD replicado entre paginas.
- Duas cidades com NAP realmente distinto, nao e o mesmo endereco repetido. Paragominas tem 2 `MedicalClinic` (Clinicor e Hospital Geral de Paragominas), Belem tem 2 (Instituto de Olhos de Belem e Vitria, Ed. Sintese 21), cada um com `address`, `telephone` e `@id` proprios, e a pagina de cada cidade so publica as clinicas daquela cidade. Os telefones tambem sao proprios por unidade: Clinicor usa o movel/WhatsApp `+5591936180476`, HGP usa `+559191000303`, IOB usa `+559132394600` e Vitria usa `+559133421463`. Isso bate com os 4 numeros que o coordenador ja tinha mapeado no HTML.
- Vinculo `Physician <-> MedicalClinic` e bidirecional por `@id`: o `Physician` lista `workLocation` com os 4 `@id` das clinicas, e cada `MedicalClinic` aponta de volta `"physician": {"@id": "https://drjulianomachado.com/#physician"}`.
- `Physician` tem `identifier` estruturado do CRM, nao e so texto solto na pagina:
  `{"@type": "PropertyValue", "propertyID": "CRM", "value": "CRM-PA 15253"}`
  Esse mesmo bloco de `identifier` e reaproveitado dentro de `reviewedBy` em todo `MedicalWebPage`, inclusive nas 11 paginas de procedimento. Para YMYL medico isso e o sinal mais importante e esta presente de forma consistente.
- `Physician` tambem tem `alumniOf` (5 instituicoes), `memberOf` (2 sociedades, incluindo Sociedade Brasileira de Oftalmologia e Sociedade Brasileira de Glaucoma), `knowsAbout` (6 itens) e `medicalSpecialty`. Cobertura de E-E-A-T acima da media para um site desse porte.
- `/procedimentos` tem `BreadcrumbList` e `ItemList` completos e corretos, com as 11 entradas batendo exatamente com as 11 URLs reais.
- `FAQPage` presente na home, em `/belem`, `/paragominas` e nas 11 paginas de procedimento (nao em `/sobre`, `/agendamento` nem `/procedimentos` index).

## Achados por severidade

### Critico

**1. `postalCode` ausente em 100% dos enderecos (Physician e as 4 MedicalClinic)**

Nenhum objeto `PostalAddress` do site tem `postalCode`. E um campo que a documentacao do Google para Local Business trata como esperado dentro de `address`, junto com `streetAddress` e `addressLocality`. Sem ele o NAP fica incompleto para fins de local pack e Google Business Profile.

Evidencia (identica nas 4 clinicas, so muda o valor de `streetAddress`/`addressLocality`):
```json
{
  "@type": "PostalAddress",
  "streetAddress": "Rua Eixo W1, R. Celio Miranda, N 729",
  "addressLocality": "Paragominas",
  "addressRegion": "PA",
  "addressCountry": "BR"
}
```

**2. Grafo de entidade fragmentado nas 11 paginas de procedimento**

Nas paginas de `/procedimentos/<slug>` (as de maior intencao comercial do site), o `Physician` e o `WebSite` **nao aparecem como nos do `@graph` com `@id`**. Em vez disso, `performer` (dentro de `MedicalProcedure`) e `reviewedBy` (dentro de `MedicalWebPage`) trazem uma copia solta, sem `@id`, do medico. Sao ilhas: nao se conectam ao no canonico `https://drjulianomachado.com/#physician` que existe em todas as outras 6 templates do site.

Evidencia (pagina cirurgia-de-catarata, bloco `performer`):
```json
"performer": {
  "@type": "Physician",
  "name": "Dr. Juliano Machado",
  "medicalSpecialty": "Ophthalmology",
  "url": "https://drjulianomachado.com"
}
```
Sem `@id`. O mesmo padrao se repete em `reviewedBy` e nas 11 paginas filhas, confirmado no lote inteiro.

Alem disso essas 11 paginas nao emitem `WebSite` nem ligam o `MedicalWebPage` a ele via `isPartOf`, ao contrario de home/belem/paragominas/procedimentos/sobre/agendamento, que sempre tem `"isPartOf": {"@id": "https://drjulianomachado.com/#website"}`.

**3. `BreadcrumbList` das 11 paginas de procedimento aponta o nivel 2 para uma ancora que nao existe como pagina**

O item de posicao 2 ("Procedimentos") em todas as 11 paginas filhas usa `item: https://drjulianomachado.com/#procedimentos`, uma ancora dentro da home, e nao `https://drjulianomachado.com/procedimentos`, que e a URL real do hub (a mesma que tem o `ItemList` com as 11 entradas). O schema declara uma hierarquia de navegacao que nao corresponde a URL real da pagina intermediaria. Isso ja foi registrado como achado High em on-page-seo.md pelo lado de UX/link, aqui o registro e so o lado de dados estruturados, a mesma URL errada esta dentro do `BreadcrumbList` em JSON-LD, que e o que o Google le para o rich result de breadcrumb.

Evidencia (identica nas 11 paginas, so muda o item 3):
```json
{"@type": "ListItem", "position": 2, "name": "Procedimentos", "item": "https://drjulianomachado.com/#procedimentos"}
```

**4. `/politica-de-privacidade` sem nenhum JSON-LD**

Confirmado: 0 blocos `application/ld+json` no HTML. E a unica URL do site sem qualquer schema, nem um `WebPage` basico.

### Alto

**5. `BreadcrumbList` ausente em `/sobre`, `/belem`, `/paragominas` e `/agendamento`**

Essas 4 paginas emitem `Physician`, `WebSite` e `MedicalWebPage`, mas nenhum `BreadcrumbList`, mesmo tendo profundidade de navegacao (estao a 1 nivel da home). `/procedimentos` e as 11 filhas tem breadcrumb, essas 4 nao.

**6. `availableService` usado de forma incorreta e ausente onde deveria estar**

A unica ocorrencia de `availableService` no site fica dentro do proprio `MedicalProcedure`, apontando para si mesmo:
```json
{
  "@type": "MedicalProcedure",
  "name": "Cirurgia de Catarata",
  "availableService": {"@type": "MedicalProcedure", "name": "Cirurgia de Catarata"}
}
```
No vocabulario do schema.org, `availableService` e propriedade de organizacao (o dominio esperado e `MedicalOrganization`, que cobre `Physician` e `MedicalClinic`), nao de `MedicalProcedure`. Do jeito que esta, o campo e redundante (um procedimento "oferecendo a si mesmo") e nenhuma `MedicalClinic` nem o `Physician` lista os 11 procedimentos que realiza. Essa e a lacuna que teria efeito real de rich result e de entendimento do Google sobre o que a clinica/medico oferecem.

### Medio

**7. `medicalSpecialty` usa texto livre, nao o valor de enumeracao do schema.org**

Em todas as ocorrencias (`Physician`, as 4 `MedicalClinic`, e o `performer`/`reviewedBy` de cada uma das 11 paginas de procedimento) o valor e a string `"Ophthalmology"`. O schema.org define uma enumeracao `MedicalSpecialty` com o termo `Ophthalmic` para oftalmologia. `"Ophthalmology"` nao e um termo dessa enumeracao, entao validadores estritos podem nao reconhecer o valor.

**8. Sem `geo` (GeoCoordinates) e sem `openingHoursSpecification` nas 4 MedicalClinic**

Nenhuma das 4 unidades declara coordenadas nem horario de funcionamento em JSON-LD. Sao propriedades recomendadas pelo Google para local business e ajudam a consistencia com o Google Business Profile de cada unidade.

**9. `Physician.address` mostra so o endereco de Paragominas, mesmo nas paginas de Belem**

O no `Physician` (que se repete identico em todas as paginas, inclusive `/belem`) tem `address` fixo em Paragominas (Clinicor). Como o medico atende em 2 cidades e 4 locais, isso pode sugerir para leitores automatizados que a base do medico e so em Paragominas.

**10. `sameAs` limitado e `MedicalClinic` sem `image`, `url` nem `priceRange`**

`sameAs` do Physician tem so Instagram e um link de Google Maps com `cid` fixo (nao fica claro a qual das 4 unidades esse `cid` corresponde). As 4 `MedicalClinic` nao tem `image`, `url` proprio nem `priceRange`, todos recomendados pelo Google para Local Business.

### Baixo / Info

**11. FAQPage presente na home, em /belem, /paragominas e nas 11 paginas de procedimento**

O Google aposentou o rich result de FAQ para todos os sites em 07/05/2026. Isso e registrado aqui como Info, nao como falha. Nao ha mais ganho de SERP no Google em manter esse schema, mas tambem nao ha razao tecnica para remove-lo, e nao ha beneficio confirmado de citacao por IA/GEO a se esperar dele. Recomendacao, manter como esta hoje, nao investir em expandir FAQPage para novas paginas visando o Google, e nao promete-lo como ganho de trafego em relatorios para o cliente.

**12. `Physician` misturando propriedades de dominio `Person` dentro de um tipo de organizacao**

`Physician` no schema.org e um subtipo de `MedicalOrganization` (nao de `Person`), mas o site usa `alumniOf` nele, uma propriedade cujo dominio no vocabulario oficial e `Person`. Na pratica o Google tolera esse padrao (e comum em sites de medico) e nao deve gerar erro no Rich Results Test, mas um validador estrito de schema.org pode sinalizar a propriedade como fora do dominio esperado. Nao e urgente corrigir, registrado como observacao tecnica.

## JSON-LD corrigido pronto para implementar

### A. Enderecos com `postalCode` (adicionar aos 4 objetos PostalAddress e ao Physician)

Os CEPs reais precisam ser conferidos e preenchidos por quem tem acesso ao cadastro de cada unidade, os valores abaixo estao marcados como pendentes de propósito, publicar um CEP errado é pior do que nao ter CEP.

```json
{
  "@type": "PostalAddress",
  "streetAddress": "Rua Eixo W1, R. Celio Miranda, N 729",
  "addressLocality": "Paragominas",
  "addressRegion": "PA",
  "postalCode": "PREENCHER_CEP_CLINICOR",
  "addressCountry": "BR"
}
```
Repetir o mesmo padrao (so trocando `postalCode`) para Hospital Geral de Paragominas, Instituto de Olhos de Belem, Vitria/Ed. Sintese 21 e para o endereco do `Physician`.

### B. `geo` por unidade (adicionar a cada MedicalClinic)

Mesma ressalva, latitude e longitude reais devem vir do Google Maps de cada endereco antes de publicar.

```json
"geo": {
  "@type": "GeoCoordinates",
  "latitude": "PREENCHER_LAT",
  "longitude": "PREENCHER_LONG"
}
```

### C. `BreadcrumbList` corrigido para as 11 paginas de procedimento

Trocar o `item` da posicao 2 de `https://drjulianomachado.com/#procedimentos` para a URL real do hub.

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "@id": "https://drjulianomachado.com/procedimentos/cirurgia-de-catarata#breadcrumb",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://drjulianomachado.com/"},
    {"@type": "ListItem", "position": 2, "name": "Procedimentos", "item": "https://drjulianomachado.com/procedimentos"},
    {"@type": "ListItem", "position": 3, "name": "Cirurgia de Catarata", "item": "https://drjulianomachado.com/procedimentos/cirurgia-de-catarata"}
  ]
}
```
Aplicar o mesmo ajuste (so troca o item 3) nas outras 10 paginas filhas.

### D. Unificar o grafo nas paginas de procedimento (exemplo Cirurgia de Catarata)

Reaproveitar o mesmo `Physician` e `WebSite` que ja existem em home/sobre/agendamento (mesmo `@id`), referenciar por `@id` em vez de duplicar sem `@id`, e remover o `availableService` circular de dentro do `MedicalProcedure`.

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Physician",
      "@id": "https://drjulianomachado.com/#physician",
      "name": "Dr. Juliano Machado",
      "medicalSpecialty": "https://schema.org/Ophthalmic",
      "url": "https://drjulianomachado.com",
      "telephone": "+5591936180476",
      "identifier": {"@type": "PropertyValue", "propertyID": "CRM", "value": "CRM-PA 15253"}
    },
    {
      "@type": "WebSite",
      "@id": "https://drjulianomachado.com/#website",
      "url": "https://drjulianomachado.com"
    },
    {
      "@type": "MedicalProcedure",
      "@id": "https://drjulianomachado.com/procedimentos/cirurgia-de-catarata#procedure",
      "name": "Cirurgia de Catarata",
      "procedureType": "https://schema.org/SurgicalProcedure",
      "bodyLocation": "Cristalino",
      "url": "https://drjulianomachado.com/procedimentos/cirurgia-de-catarata",
      "performer": {"@id": "https://drjulianomachado.com/#physician"}
    },
    {
      "@type": "MedicalWebPage",
      "@id": "https://drjulianomachado.com/procedimentos/cirurgia-de-catarata#webpage",
      "url": "https://drjulianomachado.com/procedimentos/cirurgia-de-catarata",
      "isPartOf": {"@id": "https://drjulianomachado.com/#website"},
      "about": {"@id": "https://drjulianomachado.com/procedimentos/cirurgia-de-catarata#procedure"},
      "lastReviewed": "2026-08-26",
      "reviewedBy": {"@id": "https://drjulianomachado.com/#physician"}
    }
  ]
}
```
Nota, o `Physician` acima esta resumido so para o exemplo, na implementacao real deve levar o mesmo conteudo completo (alumniOf, memberOf, knowsAbout, address, workLocation, sameAs) ja usado nas outras 6 templates, com o mesmo `@id`.

### E. `availableService` no lugar certo (no Physician, referenciando os 11 procedimentos)

```json
"availableService": [
  {"@type": "MedicalProcedure", "name": "Cirurgia de Catarata", "url": "https://drjulianomachado.com/procedimentos/cirurgia-de-catarata"},
  {"@type": "MedicalProcedure", "name": "Cirurgia de Pterigio", "url": "https://drjulianomachado.com/procedimentos/cirurgia-de-pterigio"},
  {"@type": "MedicalProcedure", "name": "Tratamento de Glaucoma", "url": "https://drjulianomachado.com/procedimentos/glaucoma"}
]
```
Completar com os 8 procedimentos restantes seguindo o mesmo padrao.

### F. `BreadcrumbList` para `/sobre` e `/agendamento` (faltando hoje)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://drjulianomachado.com/"},
    {"@type": "ListItem", "position": 2, "name": "Sobre", "item": "https://drjulianomachado.com/sobre"}
  ]
}
```
Mesmo padrao para `/agendamento`, trocando `name` para "Agendamento" e o `item` final para `https://drjulianomachado.com/agendamento`.

### G. `WebPage` minimo para `/politica-de-privacidade`

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://drjulianomachado.com/politica-de-privacidade#webpage",
      "name": "Politica de Privacidade",
      "url": "https://drjulianomachado.com/politica-de-privacidade",
      "isPartOf": {"@id": "https://drjulianomachado.com/#website"},
      "inLanguage": "pt-BR"
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://drjulianomachado.com/"},
        {"@type": "ListItem", "position": 2, "name": "Politica de Privacidade", "item": "https://drjulianomachado.com/politica-de-privacidade"}
      ]
    }
  ]
}
```
