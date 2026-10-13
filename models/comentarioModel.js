const { pool } = require('../database/db');
const { paraDecimal } = require('../utils/parse');

const CRITERIOS_VALIDOS = ['excelente', 'adequado', 'regular', 'insuficiente'];

function erro400(mensagem) {
  const erro = new Error(mensagem);
  erro.status = 400;
  return erro;
}

// Converte e valida os campos de avaliação vindos do formulário de feedback.
function mapearAvaliacao(body) {
  const nota_final = paraDecimal(body.nota_final);
  if (nota_final !== null && (nota_final < 0 || nota_final > 10 || (nota_final * 2) % 1 !== 0)) {
    throw erro400('A nota final deve estar entre 0 e 10, em passos de 0,5.');
  }

  const criterio = (nome) => {
    const valor = String(body[nome] || '').trim().toLowerCase();
    if (!valor) return null;
    if (!CRITERIOS_VALIDOS.includes(valor)) throw erro400(`Valor inválido para a competência "${nome}".`);
    return valor;
  };

  return {
    nota_final,
    criterio_triagem: criterio('criterio_triagem'),
    criterio_diagnostico: criterio('criterio_diagnostico'),
    criterio_conduta: criterio('criterio_conduta'),
    // Checkbox desmarcado não é enviado pelo navegador.
    notificar_aluno: Boolean(body.notificar_aluno),
    liberar_revisao: Boolean(body.liberar_revisao),
  };
}

async function criar({ resposta_id, professor_id, texto, avaliacao = {} }) {
  const a = { ...mapearAvaliacao({}), ...avaliacao };
  const { rows } = await pool.query(
    `INSERT INTO comentario (resposta_id, professor_id, texto, nota_final,
       criterio_triagem, criterio_diagnostico, criterio_conduta, notificar_aluno, liberar_revisao)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [resposta_id, professor_id, texto, a.nota_final,
      a.criterio_triagem, a.criterio_diagnostico, a.criterio_conduta, a.notificar_aluno, a.liberar_revisao]
  );
  return { id: rows[0].id };
}

// Cada professor tem um feedback por resposta: se já existir, atualiza texto e avaliação;
// senão, cria. (Se houver duplicados antigos, atualiza o mais recente.)
async function salvar({ resposta_id, professor_id, texto, body = {} }) {
  const a = mapearAvaliacao(body);
  const { rows } = await pool.query(
    `UPDATE comentario SET
       texto = $3, nota_final = $4,
       criterio_triagem = $5, criterio_diagnostico = $6, criterio_conduta = $7,
       notificar_aluno = $8, liberar_revisao = $9,
       atualizado_em = CURRENT_TIMESTAMP
     WHERE id = (
       SELECT id FROM comentario
       WHERE resposta_id = $1 AND professor_id = $2
       ORDER BY criado_em DESC, id DESC
       LIMIT 1
     )
     RETURNING id`,
    [resposta_id, professor_id, texto, a.nota_final,
      a.criterio_triagem, a.criterio_diagnostico, a.criterio_conduta, a.notificar_aluno, a.liberar_revisao]
  );
  if (rows.length) return { id: rows[0].id, atualizado: true };
  const criado = await criar({ resposta_id, professor_id, texto, avaliacao: a });
  return { ...criado, atualizado: false };
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

module.exports = { criar, salvar, listarPorResposta };
