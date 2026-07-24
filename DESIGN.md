# FinSight — Design system

> Durable visual decisions. Tokens live in `src/index.css` (HSL CSS variables) and
> `tailwind.config.ts`. This file is the contract; the code is the source of exact values.

## Direction contract

**THESIS** — FinSight looks like an established, warm consumer-finance brand, not an "AI
tool." It refuses the generic AI-SaaS look (blue→emerald gradients, glassmorphism, emoji,
"Powered by AI" badges) *and* the equally generic AI-editorial look (cream paper + serif
display + terracotta accent). Instead it commits to **deep indigo as a field color** with a
warm porcelain canvas and a single terracotta spark.

**OWN-WORLD** — Warm porcelain neutrals; **deep indigo (`--primary`) as a committed field**
that owns whole regions (the app's sidebar spine, hero and CTA bands on marketing); a warm
**terracotta accent** used sparingly for one human spark per view; grotesk typography with a
point of view (**Bricolage Grotesque** display, **Hanken Grotesk** text), tabular figures
and a mono (**JetBrains Mono**) reserved for real data (tickers, scores, prices). Hairline
warm borders and soft, *offset* shadows — never blur/glass as decoration. Radius 0.75rem.

**STORY** — A retail investor lands, immediately understands "drop a PDF, get a graded
read," sees the actual product doing it, and signs up. Inside, the indigo spine frames a
calm, data-dense workspace they trust daily.

## Color strategy
**Committed** (indigo carries 30–60% of the signature surfaces). Two themes ship; **light
"warm daylight" is default** (welcoming, marketing/discovery), **dark "indigo ink"** for
evening/pro use. Never pick theme by category — both are first-class.

### Roles (see `src/index.css` for exact HSL)
- `--background` warm porcelain · `--foreground` indigo-ink near-black
- `--primary` deep indigo — brand, primary actions, committed fields
- `--accent` terracotta — one spark per view, never the default button color
- `--muted` / `--border` warm low-chroma neutrals
- Finance semantics (charts, badges): `--bullish` refined green · `--bearish` refined red ·
  `--neutral` amber. Terracotta is **not** part of the data palette (avoids red/orange clash).
- `--sidebar-*` deep indigo spine, warm-off-white nav, terracotta focus ring.

## Typography
- `--font-display` **Bricolage Grotesque** — headings, wordmark, hero. Characterful grotesk;
  our "editorial touch" without the serif cliché.
- `--font-sans` **Hanken Grotesk** — body, UI, controls. Warm, friendly workhorse.
- `--font-mono` **JetBrains Mono** — tickers, scores, prices, tabular data *only* (never as
  decoration for "technical" feel).
- Numbers use tabular figures. Tracking tightens on large display sizes.

## Surfaces & depth
- `.glass` is redefined: solid `--card`, hairline border, **soft offset shadow** — no
  backdrop blur. All former glassmorphism consumers inherit the calmer surface.
- `.gradient-text` is redefined to solid brand color — gradient text is banned; emphasis
  comes from weight, size, and the display face.
- Shadows always carry offset + blur. No zero-offset colored halos, no blurred color blobs.

## Motion
One authored moment per surface, not an identical fade on every section. Ease-out from an
already-visible default; respects `prefers-reduced-motion`.

## Bans (the "not-AI" floor)
No emoji in UI. No uppercase tracked eyebrow over every section (one named kicker system at
most). No same-size icon+heading+text card grid as page structure. No hero-metric template.
No section numbers unless the sequence carries meaning. No fake logos or "Screenshot"
placeholders — show the real product. No `border-left` accent > 1px.
