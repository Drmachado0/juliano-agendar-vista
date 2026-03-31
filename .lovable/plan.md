

# Efeitos Visuais — Typing Effect + Parallax Scroll

## 1. Typing Effect no Hero (`src/components/HeroSection.tsx`)

Adicionar efeito de digitacao no texto "cuidado especializado" do h1:
- Criar hook `useTypingEffect` inline ou estado local que revela caracteres um a um
- Texto comeca vazio, digita ~60ms por caractere, com cursor piscante `|`
- Inicia apos o slide-up do h1 terminar (~400ms delay)
- Cursor desaparece apos completar a digitacao
- Apenas no span `gradient-text`, o "Sua visao merece" aparece normalmente

## 2. Parallax no Scroll (`src/hooks/useParallax.ts` — novo)

Criar hook `useParallax` que retorna um valor de offset baseado no scroll:
- Usa `scroll` event com `requestAnimationFrame` para performance
- Retorna `transform: translateY(offset)` proporcional ao scroll

Aplicar em 3 pontos:
- **Hero**: foto do Dr. Juliano move mais lento que o texto (parallax sutil, fator 0.15)
- **Hero background glow**: move em direcao oposta (fator -0.1)
- **AboutSection**: foto e card de credenciais com parallax leve (fator 0.08)

## Arquivos alterados

| Arquivo | Mudanca |
|---|---|
| `src/components/HeroSection.tsx` | Typing effect no titulo + parallax na foto e glow |
| `src/hooks/useParallax.ts` | Novo hook reutilizavel |
| `src/components/AboutSection.tsx` | Parallax na foto |

Nenhuma secao adicionada/removida. Nenhum layout alterado. Todos os trackers mantidos.

