// Gera o .clasp.json com o ID do script e a ORDEM de envio dos arquivos.
// A ordem importa: 01_Config define constantes que os outros arquivos usam ao carregar.
// Uso: node scripts/gerar-clasp.js <SCRIPT_ID>
const fs = require('fs');
const path = require('path');

const scriptId = (process.argv[2] || process.env.SCRIPT_ID || '').trim();
if (!/^[A-Za-z0-9_-]{20,}$/.test(scriptId)) {
  console.error('SCRIPT_ID ausente ou inválido. Pegue em Apps Script > Configurações do projeto > ID do script.');
  process.exit(1);
}

const src = path.join(__dirname, '..', 'src');
const ordem = fs.readdirSync(src).filter(f => f.endsWith('.gs')).sort().map(f => 'src/' + f);

fs.writeFileSync(path.join(__dirname, '..', '.clasp.json'), JSON.stringify({
  scriptId: scriptId,
  rootDir: 'src',
  filePushOrder: ordem
}, null, 2));
console.log('.clasp.json gerado. Ordem: ' + ordem.join(', '));
