

## Plan: Enhance Procedure Icons — Larger Size, Pulse Animation, Visual Polish

### Changes

**1. `src/components/ProceduresSection.tsx`** — Icon container and animation upgrades

- Increase icon container from `w-20 h-20` to `w-24 h-24` (96px)
- Increase icon SVG from `w-10 h-10` to `w-14 h-14` (56px)
- Add a subtle pulse glow animation on hover: an outer ring that pulses with `animate-pulse` using `primary` color at low opacity
- Add a gradient background to the icon container (radial gradient from `primary/15` to `primary/5`)
- Add a soft `shadow-lg shadow-primary/10` on hover for depth
- Add a subtle border (`border border-primary/10`) to the container, intensifying on hover (`group-hover:border-primary/25`)

**2. `src/components/ProcedureIcons.tsx`** — Visual improvements to all 9 SVGs

- Increase `strokeWidth` from `1.5` to `2` on primary strokes for better visibility at larger size
- Increase accent stroke widths proportionally (from `0.8`/`1` to `1`/`1.2`)
- Boost opacity values on accent elements (e.g., `0.4` → `0.5`, `0.6` → `0.7`) for better contrast
- Add subtle gradient fills to key elements (pupils, glows) using `<defs>` with radial gradients

**3. `src/index.css`** — Add pulse-glow keyframe

- Add a `@keyframes pulse-glow` animation that scales and fades an outer ring element
- CSS class `.animate-pulse-glow` for the hover state ring effect

### Visual result
- Icons appear ~20% larger and more detailed
- On hover: icon scales up, a soft glowing ring pulses outward, container gets a subtle shadow and brighter border
- All animations are smooth and subtle, matching the premium dark theme

