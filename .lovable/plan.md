## Objetivo

Eliminar as rotas duplicadas `/agendar` e `/agendar-consulta` do projeto, mantendo apenas `/agendamento` como fluxo oficial de agendamento.

## Mudanças

### 1. `src/App.tsx`
- Remover imports `Agendar` e `AgendarConsulta`.
- Remover as `<Route path="/agendar">` e `<Route path="/agendar-consulta">`.
- Adicionar redirects 301-style (client-side) para `/agendamento` preservando query string, para não quebrar links externos/Google/anúncios:
  ```tsx
  <Route path="/agendar" element={<Navigate to={`/agendamento${location.search}`} replace />} />
  <Route path="/agendar-consulta" element={<Navigate to={`/agendamento${location.search}`} replace />} />
  ```

### 2. Deletar arquivos
- `src/pages/Agendar.tsx`
- `src/pages/AgendarConsulta.tsx`

### 3. Atualizar referências
- `src/lib/variacaoMensagensLembrete.ts`: trocar `LINK_AGENDAMENTO` de `https://drjulianomachado.com.br/agendar` para `https://drjulianomachado.com/agendamento`.
- `src/pages/admin/AuditoriaTracking.tsx`: remover entradas de `Agendar.tsx` e `AgendarConsulta.tsx` da lista auditada.

### 4. Não mexer
- Strings de UI ("Agendar consulta", "Agendar Online") que são apenas labels de botão.
- `src/pages/Agendamento.tsx` permanece como fluxo único.

## Resultado
- Apenas `/agendamento` ativo.
- Links antigos redirecionam automaticamente preservando UTMs.
- Sem quebra de tracking/Meta CAPI já implementado em `Agendamento.tsx`.