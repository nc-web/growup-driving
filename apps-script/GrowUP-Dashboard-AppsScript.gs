/**
 * GrowUP Driving — ligação do Dashboard TVDE às folhas no Google Drive
 *
 * Dois modos:
 *  A) Código de acesso (TOKEN): devolve a folha do dono (FILE_ID).
 *     Implementação "Executar como: Eu" · "Qualquer pessoa".
 *  B) Entrar com Google: quem abre o dashboard faz login com a sua conta e o
 *     script lê a folha "GrowuP Driving" da Google Drive DESSA pessoa.
 *     Implementação "Executar como: Utilizador que acede à app" ·
 *     "Qualquer pessoa com uma Conta Google".
 *     A página de login guarda os dados por uns minutos (chave aleatória criada
 *     pelo dashboard) e o dashboard recolhe-os através da implementação A.
 *
 * Requer o serviço avançado "Drive API" (v3).
 */

const FILE_ID   = '1LaHM73lnQn8dH1PfJuGDiKpmqe9YoJh2';
const TOKEN     = 'COLOQUE_AQUI_O_CODIGO';   // código de acesso secreto: igual ao que se põe em ⚙️ Definições no dashboard (nunca o publique)
const PREFIXO   = 'Entradas e Saídas - ';
const NOME_FOLHA = 'GrowuP Driving';               // nome procurado na Drive de quem faz login
const CACHE_MIN = 10;                               // minutos de cache
const SESSAO_OK = /^[A-Za-z0-9_-]{16,64}$/;

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.modo === 'login') return paginaLogin_(p);
  if (p.modo === 'recolher') return json_(recolher_(p.sessao));
  if (p.modo === 'reserva') return publico_(() => reservaPublica_(p.cod));
  if (p.modo === 'ocupados') return publico_(horariosOcupados_);
  if (p.token !== TOKEN) return json_({ erro: 'Token inválido' });
  try {
    const cache = CacheService.getScriptCache();
    if (!p.fresh) {
      const c = cache.get('dados');
      if (c) return json_(JSON.parse(c));
    }
    const dados = lerFolha_(FILE_ID);
    const txt = JSON.stringify(dados);
    if (txt.length < 95000) cache.put('dados', txt, CACHE_MIN * 60);
    return json_(dados);
  } catch (err) {
    return json_({ erro: String(err && err.message || err) });
  }
}

/* ---------- Leitura de uma folha (xlsx ou Google Sheets) ---------- */
function lerFolha_(fileId) {
  const file = DriveApp.getFileById(fileId);
  let ss, tmpId = null;
  if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
    ss = SpreadsheetApp.openById(fileId);
  } else {
    const tmp = Drive.Files.copy({ name: '_tmp_dashboard_growup', mimeType: MimeType.GOOGLE_SHEETS }, fileId, { supportsAllDrives: true });
    tmpId = tmp.id;
    ss = SpreadsheetApp.openById(tmpId);
  }
  try {
    const viaturas = {};
    let lucros = [];
    ss.getSheets().forEach(sh => {
      const nome = sh.getName();
      if (nome === ABA_LUCROS) {   // lucros semanais registados no dashboard
        lucros = sh.getDataRange().getValues().map((r, i) => ({ r: r, n: i + 1 })).slice(1)
          .filter(o => o.r[1] !== '' && o.r[3] !== '')
          .map(o => [data_(o.r[1]), Number(o.r[3]) || 0, String(o.r[7] || ''), Number(o.r[0]) || '', o.n]);
        return;
      }
      if (nome.indexOf(PREFIXO) !== 0) return;
      const vals = sh.getDataRange().getValues();
      const h = vals.findIndex(r => r.some(c => String(c).trim().toUpperCase() === 'TIPO'));
      if (h < 0) return;
      const cab = vals[h].map(c => String(c).trim().toUpperCase());
      const iD = cab.indexOf('DATA'), iT = cab.indexOf('TIPO'), iV = cab.indexOf('VALOR');
      const iDesc = cab.findIndex(c => c.indexOf('DESCRI') === 0);
      const iQ = cab.findIndex(c => c.indexOf('QUEM') === 0);
      viaturas[nome.slice(PREFIXO.length).trim()] = vals.slice(h + 1)
        .filter(r => r[iD] !== '' && r[iV] !== '' && r[iV] !== null)
        .map(r => [data_(r[iD]), String(r[iT]).trim(), String(r[iDesc]).trim(), r[iV], iQ >= 0 ? String(r[iQ]).trim() : '']);
    });
    return { atualizado: new Date().toISOString(), ficheiro: file.getName(), viaturas: viaturas, lucros: lucros };
  } finally {
    if (tmpId) Drive.Files.remove(tmpId, { supportsAllDrives: true });   // apaga só a cópia temporária criada acima
  }
}

/* ---------- Modo "Entrar com Google" ---------- */
function procurarFolha_() {
  const q = "name contains '" + NOME_FOLHA + "' and trashed = false";
  const campos = { q: q, fields: 'files(id,name,mimeType,modifiedTime)', orderBy: 'modifiedTime desc', pageSize: 25 };
  let res;
  try {   // inclui drives partilhadas (Google Workspace)
    res = Drive.Files.list(Object.assign({ corpora: 'allDrives', includeItemsFromAllDrives: true, supportsAllDrives: true }, campos));
  } catch (e) {
    res = Drive.Files.list(campos);
  }
  const folhas = (res.files || []).filter(x => /spreadsheet|excel/i.test(x.mimeType));
  // Prefere o nome exato ("GrowuP Driving" ou "GrowuP Driving.xlsx"); senão a mais recente com nome parecido
  const base = s => String(s).toLowerCase().replace(/\.(xlsx|xls)$/, '').trim();
  const exata = folhas.find(x => base(x.name) === base(NOME_FOLHA));
  const f = exata || folhas[0];
  if (f) return f.id;
  throw new Error('Não encontrei nenhuma folha com o nome "' + NOME_FOLHA + '" na Google Drive de ' + emailAtual_() + '. ' +
                  'Se usa várias contas Google neste browser, confirme que entrou com a conta certa, ' +
                  'ou indique o link da folha nas Definições do dashboard.');
}

