# Plano de acao - drjulianomachado.com

Health Score: 79/100

## Fase 1: Ganhos rapidos

**Prazo:** Esta semana

- [x] [feito] Encurtar os seis titulos acima de 60 caracteres
- [x] [feito] Aparar as cinco descriptions acima de 160 caracteres
- [ ] [cancelado] Remover supabase do modulepreload: seria pessimizacao, nao ganho
- [ ] [cancelado] Adicionar alt em /paragominas: a marcacao ja esta correta

## Fase 2: Conteudo

**Prazo:** Duas a tres semanas

- [ ] Ampliar /procedimentos com um paragrafo por grupo de exames
- [ ] Manter llms.txt rico, pois hoje e a unica superficie que crawler sem JS le

## Fase 2b: Supabase fora do caminho critico

**Prazo:** Decisao propria, nao e ganho rapido

- [ ] WhatsAppButton: trocar import estatico por dinamico dentro do clique (baixo risco)
- [ ] AuthContext: adiar o cliente para depois da primeira pintura (mexe em bootstrap de login)
- [ ] So os dois juntos tiram os 48,2 KB do caminho critico; um sozinho nao muda nada

## Fase 3: Decisao estrutural

**Prazo:** Quando virar prioridade

- [ ] Reavaliar o prerender: Chromium empacotado, SSG sem navegador, ou troca de host
- [ ] So vale se LCP e citacao por IA entrarem como meta de negocio

## Fase 4: Monitoramento

**Prazo:** Continuo

- [ ] Acompanhar CrUX mensalmente: LCP, FCP e TTFB
- [ ] Conferir /prerender-status.json apos cada deploy
- [ ] Ligar o Search Console por conta de servico para ter indexacao real
