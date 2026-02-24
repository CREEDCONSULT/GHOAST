# DESIGN-NOTES.md — Ghoast Design System

**Version:** 1.0 | Derived from `ghoast-brand.jsx` and `ghoast-marketing.docx`
**Purpose:** Complete design system reference for designers and frontend developers. All values are exact — taken directly from the brand JSX file.

---

## Design Principles

1. **Dark-humor intelligence** — The product knows what it does and says so without flinching. The UI matches: precise, slightly knowing, never cheerful.
2. **Data first** — Every screen should surface a number. Numbers are the brand's primary visual element. Make them large and legible.
3. **Haunted-data aesthetic** — Dark backgrounds, violet/cyan accent glow, subtle noise texture. Feels like something intelligent lives inside the UI.
4. **Never moralise** — UI copy never says "improve your mental health" or "curate your feed." It says "clean your list" and "improve your ratio." The brand mocks the situation, never the user.
5. **Earned minimalism** — No decorative clutter. Every UI element earns its space by serving the data or the action. Glassmorphism effects are used sparingly and purposefully.

---

## Color Palette

All colors are defined as CSS custom properties on `:root`. Use these variables — never hardcode hex values in component styles.

```css
:root {
  /* ── Base surfaces ── */
  --black:   #080810;   /* Page background — deepest layer */
  --slate:   #111120;   /* Cards, panels, modals */
  --slate2:  #181830;   /* Secondary surfaces, topbars */
  --specter: #1A1A3A;   /* Tertiary surfaces, inner card elements */

  /* ── Brand accents ── */
  --violet:     #7B4FFF;              /* Primary accent — buttons, borders, active states */
  --violet-lo:  rgba(123,79,255,.14); /* Violet tint for backgrounds */
  --violet-mid: rgba(123,79,255,.35); /* Violet for borders, hover states */
  --cyan:       #00E5FF;              /* Secondary accent — live indicators, highlights */
  --cyan-lo:    rgba(0,229,255,.1);   /* Cyan tint for subtle highlights */

  /* ── Semantic colors ── */
  --red:   #FF3E3E;   /* Danger / Tier 1 / cut / destructive */
  --green: #00E676;   /* Safe / Tier 5 / keep / success */

  /* ── Text ── */
  --ghost: #E8E8FF;   /* Primary text — slightly blue-tinted white */
  --muted: #7070A0;   /* Secondary text, labels, captions */

  /* ── Gradients ── */
  --grad:      linear-gradient(135deg, #7B4FFF 0%, #00E5FF 100%);  /* Violet → Cyan */
  --grad-r:    linear-gradient(135deg, #00E5FF 0%, #7B4FFF 100%);  /* Cyan → Violet */
  --grad-soft: linear-gradient(135deg, rgba(123,79,255,.25) 0%, rgba(0,229,255,.25) 100%);
}
```

### Color Usage Rules
- **`--black`** — only for the page background and nav backdrop
- **`--slate`** — standard card/panel background
- **`--specter`** — inner elements within cards (stat boxes, list items)
- **`--violet`** — CTAs, active nav items, tier 4 color, primary borders
- **`--cyan`** — live pulse dots, data highlights, secondary CTAs
- **`--red`** — Tier 1 only. Never use for general errors — use a neutral warning style for system errors to avoid confusion with ghost tiers
- **`--green`** — Tier 5 only. Success states use a lighter variant

---

## Ghost Tier Color System

Each tier has an assigned color, glow treatment, and label. These values must not change.

| Tier | Label | Hex | Glow Shadow |
|------|-------|-----|-------------|
| 1 | Safe to Cut | `#FF3E3E` | `0 0 6px #FF3E3E88` |
| 2 | Probably Cut | `#FF7A3E` | `0 0 6px #FF7A3E88` |
| 3 | Your Call | `#FFD166` | `0 0 6px #FFD16688` |
| 4 | Might Keep | `#7B4FFF` | `0 0 6px #7B4FFF88` |
| 5 | Keep Following | `#00E676` | `0 0 6px #00E67688` |

**Glow treatment:** Apply `box-shadow` with the color at 53% opacity (`88` in hex) on tier indicator dots. Scale up glow on hover.

**Tier dot:**
```css
.tier-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tier-color);
  box-shadow: 0 0 6px color-mix(in srgb, var(--tier-color) 53%, transparent);
}
```

---

## Typography

### Font Families

| Role | Font | Import Source |
|------|------|---------------|
| Headers / Display | Outfit | Google Fonts |
| Body / UI | Outfit | Google Fonts |
| Data / Numbers / Monospace | DM Mono | Google Fonts |

