'use strict';

// Aplica, em ordem alfabética, os arquivos .sql de database/migrations.
// Todas as migrações são escritas para poder rodar várias vezes sem erro,
// então este script é chamado na inicialização do servidor e também pode
// ser executado manualmente com "npm run db:migrate".

const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('./db');

const PASTA = path.join(__dirname, 'migrations');

async function aplicarMigracoes() {
  const arquivos = fs.readdirSync(PASTA).filter((f) => f.endsWith('.sql')).sort();
  for (const arquivo of arquivos) {
    const sql = fs.readFileSync(path.join(PASTA, arquivo), 'utf8');
    await pool.query(sql);
    console.log('Migração aplicada:', arquivo);
  }
}

module.exports = { aplicarMigracoes };

if (require.main === module) {
  aplicarMigracoes()
    .catch((err) => {
      console.error('Erro ao aplicar migrações:', err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
