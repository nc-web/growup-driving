# Histórico do projeto (conversa com o Claude, outubro de 2026)

Registo dos pedidos do Nuno e das decisões tomadas, por ordem. Serve de contexto para próximas alterações.

## 1. App de agendamento de transfers
- Pedido: app HTML para agendar transfers e viagens privadas — dia/hora, recolha, chegada, cálculo de km com mapas e preço automático.
- Preço inicial 6 € até 5 km + 1,30 €/km → depois **5 € + 0,60 €/km** → atual **5 € + 0,80 €/km** (km começado conta inteiro).
- Inicialmente com Google Maps (chave nas Definições); **substituído por OpenStreetMap** (Leaflet, Photon, Nominatim, OSRM) com mapa do percurso. O detalhe do cálculo e a frase da fonte da distância foram escondidos.
- Dashboard de transfers: valores ganhos, viagens feitas, nomes de clientes com repetição, nº de clientes, km feitos (contam só as viagens marcadas como concluídas).

## 2. Dashboard TVDE ligado à folha
- Base de dados: `GrowuP Driving.xlsx` no Google Drive. Gráficos de receita, despesa e despesa/receita por semana; KPIs; comparação por viatura.
- Versão autónoma `dashboard-tvde.html` para abrir noutros computadores.
- "Entrar com Google" para quem usa o HTML ler a folha da sua própria Drive (com escolha de conta por `authuser`), e botão para abrir a folha.
- **Registar movimento**: escreve na aba "Entradas e Saídas - Tesla 3" (descrição e valor; negativos com "-"; restantes colunas automáticas).
- **📎 Enviar fatura** para "CARROSSEL DE RESULTADOS – LDA → Faturas".
- **Divisão do lucro 50/50** (Off = Nuno Cardoso, bp = Bruno Pinto) e **Registar lucro** semanal na aba nova "Lucros Semanais".
- Problemas resolvidos: a pré-visualização bloqueia pedidos (abrir no Chrome/Edge); conta Google errada no login (authuser); "Ação desconhecida" = faltava publicar versão nova do script.

## 3. Faturas do Gmail
- Automação de hora a hora que guarda os PDF das faturas "Continente Plug&Charge – Envio de Fatura Eletrónica" em Faturas/<mês>, criando a pasta de cada mês.
- Por pedido: só importa a partir de **2026-10-21**. 69 faturas antigas importadas por engano continuam nas pastas de março a julho à espera de decisão.

## 4. Design e calendário
- Design igual ao cartão de visita (escuro, riscas, vermelho #e31b2b, Montserrat, facetas, logótipo, lema).
- Envio de agendamentos para o **Google Calendar** (botão por agendamento). A exportação para iPhone (.ics) foi feita e depois **removida** a pedido (o iPhone recebe através da conta Google).
- Ideia em aberto: envio automático para o Google Calendar pelo Apps Script (não pedido ainda).

## 5. GitHub e site
- Repositório `nc-web/growup-driving`, GitHub Pages em https://nc-web.github.io/growup-driving/. Código de acesso retirado dos ficheiros públicos (vai em ⚙️ Definições).
- App Claude do GitHub instalada na conta nc-web só para este repositório.

## 6. Página dos clientes
- `reserva.html`: link próprio por agendamento (código de 12 caracteres) com os detalhes e o estado; horários ocupados dos próximos 14 dias sem dados pessoais.
- Os agendamentos publicados ficam na folha "GrowuP Transfers · Agendamentos" no Drive.

## 7. Organização das páginas (decisão final)
- O Nuno clarificou várias vezes; ficou assim:
  - `agendamento-transfers.html`: só o agendamento, **mantendo "Confirmar agendamento"** e a lista.
  - O separador **Transfers** passou para dentro de `dashboard-tvde.html` (separador 🚗 Transfers), que lê a folha de agendamentos de todos os computadores.
  - `dashboard-tvde.html` no site só abre pelo link de gestão (`?gestao`, em `gestao.html`).
