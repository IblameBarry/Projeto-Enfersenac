const { pool } = require('../database/db');

function gerarCodigo() {
  const sufixo = Math.floor(1000 + Math.random() * 9000);
  return `NUR-${sufixo}`;
}

async function criar({ professor_id, titulo, enunciado, turma, data_expiracao }) {
  const codigo = gerarCodigo();
  const { rows } = await pool.query(
    `INSERT INTO historia (codigo, titulo, enunciado, origem, professor_id, turma, data_expiracao)
     VALUES ($1, $2, $3, 'PROFESSOR', $4, $5, $6)
     RETURNING id`,
    [codigo, titulo, enunciado, professor_id, turma || null, data_expiracao || null]
  );
  return { id: rows[0].id, codigo, titulo, enunciado };
}

async function listarAtivasParaTurma(turma) {
  const { rows } = await pool.query(
    `SELECT * FROM historia
     WHERE status = 'ATIVA'
       AND (turma IS NULL OR turma = $1)
       AND (data_expiracao IS NULL OR data_expiracao >= CURRENT_DATE)
     ORDER BY data_publicacao DESC`,
    [turma]
  );
  return rows;
}

async function listarTodas() {
  const { rows } = await pool.query(
    `SELECT h.*, p.nome AS professor_nome
     FROM historia h
     LEFT JOIN professor p ON p.id = h.professor_id
     ORDER BY h.data_publicacao DESC`
  );
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM historia WHERE id = $1', [id]);
  return rows[0] || null;
}

module.exports = { criar, listarAtivasParaTurma, listarTodas, buscarPorId };
