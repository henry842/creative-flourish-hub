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
- **Alertas automáticos** — quedas e altas de Health Score, viradas de sentimento, novos
  pontos de atenção e risco regulatório elevado, derivados do histórico de análises.
- **Relatórios em PDF** — exportação do relatório de um ativo ou de uma comparação, com a
  identidade visual do produto (imprimir → salvar como PDF).
- **Contas e planos** — autenticação, perfil e assinatura (Free / Pro / Enterprise).

## Ativando a inteligência artificial

O FinSight funciona com dois caminhos de IA, nessa ordem:

1. **Servidor (Supabase Edge Functions)** — quando publicadas, a chave fica no servidor e o
   usuário final não configura nada. Requer os segredos `GROQ_API_KEY` (e opcionalmente
   `NEWS_API_KEY` para o briefing e `OCR_API_KEY`/`OCR_GATEWAY_URL` para PDFs escaneados).
2. **Chave do próprio usuário** — se as functions não estiverem disponíveis, o app pede uma
   chave em **Perfil → Inteligência artificial**. Ela é guardada apenas no navegador e
   enviada somente ao provedor escolhido.

Provedores suportados (todos compatíveis com a API OpenAI): **Groq** (recomendado, possui
plano gratuito), **OpenRouter** e **OpenAI**. Nesse modo, a leitura do PDF acontece no
próprio navegador, então análise, chat, comparação, ranking e briefing funcionam mesmo com
o backend indisponível.

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
