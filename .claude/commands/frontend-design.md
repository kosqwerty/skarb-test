# frontend-design

Create distinctive, production-grade frontend interfaces with high design quality. Avoid generic "AI slop" aesthetics — commit to a real conceptual direction and execute it with precision.

## Before writing any code, establish:

1. **Purpose** — What problem does this interface solve? Who uses it?
2. **Tone** — Pick an extreme aesthetic direction: minimalist, maximalist, retro-futuristic, luxury, playful, brutalist, glassmorphism, etc.
3. **Constraints** — Technical requirements, existing CSS variables, framework limitations
4. **Differentiation** — What makes this screen unforgettable vs. a generic dashboard?

## Design principles to apply

### Typography
- Use distinctive, characterful fonts — avoid Arial, Inter, Roboto as defaults
- Establish a clear type hierarchy: display / heading / body / caption
- Use size contrast boldly — large headlines with small body text creates rhythm

### Color & Theme
- Commit fully to a cohesive aesthetic
- Use CSS variables (`--primary`, `--bg-surface`, etc.) from `css/main.css`
- One dominant color, one sharp accent, neutrals for everything else
- Dark mode and light mode must both look intentional

### Motion & Animation
- Focus animation on high-impact moments: page load, modal open, state change
- Use staggered reveals for lists (`animation-delay: calc(var(--i) * 60ms)`)
- Hover states on every interactive element
- Respect `prefers-reduced-motion` — wrap animations in media query
- Prefer CSS transitions over JS-driven animation where possible
- Standard easing: `cubic-bezier(0.4, 0, 0.2, 1)` for most transitions

### Spatial Composition
- Break the grid occasionally — asymmetry creates visual interest
- Use whitespace deliberately, not as an afterthought
- Layer elements with `z-index` and `box-shadow` for depth
- Overlap cards, images, and containers for richness

### Backgrounds & Visual Details
- Add atmosphere: subtle gradients, noise textures, geometric patterns
- Use `backdrop-filter: blur()` for glass effects
- Border-radius consistency — pick a scale and stick to it
- Micro-details: custom scrollbars, focus rings, loading skeletons

## What to avoid

- Generic layouts copied from every SaaS dashboard
- Default browser fonts and system color palettes
- Transitions shorter than 150ms (imperceptible) or longer than 500ms (sluggish)
- `display: none` toggles without transition (use opacity + visibility)
- Hover effects only on desktop — touch targets need `:active` states too
- Hardcoded hex colors — always use CSS variables from `css/main.css`

## Implementation notes for this project

- All colors via `var(--primary)`, `var(--border)`, `var(--bg-surface)`, `var(--text-muted)`, etc.
- CSS lives in `css/main.css` — add new utility classes there, not inline styles
- JS animations go in the page module (`js/pages/*.js`) after `container.innerHTML`
- Test both light and dark themes (`body.light-theme`)
- Mobile breakpoint: `@media (max-width: 768px)`

## Respond with

1. A brief design concept (2-3 sentences on tone and direction)
2. The full HTML/CSS/JS implementation
3. Notes on any animations and how to test them
