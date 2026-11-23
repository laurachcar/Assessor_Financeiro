/**
 * ASSESSOR FINANCEIRO — 04_Logica.gs
 * --------------------------------------------------------------
 * Regras de negócio PURAS: não leem nem escrevem planilha.
 * Por isso dá para testar fora do Google (ver test/logica.test.js).
 * Se mudar uma regra, mude aqui e rode os testes.
 */

/** Soma n meses a 'yyyy-MM'. */
function addMeses_(ym, n) {
  const p = ym.split('-').map(Number);
  const t = p[0] * 12 + (p[1] - 1) + n;
  return Math.floor(t / 12) + '-' + String((t % 12) + 1).padStart(2, '0');
}

/** Número do mês (1–12) de 'yyyy-MM'. */
function mesDe_(ym) { return Number(ym.split('-')[1]); }

/** Diferença em meses entre dois 'yyyy-MM' (b - a). */
function difMeses_(a, b) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return (pb[0] * 12 + pb[1]) - (pa[0] * 12 + pa[1]);
}

/**
 * Divide o aporte mensal entre a reserva e as metas.
 * - Reserva abaixo da meta: recebe reservaPct do aporte (sem passar da meta).
 * - Reserva na meta: congela (0) e tudo vai para as metas.
 * - Metas recebem o restante proporcional ao % de cada uma (normalizado se não somar 100%).
 * @param {number} aporte
 * @param {{saldo:number, meta:number, pct:number}} reserva
 * @param {{nome:string, pct:number}[]} metas  metas ativas, sem a reserva
 * @return {{reserva:number, congelada:boolean, metas:{nome:string, valor:number}[], semDestino:number, somaPct:number}}
 */
function alocarAporte_(aporte, reserva, metas) {
  const congelada = reserva.saldo >= reserva.meta;
  const falta = Math.max(0, reserva.meta - reserva.saldo);
  const paraReserva = congelada ? 0 : Math.min(aporte * reserva.pct, falta);
  const restante = aporte - paraReserva;
  const somaPct = metas.reduce((s, m) => s + (m.pct || 0), 0);
  const out = metas.map(m => ({ nome: m.nome, valor: somaPct > 0 ? restante * (m.pct || 0) / somaPct : 0 }));
  return {
    reserva: arred_(paraReserva),
    congelada: congelada,
    metas: out.map(m => ({ nome: m.nome, valor: arred_(m.valor) })),
    semDestino: somaPct > 0 ? 0 : arred_(restante),
    somaPct: somaPct
  };
}

function arred_(v) { return Math.round(v * 100) / 100; }

/**
 * Escolhe o cartão: maior retorno; empate → o que fecha primeiro depois de hoje.
 * @param {{apelido:string, fechamento:number, retorno:number}[]} cartoes  só ativos
 * @param {number} diaHoje
 */
function escolherCartao_(cartoes, diaHoje) {
  if (!cartoes.length) return null;
  const distancia = c => ((c.fechamento - diaHoje) + 31) % 31;
  const ord = cartoes.slice().sort((a, b) => (b.retorno - a.retorno) || (distancia(a) - distancia(b)));
  const c = ord[0];
  return { apelido: c.apelido, retorno: c.retorno, comprarApos: (c.fechamento % 31) + 1 };
}

/**
 * Calendário de compras.
 * Regras (ver especificação):
 *  1. Soma das parcelas do mês <= teto (compra à vista não conta no teto).
 *  2. Sobra do mês depois da parcela >= 0 em todos os meses cobertos.
 *  3. Prioridade: Alta = 1º mês viável; Média = maior sobra, ou mês sazonal se vier dentro da janela;
 *     Baixa = preço-alvo atingido → 1º viável; senão próximo mês sazonal viável.
 *  4. Menor número de parcelas que cabe.
 *  5. Itens processados por prioridade; cada compra escolhida ocupa a sobra/teto dos meses seguintes.
 *
 * @param {{produto:string, preco:number, precoAlvo:number, maxParcelas:number, prioridade:string, prazo:string|null}[]} itens
 * @param {{mes:string, sobra:number, parcelas:number}[]} meses  horizonte (ex.: 12 meses a partir do atual)
 * @param {{teto:number, mesesSazonais:number[], janelaSazonal:number}} opts
 * @return {{produto, mes, parcelas, valorParcela, status, motivo}[]} na ordem original dos itens
 */
