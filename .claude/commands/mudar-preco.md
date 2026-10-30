---
description: Mudar o preço dos transfers (base, km incluídos ou preço por km extra)
---
Muda o preço dos transfers para: $ARGUMENTS

1. Em `agendamento-transfers.html`, altera `CONFIG.PRECO_BASE`, `CONFIG.KM_BASE` e/ou `CONFIG.PRECO_KM_EXTRA`, e o texto inicial de `#detalhe`.
2. Atualiza o preço em `README.md`, `CLAUDE.md` e `docs/historico.md`.
3. Testa `calcularPreco()` para 3, 5, 5,4, 7 e 12,3 km e mostra a tabela ao Nuno.
4. Commit + push. Os agendamentos já feitos mantêm o preço antigo.
