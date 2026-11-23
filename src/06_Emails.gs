/**
 * ASSESSOR FINANCEIRO — 06_Emails.gs
 * --------------------------------------------------------------
 * Tudo que sai por e-mail. Os envios usam a sua conta Google (MailApp),
 * então não precisam de conector nem de tokens.
 */

function emailDestino_() {
  const e = cfg_('email_destino', '');
  if (!e) throw new Error('Configure o e-mail em Assessor > Cadastros > Configurações gerais.');
  return e;
}

function estiloEmail_(titulo, corpoHtml) {
  return '<div style="font-family:Arial,sans-serif;font-size:14px;color:#202124;max-width:620px">' +
    '<h2 style="font-size:18px;margin:0 0 12px">' + titulo + '</h2>' + corpoHtml +
    '<p style="color:#5f6368;font-size:12px;margin-top:24px">' + SISTEMA.nome + ' · enviado automaticamente</p></div>';
}

/** Gatilho: dia 1 de cada mês, 8h. */
function lembreteMensal() {
  try {
    const url = ss_().getUrl();
    const mesAnt = addMeses_(competencia_(hoje_()), -1);
    const lancAnt = lerTabela_(ABAS.LANCAMENTOS).filter(l => l['Competência'] === mesAnt).length;
    const pendentes = lerTabela_(ABAS.STAGING).length;
    const fixos = lerTabela_(ABAS.FIXOS).filter(f => f['Tipo'] === 'Saída' && ativoNoMes_(f, competencia_(hoje_())));
    const semMeta = lerTabela_(ABAS.CATEGORIAS).filter(c => c['Tipo'] === 'Saída' && !(n0_(c['Meta mensal (R$)']) > 0)).length;

    const itens = [
      'Lançar ou importar os extratos e faturas de <b>' + rotuloMes_(mesAnt) + '</b> (hoje há ' + lancAnt + ' lançamentos nesse mês).',
      pendentes ? 'Revisar e aprovar <b>' + pendentes + '</b> lançamento(s) na aba Import_Staging.' : null,
      'Atualizar o saldo da reserva e o aporte do mês em <i>Investimentos > Aporte mensal e reserva</i>.',
      'Atualizar o valor das posições em <i>Investimentos > Posição de investimento</i>.',
      semMeta ? semMeta + ' categoria(s) de gasto ainda sem meta mensal.' : null
    ].filter(Boolean);

    let html = '<p>Hora de fechar o mês. Checklist:</p><ol>' + itens.map(i => '<li>' + i + '</li>').join('') + '</ol>';
    if (fixos.length) {
      html += '<p><b>Fixos previstos para este mês:</b></p><ul>' +
        fixos.map(f => '<li>' + f['Descrição'] + ': ' + moeda_(f['Valor']) + (f['Dia'] ? ' (dia ' + f['Dia'] + ')' : '') + '</li>').join('') + '</ul>';
    }
    html += '<p><a href="' + url + '" style="background:#1a73e8;color:#fff;padding:10px 16px;border-radius:4px;text-decoration:none">Abrir a planilha</a></p>';

    MailApp.sendEmail({ to: emailDestino_(), subject: 'Lembrete: fechar ' + rotuloMes_(mesAnt), htmlBody: estiloEmail_('Fechamento de ' + rotuloMes_(mesAnt), html) });
    log_('email', 'lembrete|' + mesAnt, 'enviado');
  } catch (e) {
    log_('erro', 'lembreteMensal', e.stack || e);
  }
}

/** Rotina diária: um e-mail com as categorias que cruzaram 80% ou 100% da meta (sem repetir). */
function alertasOrcamento() {
  const ym = competencia_(hoje_());
  const real = realizadoDoMes_(ym);
  const amarelo = n0_(cfg_('alerta_amarelo', 0.8)), vermelho = n0_(cfg_('alerta_vermelho', 1));
  const novos = [];
  lerTabela_(ABAS.CATEGORIAS).filter(c => c['Tipo'] === 'Saída').forEach(c => {
    const meta = n0_(c['Meta mensal (R$)']);
    const r = real[c['Categoria']] || 0;
    const nivel = nivelAlerta_(r, meta, amarelo, vermelho);
    if (!nivel) return;
    const chave = c['Categoria'] + '|' + ym + '|' + nivel;
    if (jaLogado_('alerta_orcamento', chave)) return;
    novos.push({ c: c, r: r, meta: meta, nivel: nivel, chave: chave });
  });
  if (!novos.length) return;

  const cor = { amarelo: '#b06000', vermelho: '#c5221f' };
  const html = '<p>Categorias que mudaram de nível hoje em ' + rotuloMes_(ym) + ':</p><table cellpadding="6" style="border-collapse:collapse">' +
    '<tr style="background:#f1f3f4"><th align="left">Categoria</th><th align="left">Centro</th><th align="right">Gasto</th><th align="right">Meta</th><th align="right">Uso</th></tr>' +
    novos.map(a => '<tr><td>' + a.c['Categoria'] + '</td><td>' + a.c['Centro de custo'] + '</td><td align="right">' + moeda_(a.r) +
      '</td><td align="right">' + moeda_(a.meta) + '</td><td align="right" style="color:' + cor[a.nivel] + ';font-weight:bold">' +
      Math.round(a.r / a.meta * 100) + '%</td></tr>').join('') + '</table>' +
    '<p>' + (novos.some(a => a.nivel === 'vermelho') ? 'Meta estourada: segure os gastos nessa categoria até o fim do mês.' :
      'Atenção: mais de 80% da meta já foi usada.') + '</p>';

  MailApp.sendEmail({ to: emailDestino_(), subject: 'Alerta de orçamento: ' + novos.map(a => a.c['Categoria']).join(', '),
    htmlBody: estiloEmail_('Alerta de orçamento', html) });
  novos.forEach(a => log_('alerta_orcamento', a.chave, moeda_(a.r) + ' de ' + moeda_(a.meta)));
}

/**
 * Gatilho de hora em hora: envia o que o Claude deixou na aba Relatorios com Status = "pronto".
 * O Claude nunca envia e-mail direto: ele escreve aqui e este carteiro entrega.
 */
function enviarRelatoriosPendentes() {
  try {
    const sh = aba_(ABAS.RELATORIOS);
    const cab = CABECALHOS[ABAS.RELATORIOS];
    lerTabela_(ABAS.RELATORIOS).filter(r => String(r['Status']).toLowerCase() === 'pronto').forEach(r => {
      MailApp.sendEmail({ to: emailDestino_(), subject: r['Assunto'] || ('Relatório: ' + r['Tipo']),
        htmlBody: estiloEmail_(r['Assunto'] || r['Tipo'], String(r['Corpo (HTML)'] || '')) });
      sh.getRange(r._linha, cab.indexOf('Status') + 1).setValue('enviado');
      sh.getRange(r._linha, cab.indexOf('Enviado em') + 1).setValue(new Date());
    });
  } catch (e) {
    log_('erro', 'enviarRelatoriosPendentes', e.stack || e);
  }
}

/** Para testar pelo editor: manda o lembrete agora. */
function testarEmail() { lembreteMensal(); }
