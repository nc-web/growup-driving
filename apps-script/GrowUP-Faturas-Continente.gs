/**
 * GrowUP · Faturas Continente Plug&Charge → Google Drive
 *
 * Procura no Gmail os emails com o assunto
 *   "Continente Plug&Charge – Envio de Fatura Eletrónica"
 * e guarda os PDF anexados em:
 *   CARROSSEL DE RESULTADOS – LDA  →  Faturas  →  <pasta do mês>   (ex.: "2026-10 Outubro")
 *
 * - Corre sozinho de hora a hora (depois de correr "instalar" uma vez).
 * - Cada email só é guardado uma vez; não cria ficheiros repetidos.
 * - No início de cada mês cria a pasta do novo mês, mesmo antes de chegar a primeira fatura.
 * - Só LÊ o Gmail: não apaga, não arquiva e não marca emails.
 *
 * INSTALAÇÃO (uma vez, com a conta nc@growup.gg):
 *  1. script.google.com → Novo projeto → nome "GrowUP Faturas Continente" → colar este ficheiro.
 *  2. Escolher a função "testar" → Executar → autorizar (Gmail e Drive). Ver o "Registo de execução".
 *  3. Escolher a função "instalar" → Executar. A partir daí corre sozinho de hora a hora.
 */

const ASSUNTO     = 'Continente Plug&Charge – Envio de Fatura Eletrónica';
const PASTA_PAI   = 'CARROSSEL DE RESULTADOS – LDA';
const PASTA_FAT   = 'Faturas';
const PASTA_LINK  = '';      // opcional: link da pasta "Faturas" (se a pesquisa por nome não a encontrar)
const FUSO        = 'Europe/Lisbon';
const DATA_INICIO = '2026-10-21';   // só importa faturas recebidas a partir desta data
const MESES       = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
                     'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** 1.º passo: só verifica (não grava nada). Ver o "Registo de execução". */
function testar() {
  const raiz = pastaFaturas_();
  Logger.log('Pasta encontrada: ' + raiz.getName() + ' · ' + raiz.getUrl());
  const msgs = procurarEmails_();
  Logger.log('Emails encontrados: ' + msgs.length);
  if (!msgs.length) {   // nada encontrado: mostrar emails parecidos para ajudar a afinar a pesquisa
    ['Plug Charge', 'Plug&Charge', 'Continente fatura'].forEach(q => {
      GmailApp.search(q, 0, 10).forEach(t => { const x = t.getMessages()[0];
        Logger.log('PARECIDO [' + q + '] ' + Utilities.formatDate(x.getDate(), FUSO, 'dd/MM/yyyy') + ' · De: ' + x.getFrom() + ' · Assunto: ' + x.getSubject() + ' · Anexos: ' + x.getAttachments().map(a => a.getName() + ' (' + a.getContentType() + ')').join(', '));
      });
    });
  }
  msgs.slice(-10).forEach(m => {
    const pdfs = m.getAttachments({ includeInlineImages: false }).filter(a => /pdf/i.test(a.getContentType()) || /\.pdf$/i.test(a.getName()));
    Logger.log(Utilities.formatDate(m.getDate(), FUSO, 'dd/MM/yyyy') + ' · ' + m.getSubject() + ' · PDF: ' + (pdfs.map(a => a.getName()).join(', ') || 'nenhum'));
  });
}

/** Corre de hora a hora: guarda as faturas novas e garante a pasta do mês atual. */
function guardarFaturas() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    const raiz = pastaFaturas_();
    pastaDoMes_(raiz, new Date());                       // novo mês → cria a pasta logo no início
    const props = PropertiesService.getScriptProperties();
    const feitos = JSON.parse(props.getProperty('feitos') || '[]');
    const jaFeito = new Set(feitos);
    let guardados = 0, semPdf = 0, pendentes = 0;
    const t0 = Date.now();

    procurarEmails_().forEach(msg => {
      const id = msg.getId();
      if (jaFeito.has(id)) return;
      if (Date.now() - t0 > 4.5 * 60000) { pendentes++; return; }   // limite de tempo da Google: continua na próxima hora
      const pdfs = msg.getAttachments({ includeInlineImages: false })
        .filter(a => /pdf/i.test(a.getContentType()) || /\.pdf$/i.test(a.getName()));
      if (!pdfs.length) {
        semPdf++;
        Logger.log('Sem PDF anexado: ' + msg.getSubject() + ' (' + msg.getDate() + ')');
      }
      const pasta = pastaDoMes_(raiz, msg.getDate());
      pdfs.forEach(a => { if (guardarPdf_(pasta, a, msg)) guardados++; });
      feitos.push(id); jaFeito.add(id);
      if (feitos.length % 20 === 0) props.setProperty('feitos', JSON.stringify(feitos.slice(-5000)));   // guarda o progresso
    });

    props.setProperty('feitos', JSON.stringify(feitos.slice(-5000)));
    props.setProperty('ultimaExecucao', new Date().toISOString() + ' · guardados: ' + guardados + ' · sem PDF: ' + semPdf);
    Logger.log('Guardados ' + guardados + ' PDF(s). Emails sem PDF: ' + semPdf + '.' + (pendentes ? ' Ficam ' + pendentes + ' para a próxima execução.' : ''));
  } finally {
    lock.releaseLock();
  }
}

