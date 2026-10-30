# GrowuP Driving — instruções para o Claude Code

Projeto do **Nuno** (GrowuP Driving, TVDE e transfers em Portugal; sócio **Bruno Pinto**). Ferramentas web em HTML/JS sem servidor próprio, publicadas no GitHub Pages e ligadas ao Google Drive por Google Apps Script.
Histórico completo de pedidos e decisões: [`docs/historico.md`](docs/historico.md). Ler antes de mudanças grandes.

## Regras de trabalho
- Responder e escrever a interface em **português de Portugal**.
- Versão para **PC** (não otimizar para mobile primeiro, mas nunca scroll horizontal).
- Ficheiros HTML autónomos (CSS + JS no próprio ficheiro), **sem build**. Bibliotecas só do **cdnjs** com versão fixa: Chart.js 4.4.1, SheetJS 0.18.5, Leaflet 1.9.4.
- Antes de entregar: testar com Playwright (Chromium já instalado; ver `/testar`) e, quando der, no site real. Depois `git commit` + `git push` para `main` — o GitHub Pages atualiza em ~1 min.
- **Segredos:** nunca pôr no repositório o código de acesso real (TOKEN) nem chaves de API. No cliente vêm de ⚙️ Definições (`localStorage`: `cfg_script`, `cfg_token`, `cfg_whats`, `cfg_folha`); no Apps Script do repositório o placeholder é `COLOQUE_AQUI_O_CODIGO`. O script publicado no Google tem o código real — editar lá só com substituições pontuais, nunca colar o ficheiro do repositório por cima.
- Ações irreversíveis (apagar ficheiros/faturas no Drive, apagar linhas reais da folha) só com autorização explícita do Nuno.

## Design da marca (cartão de visita GrowuP Driving)
Fundo escuro `#15181f`/`#1c2029` com riscas diagonais, vermelho `#e31b2b`, letra **Montserrat**, facetas vermelhas no topo (SVG), logótipo (círculo vermelho + estrada + seta) desenhado em SVG, lema "Profissionalismo · Conforto · Qualidade". Bloco CSS "Identidade GrowuP Driving" em cada página. Sempre escuro (sem modo claro). Paleta dos gráficos: receita vermelho, despesas cinza `#9aa4b6`, lucro verde `#22c55e`, rácio laranja `#f5a524`.

## Ficheiros
| Ficheiro | O que é |
|---|---|
| `index.html` | Página inicial pública (cartões Transfers e Reservas). |
| `agendamento-transfers.html` | Agendamento: formulário, mapa do percurso, preço, **Confirmar agendamento**, WhatsApp, lista de agendamentos (estado, link do cliente, Google Calendar, publicar). A barra de separadores está escondida; o código antigo dos separadores Transfers/TVDE ficou no ficheiro sem uso (não é preciso atualizá-lo). |
| `dashboard-tvde.html` | Dashboard (mantido só aqui). Separadores: 📊 Painel, ➕ Registar movimento, 💶 Registar lucro, 🚗 Transfers. No site público só abre com `?gestao` (sem isso redireciona para `./`); `#transfers` abre esse separador. |
| `gestao.html` | Página de gestão (noindex) com links para `dashboard-tvde.html?gestao#transfers` e `dashboard-tvde.html?gestao`. |
| `reserva.html` | Página pública dos clientes: `?c=CÓDIGO` mostra o próprio agendamento; horários ocupados dos próximos 14 dias (sem dados pessoais); contactos 969 259 112 / @growup_drive. |
| `apps-script/GrowUP-Dashboard-AppsScript.gs` | Backend (app web). |
| `apps-script/GrowUP-Faturas-Continente.gs` | Projeto Apps Script separado: guarda no Drive as faturas Continente Plug&Charge do Gmail (acionador de hora a hora). |

Site: https://nc-web.github.io/growup-driving/ · gestão: `/gestao.html` · repositório `nc-web/growup-driving` (app Claude instalada só neste repositório).

## Agendamento de transfers
- Preço: `CONFIG` em `agendamento-transfers.html` → **5 € até 5 km, +0,80 € por km começado** (`ARREDONDAR_KM_EXTRA: true`). WhatsApp de pedidos `351969259112`.
- O detalhe do cálculo (`#detalhe`) e a fonte da distância (`#fonte`) estão escondidos por CSS a pedido do Nuno.
- Mapas: **só OpenStreetMap** (Google Maps foi removido). Leaflet + mosaicos `tile.openstreetmap.org` (manter atribuição), sugestões **Photon** (komoot, filtro PT, viés Lisboa), geocodificação **Nominatim**, percurso **OSRM** `router.project-osrm.org` (`overview=full&geometries=geojson`). Pesquisa só após parar de escrever (450 ms). A duração não inclui trânsito.
- Agendamentos guardados em `localStorage.agendamentos` `{id, data, hora, nome, tel, origem, destino, km, segundos, preco, pax, malas, notas, estado: agendada|concluida|cancelada, codigo}`. Ao confirmar/mudar estado/remover, sincroniza com a folha de agendamentos (precisa do TOKEN).
- Botões por agendamento: Concluída / Cancelar / Repor, 🔗 Copiar link do cliente, 💬 Enviar link ao cliente (wa.me para o telemóvel do cliente, 9 dígitos → prefixo 351), 📅 Google Calendar (link TEMPLATE, fuso Europe/Lisbon, duração = viagem + 15 min, mínimo 30), ☁️ Publicar. **Sem** exportação iPhone/.ics (removida a pedido).

