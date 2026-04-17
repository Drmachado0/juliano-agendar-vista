
The user wants the "Agendar Online" / "Agendar consulta" buttons across the site to navigate to `/agendamento` instead of opening the SchedulingModal.

Let me check where these buttons are wired.
<lov-tool-use id="toolu_vrtx_016r9uP4wKygwYcJqPfRKYak" name="code--search_files" integration-id="code" data="{\"query\": \"onScheduleClick\", \"include_patterns\": \"src/**/*.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01HM6nuiz9Bf4Lk73HQk38hz" name="code--search_files" integration-id="code" data="{\"query\": \"onScheduleClick|Agendar Online|Agendar consulta\", \"include_patterns\": \"src/**/*.tsx\"}">
</lov-tool-use>
<lov-plan>

Trocar todos os CTAs "Agendar Online" / "Agendar consulta" da landing principal para navegar diretamente para `/agendamento` (a página dedicada de conversão), em vez de abrir o modal `SchedulingModal`.

## Mudanças

**1. `src/pages/Index.tsx`**
- Remover state `isSchedulingOpen`, `openScheduling`, `closeScheduling`
- Remover `<SchedulingModal />`
- Remover prop `onScheduleClick` dos componentes filhos

**2. `src/components/Header.tsx`**
- Botão "Agendar Online" já usa `<Link>` — apenas confirmar que aponta para `/agendamento` (atualmente provavelmente `/agendar`)
- Remover prop `onScheduleClick`

**3. `src/components/HeroSection.tsx`**
- Trocar botão "Agendar consulta" de `onClick={onScheduleClick}` para `<Link to="/agendamento">` envolvendo o botão
- Manter tracking `trackCTAClick`
- Remover prop `onScheduleClick`

**4. `src/components/InsuranceSection.tsx`**
- Mesma troca: botão "Agendar consulta" vira `<Link to="/agendamento">`
- Manter tracking
- Remover prop `onScheduleClick`

## Resultado
- Todo clique em "Agendar Online" (header) ou "Agendar consulta" (hero, convênios) leva para `https://drjulianomachado.com/agendamento`
- Modal de agendamento na home é descontinuado (a página dedicada substitui com formulário idêntico + tracking otimizado)
- Eventos de tracking GTM/Meta Pixel preservados antes da navegação