/** Emails do Continente Plug&Charge com o assunto da fatura (pesquisa larga + confirmação exata). */
function procurarEmails_() {
  const alvo = normalizar_(ASSUNTO), resultado = [];
  const q = '"Plug&Charge" subject:Fatura has:attachment after:' + DATA_INICIO.replace(/-/g, '/');   // o Gmail trata "Plug&Charge" como uma só palavra
  for (let inicio = 0; ; inicio += 100) {
    const threads = GmailApp.search(q, inicio, 100);
    threads.forEach(t => t.getMessages().forEach(m => {
      if (normalizar_(m.getSubject()).indexOf(alvo) >= 0 &&
          Utilities.formatDate(m.getDate(), FUSO, 'yyyy-MM-dd') >= DATA_INICIO) resultado.push(m);
    }));
    if (threads.length < 100) break;
  }
  return resultado.sort((a, b) => a.getDate() - b.getDate());
}

/** Guarda o PDF na pasta do mês, sem repetir (mesmo nome e mesmo tamanho = já existe). */
function guardarPdf_(pasta, anexo, msg) {
  const blob = anexo.copyBlob();
  let nome = anexo.getName() || ('Fatura Continente ' + Utilities.formatDate(msg.getDate(), FUSO, 'yyyy-MM-dd') + '.pdf');
  if (!/\.pdf$/i.test(nome)) nome += '.pdf';
  const existentes = pasta.getFilesByName(nome);
  while (existentes.hasNext()) {
    if (existentes.next().getSize() === blob.getBytes().length) return false;   // já guardado
  }
  if (pasta.getFilesByName(nome).hasNext()) nome = nome.replace(/\.pdf$/i, ' (' + Utilities.formatDate(msg.getDate(), FUSO, 'yyyy-MM-dd HHmm') + ').pdf');
  const f = pasta.createFile(blob.setName(nome));
  f.setDescription('Fatura recebida por email em ' + Utilities.formatDate(msg.getDate(), FUSO, 'dd/MM/yyyy HH:mm') +
                   ' · Assunto: ' + msg.getSubject());
  Logger.log('Guardado: ' + pasta.getName() + ' / ' + nome);
  return true;
}

/** Pasta "2026-10 Outubro" dentro de Faturas (cria se não existir). */
function pastaDoMes_(raiz, data) {
  const nome = Utilities.formatDate(data, FUSO, 'yyyy-MM') + ' ' + MESES[Number(Utilities.formatDate(data, FUSO, 'M')) - 1];
  const it = raiz.getFoldersByName(nome);
  if (it.hasNext()) return it.next();
  Logger.log('Pasta do mês criada: ' + nome);
  return raiz.createFolder(nome);
}

/** Encontra "CARROSSEL DE RESULTADOS – LDA → Faturas" (aceita – ou - no nome). */
function pastaFaturas_() {
  const props = PropertiesService.getScriptProperties();
  const guardado = props.getProperty('pastaId') || idDoLink_(PASTA_LINK);
  if (guardado) {
    try { const f = DriveApp.getFolderById(guardado); if (!f.isTrashed()) return f; } catch (e) {}
  }
  const alvoPai = normalizar_(PASTA_PAI), alvoFat = normalizar_(PASTA_FAT);
  const pais = DriveApp.searchFolders("title contains 'CARROSSEL' and trashed = false");
  while (pais.hasNext()) {
    const pai = pais.next();
    if (normalizar_(pai.getName()) !== alvoPai) continue;
    const filhos = pai.getFolders();
    while (filhos.hasNext()) {
      const f = filhos.next();
      if (normalizar_(f.getName()) === alvoFat) { props.setProperty('pastaId', f.getId()); return f; }
    }
  }
  throw new Error('Não encontrei a pasta "' + PASTA_PAI + ' → ' + PASTA_FAT + '" no Google Drive. ' +
                  'Confirme o nome ou cole o link da pasta em PASTA_LINK.');
}

/* ---------- Utilitários ---------- */
function normalizar_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[‐-―-]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
}
function idDoLink_(s) {
  const m = String(s || '').match(/folders\/([A-Za-z0-9_-]{20,})/) || String(s || '').match(/^([A-Za-z0-9_-]{20,})$/);
  return m ? m[1] : '';
}

/** 2.º passo: guarda já as faturas existentes e liga a execução de hora a hora. */
function instalar() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'guardarFaturas').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('guardarFaturas').timeBased().everyHours(1).create();
  guardarFaturas();
  Logger.log('Automação ligada: corre de hora a hora. ' + (PropertiesService.getScriptProperties().getProperty('ultimaExecucao') || ''));
}

/** Para desligar a automação. */
function desinstalar() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'guardarFaturas').forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('Automação desligada.');
}
