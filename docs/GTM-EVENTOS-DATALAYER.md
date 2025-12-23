# Documentação de Eventos do DataLayer - Google Tag Manager

**Container GTM:** `GTM-NQ2GJ4GX`  
**Última atualização:** Dezembro 2024

---

## IDs de Referência

| Plataforma | ID | Descrição | Status |
|------------|-----|-----------|--------|
| GTM Container | GTM-NQ2GJ4GX | Google Tag Manager | ✅ Ativo |
| GA4 Principal | G-79BDCX4R2L | drjulianomachado.com | ✅ gtag.js direto |
| GA4 Secundário | G-380EGEFL1S | site Dr Juliano Machado | ✅ gtag.js direto |
| Google Ads | AW-436492720 | Conta de Ads | Via GTM |
| Meta Pixel | 1358767025715686 | Facebook/Instagram | ✅ Ativo |

---

## Arquitetura de Tracking

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARQUITETURA DE TRACKING                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  index.html                                                      │
│  ├── Meta Pixel (1358767025715686) → PageView automático        │
│  ├── gtag.js → G-79BDCX4R2L (Principal)                         │
│  │         └→ G-380EGEFL1S (Secundário)                         │
│  └── GTM (GTM-NQ2GJ4GX) → Tags configuradas via painel          │
│                                                                  │
│  useGoogleTag.ts (DataLayer)                                     │
│  ├── trackScheduleStart() → begin_checkout                      │
│  ├── trackScheduleComplete() → purchase                         │
│  ├── trackContact() → contact                                   │
│  ├── trackLead() → generate_lead                                │
│  ├── trackCTAClick() → cta_click                                │
│  └── trackEvent() → eventos customizados                        │
│                                                                  │
│  useMetaPixel.ts (Facebook Pixel)                                │
│  ├── trackViewContent() → ViewContent                           │
│  ├── trackLead() → Lead                                         │
│  ├── trackSchedule() → Schedule                                 │
│  └── trackCompleteRegistration() → CompleteRegistration         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mapeamento de Arquivos → Eventos

| Arquivo | Evento(s) Disparado(s) | Método |
|---------|------------------------|--------|
| `src/components/HeroSection.tsx` | `cta_click` | `trackCTAClick()` |
| `src/components/InsuranceSection.tsx` | `cta_click` | `trackCTAClick()` |
| `src/components/WhatsAppButton.tsx` | `contact` | `trackContact()` |
| `src/components/scheduling/SchedulingModal.tsx` | `begin_checkout`, `purchase`, `generate_lead` | `trackScheduleStart()`, `trackScheduleComplete()`, `trackLead()` |
| `src/pages/Agendar.tsx` | `begin_checkout`, `purchase`, `generate_lead` | `trackScheduleStart()`, `trackScheduleComplete()`, `trackLead()` |

---

## Eventos Disponíveis

### 1. `begin_checkout` - Início do Agendamento

**Quando dispara:** Usuário abre o modal/página de agendamento.

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

### 5. `cta_click` - Clique em CTA

**Quando dispara:** Usuário clica em um botão de Call-to-Action.

```javascript
{
  event: 'cta_click',
  cta_name: 'agendar_consulta' | 'saiba_mais',
  cta_location: 'hero' | 'convenios' | 'about' | 'procedures' | 'footer',
  cta_text: 'Agendar consulta'
}
```

**Parâmetros:**
| Parâmetro | Descrição | Exemplo |
|-----------|-----------|---------|
| `cta_name` | Identificador do CTA | agendar_consulta, saiba_mais |
| `cta_location` | Seção onde está o CTA | hero, convenios, about, procedures |
| `cta_text` | Texto exibido no botão | Agendar consulta |

**Uso recomendado:**
- GA4: Análise de engajamento por seção
- Heatmaps: Identificar CTAs mais clicados

---

## Configuração no GTM

### ⚠️ Importante: Evitar Duplicação de Pageviews

O `gtag.js` está instalado diretamente no `index.html` para ambas as propriedades GA4 (G-79BDCX4R2L e G-380EGEFL1S). 

**NÃO crie tags GA4 Configuration com trigger "All Pages" no GTM**, pois isso causará duplicação de pageviews.

Use GTM apenas para:
- Tags de eventos personalizados (purchase, begin_checkout, etc.)
- Tags de Google Ads
- Tags que precisam de triggers específicos

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
ID de medição: G-79BDCX4R2L
Nome do evento: [nome do evento]
Parâmetros do evento:
  - event_category: {{dlv - event_category}}
  - event_label: {{dlv - event_label}}
Acionador: [trigger correspondente]
```

#### Tag Google Ads - Conversão

```
Tipo: Google Ads: Acompanhamento de conversões
ID de conversão: AW-436492720
Rótulo de conversão: [criar no Google Ads]
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
| dlv - cta_name | cta_name |
| dlv - cta_location | cta_location |
| dlv - cta_text | cta_text |

---

## Funil de Conversão

```
┌─────────────────────────────────────────────────────────┐
│                    FUNIL DE AGENDAMENTO                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. PageView (gtag automático)  ← Visitante chega       │
│         ↓                                                │
│  2. cta_click (hero/convenios)  ← Clica em "Agendar"    │
│         ↓                                                │
│  3. begin_checkout              ← Abre agendamento      │
│         ↓                                                │
│  4. purchase + generate_lead    ← Confirma agendamento  │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                    EVENTOS PARALELOS                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  • contact (whatsapp)           ← Clica no WhatsApp     │
│  • cta_click (about/footer)     ← Outros CTAs           │
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

4. **CTAs Mais Clicados**
   - Dimensão: `cta_location`
   - Métrica: Contagem de `cta_click`

### Google Ads - Conversões

| Ação de conversão | Evento GTM | Valor | Contagem |
|-------------------|------------|-------|----------|
| Agendamento Confirmado | purchase | Definir valor | Todas |
| Início de Agendamento | begin_checkout | - | Única |
| Contato WhatsApp | contact | - | Todas |
| Clique CTA | cta_click | - | Todas |

---

## Suporte

Para adicionar novos eventos ou modificar os existentes, entre em contato com a equipe de desenvolvimento.

**Hook principal:** `src/hooks/useGoogleTag.ts`
