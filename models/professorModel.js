const { pool } = require('../database/db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

async function buscarPorEmail(email) {
  const { rows } = await pool.query(
    'SELECT * FROM professor WHERE email = $1 AND ativo = TRUE LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM professor WHERE id = $1', [id]);
  return rows[0] || null;
}

async function criar(nome, email, senhaPlana) {
  if (senhaPlana) {
    const senha_hash = await bcrypt.hash(senhaPlana, SALT_ROUNDS);
    const { rows } = await pool.query(
      'INSERT INTO professor (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id',
      [nome, email, senha_hash]
    );
    return { id: rows[0].id, nome, email };
  }

  const { rows } = await pool.query(
    'INSERT INTO professor (nome, email) VALUES ($1, $2) RETURNING id',
    [nome, email]
  );
  return { id: rows[0].id, nome, email };
}

async function verificarSenha(senhaPlana, senhaHash) {
  return bcrypt.compare(senhaPlana, senhaHash);
}

module.exports = { buscarPorEmail, buscarPorId, criar, verificarSenha };
