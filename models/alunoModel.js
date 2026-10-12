const { pool } = require('../database/db');

async function buscarPorNomeTurma(nome, turma) {
  const { rows } = await pool.query(
    'SELECT * FROM aluno WHERE nome = $1 AND turma = $2 LIMIT 1',
    [nome, turma]
  );
  return rows[0] || null;
}

async function loginOuCriar(nome, turma) {
  const existente = await buscarPorNomeTurma(nome, turma);

  if (existente) {
    await pool.query('UPDATE aluno SET ultimo_acesso = CURRENT_TIMESTAMP WHERE id = $1', [existente.id]);
    return { ...existente, novo: false };
  }

  const { rows } = await pool.query(
    'INSERT INTO aluno (nome, turma, ultimo_acesso) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING id',
    [nome, turma]
  );
  return { id: rows[0].id, nome, turma, novo: true };
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM aluno WHERE id = $1', [id]);
  return rows[0] || null;
}

module.exports = { buscarPorNomeTurma, loginOuCriar, buscarPorId };
