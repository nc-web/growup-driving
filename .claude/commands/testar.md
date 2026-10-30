---
description: Testar as páginas localmente com Playwright e serviços simulados
---
Testa as páginas alteradas antes de fazer push: $ARGUMENTS

- Usa Python + Playwright (Chromium já instalado em /opt/pw-browsers; não correr `playwright install`).
- A rede do ambiente bloqueia quase tudo: simula com `page.route` o Apps Script (`script.google.com`), Photon, Nominatim e OSRM; o cdnjs e as Google Fonts podem não carregar (os gráficos/mapa ficam indisponíveis — é esperado).
- Para testar o comportamento do site público, serve os ficheiros em `https://nc-web.github.io/growup-driving/...` com `route.fulfill` (o modo depende do hostname `*.github.io` e de `?gestao`).
- Verifica: sem erros `pageerror`, sem scroll horizontal (1280 px e 390 px), e o fluxo pedido. Tira capturas e olha para elas.
- Depois de publicado, confirma no site real pelo browser (pode demorar ~1 min a atualizar).
