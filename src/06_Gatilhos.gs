/**
 * 06_Gatilhos — lembrete mensal, alertas de orçamento, rotina diária e carteiro.
 */

const GATILHOS = ['lembreteMensal', 'rotinaDiaria', 'carteiro'];

function instalarGatilhos_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (GATILHOS.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('lembreteMensal').timeBased().onMonthDay(1).atHour(8).create();
  ScriptApp.newTrigger('rotinaDiaria').timeBased().everyDays(1).atHour(7).create();
  ScriptApp.newTrigger('carteiro').timeBased().everyHours(1).create();
}

function enviarEmail_(assunto, html, para) {
  const destino = para || emailDestino_();
  if (!destino) { log_('email', 'sem destinatário: ' + assunto); return false; }
  MailApp.sendEmail({ to: destino, subject: '[Assessor] ' + assunto, htmlBody: html, name: 'Assessor Financeiro' });
  log_('email', assunto + ' -> ' + destino);
  return true;
}

function brl_(v) {
  const n = arred2(v);
  const partes = Math.abs(n).toFixed(2).split('.');
  return (n < 0 ? '-' : '') + 'R$ ' + partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + partes[1];
}

// ---------------------------------------------------------------- lembrete do dia 1

/** Dia 1 de cada mês, às 8h: resumo do mês anterior e checklist do mês. */
function lembreteMensal() {
  const agora = hoje_();
  const mesAtual = mesChave(agora);
  const anterior = somarMeses(mesAtual, -1);
  const lanc = lerTabela_('Lancamentos').filter(function (l) { const d = parseData(l['Data']); return d && mesChave(d) === anterior; });
  const soma = function (tipo) { return lanc.filter(function (l) { return l['Tipo'] === tipo; }).reduce(function (s, l) { return s + Number(l['Valor']); }, 0); };
  const orc = resumoOrcamentoMes_(anterior).filter(function (c) { return c.pct >= 1; });
  const aporteFeito = lerTabela_('Aporte_Reserva').some(function (l) { return mesDe(l['Mês']) === mesAtual; });
  const nome = lerConfig_().nome;

  const html = '<p>' + (nome ? 'Oi, ' + nome + '!' : 'Oi!') + ' Começou ' + rotuloMes(mesAtual) + '. Seu checklist:</p><ol>' +
    '<li>Atualize o saldo das contas (Cadastros &gt; Contas).</li>' +
    '<li>Lance o que faltou de ' + rotuloMes(anterior) + ' ou importe os extratos.</li>' +
    (aporteFeito ? '' : '<li>Registre o aporte do mês (Investimentos &gt; Aporte mensal e reserva).</li>') +
    '<li>Revise as compras futuras e o calendário de compras.</li></ol>' +
    '<p><b>' + rotuloMes(anterior) + ':</b> entradas ' + brl_(soma('Entrada')) + ', saídas ' + brl_(soma('Saída')) +
    ', resultado ' + brl_(soma('Entrada') - soma('Saída')) + '.</p>' +
    (orc.length ? '<p>Categorias que passaram da meta: ' + orc.map(function (c) { return c.categoria + ' (' + Math.round(c.pct * 100) + '%)'; }).join(', ') + '.</p>' : '<p>Nenhuma categoria passou da meta. 👏</p>') +
    '<p><a href="' + planilha_().getUrl() + '">Abrir a planilha</a></p>';
  enviarEmail_('Lembrete de ' + rotuloMes(mesAtual), html);
}

// ---------------------------------------------------------------- alertas de orçamento

