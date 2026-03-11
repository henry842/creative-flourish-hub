

## Problema

O PDF do BBRC11 é baseado em imagens/slides, então a extração de texto via regex retorna quase nada. A IA recebe contexto vazio e inventa tudo.

## Solução: Duas frentes

### 1. Campo de texto manual no documento

Adicionar um campo "Texto adicional / Notas" no modal de edição do documento (e opcionalmente no upload) onde o usuário pode colar o conteúdo do PDF manualmente. Esse texto será salvo na coluna `extracted_text` da tabela `documents` e usado como contexto para a análise.

**Alterações:**
- **`src/pages/Documents.tsx`**: No modal de edição (`Dialog` existente), adicionar um `Textarea` para "Texto do documento (cole aqui o conteúdo do PDF se a extração automática não funcionou)". Ao salvar, gravar no campo `extracted_text`. Também adicionar um textarea opcional no formulário de upload.

### 2. Fallback com modelo de visão (Gemini) para PDFs com imagem

Quando a extração de texto do PDF retorna menos de 50 caracteres, em vez de desistir, converter as páginas do PDF em imagens base64 e enviar para um modelo de visão (Gemini 2.5 Flash via Lovable AI) para extrair o conteúdo.

**Alterações:**
- **`supabase/functions/analyze-document/index.ts`**:
  - Quando `extractTextFromPdf()` retorna texto muito curto E não há `extracted_text` manual, chamar a API Lovable AI com Gemini Flash enviando o PDF como base64
  - O modelo de visão lerá as imagens/slides e retornará o texto extraído
  - Salvar o resultado na coluna `extracted_text`

### Fluxo resultante

1. Upload do PDF → texto extraído automaticamente
2. Se extração automática falha (< 50 chars) → tenta visão com Gemini
3. Se visão também falha → usuário pode colar texto manualmente via botão de edição
4. Análise usa o `extracted_text` (de qualquer fonte) como contexto

