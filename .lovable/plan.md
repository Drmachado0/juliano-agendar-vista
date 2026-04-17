

User wants to update the rating display from "4.9" to "5.0" with five star icons (★★★★★) for visual emphasis on the `/agendamento` page hero.

Need to find where "4.9" appears on Agendamento.tsx.
<lov-tool-use id="toolu_vrtx_01KwbhNoD1MNWAVJJFduWwRv" name="code--search_files" integration-id="code" data="{\"query\": \"4.9\", \"include_patterns\": \"src/pages/Agendamento.tsx,src/components/HeroSection.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01SHtQn6tPvAuJZCQe1R4DdR" name="code--search_files" integration-id="code" data="{\"query\": \"4.9\", \"include_patterns\": \"src/pages/Agendamento.tsx,src/components/HeroSection.tsx\"}">
</lov-tool-use>
<lov-plan>

## Mudança
Em `src/pages/Agendamento.tsx`, linha 348-352 (bloco de social proof do hero):

**Antes:**
```
⭐ 4.9   ✓ 13+ anos de experiência   ✓ 6.000+ pacientes atendidos
```

**Depois:**
```
⭐⭐⭐⭐⭐ 5.0   ✓ 13+ anos de experiência   ✓ 6.000+ pacientes atendidos
```

### Detalhes
- Substituir o único `<Star />` por **5 ícones `<Star />`** preenchidos em dourado (`fill-primary text-primary`)
- Trocar o número de `4.9` para `5.0` (em negrito para destaque)
- Manter os dois badges seguintes (`13+ anos` e `6.000+ pacientes`) intactos
- Sem outras mudanças na página

### Observação
Esta alteração afeta apenas a página `/agendamento`. O `HeroSection.tsx` da home (`/`) puxa nota dinâmica do Google Places (avaliações reais) — não vou mexer lá para não quebrar a sincronização real. Se quiser que a home também mostre 5 estrelas fixas, me avise.