```html
<!-- Google Fonts import -->
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
```

**Note:** Cabinet Grotesk is referenced in the brand spec but is NOT in the current Google Fonts import in `ghoast-brand.jsx`. Outfit is used for both headers and body. Use Outfit unless Cabinet Grotesk is separately licensed.

### Font Usage

| Context | Font | Weight | Notes |
|---------|------|--------|-------|
| Hero title / H1 | Outfit | 900 | `letter-spacing: -3px`, `line-height: .95` |
| Section titles / H2 | Outfit | 900 | `letter-spacing: -1.5px`, `line-height: 1.05` |
| Card titles | Outfit | 700 | `letter-spacing: -.3px` |
| Body text | Outfit | 400 | `line-height: 1.6` |
| Navigation | Outfit | 500–800 | Links: 500, CTA: 700, Wordmark: 800 |
| Data values (counts, stats) | DM Mono | 500 | No letter-spacing |
| Labels, badges, caps | Outfit | 600–700 | `text-transform: uppercase`, `letter-spacing: .08-.12em` |
| Price amounts | Outfit | 900 | `letter-spacing: -2px` |

### Responsive Type Scale (clamp)

```css
/* Hero title */
font-size: clamp(56px, 9vw, 108px);

/* Section titles */
font-size: clamp(36px, 5vw, 56px);

/* Hero subtitle */
font-size: clamp(16px, 2vw, 20px);
```

---

## Layout System

### Max-width Containers
```css
.section          { max-width: 1200px; margin: 0 auto; }
.pricing-inner    { max-width: 1100px; margin: 0 auto; }
.stat-strip-inner { max-width: 1100px; margin: 0 auto; }
.dash-inner       { max-width: 1100px; margin: 0 auto; }
```

### Section Padding
```css
/* Standard full sections */
.section, .tier-section, .pricing-section { padding: 100px 48px; }

/* Dashboard preview */
.dash-preview { padding: 100px 48px; }

/* Stat strip (tighter) */
.stat-strip { padding: 64px 48px; }

/* Footer */
footer { padding: 48px; }
```

### Grid Patterns
```css
/* How It Works — 3 column */
.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }

/* Tier section — 2 column */
.tier-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }

/* Pricing — 3 column */
.pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }

/* Stats strip — 4 column */
.stat-strip-inner { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; }

/* Dashboard stats row — 4 column */
.dc-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }

/* Dashboard content row — 2 column */
.dc-row { display: grid; grid-template-columns: 1fr 1.2fr; gap: 10px; }
```

---

## Background System

Three-layer background system creates depth without performance cost:

### Layer 1 — Page Background
```css
body { background: var(--black); } /* #080810 */
```

### Layer 2 — Noise Texture
```css
.noise {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: .35;
  background-image: url("data:image/svg+xml,...fractalNoise...");
}
```
Subtle film grain over the entire page. Fixed position — does not scroll.

### Layer 3 — Orb Glows
Three positioned radial blurs that create ambient glow:
```css
.orb { position: fixed; border-radius: 50%; filter: blur(90px); pointer-events: none; z-index: 0; }
.orb1 { width: 500px; height: 500px; background: rgba(123,79,255,.1);  top: -150px;  right: -80px; }
.orb2 { width: 350px; height: 350px; background: rgba(0,229,255,.06);  bottom: -80px; left: -100px; }
.orb3 { width: 200px; height: 200px; background: rgba(123,79,255,.08); top: 40%;     left: 30%; }
```

**Note:** All content must be `z-index: 1` or higher to render above the noise and orbs.

---

## Navigation

```css
nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  height: 64px;
  padding: 0 48px;
  background: rgba(8,8,16,.8);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(123,79,255,.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

**Logo mark:** 32×32px, 9px border-radius, violet gradient background, "G" in white at font-size 13px weight 900.
**Wordmark:** "Gh**oa**st" — the "oa" characters use the gradient text treatment.
**Nav links:** 14px / weight 500 / color `--muted` → `--ghost` on hover.
**CTA button:** Gradient background, 9px border-radius, `0 0 20px rgba(123,79,255,.35)` glow.

---

## Badge / Pill Component

Used for section labels, live indicators, tier count badges.

```css
/* Section badge (purple tint) */
.section-badge {
  background: var(--violet-lo);
  border: 1px solid var(--violet-mid);
  border-radius: 20px;
  padding: 5px 14px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--violet);
}

