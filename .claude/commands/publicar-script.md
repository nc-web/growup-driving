---
description: Publicar no Google uma alteração ao Apps Script do dashboard (versão nova da implementação)
---
Publica no projeto Apps Script "GrowUP Dashboard TVDE" a alteração feita em `apps-script/GrowUP-Dashboard-AppsScript.gs`: $ARGUMENTS

1. Abre o editor no browser (precisa da sessão Google da conta nc@growup.gg; se não houver, pede ao Nuno para entrar — nunca escrevas palavras-passe).
2. Lê o código atual com `monaco.editor.getModels()[0].getValue()` e confirma que tem o TOKEN real e as funções esperadas (outra sessão pode ter mexido).
3. Aplica **só** as substituições necessárias (`split(a).length === 2` antes de substituir). Nunca colar o ficheiro do repositório por cima: no repositório o TOKEN é `COLOQUE_AQUI_O_CODIGO`.
4. Guarda. Se precisares de correr uma função, usa a linha temporária `if (!e) return f(); // TEMP` no `doGet`, executa e retira-a.
5. Implementar → Gerir implementações → implementação `AKfycbwlp7…` → ✏️ → Versão → **Versão nova** → Implementar.
6. Testa o endpoint publicado (pedido sem token deve dar "Token inválido"; a nova ação deve responder) e atualiza a versão publicada em `CLAUDE.md`.
