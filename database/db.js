'use strict';

const path = require('node:path');
const dotenv = require('dotenv');
const { Pool, types } = require('pg');

dotenv.config({
  path: path.resolve(__dirname, '..', '.env'),
  override: false,
});

types.setTypeParser(20, (value) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : value;
});
types.setTypeParser(1082, (value) => value);
// TIMESTAMP sem fuso: o banco grava em UTC (ver SET TIME ZONE abaixo). Devolve em ISO com "Z"
// ("2026-10-13T19:37:00Z") para o navegador converter para a hora local do usuário.
// Sem o "Z", o navegador lia o horário UTC como se fosse local e mostrava a hora adiantada.
types.setTypeParser(1114, (value) => (
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value) ? `${value.replace(' ', 'T')}Z` : value
));
types.setTypeParser(1184, (value) => value);

const connectionString = process.env.DATABASE_URL;
const useSsl = process.env.DB_SSL !== 'false';
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';

const poolConfig = {
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

if (connectionString) {
  poolConfig.connectionString = connectionString;
} else {
  poolConfig.host = process.env.DB_HOST || 'localhost';
  poolConfig.port = Number.parseInt(process.env.DB_PORT || '5432', 10);
  poolConfig.user = process.env.DB_USER || 'postgres';
  poolConfig.password = process.env.DB_PASSWORD || '';
  poolConfig.database = process.env.DB_NAME || 'postgres';
}

if (useSsl) {
  poolConfig.ssl = { rejectUnauthorized };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Erro inesperado na conexão PostgreSQL:', err.message);
});

// Garante que CURRENT_TIMESTAMP grave em UTC (padrão do Supabase), seja qual for o fuso do banco.
pool.on('connect', (client) => {
  client.query("SET TIME ZONE 'UTC'").catch((err) => {
    console.error('Não foi possível definir o fuso UTC na conexão:', err.message);
  });
});

// Fuso usado para saber "que dia é hoje" (ex.: prazo de expiração das histórias).
// Padrão: Mato Grosso do Sul. Pode ser trocado pela variável APP_TIMEZONE.
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Campo_Grande';

async function testConnection() {
  try {
    const { rows } = await pool.query(
      'SELECT current_database() AS database_name, current_user AS database_user'
    );
    console.log('Conectado ao PostgreSQL:', rows[0].database_name);
    return true;
  } catch (err) {
    console.error('Falha ao conectar no PostgreSQL:', err.message);
    return false;
  }
}

module.exports = { pool, testConnection, APP_TIMEZONE };