/* Hero badge (cyan variant) */
.hero-badge {
  /* Same structure but color: var(--cyan) */
  font-size: 12px;
  letter-spacing: .1em;
}
```

---

## Button Styles

### Primary CTA (gradient)
```css
.btn-primary {
  background: var(--grad);
  color: #fff;
  border: none;
  padding: 16px 36px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  font-family: 'Outfit', sans-serif;
  letter-spacing: -.3px;
  box-shadow: 0 0 40px rgba(123,79,255,.4);
  transition: all .2s;
  cursor: pointer;
}
.btn-primary:hover {
  box-shadow: 0 0 60px rgba(123,79,255,.6);
  transform: translateY(-2px);
}
```

### Ghost / Secondary Button
```css
.btn-ghost-btn {
  background: transparent;
  color: var(--ghost);
  border: 1px solid rgba(255,255,255,.12);
  padding: 16px 36px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  transition: all .2s;
}
.btn-ghost-btn:hover {
  border-color: rgba(123,79,255,.5);
  background: var(--violet-lo);
}
```

### Small Nav CTA
```css
.nav-cta {
  background: var(--grad);
  padding: 9px 22px;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 0 20px rgba(123,79,255,.35);
}
```

---

## Card Component

Standard card pattern used across sections:

```css
.card-base {
  background: var(--slate);
  border: 1px solid rgba(123,79,255,.18);
  border-radius: 18px;
  padding: 32px;
  position: relative;
  overflow: hidden;
  transition: all .25s;
}
.card-base:hover {
  border-color: var(--violet-mid);
  transform: translateY(-4px);
  box-shadow: 0 20px 60px rgba(123,79,255,.12);
}

