/**
 * Ghoast Shared Design Tokens
 * Consumed by both apps/web (CSS-in-JS / Tailwind) and apps/mobile (React Native StyleSheet).
 * Values are the single source of truth — never hardcode hex values in component files.
 *
 * Reference: DESIGN-NOTES.md and CLAUDE.md Ghost Tier Reference
 */

// ── Colours ──────────────────────────────────────────────────────────────────

export const colors = {
  // Background layers
  black: '#080810',
  slate: '#111120',
  slateLight: '#1A1A35',

  // Brand
  violet: '#7B4FFF',
  violetLight: '#9B6FFF',
  cyan: '#00E5FF',

  // Feedback
  red: '#FF3E3E',
  orange: '#FF7A3E',
  yellow: '#FFD166',
  green: '#00E676',

  // Text
  ghost: '#E8E8FF',
  muted: '#7070A0',
  white: '#FFFFFF',
} as const;

// ── Ghost Tiers ───────────────────────────────────────────────────────────────

export const tiers = {
  1: { label: 'Safe to Cut', color: '#FF3E3E', scoreMin: 0, scoreMax: 20 },
  2: { label: 'Probably Cut', color: '#FF7A3E', scoreMin: 21, scoreMax: 40 },
  3: { label: 'Your Call', color: '#FFD166', scoreMin: 41, scoreMax: 60 },
  4: { label: 'Might Keep', color: '#7B4FFF', scoreMin: 61, scoreMax: 80 },
  5: { label: 'Keep Following', color: '#00E676', scoreMin: 81, scoreMax: 100 },
} as const;

export type TierNumber = keyof typeof tiers;

// ── Typography ────────────────────────────────────────────────────────────────

export const fonts = {
  sans: 'Outfit',       // UI text, headings
  mono: 'DM Mono',      // Scores, counts, timestamps
} as const;

export const fontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

// ── Spacing (4px base unit) ───────────────────────────────────────────────────

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// ── Border radius ─────────────────────────────────────────────────────────────

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// ── Pricing ───────────────────────────────────────────────────────────────────

export const pricing = {
  free: { label: 'Free', price: 0, priceDisplay: '$0' },
  pro: { label: 'Pro', price: 9.99, priceDisplay: '$9.99/mo' },
  proPlus: { label: 'Pro+', price: 24.99, priceDisplay: '$24.99/mo' },
  credits100: { label: 'Starter Pack', credits: 100, price: 2.99, priceDisplay: '$2.99' },
  credits500: { label: 'Standard Pack', credits: 500, price: 9.99, priceDisplay: '$9.99' },
  credits1500: { label: 'Power Pack', credits: 1500, price: 19.99, priceDisplay: '$19.99' },
} as const;
