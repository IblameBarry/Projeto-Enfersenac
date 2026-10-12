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
types.setTypeParser(1114, (value) => value);
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

module.exports = { pool, testConnection };