/* Optional: gradient overlay on hover */
.card-base::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--grad-soft);
  opacity: 0;
  transition: opacity .25s;
}
.card-base:hover::before { opacity: 1; }
```

**Featured card variant** (pricing):
```css
.card-featured {
  border-color: var(--violet);
  background: linear-gradient(180deg, var(--specter) 0%, var(--slate) 100%);
  box-shadow: 0 0 60px rgba(123,79,255,.18);
}
.card-featured::after {
  /* Top gradient accent line */
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: var(--grad);
}
```

---

## Widget (Ghost Analysis Widget)

The hero widget is the product's main visual showcase.

```css
.hero-widget {
  width: 100%;
  max-width: 720px;
  background: var(--slate);
  border: 1px solid var(--violet-mid);
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 0 60px rgba(123,79,255,.12), 0 40px 80px rgba(0,0,0,.4);
}
/* Top accent line */
.hero-widget::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: var(--grad);
}
```

**Stat boxes inside widget:**
```css
.wstat {
  background: var(--specter);
  border-radius: 12px;
  padding: 18px;
  text-align: center;
  border: 1px solid rgba(123,79,255,.15);
}
.wstat-val { font-family: 'DM Mono', monospace; font-size: 28px; font-weight: 500; }
.wstat-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
```

---

## Gradient Text Treatment

Used on brand wordmark ("oa" in Ghoast), hero title line 2, key stats.

```css
.gradient-text {
  background: var(--grad);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

**With glow underline** (hero title):
```css
.gradient-text::after {
  content: '';
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 3px;
  background: var(--grad);
  border-radius: 3px;
  opacity: .4;
  filter: blur(3px);
}
```

---

## Live Indicator (Pulse Dot)

Used for "Live Data" badges and the queue countdown.

```css
.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--cyan);
  box-shadow: 0 0 8px var(--cyan);
  animation: pulse 1.8s ease infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: .3; }
}
```

---

## Progress Bars (Tier Fill Bars)

```css
.bar-track {
  flex: 1;
  height: 4px;           /* thin: widget tier bars */
  /* or */
  height: 8px;           /* medium: tier section bars */
  background: var(--slate2);
  border-radius: 4px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 4px;
  background: var(--tier-color); /* passed as inline style */
  transition: width 1.2s ease;   /* animated on mount */
}
```

**Mount animation:** Start at `width: 0%`, transition to actual value after 600ms delay (see `setBars(true)` in the JSX after a `setTimeout`).

---

## Animation System

```css
/* Entrance animation — used on hero section elements */
@keyframes fadeUp {
  from { transform: translateY(20px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

/* Staggered delays applied per element: */
/* .hero-badge        { animation: fadeUp .6s ease both; } */
/* .hero-title        { animation: fadeUp .6s .1s ease both; } */
/* .hero-sub          { animation: fadeUp .6s .2s ease both; } */
/* .hero-actions      { animation: fadeUp .6s .3s ease both; } */
/* .hero-proof        { animation: fadeUp .6s .4s ease both; } */
/* .hero-widget       { animation: fadeUp .6s .5s ease both; } */

/* Fade in (no movement) */
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* Scrolling marquee */
@keyframes marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
.marquee-track {
  display: flex;
  gap: 48px;
  width: max-content;
  animation: marquee 22s linear infinite;
}
```

---

## Glassmorphism Treatment

Used on nav and marquee backgrounds:

```css
/* Nav */
background: rgba(8,8,16,.8);
backdrop-filter: blur(20px);

/* Marquee wrap */
background: rgba(8,8,16,.6);
backdrop-filter: blur(8px);
```

---

## Dashboard Shell

Mimics a browser window — used in the landing page dashboard preview section.

```css
.dash-frame {
  background: var(--slate);
  border: 1px solid var(--violet-mid);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 0 80px rgba(123,79,255,.15), 0 60px 120px rgba(0,0,0,.5);
}

/* Browser "traffic light" dots in topbar */
.dash-topbar { background: var(--slate2); border-bottom: 1px solid rgba(123,79,255,.15); padding: 14px 24px; }
/* dot 1: #FF5F57 (red), dot 2: #FEBC2E (yellow), dot 3: #28C840 (green) */

/* 2-column dashboard layout */
.dash-body { display: grid; grid-template-columns: 200px 1fr; min-height: 420px; }
```

---

## Pricing Card Tiers

Three-column pricing grid. Middle card (Pro) is "featured".

| Variant | Border | Background | Shadow |
|---------|--------|-----------|--------|
| Standard | `rgba(123,79,255,.2)` | `var(--slate)` | None |
| Featured (Pro) | `var(--violet)` | Gradient slate → slate | `0 0 60px rgba(123,79,255,.18)` |

Featured card has a "Most Popular" badge (top-right, gradient background) and a gradient top border line.

---

## Brand Voice in UI Copy

Apply these rules to every piece of in-app text:

| Rule | Example — Do | Example — Don't |
|------|-------------|----------------|
| Use owned vocabulary | "131 ghosts found" | "131 non-followers found" |
| Use numbers always | "47 accounts you could cut right now" | "Many accounts to remove" |
| Short sentences | "Cleaned." | "Your list has been cleaned successfully." |
| Direct CTAs | "Ghost the Ghosts" | "Start unfollowing process" |
| Ratio over morality | "Improve your ratio" | "Curate a healthier feed" |
| Dark humour, not meanness | "They didn't follow back. Now you know." | "These accounts are ignoring you." |
| Present tense | "Queue active — unfollowing 20 of 67" | "The queue is currently processing your requests" |

### Key UI Strings (canonical — use these exactly)

```
Primary CTA:        "Scan My Account Free →"
Nav CTA:            "Start Free — It's Instant"
Queue CTA:          "Ghost the Ghosts — Start Bulk Unfollow"
Free upgrade hook:  "See your ghost list for free."
Tier 5 tooltip:     "Auto-protected"
Live badge:         "Live Data"
Empty state:        "No ghosts here. You're clean." (if zero ghosts)
```

---

## Iconography

No icon library in V1 — emoji icons are used in the landing page for step icons:
- Connect: 🔗
- Ghost list: 👻
- Bulk action: ⚡

For the app dashboard in production, use a minimal icon set (Lucide React or Phosphor Icons) — match the weight and style to the Outfit font (thin to medium weight, no heavy fills).

---

## Responsive Behaviour

The landing page uses `clamp()` for fluid type sizes. Grid layouts collapse on mobile:

```css
/* Steps grid: 3-col → 1-col */
@media (max-width: 768px) {
  .steps { grid-template-columns: 1fr; }
  .tier-inner { grid-template-columns: 1fr; }
  .pricing-grid { grid-template-columns: 1fr; }
  .stat-strip-inner { grid-template-columns: repeat(2, 1fr); }
  nav { padding: 0 24px; }
  .nav-links { display: none; } /* Mobile nav TBD */
}
```

The dashboard app should be designed mobile-first with a collapsible sidebar for screens below 768px.

---

## Do Not

- Do not use light backgrounds anywhere — Ghoast is exclusively dark-mode
- Do not use rounded corners larger than 20px — max `border-radius: 20px`
- Do not add drop shadows unless they use violet or black — no grey/white shadows
- Do not use serif fonts at any size
- Do not use white (`#FFFFFF`) — use `--ghost` (`#E8E8FF`) for primary text
- Do not use pure black (`#000000`) — use `--black` (`#080810`)
- Do not add gradient effects to body text or labels — gradients are for display text and data values only
- Do not animate anything that moves the layout (no width/height animations) — only opacity and transform