## Dashboard TVDE (`dashboard-tvde.html`)
- Lê o `GrowuP Driving.xlsx` (Drive, FILE_ID `1LaHM73lnQn8dH1PfJuGDiKpmqe9YoJh2`) pelo Apps Script (GET com `token`, cache 10 min, `fresh=1` força). Também "Entrar com Google" (implementação de login, sessão em CacheService recolhida com `modo=recolher`) e "Importar Excel" (SheetJS).
- Abas `Entradas e Saídas - <viatura>` (Tesla 3; "C4 SpaceTou" → "C4 SpaceTourer" porque o Google corta nomes > 31 caracteres). Linhas `[data, tipo, desc, valor, quem]`. Despesas ≥ 5000 € = compra de viatura (fora por defeito). Linhas repetidas de outra viatura antes da compra são ignoradas.
- **Divisão do lucro 50/50**: QUEM `Off` = **Nuno Cardoso**, `bp` = **Bruno Pinto**, outros (Helder, PRIVADOS, vazio) à parte. Mostra quem recebeu/pagou e o acerto entre os dois; por semana usa o lucro registado se existir, senão o calculado.
- **Registar movimento** → aba "Entradas e Saídas - Tesla 3": cabeçalho na linha 3, dados desde a 4. Colunas B SEMANA, C DATA (serial, estilo 121), D TIPO, E DESCRIÇÃO (64), F VALOR (65; saídas com "-"), G MÊS `=MONTH(Cn)` (104), H ANO `=YEAR(Cn)` (125), I QUEM. Escreve na primeira linha livre; Table_1 é alargada se preciso. Semana 1 = semana de **2026-05-11**. Anular só se a linha não mudou.
- **Registar lucro** → aba **"Lucros Semanais"** (criada pelo script dentro do .xlsx): A SEMANA, B INÍCIO, C FIM, D VALOR GANHO, E NUNO CARDOSO (50%) `=Dn*0.5`, F BRUNO PINTO (50%) `=Dn*0.5`, G REGISTADO EM, H OBSERVAÇÕES. Uma linha por semana (segunda-feira); se já existir, pergunta antes de substituir.
- **📎 Enviar fatura** → Drive "CARROSSEL DE RESULTADOS – LDA → Faturas → `yyyy-MM Mês`" (PDF/imagens ≤ 20 MB, sem duplicar).
- **🚗 Transfers**: valores ganhos, viagens, km, clientes que repetem (por telemóvel). Lê a folha de agendamentos (`listarAgendamentos`) e junta os de `localStorage.agendamentos` ainda não publicados (a folha prevalece).

## Backend — `apps-script/GrowUP-Dashboard-AppsScript.gs`
- Projeto "GrowUP Dashboard TVDE" (editor: `script.google.com/home/projects/18HxAyRbGTMAsSZ190uislAnco-WVZJA31UU5_r1eefgtFK8duxBArTbe/edit`), conta nc@growup.gg, serviço avançado Drive API v3.
- Implementação principal `AKfycbwlp7IcYvAkYdq5byDzlI_24mG9kBBYt9aphJ9WP0dUsQvS_Caz2Y2o5_V_39FTJi3e` (Executar como: Eu · Qualquer pessoa). Implementação de login `AKfycbyor9…` (Executar como: utilizador).
- **Guardar o código não chega**: publicar em *Implementar → Gerir implementações → ✏️ → Versão nova → Implementar* (ver `/publicar-script`). Última versão publicada: 11.
- `doGet`: `modo=login` · `modo=recolher&sessao=` · `modo=reserva&cod=` (público; o Google **reserva o parâmetro `c`**) · `modo=ocupados` (público) · sem modo + `token` → dados da folha.
- `doPost` (JSON em texto, com `token`, LockService, limpa a cache): `adicionar`, `anular`, `upload`, `lucro`, `anularLucro`, `agendamento`, `removerAgendamento`, `listarAgendamentos`.
- O .xlsx é editado **sem conversão**: unzip → XML (inlineStr, fórmulas explícitas) → `fullCalcOnLoad` → zip com `[Content_Types].xml` primeiro → `Drive.Files.update`. Leitura: cópia temporária convertida para Google Sheets, apagada no fim.
- Folha **"GrowuP Transfers · Agendamentos"** (Google Sheet criada pelo script; ID em ScriptProperties `agendaId`; tudo como texto): ID, CÓDIGO (12 caracteres), DATA, HORA, DURAÇÃO (MIN), NOME, TELEMÓVEL, RECOLHA, CHEGADA, KM, PREÇO, PAX, MALAS, NOTAS, ESTADO, ATUALIZADO.
- Testes em cópias: `testarEscrita()`, `testarLucros()` (criam cópia do .xlsx e mandam-na para o lixo).
- Dica do editor: o menu de funções é pouco fiável por automação; para correr uma função, pôr temporariamente `if (!e) return minhaFuncao(); // TEMP` no início do `doGet`, executar `doGet`, e retirar a linha antes de publicar.

## Faturas Continente — `apps-script/GrowUP-Faturas-Continente.gs`
Projeto separado "GrowUP Faturas Continente". Pesquisa `"Plug&Charge" subject:Fatura has:attachment after:2026/10/21`, confirma o assunto "Continente Plug&Charge – Envio de Fatura Eletrónica", guarda os PDF em Faturas/`yyyy-MM Mês` (cria a pasta do mês), regista os emails já tratados em ScriptProperties `feitos`. Acionador de hora a hora (`instalar` / `desinstalar`). **Só importa emails a partir de 2026-10-21.** Ainda há 69 faturas antigas (março–julho) importadas por engano à espera de decisão do Nuno (não apagar sem autorização).
