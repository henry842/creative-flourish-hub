

# Sentiment Page — Professional Redesign

## Changes (single file: `src/pages/Sentiment.tsx`)

### 1. Summary dashboard cards (top)
Add a row of 3 metric cards before the ticker cards:
- **Total empresas analisadas** — count of unique tickers
- **Sentimento predominante** — most common sentiment across all analyses, with large colored icon
- **Confiança média** — average confidence as percentage

### 2. Ticker cards — larger and more visual
- Increase card size, add a large sentiment score percentage in the center (calculated as % of analyses matching dominant sentiment)
- Large colored trend icon (TrendingUp green / TrendingDown red / Minus yellow)
- Show date of last analysis at the bottom
- "Sem ticker" → "Sem ticker identificado" with muted/dashed border style

### 3. History section — table format
Replace the card list with an HTML table using the existing `Table` components:
- Columns: Empresa | Sentimento | Confiança | Resumo | Data
- Alternating row colors via `even:bg-muted/50`
- Colored badges for sentiment

### 4. Sentiment filter buttons
Add filter row above the table: `Todos | Bullish | Bearish | Neutro`
- New state `sentimentFilter` controls which rows display
- Active button gets filled style, others outline

### 5. Visual polish
- Keep existing watchlist toggle and chart expansion functionality
- Keep existing empty state

No database changes needed. Single file edit.

