# Documentação de Eventos do DataLayer - Google Tag Manager

**Container GTM:** `GTM-NQ2GJ4GX`  
**Última atualização:** Dezembro 2024

---

## Visão Geral

Este documento descreve todos os eventos personalizados enviados ao `dataLayer` do Google Tag Manager no site Dr. Juliano Machado. Esses eventos podem ser usados para criar tags de GA4, Google Ads, Meta Pixel e outras plataformas.

---

## Eventos Disponíveis

### 1. `begin_checkout` - Início do Agendamento

**Quando dispara:** Usuário abre o modal de agendamento.

```javascript
{
  event: 'begin_checkout',
  event_category: 'agendamento',
  event_label: 'inicio_agendamento'
}
```

**Uso recomendado:**
- GA4: Evento de funil (início)
- Google Ads: Microconversão
- Meta: Lead potencial

---

### 2. `purchase` - Agendamento Confirmado

**Quando dispara:** Usuário confirma o agendamento com sucesso.

```javascript
{
  event: 'purchase',
  event_category: 'agendamento',
  event_label: 'agendamento_confirmado',
  appointment_type: 'Consulta' | 'Retorno' | 'Exame' | 'Cirurgia',
  location: 'Clinicor – Paragominas' | 'Hospital Geral de Paragominas' | 'Belém (IOB / Vitria)'
}
```

**Parâmetros extras:**
| Parâmetro | Descrição | Valores possíveis |
|-----------|-----------|-------------------|
| `appointment_type` | Tipo de atendimento | Consulta, Retorno, Exame, Cirurgia |
| `location` | Local do atendimento | Clinicor, HGP, Belém |

**Uso recomendado:**
- GA4: Conversão principal
- Google Ads: Conversão de agendamento
- Meta: Schedule (conversão)

---

### 3. `contact` - Contato via WhatsApp

**Quando dispara:** Usuário clica no botão flutuante do WhatsApp.

```javascript
{
  event: 'contact',
  event_category: 'contato',
  event_label: 'whatsapp',
  method: 'whatsapp'
}
```

**Uso recomendado:**
- GA4: Evento de engajamento
- Google Ads: Microconversão (contato)
- Meta: Contact

---

### 4. `generate_lead` - Lead Capturado

**Quando dispara:** Após confirmação de agendamento bem-sucedida.

```javascript
{
  event: 'generate_lead',
  event_category: 'lead',
  event_label: 'agendamento'
}
```

**Uso recomendado:**
- GA4: Evento de geração de lead
- Google Ads: Conversão de lead
- Meta: Lead

---

### 5. `page_view` - Visualização de Página

**Quando dispara:** Navegação entre páginas (SPA).

```javascript
{
  event: 'page_view',
  page_path: '/agendar'
}
```

**Uso recomendado:**
- GA4: Pageview (já configurado automaticamente)

---

## Configuração no GTM

### Criar Triggers (Acionadores)

Para cada evento, criar um **Trigger de Evento Personalizado**:

1. Vá em **Acionadores** → **Novo**
2. Tipo: **Evento personalizado**
3. Nome do evento: nome exato do evento (ex: `begin_checkout`)
4. Salvar

### Criar Tags

#### Tag GA4 - Evento de Conversão

```
Tipo: Google Analytics: Evento GA4
ID de medição: G-XXXXXXXXXX
Nome do evento: [nome do evento]
Parâmetros do evento:
  - event_category: {{dlv - event_category}}
  - event_label: {{dlv - event_label}}
Acionador: [trigger correspondente]
```

#### Tag Google Ads - Conversão

```
Tipo: Google Ads: Acompanhamento de conversões
ID de conversão: AW-XXXXXXXXXX
Rótulo de conversão: XXXXXXXXXXXX
Acionador: purchase (agendamento confirmado)
```

### Variáveis do DataLayer

Criar as seguintes variáveis para capturar dados extras:

| Nome da Variável | Nome da variável de camada de dados |
|------------------|-------------------------------------|
| dlv - event_category | event_category |
| dlv - event_label | event_label |
| dlv - appointment_type | appointment_type |
| dlv - location | location |
| dlv - method | method |
| dlv - page_path | page_path |

---

## Funil de Conversão

```
┌─────────────────────────────────────────────────────────┐
│                    FUNIL DE AGENDAMENTO                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. page_view (/)           ← Visitante chega ao site   │
│         ↓                                                │
│  2. begin_checkout          ← Abre modal de agendamento │
│         ↓                                                │
│  3. purchase + generate_lead ← Confirma agendamento     │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                    EVENTOS PARALELOS                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  • contact (whatsapp)       ← Clica no WhatsApp         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Métricas Recomendadas

### GA4 - Relatórios Personalizados

1. **Taxa de Conversão do Agendamento**
   - Fórmula: `purchase / begin_checkout × 100`

2. **Leads por Localização**
   - Dimensão: `location`
   - Métrica: Contagem de `purchase`

3. **Tipo de Atendimento Mais Procurado**
   - Dimensão: `appointment_type`
   - Métrica: Contagem de `purchase`

### Google Ads - Conversões

| Ação de conversão | Evento GTM | Valor | Contagem |
|-------------------|------------|-------|----------|
| Agendamento Confirmado | purchase | Definir valor | Todas |
| Início de Agendamento | begin_checkout | - | Única |
| Contato WhatsApp | contact | - | Todas |

---

## Suporte

Para adicionar novos eventos ou modificar os existentes, entre em contato com a equipe de desenvolvimento.

**Arquivos relacionados:**
- `src/hooks/useGoogleTag.ts` - Hook de rastreamento
- `src/components/scheduling/SchedulingModal.tsx` - Modal de agendamento
- `src/components/WhatsAppButton.tsx` - Botão do WhatsApp
