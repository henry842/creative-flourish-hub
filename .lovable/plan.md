

# FinSight AI — App Web Completo

Recriação do agente de inteligência financeira como uma aplicação web moderna, bonita e fácil de usar.

---

## 1. Autenticação e Perfil de Usuário
- Login/cadastro com email e senha
- Página de redefinição de senha
- Perfil do usuário com avatar e nome
- Tabela de perfis no Supabase com trigger automático

## 2. Dashboard Principal
- Visão geral com cards de resumo: total de documentos, análises recentes, sentimento geral
- Gráficos interativos (Recharts) mostrando tendências de sentimento ao longo do tempo
- Lista das últimas conversas/análises do usuário
- Design limpo e profissional com tema escuro/claro

## 3. Upload e Gestão de Documentos
- Upload de PDFs (relatórios 10-K, earnings calls, notícias) para Supabase Storage
- Lista de documentos com nome, data de upload, status de processamento
- Extração de texto do PDF via edge function
- Organização por empresa/ticker e tipo de documento

## 4. Chat com IA (Funcionalidade Core)
- Interface de chat com streaming token-by-token via Lovable AI Gateway
- Prompt de sistema especializado em análise financeira (replica o comportamento do FinSight original)
- Contexto dos documentos enviado junto com as perguntas do usuário
- Respostas em markdown com formatação rica (tabelas, listas, destaque)
- Histórico de conversas salvo no banco de dados por usuário
- Possibilidade de iniciar nova conversa ou continuar uma existente

## 5. Análise de Sentimento
- Edge function que usa a IA para classificar sentimento de trechos financeiros (bullish/bearish/neutral)
- Visualização do sentimento por documento e ao longo do tempo com gráficos
- Cards coloridos indicando o sentimento geral de cada empresa analisada

## 6. Navegação e UX
- Sidebar com navegação: Dashboard, Documentos, Chat, Análises
- Design responsivo (desktop e mobile)
- Toasts para feedback de ações (upload concluído, erro, etc.)
- Loading states e skeleton screens para melhor percepção de velocidade

## 7. Infraestrutura (Lovable Cloud / Supabase)
- **Tabelas**: profiles, documents, conversations, messages, sentiment_analyses
- **Storage**: bucket para PDFs
- **Edge Functions**: chat (streaming com IA), analyze-sentiment, process-document
- **RLS**: cada usuário só vê seus próprios dados

