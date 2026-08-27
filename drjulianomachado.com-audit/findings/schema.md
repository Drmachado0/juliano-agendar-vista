# Schema / Structured Data - nota 92/100

## O que esta certo

- @graph completo: Physician, MedicalClinic, MedicalWebPage, MedicalProcedure, FAQPage, BreadcrumbList, ItemList
- MedicalWebPage com lastReviewed e reviewedBy nas 17 paginas de conteudo
- BreadcrumbList em 12 paginas, FAQPage em 14
- aggregateRating auto-declarado removido, que era achado da auditoria anterior
- Quatro blocos JSON-LD por pagina de procedimento

## Achados

### [Info] /politica-de-privacidade sem structured data

Unica pagina sem JSON-LD.

**Correcao:** Um WebPage simples fecharia, mas o ganho e proximo de zero.
