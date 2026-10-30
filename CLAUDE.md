# GrowuP Driving — notas para o Claude Code

- Projeto do Nuno (GrowuP Driving, TVDE/transfers em Portugal). Interface e textos em **português de Portugal**.
- Versão para **PC** (não otimizar para mobile em primeiro lugar, mas sem scroll horizontal).
- Ficheiros HTML autónomos (CSS e JS dentro do ficheiro), sem build. Bibliotecas só do cdnjs com versão fixa (Chart.js 4.4.1, SheetJS 0.18.5).
- Design da marca: fundo escuro com riscas diagonais, vermelho `#e31b2b`, letra Montserrat, facetas vermelhas no topo (ver bloco "Identidade GrowuP Driving" no CSS).
- `dashboard-tvde.html` e o separador TVDE de `agendamento-transfers.html` partilham o mesmo bloco de JavaScript: qualquer alteração ao dashboard tem de ser feita nos dois.
- Preço dos transfers: `CONFIG` em `agendamento-transfers.html` (5 € até 5 km, +0,60 € por km começado).
- Backend: Google Apps Script em `apps-script/`. O `.xlsx` é editado sem conversão (unzip → XML → zip). Depois de mudar o script é preciso publicar uma **versão nova** da implementação `AKfycbwlp7…`.
- **Segredos:** nunca escrever o código de acesso real (TOKEN) nem chaves de API nos ficheiros do repositório. No cliente vêm de ⚙️ Definições (localStorage); no Apps Script o placeholder é `COLOQUE_AQUI_O_CODIGO`.
- A importação de faturas do Gmail só considera emails a partir de 2026-10-21.
