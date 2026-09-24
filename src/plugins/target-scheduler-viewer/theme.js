// Consumes Touch'N'Stars' own design tokens (src/assets/tailwind.css @theme
// block) via CSS custom properties, instead of a separate hardcoded palette —
// stays in sync with the app's look automatically.
export const THEME = {
  surface1: 'var(--color-ground)',
  surface2: 'var(--color-surface-1)',
  surface3: 'var(--color-surface-2)',
  border: 'var(--color-line)',
  borderStrong: 'var(--color-line-strong)',
  inkPrimary: 'var(--color-content)',
  inkSecondary: 'var(--color-content-muted)',
  inkMuted: 'var(--color-content-faint)',
  accent: 'var(--color-accent)',
  accentAction: 'var(--color-accent-action)',
  good: 'var(--color-status-ok)',
  goodBg: 'color-mix(in srgb, var(--color-status-ok) 16%, transparent)',
  warning: 'var(--color-status-warn)',
  warningBg: 'color-mix(in srgb, var(--color-status-warn) 16%, transparent)',
  critical: 'var(--color-status-danger)',
  criticalBg: 'color-mix(in srgb, var(--color-status-danger) 16%, transparent)',
  track: 'var(--color-surface-3)',
};
