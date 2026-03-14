

# Plano: Sistema de Briefing Diário Automatizado

## Visão Geral

Criar um sistema completo de briefing diário que busca notícias reais via Lovable AI Gateway (modelo `perplexity/sonar`), combina com dados internos dos ativos do usuário, e gera um resumo executivo diário.

---

## 1. Banco de Dados — 2 tabelas novas + pg_cron setup

**Tabela `scheduled_briefs`**: configuração do briefing por usuário
- `id` (uuid, PK), `user_id` (uuid, NOT NULL), `schedule_time` (time, default '08:00'), `is_active` (boolean, default true), `include_news` (boolean, default true), `include_macro` (boolean, default true), `notify_email` (boolean, default false), `last_run_at` (timestamptz), `created_at` (timestamptz)
- RLS: usuário acessa apenas os próprios

**Tabela `daily_briefs`**: briefings gerados
- `id` (uuid, PK), `user_id` (uuid, NOT NULL), `content` (text), `tickers` (text[]), `created_at` (timestamptz)
- RLS: usuário acessa apenas os próprios

**Tabela `scheduled_brief_assets`**: junção briefing ↔ ativos
- `id` (uuid, PK), `scheduled_brief_id` (uuid, FK → scheduled_briefs), `asset_id` (uuid, FK → assets), `created_at` (timestamptz)
- RLS: via join com scheduled_briefs

**pg_cron**: após tudo implementado, criar um cron job (via insert tool, não migration) que roda a cada hora e chama a edge function `generate-brief` via `net.http_post` para usuários com briefing ativo naquela hora.

---

## 2. Edge Function `generate-brief`

Fluxo:
1. Recebe `user_id` (ou itera sobre todos os usuários ativos se chamada pelo cron)
2. Busca os ativos vinculados ao briefing do usuário (tickers)
3. Busca os últimos health scores e sentimentos de cada ativo
4. **Busca notícias reais** via Lovable AI Gateway:
   - Endpoint: `https://ai.gateway.lovable.dev/v1/chat/completions`
   - Modelo: `perplexity/sonar`
   - Auth: `Bearer ${LOVABLE_API_KEY}` (já configurada)
   - Prompt: "Quais são as principais notícias financeiras do Brasil hoje? Inclua: variação do IFIX, decisão do Banco Central sobre Selic, IPCA mais recente, e notícias sobre os seguintes tickers: {tickers}"
5. Combina notícias reais + dados internos e gera o briefing final via Lovable AI (Gemini Flash) formatado em markdown
6. Salva na tabela `daily_briefs`
7. `verify_jwt = false` no config.toml

---

## 3. Página `/briefing`

**Seção de configuração** (topo):
- Toggle ativar/desativar briefing
- Seletor de horário (06:00 a 22:00)
- Multi-select dos ativos do usuário (checkboxes)
- Botão "Gerar Briefing Agora" para teste manual

**Seção de histórico** (abaixo):
- Lista de cards com data e preview do briefing
- Ao clicar, expande o briefing completo em markdown renderizado
- Visual estilo WhatsApp (cards clicáveis por dia)

---

## 4. Dashboard — Card "Último Briefing"

- Novo card no `Index.tsx` com data do último briefing, preview das primeiras linhas, e botão "Ver completo" → navega para `/briefing`

---

## 5. Sidebar

- Adicionar item "Briefing" com ícone `Bell` na sidebar

---

## Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar 3 tabelas + RLS |
| `supabase/functions/generate-brief/index.ts` | Nova edge function |
| `supabase/config.toml` | Adicionar `[functions.generate-brief]` |
| `src/pages/Briefing.tsx` | Nova página |
| `src/App.tsx` | Adicionar rota `/briefing` |
| `src/components/AppSidebar.tsx` | Adicionar "Briefing" com ícone Bell |
| `src/pages/Index.tsx` | Adicionar card "Último Briefing" |

