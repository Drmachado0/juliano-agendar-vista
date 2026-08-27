# Technical SEO - nota 82/100

## O que esta certo

- robots.txt libera o site e bloqueia /admin/, /auth e /obrigado, com Sitemap declarado
- sitemap.xml com 18 URLs, todas respondendo 200
- canonical auto-referente e unico nas 18 paginas
- http:// e www. redirecionam para a versao canonica https sem www
- HSTS com includeSubDomains, X-Content-Type-Options e Referrer-Policy presentes
- assets com Cache-Control immutable de 1 ano

## Achados

### [High] O HTML servido e uma casca de 9,8 KB nas 18 rotas

Producao devolve o mesmo shell sem h1, canonical ou JSON-LD para toda rota. O prerender existe e funciona no build local (18 rotas em 9s), mas o container de build da Lovable nao tem as bibliotecas de sistema do Chromium (libglib-2.0.so.0, exitCode=127), registrado em /prerender-status.json. O Google executa JS e indexa normalmente; o prejuizo e para buscadores e crawlers que nao executam.

**Correcao:** Decisao ja tomada de aceitar. Se virar prioridade: Chromium empacotado, SSG sem navegador, ou troca de host. Ver .claude/skills/prerender-na-lovable/.

### [Low] Falta X-Frame-Options e Content-Security-Policy

Os cabecalhos cobrem HSTS, nosniff e Referrer-Policy, mas nao ha protecao contra clickjacking nem CSP.

**Correcao:** Baixa prioridade em site institucional. Se a Lovable permitir cabecalho customizado, adicionar X-Frame-Options: SAMEORIGIN.
