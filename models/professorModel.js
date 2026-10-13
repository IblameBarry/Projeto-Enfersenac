const { pool } = require('../database/db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

// Senha inicial de todo professor cadastrado pelo administrador.
const SENHA_PADRAO = 'Senac123';

// Conta administradora (pode cadastrar professores). Substitui a antiga conta de demonstração do Carlos.
const ADMIN = { nome: 'Nathan Fusinato Sacaramal', email: 'nathan.sacaramal@ms.senac.br' };
const EMAILS_DEMO_ANTIGOS = ['prof.carlos@ms.senac.br', 'prof.carlos@senac.br'];

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

// Lista para a tela de administração (sem o hash da senha).
async function listar() {
  const { rows } = await pool.query(
    'SELECT id, nome, email, admin, ativo, criado_em FROM professor ORDER BY admin DESC, ativo DESC, nome'
  );
  return rows;
}

// Garante que a conta administradora exista e esteja ativa. Roda na inicialização do servidor.
// - Se a conta do Nathan já existe: só confirma admin/ativo (a senha não é alterada).
// - Senão, se existe a conta de demonstração do Carlos: ela é convertida na conta do Nathan
//   (mesmo id, então as histórias e feedbacks já publicados continuam no painel).
// - Senão: cria a conta com a senha padrão.
// Em todos os casos a conta do Carlos deixa de entrar (fica inativa, preservando o histórico).
async function garantirAdministrador() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let acao;
    const existente = await client.query('SELECT id FROM professor WHERE lower(email) = $1 LIMIT 1', [ADMIN.email]);
    if (existente.rows.length) {
      await client.query('UPDATE professor SET admin = TRUE, ativo = TRUE WHERE id = $1', [existente.rows[0].id]);
      acao = 'confirmada';
    } else {
      const senha_hash = await bcrypt.hash(SENHA_PADRAO, SALT_ROUNDS);
      const demo = await client.query(
        'SELECT id FROM professor WHERE lower(email) IN ($1, $2) ORDER BY id LIMIT 1',
        EMAILS_DEMO_ANTIGOS
      );
      if (demo.rows.length) {
        await client.query(
          'UPDATE professor SET nome = $1, email = $2, senha_hash = $3, admin = TRUE, ativo = TRUE WHERE id = $4',
          [ADMIN.nome, ADMIN.email, senha_hash, demo.rows[0].id]
        );
        acao = 'convertida a partir da conta de demonstração do Carlos';
      } else {
        await client.query(
          'INSERT INTO professor (nome, email, senha_hash, admin, ativo) VALUES ($1, $2, $3, TRUE, TRUE)',
          [ADMIN.nome, ADMIN.email, senha_hash]
        );
        acao = 'criada';
      }
    }
    await client.query('UPDATE professor SET ativo = FALSE WHERE lower(email) IN ($1, $2)', EMAILS_DEMO_ANTIGOS);
    await client.query('COMMIT');
    return acao;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  SENHA_PADRAO,
  ADMIN,
  buscarPorEmail,
  buscarPorId,
  criar,
  listar,
  verificarSenha,
  garantirAdministrador,
};
