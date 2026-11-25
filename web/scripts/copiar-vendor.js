// Copia a biblioteca do Supabase para public/vendor, para o navegador não depender de CDN.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(raiz, 'public/vendor'), { recursive: true });
copyFileSync(join(raiz, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'), join(raiz, 'public/vendor/supabase.js'));
console.log('vendor/supabase.js copiado');
