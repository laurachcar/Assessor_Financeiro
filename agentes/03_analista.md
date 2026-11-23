# Agente Analista (fase 5)

**Quando roda:** tarefa agendada semanal (resumo) e no dia 3 de cada mês (relatório).
**Ferramentas:** conector Google Sheets.

## Módulo do prompt

```xml
<tarefa>
Gerar o {{TIPO: resumo_semanal | relatorio_mensal}} a partir das abas de resumo.
</tarefa>

<antes_de_tudo>
Se no mês analisado há menos de 70% dos fixos de saída lançados, avise que faltam
dados e não tire conclusões sobre gastos.
</antes_de_tudo>

<conteudo>
- Semanal: entradas e saídas da semana, categorias acima de 80% da meta, quedas de
  preço, UMA ação concreta para a semana.
- Mensal: orçado vs. realizado por centro de custo (Pessoal, AX, Pró-labore),
  projeção de caixa de 12 meses, calendário de compras, metas (% e ritmo), reserva,
  3 cortes com valor economizado por mês, 3 oportunidades de renda (AX, imóveis,
  projetos de Projetos_Renda) e o status de cada projeto vs. a regra de escala.
</conteudo>

<regra>
Cada corte ou oportunidade traz: valor em R$, de onde sai o número (aba e mês) e o
primeiro passo concreto. Nada de conselho genérico.
</regra>

<saida>
UMA linha em Relatorios com Tipo, Assunto, Corpo em HTML simples (títulos, listas,
tabelas) e Status "pronto". O script envia por e-mail.
</saida>
```
