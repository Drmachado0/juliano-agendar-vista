# Plano: otimizar a conversão em `/agendamento`

## O que será alterado
- Adicionar no topo da página um bloco compacto com datas, locais e convênios, usando constantes fáceis de atualizar.
- Criar os dois caminhos equivalentes: WhatsApp com mensagem contextual e agendamento online com rolagem suave.
- Mover a prova social para antes do formulário, mantendo o link público de avaliações.
- Exibir título e mensagem de WhatsApp específicos quando `utm_content` contiver `yag` ou `origem=yag`.
- Simplificar o primeiro passo para nome e WhatsApp; coletar nascimento e e-mail no último passo, preservando validações e envio final.
- Adicionar o atalho flutuante de WhatsApp apenas no celular, posicionado para não cobrir “Avançar”.

## Preservação obrigatória
- Reutilizar o handler atual de WhatsApp, mantendo `ContatoWhatsApp` e as conversões existentes.
- Não remover ou renomear eventos GTM, Meta Pixel ou CAPI.
- Manter a query string e a captura atual de UTMs durante todo o fluxo.
- Manter o contrato do backend/CRM e enviar todos os campos atuais.
- Não alterar outras páginas e não publicar.

## Detalhes técnicos
- As variações dos passos compartilhados serão ativadas somente por propriedades passadas em `/agendamento`, evitando mudanças nas outras páginas.
- Antes da conversão final, os dados movidos para o último passo serão persistidos no mesmo lead para preservar o payload final.
- A validação será conferida com testes focados e uma revisão visual móvel da página.
