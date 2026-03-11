

## Problema Identificado

O fluxo atual **nunca extrai texto do PDF**. Quando o usuário faz upload, o arquivo vai pro storage mas `extracted_text` fica `null`. Na hora de analisar, o fallback envia apenas o nome do arquivo e ticker para a IA, que inventa tudo. No chat, `selectedDoc.extracted_text` é `null`, então nenhum contexto é enviado.

## Plano de Correção

### 1. Extrair texto do PDF na Edge Function `analyze-document`

Atualmente a função recebe `text` do frontend (que é apenas o nome do arquivo). Vamos modificá-la para:
- Baixar o PDF do storage usando `file_path` do documento
- Usar a biblioteca `pdf-parse` para extrair texto do PDF
- Salvar o texto extraído na coluna `extracted_text` da tabela `documents`
- Usar esse texto real para a análise com Groq

### 2. Atualizar o frontend `Documents.tsx`

- Enviar `file_path` para a Edge Function em vez do texto fake
- Remover o fallback que inventa texto genérico

### 3. Atualizar o prompt do chat

- No `chat/index.ts`, alterar o prompt de contexto de documento para incluir a instrução: "Baseie sua resposta APENAS nas informações do documento a seguir. Não invente dados."

### Detalhes Técnicos

**Edge Function `analyze-document/index.ts`:**
- Receber `document_id` e `file_path` (em vez de `text`)
- Buscar o documento do storage: `supabase.storage.from('documents').download(file_path)`
- Extrair texto com `pdf-parse` (importado via npm no Deno)
- Salvar `extracted_text` no banco após extração
- Enviar texto real para o Groq

**`src/pages/Documents.tsx`:**
- `handleAnalyze`: enviar `file_path: doc.file_path` ao invés de `text`

**`supabase/functions/chat/index.ts`:**
- Alterar o prompt de contexto para: `"Baseie sua resposta APENAS nas informações do documento a seguir. Não invente dados. Se não encontrar a informação no documento, diga que não encontrou."`

