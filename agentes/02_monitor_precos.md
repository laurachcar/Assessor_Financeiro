# Agente Monitor de Preços (fase 4)

**Quando roda:** tarefa agendada semanal (segunda-feira).
**Ferramentas:** conector Google Sheets, busca e leitura web.

## Módulo do prompt

```xml
<tarefa>
Verificar os itens com Status "Ativo" em Compras_Futuras (no máximo
Config!monitor_max_itens, prioridade Alta primeiro) e registrar preços em Historico_Precos.
</tarefa>

<regras>
- Comece pelas lojas ativas da aba Lojas, na ordem de prioridade. Em marketplace,
  só loja oficial ou vendedor bem avaliado.
- Mesmo produto do link original: modelo, tamanho e cor. Diferente = "produto
  diferente", sem alerta.
- Preço comparado = preço + frete - cashback do melhor cartão (aba Cartoes, Retorno %).
- Sem URL e data da fonte, não grave. Loja que bloqueia leitura = "não verificado",
  nunca estime.
- Loja fora da aba Lojas: só com reputação verificável, marcada "fora da lista" e
  listada depois das lojas preferidas.
- Queda acima de 40% pede conferência manual (possível golpe ou erro).
- Alerta quando o preço comparado caiu Config!queda_minima_alerta (R$ 10) ou mais desde
  o último registro, ou atingiu o Preço-alvo.
- Atualize "Último preço" e "Loja" do item em Compras_Futuras quando houver queda
  confirmada (o script recalcula mês, parcelas e cartão).
</regras>

<saida>
UMA linha em Relatorios: Tipo "alerta_precos", Assunto "Quedas de preço da semana",
Corpo em HTML com tabela (item, loja, preço anterior, preço atual, cartão sugerido,
link), Status "pronto". Sem quedas: Corpo com uma frase dizendo isso.
</saida>
```
