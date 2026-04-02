

# Avaliacao Frontend-Design — Landing Page Dr. Juliano Machado

## Diagnostico pela Skill

A skill `frontend-design.md` avalia interfaces em 5 eixos. Aqui esta o diagnostico atual e as melhorias propostas:

### 1. Tipografia — ATENCAO
- **Problema**: Inter e usada como body font. A skill classifica Inter como "generic AI aesthetic" a ser evitada.
- **Porem**: o projeto ja tem regras explicitas de NAO mudar fontes (Inter + Cormorant Garamond). Cormorant Garamond nos headings e uma escolha forte e distintiva. **Recomendo manter ambas** respeitando as regras do projeto.
- **Melhoria possivel**: Aumentar o contraste tipografico — usar pesos mais ousados nos headings (700→800), letter-spacing mais dramatico nos badges/labels.

### 2. Cor e Tema — BOM
- Navy + Gold e uma paleta forte, coesa e premium. Nao e generica. A tokenizacao via CSS variables esta correta.
- **Melhoria**: Os tons de `muted-foreground` (55% lightness) podem ser levemente mais claros (58-60%) para melhor legibilidade sem perder o tom premium.

### 3. Motion/Animacoes — PRECISA MELHORAR
- **Problema**: Todas as secoes usam o mesmo padrao: `opacity-0 translate-y-8` → `opacity-100 translate-y-0`. E previsivel e repetitivo.
- **Melhorias propostas**:
  - Hero: staggered reveal mais dramatico com delays maiores entre elementos
  - About: foto entra com leve rotacao (rotate-1 → rotate-0) alem do translate
  - Procedures: cards entram em cascata com scale (0.95→1) em vez de apenas translateY
  - Testimonials: fade com blur (blur-sm → blur-0) para efeito "focus"
  - Adicionar `transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) para animacoes mais organicas

### 4. Composicao Espacial — PRECISA MELHORAR
- **Problema**: Todas as secoes seguem o mesmo padrao: badge → titulo → subtitulo → grid. Previsivel.
- **Melhorias propostas**:
  - Hero: stat cards com leve overlap na foto (margin-top negativo no mobile)
  - About: card de credenciais com rotacao sutil (-2deg) para quebrar a rigidez
  - Procedures: header alinhado a esquerda em desktop (quebrar simetria)
  - Footer: layout assimetrico (brand ocupa mais espaco)

### 5. Backgrounds e Detalhes Visuais — MEDIO
- **Bom**: grid sutil no hero, glow effects, gradientes de fundo
- **Melhorias propostas**:
  - Adicionar noise/grain texture sutil (CSS background com SVG data URI) no hero e CTA final
  - Separadores entre secoes mais expressivos (linha gradiente + small glow)
  - Cards de procedimentos: hover com glow sutil na borda esquerda dourada

---

## Plano de Implementacao (priorizado por impacto)

### Fase 1 — Animacoes (maior impacto visual, menor risco)

**`src/index.css`**:
- Adicionar nova timing function: `.ease-out-expo { transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1); }`
- Adicionar keyframe `blurIn`: de `opacity:0; filter:blur(4px)` para `opacity:1; filter:blur(0)`
- Adicionar classe `.animate-blur-in`

**`src/components/HeroSection.tsx`**:
- Aumentar delays entre elementos (200→300→450→600→800ms) para stagger mais dramatico
- Trust badge: usar `animate-blur-in` em vez de `animate-fade-in`

**`src/components/AboutSection.tsx`**:
- Foto: adicionar `rotate-1` no estado inicial, `rotate-0` no visivel
- Card credenciais: leve `rotate-[-2deg]` permanente

**`src/components/ProceduresSection.tsx`**:
- Cards: trocar `translate-y-12` por `translate-y-8 scale-95` → `translate-y-0 scale-100`

**`src/components/TestimonialsSection.tsx`**:
- Cards: adicionar `blur-sm` no estado oculto, `blur-0` no visivel

### Fase 2 — Texturas e profundidade

**`src/index.css`**:
- Adicionar classe `.noise-texture` com SVG noise via `background-image: url("data:image/svg+xml,...")` em opacidade 3-4%
- Aplicar no hero-gradient

**`src/components/HeroSection.tsx`**:
- Adicionar `noise-texture` ao container do hero

**`src/components/InsuranceSection.tsx`**:
- CTA card: adicionar `noise-texture` para mais profundidade

### Fase 3 — Composicao (ajustes sutis)

**`src/components/ProceduresSection.tsx`**:
- Header: `text-center` → `text-center lg:text-left` em desktop

**`src/components/AboutSection.tsx`**:
- Card credenciais: adicionar `transform rotate-[-1.5deg] hover:rotate-0 transition-transform`

### Restricoes respeitadas
- NAO muda fontes (Inter + Cormorant Garamond)
- NAO muda cores primarias ou background
- NAO adiciona secoes ou componentes novos
- NAO toca em componentes admin, scheduling ou ui
- Mantem todos os event handlers e tracking
- Mantem todos os scripts do index.html