/** Envia alertas de 80% e 100% da meta do mês atual. Cada nível só é enviado uma vez. */
function verificarAlertasOrcamento() {
  const cfg = lerConfig_();
  const mes = mesChave(hoje_());
  const niveis = [Number(cfg.alerta_pct1) || 80, Number(cfg.alerta_pct2) || 100];
  const enviados = new Set();
  lerTabela_('Alertas').forEach(function (a) { enviados.add(mesDe(a['Mês']) + '|' + a['Categoria'] + '|' + Number(a['Nível'])); });
  const resumo = resumoOrcamentoMes_(mes);
  const realizado = {}, metas = {};
  resumo.forEach(function (c) { realizado[c.categoria] = c.realizado; metas[c.categoria] = c.meta; });
  const novos = calcularAlertas(realizado, metas, enviados, mes, niveis);
  if (!novos.length) return [];

  const html = '<p>Alerta de orçamento de ' + rotuloMes(mes) + ':</p><ul>' + novos.map(function (a) {
    return '<li><b>' + a.categoria + '</b>: ' + brl_(a.realizado) + ' de ' + brl_(a.meta) + ' (' + Math.round(a.realizado / a.meta * 100) + '%)' +
      (a.nivel >= 100 ? ' — meta estourada' : ' — passou de ' + a.nivel + '%') + '</li>';
  }).join('') + '</ul>';
  const ok = enviarEmail_('Orçamento: ' + novos.map(function (a) { return a.categoria; }).join(', '), html);
  if (ok) {
    const agora = new Date();
    const registros = [];
    novos.forEach(function (a) {
      // ao estourar 100% direto, registra também o 80% para não mandar o de 80% depois
      a.cobre.forEach(function (n) {
        if (!enviados.has(mes + '|' + a.categoria + '|' + n)) {
          registros.push({ 'Mês': mes, 'Categoria': a.categoria, 'Nível': n, 'Realizado': a.realizado, 'Meta': a.meta, 'Enviado em': agora });
        }
      });
    });
    acrescentarLinhas_('Alertas', registros);
  }
  return novos;
}

// ---------------------------------------------------------------- rotina diária

function rotinaDiaria() {
  try { marcarDuplicadosImportacao(); } catch (e) { log_('erro rotina', e.message); }
  try { verificarAlertasOrcamento(); } catch (e) { log_('erro rotina', e.message); }
  try { atualizarRelatorios(); } catch (e) { log_('erro rotina', e.message); }
}

// ---------------------------------------------------------------- carteiro

/**
 * Grava um relatório para o carteiro enviar. É o que o Claude chama nas fases 4 e 5
 * (ou escreve direto na aba Relatorios com Status "Pendente").
 */
function registrarRelatorio(assunto, corpoHtml, destinatario) {
  const id = novoId_('R');
  acrescentarLinhas_('Relatorios', [{
    'ID': id, 'Criado em': new Date(), 'Assunto': assunto, 'Corpo': corpoHtml,
    'Destinatário': destinatario || '', 'Status': 'Pendente', 'Enviado em': '', 'Erro': ''
  }]);
  return id;
}

/** Envia todos os relatórios pendentes da aba Relatorios. Roda de hora em hora. */
function carteiro() {
  let enviados = 0, erros = 0;
  lerTabela_('Relatorios').forEach(function (r) {
    if (r['Status'] !== 'Pendente') return;
    try {
      if (!String(r['Assunto'] || '').trim() || !String(r['Corpo'] || '').trim()) throw new Error('Relatório sem assunto ou corpo');
      const ok = enviarEmail_(r['Assunto'], String(r['Corpo']), r['Destinatário'] || '');
      if (!ok) throw new Error('Sem e-mail de destino configurado');
      gravarCelula_('Relatorios', r._linha, 'Status', 'Enviado');
      gravarCelula_('Relatorios', r._linha, 'Enviado em', new Date());
      enviados++;
    } catch (e) {
      gravarCelula_('Relatorios', r._linha, 'Status', 'Erro');
      gravarCelula_('Relatorios', r._linha, 'Erro', e.message);
      erros++;
    }
  });
  if (enviados || erros) log_('carteiro', enviados + ' enviados, ' + erros + ' com erro');
  return { enviados: enviados, erros: erros };
}
