

# Correção de Links — WhatsApp e Locais de Atendimento

## Problemas encontrados

### 1. WhatsApp — Números inconsistentes
- **WhatsAppButton.tsx** (botão flutuante): usa `5591936180476` ✅ correto
- **Header.tsx** (ícone mobile): usa `5591936180428` ❌
- **Footer.tsx** (2 links): usa `5591936180428` ❌
- **InsuranceSection.tsx** (CTA convênios): usa `5591936180428` ❌

Todos os links do site devem usar o número `5591936180476` conforme solicitado.

### 2. Google Maps Embeds — URLs com coordenadas genéricas
Os 4 iframes de mapa usam place IDs falsos (`0x1`) e coordenadas aproximadas, causando mapas que não mostram o local correto ou mostram erro. Preciso substituir por URLs de embed válidas usando o formato `place` do Google Maps.

### 3. Links tel: — OK
Os links de telefone estão funcionais.

---

## Correções

### Arquivo 1: `src/components/Header.tsx`
- Trocar `5591936180428` → `5591936180476`

### Arquivo 2: `src/components/Footer.tsx`
- Trocar 2 ocorrências de `5591936180428` → `5591936180476`

### Arquivo 3: `src/components/InsuranceSection.tsx`
- Trocar `5591936180428` → `5591936180476`

### Arquivo 4: `src/components/LocationsSection.tsx`
- Trocar as 4 `mapUrl` por URLs de embed usando busca por nome (`/maps/embed/v1/place?q=...`) que são mais confiáveis sem API key, ou usar o formato `search` embed que funciona sem chave
- Manter os `mapsLink` de busca como estão (esses funcionam)

