## Atualizar foto do hero

Substituir a imagem atual do Dr. Juliano no hero pela nova foto enviada (consultório com lâmpada de fenda).

### Passos
1. Copiar a nova imagem para `src/assets/dr-juliano-hero-source.png` (original).
2. Gerar versões otimizadas mantendo os mesmos nomes já importados pelo `HeroSection.tsx`:
   - `src/assets/dr-juliano-hero.webp` (≈900px largura)
   - `src/assets/dr-juliano-hero@2x.webp` (≈1400px largura)
   - `src/assets/dr-juliano-hero.jpg` (fallback)
3. Atualizar também `src/pages/Agendamento.tsx` (que usa o `.jpg`) — sem alteração de import, apenas o asset será trocado.
4. QA visual: abrir as imagens otimizadas para verificar enquadramento (rosto centralizado, sem corte) e nitidez.

### Detalhes técnicos
- Reutilizar os mesmos nomes de arquivo evita mudanças em `HeroSection.tsx` e `Agendamento.tsx`.
- Compressão alvo: WebP qualidade ~82, JPG qualidade ~85, mantendo arquivos abaixo de ~150KB.
- Dimensões fonte preservam aspect ratio ~3:4 já usado no container do hero.
