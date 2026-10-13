const { pool, APP_TIMEZONE } = require('../database/db');

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
       -- "Hoje" no fuso local (CURRENT_DATE seria o dia em UTC, que vira ~20h no MS).
       AND (data_expiracao IS NULL OR data_expiracao >= (CURRENT_TIMESTAMP AT TIME ZONE $2)::date)
     ORDER BY data_publicacao DESC`,
    [turma, APP_TIMEZONE]
  );
  return rows;
}

async function listarPorProfessor(professorId) {
  const { rows } = await pool.query(
    `SELECT h.*, (SELECT COUNT(*)::int FROM resposta r WHERE r.historia_id = h.id AND r.status = 'ENVIADA') AS total_respostas
     FROM historia h WHERE h.professor_id = $1 ORDER BY h.data_publicacao DESC`,
    [professorId]
  );
  return rows;
}

// Quantas respostas (enviadas e rascunhos) e feedbacks estão ligados à história.
// Retorna null se a história não existir ou não pertencer ao professor.
async function contarVinculos(id, professorId) {
  const { rows } = await pool.query(
    `SELECT h.id, h.titulo,
            (SELECT COUNT(*)::int FROM resposta r WHERE r.historia_id = h.id AND r.status = 'ENVIADA') AS respostas_enviadas,
            (SELECT COUNT(*)::int FROM resposta r WHERE r.historia_id = h.id AND r.status = 'RASCUNHO') AS rascunhos,
            (SELECT COUNT(*)::int FROM comentario c JOIN resposta r ON r.id = c.resposta_id WHERE r.historia_id = h.id) AS comentarios
     FROM historia h
     WHERE h.id = $1 AND h.professor_id = $2`,
    [id, professorId]
  );
  return rows[0] || null;
}

// Exclui a história junto com tudo que depende dela (feedbacks e respostas),
// numa única transação: ou apaga tudo, ou não apaga nada.
// respostasConfirmadas = quantas respostas o professor viu no aviso; se houver mais
// agora (um aluno enviou depois), nada é apagado e retorna { conflito: true }.
async function excluir(id, professorId, respostasConfirmadas) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // FOR UPDATE trava a história: novas respostas para ela esperam esta transação terminar.
    const dono = await client.query(
      'SELECT id FROM historia WHERE id = $1 AND professor_id = $2 FOR UPDATE',
      [id, professorId]
    );
    if (!dono.rows.length) {
      await client.query('ROLLBACK');
      return null;
    }
    const total = await client.query('SELECT COUNT(*)::int AS n FROM resposta WHERE historia_id = $1', [id]);
    if (total.rows[0].n > respostasConfirmadas) {
      await client.query('ROLLBACK');
      return { conflito: true };
    }
    const comentarios = await client.query(
      'DELETE FROM comentario WHERE resposta_id IN (SELECT id FROM resposta WHERE historia_id = $1)',
      [id]
    );
    const respostas = await client.query('DELETE FROM resposta WHERE historia_id = $1', [id]);
    await client.query('DELETE FROM historia WHERE id = $1', [id]);
    await client.query('COMMIT');
    return { respostas: respostas.rowCount, comentarios: comentarios.rowCount };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
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

module.exports = {
  criar,
  listarAtivasParaTurma,
  listarTodas,
  listarPorProfessor,
  buscarPorId,
  contarVinculos,
  excluir,
};
