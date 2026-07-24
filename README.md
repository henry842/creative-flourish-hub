# FinSight

Leia qualquer relatório financeiro em segundos. Envie um PDF — relatório de FII, 10-K,
release de resultados ou informe CVM — e o FinSight devolve um **Health Score de 0 a 100**
com cinco subcategorias, **red flags** detectadas, **preço-alvo** e leitura de **sentimento**.
Depois, converse com os documentos, compare ativos lado a lado, ordene sua carteira por
score e receba um **briefing diário** automático.

## Recursos

- **Análise de documentos** — Health Score, subcategorias, red flags, preço-alvo e sentimento, sempre a partir dos dados reais do relatório.
- **Chat sobre documentos** — perguntas em linguagem natural com contexto cruzado entre vários arquivos.
- **Modo Batalha** — comparação de dois ativos com gráfico radar e histórico salvo.
- **Ranking** — carteira ordenada por score, com evolução ao longo do tempo.
- **Briefing diário** — resumo agendado de notícias e variações de score da watchlist.
- **Contas e planos** — autenticação, perfil e assinatura (Free / Pro / Enterprise).

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui (Radix) · TanStack Query · Recharts ·
Supabase (auth, Postgres, storage, edge functions) · inferência via Groq e OCR por visão computacional.

## Desenvolvimento

```bash
npm install
npm run dev        # http://localhost:8080
npm run build      # build de produção em dist/
npm run test       # testes unitários (Vitest)
npm run lint
```

Crie um arquivo `.env` na raiz com as chaves do seu projeto Supabase:

```
VITE_SUPABASE_URL="https://SEU-PROJETO.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sua-anon-key"
VITE_SUPABASE_PROJECT_ID="seu-project-id"
```

## Design

As decisões de produto e do sistema visual estão documentadas em [`PRODUCT.md`](./PRODUCT.md)
e [`DESIGN.md`](./DESIGN.md).

## Deploy

O build é uma SPA estática (`dist/`) servível em qualquer host. O workflow em
`.github/workflows/deploy.yml` publica automaticamente no GitHub Pages. Para servir sob um
sub-caminho, defina `VITE_BASE_PATH` no build (ex.: `VITE_BASE_PATH=/creative-flourish-hub/`).
