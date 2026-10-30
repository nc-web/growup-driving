# GrowuP Driving

Ferramentas web da GrowuP Driving (TVDE e transfers), feitas em HTML/JavaScript sem servidor próprio, ligadas ao Google Drive através de Google Apps Script.

**Site:** publicado com GitHub Pages (ver *Settings → Pages*).

## O que está aqui

| Ficheiro | O que faz |
|---|---|
| `index.html` | Página inicial (transfers e reservas) |
| `gestao.html` | Página de gestão: transfers e Dashboard TVDE (`dashboard-tvde.html?gestao`) |
| `reserva.html` | Página dos clientes: horários ocupados e detalhes do próprio transfer |
| `agendamento-transfers.html` | Agendamento de transfers: distância, preço e mapa do percurso com OpenStreetMap (5 € até 5 km, +0,80 €/km), lista de agendamentos, dashboard de transfers, link para o Google Calendar e separador Dashboard TVDE |
| `dashboard-tvde.html` | Dashboard TVDE: receitas/despesas por semana, gráficos, divisão do lucro 50/50 (Nuno Cardoso / Bruno Pinto), registo de movimentos, registo de lucro semanal e envio de faturas |
| `apps-script/GrowUP-Dashboard-AppsScript.gs` | Apps Script publicado como app web: lê e escreve no `GrowuP Driving.xlsx` (abas *Entradas e Saídas* e *Lucros Semanais*) e guarda faturas no Drive |
| `apps-script/GrowUP-Faturas-Continente.gs` | Apps Script com acionador de hora a hora: guarda no Drive os PDF das faturas Continente Plug&Charge recebidas no Gmail |

## Configuração

1. **Código de acesso:** as páginas públicas não trazem o código. Abra ⚙️ Definições e cole o URL do Apps Script e o código de acesso; ficam guardados só nesse browser.
2. **Mapas:** OpenStreetMap, sem chave — mapa com Leaflet, sugestões de moradas com Photon, moradas com Nominatim e percurso com OSRM (serviços públicos gratuitos).
3. **Apps Script:** em `GrowUP-Dashboard-AppsScript.gs`, substitua `COLOQUE_AQUI_O_CODIGO` pelo código de acesso antes de colar no editor. Depois de alterar o código, publique em *Implementar → Gerir implementações → Editar → Versão nova*.

> Nunca faça commit do código de acesso real nem de chaves de API sem restrições.

## Desenvolvimento

Não há build: os ficheiros HTML abrem diretamente no Chrome ou no Edge. As bibliotecas (Chart.js, SheetJS) vêm do cdnjs.
