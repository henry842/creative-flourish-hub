# FinSight — Product truth

> Durable product context. What FinSight *is*, who it serves, and what must stay true
> regardless of how the interface looks. Visual decisions live in `DESIGN.md`.

## One-sentence mechanism
FinSight turns any financial PDF (FII reports, 10-Ks, earnings releases, CVM filings,
balance sheets) into a structured read in seconds — a 0–100 Health Score with five
sub-scores, AI-detected red flags, a price target, and a bull/bear/neutral read — then
lets the investor interrogate the documents by chat, compare assets head-to-head, rank a
portfolio, and receive an automated daily briefing.

## Who it's for
Brazilian retail and semi-professional investors (individuals, small family offices,
independent advisors) who read financial documents but don't have hours to comb 50-page
reports. Portuguese-first (pt-BR). They value clarity and trust over jargon.

## Core jobs
1. **Analyze** — upload a document, get Health Score, red flags, price target, sentiment.
2. **Ask** — chat over one or many documents with cross-document context.
3. **Compare** — two assets side-by-side ("Modo Batalha"), radar, saved history.
4. **Rank** — order the portfolio by score; track score movement over time.
5. **Automate** — scheduled daily briefing summarizing news + score changes for a watchlist.
6. **Account** — auth, profile, subscription plans (Free / Pro / Enterprise).

## Surfaces
- **Persuade:** `/landing`, `/pricing` — sell the product, earn the signup.
- **Operate:** `/` dashboard, `/assets`, `/assets/:id`, `/chat`, `/sentiment`,
  `/compare`, `/ranking`, `/briefing`, `/profile` — the working product.
- **Entry:** `/auth`, `/reset-password`.

## Stack (constraint, not up for redesign)
React 18 + TypeScript + Vite, Tailwind + shadcn/ui (Radix), React Router, TanStack Query,
Recharts. Backend: Supabase (auth, Postgres, storage, edge functions). Model inference via
Groq (Llama) for chat/analysis and a Gemini vision gateway for PDF OCR.

## Non-negotiable truths
- **Not investment advice.** Every surface that renders an analysis carries a disclaimer.
  FinSight is an analysis tool; it never issues a recommendation to buy or sell.
- **Grounded in the document.** Scores, flags and targets are derived from the uploaded
  file's real data — never invented. Copy must not overstate certainty.
- **The user's data is private.** Documents belong to the user; RLS scopes every row.

## Voice
Confident, plain, Brazilian-Portuguese. Explains finance without dumbing it down. No hype,
no emoji, no "revolutionary AI" theatrics. Talks like a sharp analyst, not a chatbot.
