

# FinSight AI — Mega Upgrade (9 Features)

Implementação em fases das funcionalidades solicitadas, priorizando impacto visual e funcional.

---

## Fase 1: Financial Health Score (Feature Principal)

### Database
- Nova tabela `health_scores` com colunas: `id`, `user_id`, `document_id`, `ticker`, `overall_score` (int), `revenue_growth` (int), `net_margin` (int), `debt_level` (int), `earnings_quality` (int), `regulatory_risk` (int), `red_flags` (jsonb array de strings), `created_at`
- RLS: cada usuario ve apenas seus scores

### Edge Function: `analyze-document`
- Recebe `document_id` + texto extraido do documento
- Usa Lovable AI (Gemini) com tool calling para retornar JSON estruturado com os 5 scores (0-100), red flags, e summary
- Salva resultado em `health_scores` e `sentiment_analyses`
- Atualiza status do documento para "processed"

### Frontend: Card Visual de Health Score
- Componente `HealthScoreCard` com score circular grande (0-100), cor dinâmica (verde >80, amarelo 60-80, vermelho <60)
- 5 barras de progresso com cores para cada subcategoria
- Exibido na página de Documentos ao lado de cada doc processado
- Red flags listadas com icone de alerta vermelho

---

## Fase 2: Red Flags Automaticas

- Incluido na mesma edge function `analyze-document` (campo `red_flags` no JSON)
- Componente `RedFlagsList` com ate 5 alertas em vermelho, exibido junto ao Health Score
- Icones de alerta e texto descritivo

---

## Fase 3: Timeline de Eventos

- Campo `timeline_events` (jsonb) na tabela `health_scores` retornado pela IA
- Componente `EventTimeline` visual com linha vertical e pontos, mostrando data + evento
- Exibido na pagina de detalhes do documento

---

## Fase 4: Modo Batalha (Comparador de Empresas)

### Nova pagina `/compare`
- Usuario seleciona 2 tickers dos seus documentos ja analisados
- Busca health scores de ambos no banco
- Exibe lado a lado: score geral, cada subcategoria com barras
- Declara vencedor por categoria com icone
- Rota adicionada no App.tsx e sidebar

---

## Fase 5: Landing Page Publica

### Nova pagina `/landing`
- Hero section com titulo, subtitulo e CTA "Comece Gratis"
- 3 feature cards (Chat IA, Health Score, Comparador)
- Secao de como funciona (3 passos)
- Footer simples
- Rota publica (sem auth), redireciona para `/auth` no CTA
- Alterar rota `/auth` como fallback para usuarios nao logados

---

## Fase 6: Onboarding para Novo Usuario

- Componente `OnboardingModal` com 3 passos:
  1. "Envie um PDF financeiro"
  2. "Pergunte ao FinSight no Chat"
  3. "Veja o Health Score e Sentimento"
- Exibido no primeiro login (flag `has_seen_onboarding` no perfil via localStorage)
- Botao "Pular" e "Proximo"

---

## Fase 7: Historico por Ticker

- Na pagina Sentimento, ao clicar num ticker, expande mostrando timeline com todos health scores e sentimentos daquele ticker ao longo do tempo
- Grafico de linha mostrando evolucao do score

---

## Fase 8: Export PDF

- Botao "Exportar Analise" na pagina de detalhes/health score
- Usa `window.print()` com CSS `@media print` estilizado para gerar PDF limpo
- Inclui health score, red flags, sentimento

---

## Fase 9: Finishing Touches

- **Dark/Light mode**: verificar que todas as paginas novas respeitam o tema
- **Responsivo mobile**: testar sidebar colapsavel, cards empilhados, input de chat
- **Favicon e Meta tags**: atualizar `index.html` com titulo "FinSight AI", descricao, og:image placeholder

---

## Resumo Tecnico de Mudancas

```text
DB Migration:
  └── health_scores (id, user_id, document_id, ticker, overall_score, 
      revenue_growth, net_margin, debt_level, earnings_quality, 
      regulatory_risk, red_flags jsonb, timeline_events jsonb, created_at)
  └── profiles: add has_seen_onboarding boolean (via localStorage, sem migration)

Edge Functions:
  └── analyze-document (novo) - processa PDF text via IA, retorna scores estruturados

Pages:
  ├── /landing (novo) - landing page publica
  ├── /compare (novo) - comparador de empresas  
  └── Atualizacoes em Documents, Sentiment, Dashboard, Index

Components (novos):
  ├── HealthScoreCard
  ├── RedFlagsList
  ├── EventTimeline
  ├── OnboardingModal
  ├── CompanyComparison
  └── LandingPage

Sidebar: adicionar "Comparar" e link landing
```

A implementacao sera feita em ordem de impacto: Health Score + Red Flags primeiro, depois Comparador e Landing Page, e por ultimo os finishing touches.

