

## Plan: Replace photos with icons in the Procedures section

### What changes

**File: `src/components/ProceduresSection.tsx`**

Replace the current image-based card layout with an icon-centered design:

1. Remove the image area (`<img>` tags, `imageErrors` state, `handleImageError` function, `image` property from procedures array)
2. Each card will display the SVG icon prominently (large, ~64-80px) centered at the top of the card with a subtle colored background circle/container
3. Keep the category badge, title, description, and all filtering/animation logic intact
4. Simplify the bento layout — since icons are uniform, use a consistent grid without featured/tall variants
5. Add a subtle hover effect on the icon (scale or color shift)

**File: `src/components/ProcedureIcons.tsx`**
- No changes needed — the 9 icons already exist and match all procedures

### Visual design

Each card will have:
- A rounded container with glassmorphism (`card-glass`)
- Icon centered at top inside a subtle `bg-primary/10` rounded circle
- Category badge positioned top-right
- Title and description below the icon
- Hover: icon scales up slightly, card lifts

### Grid layout
- 3 columns on desktop, 2 on tablet, 1 on mobile
- All cards same size (no bento irregularity)
- Consistent spacing and padding

