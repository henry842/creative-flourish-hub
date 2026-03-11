

# CRUD Completo — Plano de Implementação

## Mudanças de Banco de Dados (migrações)

Adicionar RLS policies faltantes:
- `sentiment_analyses`: policy DELETE para `auth.uid() = user_id`
- `health_scores`: policy DELETE para `auth.uid() = user_id`

## Arquivos a Editar/Criar

### 1. `src/pages/Documents.tsx` — Editar nome/ticker
- Adicionar estado `editingDoc` e modal Dialog com campos Nome e Ticker
- Botão de editar (ícone Pencil) ao lado do delete em cada documento
- UPDATE na tabela `documents` + toast de confirmação

### 2. `src/pages/Chat.tsx` — Renomear e deletar conversa
- Rename inline: clicar no título da conversa na sidebar ativa input editável, Enter salva (UPDATE conversations)
- Botão delete (Trash2) em cada conversa com AlertDialog de confirmação
- DELETE conversations + mensagens associadas (cascade) + toast

### 3. `src/pages/Index.tsx` — Adicionar ticker manual à watchlist
- Input + botão "Adicionar" abaixo da lista de watchlist
- INSERT na tabela watchlist com ticker digitado + toast
- Validação: não permitir ticker vazio ou duplicado

### 4. `src/pages/Sentiment.tsx` — Deletar análise individual
- Botão Trash2 em cada linha da tabela de histórico
- AlertDialog de confirmação antes do DELETE em sentiment_analyses
- Toast + refresh da lista

### 5. `src/pages/Documents.tsx` — Deletar health score
- Botão "Deletar análise" no card expandido do health score
- AlertDialog + DELETE health_scores onde document_id = doc.id
- Permite re-análise limpa

### 6. Nova página `src/pages/Profile.tsx` + rota `/profile`
- Campo editar display_name (UPDATE profiles)
- Botão trocar senha (supabase.auth.updateUser com novo password)
- Botão deletar conta com confirmação dupla: AlertDialog pede digitar "DELETE" num input, só habilita botão quando match
- Delete conta: chama edge function que usa service_role para deletar user
- Link na sidebar (ícone UserCircle) ou no footer ao lado de Sair

### 7. `src/components/AppSidebar.tsx`
- Adicionar link "Perfil" na sidebar

### 8. `src/App.tsx`
- Adicionar rota `/profile` protegida

### 9. Edge function `supabase/functions/delete-account/index.ts`
- Recebe user_id do token JWT
- Usa service_role key para deletar o usuário via admin API
- Dados associados são deletados via CASCADE

## Padrões
- Todas ações destrutivas usam AlertDialog de confirmação
- Todas ações dão feedback via toast
- Nenhuma mudança no client.ts ou types.ts

