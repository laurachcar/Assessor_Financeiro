/**
 * Carrega os arquivos .gs num contexto do Node com uma planilha simulada
 * (SpreadsheetApp, MailApp, ScriptApp etc. em memória).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');

/** Objeto que aceita qualquer método de formatação e devolve a si mesmo. */
function comFallback(alvo) {
  const p = new Proxy(alvo, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (typeof prop === 'symbol') return undefined;
      return function () { return p; };
    }
  });
  return p;
}

function criarRange(sheet, r, c, nr, nc) {
  return comFallback({
    getValues() {
      const out = [];
      for (let i = 0; i < nr; i++) {
        const linha = [];
        for (let j = 0; j < nc; j++) {
          const l = sheet.dados[r - 1 + i];
          linha.push(l && l[c - 1 + j] !== undefined ? l[c - 1 + j] : '');
        }
        out.push(linha);
      }
      return out;
    },
    setValues(vals) {
      if (vals.length !== nr || vals.some(v => v.length !== nc)) throw new Error('setValues: dimensões erradas ' + sheet.nome);
      for (let i = 0; i < nr; i++) {
        if (!sheet.dados[r - 1 + i]) sheet.dados[r - 1 + i] = [];
        for (let j = 0; j < nc; j++) {
          let v = vals[i][j];
          if (typeof v === 'string' && v.startsWith("'")) v = v.slice(1); // como o Sheets: apóstrofo força texto
          sheet.dados[r - 1 + i][c - 1 + j] = v;
        }
      }
      return this;
    },
    getValue() { return this.getValues()[0][0]; },
    setValue(v) { return this.setValues([[v]]); },
    getRow() { return r; },
    getColumn() { return c; },
    getSheet() { return sheet.api; }
  });
}

function criarSheet(nome) {
  const sheet = { nome, dados: [], oculta: false };
  sheet.api = comFallback({
    getName() { return nome; },
    getRange(r, c, nr, nc) { return criarRange(sheet, r, c, nr || 1, nc || 1); },
    getLastRow() {
      for (let i = sheet.dados.length - 1; i >= 0; i--) {
        if (sheet.dados[i] && sheet.dados[i].some(v => v !== '' && v !== null && v !== undefined)) return i + 1;
      }
      return 0;
    },
    getLastColumn() { return Math.max(0, ...sheet.dados.map(l => (l || []).length)); },
    getMaxRows() { return 1000; },
    appendRow(linha) { sheet.dados[this.getLastRow()] = linha.slice(); return this; },
    clearContents() { sheet.dados = []; return this; },
    clear() { sheet.dados = []; return this; },
    hideSheet() { sheet.oculta = true; return this; },
    isSheetHidden() { return sheet.oculta; },
    getProtections() { return []; },
    protect() { return comFallback({}); }
  });
  return sheet;
}

function criarAmbiente(opcoes) {
  opcoes = opcoes || {};
  const abas = {};
  const ordem = [];
  const emails = [];
  const gatilhos = [];
  const toasts = [];
  const alertas = [];

  const ss = comFallback({
    getSheetByName(n) { return abas[n] ? abas[n].api : null; },
    insertSheet(n) { if (abas[n]) throw new Error('já existe ' + n); abas[n] = criarSheet(n); ordem.push(n); return abas[n].api; },
    getSheets() { return ordem.map(n => abas[n].api); },
    deleteSheet(s) { const n = s.getName(); delete abas[n]; ordem.splice(ordem.indexOf(n), 1); },
    toast(msg) { toasts.push(msg); },
    getUrl() { return 'https://docs.google.com/spreadsheets/d/teste'; }
  });

  const ui = {
    alert(titulo, msg) { alertas.push(msg || titulo); },
    ButtonSet: { OK: 'OK' }
  };

  const contexto = {
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      getUi: () => { if (opcoes.semUi) throw new Error('sem UI'); return ui; },
      ProtectionType: { SHEET: 'SHEET', RANGE: 'RANGE' },
      newDataValidation: () => comFallback({})
    },
    Session: {
      getScriptTimeZone: () => 'America/Sao_Paulo',
      getEffectiveUser: () => ({ getEmail: () => 'dono@exemplo.com' })
    },
    Utilities: {
      formatDate: (d) => String(d.getTime())
    },
    MailApp: { sendEmail: (o) => emails.push(o) },
    LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ScriptApp: {
      getProjectTriggers: () => gatilhos.slice(),
      deleteTrigger: (t) => gatilhos.splice(gatilhos.indexOf(t), 1),
      newTrigger: (fn) => {
        const cfg = { fn };
        const b = comFallback({
          create() { const t = { getHandlerFunction: () => fn, cfg }; gatilhos.push(t); return t; }
        });
        return b;
      }
    },
    HtmlService: comFallback({})
  };
  vm.createContext(contexto);
  fs.readdirSync(SRC).filter(f => f.endsWith('.gs')).sort().forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), contexto, { filename: f });
  });

  const rodar = (codigo) => vm.runInContext(codigo, contexto);
  return {
    ctx: contexto, rodar, abas, emails, gatilhos, toasts, alertas,
    /** Fixa a data "de hoje" usada pelo sistema. */
    fixarHoje(ano, mes, dia) { rodar(`hoje_ = function () { return new Date(${ano}, ${mes - 1}, ${dia}); }`); },
    /** Chama uma função global do sistema. */
    chamar(nome, ...args) { return contexto[nome] ? contexto[nome](...args) : rodar(nome)(...args); },
    tabela(nome) { return rodar('lerTabela_')(nome); },
    data(a, m, d) { return rodar(`new Date(${a}, ${m - 1}, ${d})`); }
  };
}

/** Mini executor de testes, sem dependências. */
function suite(titulo) {
  const testes = [];
  return {
    teste(nome, fn) { testes.push({ nome, fn }); },
    rodar() {
      let falhas = 0;
      console.log('\n' + titulo);
      testes.forEach(t => {
        try { t.fn(); console.log('  ✓ ' + t.nome); }
        catch (e) { falhas++; console.log('  ✗ ' + t.nome + '\n    ' + (e.stack || e.message).split('\n').slice(0, 4).join('\n    ')); }
      });
      console.log(`\n${testes.length - falhas} de ${testes.length} passaram`);
      if (falhas) process.exitCode = 1;
    }
  };
}

module.exports = { criarAmbiente, suite };
