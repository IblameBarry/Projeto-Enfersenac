const { pool } = require('../database/db');

async function criar({ resposta_id, professor_id, texto }) {
  const { rows } = await pool.query(
    'INSERT INTO comentario (resposta_id, professor_id, texto) VALUES ($1, $2, $3) RETURNING id',
    [resposta_id, professor_id, texto]
  );
  return { id: rows[0].id };
}

async function listarPorResposta(resposta_id) {
  const { rows } = await pool.query(
    `SELECT c.*, p.nome AS professor_nome
     FROM comentario c
     JOIN professor p ON p.id = c.professor_id
     WHERE c.resposta_id = $1
     ORDER BY c.criado_em ASC`,
    [resposta_id]
  );
  return rows;
}

module.exports = { criar, listarPorResposta };
