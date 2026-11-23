/**
 * 02_Logica — regras de negócio puras (sem acesso à planilha).
 * Tudo aqui é testado por test/logica.test.js.
 */

const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const PESO_PRIORIDADE = { 'Alta': 1, 'Média': 2, 'Baixa': 3 };

// ---------------------------------------------------------------- datas e meses

function pad2(n) { return (n < 10 ? '0' : '') + n; }

/** Date -> "AAAA-MM". */
function mesChave(data) { return data.getFullYear() + '-' + pad2(data.getMonth() + 1); }

/** "AAAA-MM-DD" para uso em chaves. */
function diaChave(data) { return mesChave(data) + '-' + pad2(data.getDate()); }

/** Lê um mês vindo da planilha (texto "AAAA-MM" ou Date) e devolve "AAAA-MM" ou ''. */
function mesDe(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  if (valor instanceof Date || (typeof valor === 'object' && typeof valor.getFullYear === 'function')) return mesChave(valor);
  const s = String(valor).trim().replace(/^'/, '');
  let m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m) return m[1] + '-' + pad2(Number(m[2]));
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return m[2] + '-' + pad2(Number(m[1]));
  return '';
}

function somarMeses(chave, n) {
  const p = chave.split('-');
  const total = Number(p[0]) * 12 + (Number(p[1]) - 1) + n;
  return Math.floor(total / 12) + '-' + pad2((total % 12) + 1);
}

function difMeses(de, ate) {
  const a = de.split('-'), b = ate.split('-');
  return (Number(b[0]) * 12 + Number(b[1])) - (Number(a[0]) * 12 + Number(a[1]));
}

function proximosMeses(inicio, n) {
  const r = [];
  for (let i = 0; i < n; i++) r.push(somarMeses(inicio, i));
  return r;
}

function diasNoMes(ano, mes1a12) { return new Date(ano, mes1a12, 0).getDate(); }

function rotuloMes(chave) {
  const p = chave.split('-');
  return NOMES_MESES[Number(p[1]) - 1] + '/' + p[0];
}

// ---------------------------------------------------------------- textos e números

