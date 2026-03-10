

# FinSight AI — Mega Upgrade v2

Implementacao das features de maior impacto solicitadas, priorizadas por viabilidade e impressao visual.

---

## Batch 1: Perguntas Sugeridas no Chat + Ranking de Empresas + Pricing Page

### 1. Perguntas Sugeridas no Chat
- Adicionar botoes de perguntas prontas no Chat quando nao ha mensagens ainda ou apos resposta da IA
- Perguntas contextuais: "Qual o maior risco?", "Como estao as margens?", "Vale a pena investir?", "Quais sao os red flags?"
- Ao clicar, envia a pergunta automaticamente

### 2. Ranking de Empresas (Leaderboard)
- Nova pagina `/ranking` com tabela/cards de todas empresas analisadas
- Ordenado por Health Score (maior para menor)
- Exibe: posicao, ticker, score geral, sentimento, variacao de badges coloridas
- Link na sidebar

### 3. Pagina de Pricing
- Nova pagina `/pricing` acessivel da Landing Page
- 3 planos: Free, Pro ($29/mes), Enterprise ($99/mes)
- Cards com features listadas, botao CTA
- Puramente visual (sem cobranca real)

---

## Batch 2: Price Target com IA + Grafico de Evolucao do Score

### 4. Price Target
- Adicionar campo `price_target_low`, `price_target_high`, `price_target_rationale` na tabela `health_scores` (migration)
- Atualizar edge function `analyze-document` para incluir price target no tool calling
- Exibir no `HealthScoreCard` com badge de upside potencial

### 5. Grafico de Evolucao do Score por Ticker
- Na pagina Sentimento, quando ticker tem multiplos scores, exibir grafico de linha (Recharts) com evolucao do overall_score ao longo do tempo
- Mostra tendencia de melhora/piora

---

## Batch 3: Watchlist + Perguntas Sugeridas Dinamicas

### 6. Watchlist
- Nova tabela `watchlist` (user_id, ticker, created_at) com RLS
- Componente no Dashboard mostrando tickers favoritos com ultimo score e sentimento
- Botao de "favoritar" ticker nas paginas de documentos e sentimento

---

## Resumo Tecnico

```text
DB Migrations:
  └── health_scores: ADD price_target_low (int), price_target_high (int), price_target_rationale (text)
  └── watchlist: NEW TABLE (id, user_id, ticker, created_at) + RLS

Edge Functions:
  └── analyze-document: adicionar price_target ao tool calling schema

Pages (novas):
  ├── /ranking - leaderboard de empresas
  └── /pricing - planos Free/Pro/Enterprise (visual)

Pages (atualizadas):
  ├── Chat.tsx - botoes de perguntas sugeridas
  ├── Sentiment.tsx - grafico de evolucao por ticker
  └── Dashboard (Index.tsx) - watchlist widget

Sidebar:
  └── Adicionar "Ranking" com icone Trophy

Config:
  └── config.toml: sem mudancas (analyze-document ja existe)
```

Implementacao em ordem: Batch 1 (UI puro, rapido), Batch 2 (migration + edge function), Batch 3 (nova tabela + widget).

