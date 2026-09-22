# Taxotools animations (Framer Motion)

Taxotools uses **Framer Motion** with Next.js App Router for lightweight, GPU-accelerated UI motion that respects `prefers-reduced-motion`.

## Architecture

```
apps/web/src/motion/
  config.ts                 # variants, transitions, easings, durations
  MotionProvider.tsx        # LazyMotion + MotionConfig
  PageTransition.tsx        # AnimatePresence mode="wait" by pathname
  AppMotionShell.tsx        # Root wrapper used in app/layout.tsx
  hooks/usePrefersReducedMotion.ts
  components/
    FadeIn, SlideUp, SlideInLeft, SlideInRight, ScaleIn
    StaggerChildren / StaggerItem
    AnimateOnScroll
    AnimatedCard, MotionButton, AnimatedTable
    RankTrackingChart / SovBar
    MotionModal / MotionDrawer / MotionDropdown
  index.ts                  # public exports
```

## Setup

- Dependency: `framer-motion` in `@taxotools/web`
- Root layout wraps the tree with `<AppMotionShell>` → `MotionProvider` + `PageTransition`
- `LazyMotion` + `domAnimation` keeps the bundle lean
- `MotionConfig reducedMotion="user"|"always"` follows OS settings

## Reusable components

| Component | Use |
|-----------|-----|
| `FadeIn` | Soft opacity entrance |
| `SlideUp` / `SlideInLeft` / `SlideInRight` | Directional entrances |
| `ScaleIn` | Modals, badges, hero planes |
| `StaggerChildren` + `StaggerItem` | Dashboard cards, toolkit grids |
| `AnimateOnScroll` | Marketing sections (viewport) |
| `AnimatedCard` | Hover/tap cards |
| `MotionButton` | Interactive CTAs |
| `AnimatedTable` | Staggered table rows |
| `RankTrackingChart` / `SovBar` | Rank + AEO charts |
| `MotionModal` / `MotionDrawer` / `MotionDropdown` | Overlays |

## Page transitions

`PageTransition` keys on `usePathname()` and wraps children in:

```tsx
<AnimatePresence mode="wait">
  <m.div key={pathname} variants={pageVariants} ... />
</AnimatePresence>
```

## Where motion is applied

- Marketing landing (`/`)
- Login form
- App chrome sidebar + mobile drawer
- Dashboard usage cards + site table
- Site toolkit overview cards
- Keywords + rank sparkline
- Technical crawl issue modal + rows
- AEO share-of-voice bars + chart + records table
- Tool workbench results tables
- Billing plan cards

## Accessibility

1. `usePrefersReducedMotion` swaps in no-op variants
2. CSS `@media (prefers-reduced-motion: reduce)` in `globals.css`
3. Overlays use `aria-modal` / labels; drawers/modals dismiss via backdrop

## Example

```tsx
import { StaggerChildren, StaggerItem, AnimatedCard } from "@/motion";

export function Cards({ items }) {
  return (
    <StaggerChildren className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <StaggerItem key={item.id}>
          <AnimatedCard className="p-5">{item.title}</AnimatedCard>
        </StaggerItem>
      ))}
    </StaggerChildren>
  );
}
```

## Performance notes

- Prefer `transform` + `opacity` (already used in variants)
- Avoid animating `width`/`height`/`top`/`left`
- Keep stagger delays ≤ ~60ms between children
- Charts animate `pathLength` / `scaleX` only
