

# FinSight AI — UX Polish (Tooltips, Empty States, Progress, Glossário)

## 1. Tooltips explicativos com ❓

Adicionar tooltips (usando Radix Tooltip já existente) nos seguintes locais:

**HealthScoreCard.tsx:**
- "Financial Health Score" → tooltip "Nota de 0-100 gerada pela IA baseada nos fundamentos do documento"
- Cada subcategoria (Crescimento de Receita, Margem Líquida, etc.) → tooltip explicativo
- Price Target → tooltip "Faixa de preço estimada pela IA com base nos fundamentos"
- Sentimento badge → tooltip "Tom geral do documento — positivo, negativo ou neutro"

**RedFlagsList.tsx:**
- Título "Red Flags" → tooltip "Riscos críticos detectados automaticamente"

Implementação: ícone `HelpCircle` (lucide) de 14px ao lado de cada label, envolvido em `Tooltip`/`TooltipTrigger`/`TooltipContent`. Wrap tudo em `TooltipProvider`.

---

## 2. Empty States melhorados

**Documents.tsx** (linhas 228-234):
- Card central grande com ícone `FileText` 48px
- Título "Nenhum documento ainda"
- 3 passos numerados com ícones: 1️⃣ Escolha um PDF financeiro, 2️⃣ Digite o ticker, 3️⃣ Clique em Analisar

**Chat.tsx** (linhas 213-225, estado sem conversa ativa):
- Manter Bot icon + título
- Adicionar exemplo visual de pergunta/resposta simulada em mini-cards

**Ranking.tsx** (linhas 81-90):
- Melhorar texto: "Analise pelo menos 2 empresas diferentes para ver o ranking"
- Adicionar passos resumidos

**Sentiment.tsx** (linhas 101-110):
- Texto melhor explicando como gerar análises

---

## 3. Barra de progresso no fluxo de Documentos

**Documents.tsx:**
- Adicionar componente de stepper horizontal no topo: `Upload → Analisar → Explorar`
- Estado dinâmico baseado nos documentos:
  - Sem docs: nenhum step ativo
  - Doc pending: step 1 verde
  - Doc processed: steps 1 e 2 verdes
  - Doc expandido: steps 1, 2 e 3 verdes
- Visual: 3 círculos conectados por linhas, com ícones e labels

---

## 4. Glossário financeiro no Chat

**Chat.tsx:**
- Botão "📖 Glossário" ao lado do botão "Nova conversa"
- Abre um Dialog/modal com os 10 termos:
  - P/E Ratio, EBITDA, ROE, Margem Líquida, EPS, Market Cap, Dividend Yield, Free Cash Flow, ROIC, Alavancagem
  - Cada um com explicação de 1 linha em português
- Usar componente Dialog já existente

---

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/components/HealthScoreCard.tsx` | Tooltips em score, subcategorias, price target, sentimento |
| `src/components/RedFlagsList.tsx` | Tooltip no título |
| `src/pages/Documents.tsx` | Empty state melhorado + barra de progresso |
| `src/pages/Chat.tsx` | Empty state com exemplo + botão glossário + modal |
| `src/pages/Ranking.tsx` | Empty state melhorado |
| `src/pages/Sentiment.tsx` | Empty state melhorado |

Nenhuma mudança de banco de dados necessária.

