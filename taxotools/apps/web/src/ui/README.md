# Taxotools UI design system

Premium glass + neumorphism hybrid system for internal dashboards.

## Folders

| Path | Purpose |
|------|---------|
| `theme/` | Design tokens, light/dark themes, department overrides, `ThemeProvider` |
| `animations/` | Framer Motion variants + `FadeIn` / `SlideUp` / `ScaleIn` / `Stagger` |
| `components/` | Reusable primitives (cards, metrics, tables, FAB, sidebar, modal…) |
| `layouts/` | Shells for command center, analytics, marketing, blog, SEO audit |

## Quick start

```tsx
import {
  ThemeProvider,
  DashboardShell,
  MetricCard,
  ChartContainer,
  AnalyticsLayout,
  FadeIn,
} from "@/ui";

export function App() {
  return (
    <ThemeProvider defaultMode="light" defaultDepartment="default">
      <DashboardShell
        brand="Taxotools"
        subtitle="Agency workspace"
        navItems={[
          { id: "home", label: "Command center", href: "/app", active: true, icon: "⌘" },
        ]}
        fabActions={[{ id: "add", label: "Add site", href: "/onboarding", primary: true }]}
      >
        <AnalyticsLayout
          title="Visibility"
          metrics={
            <>
              <MetricCard label="Keywords" value={128} trend={12} />
              <MetricCard label="Health" value={86} gradient trend={4} />
            </>
          }
          primaryChart={
            <ChartContainer title="Trend" filters={[{ id: "7d", label: "7d" }]} activeFilter="7d" onFilterChange={() => {}}>
              <FadeIn>{/* chart */}</FadeIn>
            </ChartContainer>
          }
        />
      </DashboardShell>
    </ThemeProvider>
  );
}
```

## Themes

- **Modes:** `light` | `dark` via `useTheme().toggleMode()`
- **Departments:** `default` | `marketing` | `admin` | `ops` — accent + gradient overrides
- CSS variables are written to `:root` (`--accent-blue`, `--glass`, `--gradient-a`, …)

## Layout patterns

- `DashboardShell` — sticky glass header, collapsible smart sidebar, floating action bar
- `SplitView` — responsive primary/secondary columns
- `AnalyticsLayout` — metrics → charts → table/sidebar
- `MarketingWorkspaceLayout` — asymmetric campaign board
- `BlogManagementLayout` — pipeline / editor / insights
- `SeoAuditLayout` — collapsible severity-grouped issues

## Component variants

- `Button`: `solid` | `outline` | `ghost`
- `Card`: `glass` | `neu` | `solid` | `gradient`
- `MetricCard`: animated counters + trend chips
- `SmartTable`: sticky columns, stagger rows, double-click inline edit
- `StatusTag`: success / warn / danger / info / neutral

## Motion

Prefer `@/ui/animations` for new work. Existing `@/motion` wrappers remain for backward compatibility.
