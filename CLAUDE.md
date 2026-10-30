# GrowuP Driving — notas para o Claude Code

- Projeto do Nuno (GrowuP Driving, TVDE/transfers em Portugal). Interface e textos em **português de Portugal**.
- Versão para **PC** (não otimizar para mobile em primeiro lugar, mas sem scroll horizontal).
- Ficheiros HTML autónomos (CSS e JS dentro do ficheiro), sem build. Bibliotecas só do cdnjs com versão fixa (Chart.js 4.4.1, SheetJS 0.18.5).
- Design da marca: fundo escuro com riscas diagonais, vermelho `#e31b2b`, letra Montserrat, facetas vermelhas no topo (ver bloco "Identidade GrowuP Driving" no CSS).
- O dashboard é mantido em `dashboard-tvde.html` (o separador TVDE de `agendamento-transfers.html` está escondido e não é preciso atualizá-lo).
- Preço dos transfers: `CONFIG` em `agendamento-transfers.html` (5 € até 5 km, +0,80 € por km começado).
- Backend: Google Apps Script em `apps-script/`. O `.xlsx` é editado sem conversão (unzip → XML → zip). Depois de mudar o script é preciso publicar uma **versão nova** da implementação `AKfycbwlp7…`.
- **Segredos:** nunca escrever o código de acesso real (TOKEN) nem chaves de API nos ficheiros do repositório. No cliente vêm de ⚙️ Definições (localStorage); no Apps Script o placeholder é `COLOQUE_AQUI_O_CODIGO`.
- A importação de faturas do Gmail só considera emails a partir de 2026-10-21.
- Agendamentos publicados para os clientes ficam na folha Google "GrowuP Transfers · Agendamentos" (criada pelo script; ID em ScriptProperties `agendaId`). Página pública `reserva.html`: `?c=CÓDIGO` mostra o agendamento do cliente; os horários ocupados não mostram dados pessoais. No Apps Script o parâmetro é `cod` (o Google reserva `c`).
- Mapas: só OpenStreetMap (sem Google Maps). Leaflet 1.9.4 do cdnjs, mosaicos tile.openstreetmap.org (manter a atribuição), sugestões Photon, geocodificação Nominatim, percurso OSRM (`router.project-osrm.org`).
- `agendamento-transfers.html` mostra só o agendamento (com Confirmar agendamento e lista); a barra de separadores está escondida e o código antigo dos separadores Transfers/TVDE ficou lá sem uso. O dashboard de transfers (valores ganhos, viagens, km, clientes) está no separador 🚗 Transfers de `dashboard-tvde.html` e lê `localStorage.agendamentos` (mesmo browser). No site público (`*.github.io`) `dashboard-tvde.html` só abre com `?gestao` (`#transfers` abre esse separador); links em `gestao.html`.