function emailAtual_() {
  try { return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'esta conta'; }
  catch (e) { return 'esta conta'; }
}

function idDoLink_(s) {
  s = String(s || '').trim();
  const m = s.match(/\/d\/([A-Za-z0-9_-]{20,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{20,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(s) ? s : '';
}

/** Chamado pela página de login (corre com a conta de quem fez login). */
function guardarSessao(sessao, linkFolha) {
  if (!SESSAO_OK.test(String(sessao || ''))) throw new Error('Sessão inválida. Volte a carregar no botão do dashboard.');
  const id = idDoLink_(linkFolha) || procurarFolha_();
  const dados = lerFolha_(id);
  dados.utilizador = emailAtual_();
  const txt = JSON.stringify(dados), TAM = 45000, partes = {};
  const n = Math.ceil(txt.length / TAM);
  for (let i = 0; i < n; i++) partes['s_' + sessao + '_' + i] = txt.slice(i * TAM, (i + 1) * TAM);
  partes['s_' + sessao + '_n'] = String(n);
  CacheService.getScriptCache().putAll(partes, 600);   // 10 minutos
  return { utilizador: dados.utilizador, ficheiro: dados.ficheiro };
}

/** Chamado pelo dashboard (implementação A) para levantar os dados uma única vez. */
function recolher_(sessao) {
  if (!SESSAO_OK.test(String(sessao || ''))) return { erro: 'Sessão inválida' };
  const cache = CacheService.getScriptCache();
  const n = parseInt(cache.get('s_' + sessao + '_n'), 10);
  if (!n) return { pendente: true };
  const chaves = [];
  for (let i = 0; i < n; i++) chaves.push('s_' + sessao + '_' + i);
  const v = cache.getAll(chaves);
  if (chaves.some(k => v[k] == null)) return { pendente: true };
  cache.removeAll(chaves.concat(['s_' + sessao + '_n']));
  return JSON.parse(chaves.map(k => v[k]).join(''));
}

function paginaLogin_(p) {
  const cfg = JSON.stringify({ sessao: String(p.sessao || ''), folha: String(p.folha || '') }).replace(/</g, '\\u003c');
  const html = '<!doctype html><html><head><base target="_top"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{margin:0;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f4f5f7;color:#0f172a}' +
    '.c{max-width:420px;margin:48px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px}' +
    'h1{font-size:18px;margin:0 0 12px}.ok{color:#166534}.err{color:#991b1b}</style></head><body>' +
    '<div class="c"><h1>GrowUP Driving · Dashboard TVDE</h1><p id="m">A ler a folha na sua Google Drive…</p></div>' +
    '<script>var CFG=' + cfg + ';' +
    'function msg(t,c){var m=document.getElementById("m");m.textContent=t;m.className=c||"";}' +
    'if(!CFG.sessao){msg("Abra esta página a partir do botão \\"Entrar com Google\\" no dashboard.","err");}' +
    'else{google.script.run.withSuccessHandler(function(r){' +
    'msg("Pronto! Dados de \\""+r.ficheiro+"\\" ("+r.utilizador+") enviados para o dashboard. Pode fechar esta janela.","ok");' +
    'setTimeout(function(){try{window.top.close();}catch(e){}},1500);' +
    '}).withFailureHandler(function(e){msg("Erro: "+String(e&&e.message||e).replace(/^Error:\\s*/,""),"err");}).guardarSessao(CFG.sessao,CFG.folha);}' +
    '</scr' + 'ipt></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('GrowUP · Entrar com Google');
}

/* ---------- Registar movimentos na aba "Entradas e Saídas - Tesla 3" ---------- */
const ABA_REGISTO = 'Entradas e Saídas - Tesla 3';
const QUEM_OK = ['Off', 'bp', 'Helder', 'PRIVADOS'];
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Pedidos de escrita do dashboard (POST com JSON). Só com o TOKEN. */
function doPost(e) {
  let p = {};
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) {}
  if (p.token !== TOKEN) return json_({ erro: 'Token inválido' });
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return json_({ erro: 'A folha está a ser atualizada por outro pedido. Tente outra vez.' });
  try {
    if (p.acao === 'adicionar') return json_(adicionarMovimento_(FILE_ID, p));
    if (p.acao === 'anular') return json_(anularMovimento_(FILE_ID, p));
    if (p.acao === 'upload') return json_(guardarFatura_(p));
    if (p.acao === 'agendamento') return json_(guardarAgendamento_(p));
    if (p.acao === 'removerAgendamento') return json_(removerAgendamento_(p));
    if (p.acao === 'lucro') return json_(registarLucro_(FILE_ID, p));
    if (p.acao === 'anularLucro') return json_(anularLucro_(FILE_ID, p));
    return json_({ erro: 'Ação desconhecida' });
  } catch (err) {
    return json_({ erro: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
    CacheService.getScriptCache().remove('dados');
  }
}

function validarMovimento_(p) {
  const desc = String(p.descricao || '').trim();
  if (!desc) throw new Error('Falta a descrição.');
  if (desc.length > 100) throw new Error('A descrição é demasiado longa (máx. 100 caracteres).');
  let v = Number(String(p.valor).replace(',', '.'));
  if (!isFinite(v) || v === 0) throw new Error('Valor inválido.');
  if (Math.abs(v) > 100000) throw new Error('Valor demasiado alto.');
  let tipo = p.tipo === 'Saída' || v < 0 ? 'Saída' : 'Entrada';
  v = Math.round(Math.abs(v) * 100) / 100 * (tipo === 'Saída' ? -1 : 1);   // saída fica com "-" na folha
  const data = String(p.data || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data inválida.');
  const quem = QUEM_OK.indexOf(p.quem) >= 0 ? p.quem : 'Off';
  const [y, m] = data.split('-').map(Number);
  return { descricao: desc, valor: v, tipo: tipo, data: data, quem: quem, mes: m, ano: y };
}

/* Utilitários para mexer no .xlsx sem o converter */
function serialData_(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5);
}
function escXml_(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function desXml_(s) { return String(s).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }
function atributo_(tag, nome) { const m = tag.match(new RegExp('\\s' + nome + '="([^"]*)"')); return m ? m[1] : null; }

function abrirXlsx_(fileId, nomeAba) {
  nomeAba = nomeAba || ABA_REGISTO;
  const file = DriveApp.getFileById(fileId);
  if (file.getMimeType() === MimeType.GOOGLE_SHEETS) return { file: file, nativo: true };
  const blobs = Utilities.unzip(file.getBlob().setContentType('application/zip'));
  const by = {}, ordem = [];
  blobs.forEach(b => { by[b.getName()] = b; ordem.push(b.getName()); });
  const wb = by['xl/workbook.xml'].getDataAsString('UTF-8');
  const tag = (wb.match(/<sheet [^>]+>/g) || []).find(s => desXml_(atributo_(s, 'name') || '') === nomeAba);
  if (!tag) {
    if (nomeAba !== ABA_REGISTO) return { file: file, by: by, ordem: ordem, caminho: null };
    throw new Error('Não encontrei a aba "' + nomeAba + '" no ficheiro.');
  }
  const rid = atributo_(tag, 'r:id');
  const rels = by['xl/_rels/workbook.xml.rels'].getDataAsString('UTF-8');
  const rel = (rels.match(/<Relationship [^>]+>/g) || []).find(r => atributo_(r, 'Id') === rid);
  const caminho = 'xl/' + atributo_(rel, 'Target').replace(/^\/?xl\//, '');
  return { file: file, by: by, ordem: ordem, caminho: caminho };
}

function gravarXlsx_(x, xmlAba) {
  x.by[x.caminho] = Utilities.newBlob('', 'application/xml', x.caminho).setDataFromString(xmlAba, 'UTF-8').setName(x.caminho);
  let wb = x.by['xl/workbook.xml'].getDataAsString('UTF-8');     // pede ao Excel/Sheets para recalcular ao abrir
  if (wb.indexOf('fullCalcOnLoad') < 0) {
    wb = /<calcPr\s*\/>/.test(wb) ? wb.replace(/<calcPr\s*\/>/, '<calcPr fullCalcOnLoad="1"/>')
       : /<calcPr/.test(wb) ? wb.replace('<calcPr', '<calcPr fullCalcOnLoad="1"') : wb.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');
    x.by['xl/workbook.xml'] = Utilities.newBlob('', 'application/xml', 'xl/workbook.xml').setDataFromString(wb, 'UTF-8').setName('xl/workbook.xml');
  }
  const nomes = ['[Content_Types].xml'].concat(x.ordem.filter(n => n !== '[Content_Types].xml'));
  const zip = Utilities.zip(nomes.map(n => x.by[n].setName(n)), x.file.getName()).setContentType(XLSX_MIME);
  Drive.Files.update({}, x.file.getId(), zip, { supportsAllDrives: true });
}

function mapaLinhas_(xml) {
  const mapa = {};
  (xml.match(/<row [^>]*\/>|<row [^>]*>[\s\S]*?<\/row>/g) || []).forEach(r => { mapa[+atributo_(r.match(/<row [^>]*>/)[0], 'r')] = r; });
  return mapa;
}
function valorCelula_(linhaXml, col, n) {
  if (!linhaXml) return null;
  const m = linhaXml.match(new RegExp('<c r="' + col + n + '"[^>]*?(?:/>|>([\\s\\S]*?)</c>)'));
  if (!m || !m[1]) return null;
  const v = m[1].match(/<v>([^<]*)<\/v>/); if (v) return v[1];
  const t = m[1].match(/<t[^>]*>([^<]*)<\/t>/); return t ? desXml_(t[1]) : null;
}
function estiloCelula_(linhaXml, col, n) {
  const m = linhaXml && linhaXml.match(new RegExp('<c r="' + col + n + '"[^>]*?\\ss="(\\d+)"'));
  return m ? ' s="' + m[1] + '"' : '';
}

function adicionarMovimento_(fileId, p) {
  const mov = validarMovimento_(p);
  const x = abrirXlsx_(fileId);
  if (x.nativo) return adicionarNativo_(x.file, mov);
  let xml = x.by[x.caminho].getDataAsString('UTF-8');
  const linhas = mapaLinhas_(xml);
  const temDados = n => valorCelula_(linhas[n], 'C', n) !== null || valorCelula_(linhas[n], 'F', n) !== null;
  let n = 4;
  while (temDados(n)) n++;                       // primeira linha vazia a seguir aos dados
  const modelo = n - 1;
  if (modelo < 4) throw new Error('A aba não tem dados para usar como modelo.');
  const mx = linhas[modelo];
  // SEMANA: semana 1 = semana (segunda a domingo) da primeira data da tabela
  const s0 = Number(valorCelula_(linhas[4], 'C', 4)), sd = serialData_(mov.data);
  const seg0 = s0 - ((s0 + 5) % 7);               // serial 2 = segunda-feira (01/01/1900)
  const semana = Math.floor((sd - seg0) / 7) + 1;
  const rowTag = mx.match(/<row [^>]*>/)[0].replace(/\sr="\d+"/, ' r="' + n + '"').replace(/\/>$/, '>');
  const st = c => estiloCelula_(mx, c, modelo);
  const txt = (c, v) => '<c r="' + c + n + '"' + st(c) + ' t="inlineStr"><is><t>' + escXml_(v) + '</t></is></c>';
  const nova = rowTag +
    '<c r="B' + n + '"' + st('B') + '><v>' + semana + '</v></c>' +
    '<c r="C' + n + '"' + st('C') + '><v>' + sd + '</v></c>' +
    txt('D', mov.tipo) + txt('E', mov.descricao) +
    '<c r="F' + n + '"' + st('F') + '><v>' + mov.valor + '</v></c>' +
    '<c r="G' + n + '"' + st('G') + '><f>MONTH(C' + n + ')</f><v>' + mov.mes + '</v></c>' +
    '<c r="H' + n + '"' + st('H') + '><f>YEAR(C' + n + ')</f><v>' + mov.ano + '</v></c>' +
    txt('I', mov.quem) + '</row>';
  if (linhas[n]) xml = xml.replace(linhas[n], nova);
  else {
    const seguinte = Object.keys(linhas).map(Number).filter(k => k > n).sort((a, b) => a - b)[0];
    xml = seguinte ? xml.replace(linhas[seguinte], nova + linhas[seguinte]) : xml.replace('</sheetData>', nova + '</sheetData>');
  }
  alargarTabela_(x, n);
  gravarXlsx_(x, xml);
  return { ok: true, linha: n, semana: semana, data: mov.data, tipo: mov.tipo, descricao: mov.descricao, valor: mov.valor, mes: mov.mes, ano: mov.ano, quem: mov.quem };
}

/** Se a linha nova ficar fora da tabela do Excel, alarga a tabela até ela. */
function alargarTabela_(x, n) {
  const relPath = x.caminho.replace('worksheets/', 'worksheets/_rels/') + '.rels';
  if (!x.by[relPath]) return;
  const rels = x.by[relPath].getDataAsString('UTF-8');
  (rels.match(/<Relationship [^>]+>/g) || []).filter(r => /\/table"/.test(r)).forEach(r => {
    const tp = 'xl/' + atributo_(r, 'Target').replace(/^\.\.\//, '');
    if (!x.by[tp]) return;
    let t = x.by[tp].getDataAsString('UTF-8');
    const ref = (t.match(/<table [^>]*\sref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/) || []);
    if (ref.length && n > +ref[4]) {
      t = t.replace(/(<table [^>]*\sref=")[A-Z]+\d+:[A-Z]+\d+"/, '$1' + ref[1] + ref[2] + ':' + ref[3] + n + '"')
           .replace(/(<autoFilter [^>]*ref=")[A-Z]+\d+:[A-Z]+\d+"/, '$1' + ref[1] + ref[2] + ':' + ref[3] + n + '"');
      x.by[tp] = Utilities.newBlob('', 'application/xml', tp).setDataFromString(t, 'UTF-8').setName(tp);
      if (x.ordem.indexOf(tp) < 0) x.ordem.push(tp);
    }
  });
}

/** Desfaz um registo: só apaga a linha se ainda tiver exatamente o que foi gravado. */
function anularMovimento_(fileId, p) {
  const n = parseInt(p.linha, 10);
  if (!(n > 3)) throw new Error('Linha inválida.');
  const x = abrirXlsx_(fileId);
  if (x.nativo) return anularNativo_(x.file, p);
  let xml = x.by[x.caminho].getDataAsString('UTF-8');
  const linhas = mapaLinhas_(xml), r = linhas[n];
  const igual = r && Number(valorCelula_(r, 'C', n)) === serialData_(String(p.data)) &&
                Math.abs(Number(valorCelula_(r, 'F', n)) - Number(p.valor)) < 0.005 &&
                String(valorCelula_(r, 'E', n)).trim() === String(p.descricao).trim();
  if (!igual) throw new Error('A linha ' + n + ' já foi alterada na folha; não a apaguei. Corrija diretamente no ficheiro.');
  const rowTag = r.match(/<row [^>]*>/)[0].replace(/\/>$/, '>');
  const vazia = rowTag + '<c r="C' + n + '"' + estiloCelula_(r, 'C', n) + '/><c r="F' + n + '"' + estiloCelula_(r, 'F', n) + '/></row>';
  xml = xml.replace(r, vazia);
  gravarXlsx_(x, xml);
  return { ok: true, linha: n };
}

/* Mesma coisa para quando a folha for uma Google Sheet normal */
function abaNativa_(file) {
  const sh = SpreadsheetApp.openById(file.getId()).getSheetByName(ABA_REGISTO);
  if (!sh) throw new Error('Não encontrei a aba "' + ABA_REGISTO + '".');
  return sh;
}
function adicionarNativo_(file, mov) {
  const sh = abaNativa_(file);
  const col = sh.getRange('C4:F' + sh.getMaxRows()).getValues();
  let i = 0; while (i < col.length && (col[i][0] !== '' || col[i][3] !== '')) i++;
  const n = i + 4, d0 = sh.getRange('C4').getValue();
  const [y, m, d] = mov.data.split('-').map(Number), dt = new Date(y, m - 1, d);
  const seg0 = d0 instanceof Date ? new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - ((d0.getDay() + 6) % 7)) : dt;
  const semana = Math.floor((dt - seg0) / (7 * 864e5)) + 1;
  sh.getRange(n, 2, 1, 8).setValues([[semana, dt, mov.tipo, mov.descricao, mov.valor, '=MONTH(C' + n + ')', '=YEAR(C' + n + ')', mov.quem]]);
  return { ok: true, linha: n, semana: semana, data: mov.data, tipo: mov.tipo, descricao: mov.descricao, valor: mov.valor, mes: mov.mes, ano: mov.ano, quem: mov.quem };
}
function anularNativo_(file, p) {
  const sh = abaNativa_(file), n = parseInt(p.linha, 10);
  const v = sh.getRange(n, 2, 1, 8).getValues()[0];
  if (String(v[3]).trim() !== String(p.descricao).trim() || Math.abs(Number(v[4]) - Number(p.valor)) >= 0.005)
    throw new Error('A linha ' + n + ' já foi alterada na folha; não a apaguei.');
  sh.getRange(n, 2, 1, 8).clearContent();
  return { ok: true, linha: n };
}

/** Teste numa CÓPIA do ficheiro (não mexe no original). Ver "Registo de execução". */
function testarEscrita() {
  const copia = Drive.Files.copy({ name: '_teste_escrita_GrowuP Driving.xlsx' }, FILE_ID, { supportsAllDrives: true });
  try {
    const r = adicionarMovimento_(copia.id, { descricao: 'TESTE CLAUDE', valor: 12.34, tipo: 'Saída', data: '2026-10-21', quem: 'Off' });
    Logger.log('ADICIONADO: ' + JSON.stringify(r));
    const d = lerFolha_(copia.id).viaturas['Tesla 3'];
    Logger.log('LIDO: ' + JSON.stringify(d.filter(l => l[2] === 'TESTE CLAUDE')) + ' | total linhas: ' + d.length);
    const r2 = adicionarMovimento_(copia.id, { descricao: 'TESTE 2', valor: 50, tipo: 'Entrada', data: '2026-10-21', quem: 'PRIVADOS' });
    Logger.log('ADICIONADO 2: ' + JSON.stringify(r2));
    Logger.log('ANULADO: ' + JSON.stringify(anularMovimento_(copia.id, r2)));
    const d2 = lerFolha_(copia.id).viaturas['Tesla 3'];
    Logger.log('DEPOIS DE ANULAR: ' + JSON.stringify(d2.filter(l => /^TESTE/.test(l[2]))) + ' | total linhas: ' + d2.length);
  } finally {
    DriveApp.getFileById(copia.id).setTrashed(true);   // a cópia de teste vai para o lixo
  }
}

/* ---------- Lucros semanais (aba "Lucros Semanais", 50% Nuno Cardoso / 50% Bruno Pinto) ---------- */
const ABA_LUCROS = 'Lucros Semanais';
const SEMANA1 = '2026-05-11';     // semana 1 (igual à aba do Tesla)
const CAB_LUCROS = ['SEMANA', 'INÍCIO', 'FIM', 'VALOR GANHO', 'NUNO CARDOSO (50%)', 'BRUNO PINTO (50%)', 'REGISTADO EM', 'OBSERVAÇÕES'];

function segundaFeira_(iso) {
  const [y, m, d] = iso.split('-').map(Number), dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}
function maisDias_(iso, n) { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }

function validarLucro_(p) {
  const data = String(p.semana || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Semana inválida.');
  const v = Math.round(Number(String(p.valor).replace(',', '.')) * 100) / 100;
  if (!isFinite(v)) throw new Error('Valor inválido.');
  if (Math.abs(v) > 100000) throw new Error('Valor demasiado alto.');
  const inicio = segundaFeira_(data);
  return { inicio: inicio, fim: maisDias_(inicio, 6), valor: v, obs: String(p.obs || '').trim().slice(0, 200),
           semana: Math.floor((serialData_(inicio) - serialData_(segundaFeira_(SEMANA1))) / 7) + 1 };
}

/** Cria a aba "Lucros Semanais" dentro do .xlsx (folha, relação, tipo de conteúdo e cabeçalho). */
function criarAbaLucros_(x) {
  let wb = x.by['xl/workbook.xml'].getDataAsString('UTF-8');
  let rels = x.by['xl/_rels/workbook.xml.rels'].getDataAsString('UTF-8');
  let ct = x.by['[Content_Types].xml'].getDataAsString('UTF-8');
  const nums = x.ordem.map(n => (n.match(/^xl\/worksheets\/sheet(\d+)\.xml$/) || [])[1]).filter(Boolean).map(Number);
  const n = Math.max.apply(null, nums.concat([0])) + 1, caminho = 'xl/worksheets/sheet' + n + '.xml';
  const rid = 'rId' + (Math.max.apply(null, (rels.match(/Id="rId(\d+)"/g) || []).map(s => +s.match(/\d+/)[0]).concat([0])) + 1);
  const sid = Math.max.apply(null, (wb.match(/sheetId="(\d+)"/g) || []).map(s => +s.match(/\d+/)[0]).concat([0])) + 1;
  const exemplo = (rels.match(/<Relationship [^>]*worksheets\/sheet\d+\.xml"[^>]*>/) || [''])[0];
  const prefixo = /Target="\/xl\//.test(exemplo) ? '/xl/' : '';
  wb = wb.replace('</sheets>', '<sheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" state="visible" name="' + escXml_(ABA_LUCROS) + '" sheetId="' + sid + '" r:id="' + rid + '"/></sheets>');
  rels = rels.replace('</Relationships>', '<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="' + prefixo + 'worksheets/sheet' + n + '.xml"/></Relationships>');
  if (ct.indexOf('/' + caminho + '"') < 0)
    ct = ct.replace('</Types>', '<Override PartName="/' + caminho + '" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  const larg = [9, 12, 12, 14, 20, 20, 18, 40];
  const cab = CAB_LUCROS.map((t, i) => '<c r="' + String.fromCharCode(65 + i) + '1" s="58" t="inlineStr"><is><t>' + escXml_(t) + '</t></is></c>').join('');
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15.75"/><cols>' + larg.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>' +
    '<sheetData><row r="1" ht="25.5" customHeight="1">' + cab + '</row></sheetData></worksheet>';
  const blob = (nome, txt) => Utilities.newBlob('', 'application/xml', nome).setDataFromString(txt, 'UTF-8').setName(nome);
  x.by['xl/workbook.xml'] = blob('xl/workbook.xml', wb);
  x.by['xl/_rels/workbook.xml.rels'] = blob('xl/_rels/workbook.xml.rels', rels);
  x.by['[Content_Types].xml'] = blob('[Content_Types].xml', ct);
  x.by[caminho] = blob(caminho, xml); x.ordem.push(caminho);
  x.caminho = caminho;
  return xml;
}

function linhaLucro_(n, l) {
  const agora = Utilities.formatDate(new Date(), 'Europe/Lisbon', 'dd/MM/yyyy HH:mm');
  return '<row r="' + n + '" ht="15.75" customHeight="1">' +
    '<c r="A' + n + '"><v>' + l.semana + '</v></c>' +
    '<c r="B' + n + '" s="121"><v>' + serialData_(l.inicio) + '</v></c>' +
    '<c r="C' + n + '" s="121"><v>' + serialData_(l.fim) + '</v></c>' +
    '<c r="D' + n + '" s="65"><v>' + l.valor + '</v></c>' +
    '<c r="E' + n + '" s="65"><f>D' + n + '*0.5</f><v>' + Math.round(l.valor * 50) / 100 + '</v></c>' +
    '<c r="F' + n + '" s="65"><f>D' + n + '*0.5</f><v>' + Math.round(l.valor * 50) / 100 + '</v></c>' +
    '<c r="G' + n + '" s="64" t="inlineStr"><is><t>' + agora + '</t></is></c>' +
    '<c r="H' + n + '" s="64" t="inlineStr"><is><t>' + escXml_(l.obs) + '</t></is></c></row>';
}

/** Grava (ou substitui) o lucro de uma semana na aba "Lucros Semanais". */
function registarLucro_(fileId, p) {
  const l = validarLucro_(p);
  const x = abrirXlsx_(fileId, ABA_LUCROS);
  if (x.nativo) return registarLucroNativo_(x.file, l, p.substituir === true);
  let xml = x.caminho ? x.by[x.caminho].getDataAsString('UTF-8') : criarAbaLucros_(x);
  const linhas = mapaLinhas_(xml), alvo = serialData_(l.inicio);
  let n = 2, existente = 0;   // n = linha a seguir à última preenchida
  Object.keys(linhas).map(Number).filter(k => k > 1).sort((a, b) => a - b).forEach(k => {
    const b = valorCelula_(linhas[k], 'B', k);
    if (b === null && valorCelula_(linhas[k], 'D', k) === null) return;
    n = k + 1;
    if (!existente && Number(b) === alvo) existente = k;
  });
  if (existente && p.substituir !== true)
    return { existe: true, linha: existente, valorAtual: Number(valorCelula_(linhas[existente], 'D', existente)), inicio: l.inicio, fim: l.fim, semana: l.semana };
  const destino = existente || n, nova = linhaLucro_(destino, l);
  if (linhas[destino]) xml = xml.replace(linhas[destino], nova);
  else {
    const seguinte = Object.keys(linhas).map(Number).filter(k => k > destino).sort((a, b) => a - b)[0];
    xml = seguinte ? xml.replace(linhas[seguinte], nova + linhas[seguinte]) : xml.replace('</sheetData>', nova + '</sheetData>');
  }
  gravarXlsx_(x, xml);
  return { ok: true, linha: destino, substituido: !!existente, inicio: l.inicio, fim: l.fim, semana: l.semana, valor: l.valor,
           nuno: Math.round(l.valor * 50) / 100, bruno: Math.round(l.valor * 50) / 100, obs: l.obs };
}

/** Apaga o lucro registado (só se a linha ainda tiver a mesma semana e valor). */
function anularLucro_(fileId, p) {
  const n = parseInt(p.linha, 10);
  if (!(n > 1)) throw new Error('Linha inválida.');
  const x = abrirXlsx_(fileId, ABA_LUCROS);
  if (x.nativo) return anularLucroNativo_(x.file, p);
  if (!x.caminho) throw new Error('A aba "' + ABA_LUCROS + '" não existe.');
  let xml = x.by[x.caminho].getDataAsString('UTF-8');
  const linhas = mapaLinhas_(xml), r = linhas[n];
  if (!r || Number(valorCelula_(r, 'B', n)) !== serialData_(String(p.inicio)) || Math.abs(Number(valorCelula_(r, 'D', n)) - Number(p.valor)) >= 0.005)
    throw new Error('A linha ' + n + ' já foi alterada na folha; não a apaguei.');
  xml = xml.replace(r, '<row r="' + n + '"/>');
  gravarXlsx_(x, xml);
  return { ok: true, linha: n };
}

/* Versão para Google Sheet normal */
function abaLucrosNativa_(file) {
  const ss = SpreadsheetApp.openById(file.getId());
  let sh = ss.getSheetByName(ABA_LUCROS);
  if (!sh) { sh = ss.insertSheet(ABA_LUCROS); sh.getRange(1, 1, 1, 8).setValues([CAB_LUCROS]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function registarLucroNativo_(file, l, substituir) {
  const sh = abaLucrosNativa_(file), vals = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 8).getValues();
  let existente = 0, n = 2;
  vals.forEach((r, i) => { if (r[1] !== '') { n = i + 3; if (!existente && data_(r[1]) === l.inicio) existente = i + 2; } });
  if (existente && !substituir) return { existe: true, linha: existente, valorAtual: Number(vals[existente - 2][3]), inicio: l.inicio, fim: l.fim, semana: l.semana };
  const destino = existente || n, d = s => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); };
  sh.getRange(destino, 1, 1, 8).setValues([[l.semana, d(l.inicio), d(l.fim), l.valor, '=D' + destino + '*0.5', '=D' + destino + '*0.5',
    Utilities.formatDate(new Date(), 'Europe/Lisbon', 'dd/MM/yyyy HH:mm'), l.obs]]);
  return { ok: true, linha: destino, substituido: !!existente, inicio: l.inicio, fim: l.fim, semana: l.semana, valor: l.valor,
           nuno: Math.round(l.valor * 50) / 100, bruno: Math.round(l.valor * 50) / 100, obs: l.obs };
}
function anularLucroNativo_(file, p) {
  const sh = abaLucrosNativa_(file), n = parseInt(p.linha, 10), r = sh.getRange(n, 1, 1, 8).getValues()[0];
  if (data_(r[1]) !== String(p.inicio) || Math.abs(Number(r[3]) - Number(p.valor)) >= 0.005) throw new Error('A linha ' + n + ' já foi alterada na folha; não a apaguei.');
  sh.getRange(n, 1, 1, 8).clearContent();
  return { ok: true, linha: n };
}

/** Teste numa CÓPIA: cria a aba, grava, substitui e anula (não mexe no original). */
function testarLucros() {
  const copia = Drive.Files.copy({ name: '_teste_lucros_GrowuP Driving.xlsx' }, FILE_ID, { supportsAllDrives: true });
  try {
    Logger.log('1: ' + JSON.stringify(registarLucro_(copia.id, { semana: '2026-10-21', valor: 640.5, obs: 'teste' })));
    Logger.log('2 (mesma semana): ' + JSON.stringify(registarLucro_(copia.id, { semana: '2026-10-19', valor: 700 })));
    const r3 = registarLucro_(copia.id, { semana: '2026-10-19', valor: 700, substituir: true });
    Logger.log('3 (substituir): ' + JSON.stringify(r3));
    const r4 = registarLucro_(copia.id, { semana: '2026-10-12', valor: 512.25 });
    Logger.log('4: ' + JSON.stringify(r4));
    Logger.log('LIDO: ' + JSON.stringify(lerFolha_(copia.id).lucros));
    Logger.log('ANULAR 4: ' + JSON.stringify(anularLucro_(copia.id, r4)));
    Logger.log('LIDO DEPOIS: ' + JSON.stringify(lerFolha_(copia.id).lucros));
    Logger.log('TESLA OK: ' + lerFolha_(copia.id).viaturas['Tesla 3'].length + ' linhas');
  } finally {
    DriveApp.getFileById(copia.id).setTrashed(true);
  }
}

/* ---------- Agendamentos de transfers (folha "GrowuP Transfers · Agendamentos") ---------- */
const AGENDA_NOME = 'GrowuP Transfers · Agendamentos';
const AGENDA_CAB = ['ID', 'CÓDIGO', 'DATA', 'HORA', 'DURAÇÃO (MIN)', 'NOME', 'TELEMÓVEL', 'RECOLHA', 'CHEGADA', 'KM', 'PREÇO', 'PAX', 'MALAS', 'NOTAS', 'ESTADO', 'ATUALIZADO'];
const AGENDA_ESTADOS = ['agendada', 'concluida', 'cancelada'];

/** Folha Google com os agendamentos (criada na primeira vez, na Drive do dono do script). */
function folhaAgenda_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('agendaId');
  if (id) { try { const ss = SpreadsheetApp.openById(id); return ss.getSheets()[0]; } catch (e) {} }
  const ss = SpreadsheetApp.create(AGENDA_NOME), sh = ss.getSheets()[0];
  sh.setName('Agendamentos');
  sh.getRange(1, 1, sh.getMaxRows(), AGENDA_CAB.length).setNumberFormat('@');   // tudo como texto (datas e horas não mudam)
  sh.getRange(1, 1, 1, AGENDA_CAB.length).setValues([AGENDA_CAB]).setFontWeight('bold').setBackground('#1c2029').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  props.setProperty('agendaId', ss.getId());
  return sh;
}
function codigoNovo_() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', b = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  let s = ''; for (let i = 0; i < 12; i++) s += c[parseInt(b.substr(i * 2, 2), 16) % c.length];
  return s;
}
function linhasAgenda_(sh) {
  const n = sh.getLastRow();
  return n < 2 ? [] : sh.getRange(2, 1, n - 1, AGENDA_CAB.length).getValues();
}
const txtA_ = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 200);

/** Cria ou atualiza um agendamento (com TOKEN). Devolve o código do link do cliente. */
function guardarAgendamento_(p) {
  const a = p.agendamento || {};
  const id = txtA_(a.id, 20);
  if (!/^\d{6,20}$/.test(id)) throw new Error('Agendamento sem ID.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(a.data)) || !/^\d{2}:\d{2}$/.test(String(a.hora))) throw new Error('Data ou hora inválida.');
  const estado = AGENDA_ESTADOS.indexOf(a.estado) >= 0 ? a.estado : 'agendada';
  const sh = folhaAgenda_(), linhas = linhasAgenda_(sh);
  const i = linhas.findIndex(r => String(r[0]) === id);
  const codigo = i >= 0 && linhas[i][1] ? String(linhas[i][1]) : codigoNovo_();
  const dur = Math.max(30, Math.ceil((Number(a.segundos) || 0) / 60) + 15);
  const valores = [[id, codigo, a.data, a.hora, String(dur), txtA_(a.nome, 80), txtA_(a.tel, 30), txtA_(a.origem), txtA_(a.destino),
    String(Math.round((Number(a.km) || 0) * 10) / 10), String(Math.round((Number(a.preco) || 0) * 100) / 100), txtA_(a.pax, 3), txtA_(a.malas, 3),
    txtA_(a.notas, 300), estado, Utilities.formatDate(new Date(), 'Europe/Lisbon', 'yyyy-MM-dd HH:mm')]];
  const linha = i >= 0 ? i + 2 : sh.getLastRow() + 1;
  sh.getRange(linha, 1, 1, AGENDA_CAB.length).setNumberFormat('@').setValues(valores);
  return { ok: true, id: id, codigo: codigo, estado: estado };
}
function removerAgendamento_(p) {
  const id = txtA_(p.id, 20), sh = folhaAgenda_(), linhas = linhasAgenda_(sh);
  const i = linhas.findIndex(r => String(r[0]) === id);
  if (i >= 0) sh.deleteRow(i + 2);
  return { ok: true, removido: i >= 0 };
}

/** Público: o cliente vê só o seu agendamento, pelo código do link. */
function reservaPublica_(codigo) {
  codigo = String(codigo || '');
  if (!/^[A-Za-z0-9]{12}$/.test(codigo)) return { erro: 'Link inválido.' };
  const r = linhasAgenda_(folhaAgenda_()).find(x => String(x[1]) === codigo);
  if (!r) return { erro: 'Agendamento não encontrado. Confirme o link ou contacte a GrowuP Driving.' };
  return { data: String(r[2]), hora: String(r[3]), duracao: Number(r[4]) || 30, nome: String(r[5]).split(' ')[0],
           origem: String(r[7]), destino: String(r[8]), km: Number(r[9]) || 0, preco: Number(r[10]) || 0,
           pax: String(r[11]), malas: String(r[12]), estado: String(r[14]) };
}
/** Público: horários ocupados (sem nomes, telefones nem moradas). */
function horariosOcupados_() {
  const hoje = Utilities.formatDate(new Date(), 'Europe/Lisbon', 'yyyy-MM-dd');
  const ocupados = linhasAgenda_(folhaAgenda_())
    .filter(r => String(r[14]) === 'agendada' && String(r[2]) >= hoje)
    .map(r => ({ data: String(r[2]), hora: String(r[3]), duracao: Number(r[4]) || 30 }))
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  return { atualizado: new Date().toISOString(), ocupados: ocupados };
}

/* ---------- Enviar faturas para "CARROSSEL DE RESULTADOS – LDA → Faturas" ---------- */
const FAT_PAI = 'CARROSSEL DE RESULTADOS – LDA';
const FAT_PASTA = 'Faturas';
const FAT_LINK = '';      // opcional: link da pasta "Faturas" (se a pesquisa por nome não a encontrar)
const FAT_MAX_MB = 20;
const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
                  'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function normalizarNome_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[‐-―-]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Encontra "CARROSSEL DE RESULTADOS – LDA → Faturas" (aceita – ou - no nome). */
function pastaFaturas_() {
  const props = PropertiesService.getScriptProperties();
  const linkId = (String(FAT_LINK).match(/folders\/([A-Za-z0-9_-]{20,})/) || [])[1];
  const guardado = props.getProperty('pastaFaturasId') || linkId;
  if (guardado) {
    try { const f = DriveApp.getFolderById(guardado); if (!f.isTrashed()) return f; } catch (e) {}
  }
  const alvoPai = normalizarNome_(FAT_PAI), alvoFat = normalizarNome_(FAT_PASTA);
  const pais = DriveApp.searchFolders("title contains 'CARROSSEL' and trashed = false");
  while (pais.hasNext()) {
    const pai = pais.next();
    if (normalizarNome_(pai.getName()) !== alvoPai) continue;
    const filhos = pai.getFolders();
    while (filhos.hasNext()) {
      const f = filhos.next();
      if (normalizarNome_(f.getName()) === alvoFat) { props.setProperty('pastaFaturasId', f.getId()); return f; }
    }
  }
  throw new Error('Não encontrei a pasta "' + FAT_PAI + ' → ' + FAT_PASTA + '" no Google Drive.');
}

/** Pasta "2026-10 Outubro" dentro de Faturas (cria se não existir). */
function pastaDoMes_(raiz, data) {
  const nome = Utilities.formatDate(data, 'Europe/Lisbon', 'yyyy-MM') + ' ' + MESES_PT[Number(Utilities.formatDate(data, 'Europe/Lisbon', 'M')) - 1];
  const it = raiz.getFoldersByName(nome);
  return it.hasNext() ? it.next() : raiz.createFolder(nome);
}

/** Recebe um ficheiro (base64) do dashboard e guarda-o na pasta do mês. */
function guardarFatura_(p) {
  const mimesOk = /^(application\/pdf|image\/(jpeg|png|heic|heif|webp))$/;
  let nome = String(p.nome || '').replace(/[\\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
  const mime = String(p.mime || '').toLowerCase();
  if (!mimesOk.test(mime)) throw new Error('Só são aceites PDF ou imagens (JPG, PNG, HEIC).');
  const bytes = Utilities.base64Decode(String(p.dados || ''));
  if (!bytes.length) throw new Error('O ficheiro está vazio.');
  if (bytes.length > FAT_MAX_MB * 1024 * 1024) throw new Error('O ficheiro tem mais de ' + FAT_MAX_MB + ' MB.');
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(String(p.data)) ? String(p.data) : Utilities.formatDate(new Date(), 'Europe/Lisbon', 'yyyy-MM-dd');
  const [y, m, d] = iso.split('-').map(Number);
  const pasta = pastaDoMes_(pastaFaturas_(), new Date(y, m - 1, d, 12));
  if (!nome) nome = 'Fatura ' + iso;
  const existentes = pasta.getFilesByName(nome);
  while (existentes.hasNext()) {
    const f = existentes.next();
    if (f.getSize() === bytes.length) return { ok: true, jaExistia: true, nome: f.getName(), pasta: pasta.getName(), url: f.getUrl() };
  }
  if (pasta.getFilesByName(nome).hasNext()) nome = nome.replace(/(\.[a-z0-9]+)?$/i, ' (' + Utilities.formatDate(new Date(), 'Europe/Lisbon', 'HHmmss') + ')$1');
  const f = pasta.createFile(Utilities.newBlob(bytes, mime, nome));
  f.setDescription('Enviado pelo Dashboard TVDE em ' + Utilities.formatDate(new Date(), 'Europe/Lisbon', 'dd/MM/yyyy HH:mm'));
  return { ok: true, nome: f.getName(), pasta: pasta.getName(), url: f.getUrl() };
}

/* ---------- Utilitários ---------- */
function data_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, 'Europe/Lisbon', 'yyyy-MM-dd');
  return String(v).trim();
}

function publico_(fn) {
  try { return json_(fn()); } catch (err) { return json_({ erro: String(err && err.message || err) }); }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Corra esta função uma vez no editor para testar (ver "Registo de execução"). */
function testar() {
  const d = lerFolha_(FILE_ID);
  Object.keys(d.viaturas).forEach(v => Logger.log(v + ': ' + d.viaturas[v].length + ' linhas'));
}