function normalizarTexto(s) {
  return String(s === null || s === undefined ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Recusa qualquer sequência de 12 dígitos ou mais (mesmo com espaços, pontos, traços ou barras). */
function contemNumeroSensivel(texto) {
  if (texto === null || texto === undefined) return false;
  const juntos = String(texto).replace(/(\d)[\s.\-\/]+(?=\d)/g, '$1');
  return /\d{12,}/.test(juntos);
}

/** Aceita 1234.56, "1.234,56", "1234,56", "R$ 1.234,56". Devolve NaN se não for número. */
function parseValorBR(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined) return NaN;
  let s = String(v).replace(/R\$/i, '').replace(/\s/g, '');
  if (s === '') return NaN;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

/** Aceita Date, "AAAA-MM-DD" ou "DD/MM/AAAA". Devolve Date (meia-noite local) ou null. */
function parseData(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
  if (v && typeof v === 'object' && typeof v.getFullYear === 'function') return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let a, me, d;
  if (m) { a = +m[1]; me = +m[2]; d = +m[3]; }
  else {
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    a = +m[3]; me = +m[2]; d = +m[1];
  }
  const data = new Date(a, me - 1, d);
  if (data.getFullYear() !== a || data.getMonth() !== me - 1 || data.getDate() !== d) return null;
  return data;
}

function arred2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function ehSim(v) { return v === true || normalizarTexto(v) === 'sim'; }

// ---------------------------------------------------------------- validação de formulários

/**
 * Valida e converte os dados de um formulário.
 * @param campos definição dos campos (FORMULARIOS[x].campos)
 * @param dados objeto { nomeDoCampo: valorDigitado }
 * @param opcoesDinamicas { fonte: [valores aceitos] }
 * @return { ok, erros: [texto], valores: { campo: valorConvertido } }
 */
function validarCampos(campos, dados, opcoesDinamicas) {
  const erros = [], valores = {};
  opcoesDinamicas = opcoesDinamicas || {};
  campos.forEach(function (c) {
    const rotulo = c.rotulo || c.nome;
    let bruto = dados[c.nome];
    if (bruto === undefined || bruto === null) bruto = '';
    if (typeof bruto === 'string') bruto = bruto.trim();
    if (bruto === '' && c.padrao !== undefined) bruto = c.padrao;

    if (typeof bruto === 'string' && contemNumeroSensivel(bruto)) {
      erros.push(rotulo + ': não digite número de cartão, conta ou documento (12 dígitos ou mais).');
      return;
    }
    if (bruto === '' || bruto === false && c.tipo !== 'simnao') {
      if (c.obrigatorio) erros.push(rotulo + ' é obrigatório.');
      valores[c.nome] = '';
      return;
    }

    let v = bruto;
    switch (c.tipo) {
      case 'texto':
        v = String(bruto);
        if (v.length > 200) erros.push(rotulo + ': máximo de 200 caracteres.');
        break;
      case 'email':
        v = String(bruto);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) erros.push(rotulo + ': e-mail inválido.');
        break;
      case 'moeda':
      case 'moeda_sinal':
        v = parseValorBR(bruto);
        if (isNaN(v)) { erros.push(rotulo + ': valor inválido.'); break; }
        v = arred2(v);
        if (c.tipo === 'moeda' && v < 0) erros.push(rotulo + ' não pode ser negativo.');
        if (c.positivo && v <= 0) erros.push(rotulo + ' deve ser maior que zero.');
        break;
      case 'percentual':
        v = parseValorBR(bruto);
        if (isNaN(v) || v < 0 || v > 100) erros.push(rotulo + ': informe um número entre 0 e 100.');
        break;
      case 'inteiro':
      case 'dia':
        v = Number(String(bruto).replace(',', '.'));
        const min = c.tipo === 'dia' ? 1 : (c.min !== undefined ? c.min : -Infinity);
        const max = c.tipo === 'dia' ? 31 : (c.max !== undefined ? c.max : Infinity);
        if (!Number.isInteger(v) || v < min || v > max) erros.push(rotulo + ': informe um número inteiro entre ' + min + ' e ' + max + '.');
        break;
      case 'data':
        v = parseData(bruto);
        if (!v) erros.push(rotulo + ': data inválida.');
        break;
      case 'mes':
        v = mesDe(bruto);
        if (!v) erros.push(rotulo + ': mês inválido (use AAAA-MM).');
        break;
      case 'simnao':
        v = ehSim(bruto) ? 'Sim' : 'Não';
        break;
      case 'lista': {
        const aceitas = c.opcoes || opcoesDinamicas[c.fonte] || [];
        v = String(bruto);
        if (aceitas.indexOf(v) < 0) erros.push(rotulo + ': escolha uma opção da lista.');
        break;
      }
    }
    valores[c.nome] = v;
  });
  return { ok: erros.length === 0, erros: erros, valores: valores };
}

/** Pagamento de fatura lançado como Saída conta o gasto em dobro. */
function erroRegraFatura(descricao, tipo) {
  if (tipo !== 'Saída') return '';
  const d = normalizarTexto(descricao);
  if (/\bfatura\b/.test(d) || /pagamento (do |de )?cartao/.test(d)) {
    return 'Pagamento de fatura é Transferência, não Saída. As compras do cartão já entram como gasto, uma por uma.';
  }
  return '';
}

// ---------------------------------------------------------------- cartão e parcelas

/**
 * Mês em que a compra sai do caixa (vencimento da fatura).
 * Compra antes do fechamento entra na fatura que fecha no mesmo mês;
 * no dia do fechamento ou depois, na do mês seguinte.
 */
function mesFaturaCartao(data, cartao) {
  const fech = Number(cartao['Dia fechamento']);
  const venc = Number(cartao['Dia vencimento']);
  let mesFech = mesChave(data);
  if (data.getDate() >= fech) mesFech = somarMeses(mesFech, 1);
  return venc > fech ? mesFech : somarMeses(mesFech, 1);
}

/**
 * Gera as linhas de um lançamento. Compra parcelada no cartão vira uma linha por parcela,
 * cada uma no mês seguinte, e o centavo que sobra vai na primeira.
 */
function gerarLancamentos(valores, cartao, idBase) {
  const n = cartao ? Math.max(1, Number(valores['Parcelas']) || 1) : 1;
  const total = arred2(valores['Valor']);
  const parcela = Math.floor(total / n * 100) / 100;
  const primeira = arred2(total - parcela * (n - 1));
  const linhas = [];
  for (let i = 0; i < n; i++) {
    const data = new Date(valores['Data'].getFullYear(), valores['Data'].getMonth() + i,
      Math.min(valores['Data'].getDate(), diasNoMes(valores['Data'].getFullYear() + Math.floor((valores['Data'].getMonth() + i) / 12), ((valores['Data'].getMonth() + i) % 12) + 1)));
    linhas.push({
      'ID': idBase + (n > 1 ? '-' + (i + 1) : ''),
      'Data': data,
      'Descrição': valores['Descrição'],
      'Valor': i === 0 ? primeira : parcela,
      'Tipo': valores['Tipo'],
      'Categoria': valores['Categoria'] || '',
      'Centro de custo': valores['Centro de custo'] || '',
      'Conta/Cartão': valores['Conta/Cartão'],
      'Parcela': n > 1 ? (i + 1) + ' de ' + n : '',
      'Mês fatura': cartao ? somarMeses(mesFaturaCartao(valores['Data'], cartao), i) : ''
    });
  }
  return linhas;
}

/**
 * Melhor dia para comprar em cada cartão no mês dado: o dia seguinte ao fechamento.
 * Escolhe o cartão que dá mais dias até o pagamento.
 */
function melhorCartao(cartoes, chaveMes) {
  let melhor = null;
  const p = chaveMes.split('-');
  const ano = Number(p[0]), mes = Number(p[1]);
  cartoes.forEach(function (c) {
    const fech = Number(c['Dia fechamento']), venc = Number(c['Dia vencimento']);
    if (!fech || !venc) return;
    const dia = Math.min(fech + 1, diasNoMes(ano, mes));
    const compra = new Date(ano, mes - 1, dia);
    const mesVenc = mesFaturaCartao(compra, c);
    const pv = mesVenc.split('-');
    const vencimento = new Date(Number(pv[0]), Number(pv[1]) - 1, Math.min(venc, diasNoMes(Number(pv[0]), Number(pv[1]))));
    const dias = Math.round((vencimento - compra) / 86400000);
    if (!melhor || dias > melhor.dias) melhor = { cartao: c['Cartão'], dia: dia, dias: dias, vencimento: vencimento };
  });
  return melhor;
}

// ---------------------------------------------------------------- reserva e aporte

/**
 * Reserva recebe pct% do aporte até chegar à meta. Ao atingir, congela e
 * tudo vai para as metas, na proporção do "% do aporte" de cada uma.
 */
function distribuirAporte(aporte, reservaAntes, metaReserva, pctReserva, metas) {
  aporte = arred2(aporte); reservaAntes = arred2(reservaAntes);
  const falta = Math.max(0, arred2(metaReserva - reservaAntes));
  const paraReserva = arred2(Math.min(aporte * pctReserva / 100, falta));
  const paraMetas = arred2(aporte - paraReserva);
  const ativas = (metas || []).filter(function (m) { return ehSim(m['Ativa']) && Number(m['% do aporte']) > 0; });
  const soma = ativas.reduce(function (s, m) { return s + Number(m['% do aporte']); }, 0);
  const porMeta = [];
  let distribuido = 0;
  ativas.forEach(function (m, i) {
    let v = arred2(paraMetas * Number(m['% do aporte']) / soma);
    if (i === ativas.length - 1) v = arred2(paraMetas - distribuido);
    distribuido = arred2(distribuido + v);
    porMeta.push({ meta: m['Meta'], valor: v });
  });
  return {
    paraReserva: paraReserva,
    reservaDepois: arred2(reservaAntes + paraReserva),
    paraMetas: paraMetas,
    congelada: falta === 0,
    porMeta: porMeta,
    somaPercentuais: soma
  };
}

function somaPercentuaisMetas(metas) {
  return arred2(metas.filter(function (m) { return ehSim(m['Ativa']); })
    .reduce(function (s, m) { return s + (Number(m['% do aporte']) || 0); }, 0));
}

// ---------------------------------------------------------------- orçado x realizado

/** Soma das Saídas por categoria e mês (1..12) de um ano, com filtro opcional de centro de custo. */
function realizadoPorCategoria(lancamentos, ano, centro) {
  const r = {};
  lancamentos.forEach(function (l) {
    if (l['Tipo'] !== 'Saída') return;
    const d = parseData(l['Data']);
    if (!d || d.getFullYear() !== Number(ano)) return;
    if (centro && centro !== 'Todos' && l['Centro de custo'] !== centro) return;
    const cat = l['Categoria'] || '(sem categoria)';
    if (!r[cat]) r[cat] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    r[cat][d.getMonth()] = arred2(r[cat][d.getMonth()] + Number(l['Valor']));
  });
  return r;
}

/**
 * Linhas da aba Orcado_Realizado.
 * mesesDecorridos: quantos meses do ano entram na meta acumulada (12 para anos passados).
 */
function montarOrcadoRealizado(categorias, lancamentos, ano, centro, mesesDecorridos) {
  const atual = realizadoPorCategoria(lancamentos, ano, centro);
  const anterior = realizadoPorCategoria(lancamentos, Number(ano) - 1, centro);
  const linhas = [];
  const nomes = categorias
    .filter(function (c) { return c['Tipo'] !== 'Entrada' && (ehSim(c['Ativa']) || atual[c['Categoria']]); })
    .filter(function (c) { return !centro || centro === 'Todos' || !c['Centro de custo'] || c['Centro de custo'] === centro || atual[c['Categoria']]; })
    .map(function (c) { return c['Categoria']; });
  Object.keys(atual).forEach(function (k) { if (nomes.indexOf(k) < 0) nomes.push(k); });
  nomes.forEach(function (nome) {
    const cat = categorias.filter(function (c) { return c['Categoria'] === nome; })[0] || {};
    const meta = Number(cat['Meta mensal']) || 0;
    const meses = atual[nome] || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const total = arred2(meses.reduce(function (s, v) { return s + v; }, 0));
    const metaAcum = arred2(meta * mesesDecorridos);
    const totalAnt = arred2((anterior[nome] || []).reduce(function (s, v) { return s + v; }, 0));
    linhas.push({
      categoria: nome, metaMensal: meta, meses: meses, total: total,
      metaAcumulada: metaAcum,
      pctMeta: metaAcum > 0 ? total / metaAcum : (total > 0 ? null : 0),
      anoAnterior: totalAnt,
      variacao: totalAnt > 0 ? (total - totalAnt) / totalAnt : null
    });
  });
  return linhas;
}

/**
 * Alertas de orçamento de um mês. Cada nível (80%, 100%) é enviado uma vez por categoria e mês.
 * @param enviados conjunto de chaves "AAAA-MM|Categoria|nível"
 */
function calcularAlertas(realizadoMes, metasPorCategoria, enviados, mes, niveis) {
  const novos = [];
  Object.keys(metasPorCategoria).forEach(function (cat) {
    const meta = Number(metasPorCategoria[cat]) || 0;
    if (meta <= 0) return;
    const real = arred2(realizadoMes[cat] || 0);
    const pct = real / meta * 100;
    const atingidos = niveis.filter(function (n) { return pct >= n; });
    if (!atingidos.length) return;
    const maior = Math.max.apply(null, atingidos);
    if (enviados.has(mes + '|' + cat + '|' + maior)) return;
    novos.push({ mes: mes, categoria: cat, nivel: maior, realizado: real, meta: meta, cobre: atingidos });
  });
  return novos;
}

// ---------------------------------------------------------------- projeção de caixa

function fixoAtivoNoMes(fixo, mes) {
  if (!ehSim(fixo['Ativo'])) return false;
  const ini = mesDe(fixo['Início']), fim = mesDe(fixo['Fim']);
  if (ini && mes < ini) return false;
  if (fim && mes > fim) return false;
  return true;
}

/** Soma por mês das parcelas de cartão já lançadas (pelo mês da fatura). */
function faturasPorMes(lancamentos, nomesCartoes) {
  const r = {};
  lancamentos.forEach(function (l) {
    if (l['Tipo'] !== 'Saída' || nomesCartoes.indexOf(l['Conta/Cartão']) < 0) return;
    const m = mesDe(l['Mês fatura']);
    if (!m) return;
    r[m] = arred2((r[m] || 0) + Number(l['Valor']));
  });
  return r;
}

/** Soma por mês só das parcelas (compras parceladas), para o teto de parcelas. */
function parcelasPorMes(lancamentos, nomesCartoes) {
  return faturasPorMes(lancamentos.filter(function (l) { return !!l['Parcela']; }), nomesCartoes);
}

/**
 * Projeção de 12 meses.
 * Entradas: fixos de Entrada. Saídas: fixos de Saída que não estão no cartão,
 * faturas de cartão (compras já lançadas + fixos no cartão), compras planejadas e aporte.
 */
function projetarCaixa(p) {
  const nomesCartoes = p.nomesCartoes || [];
  const faturas = p.faturas || {};
  const compras = p.compras || {};
  let saldo = arred2(p.saldoInicial);
  return proximosMeses(p.mesInicial, p.meses || 12).map(function (mes) {
    let entradas = 0, fixas = 0, cartaoFixos = 0;
    (p.fixos || []).forEach(function (f) {
      if (!fixoAtivoNoMes(f, mes)) return;
      const v = Number(f['Valor']) || 0;
      if (f['Tipo'] === 'Entrada') entradas += v;
      else if (nomesCartoes.indexOf(f['Conta/Cartão']) >= 0) cartaoFixos += v;
      else fixas += v;
    });
    const fatura = arred2((faturas[mes] || 0) + cartaoFixos);
    const compra = arred2(compras[mes] || 0);
    const aporte = arred2(p.aporte || 0);
    const inicial = saldo;
    saldo = arred2(saldo + entradas - fixas - fatura - compra - aporte);
    return {
      mes: mes, saldoInicial: inicial, entradas: arred2(entradas), saidasFixas: arred2(fixas),
      faturas: fatura, compras: compra, aporte: aporte, saldoFinal: saldo
    };
  });
}

// ---------------------------------------------------------------- calendário de compras

/**
 * Para cada compra planejada (por prioridade), procura o primeiro mês a partir do desejado em que:
 *  - a parcela somada às parcelas já existentes não passa do teto mensal de parcelas;
 *  - o saldo projetado não fica negativo em nenhum mês seguinte.
 * Prefere o menor número de parcelas possível.
 */
function planejarCompras(p) {
  const meses = p.projecao.map(function (r) { return r.mes; });
  const saldos = p.projecao.map(function (r) { return r.saldoFinal; });
  const carga = Object.assign({}, p.cargaParcelas || {});
  const teto = Number(p.teto) > 0 ? Number(p.teto) : Infinity;
  const maxGlobal = Math.max(1, Number(p.maxParcelas) || 1);
  const consumo = meses.map(function () { return 0; });
  const porMes = {};
  const compras = (p.compras || []).filter(function (c) { return (c['Status'] || 'Planejada') === 'Planejada'; })
    .slice().sort(function (a, b) {
      return (PESO_PRIORIDADE[a['Prioridade']] || 9) - (PESO_PRIORIDADE[b['Prioridade']] || 9) ||
        String(mesDe(a['Mês desejado']) || '').localeCompare(String(mesDe(b['Mês desejado']) || '')) ||
        Number(a['Valor estimado']) - Number(b['Valor estimado']);
    });

  const resultado = compras.map(function (c) {
    const valor = arred2(c['Valor estimado']);
    const maxN = Math.min(maxGlobal, Number(c['Parcelas máx']) || maxGlobal);
    const desejado = mesDe(c['Mês desejado']);
    const inicio = Math.max(0, desejado ? difMeses(meses[0], desejado) : 0);
    for (let s = inicio; s < meses.length; s++) {
      for (let n = 1; n <= maxN; n++) {
        const parcela = arred2(valor / n);
        let ok = true;
        for (let i = 0; i < n && ok; i++) {
          const m = somarMeses(meses[s], i);
          if (n > 1 && (carga[m] || 0) + parcela > teto + 0.001) ok = false;
        }
        if (!ok) continue;
        // saldo: a partir de s, cada mês perde as parcelas já vencidas
        for (let j = s; j < meses.length && ok; j++) {
          const pagas = Math.min(n, j - s + 1);
          if (saldos[j] - consumo[j] - parcela * pagas < -0.001) ok = false;
        }
        if (!ok) continue;
        for (let i = 0; i < n; i++) {
          const m = somarMeses(meses[s], i);
          if (n > 1) carga[m] = arred2((carga[m] || 0) + parcela);
          porMes[m] = arred2((porMes[m] || 0) + parcela);
        }
        for (let j = s; j < meses.length; j++) consumo[j] = arred2(consumo[j] + parcela * Math.min(n, j - s + 1));
        const cartao = n > 1 || (p.cartoes || []).length ? melhorCartao(p.cartoes || [], meses[s]) : null;
        let motivo = s === inicio ? 'Cabe no mês desejado' : 'Adiado: caixa ou teto de parcelas não comportam antes';
        if (!desejado && s === 0) motivo = 'Cabe já';
        return {
          item: c['Item'], valor: valor, prioridade: c['Prioridade'], mes: meses[s], parcelas: n,
          valorParcela: parcela, cartao: cartao ? cartao.cartao : '', dia: cartao ? cartao.dia : '',
          diasAtePagar: cartao ? cartao.dias : '', motivo: motivo
        };
      }
    }
    return {
      item: c['Item'], valor: valor, prioridade: c['Prioridade'], mes: '', parcelas: '', valorParcela: '',
      cartao: '', dia: '', diasAtePagar: '', motivo: 'Não cabe nos próximos ' + meses.length + ' meses'
    };
  });
  return { itens: resultado, porMes: porMes };
}

// ---------------------------------------------------------------- importação

function chaveDuplicidade(l) {
  const d = parseData(l['Data']);
  return [d ? diaChave(d) : '', arred2(l['Valor']).toFixed(2), normalizarTexto(l['Descrição']), normalizarTexto(l['Conta/Cartão'])].join('|');
}

/**
 * Marca como Duplicado o que já existe em Lançamentos ou repete dentro da própria importação.
 * Devolve, na ordem, true (duplicado) ou false para cada linha pendente.
 */
function detectarDuplicados(pendentes, existentes) {
  const vistos = new Set(existentes.map(chaveDuplicidade));
  return pendentes.map(function (l) {
    const k = chaveDuplicidade(l);
    if (vistos.has(k)) return true;
    vistos.add(k);
    return false;
  });
}