function calendarioCompras_(itens, meses, opts) {
  const base = meses.map(m => ({ mes: m.mes, sobra: m.sobra, parcelas: m.parcelas }));
  const peso = { 'Alta': 0, 'Média': 1, 'Baixa': 2 };
  const ordem = itens.map((it, i) => ({ it: it, i: i }))
    .sort((a, b) => {
      const pa = a.it.prazo || '9999-99', pb = b.it.prazo || '9999-99';
      return (peso[a.it.prioridade] - peso[b.it.prioridade]) || (pa < pb ? -1 : pa > pb ? 1 : 0) || (a.i - b.i);
    });
  const resultado = new Array(itens.length);

  ordem.forEach(({ it, i }) => {
    const P = it.preco;
    const maxN = Math.max(1, it.maxParcelas || 1);
    const limite = it.prazo ? base.findIndex(m => m.mes === it.prazo) : base.length - 1;
    const ultimo = limite < 0 ? (it.prazo < base[0].mes ? -1 : base.length - 1) : limite;

    // Para cada mês inicial, o menor n viável
    const viaveis = [];
    for (let s = 0; s <= ultimo; s++) {
      for (let n = 1; n <= maxN; n++) {
        if (cabe_(base, s, n, P, opts.teto)) { viaveis.push({ s: s, n: n, parcela: P / n }); break; }
      }
    }

    if (!viaveis.length) {
      resultado[i] = { produto: it.produto, mes: '', parcelas: '', valorParcela: '', status: 'Fora do orçamento',
        motivo: 'Não cabe em nenhum mês do horizonte sem estourar a sobra ou o teto de parcelas.' };
      return;
    }

    const sazonal = v => opts.mesesSazonais.indexOf(mesDe_(base[v.s].mes)) >= 0;
    const sobraApos = v => base[v.s].sobra - v.parcela;
    let escolha, motivo;

    if (it.prioridade === 'Alta') {
      escolha = viaveis[0]; motivo = 'Prioridade alta: primeiro mês que cabe.';
    } else if (it.prioridade === 'Média') {
      const saz = viaveis.find(v => sazonal(v) && v.s <= opts.janelaSazonal);
      if (saz) { escolha = saz; motivo = 'Prioridade média: data de promoção dentro da janela.'; }
      else {
        escolha = viaveis.reduce((a, b) => (sobraApos(b) > sobraApos(a) ? b : a));
        motivo = 'Prioridade média: mês com maior sobra.';
      }
    } else {
      if (it.precoAlvo && P <= it.precoAlvo) { escolha = viaveis[0]; motivo = 'Prioridade baixa, mas o preço-alvo foi atingido.'; }
      else {
        const saz = viaveis.find(sazonal);
        if (saz) { escolha = saz; motivo = 'Prioridade baixa: esperar a próxima data de promoção.'; }
        else { escolha = viaveis.reduce((a, b) => (sobraApos(b) > sobraApos(a) ? b : a)); motivo = 'Prioridade baixa: sem promoção viável; mês com maior sobra.'; }
      }
    }

    ocupar_(base, escolha.s, escolha.n, P);
    resultado[i] = {
      produto: it.produto, mes: base[escolha.s].mes, parcelas: escolha.n, valorParcela: arred_(P / escolha.n),
      status: 'Planejado', motivo: motivo
    };
  });
  return resultado;
}

/** A compra de preço P em n parcelas, começando no mês s, cabe? */
function cabe_(base, s, n, P, teto) {
  const parcela = P / n;
  for (let k = 0; k < n; k++) {
    const m = base[s + k];
    if (!m) break; // além do horizonte não há dado para checar
    if (m.sobra - parcela < -0.005) return false;
    if (n > 1 && m.parcelas + parcela > teto + 0.005) return false;
  }
  return true;
}

function ocupar_(base, s, n, P) {
  const parcela = P / n;
  for (let k = 0; k < n; k++) {
    const m = base[s + k];
    if (!m) break;
    m.sobra -= parcela;
    if (n > 1) m.parcelas += parcela;
  }
}

/** ROI mensal e payback (meses) de um projeto no cenário base. */
function avaliarProjeto_(investimento, custoMensal, receitaBase) {
  const lucro = (receitaBase || 0) - (custoMensal || 0);
  return {
    roiMensal: investimento > 0 ? lucro / investimento : 0,
    payback: lucro > 0 ? Math.ceil(investimento / lucro) : null
  };
}

/** Nível de alerta de uma categoria: '', 'amarelo' ou 'vermelho'. */
function nivelAlerta_(realizado, meta, amarelo, vermelho) {
  if (!(meta > 0)) return '';
  const r = realizado / meta;
  if (r >= vermelho) return 'vermelho';
  if (r >= amarelo) return 'amarelo';
  return '';
}

/** Expande um parcelamento n/N lançado na competência c em parcelas futuras: [{mes, valor}]. */
function parcelasFuturas_(competencia, parcela, valor) {
  const m = String(parcela || '').match(/^(\d+)\/(\d+)$/);
  if (!m) return [];
  const atual = Number(m[1]), total = Number(m[2]);
  const out = [];
  for (let k = 1; k <= total - atual; k++) out.push({ mes: addMeses_(competencia, k), valor: valor });
  return out;
}
